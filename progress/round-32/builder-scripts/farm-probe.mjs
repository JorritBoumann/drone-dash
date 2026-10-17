// Round 12 critic (new): farm-probe. Can a skilled street pilot farm the slow clock?
// Deterministic (manualRender + advance, 20 Hz control with real game keys). Never picks up or delivers.
// Flies up and down one long street at 7 m, OFF metres right of the road centre (6.5 = 2.5 m from a facade), at cruise,
// and does a real U-turn (brake, yaw with A, accelerate) at each end. Logs clock, score, medal and frozen share every 10 s.
// ROAD (default 66), OFF (default 6.5), SIMT (default 600 s of sim), SEED (default 22).
import { chromium } from '@playwright/test';
const SEED = process.env.SEED || '22'; const ROAD = Number(process.env.ROAD || 66); const OFF = Number(process.env.OFF || 6.5); const SIMT = Number(process.env.SIMT || 600); const END = Number(process.env.END || 128); const CAP = Number(process.env.CAP || 15);
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
await page.goto('http://127.0.0.1:5190/?seed=' + SEED, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
const res = await page.evaluate(async ({ ROAD, OFF, SIMT, END, CAP }) => {
  const G = window.__GAME__; G.start(); G.manualRender(true); G.advance(0.1, false);
  // find the yaw that flies +z
  let yz = 0; for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { G.place(ROAD + OFF, 7, -END, yaw, 0); G.key('KeyW', true); const d = G.advance(0.6, false); G.key('KeyW', false); if (d.player.position.z + END > 2) { yz = yaw; break; } }
  G.restart && G.restart(); G.start(); G.advance(0.1, false);
  G.place(ROAD + OFF, 7, -END, yz, 8);
  let d = G.advance(0.05, false); const t0 = d.timeLeft; let dir = 1; let turning = 0; let simT = 0; const log = []; let frozen = 0, slow = 0, n = 0; const keys = new Set();
  const key = (k, on) => { if (on !== keys.has(k)) { on ? keys.add(k) : keys.delete(k); G.key(k, on); } };
  let prevP = { ...d.player.position }; const crashAt = []; let pc = d.crashes; let maxTime = d.timeLeft; let uturns = 0;
  while (simT < SIMT && d.state === 'playing') {
    const p = d.player.position, c = d.camera;
    const vx = (p.x - prevP.x) / 0.05, vz = (p.z - prevP.z) / 0.05; prevP = { ...p };
    const sp = Math.hypot(vx, vz); const head = sp > 3 && !turning ? Math.atan2(vx, vz) : Math.atan2(p.x - c.x, p.z - c.z);
    if (!turning && dir * p.z > END) { turning = 1; dir = -dir; uturns++; }
    const want = { x: ROAD + OFF, z: p.z + dir * 22 };
    let err = Math.atan2(want.x - p.x, want.z - p.z) - head; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
    if (turning && Math.abs(err) < 0.25) turning = 0;
    // U-turn: brake to a hover first, then yaw in place, then go (a careful player's turn, no wall contact)
    const braking = turning && d.player.speed > 2 && Math.abs(err) > 1.2;
    key('KeyD', !braking && err < -0.06); key('KeyA', !braking && err > 0.06);
    key('KeyW', !braking && Math.abs(err) < 0.5 && d.player.speed < CAP); key('KeyS', braking || (Math.abs(err) > 1.2 && d.player.speed > 3));
    key('Space', p.y < 6.3); key('ShiftLeft', p.y > 7.7);
    d = G.advance(0.05, false); simT += 0.05; n++; if (d.crashes > pc) { pc = d.crashes; crashAt.push({ t: +simT.toFixed(1), x: +d.player.position.x.toFixed(1), z: +d.player.position.z.toFixed(0), y: +d.player.position.y.toFixed(1), lc: d.lastCrash }); }
    const g = d.slipstream.clockGain; if (g >= 0.95) frozen++; if (g >= 0.03) slow++;
    maxTime = Math.max(maxTime, d.timeLeft);
    if (Math.abs(simT % 10) < 0.026) log.push({ t: Math.round(simT), clock: +d.timeLeft.toFixed(1), score: d.score, tier: d.goals.tierName, payouts: d.slipstream.payouts, chain: d.slipstream.chain, crashes: d.crashes, x: +p.x.toFixed(1), z: +p.z.toFixed(0), spd: +d.player.speed.toFixed(1), gain: +g.toFixed(2) });
  }
  for (const k of [...keys]) key(k, false);
  return { start: t0, simT: +simT.toFixed(0), state: d.state, timeLeft: +d.timeLeft.toFixed(1), maxTime: +maxTime.toFixed(1), score: d.score, tier: d.goals.tierName, payouts: d.slipstream.payouts, slipSeconds: d.slipstream.seconds, crashes: d.crashes, deliveries: d.deliveries, frozenShare: +(frozen / n).toFixed(2), slowShare: +(slow / n).toFixed(2), uturns, crashAt, breakdown: d.breakdown, log };
}, { ROAD, OFF, SIMT, END, CAP });
for (const l of res.log) console.log('T ' + JSON.stringify(l));
delete res.log; console.log('FARM ' + JSON.stringify({ seed: SEED, road: ROAD, off: OFF, ...res }));
await page.screenshot({ path: new URL('./out/', import.meta.url).pathname + `F-farm-seed${SEED}-road${ROAD}.jpg`, type: 'jpeg', quality: 80 });
await browser.close();
