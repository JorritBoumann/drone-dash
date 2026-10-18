// Round 35 builder: perf-street34 pointed at the boats: the drone hovers at the marina (moored boats, docks, hull caps)
// and beside a lane-31 sailboat (moving boats, wakes, sail translucency), 12 s each. UNCAP=1 for the real frame cost.
// Round 34 critic: perf-street with UNCAP=1 (no vsync, no frame-rate cap): frame time is then the real cost per frame.
// Round 22 critic: frame time at street level (4 m) down a downtown avenue, 12 s normal then 12 s rush hour. MOBILE=1 for iPhone 13.
import { chromium, devices } from '@playwright/test';
const MOBILE = !!process.env.MOBILE; const SEED = process.env.SEED || '22';
const browser = await chromium.launch({ channel: 'chromium', args: process.env.UNCAP ? ['--disable-frame-rate-limit', '--disable-gpu-vsync'] : [] });
const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://127.0.0.1:' + (process.env.PORT || 5190) + '/?seed=' + SEED, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
await page.evaluate(() => { window.__GAME__.tune({ RUN: { startTime: 999 } }); window.__GAME__.start(); });
await page.waitForFunction(() => window.__GAME__.assetsReady().on && window.__GAME__.boats().length > 0, null, { timeout: 40000 }); await page.waitForTimeout(1000);
const run = async (label, spot) => {
  await page.evaluate((spot) => {
    const G = window.__GAME__;
    if (spot === 'marina') G.place(-44, 5, 158, Math.PI, 0);
    else { const b = G.boats().find((q) => q.kind === 'sail' && q.moving); const px = Math.cos(b.yaw), pz = -Math.sin(b.yaw); G.place(Math.max(-185, Math.min(185, b.x + px * 8)), 3, Math.max(-185, Math.min(185, b.z + pz * 8)), b.yaw + Math.PI / 2, 0); }
  }, spot);
  await page.waitForTimeout(600);
  await page.evaluate(() => { window.__fd = []; window.__dc = []; window.__tr = []; let l = performance.now(); const f = (t) => { if (!window.__fdOn) return; window.__fd.push(t - l); l = t; const d = window.__THREE_GAME_DIAGNOSTICS__; window.__dc.push(d.renderer.calls); window.__tr.push(d.renderer.triangles); requestAnimationFrame(f); }; window.__fdOn = true; requestAnimationFrame(f); });
  await page.waitForTimeout(12000);
  const r = await page.evaluate(() => { window.__fdOn = false; return { fd: window.__fd.slice(2), dc: window.__dc, trisMax: Math.max(...window.__tr), assets: window.__GAME__.assetsReady().on }; });
  const fd = r.fd.slice().sort((a, b) => a - b); const q = (p) => fd[Math.floor(p * (fd.length - 1))];
  console.log('PERF', MOBILE ? 'mobile' : 'desktop', label, JSON.stringify({ frames: fd.length, median: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), p99: +q(0.99).toFixed(2), max: +fd.at(-1).toFixed(1), over20: fd.filter((x) => x > 20).length, callsMax: Math.max(...r.dc), trisMax: r.trisMax, assets: r.assets }));
};
await run('marina', 'marina');
await run('sail-lane', 'sail');
console.log('ERRORS', JSON.stringify(errors));
await browser.close();
