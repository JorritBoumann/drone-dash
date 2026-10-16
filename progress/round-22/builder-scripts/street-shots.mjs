// Round 22 builder: street life shots and frame time. SEED (default 22), MOBILE=1 for iPhone 13 landscape, TAG (file prefix).
// 1. Street level (drone 3.5 m up on a road, looking down the street) and cruise height (30 m), still shots after 2 s.
// 2. RUSH=1: the same street shots with rush hour forced on (hook __GAME__.rush, round 22; skipped if missing).
// 3. Real-time frame times: 12 s flying down streets at 4 m (W held), then 8 s at 30 m. Reports median / p95 / max and draw calls.
import { chromium, devices } from '@playwright/test';
const MOBILE = !!process.env.MOBILE; const SEED = Number(process.env.SEED || 22); const TAG = process.env.TAG || 'after';
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const P = `${TAG}-${MOBILE ? 'm' : 'd'}-s${SEED}`;
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } })).newPage();
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://127.0.0.1:5190/?seed=${SEED}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
await page.evaluate(() => window.__GAME__.start()); await page.waitForTimeout(400);
const city = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.city);
// a street near the centre: the road at x = -22 running along z, looking +z (yaw PI) from z = -60
const spots = [
  { name: 'street', x: -22, y: 3.5, z: -40, yaw: Math.PI },
  { name: 'street2', x: 30, y: 4, z: 22, yaw: -Math.PI / 2 },
  { name: 'junction', x: -19.5, y: 2.2, z: 38, yaw: 0 },
  { name: 'cruise', x: -22, y: 30, z: -70, yaw: Math.PI },
];
const shoot = async (label) => {
  for (const s of spots) {
    await page.evaluate((s) => window.__GAME__.place(s.x, s.y, s.z, s.yaw, 0), s);
    await page.waitForTimeout(1800);
    await page.evaluate((s) => window.__GAME__.place(s.x, s.y, s.z, s.yaw, 0), s);
    await page.waitForTimeout(250);
    const info = await page.evaluate(() => {
      const d = window.__THREE_GAME_DIAGNOSTICS__; const g = window.__GAME__;
      // people in view: inside the camera's view cone (looking at the drone), within draw range, with a clear sight line
      // from the camera to their chest (25 samples against the solid colliders)
      let visible = 0, cone = 0;
      if (g.people) {
        const c = d.camera, p = d.player.position;
        const fx = p.x - c.x, fy = p.y - c.y, fz = p.z - c.z, fl = Math.hypot(fx, fy, fz);
        const vf = (c.fov * Math.PI) / 180 / 2, hf = Math.atan(Math.tan(vf) * c.aspect);
        for (const q of g.people()) {
          const vx = q.x - c.x, vy = q.y + 1.1 - c.y, vz = q.z - c.z, dist = Math.hypot(vx, vy, vz);
          if (dist > 104) continue;
          const along = (vx * fx + vy * fy + vz * fz) / fl; if (along <= 0.5) continue;
          // horizontal / vertical angles off the view axis (approximate: camera roll 0)
          const yawF = Math.atan2(fx, fz), yawV = Math.atan2(vx, vz); let dy = yawV - yawF; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
          const pitF = Math.atan2(fy, Math.hypot(fx, fz)), pitV = Math.atan2(vy, Math.hypot(vx, vz));
          if (Math.abs(dy) > hf * 0.98 || Math.abs(pitV - pitF) > vf * 0.98) continue;
          cone++;
          let clear = true;
          for (let k = 1; k < 25 && clear; k++) { const t = k / 25; if (g.insideSolid(c.x + vx * t, c.y + vy * t, c.z + vz * t, 0)) clear = false; }
          if (clear) visible++;
        }
      }
      return { calls: d.renderer.calls, tris: d.renderer.triangles, peopleInView: visible, peopleInCone: cone, street: d.street ?? null };
    });
    await page.screenshot({ path: `${OUT}${P}-${label}-${s.name}.jpg`, type: 'jpeg', quality: 82 });
    console.log('SHOT ' + JSON.stringify({ file: `${P}-${label}-${s.name}.jpg`, ...info }));
  }
};
if (!process.env.NOSHOTS) await shoot('normal');
if (process.env.RUSH) {
  const ok = await page.evaluate(() => { if (!window.__GAME__.rush) return false; window.__GAME__.rush(true); return true; });
  if (ok) { await page.waitForTimeout(9000); await shoot('rush'); await page.evaluate(() => window.__GAME__.rush(false)); }
}
// frame times. PARTS=none | traffic | people | all (default all): street life switched off for a cost comparison
const PARTS = process.env.PARTS || 'all';
await page.evaluate((P) => { if (window.__GAME__.streetLife) window.__GAME__.streetLife(P === 'all' || P === 'traffic', P === 'all' || P === 'people'); }, PARTS);
const msSamples = [];
await page.evaluate(() => { window.__ft = []; let last = performance.now(); const f = (t) => { window.__ft.push(t - last); last = t; window.__raf = requestAnimationFrame(f); }; window.__raf = requestAnimationFrame(f); });
const legs = [{ x: -22, y: 4, z: -150, yaw: Math.PI, t: 6000 }, { x: -150, y: 4, z: 22, yaw: -Math.PI / 2, t: 6000 }, { x: -22, y: 30, z: -150, yaw: Math.PI, t: 8000 }];
let calls = [];
for (const l of legs) {
  await page.evaluate((s) => window.__GAME__.place(s.x, s.y, s.z, s.yaw, 10), l);
  await page.keyboard.down('KeyW');
  for (let k = 0; k < l.t / 1000; k++) { await page.waitForTimeout(1000); calls.push(await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.renderer.calls)); msSamples.push(await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.street ? [window.__THREE_GAME_DIAGNOSTICS__.street.msTraffic, window.__THREE_GAME_DIAGNOSTICS__.street.msPeople] : [0, 0])); }
  await page.keyboard.up('KeyW');
}
const ft = await page.evaluate(() => { cancelAnimationFrame(window.__raf); return window.__ft.slice(3); });
const s = [...ft].sort((a, b) => a - b); const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
const d = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
const avg = (k) => +(msSamples.reduce((a, m) => a + m[k], 0) / Math.max(1, msSamples.length)).toFixed(3);
console.log('PERF ' + JSON.stringify({ tag: TAG, parts: PARTS, cpuMsTraffic: avg(0), cpuMsPeople: avg(1), mobile: MOBILE, seed: SEED, mood: city.mood, frames: ft.length, median: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), max: +s[s.length - 1].toFixed(1), over20: ft.filter((x) => x > 20).length, callsMin: Math.min(...calls), callsMax: Math.max(...calls), tris: d.renderer.triangles, crashes: d.crashes, errors }));
await browser.close();
