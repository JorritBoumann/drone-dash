import { createSeededRandom, pick, randInt, type Rng } from '../core/random';

/**
 * Round 18: city features that make route choice. On a plain grid every monotone route between two points has the same
 * length, so every leg plays the same. Each city now gets, from its seed (its own random stream, so `?seed=N` stays
 * deterministic):
 * - four **diagonal boulevards** across the city (two each way, a diamond), clipping block corners (stepped facades),
 * - **alleys**: 6 to 7 m passages through some blocks, straight through the middle or corner to corner (stepped walls),
 *   walls on both sides (tight, draftable, a little risky),
 * - **tunnels**: alleys with a building bridged over the middle, 7 m clear (fly under it).
 * Plus two **rush lanes** (one street each way) that light up and fill with hover-vans at rush hour.
 * None of them block a street: they only open new ways through blocks, so a pure grid route still works everywhere.
 */
export type FeatureKind = 'diagonal' | 'alley' | 'tunnel';
/** axis 'x' / 'z': straight through the middle of the block; 'd+' / 'd-': corner to corner (z grows / falls with x). */
export type Alley = { bi: number; bj: number; axis: 'x' | 'z' | 'd+' | 'd-'; covered: boolean; name: string; width: number };
export type RushLane = { axis: 0 | 1; index: number };

const DIAG_NAMES = ['Kestrel Boulevard', 'Old Tram Way', 'Copper Diagonal', 'Harbor Slant', 'Union Cut', 'Lumen Parade'];
const ALLEY_NAMES = ['Lantern Alley', 'Tinker Lane', 'Cobble Row', 'Paper Lane', 'Ginger Alley', 'Kite Lane', 'Tailor Row', 'Ink Alley', 'Bell Lane', 'Mint Alley', 'Plum Row', 'Rope Lane'];
const TUNNEL_NAMES = ['Arcade Tunnel', 'Clock Tunnel', 'Gallery Tunnel', 'Market Tunnel', 'Echo Tunnel', 'Station Tunnel'];

export const ALLEY_WIDTH = 6;
export const TUNNEL_CLEAR = 7; // m above the sidewalk
export const DIAG_HALF = 5; // corridor half width (10 m wall to wall)
export const DIAG_ALLEY_HALF = 3.6; // corner-to-corner alley half width (7.2 m wall to wall)

/** Feature stream: a hash of the seed, separate from the layout stream. */
export function featureRng(seed: number): Rng {
  let h = Math.imul((seed ^ 0x5bd1e995) >>> 0, 0x27d4eb2d) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  return createSeededRandom(h);
}

/**
 * Round 18: diagonal boulevards. Straight 45-degree avenues across the whole city, rising and falling, so they
 * cross in a diamond (two each way, 88 m apart). Each runs through the middle of the street segments it crosses (z = s x + c, c = 22 mod 44), where
 * the doorsteps are, and clips one corner of every block on its way (stepped facades). Shops on the corners stay.
 */
export type Boulevard = { s: 1 | -1; c: number; name: string; halfWidth: number };
export function planBoulevards(rng: Rng): Boulevard[] {
  const names = DIAG_NAMES.slice();
  const out: Boulevard[] = [];
  for (const sgn of [1, -1] as const) {
    const c1 = pick(rng, [-66, -22, 22, 66]);
    const c2 = c1 + (c1 > 0 ? -88 : 88);
    for (const c of [c1, c2]) {
      const k = randInt(rng, 0, names.length - 1);
      out.push({ s: sgn, c, name: names.splice(k, 1)[0], halfWidth: DIAG_HALF });
    }
  }
  return out;
}

/** Road crossings of a boulevard (sorted along it), inside the city. */
export function boulevardStops(b: Boulevard, roadCenters: number[]): Array<{ x: number; z: number }> {
  const lim = roadCenters[roadCenters.length - 1] + 0.01;
  const pts = new Map<string, { x: number; z: number }>();
  for (const x of roadCenters) { const z = b.s * x + b.c; if (Math.abs(z) <= lim) pts.set(`${x},${z}`, { x, z }); }
  for (const z of roadCenters) { const x = (z - b.c) * b.s; if (Math.abs(x) <= lim) pts.set(`${x},${z}`, { x, z }); }
  return [...pts.values()].sort((p, q) => p.x - q.x);
}

