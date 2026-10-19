// Round 40 builder: minimap cost in real time (rAF loop, real rendering). W held and turning for 20 s after a 3 s warm-up;
// the minimap's own draw timer (performance.now around the 2D draw) and the frame time, minimap on, then off (M).
import { chromium, devices } from '@playwright/test';
const PORT = process.env.PORT || '5190';
const browser = await chromium.launch({ channel: 'chromium' });
for (const MOBILE of [false, true]) {
  const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/?seed=22`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
  await page.evaluate(() => { localStorage.removeItem('drone-dash-minimap-v1'); window.__GAME__.start(); });
  const measure = async () => {
    await page.evaluate(() => { const G = window.__GAME__; G.key('KeyW', true); G.key('Space', true); window.__ft = []; let last = performance.now(); const f = (t) => { window.__ft.push(t - last); last = t; if (window.__ft.length < 4000) requestAnimationFrame(f); }; requestAnimationFrame(f); });
    await page.waitForTimeout(1500); await page.evaluate(() => window.__GAME__.key('Space', false));
    await page.evaluate(() => { window.__GAME__.minimapStats(true); window.__ft = []; });
    for (let k = 0; k < 10; k++) { await page.evaluate((k) => { window.__GAME__.key(k % 2 ? 'KeyA' : 'KeyD', true); window.__GAME__.key(k % 2 ? 'KeyD' : 'KeyA', false); }, k); await page.waitForTimeout(2000); }
    return page.evaluate(() => { const s = window.__GAME__.minimapStats(); const f = window.__ft.slice().sort((a, b) => a - b); return { ...s, drawsPerSec: +(s.draws / 20).toFixed(1), frames: f.length, ftMed: +f[f.length >> 1].toFixed(2), ftP95: +f[Math.floor(f.length * 0.95)].toFixed(2), perFrameMs: +(s.msMean * s.draws / Math.max(1, f.length)).toFixed(4) }; });
  };
  const on = await measure();
  await page.evaluate(() => window.__GAME__.minimapToggle());
  const off = await measure();
  console.log(MOBILE ? 'phone' : 'desktop', 'ON', JSON.stringify(on), 'OFF', JSON.stringify(off));
  await page.evaluate(() => window.__GAME__.minimapToggle());
  await ctx.close();
}
await browser.close();
