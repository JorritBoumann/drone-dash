// Round 42 builder: acceptance 3. ?seed=22 vs ?seed=-22 (and 5 vs -5, -22 vs 4294967274): seed used, city mood, the
// full sites list and the first pickup. Different signs must give different cities; -22 must equal 4294967274 (README).
import { chromium } from '@playwright/test';
const PORT = process.env.PORT || '5193';
const VALUES = (process.env.VALUES || '22,-22,4294967274,5,-5,0,-0').split(',');
const browser = await chromium.launch({ channel: 'chromium' });
const out = {};
for (const v of VALUES) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } }); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
  await page.goto(`http://127.0.0.1:${PORT}/?seed=${encodeURIComponent(v)}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  const r = await page.evaluate(() => { const d = window.__THREE_GAME_DIAGNOSTICS__; const s = window.__GAME__.sites(); return { seed: d.seed, mode: d.city.mode, mood: d.city.mood, sitesHash: s.map((q) => `${q.name}@${Math.round(q.x)},${Math.round(q.z)}`).join('|'), first3: s.slice(0, 3).map((q) => q.name).join('/'), label: document.getElementById('city-label')?.textContent }; });
  out[v] = r;
  console.log('SEED', JSON.stringify({ value: v, seed: r.seed, mode: r.mode, mood: r.mood, first3: r.first3, label: r.label, errs }));
  await ctx.close();
}
const same = (a, b) => out[a] && out[b] && out[a].sitesHash === out[b].sitesHash && out[a].mood === out[b].mood;
console.log('COMPARE', JSON.stringify({ '22 vs -22 same': same('22', '-22'), '5 vs -5 same': same('5', '-5'), '-22 vs 4294967274 same': same('-22', '4294967274'), '0 vs -0 same': same('0', '-0') }));
await browser.close();
