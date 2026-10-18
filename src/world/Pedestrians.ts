import * as THREE from 'three';
import { shadowSubset } from './shadowSubset';
import { createSeededRandom, pick, range, type Rng } from '../core/random';
import type { CityLayout } from './CityGenerator';
import { PANTS, SHIRTS, buildPedGeometry, pedMaterial } from './StreetKit';
import { benchSpots } from './BuildingDetail';

/**
 * Round 22: people. Walkers stroll round every block on the sidewalk (two loops a block, one each way, keeping right),
 * more downtown and next to parks, and out and back along the park paths to the fountain. Some pause at corners as if
 * waiting to cross; others stand at shop doors and by the fountain. When the drone passes low and fast they duck, throw
 * their arms up, look up and step aside. They never collide, never stop on a pad, and walk off (or turn back from) the
 * pad of the current pickup or drop. Drawn with one InstancedMesh, only near the camera.
 */

/** Round 23: people further than this from the camera use the low-detail figure (m). */
const LOD_NEAR = 24;
/** Round 33: low-detail people this close (m) still cast a shadow (LOD_NEAR was 40, so the shadows stay where they were). */
const FAR_SHADOW = 40;
/** Round 29: people closer than this (m) are always drawn; further out only in or near the camera's view (margin, m). */
const PEOPLE_FULL = 14;
const PEOPLE_MARGIN = 3.5;
const SIDEWALK_H = 0.25;
const PATH_H = SIDEWALK_H + 0.12;

type Path = {
  pts: Array<{ x: number; z: number }>; seg: number[]; cum: number[]; L: number;
  cx: number; cz: number; rad: number; y: number;
  twin: number; shift: number; asideMin: number; asideMax: number; kind: 'ring' | 'spoke';
  peds: number[]; near: boolean;
};
type Ped = {
  path: number; s: number; speed: number; base: number; pause: number; faceYaw: number; hurry: boolean;
  react: number; cool: number; aside: number; asideT: number; jx: number; jz: number;
  phase: number; x: number; z: number; y: number; yaw: number; scale: number;
  shirt: THREE.Color; pants: THREE.Color; look: number; seg: number; rx: number; rz: number; hid?: boolean;
  /** round 27: outfit (0 shirt, 1 shorts, 2 dress, 3 jacket, 4 coat), accessory bits (1 hat, 2 bag, 4 backpack),
   * pose (0 walk / stand, 1 phone, 2 talking, 3 sitting) and accent colour index */
  outfit: number; acc: number; pose: number; accent: number; sit?: boolean;
};

export class Pedestrians {
  /** Round 23: near (full detail) and far (low detail, LOD_NEAR on) people. */
  readonly mesh: THREE.Group;
  private readonly near: THREE.InstancedMesh;
  private readonly far: THREE.InstancedMesh;
  private readonly fanim: THREE.InstancedBufferAttribute;
  private readonly fpants: THREE.InstancedBufferAttribute;
  private readonly iextra: THREE.InstancedBufferAttribute;
  private readonly fextra: THREE.InstancedBufferAttribute;
  /** Round 27: the looks (outfit, hair, accessories, pose) come from their own stream, so placement is unchanged. */
  private readonly lookRng: Rng;
  sitting = 0;
  phones = 0;
  talking = 0;
  private readonly paths: Path[] = [];
  private readonly peds: Ped[] = [];
  private readonly rng: Rng;
  private readonly ianim: THREE.InstancedBufferAttribute;
  private readonly ipants: THREE.InstancedBufferAttribute;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly sc = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly R: number;
  private pad = { x: 0, z: 0, r: 0 };
  reactions = 0;
  reacting = 0;
  drawn = 0;
  drawnFar = 0;
  /** Round 23: person-frames kept off the live pad by the last-resort hide (diagnostics; should stay near 0). */
  padHidden = 0;
  droppedLoops = 0;
  onPad = 0;

