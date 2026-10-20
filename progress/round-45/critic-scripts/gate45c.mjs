// Round 45 critic: audio start gate, lazy sample load, blocked / suspended / missing audio, the music toggle (N, chip)
// and the minimap toggle sound. Strict autoplay policy (a real browser's), my own dev server (PORT, never 5188).
// Uses the 7-channel tap from rec45c.mjs (L, R, music, sfx, drone, amb, return).
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const PORT = Number(process.env.PORT || 5197); if (PORT === 5188) throw new Error('5188 is the owner');
const BASE = `http://127.0.0.1:${PORT}/?seed=22`;
const recSrc = fs.readFileSync(new URL('./rec45c.mjs', import.meta.url), 'utf8');
const TAP = recSrc.slice(recSrc.indexOf('const TAPHOOK = () => {') + 'const TAPHOOK = '.length, recSrc.indexOf('\nconst ROADS')).trim().replace(/;$/, '');
const out = {};
const browser = await chromium.launch({ channel: 'chromium', args: ['--autoplay-policy=document-user-activation-required'] });

async function fresh(init = [], route = null) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const reqs = []; page.on('request', (r) => reqs.push({ url: r.url(), t: Date.now() })); const failed = []; page.on('requestfailed', (r) => failed.push(r.url()));
  await page.addInitScript(`(${TAP})()`);
  await page.addInitScript(() => { const A = window.AudioContext; if (A) { window.AudioContext = class extends A { constructor(...a) { super(...a); window.__actx = this; } }; } });
  await page.addInitScript(() => { window.__firstFrame = null; requestAnimationFrame((t) => { window.__firstFrame = performance.now(); }); });
  for (const s of init) await page.addInitScript(s);
  if (route) await page.route('**/assets/audio/sfx.mp3', route);
  const t0 = Date.now();
  await page.goto(BASE, { waitUntil: 'load' });
  return { ctx, page, errors, reqs, failed, t0 };
}
const diag = (page) => page.evaluate(() => { const g = window.__THREE_GAME_DIAGNOSTICS__; return { state: g.state, actx: g.audio.state, music: { enabled: g.audio.music.enabled, playing: g.audio.music.playing, track: g.audio.music.track, late: g.audio.music.late }, sx: g.audio.sfx, pos: g.player.position, spd: g.player.speed, frame: g.frame ?? null }; });
// RMS (dB) per tap channel over `ms` of capture
async function meter(page, ms) {
  await page.evaluate(() => { const c = window.__cap; if (!c) return; c.chunks = c.chunks.map(() => []); c.on = true; });
  await page.waitForTimeout(ms);
  return page.evaluate(() => { const c = window.__cap; if (!c) return null; c.on = false; const names = ['L', 'R', 'music', 'sfx', 'drone', 'amb', 'ret']; const r = {}; c.chunks.forEach((arr, i) => { let s = 0, n = 0; for (const a of arr) for (let k = 0; k < a.length; k++) { s += a[k] * a[k]; n++; } r[names[i]] = n ? +(10 * Math.log10(s / n + 1e-24)).toFixed(1) : null; }); c.chunks = c.chunks.map(() => []); return r; });
}
async function fly(page, ms) { await page.keyboard.down('KeyW'); await page.waitForTimeout(ms); await page.keyboard.up('KeyW'); }

