// Round 17 critic (new): ot-shots = route-legs17 control (deterministic street bot) with screenshots of the run's ending: last call pop,
// clock at 0, overtime start, mid overtime, the overtime delivery, and the game-over card. MOBILE=1: iPhone 13 landscape viewport with touch.
// Round 17 critic: route-legs17 = route-legs16 plus log-only ending detail: distance and climb left and bank when the clock first reaches 0, and the score-log ending entries. Control logic identical.
// Round 16 critic: route-legs16 = route-play.mjs (deterministic) plus log-only leg detail (street distance, target height, leg time, clock left)
// and a screenshot 0.5 s before the clock runs out (LEGSHOT=1). Control logic identical at the default step. Uses the external clock (route-play.mjs did not, so the game loop also ran in real time).
// Round 5 critic: a routed, player-like pilot. Deterministic (manualRender + advance in 50 ms steps, about human reaction time).
// LINE=low  : follows the street grid (roads every 44 m), corner to corner, at LOWY (default 7 m), brakes into corners,
//             boosts only on long straight street runs, climbs at the building for rooftop pads.
// LINE=high : the arrival bot's line: straight at the target at 40 m, boost when far, drop at the pad.
// Plays each seed until the clock runs out (or SIMT). Logs deliveries, crashes (with speed 0.3 s before), score.
import { chromium, devices } from '@playwright/test';
const MOBILE = !!process.env.MOBILE; const P = MOBILE ? 'm' : 'd';
const OUT = new URL('../../builder-shots/', import.meta.url).pathname;
const LINE = process.env.LINE || 'low'; const CORNER = Number(process.env.CORNER || 7); const BOOSTD = Number(process.env.BOOSTD || 55); /* low line: corner speed, min straight length to boost */ const LOWY = Number(process.env.LOWY || 7); const SIMT = Number(process.env.SIMT || 300);
const seeds = (process.env.SEEDS || '11,22,58,130').split(',');
const ROADS = [-154, -110, -66, -22, 22, 66, 110, 154];
const nr = (v) => ROADS.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
const browser = await chromium.launch({ channel: 'chromium' });
const results = [];
function route(p, o) {
  const onX = Math.abs(p.x - nr(p.x)) < Math.abs(p.z - nr(p.z));
  const Xc = nr(p.x), Zc = nr(p.z), Xt = nr(o.x), Zt = nr(o.z);
  const finalOnX = Math.abs(o.x - Xt) < Math.abs(o.z - Zt); // target sits beside an x-road (one that runs along z)
  const last = finalOnX ? { x: Xt, z: o.z } : { x: o.x, z: Zt };
  let pts;
  if (onX) pts = finalOnX && Xc === Xt ? [{ x: Xc, z: p.z }, last] : [{ x: Xc, z: p.z }, { x: Xc, z: Zt }, { x: Xt, z: Zt }, last];
  else pts = !finalOnX && Zc === Zt ? [{ x: p.x, z: Zc }, last] : [{ x: p.x, z: Zc }, { x: Xt, z: Zc }, { x: Xt, z: Zt }, last];
  pts.push({ x: o.x, z: o.z, final: true });
  const out = []; for (const q of pts) { const l = out[out.length - 1] || p; if (Math.hypot(q.x - l.x, q.z - l.z) > 3 || q.final) out.push(q); }
  return out;
}
for (const seed of seeds) {
  const page = await (await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'], viewport: { width: 844, height: 390 } } : { viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto('http://127.0.0.1:5190/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  await page.evaluate(() => { window.__GAME__.externalClock(true); window.__GAME__.start(); window.__GAME__.manualRender(true); }); // round 16: external clock so only advance moves the game
  const held = new Set();
  const key = async (k, on) => { if (on && !held.has(k)) { held.add(k); await page.evaluate((k) => window.__GAME__.key(k, true), k); } if (!on && held.has(k)) { held.delete(k); await page.evaluate((k) => window.__GAME__.key(k, false), k); } };
  const step = (s, r = false) => page.evaluate(([s, r]) => JSON.parse(JSON.stringify(window.__GAME__.advance(s, r))), [s, r]);
  let d = await step(0.05); let leaving = true; const posHist = []; let simT = 0, prev = d, legKey = '', wps = [], hist = [], unstick = 0, shots = 0; const sp = []; const crashes = []; let altSum = 0, n = 0, spSum = 0; const LEGS = []; let L0 = { t: 0, g: 0, y: 0 }; let endShot = false; const S = {}; let zero = null;
  while (simT < SIMT && d.state === 'playing') {
    const p = d.player.position, c = d.camera, o = d.objective.position;
    const k = d.objective.phase + d.objective.name;
    if (k !== legKey) { if (legKey) LEGS.push({ n: legKey.slice(0, 2), g: L0.g, y: L0.y, t: +(simT - L0.t).toFixed(1), left: +d.timeLeft.toFixed(1) }); L0 = { t: simT, g: Math.round(Math.abs(o.x - p.x) + Math.abs(o.z - p.z)), y: Math.round(o.y) }; legKey = k; leaving = true; posHist.length = 0; wps = LINE === 'low' ? route(p, o) : [{ x: o.x, z: o.z, final: true }]; }
    const hd = Math.hypot(o.x - p.x, o.z - p.z);
    let w = wps[0]; let wd = Math.hypot(w.x - p.x, w.z - p.z);
    if (!w.final && (wd < 4 || hd < 14)) { leaving = false; wps.shift(); w = wps[0]; wd = Math.hypot(w.x - p.x, w.z - p.z); }
    const vx = (p.x - prev.player.position.x) / 0.05, vz = (p.z - prev.player.position.z) / 0.05; const head = LINE === 'low' && Math.hypot(vx, vz) > 4 ? Math.atan2(vx, vz) : Math.atan2(p.x - c.x, p.z - c.z);
    let err = Math.atan2(w.x - p.x, w.z - p.z) - head; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
    posHist.push([simT, p.x, p.z]); while (posHist.length && posHist[0][0] < simT - 3) posHist.shift();
    if (unstick <= 0 && posHist.length > 50 && Math.hypot(posHist[0][1] - p.x, posHist[0][2] - p.z) < 1.5 && hd > 3) { unstick = 1.2; posHist.length = 0; }
    let wantY, tgtSpeed, boost = false;
    if (LINE === 'high') { wantY = hd > 25 ? Math.max(o.y + 6, 40) : o.y + 1.2; tgtSpeed = hd < 8 ? 4 : 99; boost = hd > 60 && Math.abs(err) < 0.3 && d.player.boost > 0.3; }
    else {
      const raised = o.y > 2;
      const offRoad = leaving && Math.min(Math.abs(p.x - nr(p.x)), Math.abs(p.z - nr(p.z))) > 6.5;
      wantY = offRoad && hd >= 30 ? 26 : hd < 30 ? (raised ? o.y + 1.5 : o.y + 1.2) : (raised && hd < 45 ? o.y + 2 : LOWY);
      const corner = !w.final && wd < 14; const remaining = wps.length > 1 ? 0 : wd;
      tgtSpeed = hd < 8 ? 4 : corner ? CORNER : w.final && hd < 25 ? 8 : 16;
      boost = !corner && !w.final && wd > BOOSTD && Math.abs(err) < 0.12 && d.player.boost > 0.3;
      if (raised && hd < 30 && p.y < o.y - 0.5) tgtSpeed = 1;
      if (Math.abs(err) > 0.5) tgtSpeed = Math.min(tgtSpeed, 8); // rise up the facade before moving over the roof
    }
    if (unstick > 0) { unstick -= 0.05; for (const kk of ['KeyW', 'KeyA', 'KeyD', 'ShiftLeft', 'KeyE']) await key(kk, false); await key('KeyS', true); await key('Space', true); }
    else {
      await key('KeyD', Math.abs(err) > 0.1 && err < 0); await key('KeyA', Math.abs(err) > 0.1 && err > 0);
      await key('KeyW', Math.abs(err) < 0.8 && d.player.speed < tgtSpeed);
      await key('KeyS', d.player.speed > tgtSpeed + 3 || (Math.abs(err) > 1.2 && d.player.speed > 4));
      await key('KeyE', boost);
      await key('Space', p.y < wantY - 1.2); await key('ShiftLeft', p.y > wantY + 1.2);
    }
    if (process.env.LEGSHOT && !endShot && d.timeLeft < 0.5) { endShot = true; await step(0.0001, true); await page.screenshot({ path: OUT + `E-${P}-seed${seed}-clock0.jpg`, type: "jpeg", quality: 80 }); }
    if (!zero && d.timeLeft < 0.06) zero = { t: +simT.toFixed(1), leg: legKey.slice(0, 2), hd: Math.round(hd), yLeft: +(o.y - p.y).toFixed(1), bank: d.slipstream ? d.slipstream.bank : null, deliveries: d.deliveries };
    { const e = d.ending || {}; const shot = async (tag) => { await step(0.0001, true); await page.screenshot({ path: OUT + `E-${P}-seed${seed}-${tag}.jpg`, type: 'jpeg', quality: 80 }); console.log('SHOT ' + JSON.stringify({ seed, tag, t: +simT.toFixed(1), timeLeft: +d.timeLeft.toFixed(1), ending: e, hd: Math.round(hd) })); };
      if (e.lastCall && !S.lc) { S.lc = simT; } if (S.lc && !S.lcShot && simT > S.lc + 0.4) { S.lcShot = 1; await shot('lastcall'); }
      if (e.overtime && !S.ot) { S.ot = simT; } if (S.ot && !S.ot1 && simT > S.ot + 0.5) { S.ot1 = 1; await shot('ot-start'); } if (S.ot && !S.ot2 && simT > S.ot + 4) { S.ot2 = 1; await shot('ot-mid'); }
      if (e.finished && !S.fin) { S.fin = simT; } if (S.fin && !S.fin1 && simT > S.fin + 0.3) { S.fin1 = 1; await shot('ot-madeit'); } }
    prev = d; d = await step(0.05); simT += 0.05; sp.push(d.player.speed); if (sp.length > 8) sp.shift(); altSum += d.player.position.y; n++; spSum += d.player.speed;
    if (d.crashes > prev.crashes) {
      const e = { t: +simT.toFixed(1), sp03: +sp[0].toFixed(1), y: +d.player.position.y.toFixed(1), hd: +hd.toFixed(0), loss: d.lastCrash ? +d.lastCrash.loss.toFixed(1) : null, wallTop: d.lastCrash ? +d.lastCrash.wallTop.toFixed(1) : null, unstick: unstick > 0, timeLost: +(prev.timeLeft - d.timeLeft).toFixed(1), comboLost: prev.combo };
      crashes.push(e);
      if (shots < 3) { shots++; await step(0.0001, true); await page.screenshot({ path: OUT + `P-${LINE}-seed${seed}-crash${shots}.jpg`, type: 'jpeg', quality: 80 }); }
    }
  }
  if (LINE === 'low') { await step(0.0001, true); }
  for (const kk of [...held]) await key(kk, false);
  const r = { seed, line: LINE, simT: +simT.toFixed(0), deliveries: d.deliveries, score: d.score, crashes: crashes.length, perMin: +(crashes.length / simT * 60).toFixed(1), meanAlt: +(altSum / n).toFixed(1), meanSpeed: +(spSum / n).toFixed(1), crashList: crashes, legs: LEGS, open: { n: legKey.slice(0, 2), g: L0.g, y: L0.y, t: +(simT - L0.t).toFixed(1), hdLeft: Math.round(Math.hypot(d.objective.position.x - d.player.position.x, d.objective.position.z - d.player.position.z)), yLeft: +(d.objective.position.y - d.player.position.y).toFixed(1) } };
  for (let i = 0; i < 40; i++) await step(0.05, i % 10 === 0); await step(0.0001, true); await page.waitForTimeout(400); await page.screenshot({ path: OUT + `E-${P}-seed${seed}-over.jpg`, type: 'jpeg', quality: 80 });
  const fin = await page.evaluate(() => JSON.parse(JSON.stringify(window.__THREE_GAME_DIAGNOSTICS__)));
  console.log('END ' + JSON.stringify({ seed, score: fin.score, deliveries: fin.deliveries, zero, ending: fin.ending, log: (fin.scoreLog || []).filter((e) => ['overtime','otshare','otcut','otdrop','partial','end'].includes(e.k)) }));
  results.push(r); console.log(JSON.stringify(r));
  await page.close();
}
const sum = (f) => results.reduce((a, r) => a + r[f], 0);
console.log(`LINE ${LINE}${LINE === 'low' ? ' ' + LOWY + ' m corner ' + CORNER + ' boost>' + BOOSTD : ''}: seeds ${seeds.length}, sim ${sum('simT')} s, deliveries ${sum('deliveries')} (${(sum('deliveries') / sum('simT') * 60).toFixed(2)}/min), crashes ${sum('crashes')} (${(sum('crashes') / sum('simT') * 60).toFixed(1)}/min), score ${sum('score')}`);
await browser.close();
