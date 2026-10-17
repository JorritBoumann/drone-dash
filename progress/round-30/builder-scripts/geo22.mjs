// Round 30 builder: seed 22, the high-line bot's stall spot on the second delivery (drone held at about (-98.5, 14.5, -54.3),
// pad at (-98.6, 0.4, -57)). What solid geometry sits between the drone and the pad? Column scans (insideSolid, pad 0)
// at points from the stall spot to the pad, and the solid tops / bottoms found.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
await page.goto('http://127.0.0.1:5190/?seed=22', { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
const r = await page.evaluate(() => { const G = window.__GAME__; G.start(); G.manualRender(true); G.advance(0.05, false);
  const out = [];
  for (let k = 0; k <= 8; k++) { const z = -53.3 - k * 0.5; const x = -98.5; const seg = []; let inS = false, y0 = 0;
    for (let y = 0; y <= 30; y += 0.1) { const s = G.insideSolid(x, y, z, 0); if (s && !inS) { inS = true; y0 = y; } if (!s && inS) { inS = false; seg.push([+y0.toFixed(1), +y.toFixed(1)]); } }
    if (inS) seg.push([+y0.toFixed(1), 30]); out.push({ x, z: +z.toFixed(1), solids: seg }); }
  // and a few metres either side across x at the stall z
  for (const dx of [-3, -1.5, 1.5, 3]) { const x = -98.5 + dx, z = -54.3; const seg = []; let inS = false, y0 = 0;
    for (let y = 0; y <= 30; y += 0.1) { const s = G.insideSolid(x, y, z, 0); if (s && !inS) { inS = true; y0 = y; } if (!s && inS) { inS = false; seg.push([+y0.toFixed(1), +y.toFixed(1)]); } }
    if (inS) seg.push([+y0.toFixed(1), 30]); out.push({ x, z, solids: seg }); }
  return out; });
for (const o of r) console.log('COL', JSON.stringify(o));
await browser.close();
