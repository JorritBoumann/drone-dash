// Round 23 critic (round 22 density-probe plus the share of nearby cars standing still and seeds 130, 44):  how many vehicles and people a street-level player sees around them. Deterministic. 200 random points on
// road centre lines (downtown half of the city and whole city), count cars within 50 m and people within 30 m; normal and rush.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
for (const seed of (process.env.SEEDS || '22,4,130,44').split(',')) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  await page.goto('http://127.0.0.1:5191/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const G = window.__GAME__; G.tune({ RUN: { startTime: 999 } }); G.start(); G.manualRender(true); G.advance(8, false);
    const lanes = G.rushLanes(); let s = 7; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const roads = []; for (let k = -3; k <= 3; k++) roads.push(22 + 44 * k - 0 * 0); // road centres seen in this city (22 + 44k)
    const res = {};
    for (const ph of ['normal', 'rush']) {
      G.rush(ph === 'rush'); G.advance(10, false);
      const acc = { all: [0, 0, 0, 0, 0, 0], down: [0, 0, 0, 0, 0, 0] }; let gStop = 0, gCars = 0;
      for (let i = 0; i < 200; i++) {
        G.advance(0.1, false);
        const before = G.traffic().filter((v) => v.kind === 'car'); const dd = G.advance(0.2, false); gStop += dd.street.braking; gCars += dd.street.cars;
        const tr = G.traffic(), pp = G.people();
        const rc = roads[Math.floor(R() * roads.length)], along = (R() - 0.5) * 300, ax = R() < 0.5;
        const x = ax ? along : rc, z = ax ? rc : along;
        const cars = tr.filter((v) => v.kind === 'car' && Math.hypot(v.x - x, v.z - z) < 50);
        const moving = cars.length; const still = cars.filter((c) => before.some((b) => Math.hypot(b.x - c.x, b.z - c.z) < 0.1)).length; const vans = tr.filter((v) => v.kind === 'van' && Math.hypot(v.x - x, v.z - z) < 50).length;
        const ppl = pp.filter((p) => Math.hypot(p.x - x, p.z - z) < 30).length;
        for (const key of Math.hypot(x, z) < 90 ? ['all', 'down'] : ['all']) { const a = acc[key]; a[0]++; a[1] += moving; a[2] += vans; a[3] += ppl; a[4] += still; }
      }
      res[ph] = Object.fromEntries(Object.entries(acc).map(([k, a]) => [k, { n: a[0], carsIn50m: +(a[1] / a[0]).toFixed(2), vansIn50m: +(a[2] / a[0]).toFixed(2), peopleIn30m: +(a[3] / a[0]).toFixed(1), stillShareIn50m: +(a[4] / Math.max(1, a[1])).toFixed(2) }])); res[ph].globalStoppedShare = +(gStop / Math.max(1, gCars)).toFixed(2); res[ph].carsLive = G.diagnostics().street.cars;
    }
    return res;
  });
  console.log('DENSITY', seed, JSON.stringify(r));
  await page.context().close();
}
await browser.close();