/** Alleys and tunnels in ordinary blocks (not parks, depots or the diagonal's blocks). */
export function planAlleys(rng: Rng, blocks: number, blocked: Set<string>): Alley[] {
  const alleys: Alley[] = [];
  let a = randInt(rng, 0, ALLEY_NAMES.length - 1), t = randInt(rng, 0, TUNNEL_NAMES.length - 1);
  const c = (blocks - 1) / 2;
  for (let bi = 0; bi < blocks; bi++) {
    for (let bj = 0; bj < blocks; bj++) {
      if (blocked.has(`${bi},${bj}`)) { rng(); rng(); rng(); continue; }
      const roll = rng(), axisRoll = rng(), coverRoll = rng();
      if (roll > 0.4) continue;
      const central = Math.hypot(bi - c, bj - c) < 2.6;
      const covered = central && coverRoll < 0.4;
      alleys.push({
        bi, bj, axis: axisRoll < 0.5 ? 'x' : 'z', covered, width: true ? ALLEY_WIDTH : DIAG_ALLEY_HALF * 2,
        name: covered ? TUNNEL_NAMES[t++ % TUNNEL_NAMES.length] : ALLEY_NAMES[a++ % ALLEY_NAMES.length],
      });
    }
  }
  return alleys;
}

export function planRushLanes(rng: Rng, blocks: number): RushLane[] {
  // inner streets only (index 1..blocks-1), one along x and one along z
  return [{ axis: 0, index: randInt(rng, 1, blocks - 1) }, { axis: 1, index: randInt(rng, 1, blocks - 1) }];
}

// ---------------------------------------------------------------------------------------------------------------------
// Street graph: roads, alleys and the diagonal as centre lines. Used by the route hook (bots, probes) and diagnostics.
// ---------------------------------------------------------------------------------------------------------------------

export type EdgeKind = 'road' | FeatureKind;
export type GEdge = { a: number; b: number; ax: number; az: number; bx: number; bz: number; len: number; kind: EdgeKind; name: string };
export type StreetGraph = { nodes: Array<{ x: number; z: number }>; edges: GEdge[] };
export type RoutePoint = { x: number; z: number; kind: EdgeKind; name: string };
export type Route = { length: number; points: RoutePoint[]; kinds: FeatureKind[]; names: string[] };

