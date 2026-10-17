// Round 31: real-time frame times over the water. The drone circles low over the south shore and the marina (hold W
// and A) for 12 s, so the bay, the boats and their wakes fill most of the view. rAF intervals, draw calls, triangles,
// long tasks. MOBILE=1 for iPhone 13 landscape. Wall-clock numbers: contaminated while BTLEServer holds a core.
import { chromium, devices } from '@playwright/test';
const PORT = process.env.PORT || 5190, SEED = process.env.SEED || 130;
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext(process.env.MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); });
await page.waitForFunction(() => window.__GAME__.boats().length > 0, null, { timeout: 30000 });
await page.evaluate(() => { window.__GAME__.place(-40, 9, 175, 0, 0); });
await page.waitForTimeout(1500);
const r = await page.evaluate(async () => {
  const G = window.__GAME__;
  const long = []; const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) long.push(Math.round(e.duration)); });
  try { po.observe({ type: 'longtask' }); } catch {}
  G.key('KeyW', true); G.key('KeyA', true);
  const ts = []; let calls = 0, tris = 0; let last = performance.now();
  const t0 = last;
  await new Promise((res) => { const f = (t) => { ts.push(t - last); last = t; const s = G.renderStats(); calls = Math.max(calls, s.calls); tris = Math.max(tris, s.tris); if (t - t0 < 12000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  G.key('KeyW', false); G.key('KeyA', false);
  po.disconnect();
  const s = ts.slice(5).sort((a, b) => a - b);
  const q = (p) => +s[Math.floor(s.length * p)].toFixed(1);
  const d = window.__THREE_GAME_DIAGNOSTICS__;
  return { frames: s.length, median: q(0.5), p95: q(0.95), p99: q(0.99), max: +s[s.length - 1].toFixed(1), callsMax: calls, trisMax: tris, longTasks: long, end: d.player.position };
});
console.log('SHORE', process.env.MOBILE ? 'mobile' : 'desktop', SEED, JSON.stringify(r));
await browser.close();
