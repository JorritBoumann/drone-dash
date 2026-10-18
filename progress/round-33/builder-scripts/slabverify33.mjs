// Round 33 builder: the city shadow slab never leaves out a triangle the sun's shadow camera can see (fixed step).
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
let worst = 0;
for (const seed of [130, 33, 22, 58, 11, 44, 7, 91]) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto('http://127.0.0.1:5190/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
  await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
  const r = await page.evaluate(() => { const G = window.__GAME__; const out = { n: 0, missed: 0, skippedIn: 0, drawnMax: 0, tri: 0, margin: 0 };
    for (const y of [3, 30]) for (let x = -210; x <= 210; x += 35) for (let z = -210; z <= 210; z += 35) { G.place(x, y, z, 0, 0); G.advance(1 / 20, true); const s = G.shadowSlab(); out.n++; out.missed += s.verify.missed; out.skippedIn += s.verify.skippedIn; out.drawnMax = Math.max(out.drawnMax, s.drawn); out.tri = s.triangles; out.margin = s.margin; }
    return out; });
  console.log('VERIFY', seed, JSON.stringify(r)); worst = Math.max(worst, r.missed);
  await page.close();
}
console.log('MISSED_TOTAL_MAX', worst);
await browser.close();
