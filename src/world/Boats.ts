import * as THREE from 'three';
import type { DynBox } from '../systems/CollisionWorld';
import type { ModelParts } from './StreetAssets';
import { MAX_PIERS, MAX_WAKES, SHORE, WATER_Y, type Water, shoreDistance, waveFade, waveHeight } from './Water';

/**
 * Round 31: boats round the island (CC0 Quaternius models from Poly Pizza, see ASSETS.md), loaded with the street
 * assets after the first frame. Moving boats sail on lanes: rounded squares at a fixed distance from the seawall, one
 * speed and one direction per lane, so no boat can meet another, the shore or the marina. A small marina (two CC0 docks)
 * on the south wall holds the moored boats. Every boat rides the water's own swell (Water.waveHeight with the same
 * distance fade), pitches and rolls with it, and the moving ones feed their wakes to the water shader.
 * Round 32: hulls, masts and the docks have colliders (see PARTS), fed to the CollisionWorld as turning boxes.
 * Nothing here is near a delivery pad (those are all on the island).
 */

type Kind = 'sail' | 'rib' | 'ferry' | 'row';
/** Model name in boats.glb, hull length / beam (m), how deep the keel sits below the waterline, sailboat heel. */
const KIND: Record<Kind, { model: string; len: number; beam: number; draft: number; heel: number; scale: number }> = {
  sail: { model: 'boat_sail', len: 7.0, beam: 2.85, draft: 0.42, heel: 0.13, scale: 1 },
  rib: { model: 'boat_rib', len: 5.2, beam: 3.0, draft: 0.34, heel: 0, scale: 1 },
  // round 32: the CC0 cruise-ship model shrunk to a 14.4 m harbour bus (it read as a toy liner at 20 m)
  ferry: { model: 'boat_ferry', len: 14.4, beam: 3.17, draft: 0.9, heel: 0, scale: 0.72 },
  row: { model: 'boat_row', len: 4.6, beam: 2.38, draft: 0.32, heel: 0, scale: 1 },
};
const KINDS: Kind[] = ['sail', 'rib', 'ferry', 'row'];

/**
 * Round 32: collider parts per kind in model space (keel at y 0, bow on +z), measured from boats.glb:
 * centre x, y, z, half sizes x, y, z, soft. Hulls are solid (a hit at speed is a wall hit under the crash rules);
 * the sailboat's mast and sail are one thin soft column (grazing it is a scrape, like a lamp post).
 */
const PARTS: Record<Kind, Array<[number, number, number, number, number, number, boolean]>> = {
  sail: [[0, 0.72, 0, 1.38, 0.73, 3.4, false], [0, 3.75, 0.12, 0.14, 2.3, 1.95, true]],
  rib: [[0, 0.49, 0, 1.45, 0.49, 2.55, false]],
  row: [[0, 0.46, 0, 1.15, 0.46, 2.22, false]],
  ferry: [[0, 1.5, 0, 2.2, 1.5, 9.8, false], [0, 4.5, -1.4, 2.0, 1.5, 6.6, false], [0, 6.65, 0.6, 0.5, 0.65, 3.2, false]],
};
/** Hull boxes reach this far below their centre-minus-half-height, so nothing can pass under a hull. */
const HULL_SKIRT = 1.5;

/**
 * Lanes: distance from the seawall (m), direction (+1 / -1), base speed (m/s), gust (speed swing, the same for every
 * boat on a lane so their spacing holds), jitter (the lane moves by up to this much per city, so loops differ), and
 * the boats on it (kind, start fraction).
 * Round 32: the ferry is now a harbour bus on its own inner lane (SHUTTLE) that stops at two piers; the lone sailboat
 * sails a tighter loop; sailboats speed up and slow down with the gusts.
 */
const LANES: Array<{ d: number; dir: number; speed: number; gust: number; jitter: number; boats: Array<[Kind, number]> }> = [
  { d: 31, dir: 1, speed: 2.8, gust: 0.3, jitter: 2.5, boats: [['sail', 0.0], ['sail', 0.5]] },
  { d: 52, dir: -1, speed: 8.5, gust: 0.06, jitter: 3, boats: [['rib', 0.15], ['rib', 0.62]] },
  { d: 74, dir: 1, speed: 2.3, gust: 0.35, jitter: 6, boats: [['sail', 0.82]] },
];
/** Round 32: the harbour bus. Its lane runs inside the sailboats, just past the pier heads; it stops at each pier. */
const SHUTTLE = { d: 19, dir: -1, speed: 4.6, accel: 0.42, dwell: 9, kind: 'ferry' as Kind };