  constructor(private readonly layout: CityLayout, seed: number, mobile = false) {
    this.rng = createSeededRandom(seed * 53 + 29);
    this.lookRng = createSeededRandom(seed * 101 + 7);
    this.R = mobile ? 82 : 105;
    this.build();
    const geo = buildPedGeometry(false);
    const geoFar = buildPedGeometry(true);
    const n = Math.max(1, this.peds.length);
    this.iextra = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
    this.fextra = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
    this.ianim = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
    this.ipants = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    this.fanim = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
    this.fpants = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    const mat = pedMaterial();
    const make = (anim: THREE.InstancedBufferAttribute, pants: THREE.InstancedBufferAttribute, far: boolean) => {
      const g = new THREE.BufferGeometry();
      for (const [name, attr] of Object.entries((far ? geoFar : geo).attributes)) g.setAttribute(name, attr);
      const extra = far ? this.fextra : this.iextra;
      anim.setUsage(THREE.DynamicDrawUsage);
      pants.setUsage(THREE.DynamicDrawUsage);
      extra.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('ianim', anim);
      g.setAttribute('ipants', pants);
      g.setAttribute('iextra', extra);
      const m = new THREE.InstancedMesh(g, mat, n);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.setColorAt(0, new THREE.Color());
      m.instanceColor!.setUsage(THREE.DynamicDrawUsage);
      m.castShadow = true; // round 33: far people cast only within FAR_SHADOW (see shadowSubset); past it, none
      if (far) shadowSubset(m);
      else {
        // round 33: near people's shadows skip the small details (hands, shoes, nose, phone, ...): see buildPedGeometry
        const sv = (geo.userData.shadowVerts as number | undefined) ?? Infinity;
        m.onBeforeShadow = () => { g.setDrawRange(0, sv); };
        m.onAfterShadow = () => { g.setDrawRange(0, Infinity); };
      }
      m.frustumCulled = false;
      m.count = 0;
      m.name = far ? 'pedestrians-far' : 'pedestrians';
      return m;
    };
    this.near = make(this.ianim, this.ipants, false);
    this.far = make(this.fanim, this.fpants, true);
    this.mesh = new THREE.Group();
    this.mesh.add(this.near, this.far);
    this.mesh.name = 'pedestrians';
  }

  get total(): number { return this.peds.length; }

  // ----------------------------------------------------------------------------------------------------------------
  // build
  // ----------------------------------------------------------------------------------------------------------------

