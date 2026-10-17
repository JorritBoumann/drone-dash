// Round 31 critic (new, fixes water31.mjs): every pixel read happens in the same task as the render (the drawing buffer is
// not preserved). (1) flat / black check per water view with bloom on; (2) wake contrast per mood: mean luminance on the
// trail 4-12 m behind the stern against open water ahead of the bow, from 4 camera azimuths; (3) motion sweep: the camera
// moves 0.25 m per 1/60 s frame (15 m/s) with time running, and the per-frame image change is split into frames that cross
// a grid snap line and frames that do not; (4) frame cost by throughput (30 renders, one sync), water on/off.
// PORT=5192 runs only (1) and (4) without the on/off split (round 30 control). MOBILE=1 for iPhone 13 landscape.
import { chromium, devices } from '@playwright/test';
const PORT = process.env.PORT || '5191'; const R30 = PORT === '5192';
const MOBILE = !!process.env.MOBILE; const SEEDS = (process.env.SEEDS || '130,22,33,58').split(',').map(Number);
const SUN = { 0: [-0.72, 0.34, -0.6], 1: [0.55, 0.62, -0.56], 2: [0.78, 0.24, 0.58], 3: [-0.35, 0.72, 0.6] };
const MOODOF = { 130: 0, 22: 1, 33: 2, 58: 3 };
const browser = await chromium.launch({ channel: 'chromium' });
for (const SEED of SEEDS) {
  const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
  await page.waitForFunction(() => window.__GAME__.assetsReady().on, null, { timeout: 30000 });
  await page.evaluate(() => window.__GAME__.advance(3, false));
  const sd = SUN[MOODOF[SEED] ?? 0]; const h = Math.hypot(sd[0], sd[2]); const sx = sd[0] / h, sz = sd[2] / h; const k = 171 / Math.max(Math.abs(sx), Math.abs(sz));
  const views = [['postcard', [0, 140, 430], [0, 0, 120]], ['horizon', [172, 6, 0], [700, 1, 0]], ['glint', [sx * k, 14, sz * k], [sx * (k + 110), 0, sz * (k + 110)]], ['glint-low', [sx * k, 2.5, sz * k], [sx * (k + 200), 0, sz * (k + 200)]],
    ['marina', [-14, 9, 214], [-44, 0, 172]], ['shoreline', [170, 3.0, 120], [166, 0, 40]], ['straight-down', [200, 40, 0], [200.01, 0, 0.01]], ['far-high', [0, 300, 700], [0, 0, 0]]];
  const out = { seed: SEED, port: PORT, mobile: MOBILE, flat: {}, errs };
  out.post = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.renderer?.post);
  // (1) flat / black / distinct, 49 pixels, in-frame; 30 frames per view with time running
  out.flat = await page.evaluate((views) => {
    const G = window.__GAME__; const c = document.getElementById('game-canvas'); const gl = c.getContext('webgl2'); const b = new Uint8Array(4); const r = {};
    for (const [nm, cam, tgt] of views) {
      let flat = 0, minD = 99, black = 0;
      for (let f = 0; f < 30; f++) {
        G.advance(1 / 60, false); G.renderFrom(...cam, ...tgt); const s = new Set();
        for (let i = 0; i < 49; i++) { gl.readPixels(Math.floor(c.width * (0.04 + 0.92 * (i % 7) / 6)), Math.floor(c.height * (0.04 + 0.92 * Math.floor(i / 7) / 6)), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b); s.add(b.slice(0, 3).join(',')); if (b[0] + b[1] + b[2] < 4) black++; }
        if (s.size <= 1) flat++; minD = Math.min(minD, s.size);
      }
      r[nm] = { frames: 30, flat, minDistinct: minD, blackPx: black };
    }
    return r;
  }, views);
  if (!R30 && !MOBILE) {
    // (2) wake contrast
    out.wake = await page.evaluate(() => {
      const G = window.__GAME__; const c = document.getElementById('game-canvas'); const gl = c.getContext('webgl2'); const W = c.width, H = c.height;
      const proj = (cam, tgt, p) => { const f = [tgt[0] - cam[0], tgt[1] - cam[1], tgt[2] - cam[2]]; let l = Math.hypot(...f); f[0] /= l; f[1] /= l; f[2] /= l; let r = [f[1] * 0 - f[2] * 1, f[2] * 0 - f[0] * 0, f[0] * 1 - f[1] * 0]; r = [-f[2], 0, f[0]]; l = Math.hypot(...r); r = r.map((v) => v / l); const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]]; const d = [p[0] - cam[0], p[1] - cam[1], p[2] - cam[2]]; const z = d[0] * f[0] + d[1] * f[1] + d[2] * f[2]; const x = d[0] * r[0] + d[1] * r[1] + d[2] * r[2]; const y = d[0] * u[0] + d[1] * u[1] + d[2] * u[2]; const t = Math.tan(Math.PI / 6); return [((x / (z * t * W / H)) + 1) / 2 * W, ((y / (z * t)) + 1) / 2 * H]; };
      const lum = (x, y) => { const b = new Uint8Array(4 * 25); gl.readPixels(Math.round(x) - 2, Math.round(y) - 2, 5, 5, gl.RGBA, gl.UNSIGNED_BYTE, b); let s = 0; for (let i = 0; i < 25; i++) s += 0.2126 * b[i * 4] + 0.7152 * b[i * 4 + 1] + 0.0722 * b[i * 4 + 2]; return s / 25; };
      const res = {};
      for (const kind of ['rib', 'ferry', 'sail']) {
        const rows = [];
        for (let az = 0; az < 4; az++) {
          G.advance(0.5, false); const b = G.boats().find((q) => q.kind === kind && q.moving); const fp = G.boatFootprints().hulls.find((q) => q.kind === kind && q.moving);
          const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), px = Math.cos(b.yaw), pz = -Math.sin(b.yaw); const hl = fp.hl;
          const a = az * Math.PI / 2 + 0.6; const D = kind === 'ferry' ? 40 : 24; const cam = [b.x + Math.sin(a) * D, kind === 'ferry' ? 18 : 12, b.z + Math.cos(a) * D]; const tgt = [b.x, -0.7, b.z];
          G.renderFrom(...cam, ...tgt);
          let tr = 0, n1 = 0, op = 0, n2 = 0;
          for (const uu of [4, 7, 10, 13]) { const p = [b.x - fx * (hl * 1.25 + uu), -0.7, b.z - fz * (hl * 1.25 + uu)]; const s = proj(cam, tgt, p); if (s[0] > 3 && s[0] < W - 3 && s[1] > 3 && s[1] < H - 3) { tr += lum(s[0], s[1]); n1++; } }
          for (const [uu, vv] of [[-hl - 10, 0], [-hl - 14, 4], [-hl - 14, -4], [0, 14], [0, -14]]) { const p = [b.x - fx * uu + px * vv, -0.7, b.z - fz * uu + pz * vv]; const s = proj(cam, tgt, p); if (s[0] > 3 && s[0] < W - 3 && s[1] > 3 && s[1] < H - 3) { op += lum(s[0], s[1]); n2++; } }
          rows.push({ az, trail: n1 ? +(tr / n1).toFixed(1) : null, open: n2 ? +(op / n2).toFixed(1) : null, ratio: n1 && n2 ? +((tr / n1) / (op / n2)).toFixed(2) : null });
        }
        res[kind] = rows;
      }
      return res;
    });
    // (3) motion sweep
    out.sweep = await page.evaluate(() => {
      const G = window.__GAME__; const c = document.getElementById('game-canvas'); const gl = c.getContext('webgl2'); const W = c.width, H = c.height;
      const grab = () => { const b = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
      const diff = (a, b) => { let s = 0, n = 0; for (let i = 0; i < a.length; i += 28) { s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); n++; } return s / n; };
      const res = {};
      for (const [nm, y, freeze] of [['low-time', 4, false], ['cruise-time', 25, false], ['low-frozen', 4, true]]) {
        let prev = null; const snapRows = [], plainRows = [];
        for (let f = 0; f < 90; f++) {
          const x0 = 175 + f * 0.25, x1 = 175 + (f - 1) * 0.25;
          if (!freeze) G.advance(1 / 60, false);
          G.renderFrom(x0, y, 30, x0 + 300, 0, 60);
          const img = grab();
          if (prev) { const d = diff(prev, img); const crossed = Math.round(x0 / 2.5) !== Math.round(x1 / 2.5); (crossed ? snapRows : plainRows).push(d); }
          prev = img;
        }
        const med = (a) => { const s = a.slice().sort((p, q) => p - q); return +s[s.length >> 1].toFixed(2); };
        res[nm] = { snapFrames: snapRows.length, snapMedian: med(snapRows), snapMax: +Math.max(...snapRows).toFixed(2), plainFrames: plainRows.length, plainMedian: med(plainRows), plainP95: +plainRows.slice().sort((p, q) => p - q)[Math.floor(plainRows.length * 0.95)].toFixed(2) };
      }
      return res;
    });
  }
  // (4) throughput: 30 renders + one sync, best of 3, ms per frame
  out.cost = await page.evaluate(() => {
    const G = window.__GAME__; const c = document.getElementById('game-canvas'); const gl = c.getContext('webgl2'); const px = new Uint8Array(4);
    const run = (cam, tgt) => { let best = 1e9; for (let r = 0; r < 3; r++) { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); const t0 = performance.now(); for (let i = 0; i < 30; i++) { G.advance(1 / 60, false); G.renderFrom(...cam, ...tgt); } gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); best = Math.min(best, (performance.now() - t0) / 30); } return +best.toFixed(2); };
    const r = {}; const adv = (t) => { const t0 = performance.now(); for (let i = 0; i < 30; i++) G.advance(1 / 60, false); return (performance.now() - t0) / 30; };
    r.advanceOnly = +adv().toFixed(2);
    for (const [nm, cam, tgt] of [['horizon', [172, 6, 0], [700, 1, 0]], ['postcard', [0, 140, 430], [0, 0, 120]], ['low', [175, 9, 20], [260, 0, 20]], ['city', [60, 30, 60], [0, 5, 0]]]) {
      const on = run(cam, tgt); let off = null; if (G.waterOn) { G.waterOn(false); off = run(cam, tgt); G.waterOn(true); }
      r[nm] = { on, off, water: off != null ? +(on - off).toFixed(2) : null };
    }
    return r;
  });
  console.log('WATERB', JSON.stringify(out));
  await ctx.close();
}
await browser.close();
