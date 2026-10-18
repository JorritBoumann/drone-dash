// Round 12 critic (new): farm-loop. Like farm-probe.mjs, but laps a rectangle of streets (no U-turns), hugging the inner
// facades 2.5 m off (6.5 m from the road centre), braking to CORNER m/s into each corner. Never delivers.
// X1,X2 roads (default 22,66), Z1,Z2 roads (default -110,110). SIMT default 600.
import { chromium } from '@playwright/test';
const SEED = process.env.SEED || '22'; const SIMT = Number(process.env.SIMT || 600); const CAP = Number(process.env.CAP || 15); const CORNER = Number(process.env.CORNER || 7);
const X1 = Number(process.env.X1 || 22), X2 = Number(process.env.X2 || 66), Z1 = Number(process.env.Z1 || -110), Z2 = Number(process.env.Z2 || 110), I = Number(process.env.OFF || 6.5);
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
await page.goto('http://127.0.0.1:5190/?seed=' + SEED, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
const res = await page.evaluate(({ SIMT, CAP, CORNER, X1, X2, Z1, Z2, I }) => {
  const G = window.__GAME__; G.start(); G.manualRender(true); G.advance(0.1, false);
  const wps = [{ x: X2 - I, z: Z2 - I }, { x: X1 + I, z: Z2 - I }, { x: X1 + I, z: Z1 + I }, { x: X2 - I, z: Z1 + I }];
  let yz = 0; for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { G.place(X2 - I, 7, Z1 + I + 5, yaw, 0); G.key('KeyW', true); const d = G.advance(0.6, false); G.key('KeyW', false); if (d.player.position.z - (Z1 + I + 5) > 2) { yz = yaw; break; } }
  G.restart && G.restart(); G.start(); G.advance(0.1, false);
  G.place(X2 - I, 7, Z1 + I + 5, yz, 8);
  let d = G.advance(0.05, false); const t0 = d.timeLeft; let wi = 0; let simT = 0; const log = []; let frozen = 0, slow = 0, n = 0; const keys = new Set();
  const key = (k, on) => { if (on !== keys.has(k)) { on ? keys.add(k) : keys.delete(k); G.key(k, on); } };
  let prevP = { ...d.player.position }; let laps = 0; const crashAt = []; let pc = d.crashes; let maxTime = t0;
  while (simT < SIMT && d.state === 'playing') {
    const p = d.player.position, c = d.camera;
    const vx = (p.x - prevP.x) / 0.05, vz = (p.z - prevP.z) / 0.05; prevP = { ...p };
    const sp = Math.hypot(vx, vz); const head = sp > 3 ? Math.atan2(vx, vz) : Math.atan2(p.x - c.x, p.z - c.z);
    let w = wps[wi]; let wd = Math.hypot(w.x - p.x, w.z - p.z);
    if (wd < 4) { wi = (wi + 1) % 4; if (wi === 0) laps++; w = wps[wi]; wd = Math.hypot(w.x - p.x, w.z - p.z); }
    let err = Math.atan2(w.x - p.x, w.z - p.z) - head; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
    const tgt = wd < 16 ? CORNER : CAP;
    key('KeyD', err < -0.06); key('KeyA', err > 0.06);
    key('KeyW', Math.abs(err) < 0.6 && d.player.speed < tgt); key('KeyS', d.player.speed > tgt + 2.5 || (Math.abs(err) > 1.2 && d.player.speed > 3));
    key('Space', p.y < 6.3); key('ShiftLeft', p.y > 7.7);
    d = G.advance(0.05, false); simT += 0.05; n++;
    if (d.crashes > pc) { pc = d.crashes; crashAt.push({ t: +simT.toFixed(1), x: +d.player.position.x.toFixed(1), z: +d.player.position.z.toFixed(0) }); }
    const g = d.slipstream.clockGain; if (g >= 0.95) frozen++; if (g >= 0.03) slow++; maxTime = Math.max(maxTime, d.timeLeft);
    if (n % 400 === 0) log.push({ t: Math.round(simT), clock: +d.timeLeft.toFixed(1), score: d.score, tier: d.goals.tierName, payouts: d.slipstream.payouts, chain: d.slipstream.chain, crashes: d.crashes, laps });
  }
  for (const k of [...keys]) key(k, false);
  return { start: +t0.toFixed(1), simT: +simT.toFixed(0), state: d.state, timeLeft: +d.timeLeft.toFixed(1), maxTime: +maxTime.toFixed(1), score: d.score, tier: d.goals.tierName, payouts: d.slipstream.payouts, slipSeconds: +d.slipstream.seconds.toFixed(1), crashes: d.crashes, deliveries: d.deliveries, frozenShare: +(frozen / n).toFixed(2), slowShare: +(slow / n).toFixed(2), laps, crashAt, log };
}, { SIMT, CAP, CORNER, X1, X2, Z1, Z2, I });
for (const l of res.log) console.log('T ' + JSON.stringify(l));
delete res.log; console.log('LOOP ' + JSON.stringify({ seed: SEED, rect: [X1, X2, Z1, Z2], ...res }));
await browser.close();
