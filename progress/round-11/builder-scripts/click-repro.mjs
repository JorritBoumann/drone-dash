// Round 11 builder: reproduce the music clicks offline. A hat (noise buffer -> gain envelope -> 7.2 kHz bandpass) is
// started at times that sit a hair off a sample frame, like the live step grid (nextStep += 0.12 accumulates float error).
// Compares the round 10 envelope (GainNode left at its default value 1 before the first automation event) with the fix
// (gain.value = 0 at creation). Reports the biggest sample step in the first 1 ms after each start.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage();
const out = await page.evaluate(async () => {
  const sr = 48000;
  const run = async (zeroInit, eps) => {
    const ctx = new OfflineAudioContext(1, sr, sr);
    const noise = ctx.createBuffer(1, sr * 2, sr); const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 7200; f.Q.value = 0.9; f.connect(ctx.destination);
    const starts = [];
    for (let k = 0; k < 40; k++) {
      // a step grid like the game: start + k * 0.12 s, plus a tiny offset off the frame
      const t = 0.1 + k * 0.02 + eps * (k % 2 ? 1 : -1);
      starts.push(t);
      const s = ctx.createBufferSource(); s.buffer = noise;
      const g = ctx.createGain(); if (zeroInit) g.gain.value = 0;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.022, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      s.connect(g).connect(f); s.start(t, 0.4 + k * 0.01); s.stop(t + 0.07);
    }
    const x = (await ctx.startRendering()).getChannelData(0);
    let worst = 0, hits = 0;
    for (const t of starts) { const i0 = Math.floor(t * sr) - 2; let w = 0; for (let i = i0; i < i0 + 48; i++) w = Math.max(w, Math.abs(x[i + 1] - x[i])); worst = Math.max(worst, w); if (w > 0.01) hits++; }
    return { maxStepFirstMs: +worst.toFixed(4), startsWithSpike: hits, of: starts.length };
  };
  const r = {};
  for (const eps of [0, 1e-12, 1e-10, 1e-8, 3e-6]) {
    r['eps' + eps] = { round10_defaultGain1: await run(false, eps), fix_gainZero: await run(true, eps) };
  }
  return r;
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
