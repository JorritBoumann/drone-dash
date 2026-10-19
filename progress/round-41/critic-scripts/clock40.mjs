// Round 40 critic (new): run and delivery clocks during the crash slow-motion beat. Fixed step (advance(1/60) = one real
// frame). Finds a flat wall face (as crash39c), hits it head-on at SPEEDS, W held, and logs per frame: time scale, timeLeft,
// leg time, rush window. Over the slow-motion frames each clock must move by the real frame time (1/60), only the one
// -3 s crash charge on top.
// env: PORT (5191), SEED (22), SPEEDS (20,25), RUSH=1 (start rush hour at once so its window is live)
import { chromium } from '@playwright/test';
const PORT = process.env.PORT || '5191', seed = process.env.SEED || '22', Y = 10;
const SPEEDS = (process.env.SPEEDS || '14,20,25').split(',').map(Number);
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
await page.goto(`http://127.0.0.1:${PORT}/?seed=${seed}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
await page.evaluate(() => { const G = window.__GAME__; G.start(); G.manualRender(true); G.tune({ RUN: { startTime: 300 } }); });
const face = await page.evaluate(([Y]) => {
  const G = window.__GAME__;
  for (const rz of [-110, -66, -22, 22, 66, 110]) for (let bx = -130; bx <= 130; bx += 6) {
    let z = null; for (let d = 5; d <= 20; d += 0.5) { G.place(bx, Y, rz - d, 0, 0); const r = G.advance(1 / 60, false); if (r.player.position.z > rz - d + 0.3) { z = r.player.position.z; break; } }
    if (z == null) continue;
    let ok = true; for (const [dx, dy] of [[0, 2.5], [-5, 0], [5, 0]]) { G.place(bx + dx, Y + dy, z - 0.6, 0, 0); const r = G.advance(1 / 60, false); if (!(r.player.position.z > z - 0.6 + 0.2) || Math.abs(r.player.position.z - z) > 0.6) ok = false; }
    if (ok) return { bx, rz, z };
  }
  return null;
}, [Y]);
console.log('face', JSON.stringify(face));
const rows = [];
for (const v of SPEEDS) for (let rep = 0; rep < 2; rep++) {
  const r = await page.evaluate(([f, v, Y, rush]) => {
    const G = window.__GAME__;
    if (rush) { G.tune({ RUSH: { startAt: 0, everyAt: 0 } }); for (let leg = 0; leg < 8; leg++) { const e = G.diagnostics().escalation; if (e && e.active) break; const ph0 = G.diagnostics().objective.phase; for (let i = 0; i < 60; i++) { const d = G.diagnostics(); if (d.objective.phase !== ph0) break; const o = d.objective.position; G.place(o.x, o.y + 1.2, o.z, 0, 0); G.advance(0.25, false); } G.advance(0.3, false); } }
    G.place(f.bx, Y, f.z + 8, 0, 0); G.advance(1.5, false); // yaw 0 faces -z: the wall face is 8 m ahead
    G.place(f.bx, Y, f.z + 8, 0, v); let d = G.advance(1 / 60, false);
    G.key('KeyW', true);
    const out = []; let prev = d;
    for (let i = 0; i < 150; i++) {
      d = G.advance(1 / 60, false);
      const fl = d.feel || {};
      out.push({ i, ts: +(fl.timeScale ?? 1).toFixed(3), slow: (fl.slowMo || 0) > 0 || (fl.hitStop || 0) > 0, dLeft: +(d.timeLeft - prev.timeLeft).toFixed(4), dLeg: +((d.leg?.time ?? 0) - (prev.leg?.time ?? 0)).toFixed(4), dRun: +((fl.runTime ?? 0) - ((prev.feel || {}).runTime ?? 0)).toFixed(4), dLegClock: +((fl.legClock ?? 0) - ((prev.feel || {}).legClock ?? 0)).toFixed(4), crashes: d.crashes, rushLeft: d.escalation?.left ?? null, rushOn: d.escalation?.active ?? null });
      prev = d;
    }
    G.key('KeyW', false);
    return out;
  }, [face, v, Y, !!process.env.RUSH]);
  const slow = r.filter((x) => x.ts < 0.99);
  const crashFrame = r.findIndex((x, k) => k > 0 && x.crashes > r[k - 1].crashes);
  const legBad = slow.filter((x) => Math.abs(x.dLeg - 1 / 60) > 0.002 && x.dLeg !== 0).length;
  const leftOk = slow.filter((x, k) => Math.abs(x.dLeft + 1 / 60) <= 0.002).length;
  const leftOther = slow.filter((x) => Math.abs(x.dLeft + 1 / 60) > 0.002).map((x) => x.dLeft);
  const runOk = slow.filter((x) => Math.abs(x.dRun - 1 / 60) <= 0.002).length, legClockOk = slow.filter((x) => Math.abs(x.dLegClock - 1 / 60) <= 0.002).length;
  const rushD = []; for (let k = 1; k < r.length; k++) if (r[k].ts < 0.99 && r[k].rushLeft != null && r[k - 1].rushLeft != null) rushD.push(+(r[k].rushLeft - r[k - 1].rushLeft).toFixed(4));
  console.log(`v ${v} rep ${rep}: slow frames ${slow.length} (min scale ${Math.min(...r.map((x) => x.ts))}), charged ${r[r.length - 1].crashes - r[0].crashes + (r[0].crashes > 0 ? 0 : 0)} at frame ${crashFrame}; timeLeft -1/60 on ${leftOk}/${slow.length} slow frames, other steps ${JSON.stringify(leftOther)}; runTime +1/60 ${runOk}/${slow.length}; legClock +1/60 ${legClockOk}/${slow.length}; leg.time off ${legBad}; rush window steps in slow ${JSON.stringify([...new Set(rushD)])}`);
  console.log('   dLeg in slow frames', JSON.stringify([...new Set(slow.map((x) => x.dLeg))]), 'rush active', JSON.stringify([...new Set(r.map((x) => x.rushOn))]), 'rushLeft first/last', r[0].rushLeft, r[r.length - 1].rushLeft);
  rows.push({ v, rep, slow: slow.length, leftOk, leftOther, runOk, legClockOk, legBad });
}
await browser.close();
