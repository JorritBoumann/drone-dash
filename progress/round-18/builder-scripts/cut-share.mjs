// Round 18 builder: share of pad-to-pad pairs (street route 45 to 200 m) whose feature route is at least 15% shorter than the grid route.
import { chromium } from '@playwright/test';
const seeds = (process.env.SEEDS || '22').split(',');
const browser = await chromium.launch({ channel: 'chromium' });
for (const seed of seeds) {
  const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
  await page.goto('http://127.0.0.1:5188/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const S = window.__GAME__.sites(); let n = 0, cut = 0; const kinds = {};
    for (let i = 0; i < S.length; i++) for (let j = 0; j < S.length; j++) {
      if (i === j) continue; const a = S[i], b = S[j];
      const g = window.__GAME__.streetRoute(a, b, false); if (g.length < 45 || g.length > 200) continue;
      const f = window.__GAME__.streetRoute(a, b, true); n++;
      if (f.length <= g.length * 0.85) { cut++; for (const k of f.kinds) kinds[k] = (kinds[k] || 0) + 1; }
    }
    return { n, cut, share: +(cut / n).toFixed(3), kinds };
  });
  console.log('CUTSHARE', seed, JSON.stringify(r));
  await page.close();
}
await browser.close();
