// Round 48 re-check (fresh critic): copy of critic/pilot48-critic.mjs with port 5395, recheck/ output, an 'eagerhold'
// style (holds W through the ring and into the next corner while steering) and phone chip fade sampling.
// Round 48 critic: a real-time pilot that flies with real keyboard (desktop) or real touch (phone) input.
// Reads diagnostics ~15 Hz (a human-ish reaction rate), plans the leg on the street graph once per leg (what the route
// arches / minimap / arrow show a human), and presses keys. Not the builder's bot: no externalClock, no __GAME__.key.
// usage: node pilot.mjs <tag> <query> <profile> [phone] [video] [fresh]
import { chromium, devices } from '/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const [tag, query, profile = 'careful', ...flags] = process.argv.slice(2);
const PHONE = flags.includes('phone'), VIDEO = flags.includes('video'), FRESH = flags.includes('fresh');
const OUT = '/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/progress/round-48/recheck/';
const P = {
  // careful: follows the suggested route, brakes into corners, boosts on long straights when the meter is full,
  // lines up with rings that sit on its line (height only), 15 m/s cruise
  careful: { cruise: 15, corner: 7, y: 7, boostD: 45, boostMin: 0.95, steer: 0.12, brake: true, ringAim: 3, nudgeBoost: true },
  // casual: a first-timer. Holds W, lets go of W for corners but never brakes, flies at 6-8 m, presses E only when the
  // boost bar pulses at it, ignores rings (takes the ones it happens to fly through)
  casual: { cruise: 17, corner: 9, y: 7, boostD: Infinity, steer: 0.14, brake: false, ringAim: 0, nudgeBoost: true, wobble: 1.2 },
  // eager: boosts every straight, aims at rings, brakes late (tests the burst into turns)
  slow: { cruise: 11, corner: 6, y: 10, boostD: Infinity, steer: 0.14, brake: true, ringAim: 0, nudgeBoost: false },
  // eagerhold (re-check): like casual, never brakes, aims at rings, holds W on the ring approach and for 3 s after a ring
  // even into a corner, steering normally
  eagerhold: { cruise: 17, corner: 9, y: 7, boostD: Infinity, steer: 0.14, brake: false, ringAim: 5, nudgeBoost: true, wobble: 1.2, holdAfterRing: 3 },
  eager: { cruise: 17, corner: 9, y: 6.5, boostD: 30, boostMin: 0.3, steer: 0.1, brake: true, ringAim: 5, nudgeBoost: true },
};
const cfg = P[profile];
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const browser = await chromium.launch({ channel: 'chromium' });
const ctxOpt = PHONE ? { ...devices['iPhone 13 landscape'], viewport: { width: 812, height: 375 }, screen: { width: 812, height: 375 } } : { viewport: { width: 1280, height: 720 } };
if (VIDEO) ctxOpt.recordVideo = { dir: OUT + 'video-tmp/', size: PHONE ? { width: 812, height: 375 } : { width: 1280, height: 720 } };
const ctx = await browser.newContext(ctxOpt);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
if (!FRESH) await page.addInitScript(() => { try { localStorage.setItem('drone-dash-played-v1', '1'); } catch {} });
await page.goto('http://127.0.0.1:5395/' + (query || ''), { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForFunction(() => window.__GAME__ && window.__THREE_GAME_DIAGNOSTICS__, null, { timeout: 120000 });
await page.waitForTimeout(1500);

// ---- input layer
let cdp = null, touches = new Map(), touchActive = false;
if (PHONE) cdp = await ctx.newCDPSession(page);
let rects = null; const measure = async () => PHONE ? await page.evaluate(() => Object.fromEntries(['touch-stick', 'up-button', 'down-button', 'boost-button'].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [id, { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }]; }))) : null;
let prevT = new Map(); const cdpId = new Map(); let nextId = 10;
const touchSync = async () => {
  const pt = (slot, p) => ({ x: p.x, y: p.y, id: cdpId.get(slot), radiusX: 4, radiusY: 4, force: 1 });
  const removed = [...prevT.keys()].filter((id) => !touches.has(id));
  const added = [...touches.keys()].filter((id) => !prevT.has(id));
  if (removed.length) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: removed.map((id) => pt(id, prevT.get(id))) });
  for (const id of added) cdpId.set(id, nextId++);
  if (added.length) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: added.map((id) => pt(id, touches.get(id))) });
  const moved = [...touches.keys()].filter((id) => prevT.has(id) && (prevT.get(id).x !== touches.get(id).x || prevT.get(id).y !== touches.get(id).y));
  if (moved.length) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [...touches.entries()].map(([id, p]) => pt(id, p)) });
  prevT = new Map([...touches.entries()].map(([k, v]) => [k, { ...v }]));
};
const held = new Set();
const key = async (k, on) => {
  if (on === held.has(k)) return;
  if (on) held.add(k); else held.delete(k);
  if (!PHONE) { await (on ? page.keyboard.down(k) : page.keyboard.up(k)); return; }
};
// phone: map intent to the stick (x turn, y thrust) and the up/down/boost buttons
const phoneApply = async (turn, thrust, up, down, boost) => {
  const s = rects['touch-stick'];
  const r = s.w * 0.4;
  touches.set(1, { x: s.x + turn * r * 0.95, y: s.y - thrust * r * 0.95 });
  const b = (id, n, on) => { if (on) touches.set(n, { x: rects[id].x, y: rects[id].y }); else touches.delete(n); };
  b('up-button', 2, up); b('down-button', 3, down); b('boost-button', 4, boost);
  await touchSync();
};

