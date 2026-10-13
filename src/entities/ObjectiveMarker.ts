import * as THREE from 'three';
import { padGlyphTexture, radialTexture } from '../world/Textures';

export type MarkerKind = 'pickup' | 'drop';
export const MARKER_COLORS: Record<MarkerKind, THREE.Color> = {
  pickup: new THREE.Color('#ffb400'),
  drop: new THREE.Color('#2fe6c0'),
};

const beamVertex = /* glsl */ `
  varying vec2 vUv;
  varying float vFacing;
  void main(){
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vFacing = abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }`;

/** Active objective: glyph pad, rising force-field ring, sky beacon and (for pickups) a floating parcel. */
export class ObjectiveMarker {
  readonly group = new THREE.Group();
  readonly position = new THREE.Vector3();
  kind: MarkerKind = 'pickup';
  private readonly glyphs: Record<MarkerKind, THREE.Texture>;
  private readonly pad: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private readonly wall: THREE.Mesh<THREE.CylinderGeometry, THREE.ShaderMaterial>;
  private readonly beam: THREE.Mesh<THREE.CylinderGeometry, THREE.ShaderMaterial>;
  private readonly flare: THREE.Sprite;
  private readonly parcel = new THREE.Group();
  private readonly chevrons = new THREE.Group();
  private readonly parcelGlow: THREE.MeshStandardMaterial;
  private readonly chevronMat: THREE.MeshStandardMaterial;
  private pulse = 0;
  private readonly chevron: THREE.Mesh<THREE.ExtrudeGeometry, THREE.MeshBasicMaterial>;

