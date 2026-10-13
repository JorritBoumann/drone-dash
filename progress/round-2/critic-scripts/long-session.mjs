// Long desktop session, bloom on: continuous 9-pixel blank probe across 2 runs (flight, pickups,
// deliveries, deliberate crash, game over, restart). Logs camera-to-drone distance and physics timings.
import { chromium } from '@playwright/test';
import * as fs from 'node:fs';
const OUT = new URL('../critic/', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.addInitScript(() => {
  const orig = window.requestAnimationFrame.bind(window);
  window.__px = []; window.__cd = [];
  window.requestAnimationFrame = (cb) => orig((t) => { cb(t); try { const c = document.getElementById('game-canvas'); const gl = c.getContext('webgl2'); const buf = new Uint8Array(16); const out = new Set(); for (let i = 0; i < 9; i++) { gl.readPixels(Math.floor(c.width * (0.1 + 0.1 * i)), Math.floor(c.height * (0.2 + 0.07 * i)), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf); out.add(buf.slice(0, 3).join(',')); } const d = window.__THREE_GAME_DIAGNOSTICS__; window.__px.push([out.size, d?.state]); if (d && d.state === 'playing') { const p = d.player.position, cm = d.camera; window.__cd.push(Math.hypot(p.x - cm.x, p.y - cm.y, p.z - cm.z)); } } catch (e) { window.__px.push(['E', e.message]); } });
});
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const diag = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__THREE_GAME_DIAGNOSTICS__)));
const held = new Set();
async function setKey(k, on) { if (on && !held.has(k)) { held.add(k); await page.keyboard.down(k); } if (!on && held.has(k)) { held.delete(k); await page.keyboard.up(k); } }
async function releaseAll() { for (const k of [...held]) await setKey(k, false); }
const log = (...a) => console.log(...a);

// ---- Run 1: physics timings
await page.keyboard.press('Enter'); await page.waitForTimeout(400);
let d = await diag(); log('start pos', JSON.stringify(d.player.position), 'objective', JSON.stringify(d.objective));
// climb rate
let y0 = d.player.position.y; let t0 = Date.now(); await setKey('Space', true); await page.waitForTimeout(1500); d = await diag(); await setKey('Space', false);
log('climb 1.5s dy', (d.player.position.y - y0).toFixed(1));
// accel to top speed
await setKey('KeyW', true); t0 = Date.now(); let reached = null; const sp = [];
while (Date.now() - t0 < 2500) { d = await diag(); sp.push([(Date.now() - t0), d.player.speed.toFixed(1)]); if (!reached && d.player.speed > 16) reached = Date.now() - t0; await page.waitForTimeout(50); }
log('time to 16 m/s', reached, 'ms; speed after 2.5s', d.player.speed.toFixed(1));
// boost
await setKey('KeyE', true); await page.waitForTimeout(2000); d = await diag(); log('boost 2s speed', d.player.speed.toFixed(1), 'boost left', d.player.boost.toFixed(2)); await setKey('KeyE', false);
// stopping
await setKey('KeyW', false); const p1 = d.player.position; t0 = Date.now(); let stopT = null;
while (Date.now() - t0 < 4000) { d = await diag(); if (!stopT && d.player.speed < 1) stopT = Date.now() - t0; await page.waitForTimeout(50); }
log('coast to <1 m/s', stopT, 'ms, distance', Math.hypot(d.player.position.x - p1.x, d.player.position.z - p1.z).toFixed(1));
// S brake
await setKey('KeyW', true); await page.waitForTimeout(1500); await setKey('KeyW', false); d = await diag(); const p2 = d.player.position; const v2 = d.player.speed; await setKey('KeyS', true); t0 = Date.now(); stopT = null;
while (Date.now() - t0 < 3000) { d = await diag(); if (!stopT && d.player.speed < 1) stopT = Date.now() - t0; await page.waitForTimeout(40); }
await setKey('KeyS', false); log('brake from', v2.toFixed(1), 'to <1 m/s', stopT, 'ms dist', Math.hypot(d.player.position.x - p2.x, d.player.position.z - p2.z).toFixed(1));

// ---- Deliberate crash: descend to 8 m, boost straight ahead until a big speed drop
await setKey('ShiftLeft', true); for (let i = 0; i < 60; i++) { d = await diag(); if (d.player.position.y < 9) break; await page.waitForTimeout(50); } await setKey('ShiftLeft', false);
await setKey('KeyW', true); await setKey('KeyE', true); let last = 0, crash = null; t0 = Date.now();
while (Date.now() - t0 < 8000) { d = await diag(); if (last - d.player.speed > 6) { crash = { from: last.toFixed(1), to: d.player.speed.toFixed(1), y: d.player.position.y.toFixed(1), tl: d.timeLeft.toFixed(1) }; await page.screenshot({ path: OUT + 'L01-crash-frame.png' }); await page.waitForTimeout(120); await page.screenshot({ path: OUT + 'L02-crash-plus120ms.png' }); break; } last = d.player.speed; await page.waitForTimeout(30); }
await releaseAll(); log('CRASH', JSON.stringify(crash));
await page.waitForTimeout(600); d = await diag(); log('600ms after crash speed', d.player.speed.toFixed(1), 'tl', d.timeLeft.toFixed(1));
await page.screenshot({ path: OUT + 'L03-after-crash-600ms.png' });

