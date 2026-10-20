// Round 31 critic (new): boat routes over 120 s, fixed step (30 Hz, manualRender + advance), per seed.
// Per step: hull-hull overlap (oriented rectangles, SAT, with a 0.3 m margin), hull-dock overlap, hull distance to the
// seawall (from the game's own hullShore), solids under the hull (G.insideSolid at deck height), and the heave range.
// Also: pad, arch and site distances to the marina and lanes, and a drone fly-through of a sailboat (no collider?).
import { chromium } from '@playwright/test';
const OUT = (process.env.OUTDIR || new URL('../critic/', import.meta.url).pathname);
const SEEDS = (process.env.SEEDS || '22,58,4711').split(',').map(Number); const T = Number(process.env.T || 120);
const browser = await chromium.launch({ channel: 'chromium' });
for (const SEED of SEEDS) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto('http://127.0.0.1:5191/?seed=' + SEED, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
  await page.waitForFunction(() => window.__GAME__.assetsReady().on && window.__GAME__.boats().length > 0, null, { timeout: 30000 });
  const r = await page.evaluate((T) => {
    const G = window.__GAME__;
    const corners = (h, m = 0) => { const fx = Math.sin(h.yaw), fz = Math.cos(h.yaw), px = Math.cos(h.yaw), pz = -Math.sin(h.yaw); const o = []; for (const a of [-1, 1]) for (const c of [-1, 1]) o.push([h.x + fx * a * (h.hl + m) + px * c * (h.hb + m), h.z + fz * a * (h.hl + m) + pz * c * (h.hb + m)]); return [o[0], o[1], o[3], o[2]]; };
    const sat = (A, B) => { for (const P of [A, B]) for (let i = 0; i < 4; i++) { const a = P[i], b = P[(i + 1) % 4]; const nx = -(b[1] - a[1]), nz = b[0] - a[0]; let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity; for (const q of A) { const d = q[0] * nx + q[1] * nz; amin = Math.min(amin, d); amax = Math.max(amax, d); } for (const q of B) { const d = q[0] * nx + q[1] * nz; bmin = Math.min(bmin, d); bmax = Math.max(bmax, d); } if (amax < bmin || bmax < amin) return false; } return true; };
    const out = { steps: 0, hullHull: 0, hullDock: 0, minShore: Infinity, minShoreMoving: Infinity, inSolid: 0, minGap: Infinity, minGapPair: null, heave: [Infinity, -Infinity], keel: new Set(), firstHit: null, laneSpeeds: {} };
    const fp0 = G.boatFootprints();
    out.boats = fp0.hulls.map((h) => h.kind + (h.moving ? '' : '-moored')); out.docks = fp0.docks;
    const dt = 1 / 30;
    for (let s = 0; s < T * 30; s++) {
      G.advance(dt, false);
      const fp = G.boatFootprints(); const snap = G.boats(); out.steps++;
      const C = fp.hulls.map((h) => corners(h, 0.3));
      for (let i = 0; i < C.length; i++) {
        for (let j = i + 1; j < C.length; j++) {
          const gap = Math.hypot(fp.hulls[i].x - fp.hulls[j].x, fp.hulls[i].z - fp.hulls[j].z) - fp.hulls[i].hl - fp.hulls[j].hl;
          if (gap < out.minGap) { out.minGap = +gap.toFixed(2); out.minGapPair = [fp.hulls[i].kind, fp.hulls[j].kind, +(s / 30).toFixed(1)]; }
          if (gap < 2 && sat(C[i], C[j])) { out.hullHull++; if (!out.firstHit) out.firstHit = ['hull', i, j, s / 30]; }
        }
        for (const d of fp.docks) { const D = [[d.x - d.hx, d.z - d.hz], [d.x + d.hx, d.z - d.hz], [d.x + d.hx, d.z + d.hz], [d.x - d.hx, d.z + d.hz]]; if (sat(C[i], D)) { out.hullDock++; if (!out.firstHit) out.firstHit = ['dock', i, fp.hulls[i].kind, s / 30]; } }
        const b = snap[i]; out.minShore = Math.min(out.minShore, b.shore); if (b.moving) out.minShoreMoving = Math.min(out.minShoreMoving, b.shore);
        out.heave[0] = Math.min(out.heave[0], b.heave); out.heave[1] = Math.max(out.heave[1], b.heave); out.keel.add(b.kind + ':' + b.keel);
        if (s % 6 === 0) { for (const q of corners(fp.hulls[i])) if (G.insideSolid(q[0], 0.4, q[1], 0)) { out.inSolid++; break; } }
      }
    }
    out.keel = [...out.keel].slice(0, 8); out.minShore = +out.minShore.toFixed(2); out.minShoreMoving = +out.minShoreMoving.toFixed(2);
    out.heave = out.heave.map((v) => +v.toFixed(3));
    // what else lives near the water: sites (pads) and the marina
    const sites = G.sites(); let maxEdge = 0, nearMarina = [];
    for (const s of sites) { maxEdge = Math.max(maxEdge, Math.max(Math.abs(s.x), Math.abs(s.z))); if (s.z > 140 && s.x > -75 && s.x < -15) nearMarina.push([s.name, s.kind, +s.x.toFixed(1), +s.z.toFixed(1), +s.y.toFixed(1)]); }
    out.sites = { n: sites.length, maxEdge: +maxEdge.toFixed(1), nearMarina };
    const dg = window.__THREE_GAME_DIAGNOSTICS__; out.diagKeys = Object.keys(dg || {}).join(',');
    return out;
  }, T);
  // drone vs a sailboat: fly at mast height straight through the nearest moving sailboat (lane 30) and see if anything stops it
  const fly = await page.evaluate(() => {
    const G = window.__GAME__; const b = G.boats().find((q) => q.kind === 'sail' && q.moving);
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw); const px = Math.cos(b.yaw), pz = -Math.sin(b.yaw);
    // start 12 m to port, fly across the hull at 4 m (sail height)
    const sx = b.x + px * 12, sz = b.z + pz * 12; const yaw = Math.atan2(px, pz); // forward = (-sin yaw, -cos yaw) = (-px, -pz)
    const c0 = G.diagnostics().crashes ?? null; let minD = Infinity; const solid = [];
    for (let i = 0; i < 10; i++) { G.place(sx, 4, sz, yaw, 9); G.advance(1 / 60, false); }
    for (let i = 0; i < 120; i++) { G.key('KeyW', true); G.advance(1 / 60, false); const d = G.diagnostics(); const bb = G.boats().find((q) => q.kind === 'sail' && q.moving); const dd = Math.hypot(d.player.position.x - bb.x, d.player.position.z - bb.z); minD = Math.min(minD, dd); if (G.insideSolid(d.player.position.x, d.player.position.y, d.player.position.z, 0)) solid.push(i); }
    G.key('KeyW', false); const d = G.diagnostics();
    return { boat: [b.x, b.z], minDistToSailCentre: +minD.toFixed(2), crashesBefore: c0, crashesAfter: d.crashes ?? null, insideSolidFrames: solid.length, end: d.player.position };
  });
  console.log('BOATS', SEED, JSON.stringify(r));
  console.log('FLYTHRU', SEED, JSON.stringify(fly));
  if (SEED === SEEDS[0]) {
    // shot of the drone inside the sail: place drone at the sailboat, 4 m up, render the game camera
    await page.evaluate(() => { const G = window.__GAME__; for (let k = 0; k < 2; k++) { const b = G.boats().find((q) => q.kind === 'sail' && q.moving); const px = Math.cos(b.yaw), pz = -Math.sin(b.yaw); G.place(b.x + px * 0.3, 4.2, b.z + pz * 0.3, Math.atan2(px, pz) + 0.6, 0); G.advance(1 / 60, false); } for (let i = 0; i < 20; i++) { const b = G.boats().find((q) => q.kind === 'sail' && q.moving); const px = Math.cos(b.yaw), pz = -Math.sin(b.yaw); G.place(b.x + px * 0.3, 4.2, b.z + pz * 0.3, Math.atan2(px, pz) + 0.6, 0); G.advance(1 / 60, i === 19); } });
    await page.screenshot({ path: OUT + `boats31-${SEED}-drone-in-sail.jpg`, type: 'jpeg', quality: 80 });
  }
  await page.close();
}
await browser.close();