  /** True when a person (radius r) at x, z would touch a solid or a tree / lamp post. */
  private blocked(x: number, z: number, r = 0.25): boolean {
    for (const b of this.layout.colliders) {
      if (b.minY > 1.9 || b.maxY < 0.2) continue;
      if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) return true;
    }
    return false;
  }
  private nearPad(x: number, z: number, m: number): boolean {
    return this.layout.sites.some((s) => s.pos.y < 2 && Math.hypot(s.pos.x - x, s.pos.z - z) < s.radius + m);
  }

  private addPath(pts: Array<{ x: number; z: number }>, y: number, kind: 'ring' | 'spoke', asideMin: number, asideMax: number): number {
    const seg: number[] = [], cum: number[] = [0];
    let L = 0;
    for (let k = 0; k < pts.length; k++) {
      const a = pts[k], b = pts[(k + 1) % pts.length];
      const l = Math.hypot(b.x - a.x, b.z - a.z);
      seg.push(l);
      L += l;
      cum.push(L);
    }
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cz = pts.reduce((s, p) => s + p.z, 0) / pts.length;
    const rad = Math.max(...pts.map((p) => Math.hypot(p.x - cx, p.z - cz)));
    const path: Path = { pts, seg, cum, L, cx, cz, rad, y, twin: -1, shift: 0, asideMin, asideMax, kind, peds: [], near: false };
    // every metre must be clear of solids, trees and lamp posts, else the loop is dropped
    for (let s = 0; s < L; s += 0.8) {
      const p = this.at(path, s);
      if (this.blocked(p.x, p.z, 0.22)) { this.droppedLoops++; return -1; }
    }
    this.paths.push(path);
    return this.paths.length - 1;
  }

  private at(p: Path, s: number): { x: number; z: number; tx: number; tz: number; k: number } {
    s = ((s % p.L) + p.L) % p.L;
    let k = 0;
    while (k < p.seg.length - 1 && s >= p.cum[k + 1]) k++;
    const a = p.pts[k], b = p.pts[(k + 1) % p.pts.length];
    const u = p.seg[k] > 0 ? (s - p.cum[k]) / p.seg[k] : 0;
    const tx = (b.x - a.x) / (p.seg[k] || 1), tz = (b.z - a.z) / (p.seg[k] || 1);
    return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u, tx, tz, k };
  }

  /** Nearest arc length on a path to a point. */
  private project(p: Path, x: number, z: number): number {
    let best = 0, bd = Infinity;
    for (let k = 0; k < p.pts.length; k++) {
      const a = p.pts[k], b = p.pts[(k + 1) % p.pts.length];
      const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
      const u = L2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2)) : 0;
      const d = Math.hypot(a.x + dx * u - x, a.z + dz * u - z);
      if (d < bd) { bd = d; best = p.cum[k] + p.seg[k] * u; }
    }
    return best;
  }

  private newPed(path: number, s: number, x = 0, z = 0, y = SIDEWALK_H, yaw = 0): Ped {
    const r = this.rng;
    const kid = r() < 0.07;
    const base = range(r, 1.05, 1.5);
    const ped: Ped = {
      path, s, speed: base, base, pause: 0, faceYaw: yaw, hurry: false, react: 0, cool: 0, aside: 0, asideT: 0, jx: 0, jz: 0,
      phase: r() * 6.28, x, z, y, yaw, scale: kid ? range(r, 0.62, 0.72) : range(r, 0.92, 1.08),
      shirt: new THREE.Color(pick(r, SHIRTS)), pants: new THREE.Color(pick(r, PANTS)), look: Math.floor(r() * 4) + 4 * Math.floor(r() * 4), seg: -1, rx: x, rz: z,
      outfit: 0, acc: 0, pose: 0, accent: 0,
    };
    // round 27: outfit, hair style, accessories (own stream)
    const L = this.lookRng;
    const o = L();
    ped.outfit = o < 0.34 ? 0 : o < 0.52 ? 1 : o < 0.7 ? 2 : o < 0.9 ? 3 : 4;
    const hs = ped.outfit === 2 ? (L() < 0.55 ? 1 : 2) : L() < 0.6 ? 0 : L() < 0.5 ? 1 : L() < 0.5 ? 2 : 3;
    ped.look += 16 * hs;
    ped.acc = (L() < 0.18 ? 1 : 0) + (L() < 0.2 ? 2 : 0);
    if (!(ped.acc & 2) && L() < 0.15) ped.acc += 4;
    ped.accent = Math.floor(L() * 8);
    if (path >= 0 && L() < 0.1) { ped.pose = 1; ped.base *= 0.85; ped.speed = ped.base; }
    return ped;
  }

  private build(): void {
    const { roadCenters, blockSize: B, roadWidth: R, half } = this.layout;
    const blocks = roadCenters.length - 1;
    const parks = this.layout.sites.filter((s) => s.kind === 'park').map((s) => ({ x: s.pos.x - 7.5, z: s.pos.z }));
    const r = this.rng;
    for (let bi = 0; bi < blocks; bi++) for (let bj = 0; bj < blocks; bj++) {
      const x0 = -half + R + bi * (B + R), z0 = -half + R + bj * (B + R), x1 = x0 + B, z1 = z0 + B;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const down = 1 - Math.min(1, Math.hypot(cx, cz) / half / 1.05);
      const isPark = parks.some((p) => Math.abs(p.x - cx) < 1 && Math.abs(p.z - cz) < 1);
      const nearPark = parks.some((p) => Math.abs(p.x - cx) < B + R + 1 && Math.abs(p.z - cz) < B + R + 1);
      // two sidewalk loops: outer (1.75 m in from the curb) clockwise, inner (2.35 m) the other way
      const ring = (d: number, rev: boolean) => {
        const pts = [{ x: x0 + d, z: z0 + d }, { x: x1 - d, z: z0 + d }, { x: x1 - d, z: z1 - d }, { x: x0 + d, z: z1 - d }];
        return rev ? pts.reverse() : pts;
      };
      const outer = this.addPath(ring(1.75, false), SIDEWALK_H, 'ring', -0.15, 0.6);
      const inner = this.addPath(ring(2.35, true), SIDEWALK_H, 'ring', -0.5, 0.2);
      if (outer >= 0 && inner >= 0) {
        this.paths[outer].twin = inner; this.paths[outer].shift = 0.6;
        this.paths[inner].twin = outer; this.paths[inner].shift = -0.6;
      } else {
        if (outer >= 0) { this.paths[outer].twin = outer; this.paths[outer].shift = 0; }
        if (inner >= 0) { this.paths[inner].twin = inner; this.paths[inner].shift = 0; }
      }
      const count = 9 + Math.round(9 * down) + (nearPark || isPark ? 6 : 0);
      for (const [pi, n] of [[outer, Math.ceil(count / 2)], [inner, Math.floor(count / 2)]] as const) {
        if (pi < 0) continue;
        const p = this.paths[pi];
        for (let k = 0; k < n; k++) {
          const ped = this.newPed(pi, (k + r() * 0.6) * (p.L / n));
          p.peds.push(this.peds.length);
          this.peds.push(ped);
        }
      }
      if (isPark) {
        // out-and-back walks along the four park paths, from the sidewalk to the fountain rim (thin loops 1.2 m wide)
        const inn = 3.6, rim = 5.2;
        const spokes: Array<Array<{ x: number; z: number }>> = [
          [{ x: cx - 0.6, z: z0 + inn }, { x: cx - 0.6, z: cz - rim }, { x: cx + 0.6, z: cz - rim }, { x: cx + 0.6, z: z0 + inn }],
          [{ x: cx + 0.6, z: z1 - inn }, { x: cx + 0.6, z: cz + rim }, { x: cx - 0.6, z: cz + rim }, { x: cx - 0.6, z: z1 - inn }],
          [{ x: x0 + inn, z: cz + 0.6 }, { x: cx - rim, z: cz + 0.6 }, { x: cx - rim, z: cz - 0.6 }, { x: x0 + inn, z: cz - 0.6 }],
          [{ x: x1 - inn, z: cz - 0.6 }, { x: cx + rim, z: cz - 0.6 }, { x: cx + rim, z: cz + 0.6 }, { x: x1 - inn, z: cz + 0.6 }],
        ];
        for (const sp of spokes) {
          const pi = this.addPath(sp, PATH_H, 'spoke', -0.2, 0.2);
          if (pi < 0) continue;
          this.paths[pi].twin = pi; this.paths[pi].shift = 1.2;
          for (let k = 0; k < 4; k++) {
            const ped = this.newPed(pi, (k + r() * 0.5) * (this.paths[pi].L / 4));
            this.paths[pi].peds.push(this.peds.length);
            this.peds.push(ped);
          }
        }
        // people standing round the fountain, on the paths, facing it
        for (let k = 0; k < 7; k++) {
          const a = r() * Math.PI * 2;
          const rr = range(r, 5.0, 5.6);
          const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
          if (Math.abs(x - cx) > 1.3 && Math.abs(z - cz) > 1.3) continue; // only on the paths (the quadrants are lawn and trees)
          if (this.blocked(x, z, 0.3) || this.nearPad(x, z, 1.0)) continue;
          this.peds.push(this.newPed(-1, 0, x, z, PATH_H, Math.atan2(cx - x, cz - z)));
        }
      }
    }
    // people at shop doors: beside the doorstep, close to the facade, facing out or toward the door
    for (const s of this.layout.sites) {
      if (s.kind !== 'doorstep') continue;
      const n = r() < 0.75 ? (r() < 0.4 ? 2 : 1) : 0;
      // the facade normal: the doorstep sits 1.5 m in front of the face, toward the nearest road
      const rx = roadCenters.reduce((a, b) => (Math.abs(b - s.pos.x) < Math.abs(a - s.pos.x) ? b : a));
      const rz = roadCenters.reduce((a, b) => (Math.abs(b - s.pos.z) < Math.abs(a - s.pos.z) ? b : a));
      const alongX = Math.abs(s.pos.z - rz) < Math.abs(s.pos.x - rx); // the face runs along x (road at z = rz)
      const ox = alongX ? 0 : Math.sign(rx - s.pos.x), oz = alongX ? Math.sign(rz - s.pos.z) : 0; // outward
      const first = this.peds.length;
      for (let k = 0; k < n; k++) {
        const side = r() < 0.5 ? -1 : 1;
        const along = range(r, 2.5, 3.6) * side;
        const back = range(r, 0.85, 1.05); // toward the facade from the doorstep centre
        const x = s.pos.x + (alongX ? along : 0) - ox * back;
        const z = s.pos.z + (alongX ? 0 : along) - oz * back;
        if (this.blocked(x, z, 0.3) || this.nearPad(x, z, 0.9)) continue;
        const yaw = r() < 0.5 ? Math.atan2(ox, oz) : Math.atan2(s.pos.x - x, s.pos.z - z);
        this.peds.push(this.newPed(-1, 0, x, z, SIDEWALK_H, yaw));
      }
      // round 27: a pair at a shop door stands together talking (the second steps over beside the first, both turn in);
      // someone alone often reads their phone
      const here = this.peds.slice(first);
      if (here.length === 2) {
        const [a, b] = here;
        const ux = alongX ? 1 : 0, uz = alongX ? 0 : 1;
        const sgn = Math.sign((a.x - s.pos.x) * ux + (a.z - s.pos.z) * uz) || 1;
        const bx = a.x + ux * sgn * 0.95, bz = a.z + uz * sgn * 0.95;
        if (!this.blocked(bx, bz, 0.3) && !this.nearPad(bx, bz, 0.9)) {
          b.x = bx; b.z = bz;
          a.faceYaw = a.yaw = Math.atan2(b.x - a.x, b.z - a.z) - 0.35 * sgn;
          b.faceYaw = b.yaw = Math.atan2(a.x - b.x, a.z - b.z) + 0.35 * sgn;
          a.pose = b.pose = 2;
          b.phase = a.phase + 2.2;
        }
      } else if (here.length === 1 && this.lookRng() < 0.5) here[0].pose = 1;
    }
    // round 27: people sitting on the park benches (one or two a bench), facing the path
    for (const b of benchSpots(this.layout)) {
      const n = this.lookRng() < 0.35 ? 2 : this.lookRng() < 0.55 ? 1 : 0;
      for (let k = 0; k < n; k++) {
        const off = n === 2 ? (k === 0 ? -0.42 : 0.42) : (this.lookRng() - 0.5) * 0.6;
        const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
        const x = b.x + (b.alongX ? off : 0) - fx * 0.02, z = b.z + (b.alongX ? 0 : off) - fz * 0.02;
        if (this.nearPad(x, z, 1.0)) continue;
        const ped = this.newPed(-1, 0, x, z, b.y, b.yaw);
        ped.pose = 3;
        ped.scale = Math.max(ped.scale, 0.92);
        ped.sit = true;
        this.peds.push(ped);
      }
    }
    for (const ped of this.peds) if (ped.path < 0) ped.phase = this.rng() * 100;
  }

  // ----------------------------------------------------------------------------------------------------------------
  // update
  // ----------------------------------------------------------------------------------------------------------------

  /** The pad of the current pickup or drop (radius 0: none). */
  setActivePad(x: number, z: number, r: number): void {
    const changed = x !== this.pad.x || z !== this.pad.z || r !== this.pad.r;
    this.pad.x = x; this.pad.z = z; this.pad.r = r;
    if (!changed || r <= 0) return;
    // round 23: nobody is ever on the live pad. Walkers already on it when it lights up step on along their loop to
    // just past it (this happens far from the drone: the next pad lights up when the last one is done).
    for (const w of this.peds) {
      if (w.path < 0) continue;
      const p = this.paths[w.path];
      let a = this.at(p, w.s);
      if (!this.inPad(a.x, a.z, 0.9)) continue;
      for (let k = 0; k < 80 && this.inPad(a.x, a.z, 0.9); k++) { w.s = (w.s + 0.25) % p.L; a = this.at(p, w.s); }
      w.pause = 0;
    }
  }

  private inPad(x: number, z: number, m: number): boolean {
    return this.pad.r > 0 && Math.hypot(x - this.pad.x, z - this.pad.z) < this.pad.r + m;
  }

  /** Round 29: the camera's view volume (Environment keeps it current); null draws everyone in range. */
  frustum: THREE.Frustum | null = null;
  private readonly sph = new THREE.Sphere();
  private readonly sv = new THREE.Vector3();

  update(dt: number, cam: THREE.Vector3, drone: THREE.Vector3, dvx: number, dvz: number): void {
    const R = this.R;
    const dspeed = Math.hypot(dvx, dvz);
    const lowFast = drone.y < 7.5 && dspeed > 8;
    dt = Math.min(dt, 0.1);
    // walkers, a path at a time (a path far from the camera is frozen)
    for (const p of this.paths) {
      p.near = Math.hypot(p.cx - cam.x, p.cz - cam.z) < R + p.rad + 4;
      if (!p.near || dt <= 0) continue;
      const list = p.peds;
      list.sort((a, b) => this.peds[a].s - this.peds[b].s);
      const turnBack: Ped[] = [];
      for (let k = 0; k < list.length; k++) {
        const w = this.peds[list[k]];
        const ahead = list.length > 1 ? this.peds[list[(k + 1) % list.length]] : null;
        const pos = this.at(p, w.s);
        const inside = this.inPad(pos.x, pos.z, 0.6);
        w.hurry = inside;
        // turn back from the active pad
        if (!inside && this.pad.r > 0) {
          const la = this.at(p, w.s + 1.3);
          if (this.inPad(la.x, la.z, 0.6)) {
            if (p.twin === this.paths.indexOf(p) && p.shift === 0) { w.pause = Math.max(w.pause, 0.5); w.faceYaw = Math.atan2(la.tx, la.tz); }
            else { turnBack.push(w); continue; }
          }
        }
        let want = w.base;
        if (w.pause > 0) { w.pause -= dt; want = 0; if (inside) w.pause = 0; }
        if (w.react > 0) want = 0;
        if (inside) want = 2.6;
        else if (ahead && ahead !== w) {
          const gap = (((ahead.s - w.s) % p.L) + p.L) % p.L;
          if (gap < 0.75) want = 0;
          else if (gap < 1.4) want = Math.min(want, ahead.speed);
        }
        w.speed += (want - w.speed) * Math.min(1, dt * 5);
        if (w.speed < 0.02 && want === 0) w.speed = 0;
        w.s = (w.s + w.speed * dt) % p.L;
        const np = this.at(p, w.s);
        // corners: sometimes wait (to cross, or at the fountain)
        if (w.seg !== np.k) {
          if (w.seg >= 0 && !inside && this.rng() < (p.kind === 'ring' ? 0.3 : 0.45)) {
            w.pause = range(this.rng, 1.5, 5.5);
            w.faceYaw = p.kind === 'ring' ? Math.atan2(np.x - p.cx, np.z - p.cz) : Math.atan2(p.pts[1].x - p.pts[0].x, p.pts[1].z - p.pts[0].z);
            if (this.inPad(np.x, np.z, 1.0)) w.pause = 0;
          }
          w.seg = np.k;
        }
        w.phase += w.speed * dt * (Math.PI / 0.68);
      }
      for (const w of turnBack) this.reverse(w, p);
    }
    // pose, reactions and the instance buffers
    let k = 0, kf = 0, kfb = 0;
    const farCap = this.far.instanceMatrix.count;
    const fanim = this.fanim.array as Float32Array;
    const fpants = this.fpants.array as Float32Array;
    this.reacting = 0;
    this.onPad = 0;
    const anim = this.ianim.array as Float32Array;
    const pants = this.ipants.array as Float32Array;
    const extra = this.iextra.array as Float32Array;
    const fextra = this.fextra.array as Float32Array;
    this.sitting = this.phones = this.talking = 0;
    for (const w of this.peds) {
      const p = w.path >= 0 ? this.paths[w.path] : null;
      if (p && !p.near) continue;
      let x = w.x, z = w.z, inx = 0, inz = 0;
      if (p) {
        const a = this.at(p, w.s);
        // inward normal (toward the loop centre)
        inx = -a.tz; inz = a.tx;
        if ((p.cx - a.x) * inx + (p.cz - a.z) * inz < 0) { inx = -inx; inz = -inz; }
        x = a.x; z = a.z;
      } else {
        inx = Math.sin(w.faceYaw); inz = Math.cos(w.faceYaw); inx = -inx; inz = -inz; // step back from what they face
      }
      const d = Math.hypot(x - cam.x, z - cam.z);
      if (d > R) continue;
      // reaction to a low, fast drone pass
      w.cool = Math.max(0, w.cool - dt);
      if (w.react > 0) w.react = Math.max(0, w.react - dt);
      const hx = x - drone.x, hz = z - drone.z;
      if (lowFast && w.react <= 0 && w.cool <= 0 && hx * hx + hz * hz < 36) {
        w.react = 1.4;
        w.cool = 2.5;
        this.reactions++;
        const away = Math.sign(hx * inx + hz * inz) || 1;
        w.asideT = away * 0.55;
      }
      if (w.react > 0) this.reacting++;
      const rc = w.react > 0 ? Math.min(1, (1.4 - w.react) * 7) * Math.min(1, w.react * 2.2) : 0;
      const target = w.react > 0 ? w.asideT : 0;
      w.aside += (target - w.aside) * Math.min(1, dt * (w.react > 0 ? 6 : 1.2));
      const lo = p ? p.asideMin : w.sit ? 0 : -0.4, hi = p ? p.asideMax : w.sit ? 0 : 0.4;
      const as = Math.max(lo, Math.min(hi, w.aside));
      w.jx *= Math.max(0, 1 - dt * 4); w.jz *= Math.max(0, 1 - dt * 4);
      x += inx * as + w.jx; z += inz * as + w.jz;
      // heading: along the path (smoothed round corners), or the standing direction
      let yaw = w.faceYaw;
      if (p && w.pause <= 0) {
        const f = this.at(p, w.s + 0.45), b = this.at(p, w.s - 0.45);
        yaw = Math.atan2(f.x - b.x, f.z - b.z);
      }
      let dy = yaw - w.yaw;
      while (dy > Math.PI) dy -= 2 * Math.PI;
      while (dy < -Math.PI) dy += 2 * Math.PI;
      w.yaw += dy * Math.min(1, dt * 8);
      // round 23: never drawn on the live pad (a sidestep or a nudge cannot carry anyone onto it)
      if (this.inPad(x, z, 0.15)) { x -= inx * as + w.jx; z -= inz * as + w.jz; w.aside = 0; w.jx = w.jz = 0; }
      w.rx = x; w.rz = z;
      w.hid = this.inPad(x, z, 0.15);
      if (w.hid) { this.padHidden++; continue; }
      if (this.inPad(x, z, 0)) this.onPad++;
      // round 29: beyond PEOPLE_FULL m only people in (or just outside) the camera's view are drawn (both versions were
      // drawn all round the camera: 200k triangles by a busy park). The margin covers a camera a frame ahead of the test.
      // Everything above (reactions, the pad rule, the positions the probes read) still runs for everyone in range.
      if (d > PEOPLE_FULL && this.frustum && !this.frustum.intersectsSphere(this.sph.set(this.sv.set(x, (p ? p.y : w.y) + 0.9, z), 1.2 + PEOPLE_MARGIN + d * 0.04))) continue;
      const fade = Math.min(1, (R - d) / 10);
      const s = w.scale * fade;
      this.q.setFromAxisAngle(this.up, w.yaw);
      this.m.compose(this.v.set(x, p ? p.y : w.y, z), this.q, this.sc.set(s, s, s));
      // round 23: past LOD_NEAR the low-detail figure (no shoes, hands, neck, hips or back hair)
      const isFar = d > LOD_NEAR;
      const mesh = isFar ? this.far : this.near;
      // round 33: far people with a shadow fill the far mesh from the front, the others from the back (moved up after)
      const j = !isFar ? k++ : d <= FAR_SHADOW ? kf++ : farCap - 1 - kfb++;
      const A = isFar ? fanim : anim, PA = isFar ? fpants : pants, EX = isFar ? fextra : extra;
      EX[j * 4] = w.outfit; EX[j * 4 + 1] = w.acc; EX[j * 4 + 2] = w.pose; EX[j * 4 + 3] = w.accent;
      if (w.pose === 3) this.sitting++; else if (w.pose === 1) this.phones++; else if (w.pose === 2) this.talking++;
      mesh.setMatrixAt(j, this.m);
      mesh.setColorAt(j, w.shirt);
      const walk = p ? Math.min(1, w.speed / 1.1) : 0;
      // standing people idle: a slow weight shift
      const ph = p || w.pose === 2 ? w.phase : 0; // round 27: talkers gesture on their own clock
      if (!p) w.phase += dt;
      A[j * 4] = ph; A[j * 4 + 1] = p ? walk : 0.06 * Math.sin(w.phase * 0.7); A[j * 4 + 2] = rc; A[j * 4 + 3] = w.look;
      PA[j * 3] = w.pants.r; PA[j * 3 + 1] = w.pants.g; PA[j * 3 + 2] = w.pants.b;
    }
    // round 33: close the gap between the far people with a shadow (front) and those without (back)
    if (kfb) {
      const from = farCap - kfb;
      for (const [arr, w] of [[this.far.instanceMatrix.array, 16], [this.far.instanceColor!.array, 3], [fanim, 4], [fpants, 3], [fextra, 4]] as const) {
        (arr as Float32Array).copyWithin(kf * w, from * w, farCap * w);
      }
    }
    this.far.userData.shadowCount = kf;
    kf += kfb;
    this.drawn = k + kf;
    this.drawnFar = kf;
    for (const [mesh, cnt, an, pa, ex] of [[this.near, k, this.ianim, this.ipants, this.iextra], [this.far, kf, this.fanim, this.fpants, this.fextra]] as const) {
      mesh.count = cnt;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor!.needsUpdate = true;
      an.needsUpdate = true;
      pa.needsUpdate = true;
      ex.needsUpdate = true;
    }
    this.ianim.needsUpdate = true;
    this.ipants.needsUpdate = true;
  }

  /** Turn round: hop to the twin loop (the other side of the sidewalk, or of the park path) at the same spot. */
  private reverse(w: Ped, p: Path): void {
    const a = this.at(p, w.s);
    let inx = -a.tz, inz = a.tx;
    if ((p.cx - a.x) * inx + (p.cz - a.z) * inz < 0) { inx = -inx; inz = -inz; }
    const tx = a.x + inx * p.shift, tz = a.z + inz * p.shift;
    const twin = this.paths[p.twin];
    const idx = this.peds.indexOf(w);
    if (twin !== p) {
      p.peds.splice(p.peds.indexOf(idx), 1);
      twin.peds.push(idx);
      w.path = p.twin;
    }
    w.s = this.project(twin, tx, tz) + 0.3;
    const b = this.at(twin, w.s);
    w.jx += a.x - b.x; w.jz += a.z - b.z;
    w.pause = 0;
    w.seg = b.k;
  }

  /** Test hook: everyone near the camera (x, z, kind, reaction). */
  snapshot(): Array<{ x: number; z: number; y: number; walking: boolean; react: number; path: number; hidden: boolean }> {
    const out: Array<{ x: number; z: number; y: number; walking: boolean; react: number; path: number; hidden: boolean }> = [];
    for (const w of this.peds) {
      const p = w.path >= 0 ? this.paths[w.path] : null;
      let x = w.rx, z = w.rz;
      if (p && !p.near) { const a = this.at(p, w.s); x = a.x; z = a.z; }
      out.push({ x, z, y: p ? p.y : w.y, walking: !!p, react: w.react, path: w.path, hidden: !!w.hid && (!p || p.near) });
    }
    return out;
  }
}