// ---- start the run with a real click / tap on Play
if (PHONE) { const pb = await page.locator('#play-button').boundingBox(); await page.touchscreen.tap(pb.x + pb.width / 2, pb.y + pb.height / 2); }
else await page.click('#play-button');
await page.waitForTimeout(600);
rects = await measure();
if (PHONE) console.error('rects', JSON.stringify(rects));

const diag = () => page.evaluate(() => {
  const d = window.__THREE_GAME_DIAGNOSTICS__;
  return { st: d.state, el: d.elapsed, p: d.player.position, yaw: d.player.yaw, sp: d.player.speed, bo: d.player.boost, bing: d.player.boosting,
    ob: d.objective ? { ph: d.objective.phase, n: d.objective.name, p: d.objective.position } : null, del: d.deliveries, tl: d.timeLeft,
    cr: d.crashes ?? 0, rings: d.rings, rs: d.ringStats, shift: d.shift, ot: d.ending?.overtime, fps: d.fps,
    nudge: document.querySelector('.boost')?.classList.contains('nudge') || document.getElementById('boost-button')?.classList.contains('nudge'),
    lc: d.lastCrash, contact: d.contact, stk: window.__GAME__.stick?.(),
    see: document.querySelector('.objective')?.classList.contains('see-through') ?? null, seeOp: +(getComputedStyle(document.querySelector('.objective')).opacity), rhOp: +(getComputedStyle(document.querySelector('.route-hint')).opacity), rhShow: document.querySelector('.route-hint')?.classList.contains('show') };
});
const route = async (p, o) => page.evaluate(([p, o]) => {
  const r = window.__GAME__.streetRoute({ x: p.x, z: p.z }, { x: o.x, z: o.z }, true);
  return r.points.map((q) => ({ x: q.x, z: q.z, kind: q.kind }));
}, [p, o]);

