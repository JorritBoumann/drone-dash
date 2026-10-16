import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
await page.goto('http://127.0.0.1:5188/?seed=' + (process.env.SEED || 22), { waitUntil: 'networkidle' }); await page.waitForTimeout(300);
const r = await page.evaluate(() => {
  const S = window.__GAME__.sites(); const out = { pick: [0, 0, 0], drop: [0, 0, 0] };
  for (const a of S) {
    for (const [k, lo, hi] of [['pick', 45, 105], ['drop', 105, 165]]) {
      const band = S.filter((b) => b !== a && Math.abs(b.x - a.x) + Math.abs(b.z - a.z) >= lo && Math.abs(b.x - a.x) + Math.abs(b.z - a.z) <= hi);
      const sc = band.filter((b) => window.__GAME__.streetRoute(a, b, true).length <= 0.85 * window.__GAME__.streetRoute(a, b, false).length);
      out[k][0]++; if (sc.length) out[k][1]++; out[k][2] += sc.length / Math.max(1, band.length);
    }
  }
  out.pick[2] = +(out.pick[2] / out.pick[0]).toFixed(3); out.drop[2] = +(out.drop[2] / out.drop[0]).toFixed(3);
  return out;
});
console.log(JSON.stringify(r));
await browser.close();
