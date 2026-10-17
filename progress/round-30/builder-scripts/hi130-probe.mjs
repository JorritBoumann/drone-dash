// Round 18 critic (new): why does the deterministic high-line bot stall on seed 130? Replays route-legs17 LINE=high to 30 s
// (same control, via the copied loop), then dumps the drone, the target, nearby features and contacts, screenshots it, and
// then tests a clean vertical descent onto the same pad from 30 m (place + hold Shift) and a street-level approach.
import { chromium } from '@playwright/test';
const OUT = '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/r30out/';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto('http://127.0.0.1:5190/?seed=130', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
await page.evaluate(() => { window.__GAME__.externalClock(true); window.__GAME__.start(); window.__GAME__.manualRender(true); });
const held = new Set();
const key = async (k, on) => { if (on && !held.has(k)) { held.add(k); await page.evaluate((k) => window.__GAME__.key(k, true), k); } if (!on && held.has(k)) { held.delete(k); await page.evaluate((k) => window.__GAME__.key(k, false), k); } };
const step = (s, r = false) => page.evaluate(([s, r]) => JSON.parse(JSON.stringify(window.__GAME__.advance(s, r))), [s, r]);
let d = await step(0.05), simT = 0, trace = [];
while (simT < 30 && d.state === 'playing') {
  const p = d.player.position, c = d.camera, o = d.objective.position;
  const hd = Math.hypot(o.x - p.x, o.z - p.z);
  const head = Math.atan2(p.x - c.x, p.z - c.z);
  let err = Math.atan2(o.x - p.x, o.z - p.z) - head; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
  const wantY = hd > 25 ? Math.max(o.y + 6, 40) : o.y + 1.2; const tgtSpeed = hd < 8 ? 4 : 99; const boost = hd > 60 && Math.abs(err) < 0.3 && d.player.boost > 0.3;
  await key('KeyD', Math.abs(err) > 0.1 && err < 0); await key('KeyA', Math.abs(err) > 0.1 && err > 0);
  await key('KeyW', Math.abs(err) < 0.8 && d.player.speed < tgtSpeed);
  await key('KeyS', d.player.speed > tgtSpeed + 3 || (Math.abs(err) > 1.2 && d.player.speed > 4));
  await key('KeyE', boost); await key('Space', p.y < wantY - 1.2); await key('ShiftLeft', p.y > wantY + 1.2);
  d = await step(0.05); simT += 0.05;
  if (Math.round(simT * 20) % 10 === 0) trace.push({ t: +simT.toFixed(1), x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1), sp: +d.player.speed.toFixed(1), hd: +hd.toFixed(1), err: +err.toFixed(2), keys: [...held].join('+'), contact: d.contact });
}
const o = d.objective; const p = d.player.position;
const near = await page.evaluate(([x, z]) => window.__GAME__.features().filter((f) => Math.hypot(f.x - x, f.z - z) < 40), [o.position.x, o.position.z]);
console.log('STALL ' + JSON.stringify({ obj: o, player: d.player, camera: d.camera, contact: d.contact, near }));
console.log('TRACE ' + JSON.stringify(trace.slice(-14)));
await step(0.0001, true); await page.screenshot({ path: OUT + 'H-seed130-stall.jpg', type: 'jpeg', quality: 80 });
for (const kk of [...held]) await key(kk, false);
// clean vertical descent from 30 m right above the pad
await page.evaluate(([x, z]) => window.__GAME__.place(x, 30, z, 0, 0), [o.position.x, o.position.z]);
await key('ShiftLeft', true); const ys = [];
for (let i = 0; i < 80; i++) { d = await step(0.05); if (i % 8 === 0) ys.push(+d.player.position.y.toFixed(2)); }
await key('ShiftLeft', false);
console.log('DESCENT ' + JSON.stringify({ ys, deliveries: d.deliveries, phase: d.objective.phase, contact: d.contact }));
await step(0.0001, true); await page.screenshot({ path: OUT + 'H-seed130-descent.jpg', type: 'jpeg', quality: 80 });
await browser.close();
