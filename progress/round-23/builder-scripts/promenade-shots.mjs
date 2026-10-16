// Round 23 builder: screenshots of the diagonal promenade (block sections, where people walk) and a street view (LOD).
import { chromium } from '@playwright/test';
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chromium' });
for (const seed of (process.env.SEEDS || '22,4').split(',')) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto('http://127.0.0.1:5190/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  await page.evaluate(() => window.__GAME__.tune({ RUN: { startTime: 999 } })); await page.keyboard.press('Enter'); await page.waitForTimeout(800);
  const diag = await page.evaluate(() => window.__GAME__.features().filter((f) => f.kind === 'diagonal'));
  let n = 0;
  for (const f of diag.slice(0, 2)) {
    // a point on the boulevard inside a block: boulevards run z = s x + c; block centres are at 44 k
    const b = await page.evaluate((f) => { const G = window.__GAME__; const c = G.city ? null : null; return f; }, f);
    for (const [ox, h, back] of [[0, 9, 0], [44, 4.5, 1]]) {
      const x = 0 + ox, s = Math.sign(f.z - 0 || 1);
      // walk along the boulevard direction (both diagonals go through (f.x, f.z) at 45 degrees)
      const dirs = [[1, 1], [1, -1]];
      let best = null;
      for (const [dx, dz] of dirs) { const ok = await page.evaluate(([x, z]) => !window.__GAME__.insideSolid(x, 2, z, 0.5), [f.x + dx * 11, f.z + dz * 11]); if (ok && !best) best = [dx, dz]; }
      if (!best) continue;
      const [dx, dz] = best; const t = ox ? 22 : 11;
      const px = f.x + dx * t, pz = f.z + dz * t;
      const yaw = Math.atan2(-dx, -dz);
      await page.evaluate(([x, y, z, yaw]) => window.__GAME__.place(x, y, z, yaw, 0), [px, h, pz, yaw]);
      await page.waitForTimeout(1600);
      n++;
      await page.screenshot({ path: OUT + `promenade-${seed}-${n}.jpg`, type: 'jpeg', quality: 80 });
    }
  }
  console.log('SHOTS', seed, n, JSON.stringify(diag.map((f) => [f.name, f.x, f.z])));
  await page.context().close();
}
await browser.close();
