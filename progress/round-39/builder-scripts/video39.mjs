// Round 39 builder: short desktop videos of a scrape and of a head-on crash. Fixed step (60 Hz sim, every second frame
// captured, 30 fps), the real chase camera and HUD, then ffmpeg to MP4.
// env: SCENE (scrape | crash), PORT (5190), SEED (22), FRAMES dir, OUT mp4 path
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const PORT = process.env.PORT || '5190', SEED = process.env.SEED || '22', SCENE = process.env.SCENE || 'crash';
const FR = (process.env.FRAMES || '/tmp/v39') + `/${SCENE}/`;
const OUT = process.env.OUT || new URL(`../builder-shots/${SCENE}-desktop.mp4`, import.meta.url).pathname;
fs.rmSync(FR, { recursive: true, force: true }); fs.mkdirSync(FR, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.evaluate(() => { const G = window.__GAME__; G.start(); G.manualRender(true); G.tune({ RUN: { startTime: 999 } }); });
await page.waitForTimeout(1500); // the title card fades out in real time
// the wall: the block face on the south side of the z = 66 road at x = -52 (drone centre touches it at z = 57.93)
const FACE = Number(process.env.FACE || 57.93), BX = Number(process.env.BX || -52);
const plan = SCENE === 'speed'
  // 30 s on the long z = 22 road: hover, accelerate, boost, cruise, brake, turn round on the spot, accelerate, boost,
  // an S-bend at speed, brake
  // two 15 s runs on long straight roads (a cut between them): hover, accelerate, boost, coast, cruise with an S-bend, brake
  ? { start: [-150, 12, 22, -Math.PI / 2, 0], start2: [150, 12, -22, Math.PI / 2, 0], steps: [[0, 2, []], [2, 5, ['KeyW']], [5, 7, ['KeyW', 'KeyE']], [7, 9, []], [9, 10.2, ['KeyW']], [10.2, 10.35, ['KeyW', 'KeyA']], [10.35, 10.65, ['KeyW', 'KeyD']], [10.65, 10.8, ['KeyW', 'KeyA']], [10.8, 12, ['KeyW']], [12, 12.6, ['KeyS']], [12.6, 15, []]] }
  : SCENE === 'crash'
  ? { start: [BX, 10, 73.5, 0, 0], steps: [[0, 1.2, []], [1.2, 4.0, ['KeyW']], [4.0, 10, []]] }
  // along the road, 2.4 m off the wall, heading east; a short left turn angles it into the wall; W keeps it grinding;
  // a right turn takes it off again
  // (FACE, X0: the block face and the start; the turn in comes at TIN s, the grind lasts until TOUT s)
  : (() => { const X0 = Number(process.env.X0 || -85), TIN = Number(process.env.TIN || 1.5), TOUT = Number(process.env.TOUT || 3.2);
      return { start: [X0, 10, FACE + 2.4, -Math.PI / 2, 14], steps: [[0, TIN, ['KeyW']], [TIN, TIN + 0.22, ['KeyW', 'KeyA']], [TIN + 0.22, TOUT, ['KeyW']], [TOUT, TOUT + 0.25, ['KeyW', 'KeyD']], [TOUT + 0.25, TOUT + 0.5, ['KeyW']], [TOUT + 0.5, TOUT + 0.72, ['KeyW', 'KeyA']], [TOUT + 0.72, 6, ['KeyW']], [6, 8, ['KeyS']], [8, 10, []]] }; })();
let wall = null;
if (SCENE === 'scrape' && process.env.WALL) {
  // WALL = x0,x1,z: a straight block face (wallscan39.mjs), drone centre z at contact
  const [x0, x1, z] = process.env.WALL.split(',').map(Number);
  wall = { x0, x1, z, len: x1 - x0 };
  // already angled 10 degrees into the wall (no turn-in), so the contact is a clean glancing hit about 8 m along it
  const ang = Number(process.env.ANG || 10) * Math.PI / 180;
  const back = Number(process.env.BACK || 50);
  plan.start = [wall.x0 - back, 10, wall.z + (back + 8) * Math.tan(ang), -Math.PI / 2 + ang, 15];
} else if (SCENE === 'scrape') {
  // the longest straight block face along an east-west road (south side): the drone's pushed-out z at contact, every 2 m
  wall = await page.evaluate(() => {
    const G = window.__GAME__, Y = 10, best = { len: 0 };
    for (const rz of [-110, -66, -22, 22, 66, 110]) {
      const run = [];
      const flush = () => { if (run.length > 1) { const len = run[run.length - 1].x - run[0].x; if (len > best.len) Object.assign(best, { len, x0: run[0].x, x1: run[run.length - 1].x, z: run.reduce((s, r) => s + r.z, 0) / run.length, rz }); } run.length = 0; };
      for (let x = -150; x <= 150; x += 2) {
        let face = null;
        for (let d = 5; d <= 18; d += 0.5) { G.place(x, Y, rz - d, 0, 0); const r = G.advance(1 / 60, false); if (r.player.position.z > rz - d + 0.2 && Math.abs(r.player.position.x - x) < 0.05) { face = r.player.position.z; break; } }
        if (face != null) { G.place(x, Y + 3, face - 0.5, 0, 0); const t = G.advance(1 / 60, false); if (!(t.player.position.z > face - 0.3)) face = null; }
        if (face != null && run.length && Math.abs(face - run[0].z) > 0.15) flush();
        if (face != null) run.push({ x, z: face }); else flush();
      }
      flush();
    }
    return best;
  });
  console.log('wall', JSON.stringify(wall));
  plan.start = [wall.x0 - 28, 10, wall.z + 2.4, -Math.PI / 2, 14];
}
await page.evaluate((s) => { const G = window.__GAME__; G.place(...s); G.advance(1 / 60, false); }, plan.start);
// scrape: keys by position along the wall (turn in 2 m past its start, turn out 10 m before its end)
let phase = 'approach', phaseT = 0, lastX = plan.start[0], lastYaw = plan.start[3];
const scrapeKeys = (t, dt) => {
  phaseT += dt;
  const next = (p) => { phase = p; phaseT = 0; };
  if (phase === 'approach' && (process.env.WALL ? lastX > wall.x0 + 30 : lastX > wall.x0 - Number(process.env.LEAD || 6))) next('in');
  else if (phase === 'approach' && process.env.WALL && lastX > wall.x0) next('grind');
  else if (phase === 'in' && phaseT >= Number(process.env.TAP || 0.1)) next('grind');
  else if (phase === 'grind' && (lastX > wall.x1 - 6 || phaseT > 3)) next('out');
  else if (phase === 'out' && phaseT >= 0.15) next('straight');
  else if (phase === 'straight' && phaseT >= 0.25) next('level');
  else if (phase === 'level' && phaseT >= 0.12) next('run');
  else if (phase === 'run' && t >= 7.5) next('brake');
  return { approach: ['KeyW'], in: ['KeyW', 'KeyA'], grind: ['KeyW'], out: ['KeyW', 'KeyD'], straight: ['KeyW'], level: ['KeyW', 'KeyA'], run: ['KeyW'], brake: ['KeyS'] }[phase];
};
const held = new Set();
let n = 0;
const log = [];
const NF = SCENE === 'speed' ? 900 : 300;
for (let f = 0; f < NF; f++) {
  const t = f / 30;
  if (SCENE === 'speed' && f === 450) await page.evaluate((s) => { const G = window.__GAME__; G.place(...s); G.advance(1 / 60, false); }, plan.start2);
  const tt = SCENE === 'speed' ? t % 15 : t;
  let keys = SCENE === 'scrape' ? scrapeKeys(t, 1 / 30) : (plan.steps.find(([a, b]) => tt >= a && tt < b) || [0, 0, []])[2];
  // 'yaw:<rad>': turn on the spot toward that heading (A/D with a small dead band)
  const yk = keys.find((k) => k.startsWith('yaw:'));
  if (yk) { let e = Number(yk.slice(4)) - lastYaw; e = Math.atan2(Math.sin(e), Math.cos(e)); keys = Math.abs(e) < 0.05 ? [] : [e > 0 ? 'KeyA' : 'KeyD']; }
  for (const k of [...held]) if (!keys.includes(k)) { await page.evaluate((k) => window.__GAME__.key(k, false), k); held.delete(k); }
  for (const k of keys) if (!held.has(k)) { await page.evaluate((k) => window.__GAME__.key(k, true), k); held.add(k); }
  const d = await page.evaluate(() => { const G = window.__GAME__; G.advance(1 / 60, false); const d = G.advance(1 / 60, true); return { yaw: d.player.yaw, fov: d.feel.camFov, dist: d.feel.camDist, streaks: d.feel.streaks, pitch: d.feel.pitch, roll: d.feel.roll, camRoll: d.feel.camRoll, sp: d.player.speed, x: d.player.position.x, z: d.player.position.z, scrape: d.contact.scrape, crashes: d.crashes, scrapes: d.feel.scrapes, impacts: d.feel.impacts, tiltX: d.feel.tiltX, tiltZ: d.feel.tiltZ, shake: d.feel.camShake, slow: d.feel.slowMo, combo: d.combo, crashSecs: d.breakdown.crashSeconds }; });
  lastX = d.x; lastYaw = d.yaw;
  log.push({ phase, t: +t.toFixed(2), ...Object.fromEntries(Object.entries(d).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(2) : v])) });
  await page.screenshot({ path: FR + `f${String(n++).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 88 });
}
for (const k of held) await page.evaluate((k) => window.__GAME__.key(k, false), k);
fs.writeFileSync(OUT.replace(/\.mp4$/, '.json'), JSON.stringify(log));
const last = log[log.length - 1];
console.log(SCENE, 'crashes', last.crashes, 'scrapes', last.scrapes, 'impacts', last.impacts, 'crash seconds', last.crashSecs, 'peak tilt', Math.max(...log.map((r) => Math.max(Math.abs(r.tiltX), Math.abs(r.tiltZ)))), 'peak shake', Math.max(...log.map((r) => r.shake)));
for (const r of log.filter((r, i) => i % 6 === 0)) console.log(JSON.stringify(r));
await browser.close();
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', '30', '-i', FR + 'f%04d.jpg', '-c:v', 'libx264', '-preset', 'slow', '-crf', process.env.CRF || '25', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT]);
console.log('wrote', OUT, (fs.statSync(OUT).size / 1e6).toFixed(2), 'MB');
