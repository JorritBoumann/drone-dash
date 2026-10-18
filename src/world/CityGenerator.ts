import * as THREE from 'three';
import { chance, pick, randInt, range, type Rng } from '../core/random';
import { GeometryBuilder, Style, color } from './GeometryBuilder';
import { type BuildingSpec, type Archetype, lotHash } from './BuildingDetail';
import {
  TUNNEL_CLEAR, buildStreetGraph, boulevardStops, featureRng, planAlleys, planBoulevards, planRushLanes,
  type Alley, type Boulevard, type FeatureKind, type RushLane, type StreetGraph,
} from './CityFeatures';

/** `soft` colliders (trees, lamp posts) block the drone but not the camera; those props are hidden near the camera instead. */
export type Box = { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number; soft?: boolean; facade?: boolean };
/** Round 18: a named city feature (diagnostics, HUD): where it is and what kind. */
export type CityFeature = { kind: FeatureKind; name: string; x: number; z: number; length: number };
export type SiteKind = 'rooftop' | 'doorstep' | 'depot' | 'park';
export type Site = { id: number; pos: THREE.Vector3; kind: SiteKind; name: string; radius: number };
export type TreeSpec = { x: number; y: number; z: number; scale: number; color: THREE.Color; pine: boolean };
export type LampSpec = { x: number; z: number; rot: number };
/** Round 28: street furniture kinds (CC0 models plus a few procedural ones, see StreetProps.ts). */
export const PROP = { bench: 0, bin: 1, hydrant: 2, bollard: 3, planter: 4, table: 5, chair: 6, aboard: 7, bikerack: 8, busstop: 9 } as const;
export const PROP_NAMES = ['bench', 'bin', 'hydrant', 'bollard', 'planter', 'table', 'chair', 'aboard', 'bikerack', 'busstop'];
export type PropSpec = { kind: number; x: number; y: number; z: number; rot: number };
/** Round 28: one shop bay on a street face (for the shop-front audit): sign variant (7 = home entrance), door colour, awning colour (-1 none). */
export type ShopBay = { axis: 'x' | 'z'; n: number; line: number; lo: number; hi: number; k: number; sign: number; door: number; awn: number };

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
  /** Round 18: route-choice features (diagonal avenue, alleys, tunnels) and the rush lanes. */
  features: CityFeature[];
  alleys: Alley[];
  boulevards: Boulevard[];
  rushLanes: RushLane[];
  graph: StreetGraph;
  gridGraph: StreetGraph;
  /** Round 27: every regular building's footprint, height, style and archetype (the facade detail kit reads these). */
  buildings: BuildingSpec[];
  /** Round 28: street furniture on the sidewalks (drawn only, no colliders). */
  props: PropSpec[];
  /** Round 28: every shop bay on a street face. */
  shopFronts: ShopBay[];
};

const FLOOR_H = 3.2;
/** Round 15: clear radius around a pad's centre that no tree canopy may enter (drone radius 0.95 plus 0.25 m, the same as the pad audit). */
const PAD_CLEAR = 1.2;
const AWNING_DEPTH = 0.5;
const SIDEWALK_H = 0.25;
const SIDEWALK_W = 3;
/** Round 19: alley blocks set their mouth faces back this far (a wider apron to turn into the alley from the street). */
const MOUTH_SET = 1.5; // round 20: 2.5 was tried; the set-back street faces weakened the street draft (grid bot Bronze on 3 of 12 cities)
/** Round 20: a doorstep beside an alley mouth sits this far from its lot's outer corner (the far end from the alley). */
const MOUTH_PAD = 2.4;

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

