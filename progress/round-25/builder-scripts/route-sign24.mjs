// Round 24 critic: + LAG lines (MODE=grid: when the mark at entrance stage moves or drops, seconds and metres since the drone
// was closest to its entrance; and STALE: legs ending with a mark never taken). Otherwise unchanged.
// Round 20 critic (new): route-feat19 plus MODE=sign, a bot that steers only by what the screen marks. Control otherwise identical.
// MODE=grid: round 17 grid street bot. MODE=feat: shortest route on the full street graph (round 18/19 shortcut bot).
// MODE=sign: no street graph. It flies the plain street grid (streets a player sees) to the street in front of the marked
// entrance arch (diagnostics routeMark.gate, the arch the HUD tag points at), straight through to the exit arch, out to the
// street, then the plain grid to the pad marker. If the game moves or drops the mark, it re-plans from the new mark or the grid.
// Every mode logs per leg: the mark at leg start (kind, name, board text), DOM hint text, first time the arch is inside the
// view (gateIn) and at what distance, distance to the arch at leg start, first time within 80 m and whether it was in view then.
// Round 19 critic: route-feat18 with logging only added (route hint per leg, DOM hint text at 1 s, feature names, centre log). Control unchanged.
// Round 18 critic (new): route-legs17 with a shortcut-taking option. Deterministic (external clock, 50 ms steps).
// FEAT=0: the round 17 grid street bot, control identical. FEAT=1: same control, but each leg follows the shortest route on
// the real street graph (roads, alleys, tunnels, boulevards; the game's streetRoute hook) when it is at least 3% shorter
// than the grid route. In a tunnel (or 25 m before one) it flies at 3.5 m and slows to 4 m/s while still above 6.5 m;
// in an alley at 5 m. Every leg logs: from/to names, grid and feature route length (hook), whether a 15% shortcut exists,
// kinds on the feature route, leg time, distance flown, and charged crashes on that leg.
import { chromium } from '@playwright/test';
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const MODE = process.env.MODE || (process.env.FEAT === '1' ? 'feat' : 'grid'); const FEAT = MODE === 'feat'; const SIGN = MODE === 'sign'; const TAG = MODE;
const LINE = 'low'; const CORNER = Number(process.env.CORNER || 7); const BOOSTD = Number(process.env.BOOSTD || 55); const LOWY = Number(process.env.LOWY || 7); const SIMT = Number(process.env.SIMT || 600);
const seeds = (process.env.SEEDS || '11,22,58,130').split(',');
const ROADS = [-154, -110, -66, -22, 22, 66, 110, 154];
const nr = (v) => ROADS.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
const browser = await chromium.launch({ channel: 'chromium' });
const results = [];
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
function featRoute(p, o, fr) {
  const pts = fr.points.map((q) => ({ x: q.x, z: q.z, kind: q.kind, name: q.name }));
  pts.push({ x: o.x, z: o.z, final: true, kind: 'road' });
  const out = []; for (const q of pts) { const l = out[out.length - 1] || p; if (Math.hypot(q.x - l.x, q.z - l.z) > 3 || q.final) out.push(q); else if (q.kind !== 'road' && out.length) out[out.length - 1].kind = q.kind; }
  // v2: merge straight-through stops (a boulevard is split at every road crossing; those are not corners)
  if (process.env.NOMERGE) return out;
  for (let i = out.length - 2; i >= 1; i--) {
    const a = out[i - 1], b = out[i], c = out[i + 1];
    const h1 = Math.atan2(b.x - a.x, b.z - a.z), h2 = Math.atan2(c.x - b.x, c.z - b.z);
    let dh = Math.abs(h2 - h1); if (dh > Math.PI) dh = 2 * Math.PI - dh;
    if (dh < 0.05 && !b.final && (b.kind === c.kind || c.kind === 'road' && b.kind === 'road')) { out.splice(i, 1); }
  }
  return out;
}
// grid path from p to A, a mid-block point on a road line (ax: A sits on a road z = const when the alley runs along z)
function toLine(p, A, ax) {
  // work in a frame where A's road is horizontal (z = const): swap when A sits on an x = const road
  const sw = ax; const P = sw ? { x: p.z, z: p.x } : p; const T = sw ? { x: A.z, z: A.x } : A;
  const onX = Math.abs(P.x - nr(P.x)) < Math.abs(P.z - nr(P.z)); let pts;
  if (onX) pts = [{ x: nr(P.x), z: T.z }];
  else if (nr(P.z) === T.z) pts = [];
  else { const Xn = ROADS.reduce((a, b) => (Math.abs(P.x - b) + Math.abs(b - T.x) < Math.abs(P.x - a) + Math.abs(a - T.x) ? b : a)); pts = [{ x: Xn, z: nr(P.z) }, { x: Xn, z: T.z }]; }
  return pts.map((q) => (sw ? { x: q.z, z: q.x } : q));
}
function signRoute(p, o, m) {
  const ax = Math.abs(m.inward.x) > 0.5; // alley runs along x
  const street = (q, dir) => ax ? { x: nr(q.x - dir.x * 12), z: q.z } : { x: q.x, z: nr(q.z - dir.z * 12) };
  const A = { ...street(m.gate, m.inward), kind: m.kind, entry: true }; const ex = { x: m.exit.x, z: m.exit.z, kind: m.kind };
  const B = street(m.exit, { x: -m.outward.x, z: -m.outward.z }); B.kind = 'road';
  let pts = [];
  if (m.stage === 'entrance') { pts = toLine(p, A, ax); pts.push(A);
    const cross = ax ? Math.abs(ex.z - A.z) : Math.abs(ex.x - A.x);
    if (cross > 3) pts.push(ax ? { x: ex.x - m.outward.x * 0, z: A.z, kind: m.kind } : { x: A.x, z: ex.z, kind: m.kind }); }
  pts.push(ex, B); const rest = route(B, o); pts.push(...rest);
  const out = []; for (const q of pts) { const l = out[out.length - 1] || p; if (Math.hypot(q.x - l.x, q.z - l.z) > 3 || q.final) out.push(q); }
  return out;
}
for (const seed of seeds) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto('http://127.0.0.1:5190/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  await page.evaluate(() => { window.__GAME__.externalClock(true); window.__GAME__.start(); window.__GAME__.manualRender(true); });
  const held = new Set();
  const key = async (k, on) => { if (on && !held.has(k)) { held.add(k); await page.evaluate((k) => window.__GAME__.key(k, true), k); } if (!on && held.has(k)) { held.delete(k); await page.evaluate((k) => window.__GAME__.key(k, false), k); } };
  const step = (s, r = false) => page.evaluate(([s, r]) => JSON.parse(JSON.stringify(window.__GAME__.advance(s, r))), [s, r]);
  let d = await step(0.05); let leaving = true; const posHist = []; let simT = 0, prev = d, legKey = '', wps = [], unstick = 0, shots = 0, tshots = 0; const sp = []; const crashes = []; let altSum = 0, n = 0, spSum = 0;
  const LEGS = []; let L0 = null; let prevName = 'start'; let signKey = '';
  while (simT < SIMT && d.state === 'playing') {
    const p = d.player.position, c = d.camera, o = d.objective.position;
    const k = d.objective.phase + d.objective.name;
    if (k !== legKey) {
      if (L0) { LEGS.push({ ...L0, t: +(simT - L0.t0).toFixed(2), flown: Math.round(L0.flown), crashes: d.crashes - L0.c0, done: true }); prevName = legKey; }
      const rr = await page.evaluate(([p, o]) => { const g = window.__GAME__; const gr = g.streetRoute(p, o, false); const fr = g.streetRoute(p, o, true); return { g: gr.length, f: fr.length, kinds: fr.kinds, names: fr.names, pts: fr.points }; }, [{ x: p.x, z: p.z }, { x: o.x, z: o.z }]);
      const cut = rr.f <= rr.g * 0.85;
      L0 = { from: prevName.slice(0, 40), to: k.slice(0, 40), g: Math.round(rr.g), f: Math.round(rr.f), cut, kinds: rr.kinds, names: rr.names, y: Math.round(o.y), t0: simT, flown: 0, c0: d.crashes };
      legKey = k; leaving = true; posHist.length = 0;
      wps = FEAT && rr.f < rr.g * 0.97 ? featRoute(p, o, { points: rr.pts }) : route(p, o);
      L0.took = FEAT && rr.f < rr.g * 0.97;
      const m = d.routeMark; L0.mark = m ? { kind: m.kind, name: m.name, board: m.board, d0: Math.round(Math.hypot(m.gate.x - p.x, m.gate.z - p.z)), stage: m.stage } : null;
      L0.in80 = null; L0.in80seen = null; L0.seenT = null; L0.seenD = null; L0.marks = 0; L0.tagT = null;
      signKey = m ? m.name + ':' + m.stage : '';
      if (SIGN && m) { wps = signRoute(p, o, m); L0.took = true; }
      if (process.env.DBG) console.log('PLAN', JSON.stringify({ p: [p.x|0, p.z|0], o: [o.x|0, o.z|0], m: m && { g: [m.gate.x|0, m.gate.z|0], in: m.inward, ex: [m.exit.x|0, m.exit.z|0] }, wps: wps.map((q) => [q.x|0, q.z|0, q.kind || '']) }));
    }
    if (L0 && (L0.hint === undefined && simT - L0.t0 >= 1.0 )) {
      L0.hint = await page.evaluate(() => { const d = window.__THREE_GAME_DIAGNOSTICS__; const h = d.routeHint; const el = document.getElementById('route-hint'); const vis = el && el.classList.contains('show') && getComputedStyle(el).display !== 'none'; return { h: h ? { kind: h.kind, names: h.names, save: h.save, grid: h.grid, route: h.route, delay: h.shownAt >= 0 ? +(h.shownAt - h.at).toFixed(2) : null } : null, board: d.routeMark ? d.routeMark.board : null, bkind: d.routeMark ? d.routeMark.kind : null, label: vis ? document.getElementById('route-hint-label').textContent : null, dom: vis ? el.textContent.replace(/\s+/g, ' ').trim() : null }; });
    }
    const rm = d.routeMark;
    if (L0 && rm && rm.stage === 'entrance') {
      const gd = Math.hypot(rm.gate.x - p.x, rm.gate.z - p.z); const lt = simT - L0.t0;
      if (rm.gateIn && L0.seenT === null) { L0.seenT = +lt.toFixed(2); L0.seenD = Math.round(gd); }
      if (rm.tagAt >= 0 && L0.tagT === null) L0.tagT = +lt.toFixed(2);
      if (rm.tagOn && L0.tagOnT == null) L0.tagOnT = +lt.toFixed(2);
      if (gd <= 80 && L0.in80 === null) { L0.in80 = +lt.toFixed(2); L0.in80seen = rm.gateIn; }
      if (L0.in80 !== null && L0.in80late === undefined && lt - L0.in80 >= 0.5) L0.in80late = L0.seenT !== null;
    }
    const nk = rm ? rm.name + ':' + rm.stage : '';
    if (rm && rm.stage === 'entrance') { const gd2 = Math.hypot(rm.gate.x - p.x, rm.gate.z - p.z); if (gd2 < (globalThis.__mkMin ?? 1e9)) { globalThis.__mkMin = gd2; globalThis.__mkMinT = simT; } globalThis.__mkGd = gd2; }
    if (nk !== signKey && signKey.endsWith(':entrance')) { console.log('LAG', JSON.stringify({ from: signKey, to: nk, lag: +(simT - globalThis.__mkMinT).toFixed(2), extra: +((globalThis.__mkGd ?? 0) - globalThis.__mkMin).toFixed(1), minGd: +globalThis.__mkMin.toFixed(1), t: +simT.toFixed(1) })); }
    if (nk !== signKey && L0) console.log('TR', JSON.stringify({ seed, from: signKey, to: nk, t: +simT.toFixed(1), lt: +(simT - L0.t0).toFixed(1) }));
    if (nk !== signKey) { globalThis.__mkMin = 1e9; globalThis.__mkMinT = simT; }
    if (process.env.DBG && nk !== signKey) console.log('MK', simT.toFixed(2), signKey, '->', nk, p.x.toFixed(1), p.z.toFixed(1), p.y.toFixed(1), rm && rm.width);
    if (L0 && nk !== signKey) { if (rm && !L0.allMarks) L0.allMarks = []; if (rm && L0.allMarks && !L0.allMarks.includes(rm.name)) L0.allMarks.push(rm.name);
      if (SIGN) { const nameChanged = (rm ? rm.name : '') !== signKey.split(':')[0];
        if (rm && nameChanged && rm.stage === 'entrance') { wps = signRoute(p, o, rm); L0.replans = (L0.replans || 0) + 1; }
        else if (!rm && signKey.endsWith(':entrance')) { wps = route(p, o); L0.dropped = (L0.dropped || 0) + 1; if (process.env.DBG) console.log('DROP', simT.toFixed(1), p.x|0, p.z|0, p.y.toFixed(1)); } }
      signKey = nk; }
    const hd = Math.hypot(o.x - p.x, o.z - p.z);
    let w = wps[0]; let wd = Math.hypot(w.x - p.x, w.z - p.z);
    if (!w.final && (wd < 4 || hd < 14)) { leaving = false; wps.shift(); w = wps[0]; wd = Math.hypot(w.x - p.x, w.z - p.z); }
    const vx = (p.x - prev.player.position.x) / 0.05, vz = (p.z - prev.player.position.z) / 0.05; const head = Math.hypot(vx, vz) > 4 ? Math.atan2(vx, vz) : Math.atan2(p.x - c.x, p.z - c.z);
    let err = Math.atan2(w.x - p.x, w.z - p.z) - head; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
    posHist.push([simT, p.x, p.z]); while (posHist.length && posHist[0][0] < simT - 3) posHist.shift();
    if (unstick <= 0 && posHist.length > 50 && Math.hypot(posHist[0][1] - p.x, posHist[0][2] - p.z) < 1.5 && hd > 3) { unstick = 1.2; posHist.length = 0; }
    let wantY, tgtSpeed, boost = false;
    const raised = o.y > 2;
    const offRoad = leaving && Math.min(Math.abs(p.x - nr(p.x)), Math.abs(p.z - nr(p.z))) > 6.5;
    wantY = offRoad && hd >= 30 ? 26 : hd < 30 ? (raised ? o.y + 1.5 : o.y + 1.2) : (raised && hd < 45 ? o.y + 2 : LOWY);
    const corner = !w.final && wd < 14;
    tgtSpeed = hd < 8 ? 4 : corner ? CORNER : w.final && hd < 25 ? 8 : 16;
    boost = !corner && !w.final && wd > BOOSTD && Math.abs(err) < 0.12 && d.player.boost > 0.3;
    if (SIGN && w.entry && wd < 20) tgtSpeed = Math.min(tgtSpeed, 6); // sign bot: slow for the turn into a marked mouth
    if (raised && hd < 30 && p.y < o.y - 0.5) tgtSpeed = 1;
    if (Math.abs(err) > 0.5) tgtSpeed = Math.min(tgtSpeed, 8);
    // feature altitude (FEAT only): tunnels low, alleys a little low
    const nx = wps[1];
    const inTunnel = w.kind === 'tunnel' || (nx && nx.kind === 'tunnel' && wd < 25);
    if ((FEAT || SIGN) && inTunnel && hd >= 12) { wantY = 3.5; if (p.y > 6.5) tgtSpeed = Math.min(tgtSpeed, 4); }
    else if ((FEAT || SIGN) && w.kind === 'alley' && hd >= 30) wantY = Math.min(wantY, 5);
    if (unstick > 0) { unstick -= 0.05; for (const kk of ['KeyW', 'KeyA', 'KeyD', 'ShiftLeft', 'KeyE']) await key(kk, false); await key('KeyS', true); await key('Space', true); }
    else {
      await key('KeyD', Math.abs(err) > 0.1 && err < 0); await key('KeyA', Math.abs(err) > 0.1 && err > 0);
      await key('KeyW', Math.abs(err) < 0.8 && d.player.speed < tgtSpeed);
      await key('KeyS', d.player.speed > tgtSpeed + 3 || (Math.abs(err) > 1.2 && d.player.speed > 4));
      await key('KeyE', boost);
      await key('Space', p.y < wantY - 1.2); await key('ShiftLeft', p.y > wantY + 1.2);
    }
    if (process.env.SHOTS && w.kind && w.kind !== 'road' && tshots < 4 && wd < 20 && Math.random() < 0.08) { tshots++; await step(0.0001, true); await page.screenshot({ path: OUT + `T-${TAG}-seed${seed}-${w.kind}${tshots}.jpg`, type: 'jpeg', quality: 80 }); }
    prev = d; d = await step(0.05); simT += 0.05; sp.push(d.player.speed); if (sp.length > 8) sp.shift(); altSum += d.player.position.y; n++; spSum += d.player.speed;
    if (L0) L0.flown += Math.hypot(d.player.position.x - p.x, d.player.position.z - p.z);
    if (d.crashes > prev.crashes) {
      const e = { t: +simT.toFixed(1), sp03: +sp[0].toFixed(1), y: +d.player.position.y.toFixed(1), x: Math.round(d.player.position.x), z: Math.round(d.player.position.z), hd: +hd.toFixed(0), wk: w.kind || 'road', loss: d.lastCrash ? +d.lastCrash.loss.toFixed(1) : null, wallTop: d.lastCrash ? +d.lastCrash.wallTop.toFixed(1) : null, unstick: unstick > 0, timeLost: +(prev.timeLeft - d.timeLeft).toFixed(1) };
      crashes.push(e);
      if (shots < 3) { shots++; await step(0.0001, true); await page.screenshot({ path: OUT + `P-${TAG}-seed${seed}-crash${shots}.jpg`, type: 'jpeg', quality: 80 }); }
    }
  }
  if (L0) LEGS.push({ ...L0, t: +(simT - L0.t0).toFixed(2), flown: Math.round(L0.flown), crashes: d.crashes - L0.c0, done: false });
  for (const kk of [...held]) await key(kk, false);
  const fin = await page.evaluate(() => JSON.parse(JSON.stringify(window.__THREE_GAME_DIAGNOSTICS__)));
  const ls = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => /best|tier|medal/i.test(k)).map((k) => [k, localStorage.getItem(k)]))); const extra = await page.evaluate(() => ({ names: window.__GAME__.features().map((f) => f.kind + ':' + f.name), centreLog: window.__THREE_GAME_DIAGNOSTICS__.centreLog })); const r = { seed, tag: TAG, featNames: extra.names, centreLog: extra.centreLog, goals: fin.goals ? { tier: fin.goals.tier, tierName: fin.goals.tierName, best: fin.goals.best, bestTier: fin.goals.bestTier } : null, partial: fin.breakdown?.partial, ending: fin.ending, ls, slipPts: fin.slipstream?.points, bd: fin.breakdown, simT: +simT.toFixed(0), deliveries: fin.deliveries, score: fin.score, tier: fin.goals?.tierName, crashes: crashes.length, perMin: +(crashes.length / simT * 60).toFixed(2), meanAlt: +(altSum / n).toFixed(1), meanSpeed: +(spSum / n).toFixed(1), features: fin.city?.features, crashList: crashes, legs: LEGS.map(({ t0, c0, ...l }) => l) };
  if (process.env.SAVECHK) { // log-only: does the medal survive a reload (title best and tier) and match the card
    const card = await page.evaluate(() => ({ medal: document.getElementById('over-medal-name')?.textContent, score: document.getElementById('over-score')?.textContent, best: document.getElementById('over-best')?.textContent, bestTier: document.getElementById('over-best-tier')?.textContent }));
    await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(800);
    const title = await page.evaluate(() => ({ best: document.getElementById('title-best')?.textContent, tier: document.getElementById('title-best-tier')?.textContent, ls: Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k).slice(0, 120)])) }));
    console.log('SAVE ' + JSON.stringify({ seed, score: r.score, tier: r.tier, card, title }));
  }
  results.push(r); console.log(JSON.stringify(r));
  await page.close();
}
const sum = (f) => results.reduce((a, r) => a + r[f], 0);
console.log(`${TAG}: seeds ${seeds.length}, sim ${sum('simT')} s, deliveries ${sum('deliveries')}, crashes ${sum('crashes')} (${(sum('crashes') / sum('simT') * 60).toFixed(2)}/min), score ${sum('score')}`);
await browser.close();
