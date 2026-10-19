import * as THREE from 'three';
import { radialTexture } from '../world/Textures';

const MAX = 600;

/** Pooled additive particles (bursts, boost trail, bump sparks) and expanding shock rings. */
export class VfxSystem {
  readonly group = new THREE.Group();
  private readonly points: THREE.Points;
  private readonly pos = new Float32Array(MAX * 3);
  private readonly col = new Float32Array(MAX * 3);
  private readonly size = new Float32Array(MAX);
  private readonly alpha = new Float32Array(MAX);
  private readonly vel = new Float32Array(MAX * 3);
  private readonly life = new Float32Array(MAX);
  private readonly maxLife = new Float32Array(MAX);
  private readonly baseSize = new Float32Array(MAX);
  private readonly gravity = new Float32Array(MAX);
  private cursor = 0;
  private readonly rings: Array<{ mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; t: number; scale: number }> = [];
  private readonly tmpColor = new THREE.Color();
  private readonly sprayV = new THREE.Vector3();

  constructor() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: radialTexture() }, uScale: { value: 400 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      vertexShader: /* glsl */ `
        attribute float aSize; attribute float aAlpha; varying vec3 vColor; varying float vAlpha; uniform float uScale;
        void main(){
          vColor = color; vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = min(aSize * uScale / max(-mv.z, 0.1), 96.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; varying vec3 vColor; varying float vAlpha;
        void main(){
          float a = texture2D(uMap, gl_PointCoord).a; a = a * a * vAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor * a, 1.0);
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 8;
    this.points.name = 'vfx-particles';
    this.group.add(this.points);

    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.85, 1, 64),
        new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.visible = false;
      ring.renderOrder = 7;
      this.group.add(ring);
      this.rings.push({ mesh: ring, t: 1, scale: 10 });
    }
  }

  setViewportHeight(h: number, fovDeg: number): void {
    (this.points.material as THREE.ShaderMaterial).uniforms.uScale.value = h / (2 * Math.tan((fovDeg * Math.PI) / 360));
  }

  emit(p: THREE.Vector3, v: THREE.Vector3, color: THREE.Color, size: number, life: number, gravity = 0): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % MAX;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = v.x; this.vel[i * 3 + 1] = v.y; this.vel[i * 3 + 2] = v.z;
    this.col[i * 3] = color.r; this.col[i * 3 + 1] = color.g; this.col[i * 3 + 2] = color.b;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.baseSize[i] = size;
    this.gravity[i] = gravity;
  }

  burst(center: THREE.Vector3, color: THREE.Color, count: number, speed: number, size = 0.5, rng: () => number = Math.random): void {
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      v.set(rng() - 0.5, rng() * 0.9 + 0.1, rng() - 0.5).normalize().multiplyScalar(speed * (0.4 + rng() * 0.8));
      this.tmpColor.copy(color).offsetHSL((rng() - 0.5) * 0.06, 0, (rng() - 0.3) * 0.2);
      this.emit(center, v, this.tmpColor, size * (0.6 + rng() * 0.8), 0.7 + rng() * 0.7, -6);
    }
  }

  /**
   * Round 39: sparks thrown off a contact. Directions fill a cone round `dir` (unit, `spread` 0..1 widens it toward a
   * hemisphere), plus `carry` (world velocity added to every spark, e.g. the drone's slide along a wall).
   */
  spray(at: THREE.Vector3, dir: THREE.Vector3, spread: number, count: number, speed: number, color: THREE.Color, size: number, life: number, gravity: number, rng: () => number = Math.random, carry: THREE.Vector3 | null = null): void {
    const v = this.sprayV;
    for (let i = 0; i < count; i++) {
      v.set(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(2 * spread).add(dir).normalize().multiplyScalar(speed * (0.45 + rng() * 0.75));
      if (carry) v.add(carry);
      this.tmpColor.copy(color).offsetHSL((rng() - 0.5) * 0.04, 0, (rng() - 0.2) * 0.25);
      this.emit(at, v, this.tmpColor, size * (0.6 + rng() * 0.8), life * (0.6 + rng() * 0.7), gravity);
    }
  }

  /** Round 39: particles alive right now (probes). */
  live(): number {
    let n = 0;
    for (let i = 0; i < MAX; i++) if (this.life[i] > 0) n++;
    return n;
  }

  ring(center: THREE.Vector3, color: THREE.Color, scale: number): void {
    const r = this.rings.find((x) => x.t >= 1) ?? this.rings[0];
    r.t = 0;
    r.scale = scale;
    r.mesh.position.copy(center);
    r.mesh.material.color.copy(color);
    r.mesh.visible = true;
  }

  update(dt: number): void {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const k = i * 3;
      this.vel[k + 1] += this.gravity[i] * dt;
      const drag = Math.exp(-2.2 * dt);
      this.vel[k] *= drag; this.vel[k + 1] *= drag; this.vel[k + 2] *= drag;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      const t = Math.max(0, this.life[i] / this.maxLife[i]);
      this.alpha[i] = t * t;
      this.size[i] = this.baseSize[i] * (0.4 + t * 0.6);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    (g.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;

    for (const r of this.rings) {
      if (r.t >= 1) continue;
      r.t = Math.min(1, r.t + dt * 1.4);
      const e = 1 - Math.pow(1 - r.t, 3);
      r.mesh.scale.setScalar(0.5 + e * r.scale);
      r.mesh.material.opacity = (1 - r.t) * 0.9;
      if (r.t >= 1) r.mesh.visible = false;
    }
  }
}

/**
 * Round 39: speed streaks. Thin quads in a loose tube round the view axis that rush past the camera, drawn straight in
 * camera space by the vertex shader (one draw, no per-frame buffer upload). They fade in above about 20 m/s. The CPU
 * side only advances the travel and sets the level.
 */
export class SpeedStreaks {
  readonly mesh: THREE.Mesh;
  private readonly uniforms = { uTravel: { value: 0 }, uLen: { value: 1 }, uLevel: { value: 0 }, uColor: { value: new THREE.Color('#fff6e4') } };
  level = 0;

  constructor(count = 56, rng: () => number = Math.random) {
    const pos = new Float32Array(count * 4 * 3); // unused by the shader (camera-space positions come from aSeed)
    const seed = new Float32Array(count * 4 * 3);
    const corner = new Float32Array(count * 4 * 2);
    const idx: number[] = [];
    for (let i = 0; i < count; i++) {
      const a = rng(), r = rng(), ph = rng();
      for (let k = 0; k < 4; k++) {
        const j = i * 4 + k;
        seed[j * 3] = a; seed[j * 3 + 1] = r; seed[j * 3 + 2] = ph;
        corner[j * 2] = k % 2 === 0 ? -1 : 1;
        corner[j * 2 + 1] = k < 2 ? 0 : 1;
      }
      const b = i * 4;
      idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
    geo.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
    geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      vertexShader: /* glsl */ `
        attribute vec3 aSeed; attribute vec2 aCorner;
        uniform float uTravel; uniform float uLen; uniform float uLevel;
        varying float vA; varying float vT;
        void main(){
          float ang = aSeed.x * 6.2831853;
          float rad = mix(1.9, 4.6, aSeed.y);
          const float L = 30.0;
          float z = -(L + 1.5) + mod(aSeed.z * L + uTravel * (0.8 + aSeed.y * 0.4), L);
          vec3 c = vec3(cos(ang) * rad * 1.5, sin(ang) * rad * 0.9 + 0.4, z + aCorner.y * uLen);
          c.xy += vec2(-sin(ang), cos(ang)) * aCorner.x * (0.008 + 0.006 * aSeed.y);
          float fadeFar = smoothstep(-(L + 1.5), -(L - 6.0), z);
          float fadeNear = smoothstep(-0.8, -4.0, z);
          vA = uLevel * fadeFar * fadeNear;
          vT = aCorner.y;
          gl_Position = projectionMatrix * vec4(c, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; varying float vA; varying float vT;
        void main(){
          float a = vA * (0.15 + 0.85 * vT) * 0.32;
          if (a < 0.004) discard;
          gl_FragColor = vec4(uColor, a);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 9;
    this.mesh.name = 'speed-streaks';
    this.mesh.visible = false;
  }

  /** speed in m/s; on: only while flying (title and game over show none). */
  update(dt: number, speed: number, boosting: boolean, on: boolean): void {
    const want = on ? THREE.MathUtils.smoothstep(speed, 19, 27) * (boosting ? 1 : 0.85) : 0;
    this.level += (want - this.level) * (1 - Math.exp(-(want > this.level ? 4 : 3) * dt));
    if (this.level < 0.003) this.level = 0;
    this.uniforms.uLevel.value = this.level;
    this.uniforms.uTravel.value = (this.uniforms.uTravel.value + speed * 1.6 * dt) % 30000;
    this.uniforms.uLen.value = 0.8 + speed * 0.09;
    this.mesh.visible = this.level > 0;
  }
}
