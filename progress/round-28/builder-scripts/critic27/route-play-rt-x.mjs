// Round 6 critic: route-play-rt-x = route-play-rt.mjs with log-only additions (slipstream payouts, payout times, mean headwind). Control logic identical.
// Round 5 critic: route-play-rt, the real-time version of route-play.mjs. Real keyboard input (page.keyboard), the game runs at its own frame rate, control loop polls every ~50 ms.
// Round 5 critic: a routed, player-like pilot.
// LINE=low  : follows the street grid (roads every 44 m), corner to corner, at LOWY (default 7 m), brakes into corners,
//             boosts only on long straight street runs, climbs at the building for rooftop pads.
// LINE=high : the arrival bot's line: straight at the target at 40 m, boost when far, drop at the pad.
// Plays each seed until the clock runs out (or SIMT). Logs deliveries, crashes (with speed 0.3 s before), score.
import { chromium } from '@playwright/test';
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
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto('http://127.0.0.1:5190/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  const held = new Set();
  const key = async (k, on) => { if (on && !held.has(k)) { held.add(k); await page.keyboard.down(k); } if (!on && held.has(k)) { held.delete(k); await page.keyboard.up(k); } };
  const t00 = Date.now(); let tLast = Date.now(); const step = async () => { await page.waitForTimeout(40); return page.evaluate(() => JSON.parse(JSON.stringify(window.__THREE_GAME_DIAGNOSTICS__))); };
  let d = await step(); let leaving = true; const posHist = []; let simT = 0, prev = d, legKey = '', wps = [], hist = [], unstick = 0, shots = 0; const sp = []; const crashes = []; let altSum = 0, n = 0, spSum = 0; let hwSum = 0; const payT = []; let lastPay = 0;
  let dtw0 = 0.05;
  while (simT < SIMT && d.state === 'playing') {
    const p = d.player.position, c = d.camera, o = d.objective.position;
    const k = d.objective.phase + d.objective.name;
    if (k !== legKey) { legKey = k; leaving = true; posHist.length = 0; wps = LINE === 'low' ? route(p, o) : [{ x: o.x, z: o.z, final: true }]; }
    const hd = Math.hypot(o.x - p.x, o.z - p.z);
    let w = wps[0]; let wd = Math.hypot(w.x - p.x, w.z - p.z);
    if (!w.final && (wd < 4 || hd < 14)) { leaving = false; wps.shift(); w = wps[0]; wd = Math.hypot(w.x - p.x, w.z - p.z); }
    const vx = (p.x - prev.player.position.x) / Math.max(0.03, dtw0), vz = (p.z - prev.player.position.z) / Math.max(0.03, dtw0); const head = LINE === 'low' && Math.hypot(vx, vz) > 4 ? Math.atan2(vx, vz) : Math.atan2(p.x - c.x, p.z - c.z);
    let err = Math.atan2(w.x - p.x, w.z - p.z) - head; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
    posHist.push([simT, p.x, p.z]); while (posHist.length && posHist[0][0] < simT - 3) posHist.shift();
    if (unstick <= 0 && posHist.length > 25 && simT - posHist[0][0] > 2.7 && Math.hypot(posHist[0][1] - p.x, posHist[0][2] - p.z) < 1.5 && hd > 3) { unstick = 1.2; posHist.length = 0; }
    let wantY, tgtSpeed, boost = false;
    if (LINE === 'high') { wantY = hd > 25 ? Math.max(o.y + 6, Number(process.env.HIGHY || 40)) : o.y + 1.2; tgtSpeed = hd < 8 ? 4 : 99; boost = hd > 60 && Math.abs(err) < 0.3 && d.player.boost > 0.3; }
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
    if (unstick > 0) { unstick -= dtw0; for (const kk of ['KeyW', 'KeyA', 'KeyD', 'ShiftLeft', 'KeyE']) await key(kk, false); await key('KeyS', true); await key('Space', true); }
    else {
      await key('KeyD', Math.abs(err) > 0.1 && err < 0); await key('KeyA', Math.abs(err) > 0.1 && err > 0);
      await key('KeyW', Math.abs(err) < 0.8 && d.player.speed < tgtSpeed);
      await key('KeyS', d.player.speed > tgtSpeed + 3 || (Math.abs(err) > 1.2 && d.player.speed > 4));
      await key('KeyE', boost);
      await key('Space', p.y < wantY - 1.2); await key('ShiftLeft', p.y > wantY + 1.2);
    }
    prev = d; d = await step(); const now = Date.now(); const dtw = (now - tLast) / 1000; tLast = now; simT = (now - t00) / 1000; sp.push(d.player.speed); if (sp.length > 8) sp.shift(); dtw0 = dtw; altSum += d.player.position.y; n++; spSum += d.player.speed; hwSum += d.player.headwind || 0; if (d.slipstream && d.slipstream.payouts > lastPay) { lastPay = d.slipstream.payouts; payT.push(+simT.toFixed(0)); }
    if (d.crashes > prev.crashes) {
      const e = { t: +simT.toFixed(1), sp03: +sp[0].toFixed(1), y: +d.player.position.y.toFixed(1), hd: +hd.toFixed(0), loss: d.lastCrash ? +d.lastCrash.loss.toFixed(1) : null, wallTop: d.lastCrash ? +d.lastCrash.wallTop.toFixed(1) : null, unstick: unstick > 0, timeLost: +(prev.timeLeft - d.timeLeft).toFixed(1), comboLost: prev.combo };
      crashes.push(e);
      if (shots < 3) { shots++; await page.screenshot({ path: OUT + `Q-${LINE}-seed${seed}-crash${shots}.jpg`, type: 'jpeg', quality: 80 }); }
    }
  }
  
  for (const kk of [...held]) await key(kk, false);
  const r = { seed, line: LINE, simT: +simT.toFixed(0), deliveries: d.deliveries, score: d.score, crashes: crashes.length, perMin: +(crashes.length / simT * 60).toFixed(1), meanAlt: +(altSum / n).toFixed(1), meanSpeed: +(spSum / n).toFixed(1), crashList: crashes, slip: d.slipstream ? { payouts: d.slipstream.payouts, points: d.slipstream.points, seconds: d.slipstream.seconds } : null, payT, meanHeadwind: +(hwSum / n).toFixed(2) };
  results.push(r); console.log(JSON.stringify(r));
  await page.close();
}
const sum = (f) => results.reduce((a, r) => a + r[f], 0);
console.log(`LINE ${LINE}${LINE === 'low' ? ' ' + LOWY + ' m corner ' + CORNER + ' boost>' + BOOSTD : ''}: seeds ${seeds.length}, sim ${sum('simT')} s, deliveries ${sum('deliveries')} (${(sum('deliveries') / sum('simT') * 60).toFixed(2)}/min), crashes ${sum('crashes')} (${(sum('crashes') / sum('simT') * 60).toFixed(1)}/min), score ${sum('score')} (${(sum('score') / sum('simT') * 60).toFixed(0)}/min), slip payouts ${results.reduce((a, r) => a + (r.slip ? r.slip.payouts : 0), 0)} (${(results.reduce((a, r) => a + (r.slip ? r.slip.payouts : 0), 0) / sum('simT') * 60).toFixed(2)}/min), slip pts ${results.reduce((a, r) => a + (r.slip ? r.slip.points : 0), 0)}`);
await browser.close();
