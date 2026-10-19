// Round 33 critic (boattrace33b: also logs max(|x|,|z|) of the drone, to see the soft city bound): hover runs only (boat runs into a parked drone), with a per-frame trace for 40 frames
// after first contact: drone speed, effective speed from the position change, and the step length. PORT selects the build.
// Base: Round 33 copy of boats32: also logs, for 1 s after first contact, the peak horizontal drone speed (velocity) and the
// peak effective speed from the position change per frame (catches direct slides), plus a static-wall reference at the end.
// Round 32 critic (new): fly the drone into boats, fixed step (60 Hz advance, manualRender). Per approach it logs the
// crash count change, lastCrash, speed before / after contact, frames with the drone centre inside any hull box,
// frames with the drone centre within 0.4 m of a mast line, the deepest sphere overlap, time in contact (stuck), and
// how far a boat pushed the drone down. Modes:
//   ram   : start 12 m off the beam (led for the boat's motion), 15 m/s, W held, at height y
//   slow  : same, 4 m/s, no input
//   hover : drone parked 6 m ahead of the bow, no input (the boat runs into it)
//   press : parked ahead of the bow, W held toward the boat (player pushing into it)
// SEEDS default 22,58,4711. SHOTS=0 skips screenshots.
import { chromium } from '@playwright/test';
const OUT = (process.env.OUTDIR || new URL('../critic/', import.meta.url).pathname);
const SEEDS = (process.env.SEEDS || '22,58,4711').split(',').map(Number); const SHOTS = process.env.SHOTS !== '0';
const PORT = process.env.PORT || '5191';
const browser = await chromium.launch({ channel: 'chromium' });
const all = [];
for (const SEED of SEEDS) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
  await page.waitForFunction(() => window.__GAME__.assetsReady().on && window.__GAME__.boats().length > 0, null, { timeout: 30000 });
  await page.evaluate(() => {
    const G = window.__GAME__; G.advance(2, false);
    const NP = { sail: 2, rib: 1, row: 1, ferry: 3 };
    const R = 0.95;
    const colsOf = () => { const C = G.boatColliders(); const B = G.boats(); let k = 0; const per = B.map((b) => { const n = NP[b.kind]; const c = C.slice(k, k + n); k += n; return c; }); return { per, docks: C.slice(k), all: C }; };
    const local = (p, c) => { const ox = p.x - c.x, oz = p.z - c.z; return [ox * c.c - oz * c.s, ox * c.s + oz * c.c]; };
    const inside = (p, c) => { const [lx, lz] = local(p, c); return Math.abs(lx) < c.hx && Math.abs(lz) < c.hz && p.y > c.y0 && p.y < c.y1; };
    const dist = (p, c) => { const [lx, lz] = local(p, c); const dx = Math.max(Math.abs(lx) - c.hx, 0), dz = Math.max(Math.abs(lz) - c.hz, 0), dy = Math.max(c.y0 - p.y, p.y - c.y1, 0); return Math.hypot(dx, dy, dz); };
    const mastD = (p, c) => { const [lx, lz] = local(p, c); return p.y > c.y0 && p.y < c.y1 ? Math.hypot(Math.max(Math.abs(lx) - c.hx, 0), Math.max(Math.abs(lz) - c.hz, 0)) : 99; };
    window.__bt = {
      run(spec) {
        // spec: { i, mode, y, side, stopAfterContact }
        for (let k = 0; k < 24; k++) { G.place(0, 60, 0, 0, 0); G.advance(1 / 60, false); } // settle (clears any hop / bounce state)
        let B = G.boats(); let b = B[spec.i];
        // the harbour bus may be at a stop: for moving-boat modes wait until it is under way
        // and wait for a straight stretch (the lanes are rounded squares): heading on an axis, and the next 5 s of travel
        // stays on the same side, away from the corners
        const okStraight = (b) => { if (!b.moving) return true; if (b.speed < 1.5) return false; const ax = Math.abs(Math.sin(b.yaw)) > 0.999; const ay = Math.abs(Math.cos(b.yaw)) > 0.999; if (!ax && !ay) return false; const along = ax ? b.x : b.z; const head = ax ? Math.sin(b.yaw) : Math.cos(b.yaw); const lim = 164 - 6; return Math.abs(along) < lim && Math.abs(along + head * b.speed * 5.5) < lim; };
        if (b.moving) { let g = 0; while (!okStraight(b) && g++ < 1600) { G.advance(0.25, false); B = G.boats(); b = B[spec.i]; } }
        const waited = b.moving && !okStraight(b) ? 'NOSTRAIGHT' : 'ok';
        const f = [Math.sin(b.yaw), Math.cos(b.yaw)], n = [Math.cos(b.yaw), -Math.sin(b.yaw)];
        const hl = b.len / 2; let start, dir, speed = 0, holdW = false, T;
        if (spec.mode === 'ram' || spec.mode === 'slow') {
          const L = spec.mode === 'ram' ? 12 : 3.6; speed = spec.mode === 'ram' ? 15 : 4; holdW = spec.mode === 'ram';
          const th = L / (spec.mode === 'ram' ? 15.5 : 3.0); const off = spec.off || 0;
          const c = [b.x + f[0] * (b.speed * th + off), b.z + f[1] * (b.speed * th + off)];
          start = [c[0] + n[0] * spec.side * L, c[1] + n[1] * spec.side * L]; dir = [-n[0] * spec.side, -n[1] * spec.side]; T = th + 2.5;
        } else {
          start = [b.x + f[0] * (hl + 6), b.z + f[1] * (hl + 6)]; dir = [-f[0], -f[1]]; holdW = spec.mode === 'press';
          T = Math.min(14, (2 * hl + 14) / Math.max(b.speed, 1) + 2.5);
        }
        const yaw = Math.atan2(-dir[0], -dir[1]);
        const c0 = G.diagnostics().crashes; const bump0 = G.diagnostics().contact?.bump ?? 0;
        for (let k = 0; k < 3; k++) { G.place(start[0], spec.y, start[1], yaw, speed); G.advance(1 / 60, false); }
        if (holdW) G.key('KeyW', true);
        const out = { waited, seed: G.diagnostics().seed, i: spec.i, kind: b.kind, moving: b.moving, boatSpeed: +b.speed.toFixed(1), mode: spec.mode, y: spec.y, side: spec.side,
          frames: 0, insideHull: 0, insideAnyHull: 0, mastClose: 0, maxOverlap: 0, contactFrames: 0, longestContact: 0, firstContact: null, vBefore: null, vAfter: null,
          y0: spec.y, minY: 99, maxY: -99, maxDrop: 0, crashes: 0, lastCrash: null, endGap: null, endSpeed: null, pushed: 0, stuck: false, touched: false, touchedMast: false };
        let run = 0, pos0 = null, sp = []; let prevP = null; out.peakV = 0; out.peakEff = 0; out.peakSide = 0;
        const steps = Math.round(T * 60);
        for (let s = 0; s < steps; s++) {
          if ((spec.mode === 'hover' || spec.mode === 'press') && out.firstContact == null) G.place(start[0], spec.y, start[1], yaw, G.diagnostics().player.speed * (spec.mode === 'press' ? 1 : 0)); // hold station against the soft bounds until the boat arrives
          const cBefore = G.diagnostics().crashes; const d = G.advance(1 / 60, false); out.frames++;
          const p = d.player.position; if (out.firstContact != null && s <= out.firstContact + 60 && prevP) { out.peakV = Math.max(out.peakV, +d.player.speed.toFixed(2)); const ex = (p.x - prevP.x) * 60, ez = (p.z - prevP.z) * 60; out.peakEff = Math.max(out.peakEff, +Math.hypot(ex, ez).toFixed(2)); out.peakSide = Math.max(out.peakSide, +Math.abs(ex * dir[1] - ez * dir[0]).toFixed(2)); } if (out.firstContact != null && s <= out.firstContact + 40 && prevP) (out.trace = out.trace || []).push([s - out.firstContact, +d.player.speed.toFixed(2), +(Math.hypot(p.x - prevP.x, p.z - prevP.z) * 60).toFixed(1), +p.y.toFixed(2), +Math.max(Math.abs(p.x), Math.abs(p.z)).toFixed(1)]); prevP = { ...p }; sp.push(d.player.speed); if (sp.length > 20) sp.shift();
          const C = colsOf(); const mine = C.per[spec.i];
          let md = 99, mm = 99;
          for (const c of mine) { if (c.soft) { mm = Math.min(mm, mastD(p, c)); if (dist(p, c) < R + 0.03) out.touchedMast = true; } else { md = Math.min(md, dist(p, c)); if (inside(p, c)) out.insideHull++; } }
          for (const q of C.per) for (const c of q) if (!c.soft && inside(p, c)) { out.insideAnyHull++; break; }
          if (mm < 0.4) out.mastClose++;
          if (d.crashes > cBefore) { (out.crashLog = out.crashLog || []).push({ f: s, boatGap: +md.toFixed(2), mast: +mm.toFixed(2), y: +p.y.toFixed(2), loss: d.lastCrash ? +d.lastCrash.loss.toFixed(1) : null, top: d.lastCrash ? +d.lastCrash.wallTop.toFixed(2) : null }); }
          const ov = R - md; if (ov > out.maxOverlap) out.maxOverlap = +ov.toFixed(3);
          const touching = md < R + 0.03;
          if (touching) { out.touched = true; out.contactFrames++; run++; out.longestContact = Math.max(out.longestContact, run); if (out.firstContact == null) { out.firstContact = s; out.vBefore = +Math.max(...sp.slice(-6, -1).concat([0])).toFixed(1); pos0 = { ...p }; } }
          else run = 0;
          if (out.firstContact != null && s === out.firstContact + 18) out.vAfter = +d.player.speed.toFixed(1);
          if (spec.mode === 'ram' && out.firstContact != null && s === out.firstContact + 21) G.key('KeyW', false); // a player lets go after the hit
          out.minY = Math.min(out.minY, p.y); out.maxY = Math.max(out.maxY, p.y);
          if (out.firstContact != null) out.maxDrop = Math.max(out.maxDrop, +(pos0.y - p.y).toFixed(2));
          if (spec.stopAfterContact != null && out.firstContact != null && s >= out.firstContact + spec.stopAfterContact) { G.advance(1 / 60, true); break; }
        }
        G.key('KeyW', false);
        const d = G.diagnostics(); out.crashes = d.crashes - c0; out.bumps = (d.contact?.bump ?? 0) - bump0; out.lastCrash = out.crashes ? d.lastCrash : null;
        const p = d.player.position; const C = colsOf(); let md = 99; for (const c of C.per[spec.i]) if (!c.soft) md = Math.min(md, dist(p, c));
        out.endGap = +md.toFixed(2); out.endSpeed = +d.player.speed.toFixed(1); out.endY = +p.y.toFixed(2);
        if (pos0) out.pushed = +Math.hypot(p.x - pos0.x, p.z - pos0.z).toFixed(1);
        out.stuck = spec.mode === 'press' ? false : (out.longestContact > (spec.mode === 'ram' ? 111 : 180) || (spec.stopAfterContact == null && md < R + 0.03 && b.moving)); out.pinned = spec.mode === 'press' ? out.longestContact : null;
        out.minY = +out.minY.toFixed(2); out.maxY = +out.maxY.toFixed(2);
        // park the drone away from the water between runs
        for (let k = 0; k < 3; k++) { G.place(0, 60, 0, 0, 0); G.advance(1 / 60, false); }
        return out;
      },
    };
  });
  const boats = await page.evaluate(() => window.__GAME__.boats().map((b, i) => ({ i, kind: b.kind, moving: b.moving, len: b.len })));
  const specs = [];
  const order = [...boats.filter((b) => b.kind === 'ferry'), ...boats.filter((b) => b.kind !== 'ferry')];
  const reach = await page.evaluate(() => { const B = window.__GAME__.boats(); return B.map((b) => Math.max(Math.abs(b.x), Math.abs(b.z)) - b.beam / 2); });
  const lim = await page.evaluate(() => { const G = window.__GAME__; for (let k = 0; k < 3; k++) { G.place(0, 60, 0, 0, 0); G.advance(1 / 60, false); } let x = 150; for (let k = 0; k < 600; k++) { G.key('KeyW', true); G.place(Math.max(x, G.diagnostics().player.position.x), 3, 0, Math.PI / 2 * -1, 17); G.advance(1 / 60, false); x = G.diagnostics().player.position.x; } G.key('KeyW', false); return +x.toFixed(1); });
  console.log('FLIGHT-LIMIT', SEED, lim, 'boat inner edge', JSON.stringify(boats.map((b, k) => [b.kind, b.moving, +reach[k].toFixed(1)])));
  for (const b of order) {
    if (b.moving && b.kind !== 'ferry' && reach[b.i] > 200) { console.log('SKIP', SEED, b.i, b.kind, 'beyond the flight limit', +reach[b.i].toFixed(1)); continue; }
    const sides = [1, -1];
    if (b.kind === 'ferry') {
      for (const side of sides) { specs.push({ i: b.i, mode: 'ram', y: 2.0, side }); specs.push({ i: b.i, mode: 'ram', y: 1.0, side }); }
      specs.push({ i: b.i, mode: 'ram', y: 2.0, side: 1, off: 6.5 }); // near the bow
      specs.push({ i: b.i, mode: 'slow', y: 2.0, side: 1 });
      specs.push({ i: b.i, mode: 'hover', y: 2.0, side: 1 }); specs.push({ i: b.i, mode: 'hover', y: 1.0, side: 1 }); specs.push({ i: b.i, mode: 'press', y: 2.0, side: 1 });
    } else if (b.kind === 'sail') {
      for (const side of sides) { specs.push({ i: b.i, mode: 'ram', y: 3.0, side }); specs.push({ i: b.i, mode: 'ram', y: 0.9, side }); }
      specs.push({ i: b.i, mode: 'slow', y: 3.0, side: 1 });
      if (b.moving) { specs.push({ i: b.i, mode: 'hover', y: 3.0, side: 1 }); specs.push({ i: b.i, mode: 'press', y: 3.0, side: 1 }); specs.push({ i: b.i, mode: 'hover', y: 0.9, side: 1 }); }
    } else {
      for (const side of sides) specs.push({ i: b.i, mode: 'ram', y: 0.9, side });
      specs.push({ i: b.i, mode: 'slow', y: 0.9, side: 1 });
      if (b.moving) specs.push({ i: b.i, mode: 'hover', y: 0.9, side: 1 });
    }
  }
  for (const s of specs.filter((q) => q.mode === 'hover')) { const r = await page.evaluate((s) => window.__bt.run(s), s); all.push(r); console.log('TRACE', r.seed, r.kind, r.y, 'boat', r.boatSpeed, 'peakV', r.peakV, 'peakEff', r.peakEff, JSON.stringify(r.trace)); }
  if (false) {
    const bus = boats.find((b) => b.kind === 'ferry'); const sail = boats.find((b) => b.kind === 'sail' && b.moving); const ms = boats.find((b) => b.kind === 'sail' && !b.moving);
    for (const [nm, s] of [['bus-ram', { i: bus.i, mode: 'ram', y: 2.0, side: 1, stopAfterContact: 2 }], ['bus-hits-drone', { i: bus.i, mode: 'hover', y: 2.0, side: 1, stopAfterContact: 20 }], ['bus-hits-drone-late', { i: bus.i, mode: 'hover', y: 2.0, side: 1, stopAfterContact: 70 }],
      ['sail-mast', { i: sail.i, mode: 'ram', y: 3.0, side: 1, stopAfterContact: 3 }], ['sail-low', { i: sail.i, mode: 'ram', y: 0.9, side: 1, stopAfterContact: 4 }], ['moored-sail-mast', { i: ms.i, mode: 'ram', y: 3.0, side: 1, stopAfterContact: 3 }], ['moored-sail-low', { i: ms.i, mode: 'ram', y: 0.9, side: 1, stopAfterContact: 6 }], ['moored-rib-low', { i: boats.find((b) => b.kind === 'rib' && !b.moving).i, mode: 'slow', y: 0.9, side: 1, stopAfterContact: 10 }]]) {
      await page.evaluate((s) => { const bt = window.__bt; const G = window.__GAME__; const orig = G.place; let parked = false; G.place = (x, y, z, yaw, sp) => { if (y === 60 && x === 0 && z === 0) { parked = true; return; } return orig(x, y, z, yaw, sp); }; try { bt.run(s); } finally { G.place = orig; } G.advance(1 / 60, true); }, s);
      await page.screenshot({ path: OUT + `boats33-${SEED}-${nm}.jpg`, type: 'jpeg', quality: 80 });
      await page.evaluate(() => { const G = window.__GAME__; for (let k = 0; k < 3; k++) { G.place(0, 60, 0, 0, 0); G.advance(1 / 60, false); } });
    }
  }
  if (errs.length) console.log('ERRS', SEED, JSON.stringify(errs.slice(0, 5)));
  await page.close();
}
// summary
const S = (f) => all.filter(f);
const sum = (rows, label) => { const t = rows.filter((r) => r.touched); console.log(label, JSON.stringify({ n: rows.length, touched: t.length, crashes: rows.reduce((a, r) => a + r.crashes, 0), withCrash: rows.filter((r) => r.crashes > 0).length, multiCrash: rows.filter((r) => r.crashes > 1).length, insideHull: rows.reduce((a, r) => a + r.insideAnyHull, 0), mastClose: rows.reduce((a, r) => a + r.mastClose, 0), maxOverlap: Math.max(0, ...rows.map((r) => r.maxOverlap)), stuck: rows.filter((r) => r.stuck).length, maxDrop: Math.max(0, ...rows.map((r) => r.maxDrop)), minY: Math.min(...rows.map((r) => r.minY)), longestContact: Math.max(0, ...rows.map((r) => r.longestContact)) })); };
sum(all, 'ALL');
sum(S((r) => r.moving), 'MOVING'); sum(S((r) => !r.moving), 'MOORED');
for (const k of ['ferry', 'sail', 'rib', 'row']) for (const m of ['ram', 'slow', 'hover', 'press']) { const rows = S((r) => r.kind === k && r.mode === m); if (rows.length) sum(rows, `${k}-${m}`); }
sum(S((r) => r.kind === 'sail' && r.y === 3.0 && r.mode === 'ram'), 'sail-mast-ram');
sum(S((r) => r.kind === 'ferry' && r.mode === 'ram'), 'bus-ram-all');
const hv = all.filter((r) => r.mode === 'hover' && r.touched);
for (const r of hv) console.log('HOVERPEAK', r.seed, r.kind, r.y, 'boat', r.boatSpeed, 'peakV', r.peakV, 'peakEff', r.peakEff, 'peakSide', r.peakSide, 'over cap', +(Math.max(r.peakV, r.peakEff) - (r.boatSpeed + 2)).toFixed(2));
for (const r of all.filter((r) => r.kind === 'ferry' && r.mode === 'ram' && r.touched)) console.log('BUSRAM', r.seed, 'y', r.y, 'side', r.side, 'crashes', r.crashes, 'maxY', r.maxY, 'vBefore', r.vBefore, 'vAfter', r.vAfter, 'peakV', r.peakV, 'peakEff', r.peakEff);
for (const r of all.filter((r) => r.mode === 'ram' && r.touched)) if (r.peakEff > r.vBefore + 0.5) console.log('RAMGAIN', r.seed, r.kind, r.y, 'vBefore', r.vBefore, 'peakEff', r.peakEff, 'peakV', r.peakV);
await browser.close();
