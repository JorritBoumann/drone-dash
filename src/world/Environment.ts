import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createSeededRandom, pick, range } from '../core/random';
import type { CityLayout } from './CityGenerator';
import { asphaltTexture, waterNormalTexture } from './Textures';

export const PALETTE = {
  skyTop: new THREE.Color('#3f6fb8'),
  skyMid: new THREE.Color('#d79a86'),
  horizon: new THREE.Color('#ffbd85'),
  sun: new THREE.Color('#ffe0a8'),
  fog: new THREE.Color('#eeae80'),
};

export const SUN_DIR = new THREE.Vector3(-0.72, 0.34, -0.6).normalize();

/**
 * Round 16: each city has a light mood picked from its seed (cities.cityLook), all in the warm painterly style.
 * `applyMood` rewrites PALETTE and SUN_DIR in place before the sky, fog and lights are built, so every user of the
 * palette (sky shader uniforms, fog, background, the baked environment light) follows. Golden hour is the original look.
 */
export type Mood = {
  name: string;
  skyTop: string; skyMid: string; horizon: string; sun: string; fog: string;
  sunLight: string; sunIntensity: number; hemiSky: string; hemiGround: string; hemiIntensity: number;
  sunDir: [number, number, number];
};
export const MOODS: Mood[] = [
  { name: 'Golden hour', skyTop: '#3f6fb8', skyMid: '#d79a86', horizon: '#ffbd85', sun: '#ffe0a8', fog: '#eeae80', sunLight: '#ffb36b', sunIntensity: 4.0, hemiSky: '#8fb0ec', hemiGround: '#8a5a40', hemiIntensity: 0.42, sunDir: [-0.72, 0.34, -0.6] },
  { name: 'Bright morning', skyTop: '#3d7cc9', skyMid: '#9cc3e4', horizon: '#f2dcc0', sun: '#fff2d6', fog: '#dcd3c6', sunLight: '#fff0d8', sunIntensity: 3.5, hemiSky: '#a9c9f0', hemiGround: '#8a6a52', hemiIntensity: 0.55, sunDir: [0.55, 0.62, -0.56] },
  { name: 'Rose dusk', skyTop: '#33468f', skyMid: '#c4849c', horizon: '#ffa486', sun: '#ffc39a', fog: '#d8978c', sunLight: '#ff9670', sunIntensity: 3.6, hemiSky: '#9b9ddb', hemiGround: '#7a4a48', hemiIntensity: 0.5, sunDir: [0.78, 0.24, 0.58] },
  { name: 'Hazy noon', skyTop: '#4f8db4', skyMid: '#b4d0cc', horizon: '#f5e2b2', sun: '#fff1c4', fog: '#e4dbb8', sunLight: '#ffe4b0', sunIntensity: 3.7, hemiSky: '#b2d2e0', hemiGround: '#8a7050', hemiIntensity: 0.52, sunDir: [-0.35, 0.72, 0.6] },
];
export function applyMood(m: Mood): void {
  PALETTE.skyTop.set(m.skyTop);
  PALETTE.skyMid.set(m.skyMid);
  PALETTE.horizon.set(m.horizon);
  PALETTE.sun.set(m.sun);
  PALETTE.fog.set(m.fog);
  SUN_DIR.set(...m.sunDir).normalize();
}

