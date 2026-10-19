// Round 35 critic (new): uncapped frame time with the game camera close to boats (caps, new boat textures in view).
// Views: hover 3 m up beside the marina (moored boats), then follow-hover 6 m off a moving sailboat and the rib.
// UNCAP=1 disables vsync and the frame cap. MOBILE=1 for iPhone 13 landscape. PORT default 5191.
import { chromium, devices } from '@playwright/test';
const MOBILE = !!process.env.MOBILE; const SEED = process.env.SEED || '130'; const PORT = process.env.PORT || '5190';
const browser = await chromium.launch({ channel: 'chromium', args: process.env.UNCAP ? ['--disable-frame-rate-limit', '--disable-gpu-vsync'] : [] });
const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
await page.evaluate(() => { window.__GAME__.tune({ RUN: { startTime: 999 } }); window.__GAME__.start(); });
await page.waitForFunction(() => window.__GAME__.assetsReady().on && window.__GAME__.boats().length > 0, null, { timeout: 30000 });
const all = [];
const run = async (label, poseFn, follow) => {
  await page.evaluate(poseFn); await page.waitForTimeout(600);
  await page.evaluate(() => { window.__fd = []; window.__dc = []; window.__tr = []; let l = performance.now(); const f = (t) => { if (!window.__fdOn) return; window.__fd.push(t - l); l = t; const d = window.__THREE_GAME_DIAGNOSTICS__; window.__dc.push(d.renderer.calls); window.__tr.push(d.renderer.triangles); requestAnimationFrame(f); }; window.__fdOn = true; requestAnimationFrame(f); });
  const t0 = Date.now();
  while (Date.now() - t0 < 10000) { if (follow) await page.evaluate(follow); await page.waitForTimeout(250); }
  const r = await page.evaluate(() => { window.__fdOn = false; return { fd: window.__fd.slice(2), dc: window.__dc, tr: window.__tr }; });
  const fd = r.fd.slice().sort((a, b) => a - b); const q = (p) => fd[Math.floor(p * (fd.length - 1))]; all.push(...r.fd);
  console.log('PERF', MOBILE ? 'mobile' : 'desktop', label, JSON.stringify({ frames: fd.length, median: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), p99: +q(0.99).toFixed(2), max: +fd.at(-1).toFixed(1), over20: fd.filter((x) => x > 20).length, callsMax: Math.max(...r.dc), trisMax: Math.max(...r.tr) }));
};
await run('marina', () => window.__GAME__.place(-44, 3, 150, Math.PI, 0));
const followKind = (k) => `(() => { const G = window.__GAME__; const b = G.boats().find((q) => q.kind === '${k}' && q.moving); const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw); G.place(b.x + Math.cos(b.yaw) * 6 - fx * 2, 3, b.z - Math.sin(b.yaw) * 6 - fz * 2, b.yaw + Math.PI / 2, 0); })()`;
await run('sail-follow', followKind('sail'), followKind('sail'));
await run('rib-follow', followKind('rib'), followKind('rib'));
await run('ferry-follow', followKind('ferry'), followKind('ferry'));
const fd = all.slice().sort((a, b) => a - b); const q = (p) => fd[Math.floor(p * (fd.length - 1))];
console.log('ALL', MOBILE ? 'mobile' : 'desktop', JSON.stringify({ frames: fd.length, median: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), max: +fd.at(-1).toFixed(1) }));
console.log('ERRORS', JSON.stringify(errors));
await browser.close();
