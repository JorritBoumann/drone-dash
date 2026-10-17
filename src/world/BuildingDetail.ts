import * as THREE from 'three';
import { GeometryBuilder, Style, color } from './GeometryBuilder';
import type { CityLayout } from './CityGenerator';

/**
 * Round 27: the facade and rooftop detail kit. The merged city keeps its boxes (and every collider); this adds the parts
 * that make a box read as a building: window sills, balconies, fire escapes, AC units, drain pipes, office fins, shop
 * blade signs, corner quoins, rooftop vents, exhaust stacks, antennas and dishes. All of it is drawn only (no colliders),
 * stays within 0.6 m of a street face (the drone's radius is 0.95 m) and keeps clear of pads and alley blocks.
 *
 * Built into a 4 x 4 grid of merged chunks that share the city material (no new shader). A chunk is drawn only while the
 * camera is within `near` metres of it, so the cost follows the camera: full detail near the drone, the plain boxes
 * (with the shader's facade) far away.
 */

export type Archetype = 'townhouse' | 'walkup' | 'apartments' | 'classic' | 'office' | 'glass';
type Box3 = { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number };
export type BuildingSpec = {
  x0: number; z0: number; x1: number; z1: number; y0: number; top: number; floors: number; style: number; arch: Archetype;
  edges: { edgeW: boolean; edgeE: boolean; edgeN: boolean; edgeS: boolean };
  tier: boolean; gabled: boolean; padRoof: THREE.Vector3 | null;
  roof: { x0: number; z0: number; x1: number; z1: number; top: number } | null;
  wall: THREE.Color; trim: THREE.Color; vOffset: number; colliders: Box3[];
};

