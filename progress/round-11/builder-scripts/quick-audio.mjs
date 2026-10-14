// Round 11 builder: fast audio capture for tuning. Same tap as the round 10 critic (master output, music bus, cue bus
// through a ScriptProcessor), plus the master bus before the glue compressor and the limiter (channel 4, precomp). Title for TITLE_S, then a run with the clock lifted (test-only tune) and the music held
// at fixed chain levels by the musicForce test hook. With REP=1 it also records 70 s at chain 0 and chain 3 for the
// repetition check. Raw float32 + segment marks go to RAW (default: the session scratchpad).
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const RAW = process.env.RAW || '/private/tmp/claude-501/-Users-jorritboumann/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/r11/quick/';
fs.mkdirSync(RAW, { recursive: true });
const SEG = Number(process.env.SEG || 14), TITLE_S = Number(process.env.TITLE_S || 15), REP = !!process.env.REP, REP_S = Number(process.env.REP_S || 70);
const TAPHOOK = () => {
  const origConnect = AudioNode.prototype.connect; window.__an = []; window.__cap = null;
  const ca = BaseAudioContext.prototype.createAnalyser;
  BaseAudioContext.prototype.createAnalyser = function () { const a = ca.apply(this, arguments); window.__an.push(a); return a; };
  let merger = null;
  const ensure = (ctx) => {
    if (merger) return merger;
    merger = ctx.createChannelMerger(4);
    const sp = ctx.createScriptProcessor(4096, 4, 1); sp.channelCount = 4; sp.channelCountMode = 'explicit'; sp.channelInterpretation = 'discrete';
    const z = ctx.createGain(); z.gain.value = 0;
    window.__cap = { on: false, chunks: [[], [], [], []], t0: null, n: 0, sr: ctx.sampleRate, ctx };
    sp.onaudioprocess = (e) => { const c = window.__cap; if (!c.on) return; if (c.t0 === null) c.t0 = e.playbackTime; for (let ch = 0; ch < 4; ch++) c.chunks[ch].push(new Float32Array(e.inputBuffer.getChannelData(ch))); c.n += e.inputBuffer.length; };
    origConnect.call(merger, sp); origConnect.call(sp, z); origConnect.call(z, ctx.destination);
    return merger;
  };
  AudioNode.prototype.connect = function (dest) {
    const r = origConnect.apply(this, arguments);
    try {
      if (dest instanceof AudioDestinationNode && this !== merger) { origConnect.call(this, ensure(this.context), 0, 0); }
      else if (dest instanceof DynamicsCompressorNode && !window.__preTapped) { window.__preTapped = true; origConnect.call(this, ensure(this.context), 0, 3); }
      else if (dest instanceof AnalyserNode) { const i = window.__an.indexOf(dest); if (i === 0 || i === 1) origConnect.call(this, ensure(this.context), 0, i + 1); }
    } catch (e) { window.__tapErr = String(e); }
    return r;
  };
  window.__dump = () => { const c = window.__cap; if (!c) return null; const out = []; for (let ch = 0; ch < 4; ch++) { const arrs = c.chunks[ch]; c.chunks[ch] = []; const len = arrs.reduce((a, b) => a + b.length, 0); const f = new Float32Array(len); let o = 0; for (const a of arrs) { f.set(a, o); o += a.length; } const u8 = new Uint8Array(f.buffer); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); out.push(btoa(s)); } return out; };
};
const browser = await chromium.launch({ channel: 'chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.addInitScript(TAPHOOK);
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://127.0.0.1:5188/?seed=22', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
const files = ['master', 'music', 'cues', 'precomp'].map((n) => RAW + n + '.f32'); files.forEach((f) => fs.writeFileSync(f, Buffer.alloc(0)));
const dump = async () => { const out = await page.evaluate(() => window.__dump && window.__dump()); if (out) out.forEach((b, ch) => fs.appendFileSync(files[ch], Buffer.from(b, 'base64'))); };
const ct = () => page.evaluate(() => window.__cap.ctx.currentTime);
const marks = []; const red = [];
const hold = async (name, s) => {
  const a = await ct(); const t0 = Date.now();
  while (Date.now() - t0 < s * 1000) { await page.waitForTimeout(250); const m = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.audio.music); red.push({ seg: name, comp: m.compDb, lim: m.limiterDb, late: m.late, track: m.track, layer: m.layer }); if (red.length % 20 === 0) await dump(); }
  marks.push({ name, a, b: await ct() });
};
await page.keyboard.press('ShiftLeft'); await page.waitForTimeout(300);
await page.evaluate(() => { window.__GAME__.audioMeter(true); window.__cap.on = true; });
await page.waitForTimeout(1500);
await hold('title', TITLE_S);
await page.evaluate(() => { window.__GAME__.tune({ RUN: { startTime: 900 } }); window.__GAME__.musicForce(0); });
await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
if (process.env.FLY) {
  // fly: climb to 30 m, then full throttle with boost in a straight line (rotor at its brightest), music held at chain 3
  await page.evaluate(() => window.__GAME__.musicForce(3));
  await page.keyboard.down('Space'); await page.waitForTimeout(2500); await page.keyboard.up('Space');
  await page.keyboard.down('KeyW'); await page.keyboard.down('KeyE');
  await hold('fly-boost', SEG);
  await page.keyboard.up('KeyE'); await hold('fly-cruise', 6); await page.keyboard.up('KeyW');
}
await hold('run-chain0', SEG);
await page.evaluate(() => window.__GAME__.musicForce(3)); await page.waitForTimeout(1500);
await hold('run-chain3', SEG);
await page.evaluate(() => window.__GAME__.musicForce(3, true)); await page.waitForTimeout(600);
await hold('final', 9);
if (REP) {
  await page.evaluate(() => window.__GAME__.musicForce(0)); await page.waitForTimeout(1500);
  await hold('rep-chain0', REP_S);
  await page.evaluate(() => window.__GAME__.musicForce(3)); await page.waitForTimeout(1500);
  await hold('rep-chain3', REP_S);
}
await dump();
const t0 = await page.evaluate(() => window.__cap.t0); const sr = await page.evaluate(() => window.__cap.sr);
const last = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.audio.music);
fs.writeFileSync(RAW + 'marks.json', JSON.stringify({ t0, sr, marks, red }));
console.log(JSON.stringify({ marks: marks.map((m) => [m.name, +(m.b - m.a).toFixed(1)]), late: last.late, resyncs: last.resyncs, errors }));
await browser.close();