export function buildStreetGraph(roadCenters: number[], blockSize: number, roadWidth: number, alleys: Alley[], boulevards: Boulevard[], withFeatures: boolean): StreetGraph {
  const nodes: Array<{ x: number; z: number }> = [];
  const edges: GEdge[] = [];
  const key = new Map<string, number>();
  const node = (x: number, z: number) => {
    const k = `${x.toFixed(2)},${z.toFixed(2)}`;
    let i = key.get(k);
    if (i === undefined) { i = nodes.length; nodes.push({ x, z }); key.set(k, i); }
    return i;
  };
  const edge = (i: number, j: number, kind: EdgeKind, name: string) => {
    const A = nodes[i], B = nodes[j];
    edges.push({ a: i, b: j, ax: A.x, az: A.z, bx: B.x, bz: B.z, len: Math.hypot(B.x - A.x, B.z - A.z), kind, name });
  };
  const n = roadCenters.length;
  // stops along each road line: intersections plus alley mouths
  const alongX = new Map<number, number[]>(); // road at z = Z_j runs along x: list of x stops
  const alongZ = new Map<number, number[]>(); // road at x = X_i runs along z: list of z stops
  for (let j = 0; j < n; j++) alongX.set(j, roadCenters.slice());
  for (let i = 0; i < n; i++) alongZ.set(i, roadCenters.slice());
  if (withFeatures) {
    for (const al of alleys) {
      const cx = roadCenters[al.bi] + roadWidth / 2 + blockSize / 2;
      const cz = roadCenters[al.bj] + roadWidth / 2 + blockSize / 2;
      if (al.axis === 'd+' || al.axis === 'd-') continue;
      if (al.axis === 'z') { alongX.get(al.bj)!.push(cx); alongX.get(al.bj + 1)!.push(cx); }
      else { alongZ.get(al.bi)!.push(cz); alongZ.get(al.bi + 1)!.push(cz); }
    }
    for (const b of boulevards) {
      for (const p of boulevardStops(b, roadCenters)) {
        const j = roadCenters.indexOf(p.z), i = roadCenters.indexOf(p.x);
        if (j >= 0) alongX.get(j)!.push(p.x);
        if (i >= 0) alongZ.get(i)!.push(p.z);
      }
    }
  }
  for (let j = 0; j < n; j++) {
    const xs = [...new Set(alongX.get(j)!)].sort((p, q) => p - q);
    for (let s = 0; s + 1 < xs.length; s++) edge(node(xs[s], roadCenters[j]), node(xs[s + 1], roadCenters[j]), 'road', '');
  }
  for (let i = 0; i < n; i++) {
    const zs = [...new Set(alongZ.get(i)!)].sort((p, q) => p - q);
    for (let s = 0; s + 1 < zs.length; s++) edge(node(roadCenters[i], zs[s]), node(roadCenters[i], zs[s + 1]), 'road', '');
  }
  if (withFeatures) {
    for (const al of alleys) {
      const cx = roadCenters[al.bi] + roadWidth / 2 + blockSize / 2;
      const cz = roadCenters[al.bj] + roadWidth / 2 + blockSize / 2;
      const kind: EdgeKind = al.covered ? 'tunnel' : 'alley';
      if (al.axis === 'd+') edge(node(roadCenters[al.bi], roadCenters[al.bj]), node(roadCenters[al.bi + 1], roadCenters[al.bj + 1]), kind, al.name);
      else if (al.axis === 'd-') edge(node(roadCenters[al.bi], roadCenters[al.bj + 1]), node(roadCenters[al.bi + 1], roadCenters[al.bj]), kind, al.name);
      else if (al.axis === 'z') edge(node(cx, roadCenters[al.bj]), node(cx, roadCenters[al.bj + 1]), kind, al.name);
      else edge(node(roadCenters[al.bi], cz), node(roadCenters[al.bi + 1], cz), kind, al.name);
    }
    for (const b of boulevards) {
      const st = boulevardStops(b, roadCenters);
      for (let k = 0; k + 1 < st.length; k++) edge(node(st[k].x, st[k].z), node(st[k + 1].x, st[k + 1].z), 'diagonal', b.name);
    }
  }
  return { nodes, edges };
}

function closestOnEdge(e: GEdge, x: number, z: number): { t: number; x: number; z: number; d: number } {
  const dx = e.bx - e.ax, dz = e.bz - e.az;
  const L2 = dx * dx + dz * dz;
  const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - e.ax) * dx + (z - e.az) * dz) / L2)) : 0;
  const px = e.ax + dx * t, pz = e.az + dz * t;
  return { t, x: px, z: pz, d: Math.hypot(x - px, z - pz) };
}

/**
 * Shortest route on the graph from (fx, fz) to (tx, tz). Each end joins the network at the nearest points of its
 * closest edges (straight-line cost to get there, so a rooftop or doorstep joins its own street). Returns the route
 * length and the corner points (with the kind of edge that leads to each point).
 */
