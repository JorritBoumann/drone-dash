import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RINGS } from '../game/config';

/**
 * Round 48: tailwind rings. A few glowing rings hang over the leg's street route; flying through one gives a free boost
 * burst and a little clock time (Game applies both). Drawn only, never a collider, so missing one costs nothing.
 * All rings are one InstancedMesh (one draw call): a bright hoop, a faint inner hoop and six short wind streaks
 * that run along the way through, so a ring reads as "fly through here, this way" from down the street.
 * A taken ring flares (grows and fades, by its instance colour under additive blending) and is gone.
 */
export type Ring = { x: number; y: number; z: number; dx: number; dz: number; on: boolean; takenAt: number };

const MAX = 6;
const COLOR = new THREE.Color('#79f2ff');
const FLARE = 0.4; // s

export class TailwindRings {
  readonly mesh: THREE.InstancedMesh;
  readonly rings: Ring[] = [];
  private readonly mat: THREE.MeshBasicMaterial;
  private readonly m4 = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly col = new THREE.Color();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private time = 0;

  constructor() {
    const R = RINGS.radius;
    // each part carries its own brightness as a vertex colour (instance colour x vertex colour under additive blending)
    const tint = (g: THREE.BufferGeometry, k: number) => {
      g.deleteAttribute('uv');
      g.deleteAttribute('normal');
      const n = g.getAttribute('position').count;
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(k), 3));
      return g;
    };
    const parts: THREE.BufferGeometry[] = [
      tint(new THREE.TorusGeometry(R, 0.26, 6, 40), 1), // the hoop
      tint(new THREE.TorusGeometry(R - 0.55, 0.07, 4, 32), 0.6), // a thin inner hoop
      tint(new THREE.RingGeometry(R - 0.7, R + 0.75, 40, 1), 0.16), // a faint halo disc (reads as glow without bloom)
    ];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
      const st = new THREE.BoxGeometry(0.1, 0.1, 2.2);
      st.translate(Math.cos(a) * (R + 0.02), Math.sin(a) * (R + 0.02), -1.5); // ahead of the hoop (the way through is -z)
      parts.push(tint(st, 0.75));
    }
    const geo = mergeGeometries(parts)!;
    for (const g of parts) g.dispose();
    this.mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      fog: false, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, MAX);
    this.mesh.name = 'tailwind-rings';
    this.mesh.count = 0;
    this.mesh.frustumCulled = false; // the instances spread over a whole leg; the bounds are not worth keeping
    this.mesh.renderOrder = 3;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, COLOR);
    this.mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
  }

  /** Replace the rings (a new leg). `list` holds centre points and the unit way through (dx, dz). */
  place(list: Array<{ x: number; y: number; z: number; dx: number; dz: number }>): void {
    this.rings.length = 0;
    for (const r of list.slice(0, MAX)) this.rings.push({ ...r, on: true, takenAt: -1 });
    this.mesh.count = this.rings.length;
    this.write();
  }

  clear(): void {
    this.place([]);
  }

  get active(): number {
    let n = 0;
    for (const r of this.rings) if (r.on) n++;
    return n;
  }

  /**
   * Did the drone fly through a ring between `prev` and `cur`? The move must cross the ring's plane within `capture` m of
   * its axis. Returns the ring taken (marked off), or null.
   */
  check(prev: THREE.Vector3, cur: THREE.Vector3): Ring | null {
    for (const r of this.rings) {
      if (!r.on) continue;
      const a = (prev.x - r.x) * r.dx + (prev.z - r.z) * r.dz;
      const b = (cur.x - r.x) * r.dx + (cur.z - r.z) * r.dz;
      if ((a > 0 && b > 0) || (a < 0 && b < 0)) continue;
      const t = a === b ? 0 : a / (a - b);
      const px = prev.x + (cur.x - prev.x) * t - r.x, py = prev.y + (cur.y - prev.y) * t - r.y, pz = prev.z + (cur.z - prev.z) * t - r.z;
      // distance from the ring's axis: the crossing point minus its part along the axis
      const along = px * r.dx + pz * r.dz;
      const lx = px - along * r.dx, lz = pz - along * r.dz;
      if (lx * lx + py * py + lz * lz > RINGS.capture * RINGS.capture) continue;
      r.on = false;
      r.takenAt = this.time;
      return r;
    }
    return null;
  }

  update(dt: number): void {
    this.time += dt;
    if (this.rings.length) this.write();
  }

  private write(): void {
    const t = this.time;
    let i = 0;
    for (const r of this.rings) {
      // bright enough to bloom on desktop (threshold 1.15), with a slow breathing pulse
      let scale = 1 + Math.sin(t * 3.2 + r.x * 0.07) * 0.035;
      let fade = 1.75 + Math.sin(t * 3.2 + r.x * 0.07) * 0.3;
      if (!r.on) {
        const k = (t - r.takenAt) / FLARE;
        if (k >= 1) { scale = 0; fade = 0; }
        else { scale = 1 + k * 0.9; fade = 2.6 * (1 - k); }
      }
      // the hoop faces along the way through: its local -z is (dx, dz)
      this.q.setFromAxisAngle(this.up, Math.atan2(-r.dx, -r.dz));
      this.v.set(r.x, r.y, r.z);
      this.s.setScalar(Math.max(1e-4, scale));
      this.m4.compose(this.v, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m4);
      this.col.copy(COLOR).multiplyScalar(fade);
      this.mesh.setColorAt(i, this.col);
      i++;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
