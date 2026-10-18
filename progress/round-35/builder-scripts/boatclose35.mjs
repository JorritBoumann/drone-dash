// Round 35 builder: close-ups of every boat kind from 6 angles (contact sheet per kind, mood and device), and the
// water-in-hull pixel probe. Deterministic: manualRender + advance, free camera (renderFrom), the drone parked next to
// the boat so the water and the boats use the same focus.
//   PORT=5190 (this build) or 5193 (round 34 control). MOBILE=1 for iPhone 13 landscape. SEEDS=130,22,33 (golden,
//   morning, dusk). MODE=shots (contact sheets) | probe (pixel probe, this build only, needs the boatCaps hook).
//   PROBE: per open boat (sail, rib, row) and seed, STEPS time steps 0.37 s apart while it rolls, 4 views each:
//     M = hull caps shown in magenta (the open-hull mask), A = as drawn, B = water off, A0 = caps off (round 34 state).
//     inside = mask pixels where A differs from B (water drawn inside the hull); before = same for A0.
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const PORT = process.env.PORT || '5190'; const TAG = process.env.TAG || (PORT === '5193' ? 'r34' : 'r35');
const MOBILE = !!process.env.MOBILE; const SEEDS = (process.env.SEEDS || '130,22,33').split(',').map(Number);
const MODE = process.env.MODE || 'shots'; const STEPS = Number(process.env.STEPS || 12);
const KINDS = (process.env.KINDS || 'sail,rib,ferry,row').split(',');
const MOODN = { 130: 'golden', 22: 'morning', 33: 'dusk', 58: 'noon' };
const browser = await chromium.launch({ channel: 'chromium' });
const results = [];
for (const SEED of SEEDS) {
  const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const post = MODE === 'probe' ? '&post=0' : '';
  await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}${post}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
  await page.waitForFunction(() => window.__GAME__.assetsReady().on && window.__GAME__.boats().length > 0, null, { timeout: 40000 });
  await page.evaluate(() => { const G = window.__GAME__; G.advance(2, false); G.hideDebugUi?.(true); });
  for (const kind of KINDS) {
    const r = await page.evaluate(async ({ kind, MODE, STEPS }) => {
      const G = window.__GAME__;
      const pick = () => { const bs = G.boats(); return bs.find((b) => b.kind === kind && (kind === 'row' ? !b.moving : b.moving)) ?? bs.find((b) => b.kind === kind); };
      let b = pick();
      // park the drone beside the boat (inside the flight box), then let the boat settle on the swell
      const park = () => { b = pick(); const px = Math.cos(b.yaw), pz = -Math.sin(b.yaw); G.place(Math.max(-185, Math.min(185, b.x + px * 9)), 8, Math.max(-185, Math.min(185, b.z + pz * 9)), 0, 0); };
      park(); G.advance(1 / 60, false); park(); G.advance(1 / 60, false); b = pick();
      const canvas = document.querySelector('canvas');
      const views = (b) => {
        const L = b.len, B = b.beam, w = b.water;
        const f = [Math.sin(b.yaw), Math.cos(b.yaw)], p = [Math.cos(b.yaw), -Math.sin(b.yaw)];
        const at = (a, c, up) => [b.x + f[0] * a + p[0] * c, w + up, b.z + f[1] * a + p[1] * c];
        const tc = (up) => [b.x, w + up, b.z];
        const big = kind === 'ferry';
        return [
          ['side-low', at(0.1 * L, 1.1 * L, 0.45), tc(0.6)],
          ['bow-quarter', at(0.85 * L, 0.6 * L, big ? 4 : 1.8), tc(0.5)],
          ['into-hull', at(-0.05 * L, B * 1.25, big ? 9 : 0.48 * L), tc(big ? 2 : 0.25)],
          ['above', at(0.05 * L, 0.12 * L, big ? 22 : 1.25 * L), tc(0)],
          ['stern-low', at(-0.9 * L, -0.45 * L, big ? 2.2 : 0.9), tc(0.6)],
          ['quarter-high', at(-0.5 * L, 0.95 * L, big ? 7 : 0.5 * L), tc(0.4)],
        ];
      };
      const grab = (v) => { G.renderFrom(...v[1], ...v[2]); return canvas; };
      if (MODE === 'shots') {
        const vs = views(b);
        const W = 640, H = Math.round(640 * canvas.height / canvas.width);
        const sheet = document.createElement('canvas'); sheet.width = W * 3; sheet.height = H * 2;
        const ctx2 = sheet.getContext('2d');
        vs.forEach((v, i) => {
          grab(v); ctx2.drawImage(canvas, (i % 3) * W, Math.floor(i / 3) * H, W, H);
          ctx2.fillStyle = 'rgba(0,0,0,0.55)'; ctx2.fillRect((i % 3) * W, Math.floor(i / 3) * H, 120, 22);
          ctx2.fillStyle = '#fff'; ctx2.font = '14px sans-serif'; ctx2.fillText(v[0], (i % 3) * W + 6, Math.floor(i / 3) * H + 16);
        });
        // single full-size views for the A/B
        const singles = {};
        for (const i of [0, 2, 1]) { grab(vs[i]); singles[vs[i][0]] = canvas.toDataURL('image/jpeg', 0.85); }
        return { sheet: sheet.toDataURL('image/jpeg', 0.82), singles, boat: b };
      }
      // probe
      const read = () => {
        const c2 = document.createElement('canvas'); c2.width = 320; c2.height = Math.round(320 * canvas.height / canvas.width);
        const x = c2.getContext('2d', { willReadFrequently: true }); x.drawImage(canvas, 0, 0, c2.width, c2.height);
        return x.getImageData(0, 0, c2.width, c2.height).data;
      };
      const out = { kind, frames: 0, maskPx: 0, inside: 0, insideFrames: 0, before: 0, beforeFrames: 0, maxInside: 0 };
      for (let s = 0; s < STEPS; s++) {
        if (s) { G.advance(0.37, false); park(); G.advance(1 / 60, false); }
        b = pick();
        const vs = views(b).filter((v) => ['into-hull', 'above', 'bow-quarter', 'quarter-high'].includes(v[0]));
        for (const v of vs) {
          G.boatCaps('show'); grab(v); const M = read();
          G.boatCaps('depth'); G.waterOn(true); grab(v); const A = read();
          G.waterOn(false); grab(v); const Bp = read();
          G.boatCaps('off'); G.waterOn(true); grab(v); const A0 = read();
          G.boatCaps('depth'); G.waterOn(true);
          let m = 0, d = 0, d0 = 0;
          const Wd = 320; const isMag = (j) => j >= 0 && j < M.length && M[j] > 150 && M[j + 1] < 90 && M[j + 2] > 150;
          for (let i = 0; i < M.length; i += 4) {
            // the mask is eroded by one pixel (edge pixels of the downscaled frame mix the lid with the sea outside)
            const mag = isMag(i) && isMag(i - 4) && isMag(i + 4) && isMag(i - Wd * 4) && isMag(i + Wd * 4);
            if (!mag) continue;
            m++;
            const da = Math.abs(A[i] - Bp[i]) + Math.abs(A[i + 1] - Bp[i + 1]) + Math.abs(A[i + 2] - Bp[i + 2]);
            const d0a = Math.abs(A0[i] - Bp[i]) + Math.abs(A0[i + 1] - Bp[i + 1]) + Math.abs(A0[i + 2] - Bp[i + 2]);
            if (da > 24) d++;
            if (d0a > 24) d0++;
          }
          out.frames++; out.maskPx += m; out.inside += d; out.before += d0;
          if (d > 0) out.insideFrames++; if (d0 > 0) out.beforeFrames++;
          out.maxInside = Math.max(out.maxInside, d);
        }
      }
      out.roll = b; return out;
    }, { kind, MODE, STEPS });
    if (MODE === 'shots') {
      const dev = MOBILE ? 'm' : 'd';
      fs.writeFileSync(`${OUT}${TAG}-boats-${MOODN[SEED] ?? SEED}-${dev}-${kind}.jpg`, Buffer.from(r.sheet.split(',')[1], 'base64'));
      if (!MOBILE) for (const [k, v] of Object.entries(r.singles)) {
        fs.mkdirSync(process.env.AB, { recursive: true });
        fs.writeFileSync(`${process.env.AB}/${TAG}-${MOODN[SEED]}-${kind}-${k}.jpg`, Buffer.from(v.split(',')[1], 'base64'));
      }
      console.log(TAG, SEED, kind, 'water', r.boat.water, 'keel', r.boat.keel);
    } else {
      results.push({ seed: SEED, mobile: MOBILE, ...r });
      console.log(JSON.stringify({ seed: SEED, mobile: MOBILE, kind: r.kind, frames: r.frames, maskPx: r.maskPx, inside: r.inside, insideFrames: r.insideFrames, maxInside: r.maxInside, before: r.before, beforeFrames: r.beforeFrames }));
    }
  }
  if (errs.length) console.log('ERRORS', SEED, errs.slice(0, 5));
  await ctx.close();
}
await browser.close();
