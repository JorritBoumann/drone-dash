// Round 28 critic (new): real-time traffic overlap probe. The game runs live (no manualRender); an in-page rAF loop checks
// every frame for car-car box overlaps (same test as street-probe.mjs, boxes shrunk 0.1 m). Sampling starts the frame rush
// is switched on (street-probe.mjs waits 2 s, so spawn overlaps at the switch would be missed). Per seed: 20 s normal,
// then rush on for 40 s, off 10 s, on 30 s. The drone hovers at street level so the near cars are in LOD and moving.
import { chromium } from '@playwright/test';
const seeds = (process.env.SEEDS || '4,4,4,22,130,58').split(',');
const browser = await chromium.launch({ channel: 'chromium' });
for (const seed of seeds) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  await page.goto('http://127.0.0.1:' + (process.env.PORT || 5190) + '/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
  await page.evaluate((L) => { window.__LONG = L; }, !!process.env.LONG);
  await page.evaluate(() => {
    const G = window.__GAME__; if (window.__LONG) G.tune({ RUN: { startTime: 1000 } }); G.start();
    const obb = (a, pad) => { const l = a.len / 2 + pad, w = a.wid / 2 + pad; return { c: [a.x, a.z], ax: [[a.fx, a.fz], [-a.fz, a.fx]], h: [l, w] }; };
    const sep = (A, B) => { for (const ax of [...A.ax, ...B.ax]) { const p = (O) => O.ax.reduce((s, u, i) => s + Math.abs(u[0] * ax[0] + u[1] * ax[1]) * O.h[i], 0); const dc = Math.abs((B.c[0] - A.c[0]) * ax[0] + (B.c[1] - A.c[1]) * ax[1]); if (dc > p(A) + p(B)) return true; } return false; };
    const S = window.__TP = { frames: 0, pairs: 0, ev: [], phase: 'normal', t0: performance.now(), maxDt: 0, last: performance.now() };
    const loop = () => { const now = performance.now(); S.maxDt = Math.max(S.maxDt, now - S.last); S.last = now; S.frames++;
      const G = window.__GAME__; if (G) { try { G.place(22, 2.5, 40, 0, 0); } catch {} const cars = G.traffic().filter((v) => v.kind === 'car');
        for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) { const a = cars[i], b = cars[j]; if (Math.abs(a.x - b.x) > 9 || Math.abs(a.z - b.z) > 9) continue;
          if (!sep(obb(a, -0.1), obb(b, -0.1))) { S.pairs++; if (S.ev.length < 40) S.ev.push({ st: window.__THREE_GAME_DIAGNOSTICS__ && window.__THREE_GAME_DIAGNOSTICS__.state, ph: S.phase, t: +((now - S.t0) / 1000).toFixed(2), a: [a.type, +a.x.toFixed(1), +a.z.toFixed(1), a.mode, a.fx, a.fz], b: [b.type, +b.x.toFixed(1), +b.z.toFixed(1), b.mode, b.fx, b.fz], d: +Math.hypot(a.x - b.x, a.z - b.z).toFixed(2) }); } } }
      requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
  const phase = async (name, on, secs) => { await page.evaluate(([n, on]) => { window.__TP.phase = n; window.__GAME__.rush(on); }, [name, on]); await page.waitForTimeout(secs * 1000); };
  if (process.env.PLAN === 'single') { await phase('normal', false, 20); await phase('rush1', true, 80); } else { await phase('normal', false, 20); await phase('rush1', true, 40); await phase('off', false, 10); await phase('rush2', true, 30); }
  const r = await page.evaluate(() => { const S = window.__TP; return { frames: S.frames, pairs: S.pairs, maxDt: Math.round(S.maxDt), ev: S.ev, state: window.__THREE_GAME_DIAGNOSTICS__.state }; });
  const byPh = {}; for (const e of r.ev) byPh[e.ph + '/' + e.st] = (byPh[e.ph + '/' + e.st] || 0) + 1;
  console.log('SEED', seed, JSON.stringify({ frames: r.frames, pairFrames: r.pairs, maxDt: r.maxDt, state: r.state, byPhase: byPh }));
  for (const e of r.ev.filter((e, i, A) => i === 0 || e.t - A[i - 1].t > 0.5).slice(0, 12)) console.log('  EV', JSON.stringify(e));
  await page.context().close();
}
await browser.close();
