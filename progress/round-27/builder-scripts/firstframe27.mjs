// Round 27 builder: load and first-flight hitch. Fresh browser per run (cold shader cache). Logs time to the first frame
// drawn after load, the longest frame on the title screen, and frames over 33 ms in the first 6 s of a real flight
// (Play, then W held). PORT picks the build; MOBILE=1 for iPhone 13 landscape.
import { chromium, devices } from '@playwright/test';
const MOBILE = !!process.env.MOBILE; const PORT = process.env.PORT || '5190'; const SEED = process.env.SEED || '22';
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => {
  window.__ff = { first: null, frames: [] }; let l = null;
  const g = (t) => { if (window.__THREE_GAME_DIAGNOSTICS__ && window.__ff.first === null) window.__ff.first = t; if (l !== null) window.__ff.frames.push([t, t - l, window.__THREE_GAME_DIAGNOSTICS__?.state]); l = t; requestAnimationFrame(g); };
  requestAnimationFrame(g);
});
const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}`, { waitUntil: 'load' });
await page.waitForTimeout(2500);
const nav = await page.evaluate(() => ({ first: +window.__ff.first.toFixed(0), titleMax: +Math.max(...window.__ff.frames.filter((f) => f[2] === 'title').map((f) => f[1])).toFixed(1), dcl: +performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd.toFixed(0), bytes: performance.getEntriesByType('resource').reduce((s, r) => s + (r.transferSize || 0), 0) + (performance.getEntriesByType('navigation')[0].transferSize || 0) }));
const [tStart, startMs] = await page.evaluate(() => { const a = performance.now(); window.__GAME__.start(); return [performance.now(), performance.now() - a]; });
await page.keyboard.down('KeyW'); await page.waitForTimeout(6000); await page.keyboard.up('KeyW');
const fl = await page.evaluate((ts) => { const f = window.__ff.frames.filter((x) => x[0] > ts); return { frames: f.length, firstFlightFrame: +(f[0]?.[1] ?? 0).toFixed(1), over33: f.filter((x) => x[1] > 33).map((x) => [+((x[0] - ts) / 1000).toFixed(2), +x[1].toFixed(1)]), max: +Math.max(...f.map((x) => x[1])).toFixed(1) }; }, tStart);
console.log('FIRST', MOBILE ? 'mobile' : 'desktop', PORT, JSON.stringify({ ...nav, startMs: +startMs.toFixed(1), ...fl, wall: Date.now() - t0 }), 'ERRORS', JSON.stringify(errors));
await browser.close();
