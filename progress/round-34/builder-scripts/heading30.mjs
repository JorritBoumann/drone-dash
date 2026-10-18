// Round 30 critic (new): does the camera point where the drone goes? Deterministic (manualRender, 60 Hz steps, G.key inputs),
// identical drone path on both builds (only CameraRig differs). Per frame: camera forward vs drone heading and travel
// direction, camera-to-drone bearing vs heading (what the street bot steers by, and what "line the marker up over the
// drone" means on screen), trail distance behind the drone, lateral offset, and screen x of drone vs heading vanishing point.
// PORT=5190 (round 30) or 5193 (round 29). MOBILE=1 for iPhone 13 landscape. SEED (default 58). ALT (default 25).
import { chromium, devices } from '@playwright/test';
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const MOBILE = !!process.env.MOBILE, PORT = process.env.PORT || '5190', SEED = +(process.env.SEED || 58), ALT = +(process.env.ALT || 25);
const TAG = (PORT === '5193' ? 'r29' : 'r30') + '-' + (MOBILE ? 'm' : 'd') + '-' + SEED + '-a' + ALT;
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } })).newPage();
await page.addInitScript(() => { try { localStorage.setItem('drone-dash-played-v1', '1'); } catch {} });
await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
const ok = await page.evaluate(async () => {
  const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /\/deps\/three\.js/.test(n));
  if (!url) return 'no three url';
  const T = await import(url); window.__T = T;
  const orig = T.Object3D.prototype.lookAt;
  T.Object3D.prototype.lookAt = function (...a) { if (this.isPerspectiveCamera && this.fov > 30) window.__cam = this; return orig.apply(this, a); };
  const G = window.__GAME__; G.tune({ RUN: { startTime: 999 } }); G.start(); G.manualRender(true);
  for (let i = 0; i < 30; i++) G.advance(1 / 60, true);
  return window.__cam ? 'ok' : 'no cam';
});
console.log('setup', ok);
// phases: [name, seconds, keys held]
const PH = [['climb', 2.5, ['Space']], ['hover', 1, []], ['boost', 5, ['KeyW', 'KeyE']], ['boostTurnL', 1.5, ['KeyW', 'KeyE', 'KeyA']], ['boostOut', 1.2, ['KeyW', 'KeyE']],
  ['cruise', 2, ['KeyW']], ['cruiseTurnR', 1.5, ['KeyW', 'KeyD']], ['cruiseOut', 1.2, ['KeyW']], ['brake', 2, ['KeyS']], ['hoverTurnL', 1.2, ['KeyA']], ['hoverOut', 1.5, []],
  ['launch', 2, ['KeyW']], ['zigL', 0.7, ['KeyW', 'KeyA']], ['zigR', 0.7, ['KeyW', 'KeyD']], ['zigL2', 0.7, ['KeyW', 'KeyA']], ['zigOut', 1.5, ['KeyW']]];
