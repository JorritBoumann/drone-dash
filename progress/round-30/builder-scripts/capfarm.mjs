// Round 14 critic (new): capfarm. A farm aimed at the round 14 street bonus (bank paid on delivery, capped per leg).
// Deterministic (manualRender + advance, 20 Hz control with real game keys). Routed low-line pilot (same route() and
// low-line logic as route-play-rt-x-m.mjs) that DOES deliver, with an optional farm phase:
// MODE=honest : routes pickup -> drop, never farms (baseline in this same controller).
// MODE=carry  : after each pickup, farms the street it is on (U-turns, 2.5 m off the facade, cruise CAP) until the
//               leg's bank is full (legBanked >= legCap - 5) or FARMMAX s, then routes to the drop.
// MODE=both   : also farms on the way to each pickup (bank rides on the parcel at 0.75) until that leg is full.
// SEED, SIMT (default 600), CAP (farm cruise, 15), FARMMAX (default 60 s per leg).
import { chromium } from '@playwright/test';
const SEED = process.env.SEED || '22'; const SIMT = Number(process.env.SIMT || 600); const MODE = process.env.MODE || 'carry';
const CAP = Number(process.env.CAP || 15); const FARMMAX = Number(process.env.FARMMAX || 60); const OFFS = Number(process.env.OFF || 6.5);
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
await page.goto('http://127.0.0.1:5190/?seed=' + SEED, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
const res = await page.evaluate(({ SIMT, MODE, CAP, FARMMAX, OFFS }) => {
  const ROADS = [-154, -110, -66, -22, 22, 66, 110, 154];
  const nr = (v) => ROADS.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
  function route(p, o) {
    const onX = Math.abs(p.x - nr(p.x)) < Math.abs(p.z - nr(p.z));
    const Xc = nr(p.x), Zc = nr(p.z), Xt = nr(o.x), Zt = nr(o.z);
    const finalOnX = Math.abs(o.x - Xt) < Math.abs(o.z - Zt);
    const last = finalOnX ? { x: Xt, z: o.z } : { x: o.x, z: Zt };
    let pts;
    if (onX) pts = finalOnX && Xc === Xt ? [{ x: Xc, z: p.z }, last] : [{ x: Xc, z: p.z }, { x: Xc, z: Zt }, { x: Xt, z: Zt }, last];
    else pts = !finalOnX && Zc === Zt ? [{ x: p.x, z: Zc }, last] : [{ x: p.x, z: Zc }, { x: Xt, z: Zc }, { x: Xt, z: Zt }, last];
    pts.push({ x: o.x, z: o.z, final: true });
    const out = []; for (const q of pts) { const l = out[out.length - 1] || p; if (Math.hypot(q.x - l.x, q.z - l.z) > 3 || q.final) out.push(q); }
    return out;
  }
  const G = window.__GAME__; G.start(); G.manualRender(true); let d = G.advance(0.1, false);
  const keys = new Set(); const key = (k, on) => { if (on !== keys.has(k)) { on ? keys.add(k) : keys.delete(k); G.key(k, on); } };
  let prevP = { ...d.player.position }; let simT = 0; let legKey = ''; let wps = []; let leaving = true; const posHist = []; let unstick = 0;
  let farm = null; // { along: 'z'|'x', fixed, lo, hi, dir, until, turning, t0 }
  const legs = []; let pc = d.crashes; const crashAt = []; let farmTime = 0; const log = [];
  const startFarm = (p) => {
    const onX = Math.abs(p.x - nr(p.x)) < Math.abs(p.z - nr(p.z)); // on a road that runs along z
    const along = onX ? 'z' : 'x'; const fixed = (onX ? nr(p.x) : nr(p.z)) + OFFS; const cur = onX ? p.z : p.x;
    const lo = Math.max(-128, cur - 70), hi = Math.min(128, cur + 70);
    farm = { along, fixed, lo: hi - lo < 60 ? -128 : lo, hi: hi - lo < 60 ? 128 : hi, dir: 1, turning: 0, t0: simT };
  };
  while (simT < SIMT && d.state === 'playing') {
    const p = d.player.position, c = d.camera, o = d.objective.position, ss = d.slipstream;
    const vx = (p.x - prevP.x) / 0.05, vz = (p.z - prevP.z) / 0.05; prevP = { ...p };
    const k = d.objective.phase + d.objective.name;
    if (k !== legKey) {
      legs.push({ t: +simT.toFixed(1), phase: d.objective.phase, legCap: ss.legCap, bank: ss.bank, score: d.score, del: d.deliveries });
      legKey = k; leaving = true; posHist.length = 0; farm = null;
      const wantFarm = (MODE === 'carry' && d.objective.phase === 'deliver') || (MODE === 'both');
      if (wantFarm) startFarm(p);
      wps = route(p, o);
    }
    if (farm && (ss.legBanked >= ss.legCap - 5 || simT - farm.t0 > FARMMAX)) { farmTime += simT - farm.t0; farm = null; wps = route(p, o); leaving = true; posHist.length = 0; }
    let err, tgtSpeed, wantY, boost = false;
    const head0 = Math.hypot(vx, vz) > 3 ? Math.atan2(vx, vz) : Math.atan2(p.x - c.x, p.z - c.z);
    if (farm) {
      const along = farm.along === 'z' ? p.z : p.x;
      if (!farm.turning && ((farm.dir > 0 && along > farm.hi) || (farm.dir < 0 && along < farm.lo))) { farm.turning = 1; farm.dir = -farm.dir; }
      const want = farm.along === 'z' ? { x: farm.fixed, z: p.z + farm.dir * 22 } : { x: p.x + farm.dir * 22, z: farm.fixed };
      const head = farm.turning ? Math.atan2(p.x - c.x, p.z - c.z) : head0;
      err = Math.atan2(want.x - p.x, want.z - p.z) - head; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
      if (farm.turning && Math.abs(err) < 0.25) farm.turning = 0;
      const braking = farm.turning && d.player.speed > 2 && Math.abs(err) > 1.2;
      key('KeyD', !braking && err < -0.06); key('KeyA', !braking && err > 0.06);
      key('KeyW', !braking && Math.abs(err) < 0.5 && d.player.speed < CAP); key('KeyS', braking || (Math.abs(err) > 1.2 && d.player.speed > 3));
      key('KeyE', false); key('Space', p.y < 6.3); key('ShiftLeft', p.y > 7.7);
    } else {
      const hd = Math.hypot(o.x - p.x, o.z - p.z);
      let w = wps[0]; let wd = Math.hypot(w.x - p.x, w.z - p.z);
      if (!w.final && (wd < 4 || hd < 14)) { leaving = false; wps.shift(); w = wps[0]; wd = Math.hypot(w.x - p.x, w.z - p.z); }
      const head = Math.hypot(vx, vz) > 4 ? Math.atan2(vx, vz) : Math.atan2(p.x - c.x, p.z - c.z);
      err = Math.atan2(w.x - p.x, w.z - p.z) - head; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
      posHist.push([simT, p.x, p.z]); while (posHist.length && posHist[0][0] < simT - 3) posHist.shift();
      if (unstick <= 0 && posHist.length > 25 && simT - posHist[0][0] > 2.7 && Math.hypot(posHist[0][1] - p.x, posHist[0][2] - p.z) < 1.5 && hd > 3) { unstick = 1.2; posHist.length = 0; }
      const raised = o.y > 2;
      const offRoad = leaving && Math.min(Math.abs(p.x - nr(p.x)), Math.abs(p.z - nr(p.z))) > 6.5;
      wantY = offRoad && hd >= 30 ? 26 : hd < 30 ? (raised ? o.y + 1.5 : o.y + 1.2) : (raised && hd < 45 ? o.y + 2 : 7);
      const corner = !w.final && wd < 14;
      tgtSpeed = hd < 8 ? 4 : corner ? 7 : w.final && hd < 25 ? 8 : 16;
      boost = !corner && !w.final && wd > 55 && Math.abs(err) < 0.12 && d.player.boost > 0.3;
      if (raised && hd < 30 && p.y < o.y - 0.5) tgtSpeed = 1;
      if (Math.abs(err) > 0.5) tgtSpeed = Math.min(tgtSpeed, 8);
      if (unstick > 0) { unstick -= 0.05; for (const kk of ['KeyW', 'KeyA', 'KeyD', 'ShiftLeft', 'KeyE']) key(kk, false); key('KeyS', true); key('Space', true); }
      else {
        key('KeyD', Math.abs(err) > 0.1 && err < 0); key('KeyA', Math.abs(err) > 0.1 && err > 0);
        key('KeyW', Math.abs(err) < 0.8 && d.player.speed < tgtSpeed);
        key('KeyS', d.player.speed > tgtSpeed + 3 || (Math.abs(err) > 1.2 && d.player.speed > 4));
        key('KeyE', boost); key('Space', p.y < wantY - 1.2); key('ShiftLeft', p.y > wantY + 1.2);
      }
    }
    d = G.advance(0.05, false); simT += 0.05;
    if (d.crashes > pc) { pc = d.crashes; crashAt.push(+simT.toFixed(1)); }
    if (Math.abs(simT % 10) < 0.026) log.push({ t: Math.round(simT), clock: +d.timeLeft.toFixed(1), score: d.score, bank: d.slipstream.bank, legB: d.slipstream.legBanked, legCap: d.slipstream.legCap, del: d.deliveries, farming: !!farm });
  }
  if (farm) farmTime += simT - farm.t0;
  for (const kk of [...keys]) key(kk, false);
  const ss = d.slipstream;
  return { mode: MODE, simT: +simT.toFixed(1), state: d.state, score: d.score, tier: d.goals.tierName, perMin: Math.round(d.score / simT * 60), deliveries: d.deliveries, crashes: d.crashes, farmTime: +farmTime.toFixed(1), bankTotal: ss.bankTotal, bankPaid: ss.bankPaid, bankLost: ss.bankLost, bankUnpaid: ss.bank, payouts: ss.payouts, breakdown: d.breakdown, crashAt, legs, log };
}, { SIMT, MODE, CAP, FARMMAX, OFFS });
for (const l of res.log) console.log('T ' + JSON.stringify(l));
for (const l of res.legs) console.log('L ' + JSON.stringify(l));
delete res.log; delete res.legs; console.log('CAPFARM ' + JSON.stringify({ seed: SEED, ...res }));
await page.screenshot({ path: '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/r30out/' + `C-capfarm-${MODE}-seed${SEED}.jpg`, type: 'jpeg', quality: 80 });
await browser.close();
