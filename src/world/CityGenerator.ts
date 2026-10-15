import * as THREE from 'three';
import { chance, pick, randInt, range, type Rng } from '../core/random';
import { GeometryBuilder, Style, color } from './GeometryBuilder';

/** `soft` colliders (trees, lamp posts) block the drone but not the camera; those props are hidden near the camera instead. */
export type Box = { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number; soft?: boolean };
export type SiteKind = 'rooftop' | 'doorstep' | 'depot' | 'park';
export type Site = { id: number; pos: THREE.Vector3; kind: SiteKind; name: string; radius: number };
export type TreeSpec = { x: number; y: number; z: number; scale: number; color: THREE.Color; pine: boolean };
export type LampSpec = { x: number; z: number; rot: number };

export type CityLayout = {
  blocks: number;
  blockSize: number;
  roadWidth: number;
  half: number;
  roadCenters: number[];
  colliders: Box[];
  sites: Site[];
  trees: TreeSpec[];
  lamps: LampSpec[];
  /** Round 15: awning boxes (drawn only, not colliders), kept so the pad audit can check doorsteps for overhangs. */
  awnings: Box[];
  geometry: THREE.BufferGeometry;
  buildingCount: number;
};

const FLOOR_H = 3.2;
/** Round 15: clear radius around a pad's centre that no tree canopy may enter (drone radius 0.95 plus 0.25 m, the same as the pad audit). */
const PAD_CLEAR = 1.2;
const AWNING_DEPTH = 0.5;
const SIDEWALK_H = 0.25;
const SIDEWALK_W = 3;

const WALLS = ['#f2d7b6', '#e8b48a', '#d98f6c', '#c9705c', '#f4e6cf', '#a9c2a8', '#86adae', '#c9bdd9', '#ecc871', '#d6a676', '#adc0cf', '#f1eee4', '#e0a39a'];
const TOWER_WALLS = ['#dfe3e6', '#bccad4', '#a4b6c6', '#e6dac8', '#8fa5b5', '#cdbba7', '#f0e5d3'];
const TRIM = ['#fbf6ec', '#6a574c', '#ece4d4', '#8a5a44', '#d9c8b0'];
const PILASTER = ['#fbf6ec', '#ece4d4', '#d9c8b0'];
const ROOF_TILES = ['#b8573f', '#9d4b3a', '#6f7c8a', '#c96d45', '#7c5c4b', '#5d6f62'];
const AWNINGS = ['#e76f51', '#2a9d8f', '#e9c46a', '#3f6b8a', '#f4a261', '#c8553d', '#5b8e7d'];
const STREETS = ['Maple', 'Harbor', 'Linden', 'Copper', 'Juniper', 'Orchard', 'Bay', 'Union', 'Willow'];
const AVENUES = ['1st Ave', '2nd Ave', '3rd Ave', '4th Ave', '5th Ave', '6th Ave', '7th Ave', '8th Ave', '9th Ave'];
const SHOPS = ['Bakery', 'Florist', 'Bookshop', 'Café', 'Studio', 'Records', 'Noodle Bar', 'Tailor', 'Pharmacy', 'Gallery', 'Deli', 'Bike Shop'];
const TOWERS = ['Sunset Tower', 'Copper Plaza', 'Halcyon House', 'The Meridian', 'Atlas Building', 'Lumen Court', 'Vista Heights', 'Orchard Lofts', 'Bayview Flats', 'Kestrel House', 'Amber Exchange', 'Union Hall'];

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const sc = new THREE.Vector3();
const tv = new THREE.Vector3();
function mat(x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0): THREE.Matrix4 {
  q.setFromEuler(new THREE.Euler(rx, ry, 0));
  return m4.compose(tv.set(x, y, z), q, sc.set(sx, sy, sz));
}

const cyl8 = new THREE.CylinderGeometry(1, 1, 1, 10, 1);
const cyl16 = new THREE.CylinderGeometry(1, 1, 1, 20, 1);
const cone8 = new THREE.ConeGeometry(1, 1, 10, 1);