await page.evaluate(({ ALT }) => {
  const G = window.__GAME__; let d = window.__THREE_GAME_DIAGNOSTICS__; const p0 = d.player.position;
  for (let i = 0; i < 180; i++) { G.place(p0.x, ALT, p0.z, d.player.yaw, 0); G.advance(1 / 60, true); }
  window.__hs = { out: [], last: null };
}, { ALT });
const SHOTPH = ['boostTurnL', 'cruiseTurnR', 'hoverTurnL', 'zigR'];
for (const [name, secs, keys] of PH) {
  const n = Math.round(secs * 60), cut = SHOTPH.includes(name) ? Math.round(n * 0.6) : n;
  for (const [from, to] of [[0, cut], [cut, n]]) {
    if (to <= from) continue;
    await page.evaluate(({ name, keys, k0, k1 }) => {
      const G = window.__GAME__, T = window.__T, S = window.__hs; let d;
      for (const k of ['Space', 'KeyW', 'KeyE', 'KeyA', 'KeyD', 'KeyS']) G.key(k, keys.includes(k));
      const v = new T.Vector3(), fw = new T.Vector3(); const W = innerWidth;
      const ang = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
      for (let i = k0; i < k1; i++) {
        G.advance(1 / 60, true); d = window.__THREE_GAME_DIAGNOSTICS__;
        const p = d.player.position, c = window.__cam, yaw = d.player.yaw;
        const hx = -Math.sin(yaw), hz = -Math.cos(yaw); const headA = Math.atan2(hx, hz);
        c.getWorldDirection(fw); const fwdA = Math.atan2(fw.x, fw.z);
        const bearA = Math.atan2(p.x - c.position.x, p.z - c.position.z);
        const last = S.last; const vx = last ? (p.x - last.x) * 60 : 0, vz = last ? (p.z - last.z) * 60 : 0; const hs = Math.hypot(vx, vz);
        const velA = hs > 2 ? Math.atan2(vx, vz) : headA;
        const rx = c.position.x - p.x, rz = c.position.z - p.z;
        const behind = -(rx * hx + rz * hz), lateral = rx * hz - rz * hx;
        v.set(p.x, p.y, p.z).project(c); const dsx = (v.x * 0.5 + 0.5) * W;
        v.set(p.x + hx * 300, p.y, p.z + hz * 300).project(c); const vpx = v.z < 1 ? (v.x * 0.5 + 0.5) * W : NaN;
        // objective: true bearing from the drone vs where it shows on screen relative to the drone
        let tgt = null; const o = d.objective && d.objective.position;
        if (o) { const tA = ang(Math.atan2(o.x - p.x, o.z - p.z) - headA); v.set(o.x, o.y + 2.4, o.z).project(c); tgt = { trueDeg: +(tA * 57.3).toFixed(1), sx: v.z < 1 ? Math.round((v.x * 0.5 + 0.5) * W - dsx) : null }; }
        const L = Math.hypot(rx, c.position.y - p.y, rz);
        S.out.push({ ph: name, sp: +d.player.speed.toFixed(1), fwdErr: +(ang(fwdA - headA) * 57.3).toFixed(1), bearErr: +(ang(bearA - headA) * 57.3).toFixed(1), velFwd: +(ang(fwdA - velA) * 57.3).toFixed(1), velBear: +(ang(bearA - velA) * 57.3).toFixed(1), L: +L.toFixed(2), behind: +behind.toFixed(2), lat: +lateral.toFixed(2), dsx: Math.round(dsx - W / 2), vpx: Math.round(vpx - W / 2), y: +p.y.toFixed(1), tgt });
        S.last = { x: p.x, z: p.z };
      }
    }, { name, keys, k0: from, k1: to });
    if (to === cut && cut < n && process.env.SHOTS) await page.screenshot({ path: OUT + `heading30-${TAG}-${name}.jpg`, type: 'jpeg', quality: 80 });
  }
}
const rows = { out: await page.evaluate(() => window.__hs.out) };
const R = rows.out;
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const p95 = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length * 0.95)] : NaN; };
const summary = {};
for (const [name] of PH) {
  const r = R.filter((x) => x.ph === name); if (!r.length) continue;
  const f = (k) => r.map((x) => Math.abs(x[k]));
  summary[name] = { sp: med(r.map((x) => x.sp)), fwdErr: [med(f('fwdErr')), p95(f('fwdErr'))], bearErr: [med(f('bearErr')), p95(f('bearErr'))], velFwd: [med(f('velFwd')), p95(f('velFwd'))], velBear: [med(f('velBear')), p95(f('velBear'))], L: [med(r.map((x) => x.L)), Math.max(...r.map((x) => x.L))], behind: med(r.map((x) => x.behind)), lat: [med(f('lat')), p95(f('lat'))], dsxMinusVp: [med(r.map((x) => Math.abs(x.dsx - x.vpx)).filter((x) => !Number.isNaN(x))), p95(r.map((x) => Math.abs(x.dsx - x.vpx)).filter((x) => !Number.isNaN(x)))] };
}
console.log('HEADING', TAG, JSON.stringify(summary));
console.log('ROWS', TAG, JSON.stringify(R.filter((x, i) => i % 6 === 0)));
await browser.close();