// ---- Autopilot with unstick behaviour until game over
async function autopilot(maxMs, tag) {
  const start = Date.now(); let lastDeliv = (await diag()).deliveries; let hist = []; let unstick = 0; const events = [];
  while (Date.now() - start < maxMs) {
    d = await diag(); if (d.state !== 'playing') { events.push(['state', d.state, ((Date.now() - start) / 1000).toFixed(1)]); break; }
    const p = d.player.position, c = d.camera, o = d.objective.position; const el = (Date.now() - start) / 1000;
    const heading = Math.atan2(p.x - c.x, p.z - c.z); const want = Math.atan2(o.x - p.x, o.z - p.z);
    let err = want - heading; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
    const hd = Math.hypot(o.x - p.x, o.z - p.z);
    hist.push([el, hd]); while (hist.length && hist[0][0] < el - 3) hist.shift();
    if (unstick <= 0 && el > 4 && hist.length > 5 && Math.abs(hist[0][1] - hd) < 1 && hd > 4) { unstick = 1.6; events.push(['unstick', el.toFixed(1), 'hd', hd.toFixed(0), 'y', p.y.toFixed(0)]); }
    if (unstick > 0) { unstick -= 0.08; await setKey('KeyW', false); await setKey('KeyS', true); await setKey('Space', true); await setKey('ShiftLeft', false); await setKey('KeyA', false); await setKey('KeyD', false); await page.waitForTimeout(60); await setKey('KeyS', false); continue; }
    await setKey('KeyD', Math.abs(err) > 0.12 && err < 0); await setKey('KeyA', Math.abs(err) > 0.12 && err > 0);
    await setKey('KeyW', Math.abs(err) < 0.9 && !(hd < 6 && d.player.speed > 6));
    const wantY = hd > 25 ? Math.max(o.y + 6, 40) : o.y + 1.2;
    await setKey('Space', p.y < wantY - 1.5); await setKey('ShiftLeft', p.y > wantY + 1.5);
    await setKey('KeyE', hd > 60 && Math.abs(err) < 0.3 && d.player.boost > 0.3);
    if (d.deliveries > lastDeliv) { events.push(['delivered', d.deliveries, el.toFixed(1), 'score', d.score, 'tl', d.timeLeft.toFixed(1)]); lastDeliv = d.deliveries; }
    await page.waitForTimeout(60);
  }
  await releaseAll(); return events;
}
await page.evaluate(() => { window.__fd = []; let l = performance.now(); const f = (t) => { window.__fd.push(t - l); l = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
const ev1 = await autopilot(90000, 'run1'); log('RUN1', JSON.stringify(ev1));
await page.waitForTimeout(1200); await page.screenshot({ path: OUT + 'L04-game-over.png' });
const overText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 400)); log('OVER TEXT', overText);
// ---- Restart with Enter
await page.keyboard.press('Enter'); await page.waitForTimeout(300); await page.screenshot({ path: OUT + 'L05-restart-300ms.png' });
d = await diag(); log('after restart', d.state, 'tl', d.timeLeft.toFixed(1), 'score', d.score, 'del', d.deliveries);
const ev2 = await autopilot(40000, 'run2'); log('RUN2', JSON.stringify(ev2));
const fd = await page.evaluate(() => window.__fd.slice(30)); const s = [...fd].sort((a, b) => a - b); const q = (x) => s[Math.floor(s.length * x)];
log('FRAMES', JSON.stringify({ n: s.length, median: q(0.5).toFixed(2), p95: q(0.95).toFixed(2), p99: q(0.99).toFixed(2), max: s.at(-1).toFixed(1), over20: s.filter((v) => v > 20).length }));
const px = await page.evaluate(() => window.__px.slice()); const cd = await page.evaluate(() => window.__cd.slice());
const flat = px.filter((v) => v[0] === 1); const byState = {}; for (const v of flat) byState[v[1]] = (byState[v[1]] || 0) + 1;
log('PIXEL frames', px.length, 'flat', flat.length, 'byState', JSON.stringify(byState), 'errors', px.filter((v) => v[0] === 'E').length);
const cs = [...cd].sort((a, b) => a - b);
log('CAMDIST frames', cs.length, 'median', cs[Math.floor(cs.length / 2)].toFixed(2), 'p5', cs[Math.floor(cs.length * 0.05)].toFixed(2), 'min', cs[0].toFixed(2), '<2.5m', cs.filter((v) => v < 2.5).length, '<1.5m', cs.filter((v) => v < 1.5).length);
log('ERRORS', errors);
await browser.close();
