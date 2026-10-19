// Round 39 builder: wall hits by impact angle and speed, fixed step (60 Hz). Finds tall block faces along the east-west
// roads (as wall-speed-sweep.mjs), then flies into each at angles ANGLES (deg, from the wall face) and speeds SPEEDS
// (m/s), W held or released, 10 m up. Per hit: charged (crash counter), crash seconds, scrape and impact counters, peak
// body tilt away from the flight attitude, camera shake, slow motion, live particles. 1.5 s idle between hits so the 1.2 s
// crash window never hides a charge.
// env: PORT (5191), SEED (22), FACES (4), Y (10), HOLD ("both" | "held" | "off")
import { chromium } from '@playwright/test';
const PORT = process.env.PORT || '5191', seed = process.env.SEED || '22', Y = Number(process.env.Y || 10), NF = Number(process.env.FACES || 4);
const ANGLES = (process.env.ANGLES || '5,10,15,20,24,27,30,45,60,90').split(',').map(Number);
const SPEEDS = (process.env.SPEEDS || '5,8,10,12,16,20,25,30').split(',').map(Number);
const HOLDS = process.env.HOLD === 'held' ? [true] : process.env.HOLD === 'off' ? [false] : [true, false];
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
await page.goto(`http://127.0.0.1:${PORT}/?seed=${seed}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
await page.evaluate(() => { window.__GAME__.start(); window.__GAME__.manualRender(true); window.__GAME__.tune({ RUN: { startTime: 9999 } }); });
const roads = [-154, -110, -66, -22, 22, 66, 110, 154];
const faces = [];
const BXS = []; for (let x = -130; x <= 130; x += 6) BXS.push(x);
outer: for (const rz of roads.slice(1)) for (const bx of BXS) {
  if (faces.some((f) => f.rz === rz && Math.abs(f.bx - bx) < 30)) continue; // one face per block side
  const face = await page.evaluate(([bx, rz, Y]) => {
    const G = window.__GAME__;
    for (let d = 5; d <= 20; d += 0.5) { G.place(bx, Y, rz - d, 0, 0); const r = G.advance(1 / 60, false); if (r.player.position.z > rz - d + 0.3) return r.player.position.z; }
    return null;
  }, [bx, rz, Y]);
  if (face == null) continue;
  // a tall, long, flat face: blocks at Y + 3 and along +-7 m of x at the same z (so a 5 degree slide stays on it)
  const ok = await page.evaluate(([bx, z, Y]) => {
    const G = window.__GAME__;
    for (const [dx, dy] of [[0, 2.5], [-5, 0], [5, 0], [-2.5, 0], [2.5, 0]]) { G.place(bx + dx, Y + dy, z - 0.6, 0, 0); const r = G.advance(1 / 60, false); if (!(r.player.position.z > z - 0.6 + 0.2) || Math.abs(r.player.position.x - bx - dx) > 0.2 || Math.abs(r.player.position.z - z) > 0.6) return `fail ${dx},${dy} -> ${r.player.position.x.toFixed(2)},${r.player.position.z.toFixed(2)}`; }
    return true;
  }, [bx, face, Y]);
  if (ok !== true) { if (process.env.DBG) console.log('face', bx, rz, face, ok); continue; }
  faces.push({ bx, rz, face });
  if (faces.length >= NF) break outer;
}
console.log('faces', JSON.stringify(faces));
const rows = [];
for (const f of faces) for (const hold of HOLDS) for (const ang of ANGLES) for (const v of SPEEDS) {
  const r = await page.evaluate(([f, ang, v, hold, Y]) => {
    const G = window.__GAME__;
    G.key('KeyW', false);
    { const q = G.diagnostics(); if (q.state !== 'playing') { G.restart(); G.manualRender(true); } }
    G.place(f.bx, Y, f.rz, 0, 0); G.advance(1.5, false);
    const th = ang * Math.PI / 180;
    // heading: along the wall (+x) and into it (-z); the wall face is at z = f.face - 0.95 (drone centre at contact: f.face)
    const yaw = Math.atan2(-Math.cos(th), Math.sin(th));
    const gap = 0.35 + 1.2 * Math.sin(th);
    const along = Math.cos(th) * gap / Math.max(Math.sin(th), 1e-3);
    G.place(f.bx - along, Y, f.face + gap, yaw, v);
    let d = G.advance(1 / 60, false);
    const b0 = d.breakdown.crashSeconds || 0, c0 = d.crashes, s0 = d.feel.scrapes, i0 = d.feel.impacts, fr0 = d.feel.freed, combo0 = d.combo;
    if (hold) G.key('KeyW', true);
    let impactV = 0, tilt = 0, shake = 0, slow = 0, parts = 0, hitAng = -1, scrapeMax = 0, wallLoss = 0, minSp = 99, crashP = -1;
    const p0 = d.feel.pitch, r0 = d.feel.roll;
    for (let i = 0; i < 60; i++) {
      d = G.advance(1 / 60, false);
      const fl = d.feel;
      tilt = Math.max(tilt, Math.abs(fl.tiltX - fl.pitch) + 0, Math.abs(fl.tiltZ - fl.roll), Math.abs(fl.pitch - p0) > 30 ? Math.abs(fl.pitch - p0) : 0, Math.abs(fl.roll - r0) > 30 ? Math.abs(fl.roll - r0) : 0);
      tilt = Math.max(tilt, Math.abs(fl.tiltX), Math.abs(fl.tiltZ));
      shake = Math.max(shake, fl.camShake); slow = Math.max(slow, fl.slowMo); parts = Math.max(parts, fl.particles);
      if (d.contact.hitAngle >= 0) hitAng = Math.max(hitAng, d.contact.hitAngle);
      scrapeMax = Math.max(scrapeMax, d.contact.scrape || 0); if (d.contact.hitAngle >= 0 || (d.contact.scrape || 0) > 0) impactV = Math.max(impactV, d.contact.bump || 0, d.contact.scrape || 0); wallLoss += d.contact.wallLoss || 0; minSp = Math.min(minSp, d.player.speed);
      if (crashP < 0 && d.crashes > c0) crashP = i;
    }
    G.key('KeyW', false);
    return { impactV: +impactV.toFixed(1), charged: d.crashes - c0, secs: +((d.breakdown.crashSeconds || 0) - b0).toFixed(2), comboAfter: d.combo, scrapes: d.feel.scrapes - s0, impacts: d.feel.impacts - i0, freed: d.feel.freed - fr0, tilt: +tilt.toFixed(1), shake: +shake.toFixed(2), slow: +slow.toFixed(3), parts, hitAng: +hitAng.toFixed(1), scrape: +scrapeMax.toFixed(1), wallLoss: +wallLoss.toFixed(1), endSp: +d.player.speed.toFixed(1), minSp: +minSp.toFixed(1), crashFrame: crashP };
  }, [f, ang, v, hold, Y]);
  rows.push({ bx: f.bx, rz: f.rz, ang, v, hold, ...r });
}
const fs = await import('node:fs');
fs.writeFileSync(new URL(`crash39-${seed}.json`, import.meta.url), JSON.stringify(rows));
console.log(`seed ${seed}, y ${Y} m, faces ${faces.length}, hits ${rows.length}`);
for (const hold of HOLDS) {
  console.log(`\nW ${hold ? 'held' : 'released'}: charged / hits (scrape contacts, impacts with tumble) per angle x speed`);
  console.log('angle  ' + SPEEDS.map((v) => String(v).padStart(9)).join(''));
  for (const ang of ANGLES) {
    const line = SPEEDS.map((v) => { const s = rows.filter((r) => r.hold === hold && r.ang === ang && r.v === v); return `${s.filter((r) => r.charged > 0).length}/${s.length}${s.some((r) => r.scrapes > 0) ? 's' : ' '}${s.some((r) => r.impacts > 0) ? 'i' : ' '}`.padStart(9); }).join('');
    console.log(String(ang).padStart(5) + '  ' + line);
  }
}
const glance = rows.filter((r) => r.ang < 25), head = rows.filter((r) => r.ang >= 60 && r.v > 8);
console.log(`\nunder 25 deg: ${glance.length} hits, charged ${glance.filter((r) => r.charged > 0).length}, crash seconds ${glance.reduce((s, r) => s + r.secs, 0)}, combo reset ${glance.filter((r) => r.comboAfter === 0 && r.charged > 0).length}, scrape feedback ${glance.filter((r) => r.scrapes > 0).length}, freed (round 38 rules would charge) ${glance.reduce((s, r) => s + r.freed, 0)}, mean speed kept ${(glance.reduce((s, r) => s + r.endSp / r.v, 0) / glance.length).toFixed(2)}`);
console.log(`60-90 deg over 8 m/s: ${head.length} hits, charged ${head.filter((r) => r.charged > 0).length}, with impact fx ${head.filter((r) => r.impacts > 0).length}, tilt min ${Math.min(...head.map((r) => r.tilt))} deg, shake min ${Math.min(...head.map((r) => r.shake))}, slow-mo ${head.filter((r) => r.slow > 0.1).length}, particles min ${Math.min(...head.map((r) => r.parts))}`);
for (const r of head.filter((r) => r.charged === 0)) console.log('head-on not charged', JSON.stringify(r));
// by actual impact speed into the wall (after drag on the run-up): head-on (60 to 90 deg) charged share per band
for (const [a, b] of [[0, 8], [8, 10], [10, 11], [11, 12], [12, 40]]) { const s = rows.filter((r) => r.ang >= 60 && r.impactV >= a && r.impactV < b); if (s.length) console.log(`head-on, impact ${a}-${b} m/s into the wall: ${s.length} hits, charged ${s.filter((r) => r.charged > 0).length}, impact fx ${s.filter((r) => r.impacts > 0).length}`); }
await browser.close();
