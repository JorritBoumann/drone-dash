// Round 22 critic: deterministic street-life audit (manualRender + advance). Per seed: 40 s normal + 30 s rush, sampled every 0.25 s.
import { chromium } from '@playwright/test';
const seeds = (process.env.SEEDS || '22,4,130,58').split(',');
const browser = await chromium.launch({ channel: 'chromium' });
for (const seed of seeds) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  await page.goto('http://127.0.0.1:5190/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
  const res = await page.evaluate(() => {
    const G = window.__GAME__; G.start(); G.manualRender(true); let d = G.advance(0.1, false);
    const cell = (x, z) => Math.round(x / 1.5) + ',' + Math.round(z / 1.5);
    const drive = new Map(); // cell -> car visits
    const obb = (a, pad) => { const fx = a.fx, fz = a.fz, l = a.len / 2 + pad, w = a.wid / 2 + pad; return { c: [a.x, a.z], ax: [[fx, fz], [-fz, fx]], h: [l, w] }; };
    const sep = (A, B) => { for (const ax of [...A.ax, ...B.ax]) { const p = (O) => O.ax.reduce((s, u, i) => s + Math.abs(u[0] * ax[0] + u[1] * ax[1]) * O.h[i], 0); const dc = Math.abs((B.c[0] - A.c[0]) * ax[0] + (B.c[1] - A.c[1]) * ax[1]); if (dc > p(A) + p(B)) return true; } return false; };
    const out = { mood: d.city.mood, phases: [] };
    const allPeds = [];
    for (const [ph, secs] of [['normal', 40], ['rush', 30]]) {
      G.rush(ph === 'rush'); d = G.advance(2, false);
      const st = { phase: ph, samples: 0, carsMin: 1e9, carsMax: 0, vans: 0, overlapPairs: 0, overlapKeys: new Set(), carInSolid: 0, carInSolidKeys: new Set(), pedInSolid: 0, pedCarHit: 0, pedCarKeys: new Set(), onPad: 0, peopleTotal: 0, drawnMax: 0, braking: 0, turning: 0, offLane: 0, reversals: 0, stuckMax: 0 };
      const lastPos = new Map(); const still = new Map();
      for (let t = 0; t < secs; t += 0.25) {
        d = G.advance(0.25, false); st.samples++;
        const tr = G.traffic(), pp = G.people();
        const cars = tr.filter((v) => v.kind === 'car'), vans = tr.filter((v) => v.kind === 'van');
        st.carsMin = Math.min(st.carsMin, cars.length); st.carsMax = Math.max(st.carsMax, cars.length); st.vans = Math.max(st.vans, vans.length);
        st.braking += d.street.braking; st.turning += d.street.turning; st.onPad = Math.max(st.onPad, d.street.onActivePad); st.peopleTotal = d.street.people; st.drawnMax = Math.max(st.drawnMax, d.street.peopleDrawn);
        for (const c of cars) { const k = cell(c.x, c.z); drive.set(k, (drive.get(k) || 0) + 1); if (c.lat > 0.3) st.offLane++; }
        for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) { const a = cars[i], b = cars[j]; if (Math.hypot(a.x - b.x, a.z - b.z) > 9) continue; if (!sep(obb(a, -0.1), obb(b, -0.1))) { st.overlapPairs++; st.overlapKeys.add(Math.round(a.x) + ':' + Math.round(a.z)); } }
        for (const c of cars) { const pts = [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]].map(([u, v]) => [c.x + c.fx * u * (c.len / 2 - 0.2) - c.fz * v * (c.wid / 2 - 0.2), c.z + c.fz * u * (c.len / 2 - 0.2) + c.fx * v * (c.wid / 2 - 0.2)]); if (pts.some(([x, z]) => G.insideSolid(x, 0.6, z, 0))) { st.carInSolid++; st.carInSolidKeys.add(Math.round(c.x) + ':' + Math.round(c.z)); } }
        for (const p of pp) { if (G.insideSolid(p.x, p.y + 0.9, p.z, 0.08)) st.pedInSolid++; for (const c of cars) { if (Math.abs(c.x - p.x) > 4 || Math.abs(c.z - p.z) > 4) continue; if (!sep(obb(c, 0.15), { c: [p.x, p.z], ax: [[1, 0], [0, 1]], h: [0.2, 0.2] })) { st.pedCarHit++; st.pedCarKeys.add(Math.round(p.x) + ':' + Math.round(p.z)); } } }
        if (ph === 'normal' && t > 10) for (const p of pp) allPeds.push([p.x, p.z]);
      }
      st.overlapSpots = st.overlapKeys.size; st.carInSolidSpots = st.carInSolidKeys.size; st.pedCarSpots = [...st.pedCarKeys].slice(0, 8); st.pedCarSpotN = st.pedCarKeys.size;
      delete st.overlapKeys; delete st.carInSolidKeys; delete st.pedCarKeys;
      st.braking = +(st.braking / st.samples).toFixed(1); st.turning = +(st.turning / st.samples).toFixed(1);
      out.phases.push(st);
    }
    // people on drivable cells (cells a car has visited at least 3 times), sampled 10..40 s
    let onRoad = 0; const roadSpots = new Map();
    for (const [x, z] of allPeds) { const k = cell(x, z); if ((drive.get(k) || 0) >= 3) { onRoad++; const kk = Math.round(x / 6) * 6 + ':' + Math.round(z / 6) * 6; roadSpots.set(kk, (roadSpots.get(kk) || 0) + 1); } }
    out.pedSamples = allPeds.length; out.pedOnRoadShare = +(onRoad / Math.max(1, allPeds.length)).toFixed(4); out.roadSpots = [...roadSpots.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    out.features = G.features().map((f) => f.kind + '@' + Math.round(f.x) + ',' + Math.round(f.z));
    return out;
  });
  console.log('SEED', seed, JSON.stringify(res));
  await page.context().close();
}
await browser.close();