export function generateCity(rng: Rng, blocks = 7, parks = 3): CityLayout {
  const B = 32;
  const R = 12;
  const size = blocks * B + (blocks + 1) * R;
  const half = size / 2;
  const roadCenters: number[] = [];
  for (let i = 0; i <= blocks; i++) roadCenters.push(-half + R / 2 + i * (B + R));

  const gb = new GeometryBuilder();
  const colliders: Box[] = [];
  const sites: Site[] = [];
  const trees: TreeSpec[] = [];
  const lamps: LampSpec[] = [];
  const awnings: Box[] = [];
  let buildingCount = 0;
  let towerNameIdx = randInt(rng, 0, TOWERS.length - 1);

  const addSite = (pos: THREE.Vector3, kind: SiteKind, name: string, radius: number) => {
    sites.push({ id: sites.length, pos, kind, name, radius });
  };
  const collide = (minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number) => {
    colliders.push({ minX, minY, minZ, maxX, maxY, maxZ });
  };
  const pad = (x: number, y: number, z: number, r: number, ring: string) => {
    gb.append(cyl16, mat(x, y + 0.04, z, r, 0.08, r), color('#3a3f47'), Style.plain);
    gb.append(cyl16, mat(x, y + 0.06, z, r * 0.84, 0.1, r * 0.84), color(ring), Style.plain);
    gb.append(cyl16, mat(x, y + 0.08, z, r * 0.72, 0.12, r * 0.72), color('#454b54'), Style.plain);
  };

  // Special blocks: parks and depots, kept away from each other.
  const special = new Map<string, 'park' | 'depot'>();
  const centerIdx = Math.floor(blocks / 2);
  const choose = (type: 'park' | 'depot', count: number) => {
    let guard = 0;
    while (count > 0 && guard++ < 200) {
      const i = randInt(rng, 0, blocks - 1);
      const j = randInt(rng, 0, blocks - 1);
      const key = `${i},${j}`;
      if (special.has(key)) continue;
      if (type === 'depot' && Math.abs(i - centerIdx) + Math.abs(j - centerIdx) < 2) continue;
      if (type === 'park' && i === centerIdx && j === centerIdx) continue;
      special.set(key, type);
      count--;
    }
  };
  choose('depot', 2);
  choose('park', parks); // round 16: 2 to 4 parks per city (cities.cityLook); with 3 the layout is unchanged
  let depotNo = 0;

  for (let bi = 0; bi < blocks; bi++) {
    for (let bj = 0; bj < blocks; bj++) {
      const x0 = -half + R + bi * (B + R);
      const z0 = -half + R + bj * (B + R);
      const x1 = x0 + B;
      const z1 = z0 + B;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      const streetN = STREETS[bj % STREETS.length];
      const streetS = STREETS[(bj + 1) % STREETS.length];
      const aveW = AVENUES[bi % AVENUES.length];
      const aveE = AVENUES[(bi + 1) % AVENUES.length];
      const corner = `${pick(rng, [streetN, streetS])} & ${pick(rng, [aveW, aveE])}`;
      const type = special.get(`${bi},${bj}`);

      // Sidewalk slab (curbs on the sides).
      gb.box(x0, 0, z0, x1, SIDEWALK_H, z1, color('#cfc6b8', 0.4, rng), Style.paving);

      // Street lamps: corners + mid edges, facing the road.
      const li = 1.1;
      const lampSpots: Array<[number, number, number]> = [
        [x0 + li, z0 + li, Math.PI * 1.25], [x1 - li, z0 + li, Math.PI * 0.75],
        [x0 + li, z1 - li, -Math.PI * 0.25], [x1 - li, z1 - li, Math.PI * 0.25],
        [cx, z0 + 0.7, Math.PI], [cx, z1 - 0.7, 0], [x0 + 0.7, cz, -Math.PI / 2], [x1 - 0.7, cz, Math.PI / 2],
      ];
      for (const [lx, lz, rot] of lampSpots) {
        lamps.push({ x: lx, z: lz, rot });
        colliders.push({ minX: lx - 0.18, minY: 0, minZ: lz - 0.18, maxX: lx + 0.18, maxY: 6.4, maxZ: lz + 0.18, soft: true });
      }

      const doorsteps: THREE.Vector3[] = [];

      if (type === 'park') {
        const ix0 = x0 + SIDEWALK_W, iz0 = z0 + SIDEWALK_W, ix1 = x1 - SIDEWALK_W, iz1 = z1 - SIDEWALK_W;
        gb.box(ix0, SIDEWALK_H, iz0, ix1, SIDEWALK_H + 0.08, iz1, color('#7fa35a', 0.3, rng), Style.grass);
        // crossing paths
        gb.box(cx - 1.4, SIDEWALK_H, iz0, cx + 1.4, SIDEWALK_H + 0.12, iz1, color('#d9cdb8'), Style.paving);
        gb.box(ix0, SIDEWALK_H, cz - 1.4, ix1, SIDEWALK_H + 0.12, cz + 1.4, color('#d9cdb8'), Style.paving);
        // fountain
        const fy = SIDEWALK_H + 0.12;
        gb.append(cyl16, mat(cx, fy + 0.35, cz, 4.2, 0.7, 4.2), color('#d8d0c2'), Style.plain);
        gb.append(cyl16, mat(cx, fy + 0.66, cz, 3.7, 0.1, 3.7), color('#3d8fa8'), Style.water);
        gb.append(cyl8, mat(cx, fy + 1.4, cz, 0.45, 2.2, 0.45), color('#d8d0c2'), Style.plain);
        gb.append(cyl16, mat(cx, fy + 2.5, cz, 1.4, 0.25, 1.4), color('#d8d0c2'), Style.plain);
        collide(cx - 4.2, 0, cz - 4.2, cx + 4.2, fy + 0.8, cz + 4.2);
        collide(cx - 1.4, 0, cz - 1.4, cx + 1.4, fy + 2.7, cz + 1.4);
        // park trees in quadrants
        // Round 15: a canopy that would hang over the park pad is still rolled (the same random numbers are drawn, so
        // every other part of the city is unchanged) but not planted. The pad sits at (cx + 7.5, cz).
        const scrapT: TreeSpec[] = [], scrapC: Box[] = [];
        for (let k = 0; k < 26; k++) {
          const tx = range(rng, ix0 + 1.5, ix1 - 1.5);
          const tz = range(rng, iz0 + 1.5, iz1 - 1.5);
          if (Math.abs(tx - cx) < 3 || Math.abs(tz - cz) < 3) continue;
          const ts = range(rng, 0.9, 1.45);
          const pine = chance(rng, 0.3);
          const half = (pine ? 1.5 : 2.0) * ts * 0.75;
          const over = Math.hypot(Math.max(0, Math.abs(tx - (cx + 7.5)) - half), Math.max(0, Math.abs(tz - cz) - half)) < PAD_CLEAR;
          addTree(over ? scrapT : trees, over ? scrapC : colliders, rng, tx, SIDEWALK_H + 0.08, tz, ts, pine);
        }
        const sx = cx + 7.5;
        const sz = cz + 1.4 + 0.0;
        pad(sx, SIDEWALK_H + 0.12, sz - 1.4, 2.4, '#f2b84b');
        addSite(new THREE.Vector3(sx, SIDEWALK_H + 0.24, sz - 1.4), 'park', `Fountain Park · ${corner}`, 2.4);
      } else if (type === 'depot') {
        depotNo++;
        const ix0 = x0 + SIDEWALK_W, iz0 = z0 + SIDEWALK_W, ix1 = x1 - SIDEWALK_W;
        // depot hangar along the north side
        const dz1 = iz0 + 10;
        const wall = color('#e9e2d4');
        gb.box(ix0 + 1, SIDEWALK_H, iz0, ix1 - 1, SIDEWALK_H + 7, dz1, wall, Style.ribbon, Math.floor(rng() * 256), { floorH: 3.5 });
        gb.box(ix0 + 1 - 0.1, SIDEWALK_H + 5.2, iz0 - 0.1, ix1 - 1 + 0.1, SIDEWALK_H + 6.2, dz1 + 0.1, color('#e8833a'), Style.plain);
        gb.gable(ix0 + 1, iz0, ix1 - 1, dz1, SIDEWALK_H + 7, 2.2, 0.4, color('#4f6a7a'), wall, Math.floor(rng() * 256));
        collide(ix0 + 1, 0, iz0, ix1 - 1, SIDEWALK_H + 8.3, dz1);
        // big roller doors
        for (let k = 0; k < 3; k++) {
          const dx = ix0 + 4 + k * 7.5;
          gb.box(dx, SIDEWALK_H, dz1, dx + 4.5, SIDEWALK_H + 4.2, dz1 + 0.12, color('#5a6670'), Style.plain);
        }
        // rooftop sign
        gb.box(cx - 5, SIDEWALK_H + 9.4, iz0 + 4.6, cx + 5, SIDEWALK_H + 11.4, iz0 + 5.0, color('#ffb648'), Style.emissive);
        gb.append(cyl8, mat(cx - 3.5, SIDEWALK_H + 8.8, iz0 + 4.8, 0.12, 1.4, 0.12), color('#43505e'), Style.plain);
        gb.append(cyl8, mat(cx + 3.5, SIDEWALK_H + 8.8, iz0 + 4.8, 0.12, 1.4, 0.12), color('#43505e'), Style.plain);
        collide(cx - 5, SIDEWALK_H + 8, iz0 + 4.4, cx + 5, SIDEWALK_H + 11.4, iz0 + 5.2);
        // three pads in the yard
        for (let k = 0; k < 3; k++) {
          const px = ix0 + 5 + k * 8;
          const pz = dz1 + 7.5;
          pad(px, SIDEWALK_H, pz, 2.6, '#f2b84b');
          addSite(new THREE.Vector3(px, SIDEWALK_H + 0.2, pz), 'depot', `Dash Depot ${depotNo === 1 ? 'North' : 'South'} · Pad ${k + 1}`, 2.6);
        }
        // crates & bollards
        for (let k = 0; k < 6; k++) {
          const bx = range(rng, ix0 + 1, ix1 - 1);
          const bz = z1 - SIDEWALK_W - range(rng, 0.8, 2);
          const s = range(rng, 0.8, 1.3);
          gb.box(bx - s / 2, SIDEWALK_H, bz - s / 2, bx + s / 2, SIDEWALK_H + s, bz + s / 2, color(pick(rng, ['#b88a5a', '#9c7148', '#5b8e7d'])), Style.plain);
          collide(bx - s / 2, 0, bz - s / 2, bx + s / 2, SIDEWALK_H + s, bz + s / 2);
        }
      } else {
        // Regular block: subdivide into lots.
        const dx = (cx) / half;
        const dz = (cz) / half;
        const down = 1 - Math.min(1, Math.hypot(dx, dz) / 1.05); // 1 at center, 0 at edge
        const cols = down > 0.55 ? randInt(rng, 1, 2) : randInt(rng, 2, 3);
        const rows = down > 0.55 ? randInt(rng, 1, 2) : randInt(rng, 2, 3);
        const ix0 = x0 + SIDEWALK_W, iz0 = z0 + SIDEWALK_W;
        const inner = B - SIDEWALK_W * 2;
        const gap = 0.9;
        const lw = (inner - gap * (cols - 1)) / cols;
        const ld = (inner - gap * (rows - 1)) / rows;
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            const lx0 = ix0 + c * (lw + gap);
            const lz0 = iz0 + r * (ld + gap);
            const edgeW = c === 0, edgeE = c === cols - 1, edgeN = r === 0, edgeS = r === rows - 1;
            const res = addBuilding(gb, colliders, rng, lx0, lz0, lx0 + lw, lz0 + ld, down, { edgeW, edgeE, edgeN, edgeS }, awnings);
            buildingCount++;
            if (res.padRoof) {
              const name = res.tall ? TOWERS[towerNameIdx++ % TOWERS.length] : `${pick(rng, STREETS)} Lofts`;
              addSite(res.padRoof, 'rooftop', `${name} Rooftop`, 3);
              pad(res.padRoof.x, res.padRoof.y - 0.2, res.padRoof.z, 3, '#f2f2f2');
            }
            // Doorstep delivery spots on street-facing facades.
            if (chance(rng, 0.42)) {
              const faces: Array<[number, number, number, number]> = [];
              if (edgeN) faces.push([lx0 + lw / 2, lz0 - 1.5, 0, -1]);
              if (edgeS) faces.push([lx0 + lw / 2, lz0 + ld + 1.5, 0, 1]);
              if (edgeW) faces.push([lx0 - 1.5, lz0 + ld / 2, -1, 0]);
              if (edgeE) faces.push([lx0 + lw + 1.5, lz0 + ld / 2, 1, 0]);
              if (faces.length) {
                const f = pick(rng, faces);
                const p = new THREE.Vector3(f[0], SIDEWALK_H + 0.12, f[1]);
                // keep away from lamps
                if (lampSpots.every(([lx, lz]) => Math.hypot(lx - p.x, lz - p.z) > 3)) {
                  doorsteps.push(p);
                  gb.box(p.x - 1.3, SIDEWALK_H, p.z - 1.3, p.x + 1.3, SIDEWALK_H + 0.04, p.z + 1.3, color('#7b5a49'), Style.plain);
                  addSite(p, 'doorstep', `${pick(rng, SHOPS)} · ${corner}`, 1.7);
                }
              }
            }
          }
        }
      }

      // Street trees along the curb, skipping lamps, corners and doorsteps.
      if (type !== 'park') {
        const tInset = 1.1;
        const edges: Array<[number, number, number, number]> = [
          [x0 + 5, z0 + tInset, x1 - 5, z0 + tInset],
          [x0 + 5, z1 - tInset, x1 - 5, z1 - tInset],
          [x0 + tInset, z0 + 5, x0 + tInset, z1 - 5],
          [x1 - tInset, z0 + 5, x1 - tInset, z1 - 5],
        ];
        for (const [ax, az, bx, bz] of edges) {
          if (type === 'depot' && az === z0 + tInset) continue;
          const len = Math.hypot(bx - ax, bz - az);
          const n = Math.floor(len / 7.5);
          for (let k = 0; k <= n; k++) {
            const t = n === 0 ? 0.5 : k / n;
            const tx = ax + (bx - ax) * t;
            const tz = az + (bz - az) * t;
            if (Math.abs(tx - cx) < 2.5 && Math.abs(tz - cz) < 17) continue; // mid lamps
            if (Math.abs(tz - cz) < 2.5 && Math.abs(tx - cx) < 17) continue;
            if (doorsteps.some((d) => Math.hypot(d.x - tx, d.z - tz) < 4)) continue;
            if (chance(rng, 0.12)) continue;
            addTree(trees, colliders, rng, tx, SIDEWALK_H, tz, range(rng, 0.75, 1.05), false);
          }
        }
      }
    }
  }

  // Waterfront promenade edge + low wall around the city perimeter.
  const e = half + 2;
  gb.box(-e - 2, -1.5, -e - 2, e + 2, 0.5, -e, color('#cbbfa9'), Style.paving);
  gb.box(-e - 2, -1.5, e, e + 2, 0.5, e + 2, color('#cbbfa9'), Style.paving);
  gb.box(-e - 2, -1.5, -e, -e, 0.5, e, color('#cbbfa9'), Style.paving);
  gb.box(e, -1.5, -e, e + 2, 0.5, e, color('#cbbfa9'), Style.paving);

  return {
    blocks,
    blockSize: B,
    roadWidth: R,
    half,
    roadCenters,
    colliders,
    sites,
    trees,
    lamps,
    awnings,
    geometry: gb.build(),
    buildingCount,
  };
}

