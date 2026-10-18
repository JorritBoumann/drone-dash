// Round 33 critic (new): fast flight at cruise height, fixed step 60 Hz, a frame rendered every step (manualRender).
// Two straight passes per seed (along x=22 heading -z, along z=22 heading -x) at SPEED m/s (default 20) and ALT (24 m).
// Per frame: mean abs pixel change against the last frame (every 8th pixel), triangles, draw calls, detail chunks.
// A pop = a frame whose change is over 1.8x the median of the 12 frames round it (and over 1.5). Shots at 3 points per
// pass (for the blind A/B). PORT=5190 (round 33) or 5193 (round 32 control). MOBILE=1 for iPhone 13 landscape.
import { chromium, devices } from '@playwright/test';
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const PORT = process.env.PORT || '5190'; const TAG = PORT === '5193' ? 'r32c' : 'r33';
const MOBILE = !!process.env.MOBILE; const SPEED = +(process.env.SPEED || 20); const ALT = +(process.env.ALT || 24);
const browser = await chromium.launch({ channel: 'chromium' });
for (const SEED of (process.env.SEEDS || '130,22').split(',').map(Number)) {
  const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
  await page.waitForFunction(() => window.__GAME__.assetsReady().on, null, { timeout: 30000 });
  await page.addStyleTag({ content: '.hud, #hud, .hud-top, .hud-bottom, #touch-stick, #up-button, #down-button, #boost-button, #pause-button, .nav-arrow, .nav-diamond, #nav-distance, #gate-tag, #pop, #event-pop, #slip-pop, #medal-pop, #view-hint, #music-toggle { visibility: hidden !important; } .screen { display: none !important; }' });
  for (const [pass, axis] of [['ns', 'z'], ['ew', 'x']]) {
    const yaw = axis === 'z' ? 0 : Math.PI / 2; const L = 170; const step = SPEED / 60; const N = Math.floor((2 * L) / step);
    await page.evaluate(([axis, yaw, ALT, SPEED, L]) => { const G = window.__GAME__; const at = (s) => (axis === 'z' ? [22, ALT, s] : [s, ALT, 22]); window.__cr = { rows: [], prev: null, k: 0 };
      for (let i = 0; i < 90; i++) { G.place(...at(L), yaw, SPEED); G.advance(1 / 60, false); } }, [axis, yaw, ALT, SPEED, L]);
    const shotsAt = [Math.floor(N * 0.2), Math.floor(N * 0.5), Math.floor(N * 0.8)];
    let done = 0;
    for (const target of [...shotsAt, N]) {
      await page.evaluate(([axis, yaw, ALT, SPEED, L, step, target]) => {
        const G = window.__GAME__; const c = document.getElementById('game-canvas'); const gl = c.getContext('webgl2'); const W = c.width, H = c.height; const cr = window.__cr;
        const buf = new Uint8Array(W * H * 4);
        for (; cr.k < target; cr.k++) { const s = L - cr.k * step; const p = axis === 'z' ? [22, ALT, s] : [s, ALT, 22]; G.place(...p, yaw, SPEED); const d = G.advance(1 / 60, true);
          gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf); const sm = new Uint8Array(Math.ceil(buf.length / 32) * 3); let j = 0; for (let i = 0; i < buf.length; i += 32) { sm[j++] = buf[i]; sm[j++] = buf[i + 1]; sm[j++] = buf[i + 2]; }
          let diff = null; if (cr.prev) { let t = 0; for (let i = 0; i < sm.length; i++) t += Math.abs(sm[i] - cr.prev[i]); diff = t / sm.length; } cr.prev = sm;
          const D = window.__THREE_GAME_DIAGNOSTICS__; cr.rows.push([cr.k, diff, D.renderer.triangles, D.renderer.calls, D.detail ? D.detail.chunks : null]); }
      }, [axis, yaw, ALT, SPEED, L, step, target]);
      if (target !== N) { await page.screenshot({ path: OUT + `cruise33-${TAG}${MOBILE ? '-m' : ''}-${SEED}-${pass}-${++done}.jpg`, type: 'jpeg', quality: 80 }); }
    }
    const rows = await page.evaluate(() => window.__cr.rows);
    const d = rows.map((r) => r[1]); const pops = [];
    for (let i = 1; i < d.length; i++) { const w = d.slice(Math.max(1, i - 6), i).concat(d.slice(i + 1, i + 7)).filter((v) => v != null).sort((a, b) => a - b); const med = w[w.length >> 1]; if (d[i] > 1.5 && d[i] > 1.8 * med && !shotsAt.includes(rows[i][0])) pops.push([rows[i][0], +d[i].toFixed(2), +med.toFixed(2), rows[i][4] - rows[i - 1][4]]); }
    const sorted = d.filter((v) => v != null).sort((a, b) => a - b);
    const chunkJumps = rows.slice(1).map((r, i) => Math.abs(r[4] - rows[i][4])).filter((v) => v > 0).length;
    console.log('PASS', TAG, MOBILE ? 'm' : 'd', SEED, pass, JSON.stringify({ frames: rows.length, medianDiff: +sorted[sorted.length >> 1].toFixed(2), p99Diff: +sorted[Math.floor(sorted.length * 0.99)].toFixed(2), maxDiff: +sorted[sorted.length - 1].toFixed(2), pops: pops.length, popList: pops.slice(0, 12), chunkChanges: chunkJumps, maxTris: Math.max(...rows.map((r) => r[2])), medTris: rows.map((r) => r[2]).sort((a, b) => a - b)[rows.length >> 1], maxCalls: Math.max(...rows.map((r) => r[3])), medChunks: rows.map((r) => r[4]).sort((a, b) => a - b)[rows.length >> 1] }));
  }
  if (errs.length) console.log('ERRS', JSON.stringify(errs.slice(0, 3)));
  await ctx.close();
}
await browser.close();
