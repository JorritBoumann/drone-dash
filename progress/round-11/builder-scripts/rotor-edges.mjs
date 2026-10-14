// Round 11 builder: render the rotor voice offline (two detuned saws -> resonant low-pass -> optional smoothing
// low-pass -> blade-pass AM) at the loudest in-run settings and count clicks with the round 10 detector
// (|dx| > 10x the RMS of dx over +-2 ms, centre excluded, and > 0.004). The rotor's level is the boosting level at
// the round 11 master gain (0.13 x 3.1), through the real master chain (glue compressor, limiter, trim).
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage();
const out = await page.evaluate(async () => {
  const sr = 48000;
  const det = (x) => { const n = x.length - 1, d = new Float64Array(n); for (let i = 0; i < n; i++) d[i] = x[i + 1] - x[i]; const c = new Float64Array(n + 1); for (let i = 0; i < n; i++) c[i + 1] = c[i] + d[i] * d[i]; const W = 96; let ev = 0, last = -1e9, worst = 0; for (let i = 0; i < n; i++) { const lo = Math.max(0, i - W), hi = Math.min(n, i + W + 1); const s = (c[hi] - c[lo] - d[i] * d[i]) / Math.max(1, hi - lo - 1); const r = Math.abs(d[i]) / Math.sqrt(s + 1e-20); if (Math.abs(d[i]) > 0.004) worst = Math.max(worst, r); if (r > 10 && Math.abs(d[i]) > 0.004) { if (i - last > 480) ev++; last = i; } } return { clicks: ev, worstRatio: +worst.toFixed(1) }; };
  const render = async (speed, boost, smooth) => {
    const ctx = new OfflineAudioContext(1, sr * 2, sr);
    const base = 88 + speed * 60 + 26 + (boost ? 40 : 0);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 2.5; f.frequency.value = 600 + speed * 1300 + (boost ? 900 : 0);
    const am = ctx.createGain(); am.gain.value = 0.7; const lfo = ctx.createOscillator(); lfo.frequency.value = base * 0.42; const ld = ctx.createGain(); ld.gain.value = 0.3; lfo.connect(ld).connect(am.gain);
    const g = ctx.createGain(); g.gain.value = (0.07 + 0.03 + (boost ? 0.03 : 0)) * 3.1;
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = base; const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = base * 1.013 + 1.5;
    o1.connect(f); o2.connect(f);
    let tail = f;
    for (const [fc, q] of smooth) { const s = ctx.createBiquadFilter(); s.type = 'lowpass'; s.frequency.value = fc; s.Q.value = q; tail.connect(s); tail = s; }
    // the real master chain: glue compressor, limiter, trim
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12;
    const trim = ctx.createGain(); trim.gain.value = 0.8;
    if (globalThis.__chain) { tail.connect(am).connect(g).connect(comp).connect(lim).connect(trim).connect(ctx.destination); } else tail.connect(am).connect(g).connect(ctx.destination);
    if (globalThis.__auto) {
      // the game re-targets the rotor every frame (setTargetAtTime at 60 Hz), so the oscillators run with a-rate automation
      for (let t = 0; t < 2; t += 1 / 60) { const b = base * (1 + 0.004 * Math.sin(t * 7)); o1.frequency.setTargetAtTime(b, t, 0.08); o2.frequency.setTargetAtTime(b * 1.013 + 1.5, t, 0.08); lfo.frequency.setTargetAtTime(b * 0.42, t, 0.08); f.frequency.setTargetAtTime(600 + speed * 1300 + (boost ? 900 : 0), t, 0.1); g.gain.setTargetAtTime((0.13) * 3.1, t, 0.15); }
    }
    o1.start(); o2.start(); lfo.start();
    const x = (await ctx.startRendering()).getChannelData(0);
    return det(x.subarray(sr * 0.5));
  };
  const configs = { none: [], lp1700: [[1700, 0.5]], lp1200: [[1200, 0.5]], lp1400x2: [[1400, 0.6], [1400, 0.6]], lp1000: [[1000, 0.5]] };
  const res = {};
  globalThis.__chain = true; globalThis.__auto = true;
  for (const [name, sm] of Object.entries(configs)) {
    res[name] = {};
    for (const [sp, b] of [[0.3, false], [0.6, false], [1, false], [0.6, true], [1, true]]) res[name][`s${sp}${b ? 'B' : ''}`] = await render(sp, b, sm);
  }
  return res;
});
for (const [k, v] of Object.entries(out)) console.log(k, JSON.stringify(v));
await browser.close();
