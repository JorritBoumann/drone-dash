// Round 10 critic: render each music voice alone in an OfflineAudioContext (48 kHz) with the same envelopes and filters
// as AudioSystem's music code, and look for single-sample spikes (the clicks found in the captured music bus).
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage();
const out = await page.evaluate(async () => {
  const sr = 48000;
  const render = async (fn) => {
    const ctx = new OfflineAudioContext(1, sr * 2, sr);
    const lowCut = ctx.createBiquadFilter(); lowCut.type = 'highpass'; lowCut.frequency.value = 55;
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 6500; tone.Q.value = 0.5;
    lowCut.connect(tone).connect(ctx.destination);
    const noise = ctx.createBuffer(1, sr * 2, sr); const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    fn(ctx, lowCut, noise);
    const buf = await ctx.startRendering(); const x = buf.getChannelData(0);
    let worst = 0, at = -1, peak = 0; for (let i = 1; i < x.length; i++) { const d = Math.abs(x[i] - x[i - 1]); if (d > worst) { worst = d; at = i; } peak = Math.max(peak, Math.abs(x[i])); }
    // slope of the steady part for scale
    return { maxStep: +worst.toFixed(4), atMs: +(at / sr * 1000).toFixed(2), peak: +peak.toFixed(4), ratio: +(worst / Math.max(1e-6, peak)).toFixed(3) };
  };
  const pluck = (type, f, gain, dur) => (ctx, dest) => { const t = 0.5 + (globalThis.__frac || 0) / 48000; const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.02); };
  const kick = (ctx, dest) => { const t = 0.5 + (globalThis.__frac || 0) / 48000; const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.12); const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.24, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(g).connect(dest); o.start(t); o.stop(t + 0.32); };
  const hat = (fc, gain, dur) => (ctx, dest, noise) => { const t = 0.5 + (globalThis.__frac || 0) / 48000; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fc; f.Q.value = fc > 5000 ? 0.9 : 0.8; f.connect(dest); const s = ctx.createBufferSource(); s.buffer = noise; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(g).connect(f); s.start(t, 0.4); s.stop(t + dur + 0.02); };
  const r = {}; globalThis.__frac = 128 * 190 - 24000;
  r.arpTri880 = await render(pluck('triangle', 880, 0.022, 0.2));
  r.arpTri1318 = await render(pluck('triangle', 1318.5, 0.028, 0.2));
  r.bassTri110 = await render(pluck('triangle', 110, 0.12, 0.3));
  r.leadSine659 = await render(pluck('sine', 659, 0.05, 0.4));
  r.urgTri1046 = await render(pluck('triangle', 1046.5, 0.022, 0.08));
  r.kick = await render(kick);
  r.hat = await render(hat(7200, 0.022, 0.05));
  r.clap = await render(hat(1500, 0.055, 0.16));
  return r;
});
console.log(JSON.stringify(out, null, 0));
await browser.close();
