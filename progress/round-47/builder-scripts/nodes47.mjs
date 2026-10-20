// Round 47 builder: copy of round 46 nodes46.mjs (unchanged logic).
// Round 46 builder (codex high, item A): does the live audio graph stay flat over a 5 minute session?
// Hooks AudioNode.connect / disconnect before the game loads and counts the nodes that still have an outgoing connection
// (a one-shot graph that is never disconnected stays in this count for ever). A 300 s run: the drone flies with a simple
// random pilot (throttle, turns, boost, climbs, wall hits), the music is held at each chain level in turn and in the last-10-s
// section, the soundtrack switches Breakbeat -> Classic at 150 s. Every 10 s: connected nodes, live and reaped one-shots, JS heap.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const PORT = Number(process.env.PORT || 5199); if (PORT === 5188) throw new Error('5188 is the owner');
const DUR = Number(process.env.DUR || 300);
const browser = await chromium.launch({ channel: 'chromium', args: ['--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.addInitScript(() => {
  const C = AudioNode.prototype.connect, D = AudioNode.prototype.disconnect; const out = new Map(); let made = 0;
  AudioNode.prototype.connect = function (dest, ...r) { if (!out.has(this)) made++; out.set(this, (out.get(this) || 0) + 1); return C.call(this, dest, ...r); };
  AudioNode.prototype.disconnect = function (...a) { if (a.length === 0) out.delete(this); else { const n = (out.get(this) || 1) - 1; if (n <= 0) out.delete(this); else out.set(this, n); } return D.apply(this, a); };
  window.__nodes = () => ({ connected: out.size, everConnected: made });
});
await page.goto(`http://127.0.0.1:${PORT}/?seed=22&music=breakbeat`, { waitUntil: 'networkidle' }); await page.waitForTimeout(2000);
await page.keyboard.press('ShiftLeft'); await page.waitForTimeout(500);
await page.evaluate((d) => window.__GAME__.tune({ RUN: { startTime: d + 30 } }), DUR);
await page.keyboard.press('Enter'); await page.waitForTimeout(500);
const rows = []; const t0 = Date.now(); let nextS = 0; let held = new Set();
const key = async (k, on) => { if (on && !held.has(k)) { held.add(k); await page.keyboard.down(k); } if (!on && held.has(k)) { held.delete(k); await page.keyboard.up(k); } };
let r = 1;
const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
while ((Date.now() - t0) / 1000 < DUR) {
  const el = (Date.now() - t0) / 1000;
  const phase = Math.floor(el / 25) % 6; // music: chain 0,1,2,3, final, released
  await page.evaluate((p) => window.__GAME__.musicForce(p < 4 ? p : p === 4 ? 3 : null, p === 4), phase);
  if (el > DUR / 2 && !rows.switched) { rows.switched = true; await page.evaluate(() => window.__GAME__.soundtrack('classic')); }
  await key('KeyW', rnd() < 0.85); await key('KeyA', rnd() < 0.25); await key('KeyD', rnd() < 0.25); await key('KeyE', rnd() < 0.2);
  const d = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.player.position.y);
  await key('Space', d < 5); await key('ShiftLeft', d > 14);
  if (el >= nextS) {
    nextS += 10;
    const s = await page.evaluate(() => { const g = window.__THREE_GAME_DIAGNOSTICS__; return { ...window.__nodes(), live: g.audio.sfx.liveOneShots, reaped: g.audio.sfx.reapedOneShots, notes: g.audio.music.notes, track: g.audio.music.soundtrack, section: g.audio.music.track + '/' + g.audio.music.section, state: g.state, scrapes: g.feel.scrapes, crashes: g.crashes, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null }; });
    s.t = Math.round(el); rows.push(s); console.log(JSON.stringify(s));
  }
  await page.waitForTimeout(250);
}
for (const k of [...held]) await key(k, false);
const c = rows.map((x) => x.connected); const half = c.slice(Math.floor(c.length / 2));
console.log('SUMMARY', JSON.stringify({ samples: rows.length, connectedMin: Math.min(...c), connectedMax: Math.max(...c), connectedFirst: c[1], connectedLast: c.at(-1), secondHalfRange: [Math.min(...half), Math.max(...half)], liveMax: Math.max(...rows.map((x) => x.live)), reaped: rows.at(-1).reaped, everConnected: rows.at(-1).everConnected, errors }));
await browser.close();
