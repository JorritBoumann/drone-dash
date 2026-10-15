// Round 17 builder: print the first objective and the site kinds near the start for a seed (tuning aid).
import { chromium } from '@playwright/test';
const b = await chromium.launch({ channel: 'chromium' });
for (const seed of (process.env.SEEDS || '62367').split(',')) {
  const p = await (await b.newContext({ viewport: { width: 640, height: 360 } })).newPage();
  await p.goto('http://127.0.0.1:5188/?seed=' + seed, { waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  const r = await p.evaluate(() => { window.__GAME__.externalClock(true); window.__GAME__.start(); const d = window.__GAME__.advance(0.05, false); const sites = window.__GAME__.sites(); const o = d.objective; const s = sites.find((q) => Math.abs(q.x - o.position.x) < 0.01 && Math.abs(q.z - o.position.z) < 0.01); const kinds = {}; for (const q of sites) kinds[q.kind] = (kinds[q.kind] || 0) + 1; return { first: s, start: d.player.position, kinds }; });
  console.log(seed, JSON.stringify(r));
  await p.close();
}
await b.close();
