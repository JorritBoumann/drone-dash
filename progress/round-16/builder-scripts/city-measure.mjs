// Round 16 builder: measure what each city's job sequence asks of the pilot. Runs the game's own generator and
// DeliverySystem in Node (vite ssrLoadModule), teleports a ghost through the first LEGS objectives and logs:
// leg straight distance, street (grid) distance, target kind and height, share of the street route with a draft wall,
// and the city's pad mix. No rendering, no flight: the job sequence does not depend on how the drone flies.
// Usage: SEEDS=22,58,130 LEGS=8 node city-measure.mjs   (JSON=1 for one JSON line per city)
import { createServer } from 'vite';
const root = new URL('../../../', import.meta.url).pathname;
const server = await createServer({ root, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
const gen = await server.ssrLoadModule('/src/world/CityGenerator.ts');
const cities = await server.ssrLoadModule('/src/game/cities.ts');
const rnd = await server.ssrLoadModule('/src/core/random.ts');
const del = await server.ssrLoadModule('/src/systems/DeliverySystem.ts');
const cw = await server.ssrLoadModule('/src/systems/CollisionWorld.ts');
const THREE = await server.ssrLoadModule('three');
const seeds = (process.env.SEEDS || '22,58,130,81401,70492,32730,48684,57366,73023').split(',').map(Number);
const LEGS = Number(process.env.LEGS || 8);
const ROADS = [-154, -110, -66, -22, 22, 66, 110, 154];
const nr = (v) => ROADS.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));

function wallShare(layout, a, b) {
  // the street bot's L route: to the nearest road, along roads, to the target; sample every 4 m at 7 m height
  const solids = layout.colliders.filter((c) => !c.soft && c.maxY > 5.5 && c.maxX - c.minX > 4 && c.maxZ - c.minZ > 4);
  const pts = [];
  const onX = Math.abs(a.x - nr(a.x)) < Math.abs(a.z - nr(a.z));
  const Xt = nr(b.x), Zt = nr(b.z);
  if (onX) pts.push({ x: nr(a.x), z: a.z }, { x: nr(a.x), z: Zt }, { x: Xt, z: Zt });
  else pts.push({ x: a.x, z: nr(a.z) }, { x: Xt, z: nr(a.z) }, { x: Xt, z: Zt });
  pts.push({ x: b.x, z: b.z });
  let n = 0, good = 0, prev = { x: a.x, z: a.z };
  for (const p of pts) {
    const L = Math.hypot(p.x - prev.x, p.z - prev.z);
    const k = Math.max(1, Math.round(L / 4));
    for (let i = 0; i < k; i++) {
      const x = prev.x + ((p.x - prev.x) * i) / k, z = prev.z + ((p.z - prev.z) * i) / k;
      n++;
      if (solids.some((c) => Math.hypot(Math.max(c.minX - x, 0, x - c.maxX), Math.max(c.minZ - z, 0, z - c.maxZ)) < 10)) good++;
    }
    prev = p;
  }
  return n ? good / n : 0;
}

const rows = [];
for (const seed of seeds) {
  const layout = gen.generateCity(rnd.createSeededRandom(seed), 7, cities.cityLook ? cities.cityLook(seed).parks : 3);
  const world = new cw.CollisionWorld(layout.colliders, 0);
  const sites = layout.sites;
  const kinds = {};
  for (const s of sites) kinds[s.kind] = (kinds[s.kind] || 0) + 1;
  const tall = sites.filter((s) => s.kind === 'rooftop' && s.pos.y > 25).length;
  const byCentre = (a, b) => a.pos.lengthSq() - b.pos.lengthSq();
  const parks = sites.filter((s) => s.kind === 'park').sort(byCentre);
  const roofs = sites.filter((s) => s.kind === 'rooftop' && s.pos.y < 26).sort(byCentre);
  const central = parks[0] ?? roofs[0] ?? sites[0];
  const start = central.pos.clone().add(new THREE.Vector3(0, 14, 0));
  const ds = new del.DeliverySystem(sites);
  const rng = rnd.createSeededRandom(seed * 977 + 13);
  const tmp = new THREE.Vector3();
  ds.reset(rng, start, (from, to) => world.segmentFraction(from, tmp.copy(to).setY(to.y + 3), 1.4, false) >= 0.999);
  const legs = [];
  let from = start.clone();
  for (let i = 0; i < LEGS * 2; i++) {
    const t = ds.target;
    const straight = Math.hypot(t.pos.x - from.x, t.pos.z - from.z);
    const street = Math.abs(t.pos.x - from.x) + Math.abs(t.pos.z - from.z);
    legs.push({ phase: ds.phase, kind: t.kind, y: +t.pos.y.toFixed(1), straight: Math.round(straight), street: Math.round(street), climb: Math.round(Math.max(0, t.pos.y - 7)), wall: +wallShare(layout, from, t.pos).toFixed(2), par: ds.phase === 'deliver' ? +ds.legPar.toFixed(1) : null });
    from = t.pos.clone();
    const p = t.pos.clone().setY(t.pos.y + 0.95);
    ds.update(0, rng, p, 0.95);
  }
  const drops = legs.filter((l) => l.phase === 'deliver');
  const sum = (a, k) => a.reduce((s, l) => s + l[k], 0);
  const first4 = legs.slice(0, 4);
  const row = {
    seed, sites: sites.length, kinds, tallRoofs: tall,
    first: `${legs[0].kind} ${legs[0].straight}m y${legs[0].y}`,
    first4Street: sum(first4, 'street'), first4Climb: sum(first4, 'climb'), first4Roof: first4.filter((l) => l.kind === 'rooftop').length,
    dropStreetMean: Math.round(sum(drops, 'street') / drops.length), dropStraightMean: Math.round(sum(drops, 'straight') / drops.length),
    allStreet8: sum(legs, 'street'), climb8: sum(legs, 'climb'), roofLegs: legs.filter((l) => l.kind === 'rooftop').length,
    wallMean: +(sum(legs, 'wall') / legs.length).toFixed(2), goodWallLegs: legs.filter((l) => l.wall >= 0.6).length,
    legs: legs.map((l) => `${l.phase[0]}:${l.kind[0]}${l.y > 3 ? '@' + Math.round(l.y) : ''} ${l.street}/${l.straight} w${l.wall}`).join(' | '),
  };
  rows.push(row);
  if (process.env.JSON) console.log(JSON.stringify(row));
  else console.log(`${seed}\tsites ${sites.length} ${JSON.stringify(kinds)} tall>25m ${tall}\tfirst ${row.first}\tfirst4 street ${row.first4Street} climb ${row.first4Climb} roofs ${row.first4Roof}\tdrop street ${row.dropStreetMean} straight ${row.dropStraightMean}\tall16 street ${row.allStreet8} climb ${row.climb8} roof ${row.roofLegs}\twall ${row.wallMean} good ${row.goodWallLegs}\n   ${row.legs}`);
}
await server.close();
