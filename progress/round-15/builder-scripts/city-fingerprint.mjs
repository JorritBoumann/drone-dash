// Round 15 builder: fingerprints the collider list, sites and trees of the 8 test seeds (to prove ?seed=N cities are unchanged).
import { chromium } from '@playwright/test';
const seeds = (process.env.SEEDS || '11,22,33,44,7,58,91,130').split(',').map(Number);
const browser = await chromium.launch({ channel: 'chromium' });
const out = {};
for (const seed of seeds) {
  const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
  await page.goto('http://127.0.0.1:5188/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(300);
  out[seed] = await page.evaluate(() => { const G = window.__GAME__; const d = G.diagnostics(); const s = G.sites().map((q) => `${q.name}@${q.x.toFixed(2)},${q.z.toFixed(2)},${q.y.toFixed(2)}`).join('|');
    let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; G.start(); const f = G.advance(0.05, false); return { sites: d.world.sites, colliders: d.world.colliders, trees: d.world.trees, siteHash: h.toString(16), first: f.objective.name }; });
  await page.close();
}
console.log(JSON.stringify(out));
await browser.close();