/** Gradient sky dome with sun disc, halo and painterly cloud bands. */
export function createSky(): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: PALETTE.skyTop },
      uMid: { value: PALETTE.skyMid },
      uHorizon: { value: PALETTE.horizon },
      uSun: { value: PALETTE.sun },
      uSunDir: { value: SUN_DIR },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform vec3 uTop, uMid, uHorizon, uSun, uSunDir;
      uniform float uTime;
      float h21(vec2 p){ p = fract(p*vec2(233.34, 851.73)); p += dot(p, p+23.45); return fract(p.x*p.y); }
      float n2(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<4;i++){ v+=a*n2(p); p*=2.03; a*=0.5; } return v; }
      void main(){
        vec3 d = normalize(vDir);
        float y = d.y;
        float t1 = smoothstep(-0.02, 0.22, y);
        float t2 = smoothstep(0.12, 0.75, y);
        vec3 col = mix(uHorizon, uMid, t1);
        col = mix(col, uTop, t2);
        float sd = max(dot(d, normalize(uSunDir)), 0.0);
        // warm glow around the sun, wide and low
        col += uSun * (pow(sd, 6.0) * 0.45 + pow(sd, 64.0) * 0.6);
        col = mix(col, uSun * 1.6, smoothstep(0.9985, 0.9993, sd));
        // stylised cloud bands on a virtual plane
        if (y > 0.0) {
          vec2 cp = d.xz / (y + 0.12) * 1.3 + vec2(uTime * 0.004, 0.0);
          float c = fbm(cp * vec2(0.7, 1.6));
          float mask = smoothstep(0.52, 0.72, c) * smoothstep(0.0, 0.08, y) * (1.0 - smoothstep(0.35, 0.7, y));
          vec3 cloudLit = mix(vec3(1.0, 0.78, 0.62), vec3(1.0, 0.9, 0.78), pow(sd, 3.0));
          vec3 cloudShade = mix(uMid, vec3(0.75, 0.55, 0.6), 0.5);
          vec3 cloud = mix(cloudShade, cloudLit, smoothstep(0.55, 0.8, c));
          col = mix(col, cloud, mask * 0.85);
        }
        // below horizon fade into fog colour
        col = mix(uHorizon * 0.95, col, smoothstep(-0.08, 0.0, y));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), material);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  sky.name = 'sky';
  return sky;
}

/** Key sun with follow-shadows plus hemisphere fill. */
export class LightingRig {
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  private readonly texel: number;

  constructor(scene: THREE.Scene, mapSize: number, extent: number, mood: Mood = MOODS[0]) {
    this.hemi = new THREE.HemisphereLight(mood.hemiSky, mood.hemiGround, mood.hemiIntensity);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(mood.sunLight, mood.sunIntensity);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(mapSize, mapSize);
    const cam = this.sun.shadow.camera;
    cam.left = -extent;
    cam.right = extent;
    cam.top = extent;
    cam.bottom = -extent;
    cam.near = 1;
    cam.far = 420;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    this.sun.shadow.radius = 3;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.texel = (extent * 2) / mapSize;
  }

  /** Keep the shadow frustum centred on the action, snapped to texels to avoid shimmer. */
  follow(focus: THREE.Vector3): void {
    const s = this.texel * 4;
    const fx = Math.round(focus.x / s) * s;
    const fz = Math.round(focus.z / s) * s;
    this.sun.target.position.set(fx, 0, fz);
    this.sun.position.set(fx + SUN_DIR.x * 200, SUN_DIR.y * 200, fz + SUN_DIR.z * 200);
    this.sun.target.updateMatrixWorld();
  }
}

