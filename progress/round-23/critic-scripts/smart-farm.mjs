// Round 13 critic (new): smart-farm. Smarter than farm-probe: it stays near the objective so the "toward target" rule
// pays as often as it can, and (MODE=pickup) it grabs the parcel first to get the second budget, then never delivers.
// Deterministic (manualRender + advance, 20 Hz control with real game keys), same controller as farm-loop.mjs.
// MODE=near   : laps the street block that holds the current target (pickup), hugging the inner facades at 7 m. Never lands.
// MODE=pickup : teleports onto the pickup pad (an upper bound: it saves the flight there), then laps the drop target's
//               block at 7 m and never delivers.
// MODE=pickupline : teleports onto the pickup, then farms one long straight street (ROADX, default 66) with U-turns (2 budgets).
// MODE=spendpickup: farms the straight street until the start budget is spent, THEN teleports onto the pickup (second
//                    budget) and goes back to the same spot at speed. Never delivers. The strongest no-delivery farm.
// MODE=straight   : the same street farm without the pickup (farm-probe through this controller, for comparison).
// MODE=line   : flies the street through the target, toward it, U-turns 15 m short and flies back (half the time toward).
import { chromium } from '@playwright/test';
const SEED = process.env.SEED || '22'; const SIMT = Number(process.env.SIMT || 600); const MODE = process.env.MODE || 'near';
const ROADX = Number(process.env.ROADX || 66); const CAP = Number(process.env.CAP || 15); const CORNER = Number(process.env.CORNER || 7); const I = Number(process.env.OFF || 6.5);
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
await page.goto('http://127.0.0.1:5191/?seed=' + SEED, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
const res = await page.evaluate(({ SIMT, CAP, CORNER, I, MODE, ROADX }) => {
  const G = window.__GAME__; G.start(); G.manualRender(true); let d = G.advance(0.1, false);
  const road = (v) => 22 + 44 * Math.floor((v - 22) / 44);
  let picked = 0;
  if (MODE === 'pickup' || MODE === 'pickupline') {
    const t = d.objective.position; G.place(t.x, t.y + 1.0, t.z, 0, 0); d = G.advance(0.2, false);
    for (let i = 0; i < 20 && d.objective.phase === 'pickup'; i++) { G.place(t.x, t.y + 0.6 + i * 0.1, t.z, 0, 0); d = G.advance(0.1, false); }
    picked = d.objective.phase === 'deliver' ? 1 : 0;
  }
  const t = d.objective.position; const X1 = road(t.x), X2 = X1 + 44, Z1 = road(t.z), Z2 = Z1 + 44;
  let wps;
  if (MODE === 'line') { const x = X1 + I; wps = [{ x, z: t.z - 120 }, { x, z: t.z - 15 }]; }
  else if (MODE === 'pickupline' || MODE === 'straight' || MODE === 'spendpickup') { const x = Number(ROADX) + I; wps = [{ x, z: -128 }, { x, z: 128 }]; }
  else wps = [{ x: X2 - I, z: Z2 - I }, { x: X1 + I, z: Z2 - I }, { x: X1 + I, z: Z1 + I }, { x: X2 - I, z: Z1 + I }];
  // start on the first leg, at speed, at 7 m
  const s0 = (MODE === 'line' || MODE === 'pickupline' || MODE === 'straight' || MODE === 'spendpickup') ? wps[0] : { x: X2 - I, z: Z1 + I + 5 };
  let yz = 0; for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { G.place(s0.x, 7, s0.z, yaw, 0); G.key('KeyW', true); const dd = G.advance(0.6, false); G.key('KeyW', false); if (dd.player.position.z - s0.z > 2) { yz = yaw; break; } }
  G.place(s0.x, 7, s0.z, yz, 8);
  d = G.advance(0.05, false); const c0 = d.timeLeft; let wi = (MODE === 'line' || MODE === 'pickupline' || MODE === 'straight' || MODE === 'spendpickup') ? 1 : 0; let simT = 0; const log = []; let n = 0, slow = 0, towardSum = 0; const keys = new Set();
  const key = (k, on) => { if (on !== keys.has(k)) { on ? keys.add(k) : keys.delete(k); G.key(k, on); } };
  let prevP = { ...d.player.position }; const crashAt = []; let pc = d.crashes; let laps = 0; let spentAt = null; let wrongWay = 0;
  while (simT < SIMT && d.state === 'playing') {
    const p = d.player.position, c = d.camera;
    const vx = (p.x - prevP.x) / 0.05, vz = (p.z - prevP.z) / 0.05; prevP = { ...p };
    const sp = Math.hypot(vx, vz); const head = sp > 3 ? Math.atan2(vx, vz) : Math.atan2(p.x - c.x, p.z - c.z);
    let w = wps[wi]; let wd = Math.hypot(w.x - p.x, w.z - p.z);
    if (wd < 4) { wi = (wi + 1) % wps.length; if (wi === 0) laps++; w = wps[wi]; wd = Math.hypot(w.x - p.x, w.z - p.z); }
    let err = Math.atan2(w.x - p.x, w.z - p.z) - head; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
    const tgt = wd < 16 ? CORNER : CAP;
    const braking = (MODE === 'line' || MODE === 'pickupline' || MODE === 'straight' || MODE === 'spendpickup') && d.player.speed > 2 && Math.abs(err) > 1.2;
    key('KeyD', !braking && err < -0.06); key('KeyA', !braking && err > 0.06);
    key('KeyW', !braking && Math.abs(err) < 0.6 && d.player.speed < tgt); key('KeyS', braking || d.player.speed > tgt + 2.5 || (Math.abs(err) > 1.2 && d.player.speed > 3));
    key('Space', p.y < 6.3); key('ShiftLeft', p.y > 7.7);
    if (MODE === 'spendpickup' && !picked && d.slipstream.budget <= 0.001) {
      // spend the start budget first, then teleport onto the pickup (refills to 8), then back to the farm street at speed
      for (const k of [...keys]) key(k, false);
      const pt = d.objective.position; for (let i = 0; i < 20 && d.objective.phase === 'pickup'; i++) { G.place(pt.x, pt.y + 0.6 + i * 0.1, pt.z, 0, 0); d = G.advance(0.1, false); simT += 0.1; }
      picked = d.objective.phase === 'deliver' ? 1 : 0; G.place(p.x, 7, p.z, head, 8); prevP = { ...p };
    }
    d = G.advance(0.05, false); simT += 0.05; n++;
    if (d.crashes > pc) { pc = d.crashes; crashAt.push(+simT.toFixed(1)); }
    const ss = d.slipstream; if (ss.clockGain >= 0.03) slow++; towardSum += ss.toward;
    if (spentAt == null && ss.budget <= 0.001) spentAt = +simT.toFixed(1);
    if (ss.clockK >= 0.3 && ss.clockGain < 0.03 && ss.budget > 0 && ss.toward < 0.05) wrongWay++;
    if (Math.abs(simT % 10) < 0.026) log.push({ t: Math.round(simT), clock: +d.timeLeft.toFixed(1), score: d.score, tier: d.goals.tierName, payouts: ss.payouts, chain: ss.chain, budget: +ss.budget.toFixed(1), toward: +ss.toward.toFixed(2), slipS: +ss.seconds.toFixed(1), phase: d.objective.phase, deliveries: d.deliveries });
  }
  for (const k of [...keys]) key(k, false);
  return { mode: MODE, picked, rect: [X1, X2, Z1, Z2], clockAtStart: +c0.toFixed(1), simT: +simT.toFixed(1), state: d.state, score: d.score, tier: d.goals.tierName, payouts: d.slipstream.payouts, slipSeconds: +d.slipstream.seconds.toFixed(2), crashes: d.crashes, deliveries: d.deliveries, slowShare: +(slow / n).toFixed(2), meanToward: +(towardSum / n).toFixed(2), budgetSpentAt: spentAt, wrongWayShare: +(wrongWay / n).toFixed(2), laps, crashAt, breakdown: d.breakdown, log };
}, { SIMT, CAP, CORNER, I, MODE, ROADX });
for (const l of res.log) console.log('T ' + JSON.stringify(l));
delete res.log; console.log('SMART ' + JSON.stringify({ seed: SEED, ...res }));
await page.screenshot({ path: new URL('../critic/', import.meta.url).pathname + `S-smartfarm-${MODE}-seed${SEED}.jpg`, type: 'jpeg', quality: 80 });
await browser.close();
