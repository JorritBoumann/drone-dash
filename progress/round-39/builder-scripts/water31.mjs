// Round 31 critic (new): water views (game camera and free camera), flat-frame check per view, GPU time with water on/off,
// and a grid-snap pop test. Deterministic: manualRender + advance. PORT=5190 (round 31) or 5192 (round 30 control).
// MOBILE=1 for iPhone 13 landscape. SEEDS default 130,22,33,58 (golden, morning, dusk, noon). SHOTS=0 to skip screenshots.
import { chromium, devices } from '@playwright/test';
const OUT = process.env.OUTDIR || new URL('../critic/', import.meta.url).pathname;
const PORT = process.env.PORT || '5190'; const TAG = PORT === '5192' ? 'r30' : 'r31';
const MOBILE = !!process.env.MOBILE; const SEEDS = (process.env.SEEDS || '130,22,33,58').split(',').map(Number);
const SHOTS = process.env.SHOTS !== '0'; const GPU = process.env.GPU !== '0';
const SUN = { 0: [-0.72, 0.34, -0.6], 1: [0.55, 0.62, -0.56], 2: [0.78, 0.24, 0.58], 3: [-0.35, 0.72, 0.6] };
const MOODOF = { 130: 0, 11: 0, 22: 1, 33: 2, 58: 3, 7: 1, 44: 0, 91: 1 };
const browser = await chromium.launch({ channel: 'chromium' });
for (const SEED of SEEDS) {
  const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}${MOBILE ? '' : '&post=1'}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
  await page.waitForFunction(() => window.__GAME__.assetsReady().on, null, { timeout: 30000 });
  await page.evaluate(() => { const G = window.__GAME__; G.advance(3, false); window.__GAME__.hideDebugUi?.(true); });
  const post = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.renderer?.post);
  const sd = SUN[MOODOF[SEED] ?? 0]; const h = Math.hypot(sd[0], sd[2]); const sx = sd[0] / h, sz = sd[2] / h;
  const k = 171 / Math.max(Math.abs(sx), Math.abs(sz));
  // free-camera views: [name, cam xyz, target xyz]
  const views = [
    ['postcard', [0, 140, 430], [0, 0, 120]],
    ['horizon', [172, 6, 0], [700, 1, 0]],
    ['glint', [sx * k, 14, sz * k], [sx * (k + 110), 0, sz * (k + 110)]],
    ['marina', [-14, 9, 214], [-44, 0, 172]],
    ['marina-high', [-44, 34, 136], [-44, 0, 182]],
    ['tiling', [205, 70, 40], [215, 0, 60]],
    ['shoreline', [170, 3.0, 120], [166, 0, 40]],
  ];
  // game-camera views: [name, drone xyz, yaw]  (forward = (-sin yaw, -cos yaw))
  const game = [
    ['g-cruise', [140, 24, 30], -Math.PI / 2],
    ['g-low', [182, 2.0, 20], -Math.PI / 2],
    ['g-shore', [170, 4, -40], Math.PI],
    ['g-marina', [-44, 6, 150], Math.PI],
  ];
  const res = { seed: SEED, tag: TAG, mobile: MOBILE, post, views: {} };
  const shot = async (name) => { if (SHOTS) await page.screenshot({ path: OUT + `water31-${TAG}${MOBILE ? '-m' : ''}-${SEED}-${name}.jpg`, type: 'jpeg', quality: 80 }); };
  const flatCheck = () => page.evaluate(() => {
    const c = document.getElementById('game-canvas'); const gl = c.getContext('webgl2'); const buf = new Uint8Array(4); const out = new Set(); let black = 0, nan = 0;
    for (let i = 0; i < 25; i++) { gl.readPixels(Math.floor(c.width * (0.05 + 0.9 * (i % 5) / 4)), Math.floor(c.height * (0.05 + 0.9 * Math.floor(i / 5) / 4)), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf); out.add(buf.slice(0, 3).join(',')); if (buf[0] + buf[1] + buf[2] < 6) black++; }
    return { distinct: out.size, black };
  });
  for (const [name, cam, tgt] of views) {
    await page.evaluate(([c, t]) => { window.__GAME__.advance(1 / 60, false); window.__GAME__.renderFrom(c[0], c[1], c[2], t[0], t[1], t[2]); }, [cam, tgt]);
    const f = await flatCheck(); res.views[name] = f;
    await shot(name);
  }
  if (TAG === 'r31') {
    // boat close-ups: a rib (fast), the ferry and a sailboat, camera behind and above
    const boats = await page.evaluate(() => window.__GAME__.boats());
    for (const kind of ['rib', 'ferry', 'sail']) {
      const b = boats.find((q) => q.kind === kind && q.moving); if (!b) continue;
      const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw); const back = kind === 'ferry' ? 34 : 16, up = kind === 'ferry' ? 12 : 6;
      await page.evaluate(([b, fx, fz, back, up]) => { window.__GAME__.advance(1 / 60, false); window.__GAME__.renderFrom(b.x - fx * back + fz * back * 0.45, up, b.z - fz * back - fx * back * 0.45, b.x, 0, b.z); }, [b, fx, fz, back, up]);
      res.views['boat-' + kind] = await flatCheck(); await shot('boat-' + kind);
    }
  }
  for (const [name, p, yaw] of game) {
    await page.evaluate(([p, yaw]) => { const G = window.__GAME__; for (let i = 0; i < 40; i++) { G.place(p[0], p[1], p[2], yaw, 0); G.advance(1 / 60, false); } G.advance(1 / 60, true); }, [p, yaw]);
    res.views[name] = await flatCheck(); await shot(name);
  }
  // grid-snap pop: same time, camera moved 2 cm across a 2.5 m (3.2 m phone) snap line vs 2 cm with no snap line
  if (TAG === 'r31') {
    const snap = MOBILE ? 3.2 : 2.5;
    res.pop = await page.evaluate((snap) => {
      const G = window.__GAME__; const c = document.getElementById('game-canvas'); const gl = c.getContext('webgl2');
      const W = c.width, H = c.height; const grab = () => { const b = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
      const diff = (a, b) => { let s = 0, n = 0, big = 0; for (let i = 0; i < a.length; i += 16) { const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); s += d; n++; if (d > 24) big++; } return { mean: +(s / n).toFixed(2), bigPct: +(100 * big / n).toFixed(2) }; };
      const out = {};
      for (const [nm, y] of [['low', 4], ['cruise', 25]]) {
        const z0 = 0, base = 200; const tgt = [600, 0, 40];
        const r = (x) => { G.renderFrom(x, y, z0, tgt[0], tgt[1], tgt[2]); return grab(); };
        const edge = Math.round(base / snap) * snap + snap / 2; // snap boundary
        const a = r(edge - 0.01), b = r(edge + 0.01); const c0 = r(edge - snap / 2 + 0.2), d0 = r(edge - snap / 2 + 0.22);
        out[nm] = { across: diff(a, b), control: diff(c0, d0) };
      }
      return out;
    }, snap);
  }
  // GPU time per frame (timer query), water on vs off, in three water-heavy views and one city view
  if (GPU) {
    res.gpu = await page.evaluate(async (views) => {
      const G = window.__GAME__; const c = document.getElementById('game-canvas'); const gl = c.getContext('webgl2');
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'); const px = new Uint8Array(4);
      const wait = () => new Promise((r) => setTimeout(r, 20));
      const measure = async (cam, tgt) => {
        const g = [], cpu = [];
        for (let i = 0; i < 24; i++) {
          G.advance(1 / 60, false);
          let q = null; if (ext) { q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); }
          const t0 = performance.now(); G.renderFrom(...cam, ...tgt); if (ext) gl.endQuery(ext.TIME_ELAPSED_EXT); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); cpu.push(performance.now() - t0);
          if (q) { let tries = 0; while (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) && tries++ < 50) await wait(); if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) g.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(q); }
          await wait();
        }
        const med = (a) => { const s = a.slice(4).sort((x, y) => x - y); return s.length ? +s[s.length >> 1].toFixed(3) : null; };
        const p95 = (a) => { const s = a.slice(4).sort((x, y) => x - y); return s.length ? +s[Math.floor(s.length * 0.95)].toFixed(3) : null; };
        return { gpuMed: med(g), gpuP95: p95(g), syncMed: med(cpu), syncP95: p95(cpu), n: g.length };
      };
      const out = { ext: !!ext };
      for (const [nm, cam, tgt] of views) {
        G.waterOn?.(true); const on = await measure(cam, tgt);
        let off = null; if (G.waterOn) { G.waterOn(false); off = await measure(cam, tgt); G.waterOn(true); }
        out[nm] = { on, off, water: off && on.gpuMed != null ? +(on.gpuMed - off.gpuMed).toFixed(3) : null, waterSync: off ? +(on.syncMed - off.syncMed).toFixed(3) : null };
      }
      return out;
    }, [['horizon', [172, 6, 0], [700, 1, 0]], ['postcard', [0, 140, 430], [0, 0, 120]], ['g-low-ish', [175, 9, 20], [260, 0, 20]], ['city', [60, 30, 60], [0, 5, 0]]]);
  }
  res.errs = errs.slice(0, 5);
  console.log('WATER', JSON.stringify(res));
  await ctx.close();
}
await browser.close();