/** Marina on the south wall (z = +SHORE): two docks, each two 8 m CC0 dock pieces long. */
/** Round 32: piers as (x, side): side +1 = the south wall (the marina), -1 = the north wall (the harbour-bus landing). */
const PIERS: Array<[number, number]> = [[-52, 1], [-36, 1], [40, -1]];
/** Harbour-bus stops: the pier head it lies alongside (x on the south / north lane side). */
const STOPS: Array<[number, number]> = [[-36, 1], [40, -1]];
const PIER_LEN = 16;
const PIER_HALF_W = 1.72;
const PIER_TOP = 0.15;
const DOCK_TOP_IN_MODEL = 0.73;
/** Moored boats: kind, x, z, heading (bow towards the wall is PI). */
const MOORED: Array<[Kind, number, number, number]> = [
  ['sail', -46.6, 172.5, Math.PI],
  ['row', -40.6, 169.8, Math.PI],
  ['rib', -57.2, 172.0, Math.PI],
  ['row', -31.2, 170.4, Math.PI + 0.05],
];

/** A point and unit tangent on the lane at distance d from the wall, at arc length s (counter-clockwise from the east side). */
function lanePoint(d: number, s: number, out: { x: number; z: number; tx: number; tz: number }): void {
  const side = SHORE * 2, arc = (Math.PI * d) / 2;
  const P = 4 * (side + arc);
  s = ((s % P) + P) % P;
  // east, SE corner, south, SW corner, west, NW corner, north, NE corner
  const seg = Math.floor(s / (side + arc));
  const t = s - seg * (side + arc);
  // rotate the east-side frame by seg * 90 degrees
  const a = (seg * Math.PI) / 2;
  const c = Math.cos(a), sn = Math.sin(a);
  let lx: number, lz: number, ltx: number, ltz: number;
  if (t < side) {
    lx = SHORE + d; lz = -SHORE + t; ltx = 0; ltz = 1;
  } else {
    const ang = (t - side) / d;
    lx = SHORE + Math.cos(ang) * d; lz = SHORE + Math.sin(ang) * d;
    ltx = -Math.sin(ang); ltz = Math.cos(ang);
  }
  // rotation by a in the x-z plane (x -> z): east (+x) side goes to south (+z), then west, then north
  out.x = lx * c - lz * sn;
  out.z = lx * sn + lz * c;
  out.tx = ltx * c - ltz * sn;
  out.tz = ltx * sn + ltz * c;
}
export function laneLength(d: number): number {
  return 4 * (SHORE * 2 + (Math.PI * d) / 2);
}

type Boat = {
  kind: Kind; lane: number; s: number; speed: number; dir: number;
  x: number; z: number; yaw: number; y: number; pitch: number; roll: number; water: number; heave: number;
  moving: boolean; mesh: THREE.InstancedMesh; index: number;
  /** Round 32: this boat's collider boxes (shared with the CollisionWorld). */
  cols: DynBox[];
  /** Round 32: lane distance from the wall for this city, and the harbour-bus state (next stop, seconds left at a stop). */
  d: number; shuttle: boolean; next: number; wait: number;
};

