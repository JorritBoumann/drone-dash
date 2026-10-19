// Round 39 builder: attitude and speed camera, fixed step (60 Hz). Flies a scripted sequence over an open road and logs
// pitch, roll, acceleration, yaw rate, FOV, camera distance and streak level every frame. Prints peaks, hover jitter and
// correlations; SHOTS=1 saves JPEGs at chosen moments.
// env: PORT (5191), SEED (22), MOBILE, SHOTS, OUT (shots dir), TAG
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
const PORT = process.env.PORT || '5191', SEED = process.env.SEED || '22', TAG = process.env.TAG || 'r39';
const OUT = process.env.OUT || new URL('../critic/', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = process.env.MOBILE ? await browser.newContext({ ...devices['iPhone 13 landscape'] }) : await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.evaluate(() => { window.__GAME__.start(); window.__GAME__.manualRender(true); window.__GAME__.tune({ RUN: { startTime: 999 } }); });
// open road: z = 22 runs along x; start at the west end heading east (+x), 12 m up
const start = await page.evaluate(() => { const G = window.__GAME__; G.place(-150, 12, 22, -Math.PI / 2, 0); return G.advance(0.5).player.position; });
console.log('start', JSON.stringify(start));
const rows = [];
const keys = new Set();
async function seg(name, dur, down = []) {
  for (const k of [...keys]) if (!down.includes(k)) { await page.evaluate((k) => window.__GAME__.key(k, false), k); keys.delete(k); }
  for (const k of down) if (!keys.has(k)) { await page.evaluate((k) => window.__GAME__.key(k, true), k); keys.add(k); }
  const n = Math.round(dur * 60);
  const r = await page.evaluate(([n, name]) => {
    const G = window.__GAME__, out = [];
    for (let i = 0; i < n; i++) {
      const d = G.advance(1 / 60, i === n - 1);
      const f = d.feel;
      out.push({ seg: name, sp: +d.player.speed.toFixed(2), y: +d.player.position.y.toFixed(2), accF: +f.accF.toFixed(2), thr: f.thrust, yr: +f.yawRate.toFixed(3), pitch: +f.pitch.toFixed(2), roll: +f.roll.toFixed(2), tiltX: +f.tiltX.toFixed(2), tiltZ: +f.tiltZ.toFixed(2), cargoX: +f.cargoX.toFixed(2), fov: +f.camFov.toFixed(2), dist: +f.camDist.toFixed(2), arm: +f.camAccLag.toFixed(2), pull: +f.camBoostPull.toFixed(2), croll: +f.camRoll.toFixed(2), streak: +f.streaks.toFixed(3), smear: +f.smear.toFixed(2), tum: +f.tumble.toFixed(2), boosting: d.player.boosting });
    }
    return out;
  }, [n, name]);
  rows.push(...r);
  return r;
}
async function shot(name) {
  if (!process.env.SHOTS) return;
  await page.evaluate(() => window.__GAME__.advance(1 / 60, true));
  await page.screenshot({ path: `${OUT}${TAG}-${process.env.MOBILE ? 'm' : 'd'}-${name}.jpg`, type: 'jpeg', quality: 80 });
}
await seg('hover', 2.5);
await shot('hover');
await seg('accel', 0.35, ['KeyW']); await shot('accel-0.35s');
await seg('accel', 1.15, ['KeyW']);
await seg('cruise', 1.5, ['KeyW']); await shot('cruise');
await seg('brake', 0.35, ['KeyS']); await shot('brake-0.35s');
await seg('brake', 0.6, ['KeyS']);
await seg('settle', 1.5);
// hard turns at cruise speed (back west on the next leg: a right turn then a left turn keeps the drone near the road)
await seg('cruise2', 1.5, ['KeyW']);
await seg('turnR', 0.5, ['KeyW', 'KeyD']); await shot('turn-right');
await seg('turnR', 0.4, ['KeyW', 'KeyD']);
await seg('straight', 0.8, ['KeyW']);
await seg('turnL', 0.9, ['KeyW', 'KeyA']);
await seg('straight', 0.6, ['KeyW']);
// boost run along the road
await page.evaluate(() => { const G = window.__GAME__; G.place(-150, 12, 22, -Math.PI / 2, 12); G.advance(0.2); });
await seg('boost', 0.5, ['KeyW', 'KeyE']); await shot('boost-0.5s');
await seg('boost', 2.0, ['KeyW', 'KeyE']); await shot('boost-top');
await seg('coast', 2.0, ['KeyW']);
await seg('hover2', 2.5);
// parcel swing: pick up the first parcel (hover on the pickup pad), then accelerate and brake on the road
const carrying = await page.evaluate(() => { const G = window.__GAME__; for (let i = 0; i < 40; i++) { const d = G.diagnostics(); if (d.player.carrying) return true; const o = d.objective.position; G.place(o.x, o.y + 1.2, o.z, 0, 0); G.advance(0.25, false); } return G.diagnostics().player.carrying; });
console.log('carrying', carrying);
await page.evaluate(() => { const G = window.__GAME__; G.place(-150, 12, 22, -Math.PI / 2, 0); G.advance(1.5, false); });
await seg('cargoHover', 1.0);
await seg('cargoAccel', 1.4, ['KeyW']); await shot('cargo-accel');
await seg('cargoBrake', 1.0, ['KeyS']); await shot('cargo-brake');
await seg('cargoSettle', 2.0);
for (const k of keys) await page.evaluate((k) => window.__GAME__.key(k, false), k);
fs.writeFileSync(`${OUT}feel39-${TAG}-${process.env.MOBILE ? 'm' : 'd'}.json`, JSON.stringify(rows));
const corr = (a, b) => { const n = a.length, ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n; let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return sab / Math.sqrt(saa * sbb || 1); };
const by = (s) => rows.filter((r) => r.seg === s);
const max = (a, k) => Math.max(...a.map((r) => r[k])), min = (a, k) => Math.min(...a.map((r) => r[k]));
const hov = [...by('hover').slice(60), ...by('cargoHover').slice(20)];
const jit = (k) => { let m = 0; for (let i = 2; i < hov.length; i++) m = Math.max(m, Math.abs(hov[i][k] - 2 * hov[i - 1][k] + hov[i - 2][k])); return m; };
console.log(`hover: pitch ${min(hov, 'pitch')}..${max(hov, 'pitch')} roll ${min(hov, 'roll')}..${max(hov, 'roll')} deg, max 2nd difference pitch ${jit('pitch').toFixed(4)} roll ${jit('roll').toFixed(4)} deg/frame^2, fov ${min(hov, 'fov')}..${max(hov, 'fov')}`);
console.log(`accel from rest: nose-down peak ${(-min(by('accel'), 'pitch')).toFixed(1)} deg, speed ${max(by('accel'), 'sp')} m/s`);
console.log(`cruise (W held, 17 m/s): pitch ${by('cruise').slice(-1)[0].pitch} deg`);
console.log(`brake: nose-up peak ${max(by('brake'), 'pitch').toFixed(1)} deg; settle overshoot after brake: pitch min ${min(by('settle'), 'pitch')} deg`);
const clean = (a) => a.filter((r) => r.tum === 0);
console.log(`turns at cruise (rows without a crash tumble): roll right ${min(clean(by('turnR')), 'roll').toFixed(1)} deg, left ${max(clean(by('turnL')), 'roll').toFixed(1)} deg; crash tumble rows in the turns ${by('turnL').length + by('turnR').length - clean(by('turnL')).length - clean(by('turnR')).length}; cam roll ${min(by('turnR'), 'croll')}..${max(by('turnL'), 'croll')} deg`);
console.log(`boost: nose-down peak ${(-min(by('boost'), 'pitch')).toFixed(1)} deg, top speed ${max(by('boost'), 'sp')} m/s, fov ${max(by('boost'), 'fov')}, cam dist ${max(by('boost'), 'dist')} m, streak level ${max(by('boost'), 'streak')}`);
const flying = rows.filter((r) => !r.seg.startsWith('hover'));
// commanded longitudinal drive (the attitude model: thrust command and smoothed forward acceleration)
const drive = flying.map((r) => r.thr * 0.2 + Math.max(-1.5, Math.min(1.5, r.accF / 26)) * 0.1);
console.log(`correlation pitch vs -forward accel (smoothed): ${corr(flying.map((r) => r.pitch), flying.map((r) => -r.accF)).toFixed(3)}; pitch vs -(thrust command + accel drive): ${corr(flying.map((r) => r.pitch), drive.map((x) => -x)).toFixed(3)}`);
console.log(`correlation roll vs yaw rate x speed: ${corr(flying.map((r) => r.roll), flying.map((r) => r.yr * Math.min(1, 0.3 + 0.7 * r.sp / 17))).toFixed(3)}`);
console.log(`fov vs speed: corr ${corr(rows.map((r) => r.fov), rows.map((r) => r.sp)).toFixed(3)}; fov range ${min(rows, 'fov')}..${max(rows, 'fov')}; streaks on (>0.1) at speeds ${Math.min(...rows.filter((r) => r.streak > 0.1).map((r) => r.sp))}+ m/s; streak at <=19 m/s max ${Math.max(0, ...rows.filter((r) => r.sp <= 19 && !r.seg.startsWith('coast')).map((r) => r.streak))}`);
console.log(`parcel swing (deg, + = forward of plumb): accelerating ${min(by('cargoAccel'), 'cargoX')}..${max(by('cargoAccel'), 'cargoX')}, braking ${min(by('cargoBrake'), 'cargoX')}..${max(by('cargoBrake'), 'cargoX')}, settle ${min(by('cargoSettle'), 'cargoX')}..${max(by('cargoSettle'), 'cargoX')}, end ${by('cargoSettle').slice(-1)[0]?.cargoX}`);
console.log('table: speed band -> mean fov, mean cam dist');
for (const [a, b] of [[0, 2], [2, 8], [8, 14], [14, 18], [18, 24], [24, 40]]) { const s = rows.filter((r) => r.sp >= a && r.sp < b); if (s.length) console.log(`  ${a}-${b} m/s: n ${s.length}, fov ${(s.reduce((q, r) => q + r.fov, 0) / s.length).toFixed(1)}, dist ${(s.reduce((q, r) => q + r.dist, 0) / s.length).toFixed(2)}`); }
await browser.close();