let legKey = '', wps = [], posHist = [], unstick = 0, prev = null, legY = 0, leaving = false;
const seeLog = { toggles: 0, onSpans: [], onAt: null, shots: 0, nearestOn: [] };
const log = { seeLog, tag, query, profile, phone: PHONE, ringTakes: [], crashes: [], dels: [], nudges: 0, nudgeBoosts: 0, boostT: 0, gustT: 0, unsticks: 0, samples: 0, fps: [] };
let lastRings = 0, lastCr = 0, lastDel = 0, nudgeWas = false, nudgeBoostLeft = 0, t0 = Date.now(), lastT = Date.now();
const shotsAt = new Set();
let shotN = 0;
const snap = async (name) => { shotN++; await page.screenshot({ path: OUT + `${tag}-${name}.jpg`, type: 'jpeg', quality: 80 }); };
let pendingRingShot = !!flags.includes('shots');
let d = await diag();
while (d.st === 'playing' || d.st === 'paused') {
  const now = Date.now(); const dt = (now - lastT) / 1000; lastT = now;
  log.samples++;
  if (log.samples % 30 === 0) log.fps.push(d.fps);
  const p = d.p, o = d.ob?.p;
  if (!o) { await page.waitForTimeout(60); d = await diag(); continue; }
  const k = d.ob.ph + d.ob.n + d.del;
  if (k !== legKey) {
    legKey = k; posHist = []; leaving = true; legY = p.y;
    const pts = await route(p, o);
    wps = [];
    for (const q of pts) { const l = wps[wps.length - 1] || p; if (Math.hypot(q.x - l.x, q.z - l.z) > 3) wps.push(q); }
    for (let i = wps.length - 2; i >= 1; i--) { const a = wps[i - 1], b = wps[i], c = wps[i + 1]; if (Math.abs(wrap(Math.atan2(c.x - b.x, c.z - b.z) - Math.atan2(b.x - a.x, b.z - a.z))) < 0.05) wps.splice(i, 1); }
    wps.push({ x: o.x, z: o.z, final: true });
  }
  const hd = Math.hypot(o.x - p.x, o.z - p.z);
  let w = wps[0], wd = Math.hypot(w.x - p.x, w.z - p.z);
  while (!w.final && (wd < 5 || hd < 14)) { wps.shift(); w = wps[0]; wd = Math.hypot(w.x - p.x, w.z - p.z); leaving = false; }
  // rings on the line ahead
  let ringY = null;
  if (cfg.ringAim > 0 && d.rings) for (const r of d.rings) {
    if (!r.on) continue; const rd = Math.hypot(r.x - p.x, r.z - p.z); if (rd > 50) continue;
    const toW = Math.atan2(w.x - p.x, w.z - p.z), toR = Math.atan2(r.x - p.x, r.z - p.z);
    if (Math.abs(wrap(toR - toW)) < 0.5 && Math.abs(Math.sin(wrap(toR - toW))) * rd < cfg.ringAim) { ringY = r.y; break; }
  }
  const vx = prev ? (p.x - prev.x) / Math.max(dt, 0.02) : 0, vz = prev ? (p.z - prev.z) / Math.max(dt, 0.02) : 0;
  prev = { x: p.x, z: p.z };
  const head = Math.hypot(vx, vz) > 4 ? Math.atan2(vx, vz) : Math.atan2(-Math.sin(d.yaw), -Math.cos(d.yaw));
  let err = wrap(Math.atan2(w.x - p.x, w.z - p.z) - head);
  if (cfg.wobble) err += Math.sin((now - t0) / 700) * 0.06 * cfg.wobble;
  const tnow = (now - t0) / 1000;
  posHist.push([tnow, p.x, p.z]); while (posHist.length && posHist[0][0] < tnow - 3) posHist.shift();
  if (unstick <= 0 && posHist.length > 20 && tnow - posHist[0][0] > 2.6 && Math.hypot(posHist[0][1] - p.x, posHist[0][2] - p.z) < 1.5 && hd > 3) { unstick = 1.2; posHist = []; log.unsticks++; }
  const raised = o.y > 2;
  let wantY = hd < 30 ? o.y + 1.3 : raised && hd < 45 ? o.y + 2 : (ringY ?? cfg.y);
  if (leaving && legY > 10 && hd >= 30) wantY = legY + 8;
  const next = wps[1];
  const turn = next && !w.final ? Math.abs(wrap(Math.atan2(next.x - w.x, next.z - w.z) - Math.atan2(w.x - p.x, w.z - p.z))) : 0;
  const lookD = Math.max(14, d.sp * 1.0);
  const corner = !w.final && wd < lookD && turn > 0.5;
  let tgt = hd < 8 ? 4 : corner ? cfg.corner : w.final && hd < 25 ? 8 : cfg.cruise;
  if (raised && hd < 30 && p.y < o.y - 0.5) tgt = 1;
  if (Math.abs(err) > 0.5) tgt = Math.min(tgt, 8);
  let boost = !corner && !w.final && wd > cfg.boostD && Math.abs(err) < 0.12 && d.bo >= (cfg.boostMin ?? 1);
  // the nudge: a human who sees the bar pulse presses E for a moment (if the road ahead is not a corner)
  if (d.nudge && !nudgeWas) { log.nudges++; if (cfg.nudgeBoost && !corner && wd > 25 && Math.abs(err) < 0.2) { nudgeBoostLeft = 1.2; log.nudgeBoosts++; } }
  nudgeWas = d.nudge;
  if (nudgeBoostLeft > 0) { nudgeBoostLeft -= dt; if (!corner) boost = true; }
  let W, S, A, D, U, Dn;
  if (unstick > 0) { unstick -= dt; W = false; S = true; A = D = false; U = true; Dn = false; boost = false; }
  else {
    D = Math.abs(err) > cfg.steer && err < 0; A = Math.abs(err) > cfg.steer && err > 0;
    W = Math.abs(err) < 0.8 && d.sp < tgt;
    S = cfg.brake ? (d.sp > tgt + 3 || (Math.abs(err) > 1.2 && d.sp > 4)) : (hd < 10 && d.sp > 6);
    U = p.y < wantY - 1.0; Dn = p.y > wantY + 1.0;
    if (cfg.holdAfterRing && (ringY !== null || (log.ringTakes.length && tnow - log.ringTakes.at(-1).t < cfg.holdAfterRing))) { W = true; S = false; }
  }
  if (!log.trace) log.trace = [];
  if (log.samples % 15 === 0) log.trace.push([+tnow.toFixed(1), Math.round(p.x), +p.y.toFixed(1), Math.round(p.z), +d.sp.toFixed(1), d.ob.ph, Math.round(o.x), +o.y.toFixed(1), Math.round(o.z), Math.round(hd), w.final ? 'F' : Math.round(w.x) + ',' + Math.round(w.z), +err.toFixed(2), +d.tl.toFixed(1), [W, S, A, D, U, Dn, boost].map((v) => (v ? 1 : 0)).join(''), d.stk ? [d.stk.id, +d.stk.x.toFixed(2), +d.stk.y.toFixed(2), d.stk.pressed] : null, +(d.yaw).toFixed(2)]);
  if (d.bing) log.boostT += dt;
  if (d.rs?.gust > 0) log.gustT += dt;
  if (PHONE) await phoneApply((D ? 1 : 0) - (A ? 1 : 0), (W ? 1 : 0) - (S ? 1 : 0), U, Dn, boost);
  else { await key('KeyW', W); await key('KeyS', S); await key('KeyA', A); await key('KeyD', D); await key('Space', U); await key('ShiftLeft', Dn); await key('KeyE', boost); }
  // events
  if (d.rs && d.rs.taken > lastRings) {
    lastRings = d.rs.taken;
    const nextTurn = next ? { turn: +turn.toFixed(2), wd: Math.round(wd) } : null;
    log.ringTakes.push({ t: +tnow.toFixed(1), speed: +d.sp.toFixed(1), tl: +d.tl.toFixed(1), cr: d.cr, nextTurn, after: [] });
    if (pendingRingShot && lastRings === 2) { pendingRingShot = false; await snap('ring-burst'); }
  }
  for (const rt of log.ringTakes) if (tnow - rt.t < 3 && rt.after.length < 30) rt.after.push([+(tnow - rt.t).toFixed(2), +d.sp.toFixed(1), d.cr, W ? 1 : 0, +(d.rs?.gust ?? 0).toFixed(2), d.bing ? 1 : 0]);
  if (d.cr > lastCr) { log.crashes.push({ t: +tnow.toFixed(1), n: d.cr - lastCr, sp: +d.sp.toFixed(1), gust: d.rs?.gust ?? 0, sinceRing: log.ringTakes.length ? +(tnow - log.ringTakes.at(-1).t).toFixed(2) : null, lc: d.lc }); lastCr = d.cr; }
  if (d.del > lastDel) { lastDel = d.del; log.dels.push({ t: +tnow.toFixed(1), tl: +d.tl.toFixed(1) }); if (flags.includes('shots') && (d.del === 2 || d.del === 4)) { await page.waitForTimeout(900); await snap(`hud-${d.del}of5`); } }
  if (flags.includes('shots') && !shotsAt.has('ringahead') && d.rings?.some((r) => r.on && Math.hypot(r.x - p.x, r.z - p.z) < 35 && Math.hypot(r.x - p.x, r.z - p.z) > 15)) { shotsAt.add('ringahead'); await snap('ring-ahead'); }
  if (flags.includes('shots') && d.nudge && !shotsAt.has('nudge')) { shotsAt.add('nudge'); await snap('nudge'); }
  if (d.see !== null && d.see !== (seeLog.onAt !== null)) {
    seeLog.toggles++;
    const nr = (d.rings || []).filter((r) => r.on).map((r) => Math.round(Math.hypot(r.x - p.x, r.z - p.z))).sort((a, b) => a - b)[0] ?? null;
    if (d.see) { seeLog.onAt = tnow; seeLog.nearestOn.push(nr); if (PHONE && seeLog.shots < 3) { seeLog.shots++; await page.waitForTimeout(250); await snap(`see-on-${seeLog.shots}`); } }
    else { seeLog.onSpans.push([+seeLog.onAt.toFixed(2), +(tnow - seeLog.onAt).toFixed(2), nr]); seeLog.onAt = null; }
  }
  if (tnow > 400) break;
  await page.waitForTimeout(40);
  d = await diag();
}
for (const k of [...held]) await key(k, false);
if (PHONE) { touches.clear(); await touchSync(); }
await page.waitForTimeout(2600);
await snap('end');
const card = await page.evaluate(() => ({
  kicker: document.getElementById('over-kicker')?.textContent, score: document.getElementById('over-score')?.textContent,
  medal: document.getElementById('over-medal-name')?.textContent, shift: document.getElementById('over-shift')?.textContent,
  time: document.getElementById('over-time')?.innerText, breakdown: document.getElementById('over-breakdown')?.innerText,
  next: document.getElementById('over-next')?.textContent, visible: !document.getElementById('over-screen').hidden,
  session: window.__GAME__.session?.(),
}));
const fin = await diag();
log.result = { realS: Math.round((Date.now() - t0) / 1000), del: fin.del, tl: +fin.tl.toFixed(1), crashes: fin.cr, rings: fin.rs, card, errors };
fs.writeFileSync(OUT + `${tag}.json`, JSON.stringify(log, null, 1));
console.log(JSON.stringify({ tag, kicker: card.kicker, score: card.score, medal: card.medal, shift: card.shift, dels: log.dels, ringsTaken: fin.rs?.taken, ringsPlaced: fin.rs?.placed, ringSec: fin.rs?.seconds, crashes: fin.cr, crashLog: log.crashes.map((c) => [c.t, c.sp, c.sinceRing, c.gust]), boostT: +log.boostT.toFixed(1), gustT: +log.gustT.toFixed(1), nudges: log.nudges, nudgeBoosts: log.nudgeBoosts, unsticks: log.unsticks, see: { toggles: seeLog.toggles, spans: seeLog.onSpans.length, short: seeLog.onSpans.filter((s) => s[1] < 0.4).length }, fpsMed: log.fps.sort((a, b) => a - b)[log.fps.length >> 1], realS: log.result.realS, errors }));
const vid = page.video();
await ctx.close();
if (vid) { const vp = await vid.path(); fs.renameSync(vp, OUT + `${tag}.webm`); }
await browser.close();
