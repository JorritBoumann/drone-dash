// Round 45 critic: perf-street41 with the sound ON (strict autoplay, a real key press first), the audio clock's late
// notes and resyncs, and a click / dropout count on the master output during each 12 s window. CPU=4 throttles the CPU.
// Round 34 critic: perf-street with UNCAP=1 (no vsync, no frame-rate cap): frame time is then the real cost per frame.
// Round 22 critic: frame time at street level (4 m) down a downtown avenue, 12 s normal then 12 s rush hour. MOBILE=1 for iPhone 13.
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
const recSrc = fs.readFileSync(new URL('./rec45c.mjs', import.meta.url), 'utf8');
const TAP = recSrc.slice(recSrc.indexOf('const TAPHOOK = () => {') + 'const TAPHOOK = '.length, recSrc.indexOf('\nconst ROADS')).trim().replace(/;$/, '');
const MOBILE = !!process.env.MOBILE; const SEED = process.env.SEED || '22';
const browser = await chromium.launch({ channel: 'chromium', args: ['--autoplay-policy=document-user-activation-required', ...(process.env.UNCAP ? ['--disable-frame-rate-limit', '--disable-gpu-vsync'] : [])] });
const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage(); await page.addInitScript(`(${TAP})()`); const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://127.0.0.1:5197/?seed=' + SEED + (process.env.Q || ''), { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
if (process.env.CPU) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.CPU) }); }
await page.keyboard.press('ShiftLeft'); await page.waitForTimeout(300);
await page.evaluate(() => { window.__GAME__.tune({ RUN: { startTime: 999 } }); });
await page.keyboard.press('Enter');
await page.waitForTimeout(1000);
const run = async (label, rush) => {
  await page.evaluate((r) => window.__GAME__.rush(r), rush);
  if (rush) await page.waitForTimeout(3000);
  await page.evaluate(() => window.__GAME__.place(22, 4, -120, Math.PI, 8));
  await page.waitForTimeout(300);
  await page.evaluate(() => { window.__fd = []; window.__dc = []; window.__st = []; let l = performance.now(); const f = (t) => { if (!window.__fdOn) return; window.__fd.push(t - l); l = t; const d = window.__THREE_GAME_DIAGNOSTICS__; window.__dc.push(d.renderer.calls); (window.__tr ||= []).push(d.renderer.triangles); if (window.__fd.length % 30 === 0) window.__st.push([d.street.cars, d.street.vans, d.street.peopleDrawn, d.street.msTraffic, d.street.msPeople, d.renderer.triangles]); requestAnimationFrame(f); }; window.__fdOn = true; requestAnimationFrame(f); });
  const a0 = await page.evaluate(() => { const c = window.__cap; c.chunks = c.chunks.map(() => []); c.on = true; const m = window.__THREE_GAME_DIAGNOSTICS__.audio.music; return { late: m.late, resyncs: m.resyncs, actx: window.__THREE_GAME_DIAGNOSTICS__.audio.state }; });
  const t0 = Date.now(); let wDown = false;
  while (Date.now() - t0 < 12000) {
    const d = await page.evaluate(() => { const d = window.__THREE_GAME_DIAGNOSTICS__; return { sp: d.player.speed, x: d.player.position.x, yaw: d.player.yaw }; });
    const want = d.sp < 10; if (want !== wDown) { wDown = want; await (want ? page.keyboard.down('KeyW') : page.keyboard.up('KeyW')); }
    await page.waitForTimeout(100);
  }
  if (wDown) await page.keyboard.up('KeyW');
  const au = await page.evaluate(() => { const c = window.__cap; c.on = false; const L = c.chunks[0]; const n = L.reduce((a, b) => a + b.length, 0); const x = new Float32Array(n); let o = 0; for (const a of L) { x.set(a, o); o += a.length; } c.chunks = c.chunks.map(() => []);
    const sr = c.sr, w = Math.round(sr * 0.005); let clicks = 0, lastHit = -1e9, zeroRun = 0, drop = 0; const d2 = new Float32Array(n); for (let i = 1; i < n - 1; i++) d2[i] = Math.abs(x[i + 1] - 2 * x[i] + x[i - 1]);
    let acc = 0; for (let i = 0; i < Math.min(n, 2 * w + 1); i++) acc += d2[i] * d2[i];
    for (let i = w + 1; i < n - w - 1; i++) { acc += d2[i + w] * d2[i + w] - d2[i - w - 1] * d2[i - w - 1]; const loc = Math.sqrt(Math.max(0, acc - d2[i] * d2[i]) / (2 * w)) + 1e-9; if (d2[i] > 8 * loc && d2[i] > 0.01 && i - lastHit > sr * 0.02) { clicks++; lastHit = i; } }
    for (let i = 0; i < n; i++) { if (x[i] === 0) { zeroRun++; if (zeroRun === Math.round(sr * 0.005)) drop++; } else zeroRun = 0; }
    let s = 0; for (let i = 0; i < n; i++) s += x[i] * x[i];
    const m = window.__THREE_GAME_DIAGNOSTICS__.audio.music; return { seconds: +(n / sr).toFixed(1), rmsDb: +(10 * Math.log10(s / Math.max(1, n) + 1e-24)).toFixed(1), clicks, dropouts5ms: drop, late: m.late, resyncs: m.resyncs, actx: window.__THREE_GAME_DIAGNOSTICS__.audio.state, sprite: window.__THREE_GAME_DIAGNOSTICS__.audio.sfx.sprite }; });
  console.log('AUDIO', label, JSON.stringify({ before: a0, after: au, lateInWindow: au.late - a0.late, resyncsInWindow: au.resyncs - a0.resyncs }));
  const r = await page.evaluate(() => { window.__fdOn = false; const tm = Math.max(...(window.__tr || [0])); window.__tr = []; return { fd: window.__fd.slice(2), dc: window.__dc, st: window.__st, trisMax: tm, assets: window.__GAME__.assetsReady().on }; });
  const fd = r.fd.slice().sort((a, b) => a - b); const q = (p) => fd[Math.floor(p * (fd.length - 1))];
  const avg = (i) => +(r.st.reduce((s, x) => s + x[i], 0) / r.st.length).toFixed(3);
  console.log('PERF', MOBILE ? 'mobile' : 'desktop', label, JSON.stringify({ frames: fd.length, median: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), p99: +q(0.99).toFixed(2), max: +fd.at(-1).toFixed(1), over20: fd.filter((x) => x > 20).length, callsMax: Math.max(...r.dc), trisMax: r.trisMax, assets: r.assets, callsMed: r.dc.sort((a, b) => a - b)[r.dc.length >> 1], cars: avg(0), vans: avg(1), peopleDrawn: avg(2), msTraffic: avg(3), msPeople: avg(4), tris: Math.max(...r.st.map((x) => x[5])) }));
};
await run('normal', false);
await run('rush', true);
console.log('ERRORS', JSON.stringify(errors));
await browser.close();