  constructor() {
    this.group.name = 'objective-marker';
    this.glyphs = { pickup: padGlyphTexture('pickup'), drop: padGlyphTexture('drop') };

    this.pad = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: this.glyphs.pickup, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: MARKER_COLORS.pickup, toneMapped: false, fog: false }),
    );
    this.pad.rotation.x = -Math.PI / 2;
    this.pad.position.y = 0.12;
    this.pad.renderOrder = 3;
    this.group.add(this.pad);

    const uniforms = () => ({ uColor: { value: new THREE.Color() }, uTime: { value: 0 }, uIntensity: { value: 1 } });
    this.wall = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 48, 1, true).translate(0, 0.5, 0),
      new THREE.ShaderMaterial({
        uniforms: uniforms(),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        vertexShader: beamVertex,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor; uniform float uTime; uniform float uIntensity;
          varying vec2 vUv; varying float vFacing;
          void main(){
            float h = vUv.y;
            float a = pow(1.0 - h, 2.2);
            float scan = smoothstep(0.92, 1.0, fract(h * 1.0 - uTime * 0.6));
            a = a * 0.55 + scan * (1.0 - h) * 0.6;
            gl_FragColor = vec4(uColor * a * uIntensity, 1.0);
          }`,
      }),
    );
    this.wall.renderOrder = 4;
    this.group.add(this.wall);

    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 24, 1, true).translate(0, 0.5, 0),
      new THREE.ShaderMaterial({
        uniforms: uniforms(),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
        vertexShader: beamVertex,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor; uniform float uTime; uniform float uIntensity;
          varying vec2 vUv; varying float vFacing;
          void main(){
            float h = vUv.y;
            float core = pow(vFacing, 1.6);
            float a = pow(1.0 - h, 1.05) * (0.3 + 0.7 * core);
            float bands = 0.75 + 0.25 * sin(h * 90.0 - uTime * 7.0);
            float pulse = 0.82 + 0.18 * sin(uTime * 4.0);
            gl_FragColor = vec4(uColor * a * bands * pulse * uIntensity, 1.0);
          }`,
      }),
    );
    this.beam.renderOrder = 5;
    this.beam.frustumCulled = false;
    this.group.add(this.beam);

    this.flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), color: MARKER_COLORS.pickup, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }));
    this.flare.renderOrder = 6;
    this.group.add(this.flare);

    // floating parcel
    this.parcelGlow = new THREE.MeshStandardMaterial({ color: '#d39a5e', roughness: 0.7, emissive: '#ff9a2a', emissiveIntensity: 0.35 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), this.parcelGlow);
    box.castShadow = true;
    const tape = new THREE.MeshStandardMaterial({ color: '#fff0c8', emissive: '#ffcf70', emissiveIntensity: 1.4 });
    const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.72, 0.16), tape);
    const t2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.72, 0.92), tape);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.04, 8, 48), new THREE.MeshBasicMaterial({ color: '#ffd27a', toneMapped: false }));
    halo.rotation.x = Math.PI / 2;
    halo.name = 'halo';
    this.parcel.add(box, t1, t2, halo);
    this.group.add(this.parcel);

    // drop chevrons
    this.chevronMat = new THREE.MeshStandardMaterial({ color: '#0c2a26', emissive: MARKER_COLORS.drop, emissiveIntensity: 2.2 });
    const chev = new THREE.ConeGeometry(0.7, 0.55, 4, 1);
    chev.rotateX(Math.PI);
    chev.rotateY(Math.PI / 4);
    chev.scale(1, 1, 0.35);
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(chev, this.chevronMat);
      this.chevrons.add(m);
    }
    this.group.add(this.chevrons);

    // rotating vertical down-chevron above the pad: reads from any angle
    const v = new THREE.Shape();
    v.moveTo(-0.9, 0.7);
    v.lineTo(0, -0.3);
    v.lineTo(0.9, 0.7);
    v.lineTo(0.9, 0.2);
    v.lineTo(0, -0.8);
    v.lineTo(-0.9, 0.2);
    v.closePath();
    const vGeo = new THREE.ExtrudeGeometry(v, { depth: 0.18, bevelEnabled: false });
    vGeo.translate(0, 0, -0.09);
    this.chevron = new THREE.Mesh(vGeo, new THREE.MeshBasicMaterial({ color: MARKER_COLORS.pickup, toneMapped: false }));
    this.chevron.renderOrder = 4;
    this.group.add(this.chevron);
  }

  set(kind: MarkerKind, pos: THREE.Vector3, radius: number): void {
    this.kind = kind;
    this.position.copy(pos);
    this.group.position.copy(pos);
    const c = MARKER_COLORS[kind];
    this.pad.material.map = this.glyphs[kind];
    this.pad.material.color.copy(c).multiplyScalar(2.2);
    this.chevron.material.color.copy(c).multiplyScalar(1.6);
    this.pad.material.needsUpdate = true;
    this.pad.scale.setScalar(radius * 2.3);
    this.wall.material.uniforms.uColor.value.copy(c);
    this.wall.scale.set(radius * 1.15, 2.6, radius * 1.15);
    this.beam.material.uniforms.uColor.value.copy(c);
    (this.flare.material as THREE.SpriteMaterial).color.copy(c);
    this.parcel.visible = kind === 'pickup';
    this.chevrons.visible = kind === 'drop';
    this.pulse = 1;
    this.group.visible = true;
  }

  update(dt: number, time: number, cameraPos: THREE.Vector3): void {
    this.pulse = Math.max(0, this.pulse - dt * 1.5);
    const dist = cameraPos.distanceTo(this.position);
    // keep the beacon at least a few pixels wide far away, slimmer up close
    // 2.4m+ wide column, widening with distance so it stays a few pixels thick at 150m+
    const w = THREE.MathUtils.clamp(dist / 70, 1.2, 6);
    const near = THREE.MathUtils.smoothstep(dist, 6, 40);
    this.beam.scale.set(w, 220, w);
    this.beam.material.uniforms.uIntensity.value = 0.08 + 1.7 * near;
    this.chevron.rotation.y = time * 1.8;
    this.chevron.position.y = (this.kind === 'pickup' ? 4.4 : 5.2) + Math.sin(time * 2.6) * 0.35;
    this.beam.material.uniforms.uTime.value = time;
    this.wall.material.uniforms.uTime.value = time;
    this.wall.material.uniforms.uIntensity.value = 0.9 + this.pulse * 1.5 + Math.sin(time * 4) * 0.15;
    this.pad.rotation.z = time * 0.4;
    const fs = THREE.MathUtils.clamp(dist / 14, 3, 26) * (1 + this.pulse * 0.6);
    this.flare.scale.set(fs, fs, 1);
    this.flare.position.y = 2.2 + Math.min(dist / 30, 6);
    (this.flare.material as THREE.SpriteMaterial).opacity = 0.55 * THREE.MathUtils.smoothstep(dist, 10, 50) + 0.15;

    if (this.parcel.visible) {
      this.parcel.position.y = 1.9 + Math.sin(time * 2.2) * 0.25;
      this.parcel.rotation.y = time * 0.9;
      const halo = this.parcel.getObjectByName('halo');
      if (halo) halo.scale.setScalar(1 + Math.sin(time * 4) * 0.08);
      this.parcelGlow.emissiveIntensity = 0.35 + Math.sin(time * 4) * 0.15;
    }
    if (this.chevrons.visible) {
      this.chevrons.children.forEach((c, i) => {
        const t = (time * 0.8 + i / 3) % 1;
        c.position.y = 4.2 - t * 2.8;
        c.scale.setScalar(0.6 + (1 - Math.abs(t - 0.5) * 2) * 0.5);
      });
      this.chevronMat.emissiveIntensity = 1.8 + Math.sin(time * 5) * 0.6;
    }
  }

  hide(): void {
    this.group.visible = false;
  }
}
