// Round 45 audio critic: record the real Web Audio output of Drone Dash in real time, with a scripted pilot.
// MODE=main : title (TITLE_S) -> Enter -> routed low-street pilot (round 5-11 control logic) until the run ends -> game over (OVER_S).
// MODE=fx   : Enter -> 6 s normal flight -> a glancing wall scrape -> a head-on crash -> low over the harbour following the
//             harbour bus and past boats -> low along a busy street near people and traffic.
// Tap (6 channels, one ScriptProcessor): master L, master R (after limiter + trim, what the speakers get), music bus
// (musicOut, after duck), cue bus (sfx, before reverb), bed (rotor + wind + draft, summed), reverb return.
// A 10 ms calibration burst at a known audio-clock time gives the capture latency. Raw float32 per channel goes to RAW.
// Desktop 1280x720, own dev server on PORT (never 5188).
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const PORT = Number(process.env.PORT || 5196); if (PORT === 5188) throw new Error('5188 is the owner');
const MODE = process.env.MODE || 'main'; const SEED = process.env.SEED || '22';
const RAW = process.env.RAW || '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/a45/raw/';
const TAG = `${MODE}-s${SEED}`; const TITLE_S = Number(process.env.TITLE_S || 24), OVER_S = Number(process.env.OVER_S || 26);
fs.mkdirSync(RAW, { recursive: true });
const NAMES = ['L', 'R', 'music', 'sfx', 'bed', 'rev'];
const TAPHOOK = () => {
  const oc = AudioNode.prototype.connect; window.__cap = null; let master = null, k = 0, merger = null, split = null; window.__toMaster = [];
  const ensure = (ctx) => {
    if (merger) return;
    merger = ctx.createChannelMerger(6); split = ctx.createChannelSplitter(2);
    oc.call(split, merger, 0, 0); oc.call(split, merger, 1, 1);
    const sp = ctx.createScriptProcessor(4096, 6, 1); sp.channelCount = 6; sp.channelCountMode = 'explicit'; sp.channelInterpretation = 'discrete';
    const z = ctx.createGain(); z.gain.value = 0;
    window.__cap = { on: false, chunks: [[], [], [], [], [], []], t0: null, n: 0, sr: ctx.sampleRate, ctx, split };
    sp.onaudioprocess = (e) => { const c = window.__cap; if (!c.on) return; if (c.t0 === null) c.t0 = e.playbackTime; for (let ch = 0; ch < 6; ch++) c.chunks[ch].push(new Float32Array(e.inputBuffer.getChannelData(ch))); c.n += e.inputBuffer.length; };
    oc.call(merger, sp); oc.call(sp, z); oc.call(z, ctx.destination);
  };
  AudioNode.prototype.connect = function (dest) {
    const r = oc.apply(this, arguments);
    try {
      if (dest instanceof DynamicsCompressorNode && this instanceof GainNode && !master) master = this;
      else if (dest instanceof AudioDestinationNode && this !== merger && !(this instanceof ScriptProcessorNode)) { ensure(this.context); if (!(this.gain && this.gain.value === 0)) oc.call(this, split); }
      else if (master && dest === master) {
        ensure(this.context);
        // build() order: sfx, reverb convolver, rotor, wind, draft, then buildMusic(): musicOut
        const slot = [3, 5, 4, 4, 4, 2][k]; window.__toMaster.push(this.constructor.name + '->' + slot); k++;
        if (slot !== undefined) oc.call(this, merger, 0, slot);
      }
    } catch (e) { window.__tapErr = String(e); }
    return r;
  };
  window.__dump = () => { const c = window.__cap; if (!c) return null; const out = []; for (let ch = 0; ch < 6; ch++) { const arrs = c.chunks[ch]; c.chunks[ch] = []; const len = arrs.reduce((a, b) => a + b.length, 0); const f = new Float32Array(len); let o = 0; for (const a of arrs) { f.set(a, o); o += a.length; } const u8 = new Uint8Array(f.buffer); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); out.push(btoa(s)); } return out; };
};
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
const browser = await chromium.launch({ channel: 'chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.addInitScript(TAPHOOK);
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(2500);
const files = NAMES.map((n) => RAW + `${TAG}-${n}.f32`); files.forEach((f) => fs.writeFileSync(f, Buffer.alloc(0)));
let lastDump = Date.now();
const dump = async () => { lastDump = Date.now(); const out = await page.evaluate(() => window.__dump && window.__dump()); if (out) out.forEach((b, ch) => fs.appendFileSync(files[ch], Buffer.from(b, 'base64'))); };
const EV = []; // compact per-poll log
const poll = async (tag) => {
  if (Date.now() - lastDump > 3000) await dump();
  const r = await page.evaluate(() => { const g = window.__THREE_GAME_DIAGNOSTICS__; const c = window.__cap; const m = g.audio.music; const s = g.slipstream || {};
    return { ct: c ? c.ctx.currentTime : null, state: g.state, tl: g.timeLeft, score: g.score, del: g.deliveries, phase: g.objective ? g.objective.phase : null, obj: g.objective ? g.objective.position : null, chain: s.chain, pay: s.payouts, lvl: s.level, drafting: s.drafting, combo: g.combo, crashes: g.crashes, scrapes: g.feel.scrapes, impacts: g.feel.impacts, light: g.feel.lightHits, slowMo: g.feel.slowMo, passes: g.goals.passes, tier: g.goals.tier, rush: g.escalation.on, rushOrders: g.escalation.orders, ot: g.ending.overtime, pos: g.player.position, spd: g.player.speed, boost: g.player.boost, boosting: g.player.boosting, cam: g.camera, track: m.track, section: m.section, layer: m.layer, duck: m.duck, lastDuck: m.lastDuck, ducks: m.ducks, lim: m.limiterDb, comp: m.compDb, late: m.late, resyncs: m.resyncs }; });
  r.tag = tag; r.wall = Date.now(); EV.push(r); return r;
};
// gesture on the title: a non-starting key unlocks the sound, the title loop plays from it
await page.keyboard.press('ShiftLeft'); await page.waitForTimeout(200);
await page.evaluate(() => { if (window.__cap) window.__cap.on = true; });
const calT = await page.evaluate(async () => { await new Promise((r) => setTimeout(r, 300)); const c = window.__cap.ctx; const n = Math.round(c.sampleRate * 0.01); const b = c.createBuffer(1, n, c.sampleRate); const d = b.getChannelData(0); let x = 12345; for (let i = 0; i < n; i++) { x = (x * 1103515245 + 12345) % 2147483648; d[i] = (x / 2147483648 * 2 - 1) * 0.6; } const T = Math.ceil((c.currentTime + 0.5) * c.sampleRate) / c.sampleRate; const s = c.createBufferSource(); s.buffer = b; s.connect(window.__cap.split); s.start(T); return T; });
const held = new Set();
const key = async (k, on) => { if (on && !held.has(k)) { held.add(k); await page.keyboard.down(k); } if (!on && held.has(k)) { held.delete(k); await page.keyboard.up(k); } };
const releaseAll = async () => { for (const k of [...held]) await key(k, false); };
const marks = [];
const mark = async (label) => { const ct = await page.evaluate(() => window.__cap.ctx.currentTime); marks.push({ label, ct }); console.log('MARK', label, ct.toFixed(2)); };

// generic steer toward a point: returns after one control step
let prevPos = null, dtw = 0.05, tLast = Date.now();
async function steer(d, w, wantY, tgtSpeed, boost = false) {
  const p = d.pos, c = d.cam;
  const vx = prevPos ? (p.x - prevPos.x) / dtw : 0, vz = prevPos ? (p.z - prevPos.z) / dtw : 0;
  const head = Math.hypot(vx, vz) > 4 ? Math.atan2(vx, vz) : Math.atan2(p.x - c.x, p.z - c.z);
  let err = Math.atan2(w.x - p.x, w.z - p.z) - head; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
  await key('KeyD', Math.abs(err) > 0.1 && err < 0); await key('KeyA', Math.abs(err) > 0.1 && err > 0);
  await key('KeyW', Math.abs(err) < 0.8 && d.spd < tgtSpeed);
  await key('KeyS', d.spd > tgtSpeed + 3 || (Math.abs(err) > 1.2 && d.spd > 4));
  await key('KeyE', boost);
  await key('Space', p.y < wantY - 1.0); await key('ShiftLeft', p.y > wantY + 1.0);
  return err;
}
async function next(tag) { prevPos = EV.length ? EV[EV.length - 1].pos : null; await page.waitForTimeout(35); const d = await poll(tag); const now = Date.now(); dtw = Math.max(0.03, (now - tLast) / 1000); tLast = now; return d; }

// ---- routed street pilot (round 5 to 11 low line: corners at 7 m/s, 16 m/s on straights, 7 m up, boost on long straights)
async function pilot(d, st) {
  const p = d.pos, o = d.obj; const k = d.phase + JSON.stringify(o);
  if (k !== st.legKey) { st.legKey = k; st.leaving = true; st.posHist = []; st.wps = route(p, o); }
  const hd = Math.hypot(o.x - p.x, o.z - p.z);
  let w = st.wps[0]; let wd = Math.hypot(w.x - p.x, w.z - p.z);
  if (!w.final && (wd < 4 || hd < 14)) { st.leaving = false; st.wps.shift(); w = st.wps[0]; wd = Math.hypot(w.x - p.x, w.z - p.z); }
  const el = Date.now() / 1000; st.posHist.push([el, p.x, p.z]); while (st.posHist.length && st.posHist[0][0] < el - 3) st.posHist.shift();
  if (st.unstick <= 0 && st.posHist.length > 25 && el - st.posHist[0][0] > 2.7 && Math.hypot(st.posHist[0][1] - p.x, st.posHist[0][2] - p.z) < 1.5 && hd > 3) { st.unstick = 1.2; st.posHist = []; }
  const raised = o.y > 2; const offRoad = st.leaving && Math.min(Math.abs(p.x - nr(p.x)), Math.abs(p.z - nr(p.z))) > 6.5;
  const wantY = offRoad && hd >= 30 ? 26 : hd < 30 ? (raised ? o.y + 1.5 : o.y + 1.2) : (raised && hd < 45 ? o.y + 2 : 7);
  const corner = !w.final && wd < 14; let tgt = hd < 8 ? 4 : corner ? 7 : w.final && hd < 25 ? 8 : 16;
  // boost like a person: press on a long straight when lined up, then hold it (no tapping) until the corner nears,
  // the meter runs dry or the line is lost
  if (!st.boosting && !corner && !w.final && wd > 55 && d.boost > 0.3 && Math.abs(st.err || 0) < 0.12) st.boosting = true;
  else if (st.boosting && (corner || w.final || wd < 30 || d.boost < 0.03 || Math.abs(st.err || 0) > 0.4)) st.boosting = false;
  if (raised && hd < 30 && p.y < o.y - 0.5) tgt = 1;
  if (st.unstick > 0) { st.unstick -= dtw; for (const kk of ['KeyW', 'KeyA', 'KeyD', 'ShiftLeft', 'KeyE']) await key(kk, false); await key('KeyS', true); await key('Space', true); return; }
  st.err = await steer(d, w, wantY, tgt, st.boosting);
}

let d;
if (MODE === 'main' || MODE === 'ot') {
  // MODE=ot: the same pilot with a short starting clock (OT_START s), so the clock runs out mid-delivery and overtime starts
  if (MODE === 'ot') await page.evaluate((v) => window.__GAME__.tune({ RUN: { startTime: v } }), Number(process.env.OT_START || 22));
  await mark('title-start');
  const t0 = Date.now(); while (Date.now() - t0 < TITLE_S * 1000) { d = await poll('title'); await page.waitForTimeout(400); }
  await mark('enter'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
  const st = { legKey: '', wps: [], leaving: true, posHist: [], unstick: 0 };
  d = await next('run'); const tr = Date.now();
  while (d.state === 'playing' && Date.now() - tr < 420000) { await pilot(d, st); d = await next('run'); }
  await releaseAll(); await mark('run-end ' + d.state);
  const t1 = Date.now(); while (Date.now() - t1 < OVER_S * 1000) { d = await poll('over'); await page.waitForTimeout(400); }
} else {
  await mark('enter'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
  const st = { legKey: '', wps: [], leaving: true, posHist: [], unstick: 0 };
  d = await next('fly'); let tr = Date.now();
  while (Date.now() - tr < 6000) { await pilot(d, st); d = await next('fly'); }
  await releaseAll();
  // find a facade beside a road: road along z at x = R, scan +x from the road centre at y = 6
  const wall = await page.evaluate(() => { const G = window.__GAME__; let best = null; for (const R of [-110, -66, -22, 22, 66, 110]) for (let z = -140; z <= 140; z += 2) { let hit = null; for (let dx = 4; dx < 13; dx += 0.25) if (G.insideSolid(R + dx, 6, z)) { hit = R + dx; break; } if (hit === null) continue; let a = z, b2 = z; while (G.insideSolid(hit + 0.5, 6, a - 1) && a > z - 60) a--; while (G.insideSolid(hit + 0.5, 6, b2 + 1) && b2 < z + 60) b2++; const L = b2 - a; if (!best || L > best.L) best = { R, wx: hit, z0: a, z1: b2, L }; } return best; });
  console.log('WALL', JSON.stringify(wall));
  // glancing scrape: 1.95 m off the facade line, nose 12 degrees into it, 12 m/s along the street
  const ang = 12 * Math.PI / 180; const dir = { x: Math.sin(ang), z: Math.cos(ang) };
  await page.evaluate(([x, z, yaw]) => window.__GAME__.place(x, 6, z, yaw, 12), [wall.wx - 1.95, wall.z0 - 2, Math.atan2(-dir.x, -dir.z)]);
  await mark('scrape-setup'); await key('KeyW', true);
  tr = Date.now(); while (Date.now() - tr < 1800) d = await next('scrape');
  await releaseAll(); tr = Date.now(); while (Date.now() - tr < 2000) d = await next('scrape-after');
  // head-on: across the street, facing the facade, 15 m/s, throttle and boost held
  await page.evaluate(([x, z]) => window.__GAME__.place(x, 6, z, Math.atan2(-1, 0), 15), [wall.wx - 15, (wall.z0 + wall.z1) / 2]);
  await mark('crash-setup'); await key('KeyW', true); await key('KeyE', true);
  tr = Date.now(); while (Date.now() - tr < 1500) d = await next('crash');
  await releaseAll(); tr = Date.now(); while (Date.now() - tr < 3500) d = await next('crash-after');
  // harbour: find the harbour bus, start 30 m behind it on its lane, 3.5 m over the water, and follow it
  const boats = await page.evaluate(() => window.__GAME__.boats());
  const lanes = [...new Set(boats.map((b) => b.lane))]; const busLane = Math.max(...lanes);
  const bus = boats.find((b) => b.lane === busLane && b.moving) || boats.find((b) => b.kind === 'ferry');
  console.log('BUS', JSON.stringify(bus), 'kinds', JSON.stringify(boats.map((b) => b.kind + ':' + b.lane)));
  const fx = Math.sin(bus.yaw), fz = Math.cos(bus.yaw);
  await page.evaluate(([x, z, yaw]) => window.__GAME__.place(x, 3.5, z, yaw, 8), [bus.x - fx * 28, bus.z - fz * 28, Math.atan2(-fx, -fz)]);
  await mark('harbour-start'); prevPos = null;
  tr = Date.now(); let lastB = 0, tgtB = bus;
  while (Date.now() - tr < 16000) {
    if (Date.now() - lastB > 500) { lastB = Date.now(); const bs = await page.evaluate(() => window.__GAME__.boats()); const p = d.pos; tgtB = bs.find((b) => b.lane === busLane && b.moving) || tgtB; // after 9 s, swing toward the nearest other boat
      if (Date.now() - tr > 9000) { const others = bs.filter((b) => b.lane !== busLane).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z)); if (others[0]) tgtB = others[0]; } }
    const gx = tgtB.x - Math.sin(tgtB.yaw) * 6, gz = tgtB.z - Math.cos(tgtB.yaw) * 6;
    await steer(d, { x: gx, z: gz }, 3.5, Math.hypot(gx - d.pos.x, gz - d.pos.z) > 15 ? 12 : 5);
    d = await next('harbour');
  }
  await releaseAll();
  // street: the road with most people near it, 2.8 m up, 8 m/s, past people and cars
  const pick = await page.evaluate(() => { const G = window.__GAME__; const ppl = G.people(); const cars = G.traffic(); let best = null; for (const R of [-110, -66, -22, 22, 66, 110]) for (const z0 of [-110, -66, -22, 22, 66]) { const n = ppl.filter((q) => Math.abs(q.x - R) < 12 && q.z > z0 && q.z < z0 + 44).length + cars.filter((c) => Math.abs(c.x - R) < 8 && c.z > z0 && c.z < z0 + 44).length * 2; if (!best || n > best.n) best = { R, z0, n }; } return best; });
  console.log('STREET', JSON.stringify(pick));
  await page.evaluate(([x, z]) => window.__GAME__.place(x, 2.8, z, Math.atan2(0, -1), 6), [pick.R + 3, pick.z0 + 2]);
  await mark('street-start'); prevPos = null;
  tr = Date.now(); while (Date.now() - tr < 12000) { await steer(d, { x: pick.R + 3, z: d.pos.z + 30 }, 2.8, 8); d = await next('street'); }
  await releaseAll(); await mark('fx-end');
}
await dump();
const cap = await page.evaluate(() => ({ sr: window.__cap.sr, t0: window.__cap.t0, n: window.__cap.n, toMaster: window.__toMaster, tapErr: window.__tapErr || null }));
fs.writeFileSync(RAW + `${TAG}-timeline.json`, JSON.stringify({ ...cap, calT, marks, EV, errors }));
console.log('DONE', JSON.stringify({ ...cap, calT, errors, polls: EV.length, final: { state: d.state, score: d.score, del: d.del, crashes: d.crashes, pay: d.pay, passes: d.passes, late: d.late, resyncs: d.resyncs } }));
await browser.close();
