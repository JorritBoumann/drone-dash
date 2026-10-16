// Round 14 critic (new): variety-probe. Loads the game 3 times with no ?seed and fingerprints the city (site list) and
// the first 4 objectives; then shows the title screen as a fresh player sees it. Deterministic, read-only.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
for (let i = 0; i < 3; i++) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
  const r = await page.evaluate(() => { const G = window.__GAME__; const s = G.sites(); const fp = s.map((q) => `${q.name}@${Math.round(q.x)},${Math.round(q.z)},${q.y.toFixed(1)}`).join('|');
    let h = 0; for (const c of fp) h = (h * 31 + c.charCodeAt(0)) >>> 0; G.start(); G.manualRender(true); let d = G.advance(0.1, false); return { sites: s.length, hash: h.toString(16), first: d.objective.name, seedParam: location.search }; });
  console.log('LOAD ' + i + ' ' + JSON.stringify(r)); await page.close();
}
await browser.close();
