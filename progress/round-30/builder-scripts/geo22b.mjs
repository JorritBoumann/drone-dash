// Round 30 builder: what stops the roof bot at (-98.5, 14.5, -54.3) on seed 22? solidAt (all colliders, soft ones too)
// along the line from the stall spot to the pad at the drone's height, grown by 0.6 m.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
await page.goto('http://127.0.0.1:5190/?seed=22', { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
const r = await page.evaluate(() => { const G = window.__GAME__; G.start(); G.manualRender(true); G.advance(0.05, false);
  const out = []; for (let z = -53.8; z >= -57.01; z -= 0.4) for (const y of [13.6, 14.5, 15.5]) out.push({ z: +z.toFixed(1), y, hits: G.solidAt(-98.6, y, z, 0.6) }); return out; });
for (const o of r) if (o.hits.length) console.log('HIT', JSON.stringify(o).slice(0, 600));
await browser.close();