function addTree(trees: TreeSpec[], colliders: Box[], rng: Rng, x: number, y: number, z: number, scale: number, pine: boolean): void {
  const greens = pine ? ['#3f6b47', '#4c7a4f', '#365e44'] : ['#6d9b4a', '#86a94f', '#5e8c4a', '#9db35a', '#d0a24a', '#c97f3d', '#7aa356'];
  const c = color(pick(rng, greens), 0.6, rng);
  trees.push({ x, y, z, scale, color: c, pine });
  const r = (pine ? 1.5 : 2.0) * scale;
  // Round canopies are ellipsoids (centre 3.4s, radii 2.0s x 1.8s): at 1.6s they are only a point, so the box starts
  // where the canopy is as wide as the box (2.2s). Otherwise its invisible lower corners snag the drone under trees.
  const minY = y + (pine ? 1.6 : 2.2) * scale;
  colliders.push({ minX: x - r * 0.75, minY, minZ: z - r * 0.75, maxX: x + r * 0.75, maxY: y + (pine ? 7.2 : 5.6) * scale, maxZ: z + r * 0.75, soft: true });
  // trunk
  colliders.push({ minX: x - 0.2, minY: y, minZ: z - 0.2, maxX: x + 0.2, maxY: minY, maxZ: z + 0.2, soft: true });
}

