import * as THREE from 'three';
import type { ModelParts } from './StreetAssets';
import { MAX_PIERS, MAX_WAKES, SHORE, WATER_Y, type Water, shoreDistance, waveFade, waveHeight } from './Water';

/**
 * Round 31: boats round the island (CC0 Quaternius models from Poly Pizza, see ASSETS.md), loaded with the street
 * assets after the first frame. Moving boats sail on lanes: rounded squares at a fixed distance from the seawall, one
 * speed and one direction per lane, so no boat can meet another, the shore or the marina. A small marina (two CC0 docks)
 * on the south wall holds the moored boats. Every boat rides the water's own swell (Water.waveHeight with the same
 * distance fade), pitches and rolls with it, and the moving ones feed their wakes to the water shader.
 * Boats are scenery: no colliders, like the hover-vans; nothing here is near a delivery pad (they are all on the island).
 */

type Kind = 'sail' | 'rib' | 'ferry' | 'row';
/** Model name in boats.glb, hull length / beam (m), how deep the keel sits below the waterline, sailboat heel. */
const KIND: Record<Kind, { model: string; len: number; beam: number; draft: number; heel: number }> = {
  sail: { model: 'boat_sail', len: 7.0, beam: 2.85, draft: 0.42, heel: 0.13 },
  rib: { model: 'boat_rib', len: 5.2, beam: 3.0, draft: 0.34, heel: 0 },
  ferry: { model: 'boat_ferry', len: 20.0, beam: 4.4, draft: 1.25, heel: 0 },
  row: { model: 'boat_row', len: 4.6, beam: 2.38, draft: 0.32, heel: 0 },
};
const KINDS: Kind[] = ['sail', 'rib', 'ferry', 'row'];

/** Lanes: distance from the seawall (m), direction (+1 / -1), speed (m/s), and the boats on it (kind, start fraction). */
const LANES: Array<{ d: number; dir: number; speed: number; boats: Array<[Kind, number]> }> = [
  { d: 30, dir: 1, speed: 2.8, boats: [['sail', 0.0], ['sail', 0.5]] },
  { d: 52, dir: -1, speed: 8.5, boats: [['rib', 0.15], ['rib', 0.62]] },
  { d: 78, dir: 1, speed: 4.4, boats: [['ferry', 0.3]] },
  { d: 104, dir: -1, speed: 3.2, boats: [['sail', 0.82]] },
];

/** Marina on the south wall (z = +SHORE): two docks, each two 8 m CC0 dock pieces long. */
const PIER_X = [-52, -36];
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
};

export class Boats {
  readonly group = new THREE.Group();
  readonly boats: Boat[] = [];
  private readonly meshes = new Map<Kind, THREE.InstancedMesh>();
  private readonly tmp = { x: 0, z: 0, tx: 0, tz: 0 };
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly p = new THREE.Vector3();
  private readonly one = new THREE.Vector3(1, 1, 1);

  constructor(parts: ModelParts, private readonly water: Water, seed: number) {
    this.group.name = 'boats';
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.04 });
    const count = new Map<Kind, number>();
    for (const l of LANES) for (const [k] of l.boats) count.set(k, (count.get(k) ?? 0) + 1);
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
    LANES.forEach((l, li) => {
      const P = laneLength(l.d);
      for (const [k, f] of l.boats) {
        const mesh = this.meshes.get(k);
        if (!mesh) continue;
        this.boats.push({ kind: k, lane: li, s: ((f + off * (li + 1)) % 1) * P, speed: l.speed, dir: l.dir, x: 0, z: 0, yaw: 0, y: 0, pitch: 0, roll: 0, water: 0, heave: 0, moving: true, mesh, index: take(k) });
      }
    });
    for (const [k, x, z, yaw] of MOORED) {
      const mesh = this.meshes.get(k);
      if (!mesh) continue;
      this.boats.push({ kind: k, lane: -1, s: 0, speed: 0, dir: 0, x, z, yaw, y: 0, pitch: 0, roll: 0, water: 0, heave: 0, moving: false, mesh, index: take(k) });
    }
    // marina docks
    const dock = parts.get('pier')?.get('all');
    if (dock) {
      const n = PIER_X.length * 2;
      const im = new THREE.InstancedMesh(dock, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), n);
      let i = 0;
      for (const px of PIER_X) for (let seg = 0; seg < 2; seg++) {
        this.p.set(px, PIER_TOP - DOCK_TOP_IN_MODEL, SHORE + 4 + seg * 8);
        this.m.compose(this.p, this.q.identity(), this.one);
        im.setMatrixAt(i++, this.m);
      }
      im.castShadow = true;
      im.receiveShadow = true;
      im.name = 'boats-docks';
      this.group.add(im);
      PIER_X.forEach((px, k) => { if (k < MAX_PIERS) water.piers[k].set(px, SHORE + PIER_LEN / 2, PIER_HALF_W, PIER_LEN / 2); });
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
        b.s += b.speed * b.dir * dt;
        lanePoint(LANES[b.lane].d, b.s, this.tmp);
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
      this.m.compose(this.p, this.q, this.one);
      b.mesh.setMatrixAt(b.index, this.m);
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
      docks: PIER_X.map((px) => ({ x: px, z: SHORE + PIER_LEN / 2, hx: PIER_HALF_W, hz: PIER_LEN / 2 })),
    };
  }
}
