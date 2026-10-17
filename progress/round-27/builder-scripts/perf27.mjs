// Round 27 builder: frame cost with the frame-rate cap off (no vsync), so costs under the 8.3 ms cap show. Same street
// route as perf-street.mjs (22, 4 m down a downtown avenue at 8-10 m/s, 10 s a case). Cases toggle the detail kit and
// people (a part's cost = the difference). MOBILE=1 for iPhone 13 landscape. PORT picks the build (5190 new, 5191 baseline).
import { chromium, devices } from '@playwright/test';
const MOBILE = !!process.env.MOBILE; const SEED = process.env.SEED || '22'; const PORT = process.env.PORT || '5190';
const browser = await chromium.launch({ channel: 'chromium', args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
await page.evaluate(() => { window.__GAME__.tune({ RUN: { startTime: 999 } }); window.__GAME__.start(); });
await page.waitForTimeout(1000);
const cases = (process.env.CASES || 'all,nodetail,nopeople,all').split(',');
for (const c of cases) {
  await page.evaluate((c) => { const g = window.__GAME__; if (g.detailOn) g.detailOn(c !== 'nodetail' && c !== 'bare'); g.streetLife(true, c !== 'nopeople' && c !== 'bare'); }, c);
  await page.evaluate(() => window.__GAME__.place(22, 4, -120, Math.PI, 8));
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__fd = []; window.__cl = []; let l = performance.now(); const f = (t) => { if (!window.__fdOn) return; window.__fd.push(t - l); l = t; const d = window.__THREE_GAME_DIAGNOSTICS__; window.__cl.push([d.renderer.calls, d.renderer.triangles]); requestAnimationFrame(f); }; window.__fdOn = true; requestAnimationFrame(f); });
  const t0 = Date.now(); let wDown = false;
  while (Date.now() - t0 < 10000) {
    const sp = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.player.speed);
    const want = sp < 10; if (want !== wDown) { wDown = want; await (want ? page.keyboard.down('KeyW') : page.keyboard.up('KeyW')); }
    await page.waitForTimeout(100);
  }
  if (wDown) await page.keyboard.up('KeyW');
  const r = await page.evaluate(() => { window.__fdOn = false; return { fd: window.__fd.slice(3), cl: window.__cl }; });
  const fd = r.fd.slice().sort((a, b) => a - b); const q = (p) => fd[Math.floor(p * (fd.length - 1))];
  const calls = r.cl.map((x) => x[0]).sort((a, b) => a - b), tris = r.cl.map((x) => x[1]).sort((a, b) => a - b);
  console.log('PERF27', MOBILE ? 'mobile' : 'desktop', PORT, c, JSON.stringify({ frames: fd.length, fps: +(fd.length / 10).toFixed(0), median: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), p99: +q(0.99).toFixed(2), max: +fd.at(-1).toFixed(1), callsMed: calls[calls.length >> 1], callsMax: calls.at(-1), trisMed: tris[tris.length >> 1], trisMax: tris.at(-1) }));
}
console.log('ERRORS', JSON.stringify(errors));
await browser.close();
