// Round 8 critic: player journey on desktop. Fresh profile (no localStorage), default URL (the city every player gets).
// Title shot, first 10 s with no input (what a new player sees), then the high-line pilot from route-play-rt-x plays a full run.
// Logs every delivery (time, points, clock bonus, leg length, clock left) and every 10 s of clock, then the game-over
// screen and the time from "Fly again" to control. Screenshots to ../critic/J-*.jpg.
import { chromium } from '@playwright/test';
const OUT = new URL('../critic/', import.meta.url).pathname;
const SEED = process.env.SEED; const HIGHY = Number(process.env.HIGHY || 40);
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
const shot = (n) => page.screenshot({ path: OUT + `J-${n}.jpg`, type: 'jpeg', quality: 80 });
await page.goto('http://127.0.0.1:5188/' + (SEED ? '?seed=' + SEED : ''), { waitUntil: 'networkidle' }); await page.waitForTimeout(1000);
await shot('00-title');
const titleText = await page.evaluate(() => document.querySelector('#title-screen')?.innerText);
console.log('TITLE', JSON.stringify(titleText));
await page.click('#play-button'); const t0 = Date.now();
const diag = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__THREE_GAME_DIAGNOSTICS__)));
for (const s of [1, 4, 10]) { await page.waitForTimeout(s * 1000 - (Date.now() - t0)); await shot(`01-idle-${String(s).padStart(2, '0')}s`); }
let d = await diag(); console.log('IDLE10', JSON.stringify({ timeLeft: d.timeLeft, score: d.score, phase: d.objective.phase, name: d.objective.name, hd: Math.hypot(d.objective.position.x - d.player.position.x, d.objective.position.z - d.player.position.z).toFixed(0) }));
// play
const held = new Set();
const key = async (k, on) => { if (on && !held.has(k)) { held.add(k); await page.keyboard.down(k); } if (!on && held.has(k)) { held.delete(k); await page.keyboard.up(k); } };
let prev = d, lastDel = d.deliveries, lastCl = -1, posHist = [], unstick = 0; const dels = []; const tStart = Date.now();
while (d.state === 'playing') {
  const p = d.player.position, c = d.camera, o = d.objective.position; const el = (Date.now() - t0) / 1000;
  const hd = Math.hypot(o.x - p.x, o.z - p.z);
  const head = Math.atan2(p.x - c.x, p.z - c.z);
  let err = Math.atan2(o.x - p.x, o.z - p.z) - head; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
  posHist.push([el, p.x, p.z]); while (posHist.length && posHist[0][0] < el - 3) posHist.shift();
  if (unstick <= 0 && posHist.length > 25 && el - posHist[0][0] > 2.7 && Math.hypot(posHist[0][1] - p.x, posHist[0][2] - p.z) < 1.5 && hd > 3) { unstick = 1.2; posHist = []; }
  const wantY = hd > 25 ? Math.max(o.y + 6, HIGHY) : o.y + 1.2; const tgt = hd < 8 ? 4 : 99; const boost = hd > 60 && Math.abs(err) < 0.3 && d.player.boost > 0.3;
  if (unstick > 0) { unstick -= 0.05; for (const kk of ['KeyW', 'KeyA', 'KeyD', 'ShiftLeft', 'KeyE']) await key(kk, false); await key('KeyS', true); await key('Space', true); }
  else {
    await key('KeyD', Math.abs(err) > 0.1 && err < 0); await key('KeyA', Math.abs(err) > 0.1 && err > 0);
    await key('KeyW', Math.abs(err) < 0.8 && d.player.speed < tgt); await key('KeyS', d.player.speed > tgt + 3 || (Math.abs(err) > 1.2 && d.player.speed > 4));
    await key('KeyE', boost); await key('Space', p.y < wantY - 1.2); await key('ShiftLeft', p.y > wantY + 1.2);
  }
  await page.waitForTimeout(40); prev = d; d = await diag();
  if (d.deliveries > lastDel) { lastDel = d.deliveries; const e = { n: d.deliveries, t: +((Date.now() - tStart) / 1000).toFixed(1), pts: d.score - prev.score, clockGain: +(d.timeLeft - prev.timeLeft).toFixed(1), clockLeft: +d.timeLeft.toFixed(1), combo: d.combo }; dels.push(e); console.log('DEL', JSON.stringify(e)); if (d.deliveries === 1 || d.deliveries === 6) await shot(`02-delivery-${d.deliveries}`); }
  if (d.state !== 'playing') break;
}
for (const kk of [...held]) await key(kk, false);
const runLen = (Date.now() - tStart) / 1000;
await page.waitForTimeout(1200); await shot('03-gameover');
const overText = await page.evaluate(() => document.querySelector('#over-screen')?.innerText);
console.log('RUN', JSON.stringify({ runLen: +runLen.toFixed(0), deliveries: d.deliveries, score: d.score, crashes: d.crashes }), 'OVER', JSON.stringify(overText));
const tA = Date.now(); await page.click('#again-button');
let st; do { st = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.state); } while (st !== 'playing' && Date.now() - tA < 5000);
console.log('RESTART ms', Date.now() - tA, 'state', st, 'errors', errors.length, errors.slice(0, 3));
await page.waitForTimeout(600); await shot('04-restart');
await browser.close();
