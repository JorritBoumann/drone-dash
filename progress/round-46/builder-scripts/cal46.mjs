// Round 46 builder: quick level calibration per soundtrack. Records master L/R and the buses through the game's audioTaps,
// with the music held at each chain level (musicForce), the last-10-s section, rush (escalation hook not used: forced via
// the audio's setRush through musicForce stays), then a short clock to game over. Writes raw float32 + marks to RAW.
// usage: TRACK=breakbeat PORT=5199 node cal46.mjs
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const PORT = Number(process.env.PORT || 5199); if (PORT === 5188) throw new Error('5188 is the owner');
const TRACK = process.env.TRACK || 'breakbeat';
const RAW = (process.env.RAW || '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/b46/cal/');
fs.mkdirSync(RAW, { recursive: true });
const NAMES = ['L', 'R', 'music', 'sfx', 'bed', 'amb', 'rev'];
const INSTALL = () => {
  const taps = window.__GAME__.audioTaps(); if (!taps) return 'no taps';
  const ctx = taps.out.context; const NCH = 7;
  const merger = ctx.createChannelMerger(NCH); const split = ctx.createChannelSplitter(2);
  split.connect(merger, 0, 0); split.connect(merger, 1, 1); taps.out.connect(split);
  ['music', 'sfx', 'bed', 'amb', 'rev'].forEach((k, i) => taps[k].connect(merger, 0, 2 + i));
  const sp = ctx.createScriptProcessor(4096, NCH, 1); sp.channelCount = NCH; sp.channelCountMode = 'explicit'; sp.channelInterpretation = 'discrete';
  const z = ctx.createGain(); z.gain.value = 0;
  window.__cap = { on: false, chunks: Array.from({ length: NCH }, () => []), t0: null, n: 0, sr: ctx.sampleRate, ctx, split };
  sp.onaudioprocess = (e) => { const c = window.__cap; if (!c.on) return; if (c.t0 === null) c.t0 = e.playbackTime; for (let ch = 0; ch < NCH; ch++) c.chunks[ch].push(new Float32Array(e.inputBuffer.getChannelData(ch))); c.n += e.inputBuffer.length; };
  merger.connect(sp); sp.connect(z); z.connect(ctx.destination);
  window.__dump = () => { const c = window.__cap; if (!c) return null; const out = []; for (let ch = 0; ch < NCH; ch++) { const arrs = c.chunks[ch]; c.chunks[ch] = []; const len = arrs.reduce((a, b) => a + b.length, 0); const f = new Float32Array(len); let o = 0; for (const a of arrs) { f.set(a, o); o += a.length; } const u8 = new Uint8Array(f.buffer); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); out.push(btoa(s)); } return out; };
  return 'ok';
};

const browser = await chromium.launch({ channel: 'chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errors = []; page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/?seed=22&music=${TRACK}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(2500);
await page.keyboard.press('ShiftLeft'); await page.waitForTimeout(300);
console.log('install', await page.evaluate(INSTALL));
await page.evaluate(() => { window.__cap.on = true; });
const marks = [];
const mark = async (label) => { const r = await page.evaluate(() => ({ ct: window.__cap.ctx.currentTime, m: window.__THREE_GAME_DIAGNOSTICS__.audio.music, s: window.__THREE_GAME_DIAGNOSTICS__.audio.sfx })); marks.push({ label, ct: r.ct, track: r.m.soundtrack, section: r.m.section, layer: r.m.layer, live: r.s.liveOneShots, notes: r.m.notes }); console.log('MARK', label, r.ct.toFixed(2), r.m.soundtrack, r.m.track, r.m.section, 'live', r.s.liveOneShots, 'reaped', r.s.reapedOneShots); };
const files = NAMES.map((n) => RAW + `${TRACK}-${n}.f32`); files.forEach((f) => fs.writeFileSync(f, Buffer.alloc(0)));
const dump = async () => { const out = await page.evaluate(() => window.__dump && window.__dump()); if (out) out.forEach((b, ch) => fs.appendFileSync(files[ch], Buffer.from(b, 'base64'))); };
const hold = async (ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { await page.waitForTimeout(Math.min(2000, ms - (Date.now() - t0))); await dump(); } };
await mark('title'); await hold(Number(process.env.TITLE_MS || 14000));
await page.evaluate(() => window.__GAME__.tune({ RUN: { startTime: 60 } }));
await page.keyboard.press('Enter'); await page.waitForTimeout(300);
for (const lv of [0, 1, 2, 3]) { await page.evaluate((l) => window.__GAME__.musicForce(l), lv); await hold(800); await mark('chain' + lv); await hold(9000); }
await page.evaluate(() => window.__GAME__.musicForce(3, true)); await hold(500); await mark('final'); await hold(9000);
await page.evaluate(() => window.__GAME__.musicForce(null));
// let the clock run out (no input: the drone hovers) and record the game over
for (let i = 0; i < 40; i++) { const st = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.state); if (st === 'over') break; await hold(1000); }
await mark('over'); await hold(14000); await mark('end');
await dump();
const cap = await page.evaluate(() => ({ sr: window.__cap.sr, t0: window.__cap.t0 }));
fs.writeFileSync(RAW + `${TRACK}-marks.json`, JSON.stringify({ ...cap, marks, errors }));
console.log('errors', JSON.stringify(errors));
await browser.close();
