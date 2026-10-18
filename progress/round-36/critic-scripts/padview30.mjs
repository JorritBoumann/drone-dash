// Round 30 critic (new): which way does the camera look after a pickup or drop? Deterministic, 60 Hz steps. The drone
// glides in to the pad from 14 m out (4 approach headings per pad, 9 m/s, by placing it along the line), settles on the pad
// until the pickup / drop lands, then hovers 2 s with no keys and flies forward (W) 2 s. Per frame: camera-to-drone bearing
// and camera forward vs the drone's heading. A side-on or front-on camera after a pad means W does not go "up the screen".
// PORT=5191 (round 30) / 5192 (round 29). MOBILE=1 for iPhone 13 landscape.
import { chromium, devices } from '@playwright/test';
const MOBILE = !!process.env.MOBILE, PORT = process.env.PORT || '5191';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } })).newPage();
await page.addInitScript(() => { try { localStorage.setItem('drone-dash-played-v1', '1'); } catch {} });
const all = [];
for (const seed of (process.env.SEEDS || '22,58,130').split(',').map(Number)) {
  await page.goto(`http://127.0.0.1:${PORT}/?seed=${seed}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  const r = await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /\/deps\/three\.js/.test(n));
    const T = await import(url); const orig = T.Object3D.prototype.lookAt;
    T.Object3D.prototype.lookAt = function (...a) { if (this.isPerspectiveCamera && this.fov > 30) window.__cam = this; return orig.apply(this, a); };
    const G = window.__GAME__; G.tune({ RUN: { startTime: 999 } }); G.start(); G.manualRender(true);
    for (let i = 0; i < 30; i++) G.advance(1 / 60, true);
    const fw = new T.Vector3();
    const ang = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    const out = [];
    for (let ev = 0; ev < 8; ev++) {
      let d = window.__THREE_GAME_DIAGNOSTICS__; const o = d.objective.position; const c0 = d.player.carrying, n0 = d.deliveries;
      const dir = (ev % 4) * Math.PI / 2 + 0.3; // approach heading (yaw); forward = (-sin, -cos)
      const fx = -Math.sin(dir), fz = -Math.cos(dir);
      // start 14 m back along the approach, 2.5 m over the pad, camera settled behind
      for (let i = 0; i < 90; i++) { G.place(o.x - fx * 14, o.y + 2.5, o.z - fz * 14, dir, 0); G.advance(1 / 60, false); }
      for (let i = 0; i <= 93; i++) { const k = i / 93; G.place(o.x - fx * 14 * (1 - k), o.y + 2.5 - 1.6 * k, o.z - fz * 14 * (1 - k), dir, 9 * (1 - k)); G.advance(1 / 60, false); }
      let got = null;
      for (let i = 0; i < 400; i++) { G.place(o.x, o.y + 0.9, o.z, dir, 0); G.advance(1 / 60, false); d = window.__THREE_GAME_DIAGNOSTICS__; if (d.player.carrying !== c0 || d.deliveries !== n0) { got = { k: d.deliveries !== n0 ? 'drop' : 'pick', wall: G.insideSolid(o.x, o.y + 1, o.z, 4) }; break; } }
      if (!got) { out.push({ ev, none: true }); continue; }
      const rows = [];
      for (let i = 0; i < 240; i++) {
        G.key('KeyW', i >= 120); G.advance(1 / 60, false); d = window.__THREE_GAME_DIAGNOSTICS__;
        const p = d.player.position, c = window.__cam; c.updateMatrixWorld();
        const headA = Math.atan2(-Math.sin(d.player.yaw), -Math.cos(d.player.yaw));
        c.getWorldDirection(fw);
        rows.push([+(Math.abs(ang(Math.atan2(p.x - c.position.x, p.z - c.position.z) - headA)) * 57.3).toFixed(1), +(Math.abs(ang(Math.atan2(fw.x, fw.z) - headA)) * 57.3).toFixed(1), +Math.hypot(c.position.x - p.x, c.position.y - p.y, c.position.z - p.z).toFixed(2)]);
      }
      G.key('KeyW', false);
      out.push({ ev, ...got, bear: rows.map((r) => r[0]), fwd: rows.map((r) => r[1]), L: rows.map((r) => r[2]) });
    }
    return out;
  });
  for (const e of r) all.push({ seed, ...e });
}
const ev = all.filter((e) => !e.none);
const frames = ev.flatMap((e) => e.bear), fframes = ev.flatMap((e) => e.fwd);
const settle = ev.map((e) => { const i = e.bear.findIndex((b, k) => e.bear.slice(k).every((x) => x < 10)); return i < 0 ? 240 : i; });
const pct = (a, f) => +(100 * a.filter(f).length / a.length).toFixed(1);
console.log('PADVIEW', JSON.stringify({ port: PORT, mobile: MOBILE, events: ev.length, none: all.length - ev.length, wall: ev.filter((e) => e.wall).length,
  bearOver30: pct(frames, (x) => x > 30), bearOver60: pct(frames, (x) => x > 60), bearOver90: pct(frames, (x) => x > 90), fwdOver30: pct(fframes, (x) => x > 30),
  hoverBearMed: (() => { const a = ev.flatMap((e) => e.bear.slice(0, 120)).sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; })(),
  flyBearMed: (() => { const a = ev.flatMap((e) => e.bear.slice(120)).sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; })(),
  settleFramesMed: [...settle].sort((a, b) => a - b)[Math.floor(settle.length / 2)], settleMax: Math.max(...settle),
  perEvent: ev.map((e) => ({ s: e.seed, ev: e.ev, k: e.k, wall: e.wall, b0: e.bear[0], b30: e.bear[30], b60: e.bear[60], b119: e.bear[119], b150: e.bear[150], b239: e.bear[239], maxB: Math.max(...e.bear), minL: Math.min(...e.L) })) }));
await browser.close();