export function generateCity(rng: Rng, blocks = 7, parks = 3, seed: number | null = null): CityLayout {
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
  // round 27: buildings for the detail kit (collected without drawing from rng, so the city layout is unchanged)
  SPECS = [];
  SHOP_BAYS = [];

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

  // Round 18: route-choice features from their own stream (seed hash). Blocks a boulevard clips are kept free of
  // depots (their hangar fills the corners); parks may be clipped (only trees go).
  const frng = seed === null ? null : featureRng(seed);
  const boulevards = frng ? planBoulevards(frng) : [];
  type Cut = { Pz: number; m: number; hw: number };
  const cutsOf = (rx0: number, rz0: number, rx1: number, rz1: number, pad = 0): Cut[] =>
    boulevards
      .filter((b) => {
        const v = [rz0 - b.s * rx0 - b.c, rz0 - b.s * rx1 - b.c, rz1 - b.s * rx0 - b.c, rz1 - b.s * rx1 - b.c];
        const w = (b.halfWidth + pad) * Math.SQRT2;
        return Math.max(...v) > -w && Math.min(...v) < w;
      })
      .map((b) => ({ Pz: b.c, m: b.s, hw: b.halfWidth }));
  const reserved = new Set<string>();
  for (let bi = 0; bi < blocks; bi++) for (let bj = 0; bj < blocks; bj++) {
    const x0 = -half + R + bi * (B + R), z0 = -half + R + bj * (B + R);
    if (cutsOf(x0, z0, x0 + B, z0 + B, 1).length) reserved.add(`${bi},${bj}`);
  }

  // Special blocks: parks and depots, kept away from each other.
  const special = new Map<string, 'park' | 'depot'>();
  const centerIdx = Math.floor(blocks / 2);
  const choose = (type: 'park' | 'depot', count: number) => {
    let guard = 0;
    while (count > 0 && guard++ < 200) {
      const i = randInt(rng, 0, blocks - 1);
      const j = randInt(rng, 0, blocks - 1);
      const key = `${i},${j}`;
      if (special.has(key) || (type === 'depot' && reserved.has(key))) continue;
      if (type === 'depot' && Math.abs(i - centerIdx) + Math.abs(j - centerIdx) < 2) continue;
      if (type === 'park' && i === centerIdx && j === centerIdx) continue;
      special.set(key, type);
      count--;
    }
  };
  choose('depot', 2);
  choose('park', parks); // round 16: 2 to 4 parks per city (cities.cityLook); with 3 the layout is unchanged
  let depotNo = 0;
  const blockedForAlleys = new Set<string>([...special.keys()]);
  const alleys = frng ? planAlleys(frng, blocks, blockedForAlleys) : [];
  const alleyAt = new Map(alleys.map((a) => [`${a.bi},${a.bj}`, a]));
  const rushLanes = frng ? planRushLanes(frng, blocks) : [];
  // z intervals the given cuts' corridors cover over x in [a, b]
  const cutZRanges = (cs: Cut[]) => (a: number, b: number): Array<[number, number]> =>
    cs.map((c) => {
      const za = c.Pz + c.m * a, zb = c.Pz + c.m * b;
      const w = c.hw * Math.SQRT2;
      return [Math.min(za, zb) - w, Math.max(za, zb) + w] as [number, number];
    });
  // trees, lamps and soft props are kept out of these zones (alley mouths, the diagonal)
  const clearRects: Array<[number, number, number, number]> = [];

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
      const lotTops: Array<{ x0: number; z0: number; x1: number; z1: number; top: number }> = [];
      const cutTops: number[] = [];

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
        const alley = alleyAt.get(`${bi},${bj}`);
        const blockCuts = cutsOf(x0, z0, x1, z1);

        let cols = down > 0.55 ? randInt(rng, 1, 2) : randInt(rng, 2, 3);
        let rows = down > 0.55 ? randInt(rng, 1, 2) : randInt(rng, 2, 3);
        // round 19: an alley block sets its mouth faces back by MOUTH_SET (a wider apron to turn in from the street)
        const setX = alley?.axis === 'x' ? MOUTH_SET : 0, setZ = alley?.axis === 'z' ? MOUTH_SET : 0;
        const ix0 = x0 + SIDEWALK_W + setX, iz0 = z0 + SIDEWALK_W + setZ;
        const innerX = B - SIDEWALK_W * 2 - setX * 2, innerZ = B - SIDEWALK_W * 2 - setZ * 2;
        const gap = 0.9;
        // round 18: an alley is a wide gap between two columns (axis z) or two rows (axis x) of lots
        let gapX = gap, gapZ = gap;
        if (alley?.axis === 'z') { cols = 2; gapX = alley.width; }
        if (alley?.axis === 'x') { rows = 2; gapZ = alley.width; }
        if (blockCuts.length) { cols = Math.max(cols, 2); rows = Math.max(rows, 2); }
        const lw = (innerX - gapX * (cols - 1)) / cols;
        const ld = (innerZ - gapZ * (rows - 1)) / rows;
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            const lx0 = ix0 + c * (lw + gapX);
            const lz0 = iz0 + r * (ld + gapZ);
            const edgeW = c === 0, edgeE = c === cols - 1, edgeN = r === 0, edgeS = r === rows - 1;
            let cutLot = false;
            // clear of the cut's corridor by `m` metres (true when this block has no cut)
            const outside = (x: number, z: number, m: number) => blockCuts.every((c) => Math.abs(z - c.Pz - c.m * x) / Math.SQRT2 > c.hw + m);
            const lotCuts = cutsOf(lx0, lz0, lx0 + lw, lz0 + ld, 0.2);
            if (lotCuts.length) {
              // round 18: a lot a boulevard clips becomes a stepped terrace along it (no rooftop pad; a doorstep only on
              // a street face well clear of the cut)
              {
                cutTops.push(addCutBuilding(gb, colliders, rng, lx0, lz0, lx0 + lw, lz0 + ld, down, cutZRanges(lotCuts), alley?.covered ? 4 : 2));
                buildingCount++;
                cutLot = true;
              }
            }
            const res = cutLot
              ? { padRoof: null, tall: false, top: 0 }
              : addBuilding(gb, colliders, rng, lx0, lz0, lx0 + lw, lz0 + ld, down, { edgeW, edgeE, edgeN, edgeS }, awnings, alley?.covered ? 4 : 1);
            if (!cutLot) {
              lotTops.push({ x0: lx0, z0: lz0, x1: lx0 + lw, z1: lz0 + ld, top: res.top });
              buildingCount++;
            }
            if (res.padRoof) {
              const name = res.tall ? TOWERS[towerNameIdx++ % TOWERS.length] : `${pick(rng, STREETS)} Lofts`;
              addSite(res.padRoof, 'rooftop', `${name} Rooftop`, 3);
              pad(res.padRoof.x, res.padRoof.y - 0.2, res.padRoof.z, 3, '#f2f2f2');
            }
            // Doorstep delivery spots on street-facing facades.
            // round 19: lots beside an alley mouth get a doorstep more often, placed beside the mouth (on the line the
            // alley carries across the street), so legs can start and end on an alley line
            const mouthLot = alley?.axis === 'z' ? (edgeN || edgeS) : alley?.axis === 'x' ? (edgeW || edgeE) : false;
            if (chance(rng, mouthLot ? 0.8 : 0.42)) {
              let faces: Array<[number, number, number, number]> = [];
              const ok = (x: number, z: number, bx: number, bz: number) => !cutLot || (outside(x, z, 3) && outside(bx, bz, 2.5));
              // x (or z) of the doorstep on a mouth face. Round 20: at the far end of the face from the alley (MOUTH_PAD m from
              // the lot corner, about 7 m from the alley wall; was 2.2 m from the wall), so a pilot leaving the alley fast has
              // room to turn onto it instead of swinging back into the mouth corner. Else the middle of the face.
              const fx = alley?.axis === 'z' ? (lx0 + lw / 2 < cx ? lx0 + MOUTH_PAD : lx0 + lw - MOUTH_PAD) : lx0 + lw / 2;
              const fz = alley?.axis === 'x' ? (lz0 + ld / 2 < cz ? lz0 + MOUTH_PAD : lz0 + ld - MOUTH_PAD) : lz0 + ld / 2;
              const mouthFaces: typeof faces = [];
              if (edgeN && ok(fx, lz0 - 1.5, fx, lz0 + 1)) (alley?.axis === 'z' ? mouthFaces : faces).push([fx, lz0 - 1.5, 0, -1]);
              if (edgeS && ok(fx, lz0 + ld + 1.5, fx, lz0 + ld - 1)) (alley?.axis === 'z' ? mouthFaces : faces).push([fx, lz0 + ld + 1.5, 0, 1]);
              if (edgeW && ok(lx0 - 1.5, fz, lx0 + 1, fz)) (alley?.axis === 'x' ? mouthFaces : faces).push([lx0 - 1.5, fz, -1, 0]);
              if (edgeE && ok(lx0 + lw + 1.5, fz, lx0 + lw - 1, fz)) (alley?.axis === 'x' ? mouthFaces : faces).push([lx0 + lw + 1.5, fz, 1, 0]);
              if (mouthFaces.length) faces = mouthFaces;
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

      // Round 18: alley / tunnel dressing and the diagonal's paving.
      const alley = alleyAt.get(`${bi},${bj}`);
      if (alley && type === undefined) {
        const W = alley.width;
        const ax0 = alley.axis === 'z' ? cx - W / 2 : x0, ax1 = alley.axis === 'z' ? cx + W / 2 : x1;
        const az0 = alley.axis === 'x' ? cz - W / 2 : z0, az1 = alley.axis === 'x' ? cz + W / 2 : z1;
        gb.box(ax0, SIDEWALK_H, az0, ax1, SIDEWALK_H + 0.03, az1, color(alley.covered ? '#8a7f74' : '#a8664c', 0.2, rng), Style.paving);
        clearRects.push(alley.axis === 'z' ? [ax0 - 1.6, z0 - 0.5, ax1 + 1.6, z1 + 0.5] : [x0 - 0.5, az0 - 1.6, x1 + 0.5, az1 + 1.6]);
        // round 19: a lit mouth at both ends (drawn only, flush on the faces): glowing corner posts, a name board on each
        // side and two chevrons on the apron pointing in, amber for an alley, ice blue for a tunnel
        {
          const glow = color(alley.covered ? '#7fd0ff' : '#ffb648');
          const chev = color(alley.covered ? '#9fdcff' : '#ffd27a');
          const face = SIDEWALK_W + MOUTH_SET; // the mouth faces stand this far in from the block edge
          for (const end of [-1, 1]) {
            // u: along the alley (into the block is -end), v: across it
            const along = alley.axis === 'z';
            const mouthU = (along ? cz : cx) + end * (B / 2 - face); // face line
            const edgeU = (along ? cz : cx) + end * (B / 2); // block edge
            const cV = along ? cx : cz;
            const P = (u: number, v: number): [number, number] => (along ? [v, u] : [u, v]);
            for (const side of [-1, 1]) {
              const v0 = cV + side * (W / 2), v1 = cV + side * (W / 2 + 0.35);
              const [ax0, az0] = P(mouthU, Math.min(v0, v1)), [ax1, az1] = P(mouthU + end * 0.06, Math.max(v0, v1));
              gb.box(Math.min(ax0, ax1), SIDEWALK_H + 0.4, Math.min(az0, az1), Math.max(ax0, ax1), SIDEWALK_H + 6.2, Math.max(az0, az1), glow, Style.emissive);
              const s0 = cV + side * (W / 2 + 0.6), s1 = cV + side * (W / 2 + 2.2);
              const [bx0, bz0] = P(mouthU, Math.min(s0, s1)), [bx1, bz1] = P(mouthU + end * 0.08, Math.max(s0, s1));
              gb.box(Math.min(bx0, bx1), SIDEWALK_H + 4.1, Math.min(bz0, bz1), Math.max(bx0, bx1), SIDEWALK_H + 4.9, Math.max(bz0, bz1), glow, Style.emissive);
            }
            for (let k = 0; k < 2; k++) {
              const tipU = edgeU - end * (1.6 + k * 1.5);
              for (const side of [-1, 1]) {
                // arm from the tip back toward the street and out to the side
                const du = end * 0.55, dv = side * 0.55;
                const [mx, mz] = P(tipU + du, cV + dv);
                const [vx, vz] = P(du, dv);
                gb.append(new THREE.BoxGeometry(0.3, 0.04, 1.55), mat(mx, SIDEWALK_H + 0.05, mz, 1, 1, 1, Math.atan2(vx, vz)), chev, Style.emissive);
              }
            }
          }
        }
        // wall lanterns every 5 m on both sides (drawn only)
        const lantern = color(alley.covered ? '#bfe3ff' : '#ffc46b');
        const len = B - 2;
        for (let t = 2.5; t < len; t += 5) {
          for (const side of [-1, 1]) {
            const off = side * (W / 2 - 0.2);
            if (alley.axis === 'z') gb.box(cx + off - 0.15, SIDEWALK_H + 3.2, z0 + 1 + t - 0.2, cx + off + 0.15, SIDEWALK_H + 3.65, z0 + 1 + t + 0.2, lantern, Style.emissive);
            else gb.box(x0 + 1 + t - 0.2, SIDEWALK_H + 3.2, cz + off - 0.15, x0 + 1 + t + 0.2, SIDEWALK_H + 3.65, cz + off + 0.15, lantern, Style.emissive);
          }
        }
        if (alley.covered) {
          // a building bridged over the middle of the alley: 7 m clear underneath, lit ceiling
          const L = 8;
          const y0 = SIDEWALK_H + TUNNEL_CLEAR;
          const bx0 = alley.axis === 'z' ? cx - W / 2 - 0.6 : cx - L, bx1 = alley.axis === 'z' ? cx + W / 2 + 0.6 : cx + L;
          const bz0 = alley.axis === 'x' ? cz - W / 2 - 0.6 : cz - L, bz1 = alley.axis === 'x' ? cz + W / 2 + 0.6 : cz + L;
          const near = lotTops.filter((l) => l.x1 > bx0 - 1 && l.x0 < bx1 + 1 && l.z1 > bz0 - 1 && l.z0 < bz1 + 1).map((l) => l.top);
          const top = Math.max(y0 + 2 * FLOOR_H, Math.min(...(near.length ? near : [y0 + 2 * FLOOR_H])) - FLOOR_H);
          const wall = color(pick(rng, TOWER_WALLS), 0.4, rng);
          gb.box(bx0, y0, bz0, bx1, top, bz1, wall, Style.punched, Math.floor(rng() * 256) + 256 * 2, { floorH: FLOOR_H, bottom: true, vOffset: 2 });
          gb.box(bx0 - 0.1, y0 - 0.35, bz0 - 0.1, bx1 + 0.1, y0, bz1 + 0.1, color('#3c4650'), Style.plain, 0, { bottom: true });
          colliders.push({ minX: bx0, minY: y0 - 0.35, minZ: bz0, maxX: bx1, maxY: top, maxZ: bz1 });
          for (let t = -L + 1.5; t < L - 1; t += 3) {
            if (alley.axis === 'z') gb.box(cx - 1.6, y0 - 0.45, cz + t - 0.25, cx + 1.6, y0 - 0.35, cz + t + 0.25, lantern, Style.emissive);
            else gb.box(cx + t - 0.25, y0 - 0.45, cz - 1.6, cx + t + 0.25, y0 - 0.35, cz + 1.6, lantern, Style.emissive);
          }
          // entrance sign bands over both mouths of the bridge
          const sign = color('#e9c46a');
          if (alley.axis === 'z') { gb.box(bx0, y0, bz0 - 0.15, bx1, y0 + 0.8, bz0, sign, Style.emissive); gb.box(bx0, y0, bz1, bx1, y0 + 0.8, bz1 + 0.15, sign, Style.emissive); }
          else { gb.box(bx0 - 0.15, y0, bz0, bx0, y0 + 0.8, bz1, sign, Style.emissive); gb.box(bx1, y0, bz0, bx1 + 0.15, y0 + 0.8, bz1, sign, Style.emissive); }
        }
      }
      // boulevard paving inside the block, stepped in 2 m strips like the facades (the part on the street is one long strip)
      for (const c of cutsOf(x0, z0, x1, z1)) {
        const zr = cutZRanges([c]);
        for (let a = x0; a < x1 - 0.01; a += 2) {
          const b = Math.min(x1, a + 2);
          const [f0, f1] = zr(a, b)[0];
          const p0 = Math.max(z0, f0 + 0.6), p1 = Math.min(z1, f1 - 0.6);
          if (p1 - p0 > 0.2) gb.box(a, SIDEWALK_H, p0, b, SIDEWALK_H + 0.03, p1, color('#b0503a', 0.12, rng), Style.paving);
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
  // round 33: in pieces of at most 40 m, so the city's shadow pass can sort them into its slab (see shadowSlab)
  const edgeColor = color('#cbbfa9');
  const pieces = Math.ceil((2 * e + 4) / 40);
  for (let k = 0; k < pieces; k++) {
    const a = -e - 2 + ((2 * e + 4) * k) / pieces, b = -e - 2 + ((2 * e + 4) * (k + 1)) / pieces;
    gb.box(a, -1.5, -e - 2, b, 0.5, -e, edgeColor, Style.paving);
    gb.box(a, -1.5, e, b, 0.5, e + 2, edgeColor, Style.paving);
  }
  const piecesZ = Math.ceil((2 * e) / 40);
  for (let k = 0; k < piecesZ; k++) {
    const a = -e + (2 * e * k) / piecesZ, b = -e + (2 * e * (k + 1)) / piecesZ;
    gb.box(-e - 2, -1.5, a, -e, 0.5, b, edgeColor, Style.paving);
    gb.box(e, -1.5, a, e + 2, 0.5, b, edgeColor, Style.paving);
  }

  // Round 18: keep alley mouths and the diagonal free of trees, lamp posts and other soft props.
  const inDiag = (x: number, z: number) => boulevards.some((b) => Math.abs(z - b.s * x - b.c) / Math.SQRT2 < b.halfWidth + 1.6);
  const blockedXZ = (x: number, z: number) => inDiag(x, z) || clearRects.some(([a, b, c, d]) => x > a && x < c && z > b && z < d);
  const keepTrees = trees.filter((t) => !blockedXZ(t.x, t.z));
  const keepLamps = lamps.filter((l) => !blockedXZ(l.x, l.z));
  const keepColliders = colliders.filter((b) => !b.soft || !blockedXZ((b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2));
  // round 28: street furniture along the curbs (no rng draws, so the rest of the city is unchanged)
  const props = placeStreetProps(blocks, B, R, half, special, sites, keepLamps, keepTrees, blockedXZ);

  const features: CityFeature[] = [];
  for (const b of boulevards) {
    const st = boulevardStops(b, roadCenters);
    const L = Math.hypot(st[st.length - 1].x - st[0].x, st[st.length - 1].z - st[0].z);
    features.push({ kind: 'diagonal', name: b.name, x: (st[0].x + st[st.length - 1].x) / 2, z: (st[0].z + st[st.length - 1].z) / 2, length: Math.round(L) });
    // the street part of the paving: one long strip under the sidewalks, crossed by light stone bands
    const ry = Math.atan2(1, b.s);
    const cx = (st[0].x + st[st.length - 1].x) / 2, cz = (st[0].z + st[st.length - 1].z) / 2;
    gb.append(new THREE.BoxGeometry(b.halfWidth * 2 - 1.2, 0.04, L), mat(cx, 0.02, cz, 1, 1, 1, ry), color('#a5503d'), Style.paving);
    for (let t = -L / 2 + 2; t < L / 2 - 1; t += 4.5) {
      const x = cx + Math.sin(ry) * t, z = cz + Math.cos(ry) * t;
      const onBlock = ((x + half) % (B + R)) > R && ((z + half) % (B + R)) > R;
      // round 23: where it crosses a block (people stroll there) it reads as a promenade: light stone bands across the
      // paving instead of a road-style centre line; the amber dashes stay only where it crosses a road
      // round 24: no centre line at all any more (the emissive amber dashes on the road crossings bloomed to a white
      // lane line where people walk). Road crossings get the same stone bands, so the whole diagonal reads as a walk.
      gb.append(new THREE.BoxGeometry(b.halfWidth * 2 - 2.6, 0.05, 0.55), mat(x, onBlock ? SIDEWALK_H + 0.035 : 0.05, z, 1, 1, 1, ry), color('#e2c9a6'), Style.paving);
    }
  }
  for (const al of alleys) {
    features.push({ kind: al.covered ? 'tunnel' : 'alley', name: al.name, x: roadCenters[al.bi] + R / 2 + B / 2, z: roadCenters[al.bj] + R / 2 + B / 2, length: B + R });
  }

  return {
    features,
    alleys,
    boulevards,
    rushLanes,
    graph: buildStreetGraph(roadCenters, B, R, alleys, boulevards, true),
    gridGraph: buildStreetGraph(roadCenters, B, R, alleys, boulevards, false),
    blocks,
    blockSize: B,
    roadWidth: R,
    half,
    roadCenters,
    colliders: keepColliders,
    sites,
    trees: keepTrees,
    lamps: keepLamps,
    awnings,
    geometry: gb.build(),
    buildingCount,
    buildings: SPECS,
    props,
    shopFronts: SHOP_BAYS,
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
  x0: number, z0: number, x1: number, z1: number, down: number, edges: Edges, awnings: Box[] = [], minFloors = 1,
): { padRoof: THREE.Vector3 | null; tall: boolean; top: number } {
  const w = x1 - x0;
  const d = z1 - z0;
  // height distribution: tall downtown, low at the edges
  const maxFloors = Math.round(3 + down * down * 21);
  let floors = Math.max(minFloors, Math.round(range(rng, 0.35, 1) * maxFloors));
  if (chance(rng, 0.08)) floors += randInt(rng, 2, 6);
  const tall = floors >= 11;
  const y0 = SIDEWALK_H;
  let seed = Math.floor(rng() * 256);

  let style: number;
  if (tall) style = pick(rng, [Style.ribbon, Style.curtain, Style.ribbon, Style.punched]);
  else if (floors >= 5) style = pick(rng, [Style.punched, Style.tall, Style.ribbon, Style.tall]);
  else style = pick(rng, [Style.punched, Style.tall, Style.tall]);

  const wall = color(pick(rng, tall ? TOWER_WALLS : WALLS), 0.5, rng);
  const trim = color(pick(rng, TRIM), 0.2, rng);
  const inset = tall ? 0.6 : range(rng, 0.0, 0.5);
  const bx0 = x0 + inset, bz0 = z0 + inset, bx1 = x1 - inset, bz1 = z1 - inset;
  // round 28: the seed also picks the shop fronts' signs and door colours (per bay, in the shader). Step it (no rng draw)
  // until no bay on a street face matches its neighbour bay on the next building in sign or door colour.
  const shopFaces = style <= Style.tall ? shopFacesOf(bx0, bz0, bx1, bz1, edges) : [];
  if (shopFaces.length) seed = pickShopSeed(seed, shopFaces);

  const gabled = floors <= 4 && chance(rng, 0.6);
  let top = y0 + floors * FLOOR_H;
  const baseTop = top;
  // round 27: archetype and wall material from the lot position (no rng draw)
  const arch = archetypeOf(style, floors, tall, gabled, lotHash(x0, z0, 1));
  const mseed = seed + 256 * MATERIAL[arch];
  const c0 = colliders.length;

  // plinth / ground floor band in trim colour for character
  gb.box(bx0, y0, bz0, bx1, top, bz1, wall, style, mseed, { floorH: FLOOR_H, colW: style === Style.curtain ? 3.2 : 2.7 });
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
  let awnOff = -1;
  if (!tall && chance(rng, 0.65)) {
    void color(pick(rng, AWNINGS), 0.3, rng); // round 28: the old single colour draw, kept so the city's random stream is unchanged
    const ay = y0 + 2.5;
    // round 15: awnings reach 0.5 m (was 1.1 m) so they never hang over a doorstep pad 1.5 m out from the lot edge
    const ad = AWNING_DEPTH;
    const boxes: Box[] = [];
    if (edges.edgeN) boxes.push({ minX: bx0 + 0.8, minY: ay, minZ: bz0 - ad, maxX: bx1 - 0.8, maxY: ay + 0.35, maxZ: bz0 });
    if (edges.edgeS) boxes.push({ minX: bx0 + 0.8, minY: ay, minZ: bz1, maxX: bx1 - 0.8, maxY: ay + 0.35, maxZ: bz1 + ad });
    if (edges.edgeW) boxes.push({ minX: bx0 - ad, minY: ay, minZ: bz0 + 0.8, maxX: bx0, maxY: ay + 0.35, maxZ: bz1 - 0.8 });
    if (edges.edgeE) boxes.push({ minX: bx1, minY: ay, minZ: bz0 + 0.8, maxX: bx1 + ad, maxY: ay + 0.35, maxZ: bz1 - 0.8 });
    // round 28: one awning colour per shop bay, stepping through the palette so neighbours never match
    awnOff = pickAwningOffset(shopFaces, lotHash(bx0, bz0, 5));
    for (const b of boxes) {
      // round 27: a sloped, striped awning with a valance, inside the same box (the pad audit keeps the box)
      const face = shopFaces.find((f) => boxOnFace(b, f));
      if (face && style <= Style.tall) {
        for (const bay of face.bays) {
          const lo = Math.max(bay.lo, face.axis === 'x' ? b.minX : b.minZ), hi = Math.min(bay.hi, face.axis === 'x' ? b.maxX : b.maxZ);
          if (hi - lo < 0.3) continue;
          const seg: Box = face.axis === 'x' ? { ...b, minX: lo, maxX: hi } : { ...b, minZ: lo, maxZ: hi };
          const k = awningIndex(awnOff, bay.k);
          awningShape(gb, seg, edges, bx0, bz0, bx1, bz1, color(AWNINGS[k]), k);
        }
      } else {
        const k = awningIndex(Math.max(0, awnOff), 0);
        awningShape(gb, b, edges, bx0, bz0, bx1, bz1, color(AWNINGS[k]), k);
      }
      awnings.push(b);
    }
  }
  if (shopFaces.length) registerShopFaces(shopFaces, seed, awnOff);

  let roofX0 = bx0, roofZ0 = bz0, roofX1 = bx1, roofZ1 = bz1;

  if (tall && chance(rng, 0.55) && w > 12 && d > 12) {
    // setback upper tier
    const extra = randInt(rng, 3, Math.max(4, Math.round(floors * 0.5)));
    const s = range(rng, 1.8, 3.2);
    const ux0 = bx0 + s, uz0 = bz0 + s, ux1 = bx1 - s, uz1 = bz1 - s;
    cornice(gb, bx0, bz0, bx1, bz1, top, trim, colliders);
    gb.box(ux0, top, uz0, ux1, top + extra * FLOOR_H, uz1, wall, style, ((seed + 7) % 256) + 256 * MATERIAL[arch], { floorH: FLOOR_H, vOffset: floors, colW: style === Style.curtain ? 3.2 : 2.7 });
    SPECS?.push({ x0: ux0, z0: uz0, x1: ux1, z1: uz1, y0: top, top: top + extra * FLOOR_H, floors: extra, style, arch, edges: { edgeW: false, edgeE: false, edgeN: false, edgeS: false }, tier: true, gabled: false, padRoof: null, roof: null, wall: wall.clone(), trim: trim.clone(), vOffset: floors, colliders: [] });
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
    SPECS?.push({ x0: bx0, z0: bz0, x1: bx1, z1: bz1, y0, top: baseTop, floors, style, arch, edges, tier: false, gabled: true, padRoof: null, roof: null, wall: wall.clone(), trim: trim.clone(), vOffset: 0, colliders: colliders.slice(c0) });
    return { padRoof: null, tall, top: baseTop };
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
  SPECS?.push({ x0: bx0, z0: bz0, x1: bx1, z1: bz1, y0, top: baseTop, floors, style, arch, edges, tier: roofX0 !== bx0, gabled: false, padRoof, roof: { x0: roofX0, z0: roofZ0, x1: roofX1, z1: roofZ1, top }, wall: wall.clone(), trim: trim.clone(), vOffset: 0, colliders: colliders.slice(c0) });
  return { padRoof, tall, top: baseTop };
}

/**
 * Round 18: a lot cut by the diagonal avenue. Built as 2 m strips across x; each strip keeps the parts of the lot
 * outside the avenue's corridor, so the facade steps along the diagonal (walls on both sides of the avenue, marked
 * `facade` so the slipstream counts these narrow strips as building faces).
 */
function addCutBuilding(
  gb: GeometryBuilder, colliders: Box[], rng: Rng, x0: number, z0: number, x1: number, z1: number, down: number,
  corridor: (a: number, b: number) => Array<[number, number]>, minFloors = 2,
): number {
  const maxFloors = Math.round(3 + down * down * 21);
  const floors = Math.max(minFloors, Math.min(12, Math.round(range(rng, 0.4, 1) * maxFloors)));
  const y0 = SIDEWALK_H;
  const top = y0 + floors * FLOOR_H;
  const seed = Math.floor(rng() * 256);
  const wall = color(pick(rng, WALLS), 0.5, rng);
  const trim = color(pick(rng, TRIM), 0.2, rng);
  const style = pick(rng, [Style.punched, Style.tall, Style.ribbon]);
  const step = 2;
  const cmat = MATERIAL[archetypeOf(style, floors, false, false, lotHash(x0, z0, 1))];
  for (let a = x0; a < x1 - 0.01; a += step) {
    const b = Math.min(x1, a + step);
    let parts: Array<[number, number]> = [[z0, z1]];
    for (const [f0, f1] of corridor(a, b)) {
      const next: Array<[number, number]> = [];
      for (const [p0, p1] of parts) {
        if (f1 <= p0 || f0 >= p1) { next.push([p0, p1]); continue; }
        if (f0 > p0 + 1) next.push([p0, f0]);
        if (f1 < p1 - 1) next.push([f1, p1]);
      }
      parts = next;
    }
    for (const [pz0, pz1] of parts) {
      if (pz1 - pz0 < 1) continue;
      gb.box(a, y0, pz0, b, top, pz1, wall, style, seed + 256 * cmat, { floorH: FLOOR_H, colW: 2 });
      gb.box(a - 0.05, top, pz0 - 0.05, b + 0.05, top + 0.45, pz1 + 0.05, trim, Style.plain);
      colliders.push({ minX: a, minY: 0, minZ: pz0, maxX: b, maxY: top + 0.45, maxZ: pz1, facade: true });
    }
  }
  return top;
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

/** Round 27: the detail kit's building list for the city being generated (null outside generateCity). */
let SPECS: BuildingSpec[] | null = null;
let SHOP_BAYS: ShopBay[] = [];

// ------------------------------------------------------------------------------------------------------------------
// Round 28: shop-front variety. The facade shader draws one sign and one door per bay (two window columns) of a ground
// floor shop front: sign = (seed + bay) mod 8 (7 is a home entrance), door colour = (3 seed + 3 bay) mod 7. Within a
// building neighbouring bays always differ; across buildings the seed is stepped until the touching bays differ too.
// ------------------------------------------------------------------------------------------------------------------
type ShopFace = { axis: 'x' | 'z'; n: number; line: number; bays: Array<{ k: number; lo: number; hi: number }> };
export const shopSign = (sd: number, k: number) => (sd + k) % 8;
export const shopDoor = (sd: number, k: number) => (sd * 3 + k * 3) % 7;
const awningIndex = (off: number, k: number) => (off + 2 * k) % 7;

function shopFacesOf(bx0: number, bz0: number, bx1: number, bz1: number, edges: Edges): ShopFace[] {
  const out: ShopFace[] = [];
  const face = (axis: 'x' | 'z', n: number, line: number, a: number, b: number, fromHigh: boolean) => {
    const w = b - a, cols = Math.max(1, Math.round(w / 2.7)), cw = w / cols;
    const bays: ShopFace['bays'] = [];
    for (let k = 0; k * 2 < cols; k++) {
      const s0 = 2 * k * cw, s1 = Math.min(w, (2 * k + 2) * cw);
      bays.push(fromHigh ? { k, lo: b - s1, hi: b - s0 } : { k, lo: a + s0, hi: a + s1 });
    }
    out.push({ axis, n, line, bays });
  };
  // the facade u runs from maxX on north faces, from minX on south faces, from minZ on west faces, from maxZ on east faces
  if (edges.edgeN) face('x', -1, bz0, bx0, bx1, true);
  if (edges.edgeS) face('x', 1, bz1, bx0, bx1, false);
  if (edges.edgeW) face('z', -1, bx0, bz0, bz1, false);
  if (edges.edgeE) face('z', 1, bx1, bz0, bz1, true);
  return out;
}
function neighbours(f: ShopFace, bay: { lo: number; hi: number }): ShopBay[] {
  return SHOP_BAYS.filter((o) => o.axis === f.axis && o.n === f.n && Math.abs(o.line - f.line) < 2.5
    && Math.max(o.lo, bay.lo) - Math.min(o.hi, bay.hi) > -0.5 && Math.max(o.lo, bay.lo) - Math.min(o.hi, bay.hi) < 4);
}
function pickShopSeed(seed: number, faces: ShopFace[]): number {
  for (let i = 0; i < 256; i++) {
    const sd = (seed + i) % 256;
    const ok = faces.every((f) => f.bays.every((b) => neighbours(f, b).every((o) => o.sign !== shopSign(sd, b.k) && o.door !== shopDoor(sd, b.k))));
    if (ok) return sd;
  }
  return seed;
}
function pickAwningOffset(faces: ShopFace[], h: number): number {
  const base = Math.floor(h * 7);
  for (let i = 0; i < 7; i++) {
    const off = (base + i) % 7;
    if (faces.every((f) => f.bays.every((b) => neighbours(f, b).every((o) => o.awn !== awningIndex(off, b.k))))) return off;
  }
  return base;
}
function registerShopFaces(faces: ShopFace[], sd: number, awnOff: number): void {
  for (const f of faces) for (const b of f.bays) {
    SHOP_BAYS.push({ axis: f.axis, n: f.n, line: f.line, lo: b.lo, hi: b.hi, k: b.k, sign: shopSign(sd, b.k), door: shopDoor(sd, b.k), awn: awnOff < 0 ? -1 : awningIndex(awnOff, b.k) });
  }
}
function boxOnFace(b: Box, f: ShopFace): boolean {
  if (f.axis === 'x') return Math.abs((f.n < 0 ? b.maxZ : b.minZ) - f.line) < 1e-3;
  return Math.abs((f.n < 0 ? b.maxX : b.minX) - f.line) < 1e-3;
}

// ------------------------------------------------------------------------------------------------------------------
// Round 28: street furniture. Slots every 3.4 m along each curb (0.45 to 1.0 m in from it, the strip the lamps and
// trees use), kinds picked by a position hash. Never on pads (any ground site, plus 1.8 m), alley mouths, tunnel
// arches or the diagonal (the same clear zones as the trees), never on a road, and clear of lamps and trunks.
// ------------------------------------------------------------------------------------------------------------------
function placeStreetProps(
  blocks: number, B: number, R: number, half: number, special: Map<string, 'park' | 'depot'>, sites: Site[],
  lamps: LampSpec[], trees: TreeSpec[], blockedXZ: (x: number, z: number) => boolean,
): PropSpec[] {
  const out: PropSpec[] = [];
  const pads = sites.filter((s) => s.pos.y < 4);
  const clear = (x: number, z: number, r: number) =>
    !blockedXZ(x, z)
    && pads.every((p) => Math.hypot(p.pos.x - x, p.pos.z - z) > p.radius + 1.8 + r)
    && lamps.every((l) => Math.hypot(l.x - x, l.z - z) > 1.2 + r)
    && trees.every((t) => Math.hypot(t.x - x, t.z - z) > 1.5 + r);
  const y = SIDEWALK_H;
  for (let bi = 0; bi < blocks; bi++) for (let bj = 0; bj < blocks; bj++) {
    const x0 = -half + R + bi * (B + R), z0 = -half + R + bj * (B + R), x1 = x0 + B, z1 = z0 + B;
    const type = special.get(`${bi},${bj}`);
    // edges: start point, direction along the curb, inward normal, rotation of an object lying along the curb
    const edges: Array<{ ax: number; az: number; dx: number; dz: number; nx: number; nz: number; rot: number; skip: boolean }> = [
      { ax: x0, az: z0, dx: 1, dz: 0, nx: 0, nz: 1, rot: 0, skip: type === 'depot' },
      { ax: x0, az: z1, dx: 1, dz: 0, nx: 0, nz: -1, rot: Math.PI, skip: false },
      { ax: x0, az: z0, dx: 0, dz: 1, nx: 1, nz: 0, rot: -Math.PI / 2, skip: false },
      { ax: x1, az: z0, dx: 0, dz: 1, nx: -1, nz: 0, rot: Math.PI / 2, skip: false },
    ];
    const busEdge = Math.floor(lotHash(x0, z0, 31) * 6); // 0..3: this edge has a bus stop; 4, 5: none
    edges.forEach((e, ei) => {
      if (e.skip) return;
      const at = (t: number, d: number) => ({ x: e.ax + e.dx * t + e.nx * d, z: e.az + e.dz * t + e.nz * d });
      // bollards at both corners, just inside the crossing
      for (const t of [2.3, 3.2, B - 3.2, B - 2.3]) {
        const p = at(t, 0.42);
        if (clear(p.x, p.z, 0.15)) out.push({ kind: PROP.bollard, x: p.x, y, z: p.z, rot: e.rot });
      }
      let hydrants = 0;
      for (let t = 4.8, slot = 0; t <= B - 4.8; t += 2.8, slot++) {
        const h = lotHash(e.ax + e.dx * t, e.az + e.dz * t, 17 + ei);
        if (ei === busEdge && slot === 3) {
          const p = at(t, 0.55), q = at(t + 1.4, 0.95);
          if (clear(p.x, p.z, 0.3) && clear(q.x, q.z, 0.9)) {
            out.push({ kind: PROP.busstop, x: p.x, y, z: p.z, rot: e.rot });
            out.push({ kind: PROP.bench, x: q.x, y, z: q.z, rot: e.rot });
            continue;
          }
        }
        if (h < 0.15) { const p = at(t, 0.95); if (clear(p.x, p.z, 0.9)) out.push({ kind: PROP.bench, x: p.x, y, z: p.z, rot: e.rot }); }
        else if (h < 0.33) { const p = at(t, 0.6); if (clear(p.x, p.z, 0.3)) out.push({ kind: PROP.bin, x: p.x, y, z: p.z, rot: e.rot + h * 9 }); }
        else if (h < 0.43) {
          const p = at(t, 0.5);
          if (hydrants < 1 && clear(p.x, p.z, 0.25)) { out.push({ kind: PROP.hydrant, x: p.x, y, z: p.z, rot: e.rot + h * 20 }); hydrants++; }
        } else if (h < 0.57) { const p = at(t, 0.8); if (clear(p.x, p.z, 0.45)) out.push({ kind: PROP.planter, x: p.x, y, z: p.z, rot: h * 30 }); }
        else if (h < 0.68) { const p = at(t, 0.62); if (clear(p.x, p.z, 0.9)) out.push({ kind: PROP.bikerack, x: p.x, y, z: p.z, rot: e.rot }); }
        else if (h < 0.8 && type !== 'park') {
          // a cafe table with a chair either side (along the curb, so the walkers' strip stays clear)
          const p = at(t, 1.0);
          if (clear(p.x, p.z, 1.0)) {
            out.push({ kind: PROP.table, x: p.x, y, z: p.z, rot: h * 40 });
            for (const sgn of [-1, 1]) {
              const c = at(t + sgn * 0.75, 1.0);
              out.push({ kind: PROP.chair, x: c.x, y, z: c.z, rot: e.rot + (sgn < 0 ? Math.PI / 2 : -Math.PI / 2) });
            }
          }
        } else if (h < 0.9 && type !== 'park') { const p = at(t, 0.9); if (clear(p.x, p.z, 0.4)) out.push({ kind: PROP.aboard, x: p.x, y, z: p.z, rot: e.rot + Math.PI / 2 }); }
        else { const p = at(t, 0.6); if (clear(p.x, p.z, 0.3)) out.push({ kind: PROP.bin, x: p.x, y, z: p.z, rot: e.rot + h * 9 }); }
      }
    });
  }
  return out;
}

/** Round 27: wall material per archetype, read by the city shader (0 plaster, 1 brick, 2 concrete, 3 stone, 4 metal and glass). */
const MATERIAL: Record<Archetype, number> = { townhouse: 0, walkup: 1, apartments: 2, classic: 3, office: 4, glass: 4 };

/** Round 27: a building's archetype from its window style, height and a lot hash (h in 0..1). */
function archetypeOf(style: number, floors: number, tall: boolean, gabled: boolean, h: number): Archetype {
  if (style === Style.curtain) return 'glass';
  if (tall) return style === Style.ribbon ? (h < 0.6 ? 'office' : 'apartments') : h < 0.5 ? 'classic' : 'apartments';
  if (style === Style.ribbon) return h < 0.5 ? 'office' : 'apartments';
  if (gabled) return h < 0.35 ? 'walkup' : 'townhouse';
  if (style === Style.tall) return h < 0.3 ? 'walkup' : h < 0.75 ? 'townhouse' : 'apartments';
  // punched windows
  if (floors >= 5) return h < 0.45 ? 'walkup' : h < 0.75 ? 'classic' : 'apartments';
  return h < 0.55 ? 'walkup' : h < 0.8 ? 'townhouse' : 'classic';
}

/** Round 27: a sloped awning with a striped canopy and a valance, filling the given box (wall side high, street side low). */
function awningShape(gb: GeometryBuilder, b: Box, edges: Edges, bx0: number, bz0: number, bx1: number, bz1: number, c: THREE.Color, sd = 0): void {
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const val = 0.16;
  // outward axis: which face the box sits on
  const onN = b.maxZ <= bz0 + 1e-3, onS = b.minZ >= bz1 - 1e-3, onW = b.maxX <= bx0 + 1e-3;
  void edges; void bx1;
  const yTop = b.maxY, yLow = b.minY + val;
  let wallA: THREE.Vector3, wallB: THREE.Vector3, outA: THREE.Vector3, outB: THREE.Vector3, len: number;
  if (onN || onS) {
    const zw = onN ? b.maxZ : b.minZ, zo = onN ? b.minZ : b.maxZ;
    wallA = V(b.minX, yTop, zw); wallB = V(b.maxX, yTop, zw); outA = V(b.minX, yLow, zo); outB = V(b.maxX, yLow, zo); len = b.maxX - b.minX;
  } else {
    const xw = onW ? b.maxX : b.minX, xo = onW ? b.minX : b.maxX;
    wallA = V(xw, yTop, b.minZ); wallB = V(xw, yTop, b.maxZ); outA = V(xo, yLow, b.minZ); outB = V(xo, yLow, b.maxZ); len = b.maxZ - b.minZ;
  }
  const st = len / 0.5;
  // canopy (both windings so it shows from above and below)
  gb.tri(wallA, outA, outB, c, Style.awning, sd, [[0, 0], [0, 0], [st, 0]]);
  gb.tri(wallA, outB, wallB, c, Style.awning, sd, [[0, 0], [st, 0], [st, 0]]);
  gb.tri(wallA, outB, outA, c, Style.awning, sd, [[0, 0], [st, 0], [0, 0]]);
  gb.tri(wallA, wallB, outB, c, Style.awning, sd, [[0, 0], [st, 0], [st, 0]]);
  // valance
  const dA = outA.clone().setY(b.minY), dB = outB.clone().setY(b.minY);
  gb.tri(outA, dA, dB, c, Style.awning, sd, [[0, 1], [0, 1], [st, 1]]);
  gb.tri(outA, dB, outB, c, Style.awning, sd, [[0, 1], [st, 1], [st, 1]]);
  gb.tri(outA, dB, dA, c, Style.awning, sd, [[0, 1], [st, 1], [0, 1]]);
  gb.tri(outA, outB, dB, c, Style.awning, sd, [[0, 1], [st, 1], [st, 1]]);
}
