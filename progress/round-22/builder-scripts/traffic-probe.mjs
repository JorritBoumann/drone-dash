// Round 22 builder: traffic probe. Deterministic (manualRender + advance). SEEDS (default 22,58,130), SIMT seconds
// (default 60: the first half normal, the second half with rush hour forced on). Every 0.1 s it reads every live vehicle
// (__GAME__.traffic) as an oriented box and checks:
//  - overlaps: any two boxes that intersect in plan (SAT) and in height (cars 0..h, hover-vans at 3.1 m on their pads),
//  - lane: distance from the lane centre line (or the turn arc) above 0.05 m,
//  - off road: any corner of a ground vehicle outside the road surface (12 m wide streets, inside the city),
//  - buildings: any corner or the centre inside a solid collider (__GAME__.insideSolid) at mid height.
// Also counts how many cars move (not stuck) and how many were stopped at junctions. Port 5190.
import { chromium } from '@playwright/test';
const SEEDS = (process.env.SEEDS || '22,58,130').split(',').map(Number);
const SIMT = Number(process.env.SIMT || 60);
const browser = await chromium.launch({ channel: 'chromium' });
const all = [];
for (const seed of SEEDS) {
  const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:5190/?seed=${seed}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
  const res = await page.evaluate(async ([SIMT]) => {
    const g = window.__GAME__;
    g.start(); g.manualRender(true);
    g.place(0, 60, 0, 0, 0);
    const rc = [-154, -110, -66, -22, 22, 66, 110, 154];
    const half = 176;
    const near = (v) => rc.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
    const onRoad = (x, z) => Math.abs(x) <= half + 0.01 && Math.abs(z) <= half + 0.01 && (Math.abs(x - near(x)) <= 6.01 || Math.abs(z - near(z)) <= 6.01);
    const corners = (v) => { const rx = v.fz, rz = -v.fx; const out = []; for (const a of [-1, 1]) for (const b of [-1, 1]) out.push([v.x + v.fx * a * v.len / 2 + rx * b * v.wid / 2, v.z + v.fz * a * v.len / 2 + rz * b * v.wid / 2]); return out; };
    const axes = (v) => [[v.fx, v.fz], [v.fz, -v.fx]];
    const sep = (A, B) => { for (const [ax, az] of [...axes(A), ...axes(B)]) { const pa = corners(A).map(([x, z]) => x * ax + z * az), pb = corners(B).map(([x, z]) => x * ax + z * az); if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return true; } return false; };
    let samples = 0, overlaps = 0, laneOff = 0, offRoad = 0, inBuilding = 0, maxLat = 0, vehSamples = 0, moving = 0, stopped = 0, vanSamples = 0;
    const overlapList = [];
    const types = new Set();
    let rushOn = false; let maxCars = 0, maxVans = 0, minCars = 1e9; let rushCars = 0, rushN = 0, calmCars = 0, calmN = 0;
    let prev = new Map();
    for (let t = 0; t < SIMT; t += 0.1) {
      if (!rushOn && t >= SIMT / 2) { g.rush(true); rushOn = true; }
      g.advance(0.1, false);
      const vs = g.traffic();
      samples++;
      const cars = vs.filter((v) => v.kind === 'car'), vans = vs.filter((v) => v.kind === 'van');
      maxCars = Math.max(maxCars, cars.length); minCars = Math.min(minCars, cars.length); maxVans = Math.max(maxVans, vans.length);
      if (rushOn && t > SIMT / 2 + 15) { rushCars += cars.length; rushN++; } else if (!rushOn) { calmCars += cars.length; calmN++; }
      for (const v of vs) {
        vehSamples++; types.add(v.type); if (v.kind === 'van') vanSamples++;
        if (v.lat > 0.05) laneOff++;
        maxLat = Math.max(maxLat, v.lat);
        if (v.kind === 'car') {
          if (corners(v).some(([x, z]) => !onRoad(x, z))) offRoad++;
          const ym = v.y1 / 2;
          if ([[v.x, v.z], ...corners(v)].some(([x, z]) => g.insideSolid(x, ym, z, 0))) inBuilding++;
          const p = prev.get(`${Math.round(v.x)}`); void p;
          if (v.mode === 'turn') moving++;
        } else if (Math.abs(v.x) < half && Math.abs(v.z) < half && [[v.x, v.z], ...corners(v)].some(([x, z]) => g.insideSolid(x, v.y, z, 0))) inBuilding++;
      }
      for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) {
        const A = vs[i], B = vs[j];
        if (Math.hypot(A.x - B.x, A.z - B.z) > 8) continue;
        if (A.y1 <= B.y0 || B.y1 <= A.y0) continue;
        if (!sep(A, B)) { overlaps++; if (overlapList.length < 8) overlapList.push({ t: +t.toFixed(1), a: [A.kind, A.type, A.mode, +A.x.toFixed(1), +A.z.toFixed(1)], b: [B.kind, B.type, B.mode, +B.x.toFixed(1), +B.z.toFixed(1)] }); }
      }
      const st = window.__THREE_GAME_DIAGNOSTICS__.street; stopped += st.braking;
    }
    return { samples, vehSamples, vanSamples, overlaps, overlapList, laneOff, maxLat: +maxLat.toFixed(4), offRoad, inBuilding, types: [...types].sort(), minCars, maxCars, maxVans, calmAvg: +(calmCars / Math.max(1, calmN)).toFixed(1), rushAvg: +(rushCars / Math.max(1, rushN)).toFixed(1), stoppedShare: +(stopped / Math.max(1, vehSamples - vanSamples)).toFixed(3), street: window.__THREE_GAME_DIAGNOSTICS__.street };
  }, [SIMT]);
  console.log('TRAFFIC ' + JSON.stringify({ seed, ...res, errors }));
  all.push(res);
  await page.close();
}
console.log('TOTAL ' + JSON.stringify({ overlaps: all.reduce((a, r) => a + r.overlaps, 0), laneOff: all.reduce((a, r) => a + r.laneOff, 0), offRoad: all.reduce((a, r) => a + r.offRoad, 0), inBuilding: all.reduce((a, r) => a + r.inBuilding, 0) }));
await browser.close();
