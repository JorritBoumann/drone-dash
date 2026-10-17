// Round 32 builder: boat collider probe. Per seed, fly the drone (fixed step 1/60, W held) into the 6 moving boats and the
// 4 moored boats from the beam, the bow and at mast / superstructure height: 10 runs into moving boats and 5 into
// moored ones (plus extra mast and dock runs). Per run: contact kind (crash = the game's crash counter went up,
// wall = wall contact under the crash threshold, skim = ledge hop / step-over, scrape = soft contact only, deck = landed
// on top, none = missed), frames with the drone centre inside a solid hull box, deepest overlap, and a stuck check
// (still touching a hull 1.5 s after first contact). Also counts drone heights under the flight floor (pushed into the sea).
import { chromium } from '@playwright/test';
const OUT = new URL('./out/', import.meta.url).pathname;
const SEEDS = (process.env.SEEDS || '22,58,130').split(',').map(Number);
const browser = await chromium.launch({ channel: 'chromium' });
let tot = { runs: 0, inside: 0, stuck: 0, none: 0, belowFloor: 0, kinds: {} };
for (const SEED of SEEDS) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('http://127.0.0.1:5190/?seed=' + SEED, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
  await page.waitForFunction(() => window.__GAME__.assetsReady().on && window.__GAME__.boats().length > 0, null, { timeout: 30000 });
  await page.evaluate(() => window.__GAME__.advance(2, false));
  const plan = [
    // [moving (m) or moored (o), which boat (index in that group, by kind), approach, altitude, label]
    // only the inner boats are inside the flight bounds (|x|, |z| < 190 soft, 215 hard): the lane-31 sailboats, the
    // harbour bus (lane 19) and the marina. Beam runs start on the island side of the boat.
    ['m', 'sail#0', 'beam', 1.0, 'sail hull low'], ['m', 'sail#0', 'beam', 3.6, 'sail mast'], ['m', 'sail#1', 'beam', 1.6, 'sail hull 2'],
    ['m', 'sail#1', 'beam', 4.2, 'sail mast 2'], ['m', 'ferry#0', 'beam', 1.4, 'bus deckhouse'], ['m', 'ferry#0', 'beam', 2.0, 'bus deckhouse high'],
    ['m', 'ferry#0', 'bow', 1.4, 'bus bow'], ['m', 'ferry#0', 'stern', 1.4, 'bus stern'], ['m', 'ferry#0', 'beam', 1.0, 'bus hull low'],
    ['m', 'sail#0', 'beam', 2.4, 'sail hull mid'],
    ['m', 'ferry#0', 'ram', 1.4, 'bus rams a hovering drone'], ['m', 'ferry#0', 'ramoff', 1.4, 'bus rams, drone 1 m off the centreline'], ['m', 'sail#0', 'ram', 2.0, 'sailboat rams a hovering drone'],
    ['o', 'sail#0', 'beam', 1.0, 'moored sail'], ['o', 'sail#0', 'beam', 3.6, 'moored sail mast'], ['o', 'row#0', 'beam', 1.0, 'moored row'],
    ['o', 'rib#0', 'bow', 1.0, 'moored rib'], ['o', 'row#1', 'beam', 1.0, 'moored row 2'],
  ];
  const res = await page.evaluate((plan) => {
    const G = window.__GAME__; const R = 0.95; const out = [];
    const solidBoxes = () => G.boatColliders().filter((c) => !c.soft);
    const overlap = (p) => { // deepest sphere overlap with a solid box, whether the centre is inside one, clearance
      let deep = 0, inside = false, clear = 99;
      for (const b of solidBoxes()) {
        const ox = p.x - b.x, oz = p.z - b.z; const lx = ox * b.c - oz * b.s, lz = ox * b.s + oz * b.c;
        if (Math.abs(lx) < b.hx && Math.abs(lz) < b.hz && p.y > b.y0 && p.y < b.y1) inside = true;
        const cx = Math.max(-b.hx, Math.min(lx, b.hx)), cy = Math.max(b.y0, Math.min(p.y, b.y1)), cz = Math.max(-b.hz, Math.min(lz, b.hz));
        const d = Math.hypot(lx - cx, p.y - cy, lz - cz); clear = Math.min(clear, d - R); deep = Math.max(deep, R - d);
      }
      return { deep, inside, clear };
    };
    const find = (grp, tag) => { const [kind, n] = tag.split('#'); return G.boats().filter((b) => (grp === 'm' ? b.moving : !b.moving) && b.kind === kind)[+n]; };
    for (const [grp, tag, app, alt, label] of plan) {
      if (app.startsWith('ram')) { // wait until the boat is under way
        for (let k = 0; k < 600 && !(find(grp, tag)?.speed > 2.5); k++) G.advance(1 / 20, false);
        const b = find(grp, tag); const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), px = Math.cos(b.yaw), pz = -Math.sin(b.yaw);
        const lat = app === 'ramoff' ? 1.0 : 0; const sx = b.x + fx * (b.len / 2 + 6) + px * lat, sz = b.z + fz * (b.len / 2 + 6) + pz * lat;
        const c0 = G.diagnostics().crashes ?? 0; const r = { label, kind: b.kind, moving: true, speed: +b.speed.toFixed(2), alt, ram: true, frames: 0, inside: 0, deep: 0, firstTouch: -1, wall: 0, ledge: 0, bump: 0, belowFloor: 0, crash: 0 };
        G.key('KeyW', false); G.place(sx, alt, sz, Math.atan2(fx, fz), 0);
        let maxCarry = 0, contactFrames = 0;
        for (let i = 0; i < 300; i++) {
          G.advance(1 / 60, false); r.frames++; const d = G.diagnostics(); const p = d.player.position; const o = overlap(p);
          if (o.inside) r.inside++; r.deep = Math.max(r.deep, o.deep); if (p.y < 0.84) r.belowFloor++;
          if (o.clear < 0.06) { contactFrames++; if (r.firstTouch < 0) r.firstTouch = i; if (i >= 240) r.lateContact = (r.lateContact || 0) + 1; }
          maxCarry = Math.max(maxCarry, Math.hypot(p.x - sx, p.z - sz));
          if (i === 240 || i === 299) { const bb = find(grp, tag); const ox = p.x - bb.x, oz = p.z - bb.z; (r.relZ = r.relZ || []).push(+(ox * Math.sin(bb.yaw) + oz * Math.cos(bb.yaw)).toFixed(2)); }
        }
        r.crash = (G.diagnostics().crashes ?? 0) - c0; r.contactS = +(contactFrames / 60).toFixed(2); r.pushedM = +maxCarry.toFixed(1);
        // stuck = carried: touching a hull for the whole last second while staying at the same place along the boat (< 1 m)
        r.stuck = (r.lateContact || 0) >= 60 && Math.abs(r.relZ[1] - r.relZ[0]) < 1; r.sepAfter = r.stuck ? 'stuck' : 'free';
        r.kindOf = r.crash > 0 ? 'crash' : r.firstTouch >= 0 ? 'nudged' : 'none'; r.deep = +r.deep.toFixed(3);
        out.push(r); G.advance(3, false); continue;
      }
      const b = find(grp, tag); if (!b) { out.push({ label, missingBoat: true }); continue; }
      const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), px = Math.cos(b.yaw), pz = -Math.sin(b.yaw);
      const D = 11, V = 12; const T = D / V; const bv = b.moving ? b.speed : 0;
      const aimX = b.x + fx * bv * T, aimZ = b.z + fz * bv * T;
      let dx, dz;
      if (app === 'beam') { // come from the island side
        const s1 = Math.hypot(aimX + px * D, aimZ + pz * D), s2 = Math.hypot(aimX - px * D, aimZ - pz * D);
        if (s1 < s2) { dx = -px; dz = -pz; } else { dx = px; dz = pz; }
      } else if (app === 'bow') { dx = -fx; dz = -fz; } else { dx = fx; dz = fz; }
      const off = app === 'beam' ? D : D + b.len / 2;
      const sx = aimX - dx * off, sz = aimZ - dz * off; const yaw = Math.atan2(-dx, -dz);
      const c0 = G.diagnostics().crashes ?? 0;
      G.key('KeyW', false); G.place(sx, alt, sz, yaw, V); G.advance(1 / 60, false); G.place(sx, alt, sz, yaw, V);
      const r = { label, kind: b.kind, moving: b.moving, speed: +bv.toFixed(2), alt, frames: 0, inside: 0, deep: 0, firstTouch: -1, wall: 0, ledge: 0, bump: 0, belowFloor: 0, crash: 0, sepAfter: null };
      G.key('KeyW', true);
      for (let i = 0; i < 150; i++) {
        G.advance(1 / 60, false); r.frames++;
        const d = G.diagnostics(); const p = d.player.position; const o = overlap(p);
        if (o.inside) r.inside++; r.deep = Math.max(r.deep, o.deep);
        if (p.y < 0.84) r.belowFloor++;
        const c = d.contact || {};
        const hit = o.clear < 0.06 || c.bump > 0 || c.ledge > 0 || c.wallLoss > 0;
        if (hit && r.firstTouch < 0) r.firstTouch = i;
        if (r.firstTouch >= 0 && i - r.firstTouch <= 40) { if (c.wallLoss > 0) r.wall = Math.max(r.wall, c.wallLoss); if (c.ledge > 0) r.ledge = Math.max(r.ledge, c.ledge); if (c.bump > 0) r.bump = Math.max(r.bump, c.bump); }
        if (r.firstTouch >= 0 && i - r.firstTouch === 20) G.key('KeyW', false);
        if (r.firstTouch >= 0 && i - r.firstTouch > 40) break;
      }
      G.key('KeyW', false);
      // the crash decision lands within CRASH.hitSpan; then the player tries to leave: climb (Space) for 1.5 s.
      // Stuck = the drone is not clear of every hull (0.15 m) by then, or it rose less than 1.5 m.
      const y0 = G.diagnostics().player.position.y; let sep = -1; G.key('Space', true);
      for (let i = 0; i < 90; i++) { G.advance(1 / 60, false); const o = overlap(G.diagnostics().player.position); if (o.inside) r.inside++; if (sep < 0 && o.clear > 0.15) sep = i; }
      G.key('Space', false);
      const fin = overlap(G.diagnostics().player.position), rose = G.diagnostics().player.position.y - y0;
      if (fin.clear < 0.15 || rose < 1.5) sep = -1;
      r.sepAfter = sep < 0 ? 'stuck' : +(sep / 60).toFixed(2);
      r.crash = (G.diagnostics().crashes ?? 0) - c0;
      r.stuck = sep < 0;
      r.kindOf = r.crash > 0 ? 'crash' : r.wall > 0 ? 'wall' : r.ledge > 0 ? 'skim' : r.bump > 0 ? 'scrape' : r.firstTouch >= 0 ? 'step' : 'none';
      r.deep = +r.deep.toFixed(3); r.wall = +r.wall.toFixed(2); r.ledge = +r.ledge.toFixed(2); r.bump = +r.bump.toFixed(2);
      out.push(r);
      G.advance(3, false); // let the crash window clear before the next run
    }
    return out;
  }, plan);
  for (const r of res) {
    if (r.missingBoat) { console.log('MISSING', SEED, r.label); continue; }
    tot.runs++; tot.inside += r.inside; tot.stuck += r.stuck ? 1 : 0; tot.none += r.kindOf === 'none' ? 1 : 0; tot.belowFloor += r.belowFloor; tot.kinds[r.kindOf] = (tot.kinds[r.kindOf] || 0) + 1;
    console.log('RUN', SEED, JSON.stringify(r));
  }
  if (SEED === SEEDS[0]) {
    // a shot of the drone against the ferry deckhouse and against a sailboat mast
    for (const [lab, kind, alt] of [['ferry', 'ferry', 2.6], ['mast', 'sail', 3.6]]) {
      await page.evaluate(([kind, alt]) => { const G = window.__GAME__; const b = G.boats().find((q) => q.kind === kind && q.moving); let px = Math.cos(b.yaw), pz = -Math.sin(b.yaw); if (Math.hypot(b.x + px * 9, b.z + pz * 9) > Math.hypot(b.x - px * 9, b.z - pz * 9)) { px = -px; pz = -pz; } const yaw = Math.atan2(px, pz); G.place(b.x + px * 9, alt, b.z + pz * 9, yaw, 10); G.key('KeyW', true); for (let i = 0; i < 70; i++) G.advance(1 / 60, i === 69); G.key('KeyW', false); }, [kind, alt]);
      await page.screenshot({ path: OUT + `boatcol32-${SEED}-${lab}.jpg`, type: 'jpeg', quality: 80 });
    }
  }
  if (errs.length) console.log('ERRS', SEED, errs.slice(0, 3));
  await page.close();
}
console.log('TOTAL', JSON.stringify(tot));
await browser.close();