export class Boats {
  readonly group = new THREE.Group();
  readonly boats: Boat[] = [];
  /** Round 32: every boat's hull / mast boxes plus the docks, updated each frame; Game hands them to the CollisionWorld. */
  readonly colliders: DynBox[] = [];
  private readonly lp = new THREE.Vector3();
  private readonly meshes = new Map<Kind, THREE.InstancedMesh>();
  private readonly tmp = { x: 0, z: 0, tx: 0, tz: 0 };
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly p = new THREE.Vector3();
  private readonly one = new THREE.Vector3(1, 1, 1);
  private readonly sc = new THREE.Vector3(1, 1, 1);
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor(parts: ModelParts, private readonly water: Water, seed: number) {
    this.group.name = 'boats';
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.04 });
    const count = new Map<Kind, number>();
    for (const l of LANES) for (const [k] of l.boats) count.set(k, (count.get(k) ?? 0) + 1);
    count.set(SHUTTLE.kind, (count.get(SHUTTLE.kind) ?? 0) + 1);
    for (const [k] of MOORED) count.set(k, (count.get(k) ?? 0) + 1);
    for (const k of KINDS) {
      const g = parts.get(KIND[k].model)?.get('all');
      if (!g || !count.get(k)) continue;
      const im = new THREE.InstancedMesh(g, mat, count.get(k)!);
      im.castShadow = true;
      im.receiveShadow = true;
      im.frustumCulled = false;
      im.name = `boats-${k}`;
      this.meshes.set(k, im);
      this.group.add(im);
    }
    const used = new Map<Kind, number>();
    const take = (k: Kind) => { const i = used.get(k) ?? 0; used.set(k, i + 1); return i; };
    // a per-city start offset on each lane (the same for every boat on a lane, so their spacing holds)
    const off = ((seed * 0.6180339887) % 1 + 1) % 1;
    const hash = (n: number) => { const v = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453; return v - Math.floor(v); };
    LANES.forEach((l, li) => {
      const d = l.d + (hash(li + 1) * 2 - 1) * l.jitter;
      const P = laneLength(d);
      for (const [k, f] of l.boats) {
        const mesh = this.meshes.get(k);
        if (!mesh) continue;
        this.boats.push({ kind: k, lane: li, s: ((f + off * (li + 1)) % 1) * P, speed: l.speed, dir: l.dir, x: 0, z: 0, yaw: 0, y: 0, pitch: 0, roll: 0, water: 0, heave: 0, moving: true, mesh, index: take(k), cols: this.makeCols(k), d, shuttle: false, next: 0, wait: 0 });
      }
    });
    // the harbour bus: starts under way, a per-city share of the way from one stop to the next
    {
      const mesh = this.meshes.get(SHUTTLE.kind);
      if (mesh) {
        const from = Math.floor(hash(9) * STOPS.length) % STOPS.length, to = (from + 1) % STOPS.length;
        const P = laneLength(SHUTTLE.d), a = this.stopS(from), gap = ((((this.stopS(to) - a) * SHUTTLE.dir) % P) + P) % P;
        const s0 = a + SHUTTLE.dir * gap * (0.15 + 0.4 * hash(10));
        this.boats.push({ kind: SHUTTLE.kind, lane: LANES.length, s: s0, speed: SHUTTLE.speed, dir: SHUTTLE.dir, x: 0, z: 0, yaw: 0, y: 0, pitch: 0, roll: 0, water: 0, heave: 0, moving: true, mesh, index: take(SHUTTLE.kind), cols: this.makeCols(SHUTTLE.kind), d: SHUTTLE.d, shuttle: true, next: to, wait: 0 });
      }
    }
    for (const [k, x, z, yaw] of MOORED) {
      const mesh = this.meshes.get(k);
      if (!mesh) continue;
      this.boats.push({ kind: k, lane: -1, s: 0, speed: 0, dir: 0, x, z, yaw, y: 0, pitch: 0, roll: 0, water: 0, heave: 0, moving: false, mesh, index: take(k), cols: this.makeCols(k), d: 0, shuttle: false, next: 0, wait: 0 });
    }
    // marina docks
    const dock = parts.get('pier')?.get('all');
    if (dock) {
      const n = PIERS.length * 2;
      const im = new THREE.InstancedMesh(dock, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), n);
      let i = 0;
      for (const [px, side] of PIERS) for (let seg = 0; seg < 2; seg++) {
        this.p.set(px, PIER_TOP - DOCK_TOP_IN_MODEL, side * (SHORE + 4 + seg * 8));
        this.m.compose(this.p, this.q.setFromAxisAngle(this.up, side > 0 ? 0 : Math.PI), this.one);
        im.setMatrixAt(i++, this.m);
      }
      im.castShadow = true;
      im.receiveShadow = true;
      im.name = 'boats-docks';
      this.group.add(im);
      PIERS.forEach(([px, side], k) => { if (k < MAX_PIERS) water.piers[k].set(px, side * (SHORE + PIER_LEN / 2), PIER_HALF_W, PIER_LEN / 2); });
      // the docks are solid too (static, deck at PIER_TOP)
      for (const [px, side] of PIERS) this.colliders.push({ x: px, z: side * (SHORE + PIER_LEN / 2), s: 0, c: 1, hx: PIER_HALF_W, hz: PIER_LEN / 2, y0: -4, y1: PIER_TOP, soft: false, on: true, vx: 0, vz: 0 });
    }
  }

  /** Arc length on the harbour-bus lane where it lies alongside stop i. */
  private stopS(i: number): number {
    const [x, side] = STOPS[i];
    const seg = SHUTTLE.d, P = laneLength(seg), sideLen = SHORE * 2, arc = (Math.PI * seg) / 2;
    // south side is segment 1 (x = SHORE - t), north side is segment 3 (x = -SHORE + t), see lanePoint
    const s = side > 0 ? (sideLen + arc) + (SHORE - x) : 3 * (sideLen + arc) + (x + SHORE);
    return ((s % P) + P) % P;
  }

  /** Round 32: the harbour bus. Cruise, brake to a stop alongside the next pier head, wait, pull out again. */
  private stepShuttle(b: Boat, dt: number): void {
    if (b.wait > 0) {
      b.wait -= dt;
      b.speed = 0;
      if (b.wait <= 0) b.next = (b.next + 1) % STOPS.length;
      return;
    }
    const P = laneLength(b.d);
    const target = this.stopS(b.next);
    // distance still to sail to the stop, along the boat's own direction
    const left = ((((target - b.s) * b.dir) % P) + P) % P;
    const brake = Math.sqrt(2 * SHUTTLE.accel * Math.max(left - 0.05, 0));
    const want = Math.min(SHUTTLE.speed, brake);
    b.speed = want < b.speed ? want : Math.min(want, b.speed + SHUTTLE.accel * dt);
    const step = Math.min(b.speed * dt, left);
    b.s += step * b.dir;
    if (left - step < 0.02) {
      b.s = target;
      b.speed = 0;
      b.wait = SHUTTLE.dwell;
    }
  }

  private makeCols(k: Kind): DynBox[] {
    const cols = PARTS[k].map(([, , , hx, , hz, soft]) => ({ x: 0, z: 0, s: 0, c: 1, hx: hx * KIND[k].scale, hz: hz * KIND[k].scale, y0: 0, y1: 0, soft, on: true, vx: 0, vz: 0 }));
    this.colliders.push(...cols);
    return cols;
  }

  /** Round 32: place a boat's collider boxes from its instance matrix (pitch and roll move the box centres; the boxes
   * themselves only turn with the heading). */
  private placeCols(b: Boat): void {
    const parts = PARTS[b.kind];
    const sc = KIND[b.kind].scale;
    const s = Math.sin(b.yaw), c = Math.cos(b.yaw);
    for (let i = 0; i < parts.length; i++) {
      const [cx, cy, cz, , hy, , soft] = parts[i];
      this.lp.set(cx, cy, cz).applyMatrix4(this.m);
      const col = b.cols[i];
      col.x = this.lp.x; col.z = this.lp.z; col.s = s; col.c = c;
      // the mast leans with the heel and roll but the box only turns with the heading: widen the soft column by the
      // lean over its half height, so the drone is held clear of the mast at every height
      if (soft) col.hx = parts[i][3] * sc + Math.abs(Math.sin(b.roll)) * hy * sc;
      col.vx = b.moving ? s * b.speed : 0; col.vz = b.moving ? c * b.speed : 0;
      col.y1 = this.lp.y + hy * sc;
      col.y0 = this.lp.y - hy * sc - (soft ? 0 : HULL_SKIRT);
    }
  }

  /** Swell height under a point as drawn (the shader fades the swell with distance from the camera). */
  private surf(x: number, z: number, t: number, cam: THREE.Vector3): number {
    return waveHeight(x, z, t) * waveFade(Math.hypot(x - cam.x, z - cam.z));
  }

  update(dt: number, time: number, cam: THREE.Vector3): void {
    const w = this.water;
    let nw = 0;
    for (const b of this.boats) {
      const K = KIND[b.kind];
      if (b.moving) {
        if (b.shuttle) this.stepShuttle(b, dt);
        else {
          const l = LANES[b.lane];
          b.speed = l.speed * (1 + l.gust * Math.sin(time * 0.045 + b.lane * 2.1) * Math.sin(time * 0.017 + b.lane));
          b.s += b.speed * b.dir * dt;
        }
        lanePoint(b.d, b.s, this.tmp);
        b.x = this.tmp.x; b.z = this.tmp.z;
        b.yaw = Math.atan2(this.tmp.tx * b.dir, this.tmp.tz * b.dir);
      }
      const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw); // bow direction
      const px = Math.cos(b.yaw), pz = -Math.sin(b.yaw); // port (model +x)
      const hc = this.surf(b.x, b.z, time, cam);
      const hl = K.len * 0.4, hb = K.beam * 0.45;
      const hBow = this.surf(b.x + fx * hl, b.z + fz * hl, time, cam), hStern = this.surf(b.x - fx * hl, b.z - fz * hl, time, cam);
      const hPort = this.surf(b.x + px * hb, b.z + pz * hb, time, cam), hStb = this.surf(b.x - px * hb, b.z - pz * hb, time, cam);
      b.water = WATER_Y + hc;
      b.heave = hc;
      b.y = WATER_Y + hc - K.draft;
      b.pitch = Math.atan2(hBow - hStern, hl * 2) + (b.kind === 'rib' && b.moving ? 0.06 : 0);
      // sailboats heel away from the wind (towards the island side on their lane) and sway a little
      const heel = K.heel ? K.heel * b.dir + Math.sin(time * 0.7 + b.s * 0.01) * 0.025 : 0;
      b.roll = Math.atan2(hPort - hStb, hb * 2) + heel;
      // Euler YXZ: yaw, then pitch about the boat's x (negative x rotation lifts the bow), then roll about its z
      this.e.set(-b.pitch, b.yaw, b.roll);
      this.q.setFromEuler(this.e);
      this.p.set(b.x, b.y, b.z);
      this.m.compose(this.p, this.q, this.sc.setScalar(K.scale));
      b.mesh.setMatrixAt(b.index, this.m);
      this.placeCols(b);
      if (b.moving && nw < MAX_WAKES) {
        w.wakeA[nw].set(b.x, b.z, b.yaw, b.speed);
        w.wakeB[nw].set(K.len * 0.5, K.beam * 0.5, fx, fz);
        nw++;
      }
    }
    w.uniforms.uWakeN.value = nw;
    for (const m of this.meshes.values()) m.instanceMatrix.needsUpdate = true;
  }

  /** Test hook data: every boat's pose, its water height and the hull box. */
  snapshot(): Array<Record<string, number | string | boolean>> {
    return this.boats.map((b) => ({
      kind: b.kind, moving: b.moving, lane: b.lane, x: +b.x.toFixed(3), z: +b.z.toFixed(3), y: +b.y.toFixed(4),
      yaw: +b.yaw.toFixed(4), speed: b.speed, water: +b.water.toFixed(4), heave: +b.heave.toFixed(4),
      keel: +(b.y - b.water).toFixed(4), len: KIND[b.kind].len, beam: KIND[b.kind].beam,
      shore: +this.hullShore(b).toFixed(3),
    }));
  }

  /** Closest distance (m) from any hull corner to the seawall (negative = inside the island). */
  hullShore(b: Boat): number {
    const K = KIND[b.kind];
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), px = Math.cos(b.yaw), pz = -Math.sin(b.yaw);
    let min = Infinity;
    for (const a of [-1, 1]) for (const c of [-1, 1]) {
      const x = b.x + fx * a * K.len * 0.5 + px * c * K.beam * 0.5, z = b.z + fz * a * K.len * 0.5 + pz * c * K.beam * 0.5;
      min = Math.min(min, shoreDistance(x, z));
    }
    return min;
  }

  /** Hull rectangles (centre, half sizes, yaw) and the docks, for the overlap probe. */
  footprints(): { hulls: Array<{ x: number; z: number; hl: number; hb: number; yaw: number; kind: string; moving: boolean }>; docks: Array<{ x: number; z: number; hx: number; hz: number }> } {
    return {
      hulls: this.boats.map((b) => ({ x: b.x, z: b.z, hl: KIND[b.kind].len / 2, hb: KIND[b.kind].beam / 2, yaw: b.yaw, kind: b.kind, moving: b.moving })),
      docks: PIERS.map(([px, side]) => ({ x: px, z: side * (SHORE + PIER_LEN / 2), hx: PIER_HALF_W, hz: PIER_LEN / 2 })),
    };
  }
}