export function routeOnGraph(g: StreetGraph, fx: number, fz: number, tx: number, tz: number, narrowPenalty = 0): Route {
  // join at the nearest edges (within 3 m of the nearest), plus the nearest road edges, so a feature can only add
  // options to the plain grid route, never take one away
  const attach = (x: number, z: number) => {
    const all = g.edges.map((e, i) => ({ i, ...closestOnEdge(e, x, z) })).sort((p, q) => p.d - q.d);
    const d0 = all[0].d;
    const r0 = all.find((c) => g.edges[c.i].kind === 'road')?.d ?? d0;
    return all.filter((c) => c.d <= d0 + 3 || (g.edges[c.i].kind === 'road' && c.d <= r0 + 3));
  };
  const S = attach(fx, fz), T = attach(tx, tz);
  const N = g.nodes.length;
  const dist = new Float64Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const prevEdge = new Int32Array(N).fill(-1);
  const startVia = new Int32Array(N).fill(-1); // index into S for nodes reached straight from the start
  for (let k = 0; k < S.length; k++) {
    const s = S[k], e = g.edges[s.i];
    const da = s.d + e.len * s.t, db = s.d + e.len * (1 - s.t);
    if (da < dist[e.a]) { dist[e.a] = da; startVia[e.a] = k; prev[e.a] = -1; prevEdge[e.a] = s.i; }
    if (db < dist[e.b]) { dist[e.b] = db; startVia[e.b] = k; prev[e.b] = -1; prevEdge[e.b] = s.i; }
  }
  // optional extra cost per alley or tunnel edge (a bot that only takes an alley when it saves that much)
  const cost = (ei: number) => g.edges[ei].len + (narrowPenalty && (g.edges[ei].kind === 'alley' || g.edges[ei].kind === 'tunnel') ? narrowPenalty : 0);
  const adj: Array<Array<[number, number]>> = Array.from({ length: N }, () => []);
  g.edges.forEach((e, i) => { adj[e.a].push([e.b, i]); adj[e.b].push([e.a, i]); });
  const done = new Uint8Array(N);
  for (;;) {
    let u = -1, du = Infinity;
    for (let v = 0; v < N; v++) if (!done[v] && dist[v] < du) { du = dist[v]; u = v; }
    if (u < 0) break;
    done[u] = 1;
    for (const [v, ei] of adj[u]) {
      const nd = du + cost(ei);
      if (nd < dist[v]) { dist[v] = nd; prev[v] = u; prevEdge[v] = ei; startVia[v] = -1; }
    }
  }
  // best finish: via an end node of a target edge, or straight along a shared edge
  let best = Infinity, bestNode = -1, bestT = T[0], direct = false, directS = S[0];
  for (const t of T) {
    const e = g.edges[t.i];
    const ca = dist[e.a] + e.len * t.t + t.d, cb = dist[e.b] + e.len * (1 - t.t) + t.d;
    if (ca < best) { best = ca; bestNode = e.a; bestT = t; direct = false; }
    if (cb < best) { best = cb; bestNode = e.b; bestT = t; direct = false; }
    for (const s of S) {
      if (s.i !== t.i) continue;
      const c = s.d + e.len * Math.abs(t.t - s.t) + t.d;
      if (c < best) { best = c; direct = true; directS = s; bestT = t; }
    }
  }
  const pts: RoutePoint[] = [];
  const kinds = new Set<FeatureKind>(), names = new Set<string>();
  const note = (ei: number) => { const e = g.edges[ei]; if (e.kind !== 'road') { kinds.add(e.kind); names.add(e.name); } return e; };
  if (direct) {
    const e = note(directS.i);
    pts.push({ x: directS.x, z: directS.z, kind: 'road', name: '' }, { x: bestT.x, z: bestT.z, kind: e.kind, name: e.name });
  } else if (bestNode >= 0) {
    const chain: number[] = [];
    for (let v = bestNode; v >= 0; v = prev[v]) { chain.push(v); if (prev[v] < 0) break; }
    chain.reverse();
    const first = chain[0];
    const s = S[Math.max(0, startVia[first])];
    pts.push({ x: s.x, z: s.z, kind: 'road', name: '' });
    const e0 = note(prevEdge[first]);
    pts.push({ x: g.nodes[first].x, z: g.nodes[first].z, kind: e0.kind, name: e0.name });
    for (let k = 1; k < chain.length; k++) {
      const e = note(prevEdge[chain[k]]);
      pts.push({ x: g.nodes[chain[k]].x, z: g.nodes[chain[k]].z, kind: e.kind, name: e.name });
    }
    const et = note(bestT.i);
    pts.push({ x: bestT.x, z: bestT.z, kind: et.kind, name: et.name });
  }
  let length = best;
  if (narrowPenalty && pts.length > 1) {
    length = Math.hypot(pts[0].x - fx, pts[0].z - fz) + Math.hypot(tx - pts[pts.length - 1].x, tz - pts[pts.length - 1].z);
    for (let k = 1; k < pts.length; k++) length += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z);
  }
  return { length, points: pts, kinds: [...kinds], names: [...names] };
}
