// Deterministic (manualRender + advance) probe of the arrival help.
// Autopilot flies each leg to the commit point: target within 10 m horizontally and drone >= 3 m above it.
// Then one of three player behaviours is applied, rotating per leg:
//   H  hands-off: hold descend only, no steering.
//   A  abort: hold descend and fly AWAY from the pad (turn to face away, hold W).
//   N  nothing: release every key and hover.
// Logs whether the pad still triggers, how long it took, and how far the drone moved toward the pad.
// Also logs camera pitch rate and camera-to-drone distance during final approach (< 30 m).
import { chromium } from '@playwright/test';
const OUT = '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/r30out/';
const browser = await chromium.launch({ channel: 'chromium' });
const seeds = (process.env.SEEDS || '11,22,33,44,7,58,91,130').split(',');
const res = []; const camStats = { n: 0, close: 0, minDist: 99, pitchRates: [], yawRates: [] };
let shots = 0;
for (const seed of seeds) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto('http://127.0.0.1:5190/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  await page.evaluate(() => { window.__GAME__.start(); window.__GAME__.manualRender(true); });
  const held = new Set();
  const key = async (k, on) => { if (on && !held.has(k)) { held.add(k); await page.evaluate((k) => window.__GAME__.key(k, true), k); } if (!on && held.has(k)) { held.delete(k); await page.evaluate((k) => window.__GAME__.key(k, false), k); } };
  const step = (s, r = false) => page.evaluate(([s, r]) => JSON.parse(JSON.stringify(window.__GAME__.advance(s, r))), [s, r]);
  let d = await step(0.05); let legIdx = 0; let mode = null, commit = null; let simT = 0; let prevPitch = null, prevYaw = null;
  let legKey = d.objective.phase + d.objective.name; let unstick = 0, hist = []; let blocked = null;
  while (simT < 140 && d.state === 'playing') {
    const p = d.player.position, c = d.camera, o = d.objective.position;
    const hd = Math.hypot(o.x - p.x, o.z - p.z);
    const k = d.objective.phase + d.objective.name;
    if (k !== legKey) { if (commit) res.push({ seed, mode: commit.mode, ty: commit.ty, hd0: commit.hd0, above0: commit.above0, triggered: true, t: +(simT - commit.t).toFixed(2) }); commit = null; legKey = k; legIdx++; hist = []; }
    // camera stats during final approach
    const cd = Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z);
    const pitch = Math.atan2(c.y - p.y, Math.hypot(c.x - p.x, c.z - p.z)); const yaw = Math.atan2(p.x - c.x, p.z - c.z);
    if (hd < 30) { camStats.n++; if (cd < 2.5) camStats.close++; camStats.minDist = Math.min(camStats.minDist, cd); if (prevPitch != null) { camStats.pitchRates.push(Math.abs(pitch - prevPitch) / 0.05); let dy = yaw - prevYaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; camStats.yawRates.push(Math.abs(dy) / 0.05); } }
    prevPitch = pitch; prevYaw = yaw;
    let err = Math.atan2(o.x - p.x, o.z - p.z) - Math.atan2(p.x - c.x, p.z - c.z); while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
    if (!commit && blocked !== k && hd < 10 && p.y - o.y >= 3) {
      commit = { mode: 'HAN'[legIdx % 3], t: simT, hd0: +hd.toFixed(1), above0: +(p.y - o.y).toFixed(1), ty: +o.y.toFixed(1), minHd: hd };
      if (shots < 6) { shots++; await step(0.0001, true); await page.screenshot({ path: OUT + `P-seed${seed}-commit-${commit.mode}.jpg`, type: "jpeg", quality: 80 }); }
    }
    if (commit) {
      commit.minHd = Math.min(commit.minHd, hd);
      for (const kk of ['KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space', 'KeyE', 'ShiftLeft']) await key(kk, false);
      if (commit.mode === 'H') await key('ShiftLeft', true);
      if (commit.mode === 'A') { await key('ShiftLeft', true); const away = err > 0 ? err - Math.PI : err + Math.PI; await key('KeyD', away < -0.2); await key('KeyA', away > 0.2); await key('KeyW', Math.abs(away) < 1.2); }
      if (simT - commit.t > 8) { res.push({ seed, mode: commit.mode, ty: commit.ty, hd0: commit.hd0, above0: commit.above0, triggered: false, minHd: +commit.minHd.toFixed(1), hdEnd: +hd.toFixed(1), aboveEnd: +(p.y - o.y).toFixed(1) }); blocked = legKey; commit = null; }
      d = await step(0.05); simT += 0.05; continue;
    }
    hist.push([simT, hd]); while (hist.length && hist[0][0] < simT - 3) hist.shift();
    if (unstick <= 0 && hist.length > 20 && Math.abs(hist[0][1] - hd) < 1 && hd > 3) unstick = 1.5;
    if (unstick > 0) { unstick -= 0.05; for (const kk of ['KeyW', 'KeyA', 'KeyD', 'ShiftLeft', 'KeyE']) await key(kk, false); await key('KeyS', true); await key('Space', true); d = await step(0.05); simT += 0.05; await key('KeyS', false); continue; }
    await key('KeyD', Math.abs(err) > 0.12 && err < 0); await key('KeyA', Math.abs(err) > 0.12 && err > 0);
    await key('KeyW', Math.abs(err) < 0.9 && !(hd < 14 && d.player.speed > 5));
    await key('KeyS', hd < 14 && d.player.speed > 7);
    const wantY = hd > 25 ? Math.max(o.y + 6, 40) : o.y + 8; // stay high so the commit happens from above
    await key('Space', p.y < wantY - 1.5); await key('ShiftLeft', p.y > wantY + 1.5 && hd > 10);
    await key('KeyE', hd > 60 && Math.abs(err) < 0.3 && d.player.boost > 0.3);
    d = await step(0.05); simT += 0.05;
  }
  await page.close();
}
for (const r of res) console.log(JSON.stringify(r));
for (const m of ['H', 'A', 'N']) { const s = res.filter((r) => r.mode === m); const t = s.filter((r) => r.triggered); const ts = t.map((r) => r.t).sort((a, b) => a - b); console.log(m, 'n', s.length, 'triggered', t.length, 'median t', ts[Math.floor(ts.length / 2)]); }
const q = (a, f) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length * f)]; };
console.log('cam samples <30m', camStats.n, 'cam<2.5m', camStats.close, 'min cam dist', camStats.minDist.toFixed(2), 'pitch rate rad/s p50/p95/max', q(camStats.pitchRates, 0.5).toFixed(2), q(camStats.pitchRates, 0.95).toFixed(2), Math.max(...camStats.pitchRates).toFixed(2), 'yaw rate p95/max', q(camStats.yawRates, 0.95).toFixed(2), Math.max(...camStats.yawRates).toFixed(2));
await browser.close();
