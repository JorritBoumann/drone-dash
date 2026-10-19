// Round 39 builder: block face profile (drone centre z at contact, south side of each east-west road), every 2 m, 10 m up.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
await page.goto(`http://127.0.0.1:${process.env.PORT || 5191}/?seed=${process.env.SEED || 22}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
const out = await page.evaluate(() => { const G = window.__GAME__; G.start(); G.manualRender(true); const res = {};
  for (const rz of [-110, -66, -22, 22, 66, 110]) { const row = [];
    for (let x = -150; x <= 150; x += 2) { let face = null; for (let d = 5; d <= 18; d += 0.25) { G.place(x, 10, rz - d, 0, 0); const r = G.advance(1 / 60, false); if (r.player.position.z > rz - d + 0.1) { face = +r.player.position.z.toFixed(2); break; } } row.push(face); }
    res[rz] = row; }
  return res; });
for (const [rz, row] of Object.entries(out)) console.log(rz, row.map((v, i) => `${-150 + 2 * i}:${v}`).join(' '));
await browser.close();
