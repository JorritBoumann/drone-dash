// Round 31: GPU cost of the water and the boats. Fixed camera poses; each frame drawn through the real pipeline
// (renderFrom), timed with EXT_disjoint_timer_query_webgl2 when the browser has it, else with a CPU timer around
// render + a 1-pixel readPixels (forces the GPU to finish). Water on / off and boats on / off give the pass cost.
// Also the draw calls and triangles per pose. DEV=desktop|phone SEEDS=130,22 node perf-water.mjs
import { chromium, devices } from '@playwright/test';
const PORT = process.env.PORT || 5190;
const DEV = process.env.DEV || 'desktop';
const SEEDS = (process.env.SEEDS || '130,22').split(',').map(Number);
const POSES = {
  cruise: [10, 34, 128, 40, 0, 215],
  low: [-30, 2.2, 182, 60, 0.6, 205],
  marina: [-12, 22, 146, -46, 0, 178],
  city: [0, 30, 40, 0, 10, -40],
};
const N = Number(process.env.N || 40);
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext(DEV === 'phone' ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
for (const seed of SEEDS) {
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/?seed=${seed}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
  await page.waitForFunction(() => window.__GAME__.boats().length > 0, null, { timeout: 30000 });
  await page.waitForTimeout(500);
  for (const [name, p] of Object.entries(POSES)) {
    const r = await page.evaluate(async ([p, N]) => {
      const G = window.__GAME__;
      const gl = document.querySelector('canvas').getContext('webgl2');
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      G.place(p[3] * 0.5 + p[0] * 0.5, Math.max(4, p[1]), Math.min(150, p[2]), 0, 0);
      G.advance(0.2, false);
      const px = new Uint8Array(4);
      const frame = async () => {
        if (ext) {
          const q = gl.createQuery();
          gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
          G.renderFrom(...p);
          gl.endQuery(ext.TIME_ELAPSED_EXT);
          for (let k = 0; k < 200; k++) {
            await new Promise((r) => setTimeout(r, 2));
            if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
          }
          const dis = gl.getParameter(ext.GPU_DISJOINT_EXT);
          const ns = gl.getQueryParameter(q, gl.QUERY_RESULT);
          gl.deleteQuery(q);
          return dis ? null : ns / 1e6;
        }
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        const t0 = performance.now();
        G.renderFrom(...p);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        return performance.now() - t0;
      };
      const run = async (water, boats) => {
        G.waterOn(water); G.boatsOn(boats);
        const ts = [];
        for (let i = 0; i < 4; i++) await frame();
        for (let i = 0; i < N; i++) { const t = await frame(); if (t !== null) ts.push(t); }
        ts.sort((a, b) => a - b);
        const med = ts[Math.floor(ts.length / 2)], p95 = ts[Math.floor(ts.length * 0.95)];
        return { med: +med.toFixed(3), p95: +p95.toFixed(3) };
      };
      const all = await run(true, true);
      const stats = G.renderStats();
      const noWater = await run(false, true);
      const noBoats = await run(true, false);
      G.waterOn(true); G.boatsOn(true);
      return { timer: ext ? 'gpu' : 'cpu+readPixels', all, noWater, noBoats, waterMs: +(all.med - noWater.med).toFixed(3), boatsMs: +(all.med - noBoats.med).toFixed(3), calls: stats.calls, tris: stats.tris };
    }, [p, N]);
    console.log('PERF', DEV, seed, name, JSON.stringify(r));
  }
  await page.close();
}
await browser.close();
