// Round 29 critic (new): traffic-rt28.mjs made deterministic, because the real-time browser runs at a 30 fps cap on this
// machine (a system process holds a full core). manualRender, the game stepped at DT (default 1/120 s, like round 28's
// 120 Hz runs; DT=0.0333 for 30 fps), the same car-car box test after every step. Per run: NORM s normal (varied so the
// rush starts from different traffic), then rush on for 80 s, drone hovering at street level at (22, 2.5, 40) as before.
// RUNS = seed:normal pairs. PORT for the round 28 build (control: does this probe see the round 28 bug?).
import { chromium } from '@playwright/test';
const RUNS = (process.env.RUNS || '4:20,4:27,4:33,22:20,130:20,58:20').split(',').map((s) => s.split(':').map(Number));
const DT = Number(process.env.DT || 1 / 120);
const browser = await chromium.launch({ channel: 'chromium' });
for (const [seed, norm] of RUNS) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  await page.goto('http://127.0.0.1:' + (process.env.PORT || 5191) + '/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
  const r = await page.evaluate(([norm, DT]) => {
    const G = window.__GAME__; G.tune({ RUN: { startTime: 1000 } }); G.start(); G.manualRender(true);
    const obb = (a, pad) => { const l = a.len / 2 + pad, w = a.wid / 2 + pad; return { c: [a.x, a.z], ax: [[a.fx, a.fz], [-a.fz, a.fx]], h: [l, w] }; };
    const sep = (A, B) => { for (const ax of [...A.ax, ...B.ax]) { const p = (O) => O.ax.reduce((s, u, i) => s + Math.abs(u[0] * ax[0] + u[1] * ax[1]) * O.h[i], 0); const dc = Math.abs((B.c[0] - A.c[0]) * ax[0] + (B.c[1] - A.c[1]) * ax[1]); if (dc > p(A) + p(B)) return true; } return false; };
    const S = { frames: 0, pairs: 0, ev: [], maxCars: 0 };
    const step = (ph, t) => { G.place(22, 2.5, 40, 0, 0); G.advance(DT, false); S.frames++;
      const cars = G.traffic().filter((v) => v.kind === 'car'); S.maxCars = Math.max(S.maxCars, cars.length);
      for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) { const a = cars[i], b = cars[j]; if (Math.abs(a.x - b.x) > 9 || Math.abs(a.z - b.z) > 9) continue;
        if (!sep(obb(a, -0.1), obb(b, -0.1))) { S.pairs++; if (S.ev.length < 30) S.ev.push({ ph, t: +t.toFixed(2), a: [a.type, +a.x.toFixed(1), +a.z.toFixed(1), a.mode], b: [b.type, +b.x.toFixed(1), +b.z.toFixed(1), b.mode] }); } } };
    G.rush(false); for (let t = 0; t < norm; t += DT) step('normal', t);
    G.rush(true); for (let t = 0; t < 80; t += DT) step('rush', t);
    return { ...S, state: window.__THREE_GAME_DIAGNOSTICS__.state };
  }, [norm, DT]);
  console.log('SEED', seed, 'normal', norm, 'dt', DT.toFixed(4), JSON.stringify({ frames: r.frames, pairFrames: r.pairs, maxCars: r.maxCars, state: r.state }));
  for (const e of r.ev.filter((e, i, A) => i === 0 || e.t - A[i - 1].t > 0.5).slice(0, 8)) console.log('  EV', JSON.stringify(e));
  await page.context().close();
}
await browser.close();