// A. gate: nothing sounds before the first gesture; the sprite loads after the first frame
{
  const { ctx, page, errors, reqs, t0 } = await fresh();
  await page.waitForTimeout(3000);
  const before = await diag(page);
  const capBefore = await page.evaluate(() => ({ cap: !!window.__cap, running: window.__cap ? window.__cap.ctx.state : null }));
  const m0 = await meter(page, 1500);
  const nav = await page.evaluate(() => { const e = performance.getEntriesByType('resource').find((r) => r.name.includes('sfx.mp3')); return { firstFrame: window.__firstFrame, sfxStart: e ? e.startTime : null, sfxEnd: e ? e.responseEnd : null, sfxBytes: e ? e.transferSize || e.encodedBodySize : null, loadEnd: performance.getEntriesByType('navigation')[0].loadEventEnd }; });
  await page.mouse.click(640, 600); await page.waitForTimeout(1200);
  const after = await diag(page); const m1 = await meter(page, 2000);
  out.gate = { before, capBefore, meterBeforeGesture: m0, nav, afterGesture: after, meterAfterGesture: m1, errors };
  // B. music toggle on the title (N), then in a run (N twice), the minimap toggle (M), persistence across a reload
  await page.keyboard.press('KeyN'); await page.waitForTimeout(900);
  const tOff = await diag(page); const mTitleOff = await meter(page, 1500);
  await page.keyboard.press('KeyN'); await page.waitForTimeout(900);
  const mTitleOn = await meter(page, 1500);
  await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
  await page.keyboard.down('KeyW');
  const runOn = await meter(page, 2000);
  await page.keyboard.press('KeyN'); await page.waitForTimeout(700);
  const runOff = await meter(page, 2000); const dOff = await diag(page);
  await page.keyboard.press('KeyN'); await page.waitForTimeout(700);
  const runOn2 = await meter(page, 2000);
  await page.keyboard.up('KeyW');
  const mm0 = await meter(page, 50);
  await page.keyboard.press('KeyM'); const mmClick = await meter(page, 300); await page.keyboard.press('KeyM'); await page.waitForTimeout(300);
  await page.keyboard.press('KeyN'); await page.waitForTimeout(300);
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(2500); await page.keyboard.press('ShiftLeft'); await page.waitForTimeout(800);
  const reload = await diag(page);
  await page.keyboard.press('KeyN'); await page.waitForTimeout(300); // back on for the next tests
  out.toggle = { titleOffDiag: tOff.music, mTitleOff, mTitleOn, runOn, runOff, runOffDiag: dOff.music, runOn2, minimapToggleWindow: mmClick, musicAfterReloadWhenLeftOff: reload.music, errors };
  await ctx.close();
  console.log('PART', JSON.stringify({ gate: out.gate, toggle: out.toggle }));
}
// C. blocked contexts: resume never resolves / rejects; no Web Audio at all; the sample sprite 404s
const cases = {
  resumeHangs: [() => { const P = (window.AudioContext || window.webkitAudioContext).prototype; P.resume = function () { return new Promise(() => {}); }; }],
  resumeRejects: [() => { const P = (window.AudioContext || window.webkitAudioContext).prototype; P.resume = function () { return Promise.reject(new DOMException('blocked', 'NotAllowedError')); }; }],
  noWebAudio: [() => { delete window.AudioContext; window.AudioContext = undefined; window.webkitAudioContext = undefined; }],
  ctorThrows: [() => { window.AudioContext = function () { throw new Error('AudioContext blocked'); }; }],
};
out.blocked = {};
for (const [name, init] of Object.entries(cases)) {
  const { ctx, page, errors } = await fresh(init);
  await page.waitForTimeout(2000);
  await page.keyboard.press('Enter'); await page.waitForTimeout(800);
  const a = await diag(page); await fly(page, 3000); const b = await diag(page);
  await page.keyboard.press('KeyN'); await page.keyboard.press('KeyM'); await page.keyboard.press('Escape'); await page.waitForTimeout(400); const c = await diag(page);
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  out.blocked[name] = { state: [a.state, b.state, c.state], actx: b.actx, moved: Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z).toFixed(1), errors };
  await ctx.close();
}
{
  const { ctx, page, errors } = await fresh([], (r) => r.fulfill({ status: 404, body: 'nf' }));
  await page.waitForTimeout(2000); await page.keyboard.press('Enter'); await page.waitForTimeout(800);
  await page.keyboard.down('KeyW'); const m = await meter(page, 2500); await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyM'); const click = await meter(page, 250);
  const d = await diag(page);
  out.blocked.sprite404 = { state: d.state, sprite: d.sx.sprite, meter: m, toggleClick: click, errors: errors.filter((e) => !e.includes('404')) , allErrors: errors };
  await ctx.close();
}
// D. suspended mid-run (an OS interruption): the game keeps going, a key press brings the sound back
{
  const { ctx, page, errors } = await fresh();
  await page.waitForTimeout(2000); await page.keyboard.press('Enter'); await page.waitForTimeout(1000);
  const sus = await page.evaluate(async () => { const c = window.__actx; if (!c) return 'no context seen'; await c.suspend(); return c.state; }); out.suspendCall = sus;
  await page.waitForTimeout(300);
  const a = await diag(page); await fly(page, 2500); const b = await diag(page);
  const m = await meter(page, 1000);
  out.suspendMidRun = { stateWhileSuspended: [a.state, a.actx, b.state, b.actx], moved: Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z).toFixed(1), meterAfterKeys: m, actxAfterKeys: (await diag(page)).actx, errors };
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
