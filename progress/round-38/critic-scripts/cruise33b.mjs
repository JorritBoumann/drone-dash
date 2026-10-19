// Round 33 critic (new, cruise33b): local pop check. Same flight as cruise33.mjs, no shots. The frame is split into a
// 32 x 18 tile grid; a tile pop = a tile whose change is over 3x its own median of the 12 frames round it and over 12.
// Logged: tile pops per pass, how many fall on frames where the detail chunk count changed, and the top rows.
// Base: fast flight at cruise height, fixed step 60 Hz, a frame rendered every step (manualRender).
// Two straight passes per seed (along x=22 heading -z, along z=22 heading -x) at SPEED m/s (default 20) and ALT (24 m).
// Per frame: mean abs pixel change against the last frame (every 8th pixel), triangles, draw calls, detail chunks.
// A pop = a frame whose change is over 1.8x the median of the 12 frames round it (and over 1.5). Shots at 3 points per
// pass (for the blind A/B). PORT=5191 (round 33) or 5192 (round 32 control). MOBILE=1 for iPhone 13 landscape.
import { chromium, devices } from '@playwright/test';
const OUT = (process.env.OUTDIR || new URL('../critic/', import.meta.url).pathname);
const PORT = process.env.PORT || '5191'; const TAG = PORT === '5192' ? 'r33c' : 'r34';
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
    const shotsAt = [];
    let done = 0;
    for (const target of [...shotsAt, N]) {
      await page.evaluate(([axis, yaw, ALT, SPEED, L, step, target]) => {
        const G = window.__GAME__; const c = document.getElementById('game-canvas'); const gl = c.getContext('webgl2'); const W = c.width, H = c.height; const cr = window.__cr;
        const buf = new Uint8Array(W * H * 4);
        for (; cr.k < target; cr.k++) { const s = L - cr.k * step; const p = axis === 'z' ? [22, ALT, s] : [s, ALT, 22]; G.place(...p, yaw, SPEED); const d = G.advance(1 / 60, true);
          gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf); const TX = 32, TY = 18; const sm = new Uint8Array(W * H / 16 * 3 + 3); let j = 0; for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) { const i = (y * W + x) * 4; sm[j++] = buf[i]; sm[j++] = buf[i + 1]; sm[j++] = buf[i + 2]; }
          let diff = null; if (cr.prev) { const w4 = Math.ceil(W / 4), h4 = Math.ceil(H / 4); const acc = new Float64Array(TX * TY), cnt = new Float64Array(TX * TY); let q = 0; for (let y = 0; y < h4; y++) for (let x = 0; x < w4; x++, q += 3) { const t = Math.min(TX - 1, Math.floor(x * TX / w4)) + TX * Math.min(TY - 1, Math.floor(y * TY / h4)); acc[t] += Math.abs(sm[q] - cr.prev[q]) + Math.abs(sm[q + 1] - cr.prev[q + 1]) + Math.abs(sm[q + 2] - cr.prev[q + 2]); cnt[t]++; } diff = Array.from(acc, (v, i) => +(v / cnt[i] / 3).toFixed(1)); } cr.prev = sm;
          const D = window.__THREE_GAME_DIAGNOSTICS__; cr.rows.push([cr.k, diff, D.renderer.triangles, D.renderer.calls, D.detail ? D.detail.chunks : null]); }
      }, [axis, yaw, ALT, SPEED, L, step, target]);
      if (target !== N) { await page.screenshot({ path: OUT + `cruise34-${TAG}${MOBILE ? '-m' : ''}-${SEED}-${pass}-${++done}.jpg`, type: 'jpeg', quality: 80 }); }
    }
    const rows = await page.evaluate(() => window.__cr.rows);
    const T = rows[1][1].length; let pops = 0, popsOnChunk = 0; const top = [];
    for (let i = 1; i < rows.length; i++) { if (!rows[i][1]) continue; const chunkChange = rows[i][4] !== rows[i - 1][4]; let hit = 0;
      for (let t = 0; t < T; t++) { const w = []; for (let k = Math.max(1, i - 6); k <= Math.min(rows.length - 1, i + 6); k++) if (k !== i) w.push(rows[k][1][t]); w.sort((p, q) => p - q); const med = w[w.length >> 1]; const v = rows[i][1][t];
        if (v > 12 && v > 3 * Math.max(med, 1)) { hit++; top.push([rows[i][0], t % 32, Math.floor(t / 32), v, med, chunkChange ? 'chunk' : '']); } }
      if (hit) { pops++; if (chunkChange) popsOnChunk++; } }
    top.sort((p, q) => q[3] / Math.max(q[4], 1) - p[3] / Math.max(p[4], 1));
    console.log('TILEPOPS', TAG, MOBILE ? 'm' : 'd', SEED, pass, JSON.stringify({ frames: rows.length, framesWithTilePop: pops, onChunkChange: popsOnChunk, chunkChanges: rows.slice(1).filter((r, i) => r[4] !== rows[i][4]).length, tilePops: top.length, top: top.slice(0, 8) }));
  }
  if (errs.length) console.log('ERRS', JSON.stringify(errs.slice(0, 3)));
  await ctx.close();
}
await browser.close();