function coloredBox(w: number, h: number, d: number, x: number, y: number, z: number, hex: string): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  g.translate(x, y, z);
  const c = new THREE.Color(hex);
  const arr = new Float32Array(g.getAttribute('position').count * 3);
  for (let i = 0; i < arr.length; i += 3) {
    arr[i] = c.r;
    arr[i + 1] = c.g;
    arr[i + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  g.deleteAttribute('uv');
  return g;
}

function colored(g: THREE.BufferGeometry, hex: string): THREE.BufferGeometry {
  const n = g.index ? g.toNonIndexed() : g;
  const c = new THREE.Color(hex);
  const arr = new Float32Array(n.getAttribute('position').count * 3);
  for (let i = 0; i < arr.length; i += 3) {
    arr[i] = c.r;
    arr[i + 1] = c.g;
    arr[i + 2] = c.b;
  }
  n.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  n.deleteAttribute('uv');
  return n;
}

type PropRec = {
  x: number; y: number; z: number; r: number; top: number;
  hidden: boolean;
  parts: Array<{ mesh: THREE.InstancedMesh; index: number; matrix: THREE.Matrix4 }>;
};
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

type TreeSpecLike = CityLayout['trees'][number];

type Car = { axis: 0 | 1; line: number; dir: 1 | -1; pos: number; speed: number; lane: number };

/**
 * Everything around the merged city: ground & water, road markings, instanced
 * trees / lamps / traffic, and a hazy skyline across the bay.
 */
export class Environment {
  readonly group = new THREE.Group();
  private readonly water: THREE.Mesh;
  private readonly waterNormal: THREE.Texture;
  private readonly cars: THREE.InstancedMesh;
  private readonly carState: Car[] = [];
  private readonly treeMaterials: THREE.MeshStandardMaterial[] = [];
  private readonly dummy = new THREE.Object3D();
  private readonly half: number;
  readonly props: PropRec[] = [];
  // round 18: rush lanes (two streets that light up at rush hour) and the hover-vans that stream along them
  private rushTarget = 0;
  rushLevel = 0;
  private laneMat: THREE.MeshStandardMaterial | null = null;
  private vans: THREE.InstancedMesh | null = null;
  private vanGlow: THREE.InstancedMesh | null = null;
  private readonly vanState: Array<{ axis: 0 | 1; line: number; dir: 1 | -1; pos: number; speed: number; lane: number; bob: number; delay: number }> = [];
  private rushClock = 0;

  constructor(private readonly layout: CityLayout, seed: number) {
    const rng = createSeededRandom(seed * 31 + 7);
    this.half = layout.half;
    const e = layout.half + 2;

    // Asphalt base
    const asphalt = asphaltTexture();
    asphalt.repeat.set((e * 2) / 14, (e * 2) / 14);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(e * 2, e * 2),
      new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.92, metalness: 0, envMapIntensity: 0.4 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = 'asphalt';
    this.group.add(ground);

    // Bay water
    this.waterNormal = waterNormalTexture();
    this.waterNormal.repeat.set(60, 60);
    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(2400, 2400),
      new THREE.MeshStandardMaterial({
        color: '#2f6f86', roughness: 0.3, metalness: 0.1, normalMap: this.waterNormal,
        normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.1,
      }),
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = -0.7;
    this.water.receiveShadow = true;
    this.water.name = 'water';
    this.group.add(this.water);

    this.group.add(this.createMarkings());
    this.group.add(...this.createLamps());
    this.group.add(...this.createTrees());
    this.cars = this.createCars(rng);
    this.group.add(this.cars);
    this.group.add(this.createSkyline(rng));
    this.group.add(this.createRailings());
    if (layout.rushLanes.length) this.group.add(...this.createRushLanes());
  }

  /** Round 18: rush hour on (true) or reset (false). The lanes light up and hover-vans stream in from the city edge. */
  setRush(on: boolean): void {
    this.rushTarget = on ? 1 : 0;
    this.rushClock = 0;
    if (!on) this.rushLevel = 0;
    if (this.laneMat && !on) this.laneMat.emissiveIntensity = 0;
    this.updateVans(0);
  }

  private createRushLanes(): THREE.Object3D[] {
    const { roadCenters, half } = this.layout;
    const parts: THREE.BufferGeometry[] = [];
    const len = half * 2;
    for (const lane of this.layout.rushLanes) {
      const c = roadCenters[lane.index];
      for (const off of [-5.2, -0.6, 0.6, 5.2]) {
        const g = new THREE.PlaneGeometry(lane.axis === 0 ? len : 0.35, lane.axis === 0 ? 0.35 : len).rotateX(-Math.PI / 2);
        g.translate(lane.axis === 0 ? 0 : c + off, 0.045, lane.axis === 0 ? c + off : 0);
        parts.push(g);
      }
      // chevrons every 11 m pointing both ways down the lanes
      for (let t = -half + 6; t < half - 4; t += 11) {
        for (const side of [-1, 1]) {
          for (const arm of [-1, 1]) {
            const g = new THREE.PlaneGeometry(0.4, 2.0).rotateX(-Math.PI / 2).rotateY(arm * 0.6 * side);
            const along = t + arm * 0.0;
            const across = c + side * 2.9 + arm * 0.55;
            g.translate(lane.axis === 0 ? along : across, 0.05, lane.axis === 0 ? across : along);
            parts.push(g);
          }
        }
      }
    }
    const geo = mergeGeometries(parts)!;
    this.laneMat = new THREE.MeshStandardMaterial({
      color: '#c08a3a', emissive: '#ffae3c', emissiveIntensity: 0, roughness: 0.7,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    });
    const lanes = new THREE.Mesh(geo, this.laneMat);
    lanes.name = 'rush-lanes';
    lanes.receiveShadow = true;

    // hover-vans: boxy delivery vans on a glowing hover pad, 3 m up, hidden until rush hour
    const body = mergeGeometries([
      coloredBox(2.1, 1.7, 4.6, 0, 0, 0, '#f4efe6'),
      coloredBox(2.12, 0.32, 4.62, 0, -0.35, 0, '#e8833a'),
      coloredBox(1.9, 0.62, 0.1, 0, 0.35, 2.3, '#2b3440'),
      coloredBox(0.5, 0.2, 0.06, -0.7, -0.45, 2.32, '#fff6d8'),
      coloredBox(0.5, 0.2, 0.06, 0.7, -0.45, 2.32, '#fff6d8'),
      coloredBox(0.5, 0.2, 0.06, -0.7, -0.45, -2.32, '#d23a2a'),
      coloredBox(0.5, 0.2, 0.06, 0.7, -0.45, -2.32, '#d23a2a'),
      coloredBox(1.6, 0.25, 3.6, 0, -1.0, 0, '#3a4654'),
    ])!;
    const n = 18;
    this.vans = new THREE.InstancedMesh(body, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1 }), n);
    this.vanGlow = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.06, 3.2).translate(0, -1.16, 0), new THREE.MeshBasicMaterial({ color: '#8fe3ff' }), n);
    const rng = createSeededRandom(this.layout.rushLanes[0].index * 977 + this.layout.rushLanes[1].index * 31 + 5);
    for (let i = 0; i < n; i++) {
      const lane = this.layout.rushLanes[i % this.layout.rushLanes.length];
      const dir = (i >> 1) % 2 === 0 ? 1 : -1;
      this.vanState.push({ axis: lane.axis, line: roadCenters[lane.index], dir, pos: -dir * (half + 4), speed: range(rng, 15, 20), lane: dir * 2.9, bob: rng() * 6.28, delay: Math.floor(i / 4) * 2.2 + rng() * 1.5 });
    }
    for (const m of [this.vans, this.vanGlow]) {
      m.frustumCulled = false;
      m.castShadow = m === this.vans;
    }
    this.vans.name = 'hover-vans';
    this.updateVans(0);
    return [lanes, this.vans, this.vanGlow];
  }

  /**
   * Round 19: rush-hour vans give a draft. True when the drone is 2 to 10 m behind a live van, in line with it (within
   * 2.2 m sideways, 1.2 to 5.5 m up) and flying its way at 8 m/s or more. The vans still never collide.
   */
  vanDraft(p: THREE.Vector3, vx: number, vz: number): boolean {
    if (this.rushTarget <= 0) return false;
    for (const v of this.vanState) {
      if (this.rushClock <= v.delay) continue;
      const along = v.axis === 0 ? (p.x - v.pos) * v.dir : (p.z - v.pos) * v.dir; // + ahead of the van
      const side = v.axis === 0 ? p.z - (v.line + v.lane) : p.x - (v.line - v.lane);
      const vel = (v.axis === 0 ? vx : vz) * v.dir;
      if (along < -10 || along > -2 || Math.abs(side) > 2.2 || p.y < 1.2 || p.y > 5.5 || vel < 8) continue;
      return true;
    }
    return false;
  }

  /** Round 19 test hook: live vans (x, z, direction of travel as a unit vector). */
  vanPositions(): Array<{ x: number; y: number; z: number; dx: number; dz: number }> {
    if (this.rushTarget <= 0) return [];
    return this.vanState.filter((v) => this.rushClock > v.delay).map((v) => v.axis === 0
      ? { x: v.pos, y: 3.1, z: v.line + v.lane, dx: v.dir, dz: 0 }
      : { x: v.line - v.lane, y: 3.1, z: v.pos, dx: 0, dz: v.dir });
  }

  private updateVans(dt: number): void {
    if (!this.vans || !this.vanGlow) return;
    const half = this.half;
    this.rushClock += dt;
    for (let i = 0; i < this.vanState.length; i++) {
      const v = this.vanState[i];
      const live = this.rushTarget > 0 && this.rushClock > v.delay;
      if (!live) {
        v.pos = -v.dir * (half + 4);
        this.dummy.scale.setScalar(0);
      } else {
        v.pos += v.dir * v.speed * dt;
        if (v.pos > half + 6) v.pos -= half * 2 + 12;
        if (v.pos < -half - 6) v.pos += half * 2 + 12;
        this.dummy.scale.setScalar(1);
      }
      v.bob += dt * 2.2;
      const y = 3.1 + Math.sin(v.bob) * 0.15;
      if (v.axis === 0) {
        this.dummy.position.set(v.pos, y, v.line + v.lane);
        this.dummy.rotation.set(0, v.dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
      } else {
        this.dummy.position.set(v.line - v.lane, y, v.pos);
        this.dummy.rotation.set(0, v.dir > 0 ? 0 : Math.PI, 0);
      }
      this.dummy.updateMatrix();
      this.vans.setMatrixAt(i, this.dummy.matrix);
      this.vanGlow.setMatrixAt(i, this.dummy.matrix);
    }
    this.vans.instanceMatrix.needsUpdate = true;
    this.vanGlow.instanceMatrix.needsUpdate = true;
  }

  private createMarkings(): THREE.InstancedMesh {
    const { roadCenters, blockSize: B, roadWidth: R, half } = this.layout;
    const mats: THREE.Matrix4[] = [];
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    const add = (x: number, z: number, sx: number, sz: number) => {
      mats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0.03, z), q, new THREE.Vector3(sx, sz, 1)));
    };
    for (const c of roadCenters) {
      for (let s = -half + R; s < half - R / 2; s += B + R) {
        // dashed centre line along both axes
        for (let t = s + 2.5; t < s + B - 1.5; t += 4) {
          add(t, c, 2.0, 0.22);
          add(c, t, 0.22, 2.0);
        }
        // crosswalks at both ends of each segment
        for (const end of [s + 1.2, s + B - 1.2]) {
          for (let k = -4; k <= 4; k++) {
            add(end, c + k * 1.2, 1.6, 0.6);
            add(c + k * 1.2, end, 0.6, 1.6);
          }
        }
        // stop lines
        add(s + 2.6, c + R / 4, 0.3, R / 2 - 0.6);
        add(s + B - 2.6, c - R / 4, 0.3, R / 2 - 0.6);
        add(c - R / 4, s + 2.6, R / 2 - 0.6, 0.3);
        add(c + R / 4, s + B - 2.6, R / 2 - 0.6, 0.3);
      }
    }
    const mesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshStandardMaterial({ color: '#f1ece0', roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      mats.length,
    );
    mats.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.receiveShadow = true;
    mesh.name = 'road-markings';
    return mesh;
  }

  private createLamps(): THREE.Object3D[] {
    const lamps = this.layout.lamps;
    const pole = mergeGeometries([
      colored(new THREE.CylinderGeometry(0.09, 0.14, 6, 8).translate(0, 3, 0), '#39424c'),
      colored(new THREE.CylinderGeometry(0.22, 0.26, 0.5, 8).translate(0, 0.25, 0), '#39424c'),
      coloredBox(0.1, 0.1, 1.6, 0, 6.0, 0.75, '#39424c'),
      coloredBox(0.36, 0.14, 0.62, 0, 5.98, 1.5, '#2c333b'),
    ])!;
    const poleMesh = new THREE.InstancedMesh(pole, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.6 }), lamps.length);
    const head = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.3, 0.06, 0.52),
      new THREE.MeshStandardMaterial({ color: '#2a2a2a', emissive: '#ffd59a', emissiveIntensity: 1.5 }),
      lamps.length,
    );
    lamps.forEach((l, i) => {
      this.dummy.position.set(l.x, 0.25, l.z);
      this.dummy.rotation.set(0, l.rot, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      poleMesh.setMatrixAt(i, this.dummy.matrix);
      const poleMatrix = this.dummy.matrix.clone();
      const off = new THREE.Vector3(0, 5.9, 1.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), l.rot);
      this.dummy.position.set(l.x + off.x, 0.25 + off.y, l.z + off.z);
      this.dummy.updateMatrix();
      head.setMatrixAt(i, this.dummy.matrix);
      this.props.push({
        x: l.x + off.x * 0.5, y: 0, z: l.z + off.z * 0.5, r: 1.1, top: 6.6, hidden: false,
        parts: [{ mesh: poleMesh, index: i, matrix: poleMatrix }, { mesh: head, index: i, matrix: this.dummy.matrix.clone() }],
      });
    });
    poleMesh.castShadow = true;
    poleMesh.name = 'lamp-poles';
    head.name = 'lamp-heads';
    return [poleMesh, head];
  }

  private createTrees(): THREE.Object3D[] {
    const trees = this.layout.trees;
    const round = trees.filter((t) => !t.pine);
    const pines = trees.filter((t) => t.pine);

    const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b4a36', roughness: 0.9 });
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.22, 2.6, 6).translate(0, 1.3, 0), trunkMat, trees.length);

    // Faceted, slightly lumpy canopy
    const canopyGeo = new THREE.IcosahedronGeometry(1, 1);
    const pos = canopyGeo.getAttribute('position');
    const jr = createSeededRandom(5);
    const cache = new Map<string, number>();
    for (let i = 0; i < pos.count; i++) {
      const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
      let k = cache.get(key);
      if (k === undefined) {
        k = 0.85 + jr() * 0.3;
        cache.set(key, k);
      }
      pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.85, pos.getZ(i) * k);
    }
    canopyGeo.computeVertexNormals();
    const canopyMat = new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true });
    const pineGeo = mergeGeometries([
      new THREE.ConeGeometry(1.5, 2.4, 7).translate(0, 2.6, 0).toNonIndexed(),
      new THREE.ConeGeometry(1.15, 2.0, 7).translate(0, 3.9, 0).toNonIndexed(),
      new THREE.ConeGeometry(0.75, 1.7, 7).translate(0, 5.1, 0).toNonIndexed(),
    ].map((g) => { g.deleteAttribute('uv'); return g; }))!;
    const pineMat = new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true });
    this.addSway(canopyMat, 1.0);
    this.addSway(pineMat, -2.0);

    const canopy = new THREE.InstancedMesh(canopyGeo, canopyMat, Math.max(1, round.length));
    const pine = new THREE.InstancedMesh(pineGeo, pineMat, Math.max(1, pines.length));
    canopy.count = round.length;
    pine.count = pines.length;

    const r = createSeededRandom(11);
    const recs = new Map<TreeSpecLike, PropRec>();
    trees.forEach((t, i) => {
      this.dummy.position.set(t.x, t.y, t.z);
      this.dummy.rotation.set(0, r() * Math.PI * 2, 0);
      this.dummy.scale.setScalar(t.scale);
      this.dummy.updateMatrix();
      trunk.setMatrixAt(i, this.dummy.matrix);
      const rec: PropRec = {
        x: t.x, y: t.y, z: t.z, r: (t.pine ? 2.2 : 2.2) * t.scale, top: t.y + (t.pine ? 7.4 : 5.8) * t.scale, hidden: false,
        parts: [{ mesh: trunk, index: i, matrix: this.dummy.matrix.clone() }],
      };
      recs.set(t, rec);
      this.props.push(rec);
    });
    round.forEach((t, i) => {
      this.dummy.position.set(t.x, t.y, t.z);
      this.dummy.rotation.set(0, r() * Math.PI * 2, 0);
      this.dummy.position.y = t.y + 3.4 * t.scale;
      this.dummy.scale.set(t.scale * 2.0, t.scale * 1.8, t.scale * 2.0);
      this.dummy.updateMatrix();
      canopy.setMatrixAt(i, this.dummy.matrix);
      canopy.setColorAt(i, t.color);
      recs.get(t)!.parts.push({ mesh: canopy, index: i, matrix: this.dummy.matrix.clone() });
    });
    pines.forEach((t, i) => {
      this.dummy.position.set(t.x, t.y, t.z);
      this.dummy.rotation.set(0, r() * Math.PI * 2, 0);
      this.dummy.scale.setScalar(t.scale * 1.2);
      this.dummy.updateMatrix();
      pine.setMatrixAt(i, this.dummy.matrix);
      pine.setColorAt(i, t.color);
      recs.get(t)!.parts.push({ mesh: pine, index: i, matrix: this.dummy.matrix.clone() });
    });
    for (const m of [trunk, canopy, pine]) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
    trunk.name = 'tree-trunks';
    canopy.name = 'tree-canopies';
    pine.name = 'tree-pines';
    return [trunk, canopy, pine];
  }

  private addSway(material: THREE.MeshStandardMaterial, base: number): void {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      material.userData.shader = shader;
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float phase = instanceMatrix[3].x * 0.3 + instanceMatrix[3].z * 0.2;
        #else
          float phase = 0.0;
        #endif
        float hgt = max(position.y + (${base.toFixed(2)}), 0.0);
        transformed.x += sin(uTime * 1.3 + phase) * 0.035 * hgt;
        transformed.z += cos(uTime * 1.1 + phase) * 0.025 * hgt;`,
      );
    };
    material.customProgramCacheKey = () => `tree-sway-${base}`;
    this.treeMaterials.push(material);
  }

  private createCars(rng: () => number): THREE.InstancedMesh {
    const body = mergeGeometries([
      coloredBox(1.9, 0.62, 4.2, 0, 0.62, 0, '#ffffff'),
      coloredBox(1.7, 0.6, 2.2, 0, 1.2, -0.2, '#ffffff'),
      coloredBox(1.72, 0.44, 2.0, 0, 1.2, -0.2, '#2b3440'),
      coloredBox(1.74, 0.42, 0.12, 0, 1.18, 0.9, '#3a4654'),
      coloredBox(0.4, 0.16, 0.06, -0.62, 0.72, 2.11, '#fff6d8'),
      coloredBox(0.4, 0.16, 0.06, 0.62, 0.72, 2.11, '#fff6d8'),
      coloredBox(0.4, 0.14, 0.06, -0.62, 0.74, -2.11, '#d23a2a'),
      coloredBox(0.4, 0.14, 0.06, 0.62, 0.74, -2.11, '#d23a2a'),
      colored(new THREE.CylinderGeometry(0.36, 0.36, 2.0, 10).rotateZ(Math.PI / 2).translate(0, 0.36, 1.35), '#1d1f22'),
      colored(new THREE.CylinderGeometry(0.36, 0.36, 2.0, 10).rotateZ(Math.PI / 2).translate(0, 0.36, -1.35), '#1d1f22'),
    ])!;
    const count = 44;
    const mesh = new THREE.InstancedMesh(body, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.1 }), count);
    const colors = ['#e63946', '#f1faee', '#a8dadc', '#457b9d', '#f4a261', '#2a9d8f', '#e9c46a', '#ffffff', '#264653', '#ff8fab'];
    const lines = this.layout.roadCenters;
    for (let i = 0; i < count; i++) {
      const axis = (i % 2) as 0 | 1;
      const dir = rng() > 0.5 ? 1 : -1;
      this.carState.push({
        axis,
        line: lines[Math.floor(rng() * lines.length)],
        dir,
        pos: range(rng, -this.half, this.half),
        speed: range(rng, 6, 11),
        lane: dir * 2.9,
      });
      mesh.setColorAt(i, new THREE.Color(pick(rng, colors)));
    }
    mesh.castShadow = true;
    mesh.name = 'traffic';
    mesh.frustumCulled = false;
    this.updateCars(0, mesh);
    return mesh;
  }

  private updateCars(dt: number, mesh: THREE.InstancedMesh = this.cars): void {
    const half = this.half;
    for (let i = 0; i < this.carState.length; i++) {
      const c = this.carState[i];
      c.pos += c.dir * c.speed * dt;
      if (c.pos > half) c.pos -= half * 2;
      if (c.pos < -half) c.pos += half * 2;
      if (c.axis === 0) {
        this.dummy.position.set(c.pos, 0, c.line + c.lane);
        this.dummy.rotation.set(0, c.dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
      } else {
        this.dummy.position.set(c.line - c.lane, 0, c.pos);
        this.dummy.rotation.set(0, c.dir > 0 ? 0 : Math.PI, 0);
      }
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(i, this.dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  private createSkyline(rng: () => number): THREE.InstancedMesh {
    const count = 140;
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
      new THREE.MeshLambertMaterial({ color: '#b49aa0' }),
      count,
    );
    let n = 0;
    // three distant clusters across the bay
    const clusters = [
      { a: -2.3, spread: 0.45, r: 680 },
      { a: 0.9, spread: 0.4, r: 720 },
      { a: 2.6, spread: 0.3, r: 640 },
    ];
    for (const cl of clusters) {
      const per = Math.floor(count / clusters.length);
      for (let k = 0; k < per && n < count; k++, n++) {
        const a = cl.a + (rng() - 0.5) * cl.spread * 2;
        const r = cl.r + (rng() - 0.5) * 70;
        const centre = 1 - Math.abs((a - cl.a) / cl.spread);
        const h = 8 + rng() * 18 + centre * centre * rng() * 55;
        this.dummy.position.set(Math.cos(a) * r, -0.7, Math.sin(a) * r);
        this.dummy.rotation.set(0, rng() * Math.PI, 0);
        this.dummy.scale.set(8 + rng() * 14, h, 8 + rng() * 14);
        this.dummy.updateMatrix();
        mesh.setMatrixAt(n, this.dummy.matrix);
      }
    }
    mesh.count = n;
    mesh.name = 'skyline';
    return mesh;
  }

  private createRailings(): THREE.Mesh {
    const e = this.layout.half + 2;
    const parts: THREE.BufferGeometry[] = [];
    const y = 0.5;
    const len = e * 2 + 4;
    for (const [x, z, rot] of [[0, -e - 1.8, 0], [0, e + 1.8, 0], [-e - 1.8, 0, Math.PI / 2], [e + 1.8, 0, Math.PI / 2]] as const) {
      const rail = new THREE.BoxGeometry(len, 0.08, 0.08).translate(0, y + 1.0, 0);
      const rail2 = new THREE.BoxGeometry(len, 0.06, 0.06).translate(0, y + 0.55, 0);
      const g = mergeGeometries([rail, rail2])!;
      g.rotateY(rot);
      g.translate(x, 0, z);
      parts.push(g);
      for (let t = -len / 2; t <= len / 2; t += 3) {
        const post = new THREE.BoxGeometry(0.1, 1.05, 0.1).translate(t, y + 0.52, 0);
        post.rotateY(rot);
        post.translate(x, 0, z);
        parts.push(post);
      }
    }
    const mesh = new THREE.Mesh(mergeGeometries(parts)!, new THREE.MeshStandardMaterial({ color: '#3d4650', roughness: 0.5, metalness: 0.7 }));
    mesh.name = 'railings';
    return mesh;
  }

  /**
   * Hide trees / lamp posts that sit between the camera and the drone or right
   * next to the camera, so foliage never blankets the view.
   */
  hiddenProps = 0;

  updateOcclusion(cam: THREE.Vector3, drone: THREE.Vector3): void {
    const minX = Math.min(cam.x, drone.x) - 6, maxX = Math.max(cam.x, drone.x) + 6;
    const minZ = Math.min(cam.z, drone.z) - 6, maxZ = Math.max(cam.z, drone.z) + 6;
    const dirty = new Set<THREE.InstancedMesh>();
    const camToDrone = Math.max(0.001, Math.hypot(drone.x - cam.x, drone.z - cam.z));
    const fx = (drone.x - cam.x) / camToDrone, fz = (drone.z - cam.z) / camToDrone;
    for (const p of this.props) {
      let hide = false;
      if (p.x > minX && p.x < maxX && p.z > minZ && p.z < maxZ) {
        // sample sight lines camera -> drone and camera -> points below it (the lower frame), extended past the camera,
        // against the prop's vertical capsule
        for (let line = 0; line < 3 && !hide; line++) {
          const ty = drone.y - line * 3.5;
          for (let k = 0; k <= 10 && !hide; k++) {
            const t = (k / 10) * 1.2;
            const sx = drone.x + (cam.x - drone.x) * t;
            const sy = ty + (cam.y - ty) * t;
            const sz = drone.z + (cam.z - drone.z) * t;
            if (sy > p.top + 0.6 || sy < p.y - 0.5) continue;
            if (Math.hypot(sx - p.x, sz - p.z) < p.r + 0.8) hide = true;
          }
        }
        // anything in the view cone that is closer to the camera than the drone fills the foreground: hide it
        if (!hide && p.top > cam.y - 9) {
          const vx = p.x - cam.x, vz = p.z - cam.z;
          const along = vx * fx + vz * fz;
          const lateral = Math.abs(vx * fz - vz * fx);
          if (along > -p.r && along < camToDrone + 1.5 && lateral < Math.max(0, along) * 0.75 + p.r + 1.5) hide = true;
          else if (Math.hypot(vx, vz) < p.r + 1.5) hide = true;
        }
      }
      if (hide === p.hidden) continue;
      p.hidden = hide;
      for (const part of p.parts) {
        part.mesh.setMatrixAt(part.index, hide ? ZERO : part.matrix);
        dirty.add(part.mesh);
      }
    }
    for (const m of dirty) m.instanceMatrix.needsUpdate = true;
    this.hiddenProps = this.props.reduce((n, p) => n + (p.hidden ? 1 : 0), 0);
  }

  update(dt: number, time: number): void {
    this.updateCars(dt);
    if (this.laneMat) {
      this.rushLevel += (this.rushTarget - this.rushLevel) * Math.min(1, dt * 1.5);
      // lit lanes pulse gently once rush hour is on
      this.laneMat.emissiveIntensity = this.rushLevel * (0.85 + 0.25 * Math.sin(time * 3.2));
    }
    if (this.rushTarget > 0 || this.rushClock === 0) this.updateVans(dt);
    this.waterNormal.offset.set(time * 0.004, time * 0.0025);
    for (const m of this.treeMaterials) {
      const shader = m.userData.shader as { uniforms: Record<string, THREE.IUniform> } | undefined;
      if (shader) shader.uniforms.uTime.value = time;
    }
  }
}