type Edges = { edgeW: boolean; edgeE: boolean; edgeN: boolean; edgeS: boolean };

function addBuilding(
  gb: GeometryBuilder, colliders: Box[], rng: Rng,
  x0: number, z0: number, x1: number, z1: number, down: number, edges: Edges, awnings: Box[] = [],
): { padRoof: THREE.Vector3 | null; tall: boolean } {
  const w = x1 - x0;
  const d = z1 - z0;
  // height distribution: tall downtown, low at the edges
  const maxFloors = Math.round(3 + down * down * 21);
  let floors = Math.max(1, Math.round(range(rng, 0.35, 1) * maxFloors));
  if (chance(rng, 0.08)) floors += randInt(rng, 2, 6);
  const tall = floors >= 11;
  const y0 = SIDEWALK_H;
  const seed = Math.floor(rng() * 256);

  let style: number;
  if (tall) style = pick(rng, [Style.ribbon, Style.curtain, Style.ribbon, Style.punched]);
  else if (floors >= 5) style = pick(rng, [Style.punched, Style.tall, Style.ribbon, Style.tall]);
  else style = pick(rng, [Style.punched, Style.tall, Style.tall]);

  const wall = color(pick(rng, tall ? TOWER_WALLS : WALLS), 0.5, rng);
  const trim = color(pick(rng, TRIM), 0.2, rng);
  const inset = tall ? 0.6 : range(rng, 0.0, 0.5);
  const bx0 = x0 + inset, bz0 = z0 + inset, bx1 = x1 - inset, bz1 = z1 - inset;

  const gabled = floors <= 4 && chance(rng, 0.6);
  let top = y0 + floors * FLOOR_H;

  // plinth / ground floor band in trim colour for character
  gb.box(bx0, y0, bz0, bx1, top, bz1, wall, style, seed, { floorH: FLOOR_H, colW: style === Style.curtain ? 3.2 : 2.7 });
  colliders.push({ minX: bx0, minY: 0, minZ: bz0, maxX: bx1, maxY: top, maxZ: bz1 });
  // corner pilasters
  if (!tall && chance(rng, 0.6)) {
    const p = 0.35;
    const pilaster = color(pick(rng, PILASTER), 0.2, rng);
    for (const [px, pz] of [[bx0, bz0], [bx1, bz0], [bx0, bz1], [bx1, bz1]]) {
      gb.box(px - p, y0, pz - p, px + p, top, pz + p, pilaster, Style.plain);
    }
  }
  // ground floor band
  gb.box(bx0 - 0.08, y0 + FLOOR_H - 0.25, bz0 - 0.08, bx1 + 0.08, y0 + FLOOR_H + 0.1, bz1 + 0.08, trim, Style.plain);

  // awnings on street faces
  if (!tall && chance(rng, 0.65)) {
    const aw = color(pick(rng, AWNINGS), 0.3, rng);
    const ay = y0 + 2.5;
    // round 15: awnings reach 0.5 m (was 1.1 m) so they never hang over a doorstep pad 1.5 m out from the lot edge
    const ad = AWNING_DEPTH;
    const boxes: Box[] = [];
    if (edges.edgeN) boxes.push({ minX: bx0 + 0.8, minY: ay, minZ: bz0 - ad, maxX: bx1 - 0.8, maxY: ay + 0.35, maxZ: bz0 });
    if (edges.edgeS) boxes.push({ minX: bx0 + 0.8, minY: ay, minZ: bz1, maxX: bx1 - 0.8, maxY: ay + 0.35, maxZ: bz1 + ad });
    if (edges.edgeW) boxes.push({ minX: bx0 - ad, minY: ay, minZ: bz0 + 0.8, maxX: bx0, maxY: ay + 0.35, maxZ: bz1 - 0.8 });
    if (edges.edgeE) boxes.push({ minX: bx1, minY: ay, minZ: bz0 + 0.8, maxX: bx1 + ad, maxY: ay + 0.35, maxZ: bz1 - 0.8 });
    for (const b of boxes) {
      gb.box(b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ, aw, Style.plain);
      awnings.push(b);
    }
  }

  let roofX0 = bx0, roofZ0 = bz0, roofX1 = bx1, roofZ1 = bz1;

  if (tall && chance(rng, 0.55) && w > 12 && d > 12) {
    // setback upper tier
    const extra = randInt(rng, 3, Math.max(4, Math.round(floors * 0.5)));
    const s = range(rng, 1.8, 3.2);
    const ux0 = bx0 + s, uz0 = bz0 + s, ux1 = bx1 - s, uz1 = bz1 - s;
    cornice(gb, bx0, bz0, bx1, bz1, top, trim, colliders);
    gb.box(ux0, top, uz0, ux1, top + extra * FLOOR_H, uz1, wall, style, (seed + 7) % 256, { floorH: FLOOR_H, vOffset: floors, colW: style === Style.curtain ? 3.2 : 2.7 });
    colliders.push({ minX: ux0, minY: top, minZ: uz0, maxX: ux1, maxY: top + extra * FLOOR_H, maxZ: uz1 });
    top += extra * FLOOR_H;
    roofX0 = ux0; roofZ0 = uz0; roofX1 = ux1; roofZ1 = uz1;
  }

  if (gabled) {
    const rise = Math.min(w, d) * range(rng, 0.28, 0.42);
    gb.gable(bx0, bz0, bx1, bz1, top, rise, 0.45, color(pick(rng, ROOF_TILES), 0.4, rng), wall, seed);
    colliders.push({ minX: bx0, minY: top, minZ: bz0, maxX: bx1, maxY: top + rise * 0.6, maxZ: bz1 });
    // chimney
    if (chance(rng, 0.6)) {
      const chx = range(rng, bx0 + 1, bx1 - 1);
      const chz = range(rng, bz0 + 1, bz1 - 1);
      gb.box(chx - 0.4, top, chz - 0.4, chx + 0.4, top + rise + 0.8, chz + 0.4, color('#8c5a48'), Style.plain);
    }
    return { padRoof: null, tall };
  }

  cornice(gb, roofX0, roofZ0, roofX1, roofZ1, top, trim, colliders);
  const rw = roofX1 - roofX0;
  const rd = roofZ1 - roofZ0;
  const rcx = (roofX0 + roofX1) / 2;
  const rcz = (roofZ0 + roofZ1) / 2;
  const padRoof = rw >= 9.5 && rd >= 9.5 && floors >= 2 && top < 70 && chance(rng, 0.5) ? new THREE.Vector3(rcx, top + 0.2, rcz) : null;

  // Rooftop clutter, kept off the pad area.
  const clear = (x: number, z: number, r: number) => !padRoof || Math.max(Math.abs(x - rcx), Math.abs(z - rcz)) > 3.6 + r;
  const nUnits = randInt(rng, 1, 4);
  for (let k = 0; k < nUnits; k++) {
    const uw = range(rng, 1.2, 2.4), ud = range(rng, 1.0, 1.8), uh = range(rng, 0.8, 1.4);
    const ux = range(rng, roofX0 + 1 + uw / 2, roofX1 - 1 - uw / 2);
    const uz = range(rng, roofZ0 + 1 + ud / 2, roofZ1 - 1 - ud / 2);
    if (!clear(ux, uz, Math.max(uw, ud) / 2)) continue;
    gb.box(ux - uw / 2, top, uz - ud / 2, ux + uw / 2, top + uh, uz + ud / 2, color('#b9bec4', 0.3, rng), Style.plain);
    gb.append(cyl8, mat(ux, top + uh + 0.05, uz, Math.min(uw, ud) * 0.32, 0.12, Math.min(uw, ud) * 0.32), color('#5c6168'), Style.plain);
    colliders.push({ minX: ux - uw / 2, minY: top, minZ: uz - ud / 2, maxX: ux + uw / 2, maxY: top + uh, maxZ: uz + ud / 2 });
  }
  // water tower on mid-rises
  if (!tall && floors >= 4 && chance(rng, 0.4)) {
    const tx = padRoof ? roofX0 + 2.2 : range(rng, roofX0 + 2.2, roofX1 - 2.2);
    const tz = padRoof ? roofZ0 + 2.2 : range(rng, roofZ0 + 2.2, roofZ1 - 2.2);
    const legC = color('#5a4a40');
    for (const [ox, oz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
      gb.append(cyl8, mat(tx + ox, top + 1.2, tz + oz, 0.1, 2.4, 0.1), legC, Style.plain);
    }
    gb.append(cyl8, mat(tx, top + 3.6, tz, 1.4, 2.6, 1.4), color('#9b6b4b', 0.3, rng), Style.plain);
    gb.append(cone8, mat(tx, top + 5.4, tz, 1.55, 1.0, 1.55), color('#6d5444'), Style.plain);
    colliders.push({ minX: tx - 1.5, minY: top, minZ: tz - 1.5, maxX: tx + 1.5, maxY: top + 5.9, maxZ: tz + 1.5 });
  }
  // solar panels on low/mid buildings
  if (!tall && !padRoof && chance(rng, 0.45)) {
    const n = randInt(rng, 2, 4);
    for (let k = 0; k < n; k++) {
      const px = roofX0 + 1.5 + k * 2.2;
      if (px + 1 > roofX1 - 1) break;
      gb.append(new THREE.BoxGeometry(1.8, 0.08, 1.2), mat(px + 0.9, top + 0.55, roofZ1 - 2, 1, 1, 1, 0, -0.45), color('#ffffff'), Style.solar);
    }
  }
  // antenna mast + aviation light on towers
  if (tall) {
    const ax = padRoof ? roofX1 - 1.5 : rcx;
    const az = padRoof ? roofZ1 - 1.5 : rcz;
    const ah = range(rng, 4, 9);
    gb.append(cyl8, mat(ax, top + ah / 2, az, 0.12, ah, 0.12), color('#8b9096'), Style.plain);
    gb.append(cyl8, mat(ax, top + ah + 0.2, az, 0.28, 0.4, 0.28), color('#ff3b2f'), Style.emissive);
    colliders.push({ minX: ax - 0.3, minY: top, minZ: az - 0.3, maxX: ax + 0.3, maxY: top + ah + 0.4, maxZ: az + 0.3 });
    if (!padRoof) {
      // mechanical penthouse
      const pw = rw * 0.4, pd = rd * 0.35;
      gb.box(rcx - pw / 2, top, rcz - pd / 2 + 2, rcx + pw / 2, top + 2.8, rcz + pd / 2 + 2, color('#9aa3ac'), Style.plain);
      colliders.push({ minX: rcx - pw / 2, minY: top, minZ: rcz - pd / 2 + 2, maxX: rcx + pw / 2, maxY: top + 2.8, maxZ: rcz + pd / 2 + 2 });
    }
  } else if (chance(rng, 0.5)) {
    // stair hut
    const hx = padRoof ? roofX1 - 1.6 : range(rng, roofX0 + 1.6, roofX1 - 1.6);
    const hz = padRoof ? roofZ1 - 1.6 : range(rng, roofZ0 + 1.6, roofZ1 - 1.6);
    gb.box(hx - 1.1, top, hz - 1.1, hx + 1.1, top + 2.4, hz + 1.1, color('#d8d2c6', 0.3, rng), Style.plain);
    colliders.push({ minX: hx - 1.1, minY: top, minZ: hz - 1.1, maxX: hx + 1.1, maxY: top + 2.4, maxZ: hz + 1.1 });
  }
  return { padRoof, tall };
}

function cornice(gb: GeometryBuilder, x0: number, z0: number, x1: number, z1: number, top: number, trim: THREE.Color, colliders: Box[]): void {
  const o = 0.22, t = 0.38, h = 0.7;
  const parts: Array<[number, number, number, number]> = [
    [x0 - o, z0 - o, x1 + o, z0 - o + t],
    [x0 - o, z1 + o - t, x1 + o, z1 + o],
    [x0 - o, z0 - o + t, x0 - o + t, z1 + o - t],
    [x1 + o - t, z0 - o + t, x1 + o, z1 + o - t],
  ];
  for (const [ax, az, bx, bz] of parts) {
    gb.box(ax, top - 0.2, az, bx, top + h, bz, trim, Style.plain);
    // parapets are solid for both drone and camera
    colliders.push({ minX: ax, minY: top - 0.2, minZ: az, maxX: bx, maxY: top + h, maxZ: bz });
  }
}