/** Deterministic 0..1 hash of a lot position (independent of the city's random stream). */
export function lotHash(x: number, z: number, k: number): number {
  let h = Math.imul(Math.round(x * 16) ^ 0x27d4eb2d, 0x85ebca6b) ^ Math.imul(Math.round(z * 16) + 0x165667b1, 0xc2b2ae35) ^ Math.imul(k + 1, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function hashRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FLOOR_H = 3.2;
/** Window half size (fraction of a bay and a storey) and centre height per facade style, as in the city shader. */
const WIN: Record<number, { hx: number; hy: number; cy: number }> = {
  0: { hx: 0.24, hy: 0.27, cy: 0.55 },
  1: { hx: 0.5, hy: 0.21, cy: 0.52 },
  2: { hx: 0.17, hy: 0.33, cy: 0.55 },
  3: { hx: 0.47, hy: 0.45, cy: 0.5 },
};
const METAL = color('#2b2f34');
const METAL_LT = color('#596069');
const AC = ['#c9cdd0', '#b8bcbf', '#d8d6cf', '#a9adb0'];
const SIGNS = ['#1f3d34', '#7a1f16', '#1d2a55', '#9a6a1a', '#26262a', '#2a9d8f', '#e76f51'];
const PLANTER = color('#a0573c');
const LEAF = ['#5e8c4a', '#6d9b4a', '#4c7a4f', '#86a94f', '#c8553d', '#e9c46a'];

/** Round 27: a park bench (seat centre on the lawn, yaw = the way a sitter faces, toward the path). */
export type Bench = { x: number; y: number; z: number; yaw: number; alongX: boolean };

/** Round 27: benches beside the four park paths, clear of the park pad, trees, lamps and the fountain. */
export function benchSpots(layout: CityLayout): Bench[] {
  const out: Bench[] = [];
  const lawn = 0.25 + 0.08;
  const hit = (x0: number, z0: number, x1: number, z1: number) => layout.colliders.some((b) => b.minY < 1.2 && b.maxX > x0 && b.minX < x1 && b.maxZ > z0 && b.minZ < z1);
  for (const s of layout.sites) {
    if (s.kind !== 'park') continue;
    const cx = s.pos.x - 7.5, cz = s.pos.z;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const t of [8.4, 11.4]) for (const side of [-1, 1]) {
      if (lotHash(cx + dx * t + side, cz + dz * t, 21) < 0.3) continue;
      const alongX = dx !== 0;
      const x = alongX ? cx + dx * t : cx + side * 2.15, z = alongX ? cz + side * 2.15 : cz + dz * t;
      if (Math.hypot(x - s.pos.x, z - s.pos.z) < s.radius + 2.2) continue;
      const hx = alongX ? 0.95 : 0.4, hz = alongX ? 0.4 : 0.95;
      if (hit(x - hx, z - hz, x + hx, z + hz)) continue;
      const yaw = alongX ? (side > 0 ? Math.PI : 0) : (side > 0 ? -Math.PI / 2 : Math.PI / 2);
      out.push({ x, y: lawn, z, yaw, alongX });
    }
  }
  return out;
}

type Face = { axis: 'x' | 'z'; at: number; out: number; a0: number; a1: number };

export class BuildingDetail {
  readonly group = new THREE.Group();
  private readonly chunks: Array<{ mesh: THREE.Mesh; minX: number; maxX: number; minZ: number; maxZ: number }> = [];
  triangles = 0;
  drawnChunks = 0;
  counts: Record<string, number> = {};

  constructor(layout: CityLayout, material: THREE.Material, seed: number, private readonly near = 120) {
    const N = 4;
    const half = layout.half;
    const cell = (half * 2) / N;
    const gbs = Array.from({ length: N * N }, () => new GeometryBuilder());
    const rng = hashRng(seed * 7919 + 17);
    const { blockSize: B, roadWidth: R } = layout;
    const alleyBlocks = new Set(layout.alleys.map((a) => `${a.bi},${a.bj}`));
    const blockOf = (x: number, z: number) => `${Math.floor((x + half - R) / (B + R))},${Math.floor((z + half - R) / (B + R))}`;
    const doorsteps = layout.sites.filter((s) => s.kind === 'doorstep').map((s) => s.pos);
    const roofPads = layout.sites.filter((s) => s.kind === 'rooftop').map((s) => s.pos);
    const bump = (k: string) => { this.counts[k] = (this.counts[k] ?? 0) + 1; };
    for (const b of layout.buildings) {
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      const ci = Math.min(N - 1, Math.max(0, Math.floor((cx + half) / cell)));
      const cj = Math.min(N - 1, Math.max(0, Math.floor((cz + half) / cell)));
      const gb = gbs[ci * N + cj];
      bump(b.arch);
      const inAlleyBlock = alleyBlocks.has(blockOf(cx, cz));
      this.facades(gb, b, rng, inAlleyBlock, doorsteps, bump);
      if (b.roof && !b.gabled) this.rooftop(gb, b, rng, roofPads, bump);
    }
    const wood = color('#9a6b45'), iron = color('#33373c');
    for (const b of benchSpots(layout)) {
      const ci = Math.min(N - 1, Math.max(0, Math.floor((b.x + half) / cell)));
      const cj = Math.min(N - 1, Math.max(0, Math.floor((b.z + half) / cell)));
      const gb = gbs[ci * N + cj];
      // seat (top 0.4 m above the lawn), backrest behind the sitter, two iron legs
      const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw); // facing
      const L = 0.8, D = 0.22;
      const bx = (a: number, f0: number, f1: number, y0: number, y1: number, c: THREE.Color) => {
        // a box from -a..a along the bench and f0..f1 along the facing direction
        const p0x = b.x + fx * f0, p0z = b.z + fz * f0, p1x = b.x + fx * f1, p1z = b.z + fz * f1;
        if (b.alongX) gb.box(b.x - a, b.y + y0, Math.min(p0z, p1z), b.x + a, b.y + y1, Math.max(p0z, p1z), c, Style.plain);
        else gb.box(Math.min(p0x, p1x), b.y + y0, b.z - a, Math.max(p0x, p1x), b.y + y1, b.z + a, c, Style.plain);
      };
      bx(L, -D, D, 0.34, 0.4, wood);
      bx(L, -D - 0.06, -D, 0.48, 0.82, wood);
      for (const s of [-1, 1]) {
        const off = s * (L - 0.12);
        const save = { x: b.x, z: b.z };
        if (b.alongX) b.x += off; else b.z += off;
        bx(0.04, -D, D, 0.0, 0.34, iron);
        bx(0.04, -D - 0.06, -D + 0.02, 0.0, 0.82, iron);
        b.x = save.x; b.z = save.z;
      }
      bump('bench');
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const gb = gbs[i * N + j];
      if (gb.vertexCount === 0) continue;
      const geo = gb.build();
      const mesh = new THREE.Mesh(geo, material);
      mesh.name = `building-detail-${i}-${j}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
      this.triangles += geo.getAttribute('position').count / 3;
      this.chunks.push({ mesh, minX: -half + i * cell - 4, maxX: -half + (i + 1) * cell + 4, minZ: -half + j * cell - 4, maxZ: -half + (j + 1) * cell + 4 });
    }
    this.group.name = 'building-detail';
  }

  /**
   * Test hook: archetypes of the buildings whose box is in the camera's view within `range` metres, and how many of
   * those have a shop front (a street face with a ground floor of shops). Occlusion is not tested (boxes, not pixels).
   */
  archetypesInView(layout: CityLayout, camera: THREE.Camera, range = 70): { arch: Record<string, number>; shopFronts: number } {
    const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const box = new THREE.Box3();
    const arch: Record<string, number> = {};
    let shopFronts = 0;
    for (const b of layout.buildings) {
      if (b.tier) continue;
      box.min.set(b.x0, b.y0, b.z0); box.max.set(b.x1, b.top, b.z1);
      if (box.distanceToPoint(camera.position) > range || !fr.intersectsBox(box)) continue;
      arch[b.arch] = (arch[b.arch] ?? 0) + 1;
      if (b.style <= 2 && (b.edges.edgeN || b.edges.edgeS || b.edges.edgeW || b.edges.edgeE)) shopFronts++;
    }
    return { arch, shopFronts };
  }

  /** Show the chunks within `near` metres of the camera (horizontal distance to the chunk's box). */
  update(cam: THREE.Vector3): void {
    let n = 0;
    for (const c of this.chunks) {
      const dx = Math.max(c.minX - cam.x, 0, cam.x - c.maxX), dz = Math.max(c.minZ - cam.z, 0, cam.z - c.maxZ);
      const dist = Math.hypot(dx, dz);
      const on = dist < this.near + Math.max(0, cam.y - 30) * 0.5;
      c.mesh.visible = on;
      // shadows only from the chunks right round the camera (the sun's shadow map covers the near city)
      c.mesh.castShadow = dist < 30;
      if (on) n++;
    }
    this.drawnChunks = n;
  }

  /**
   * Test hook: detail vertices inside a pad's landing column (1.2 m round the centre, from the pad up 40 m), inside an
   * alley or tunnel corridor (below 12 m), or out over a road (beyond the curb, below 30 m). All should be 0.
   */
  audit(layout: CityLayout): { padHits: number; alleyHits: number; roadHits: number; vertices: number; samples: number[][] } {
    const { blockSize: B, roadWidth: R, half, roadCenters } = layout;
    const corridors = layout.alleys.map((a) => {
      const cx = roadCenters[a.bi] + R / 2 + B / 2, cz = roadCenters[a.bj] + R / 2 + B / 2, w = a.width / 2 - 0.05;
      return a.axis === 'z' ? [cx - w, cz - B / 2 - R / 2, cx + w, cz + B / 2 + R / 2] : [cx - B / 2 - R / 2, cz - w, cx + B / 2 + R / 2, cz + w];
    });
    const onRoad = (v: number) => { const m = ((v + half) % (B + R) + (B + R)) % (B + R); return m < R - 0.02; };
    let padHits = 0, alleyHits = 0, roadHits = 0, vertices = 0;
    const samples: number[][] = [];
    for (const c of this.chunks) {
      const p = c.mesh.geometry.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        vertices++;
        for (const s of layout.sites) if (y > s.pos.y + 0.05 && y < s.pos.y + 40 && Math.hypot(x - s.pos.x, z - s.pos.z) < 1.2) padHits++;
        if (y < 12) for (const [a, b, cc, d] of corridors) if (x > a && x < cc && z > b && z < d) { alleyHits++; if (samples.length < 4) { const t = i - (i % 3); const col = c.mesh.geometry.getAttribute('color'); samples.push([0, 1, 2].flatMap((k) => [+p.getX(t + k).toFixed(2), +p.getY(t + k).toFixed(2), +p.getZ(t + k).toFixed(2)]).concat([+col.getX(i).toFixed(2), +col.getY(i).toFixed(2), +col.getZ(i).toFixed(2)])); } }
        if (y < 30 && Math.abs(x) < half && Math.abs(z) < half && (onRoad(x) || onRoad(z))) roadHits++;
      }
    }
    return { padHits, alleyHits, roadHits, vertices, samples };
  }

  // ------------------------------------------------------------------------------------------------------------------

  private facades(gb: GeometryBuilder, b: BuildingSpec, rng: () => number, alleyBlock: boolean, doorsteps: THREE.Vector3[], bump: (k: string) => void): void {
    const faces: Face[] = [];
    if (b.edges.edgeN) faces.push({ axis: 'x', at: b.z0, out: -1, a0: b.x0, a1: b.x1 });
    if (b.edges.edgeS) faces.push({ axis: 'x', at: b.z1, out: 1, a0: b.x0, a1: b.x1 });
    if (b.edges.edgeW) faces.push({ axis: 'z', at: b.x0, out: -1, a0: b.z0, a1: b.z1 });
    if (b.edges.edgeE) faces.push({ axis: 'z', at: b.x1, out: 1, a0: b.z0, a1: b.z1 });
    const colW = b.style === Style.curtain ? 3.2 : 2.7;
    const win = WIN[b.style] ?? WIN[0];
    let fireDone = false;
    for (const f of faces) {
      const len = f.a1 - f.a0;
      if (len < 3) continue;
      const cols = Math.max(1, Math.round(len / colW));
      const cw = len / cols;
      // a box on the face: along u0..u1, up y0..y1, out d0..d1 (metres from the face)
      const fb = (u0: number, u1: number, y0: number, y1: number, d0: number, d1: number, c: THREE.Color, st: number = Style.plain) => {
        const o0 = f.at + f.out * d0, o1 = f.at + f.out * d1;
        if (f.axis === 'x') gb.box(Math.min(u0, u1), y0, Math.min(o0, o1), Math.max(u0, u1), y1, Math.max(o0, o1), c, st);
        else gb.box(Math.min(o0, o1), y0, Math.min(u0, u1), Math.max(o0, o1), y1, Math.max(u0, u1), c, st);
      };
      const P = (u: number, y: number, d: number) => (f.axis === 'x' ? new THREE.Vector3(u, y, f.at + f.out * d) : new THREE.Vector3(f.at + f.out * d, y, u));
      const nearDoor = (u: number, r: number) => doorsteps.some((p) => { const q = P(u, 0, 1.5); return Math.hypot(p.x - q.x, p.z - q.z) < r; });
      const floors = Math.round((b.top - b.y0) / FLOOR_H);
      const v0 = b.vOffset;
      const wy = (fl: number) => b.y0 + (fl - v0 + win.cy) * FLOOR_H; // window centre height, storey index fl (with vOffset)
      const colU = (i: number) => f.a0 + (i + 0.5) * cw;
      const hx = win.hx * cw, hy = win.hy * FLOOR_H;
      const lightWall = b.wall.clone().lerp(new THREE.Color('#ffffff'), 0.25);
      const firstUpper = v0 === 0 ? 1 : v0;

      // drain pipe down one corner of the face
      if (b.arch !== 'glass') {
        const u = lotHash(f.at, f.a0, 7) < 0.5 ? f.a0 + 0.22 : f.a1 - 0.22;
        fb(u - 0.06, u + 0.06, b.y0, b.top - 0.1, 0.02, 0.14, METAL_LT);
        bump('pipe');
      }

      if (b.arch === 'office' || b.arch === 'glass') {
        // vertical fins at bay lines, from the first floor up
        const step = b.arch === 'glass' ? 2 : 1;
        for (let i = 0; i <= cols; i += step) {
          const u = Math.min(f.a1 - 0.07, Math.max(f.a0 + 0.07, f.a0 + i * cw)); // corner fins stay on the face
          fb(u - 0.07, u + 0.07, b.y0 + (v0 === 0 ? FLOOR_H : 0), b.top, 0, b.arch === 'glass' ? 0.3 : 0.4, b.arch === 'glass' ? METAL_LT : b.trim);
          bump('fin');
        }
        continue;
      }

      // fire escape (brick walk-ups): platforms per storey on two bays, rails, stairs between them, a drop ladder
      let feI = -1;
      const feTry = Math.min(cols - 2, Math.max(0, Math.floor(cols / 2) - 1));
      if (b.arch === 'walkup' && !fireDone && floors >= 3 && cols >= 3 && !alleyBlock && lotHash(f.at, f.a0, 11) < 0.75
        && !nearDoor(f.a0 + (feTry + 1) * cw, cw + 2.9)) {
        fireDone = true;
        feI = feTry;
        const u0 = f.a0 + feI * cw + 0.15, u1 = f.a0 + (feI + 2) * cw - 0.15;
        const D = 0.58;
        for (let fl = firstUpper; fl < v0 + floors; fl++) {
          const y = b.y0 + (fl - v0) * FLOOR_H + 0.05;
          fb(u0, u1, y, y + 0.06, 0.02, D, METAL);
          fb(u0, u1, y + 0.92, y + 0.97, D - 0.05, D, METAL); // top rail
          fb(u0, u1, y + 0.45, y + 0.48, D - 0.04, D, METAL);
          for (const u of [u0, u1]) fb(u - 0.025, u + 0.025, y, y + 0.97, 0.02, D, METAL); // end rails
          for (let k = 1; k < 4; k++) { const u = u0 + ((u1 - u0) * k) / 4; fb(u - 0.015, u + 0.015, y, y + 0.95, D - 0.04, D, METAL); }
          if (fl + 1 < v0 + floors) {
            // a stair flight to the platform above (alternating direction)
            const dir = (fl - v0) % 2 === 0 ? 1 : -1;
            const sa = dir > 0 ? u0 + 0.3 : u1 - 0.3, sb = dir > 0 ? u1 - 0.5 : u0 + 0.5;
            const run = Math.abs(sb - sa), rise = FLOOR_H - 0.1;
            const ang = Math.atan2(rise, run);
            const L = Math.hypot(run, rise);
            const m = new THREE.Matrix4();
            const mid = P((sa + sb) / 2, y + 0.06 + rise / 2, D * 0.5);
            const q = new THREE.Quaternion();
            if (f.axis === 'x') q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), dir * ang);
            else q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -dir * ang);
            m.compose(mid, q, new THREE.Vector3(1, 1, 1));
            const g = f.axis === 'x' ? new THREE.BoxGeometry(L, 0.05, D * 0.8) : new THREE.BoxGeometry(D * 0.8, 0.05, L);
            gb.append(g, m, METAL, Style.plain);
            g.dispose();
          }
        }
        // drop ladder under the lowest platform (stops 2.6 m above the sidewalk)
        const ly = b.y0 + (firstUpper - v0) * FLOOR_H;
        const lu = u1 - 0.45;
        for (const s of [-0.2, 0.2]) fb(lu + s - 0.02, lu + s + 0.02, b.y0 + 2.6, ly, D - 0.08, D - 0.04, METAL);
        bump('fireEscape');
      }

      const shopFace = v0 === 0 && b.style <= 2;
      // blade sign over a shop (not near a doorstep pad, not in alley blocks)
      if (shopFace && !alleyBlock && cols >= 2 && rng() < 0.55) {
        const i = 1 + Math.floor(rng() * Math.max(1, cols - 1));
        const u = f.a0 + i * cw;
        if (!nearDoor(u, 3.8)) {
          const sc = color(SIGNS[Math.floor(rng() * SIGNS.length)]);
          fb(u - 0.04, u + 0.04, b.y0 + 3.0, b.y0 + 3.75, 0.12, 0.78, sc);
          fb(u - 0.05, u + 0.05, b.y0 + 3.0, b.y0 + 3.06, 0.12, 0.78, color('#ffd27a'), Style.emissive);
          fb(u - 0.03, u + 0.03, b.y0 + 3.8, b.y0 + 3.86, 0.0, 0.7, METAL); // bracket
          bump('bladeSign');
        }
      }
      // stone classic: corner quoins
      if (b.arch === 'classic') {
        const qc = b.wall.clone().lerp(new THREE.Color('#efe6d6'), 0.5);
        for (const end of [f.a0, f.a1]) {
          const s = end === f.a0 ? 1 : -1;
          for (let y = b.y0 + (v0 === 0 ? FLOOR_H : 0), k = 0; y < b.top - 0.6; y += 0.62, k++) {
            const w = k % 2 === 0 ? 0.62 : 0.36;
            fb(end, end + s * w, y + 0.03, y + 0.58, 0, 0.05, qc);
          }
        }
        bump('quoins');
      }

      // per window: sills, balconies, AC units, planters
      for (let fl = firstUpper; fl < v0 + floors; fl++) {
        const y = wy(fl);
        for (let i = 0; i < cols; i++) {
          if (feI >= 0 && (i === feI || i === feI + 1)) continue;
          const u = colU(i);
          const r = lotHash(u, y + f.at * 0.37, 3);
          const sillY = y - hy;
          // alley blocks (mouth faces) and the column over a doorstep pad keep only flush sills
          const flush = alleyBlock || nearDoor(u, 2.9);
          if (!flush && b.arch === 'apartments' && (i + (lotHash(f.at, f.a0, 5) < 0.5 ? 0 : 1)) % 2 === 0) {
            // balcony: slab and a solid front with a dark rail on top
            const w = Math.min(cw * 0.48, hx + 0.45);
            const by = b.y0 + (fl - v0) * FLOOR_H;
            fb(u - w, u + w, by - 0.02, by + 0.14, 0, 0.6, lightWall);
            fb(u - w, u + w, by + 0.14, by + 0.95, 0.54, 0.6, lightWall);
            for (const s of [-1, 1]) fb(u + s * w - s * 0.06, u + s * w, by + 0.14, by + 0.95, 0, 0.6, lightWall);
            fb(u - w, u + w, by + 0.95, by + 1.0, 0.5, 0.62, METAL);
            bump('balcony');
            continue;
          }
          if (!flush && b.arch === 'townhouse' && b.style === Style.tall) {
            // juliet balcony: a shallow ledge and a wrought-iron rail across the long window
            const w = hx + 0.14;
            fb(u - w, u + w, sillY - 0.1, sillY, 0, 0.32, b.trim);
            fb(u - w, u + w, sillY + 0.86, sillY + 0.9, 0.27, 0.31, METAL);
            fb(u - w, u + w, sillY + 0.42, sillY + 0.45, 0.27, 0.31, METAL);
            for (let k = 0; k <= 3; k++) { const uu = u - w + (2 * w * k) / 3; fb(uu - 0.014, uu + 0.014, sillY, sillY + 0.88, 0.28, 0.3, METAL); }
            bump('juliet');
            continue;
          }
          // a sill under every window
          if (b.style !== Style.ribbon) {
            fb(u - hx - 0.07, u + hx + 0.07, sillY - 0.07, sillY, 0, 0.13, (b.arch === 'walkup' ? new THREE.Color('#c8c0b0') : b.trim));
            bump('sill');
          }
          if (flush) continue;
          if (b.arch === 'townhouse' && r < 0.3) {
            // a planter with flowers
            fb(u - hx, u + hx, sillY, sillY + 0.18, 0.02, 0.24, PLANTER);
            fb(u - hx + 0.03, u + hx - 0.03, sillY + 0.18, sillY + 0.32, 0.04, 0.22, color(LEAF[Math.floor(r * 100) % LEAF.length]));
            bump('planter');
          } else if ((b.arch === 'walkup' || b.arch === 'apartments' || b.arch === 'classic') && r < (b.arch === 'walkup' ? 0.2 : 0.1)) {
            // window AC unit hanging under the sill
            const ac = color(AC[Math.floor(r * 40) % AC.length]);
            fb(u - 0.32, u + 0.32, sillY - 0.48, sillY - 0.08, 0.02, 0.4, ac);
            fb(u - 0.26, u + 0.26, sillY - 0.42, sillY - 0.14, 0.4, 0.41, METAL_LT);
            bump('ac');
          }
        }
      }
    }
  }

  private rooftop(gb: GeometryBuilder, b: BuildingSpec, rng: () => number, pads: THREE.Vector3[], bump: (k: string) => void): void {
    const r = b.roof!;
    const top = r.top;
    const free = (x: number, z: number, rad: number) => {
      if (x - rad < r.x0 + 0.7 || x + rad > r.x1 - 0.7 || z - rad < r.z0 + 0.7 || z + rad > r.z1 - 0.7) return false;
      if (pads.some((p) => Math.abs(p.y - top) < 1.5 && Math.hypot(p.x - x, p.z - z) < 5.2 + rad)) return false;
      for (const c of b.colliders) {
        if (c.maxY < top - 0.3 || c.minY > top + 0.3) continue;
        if (c.maxX - c.minX > (r.x1 - r.x0) * 0.9 && c.maxZ - c.minZ > (r.z1 - r.z0) * 0.9) continue; // the building itself
        if (x + rad > c.minX - 0.3 && x - rad < c.maxX + 0.3 && z + rad > c.minZ - 0.3 && z - rad < c.maxZ + 0.3) return false;
      }
      return true;
    };
    const vent = color('#a6abb1'), dark = color('#4a4f56');
    const n = 2 + Math.floor(rng() * 4);
    for (let k = 0; k < n; k++) {
      const x = r.x0 + rng() * (r.x1 - r.x0), z = r.z0 + rng() * (r.z1 - r.z0);
      const t = rng();
      if (t < 0.45) {
        // mushroom vent
        if (!free(x, z, 0.35)) continue;
        gb.box(x - 0.18, top, z - 0.18, x + 0.18, top + 0.55, z + 0.18, vent, Style.plain);
        gb.box(x - 0.32, top + 0.55, z - 0.32, x + 0.32, top + 0.68, z + 0.32, dark, Style.plain);
        bump('vent');
      } else if (t < 0.7) {
        // exhaust stack
        if (!free(x, z, 0.25)) continue;
        const h = 1.0 + rng() * 1.4;
        gb.box(x - 0.12, top, z - 0.12, x + 0.12, top + h, z + 0.12, METAL_LT, Style.plain);
        gb.box(x - 0.16, top + h, z - 0.16, x + 0.16, top + h + 0.08, z + 0.16, dark, Style.plain);
        bump('stack');
      } else if (t < 0.85) {
        // skylight
        if (!free(x, z, 0.9)) continue;
        gb.box(x - 0.8, top, z - 0.55, x + 0.8, top + 0.25, z + 0.55, color('#d0ccc4'), Style.plain);
        gb.box(x - 0.7, top + 0.25, z - 0.45, x + 0.7, top + 0.32, z + 0.45, color('#2c3a48'), Style.water);
        bump('skylight');
      } else {
        // satellite dish on a short post
        if (!free(x, z, 0.5)) continue;
        gb.box(x - 0.04, top, z - 0.04, x + 0.04, top + 0.7, z + 0.04, dark, Style.plain);
        const m = new THREE.Matrix4().compose(new THREE.Vector3(x, top + 0.8, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.9, rng() * 6.28, 0, 'YXZ')), new THREE.Vector3(0.45, 0.08, 0.45));
        const g = new THREE.CylinderGeometry(1, 0.6, 1, 10, 1);
        gb.append(g, m, color('#e4e2dc'), Style.plain);
        g.dispose();
        bump('dish');
      }
    }
    // antenna with cross bars on some mid-rises
    if (b.floors >= 3 && b.floors < 11 && rng() < 0.4) {
      const x = r.x0 + 1 + rng() * Math.max(0.1, r.x1 - r.x0 - 2), z = r.z0 + 1 + rng() * Math.max(0.1, r.z1 - r.z0 - 2);
      if (free(x, z, 0.4)) {
        const h = 2.4 + rng() * 2;
        gb.box(x - 0.035, top, z - 0.035, x + 0.035, top + h, z + 0.035, dark, Style.plain);
        for (let k = 0; k < 3; k++) {
          const y = top + h - 0.3 - k * 0.45, w = 0.55 - k * 0.12;
          gb.box(x - w, y, z - 0.02, x + w, y + 0.04, z + 0.02, dark, Style.plain);
        }
        bump('antenna');
      }
    }
    // a low railing round the roof edge of buildings with a rooftop pad (they read as used roofs)
    if (b.padRoof) {
      const y = top + 0.7;
      const o = 0.05;
      gb.box(r.x0 - o, y, r.z0 - 0.17, r.x1 + o, y + 0.05, r.z0 - 0.12, METAL, Style.plain);
      gb.box(r.x0 - o, y, r.z1 + 0.12, r.x1 + o, y + 0.05, r.z1 + 0.17, METAL, Style.plain);
      bump('roofRail');
    }
  }
}
