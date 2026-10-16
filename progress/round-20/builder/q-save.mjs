import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
await page.goto('http://127.0.0.1:5188/?seed=16541', { waitUntil: 'networkidle' });
const r = await page.evaluate(() => {
  const G = window.__GAME__; const S = G.sites(); const out = { n: 0, narrow: 0, save10: 0, saves: [] };
  for (let i = 0; i < S.length; i += 3) for (let j = 1; j < S.length; j += 7) {
    const a = S[i], b = S[j]; const g = G.streetRoute(a, b, false).length; const f = G.streetRoute(a, b, true); const av = G.streetRoute(a, b, true, 1000);
    const d = Math.abs(a.x - b.x) + Math.abs(a.z - b.z); if (d < 60 || d > 220) continue;
    out.n++; if (f.kinds.includes('alley') || f.kinds.includes('tunnel')) { out.narrow++; const s = av.length - f.length; if (s >= 10 && s >= 0.08 * av.length) out.save10++; if (out.saves.length < 12) out.saves.push([Math.round(g), Math.round(f.length), Math.round(av.length), av.kinds.join('+')]); }
  }
  return out;
});
console.log(JSON.stringify(r)); await browser.close();
