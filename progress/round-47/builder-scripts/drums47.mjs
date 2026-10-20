// Round 47 builder: bar-to-bar variation of Breakbeat's drums, rendered offline in Chromium for round 46 (bb46/ copy) and
// round 47 (src). 16 bars of the run at chain x2 (kick, snare, ghosts, 16th hats, shaker), drums bus only.
// Pairs of bars with the same pattern (same variant, same bar parity, no fill or crash) are compared on a 5 ms RMS
// envelope (dB, floor -60): mean and max absolute difference, plus the per-hit timing spread of the snare backbeat.
import { chromium } from '@playwright/test';
const PORT = Number(process.env.PORT || 5199); if (PORT === 5188) throw new Error('owner');
const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(`http://127.0.0.1:${PORT}/?seed=22`, { waitUntil: 'networkidle' });
const res = await page.evaluate(async () => {
  const out = {};
  for (const [tag, path] of [['round46', '/progress/round-47/builder-scripts/bb46/breakbeat.ts'], ['round47', '/src/systems/breakbeat.ts']]) {
    const M = await import(path);
    const sr = 48000, bars = 16, STEP = M.BB_STEP;
    const ctx = new OfflineAudioContext(1, Math.ceil(sr * (bars * 16 * STEP + 1)), sr);
    const noise = ctx.createBuffer(1, sr * 2, sr); const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const sink = ctx.createGain();
    const bb = new M.Breakbeat({ ctx, input: sink, noise, softSaw: null, reap() {}, note() {} });
    bb.drums.connect(ctx.destination);
    for (let i = 0; i < bars * 16; i++) bb.step('run', Math.floor(i / 16), i % 16, 0.05 + i * STEP, { chain: 2, chase: false, rush: false, overtime: false, tier: 0 });
    const buf = await ctx.startRendering(); const x = buf.getChannelData(0);
    const barLen = 16 * STEP, fr = Math.round(sr * 0.005);
    const env = (b) => { const a = Math.round((0.05 + b * barLen) * sr), n = Math.floor(barLen * sr / fr); const e = []; for (let k = 0; k < n; k++) { let s = 0; for (let j = 0; j < fr; j++) { const v = x[a + k * fr + j]; s += v * v; } e.push(Math.max(-60, 10 * Math.log10(s / fr + 1e-12))); } return e; };
    // same pattern: bars 1,5 and 2,4,6 (section 0); 9,13 and 10,12,14 (section 1)
    const pairs = [[1, 5], [2, 4], [2, 6], [4, 6], [9, 13], [10, 12], [10, 14], [12, 14]];
    const diffs = pairs.map(([a, b]) => { const A = env(a), B = env(b); let m = 0, mx = 0, n = 0; for (let k = 0; k < A.length; k++) { if (A[k] < -45 && B[k] < -45) continue; const d = Math.abs(A[k] - B[k]); m += d; n++; if (d > mx) mx = d; } return { a, b, meanDb: +(m / n).toFixed(2), maxDb: +mx.toFixed(1) }; });
    // snare on beat 2 (step 4): onset time (first sample over 30% of the bar's peak after the step) per bar
    const on = []; for (let b = 1; b < bars; b++) { const t0 = 0.05 + b * barLen + 4 * STEP - 0.01; const a = Math.round(t0 * sr); let pk = 0; for (let j = 0; j < sr * 0.04; j++) pk = Math.max(pk, Math.abs(x[a + j])); let k = 0; while (Math.abs(x[a + k]) < pk * 0.3) k++; on.push(+(((a + k) / sr - (t0 + 0.01)) * 1000).toFixed(2)); }
    const mean = on.reduce((p, c) => p + c, 0) / on.length; const sd = Math.sqrt(on.reduce((p, c) => p + (c - mean) ** 2, 0) / on.length);
    const allMean = diffs.reduce((p, c) => p + c.meanDb, 0) / diffs.length;
    out[tag] = { pairMeanAbsEnvDiffDb: +allMean.toFixed(2), pairs: diffs, snareBeat2OnsetMs: { mean: +mean.toFixed(2), sd: +sd.toFixed(2) }, peak: +x.reduce((p, c) => Math.max(p, Math.abs(c)), 0).toFixed(3) };
  }
  return out;
});
console.log(JSON.stringify(res, null, 1)); console.log('errors', errs.length, errs.slice(0, 3));
await browser.close();
