// Round 32 builder: grid-snap pop test. Time frozen, fixed steps. (1) the critic's 2 cm test at 20 snap lines: the
// camera moves 2 cm across a snap line vs 2 cm with no line (control), at 4 m and 25 m, looking at the horizon.
// (2) a sweep: the camera steps 0.25 m per frame across 20 snap lines (50 m); per-frame change in the water band just
// below the horizon, split into frames that cross a snap line and frames that do not.
// Metric: mean absolute RGB difference (0-765) and % pixels changed by more than 24 levels, on the water band.
import { chromium } from '@playwright/test';
const MOBILE = !!process.env.MOBILE; const SEED = Number(process.env.SEED || 130);
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext(MOBILE ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:5190/?seed=${SEED}${MOBILE ? '' : '&post=1'}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
await page.waitForFunction(() => window.__GAME__.assetsReady().on, null, { timeout: 30000 });
await page.evaluate(() => { window.__GAME__.advance(3, false); window.__GAME__.hideDebugUi?.(true); });
const res = await page.evaluate((snap) => {
  const G = window.__GAME__; const c = document.getElementById('game-canvas'); const gl = c.getContext('webgl2'); const W = c.width, H = c.height;
  // water band: from 2% to 30% of the height below the horizon line (camera looks level-ish at the horizon)
  const grab = (y0, y1) => { const b = new Uint8Array(W * (y1 - y0) * 4); gl.readPixels(0, y0, W, y1 - y0, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
  const diff = (a, b) => { let s = 0, n = 0, big = 0; for (let i = 0; i < a.length; i += 12) { const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); s += d; n++; if (d > 24) big++; } return { mean: s / n, big: 100 * big / n }; };
  const out = {};
  for (const [nm, y] of [['low', 4], ['cruise', 25]]) {
    // the target sits on the horizon line row: aim 600 m out, 0 high; band = rows from 52% to 80% down (GL rows flipped)
    const y0 = Math.floor(H * 0.2), y1 = Math.floor(H * 0.48);
    const tgtOf = (x) => [x + 600, 0, 40];
    const r = (x) => { const t = tgtOf(x); G.renderFrom(x, y, 0, t[0], t[1], t[2]); return grab(y0, y1); };
    // (1) 2 cm across vs control at 20 lines
    const A = [], C = [];
    for (let k = 0; k < 20; k++) {
      const edge = (80 + k) * snap + snap / 2;
      A.push(diff(r(edge - 0.01), r(edge + 0.01)));
      C.push(diff(r(edge - snap / 2 + 0.2), r(edge - snap / 2 + 0.22)));
    }
    // (2) sweep 0.25 m per frame over 20 lines
    const S = [], P = []; let prev = null; const x0 = 80 * snap;
    for (let f = 0; f <= Math.round(20 * snap / 0.25); f++) {
      const x = x0 + f * 0.25; const img = r(x);
      if (prev) { const d = diff(prev, img); (Math.round((x - 0.25) / snap) !== Math.round(x / snap) ? S : P).push(d); }
      prev = img;
    }
    const st = (a, k) => { const v = a.map((q) => q[k]).sort((p, q) => p - q); return { med: +v[v.length >> 1].toFixed(2), max: +v[v.length - 1].toFixed(2) }; };
    out[nm] = { across2cm: { mean: st(A, 'mean'), big: st(A, 'big') }, control2cm: { mean: st(C, 'mean'), big: st(C, 'big') }, sweepSnap: { n: S.length, mean: st(S, 'mean'), big: st(S, 'big') }, sweepPlain: { n: P.length, mean: st(P, 'mean'), big: st(P, 'big') } };
  }
  return out;
}, MOBILE ? 3.2 : 2.5);
console.log('POP', SEED, MOBILE ? 'phone' : 'desktop', JSON.stringify(res));
await page.screenshot({ path: new URL(`./out/pop32-${SEED}${MOBILE ? '-m' : ''}.jpg`, import.meta.url).pathname, type: 'jpeg', quality: 80 });
await browser.close();
