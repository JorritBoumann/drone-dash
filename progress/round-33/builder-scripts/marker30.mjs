// Round 30 critic (new): a "human model" that steers only by what is on screen. Each 60 Hz step it projects the objective
// (where the nav marker is drawn: pad + 2.4 m) and the drone through the real render camera and turns until the marker
// sits over the drone (MODE=screen), or over the screen centre (MODE=centre). MODE=yaw is the baseline: it steers by the
// true bearing from the drone's own yaw. Same seed and legs on both builds; logs time per leg, turn reversals (weave) and
// the heading error at the moment the on-screen aim says "straight on".
// PORT=5191 (round 30) / 5192 (round 29). SEED (58). LEGS (6). MOBILE=1 for iPhone 13 landscape.
import { chromium, devices } from '@playwright/test';
const MOBILE = !!process.env.MOBILE, PORT = process.env.PORT || '5190', SEED = +(process.env.SEED || 58), LEGS = +(process.env.LEGS || 6), MODE = process.env.MODE || 'screen';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } })).newPage();
await page.addInitScript(() => { try { localStorage.setItem('drone-dash-played-v1', '1'); } catch {} });
await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
const res = await page.evaluate(async ({ LEGS, MODE }) => {
  const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /\/deps\/three\.js/.test(n));
  const T = await import(url); const orig = T.Object3D.prototype.lookAt;
  T.Object3D.prototype.lookAt = function (...a) { if (this.isPerspectiveCamera && this.fov > 30) window.__cam = this; return orig.apply(this, a); };
  const G = window.__GAME__; G.tune({ RUN: { startTime: 999 } }); G.start(); G.manualRender(true);
  for (let i = 0; i < 30; i++) G.advance(1 / 60, true);
  const v = new T.Vector3(); const W = innerWidth, H = innerHeight;
  const ang = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const legs = []; let d = window.__THREE_GAME_DIAGNOSTICS__;
  for (let leg = 0; leg < LEGS; leg++) {
    const key0 = d.objective.phase + d.objective.name + d.deliveries; let t = 0, flips = 0, lastTurn = 0, aligned = [], crashes0 = d.crashes || 0;
    let done = false;
    while (t < 90 && !done) {
      d = window.__THREE_GAME_DIAGNOSTICS__; const p = d.player.position, o = d.objective.position, c = window.__cam;
      c.updateMatrixWorld(); const hd = Math.hypot(o.x - p.x, o.z - p.z);
      const trueErr = ang(Math.atan2(o.x - p.x, o.z - p.z) - Math.atan2(-Math.sin(d.player.yaw), -Math.cos(d.player.yaw))); // + = target to the left? sign checked below
      v.set(p.x, p.y, p.z).project(c); const dx = (v.x * 0.5 + 0.5) * W;
      v.set(o.x, o.y + 2.4, o.z).project(c); let tx = (v.x * 0.5 + 0.5) * W; const behind = v.z > 1; if (behind) tx = W - tx;
      const ref = MODE === 'centre' ? W / 2 : dx;
      let errPx = tx - ref; if (behind) errPx = (errPx >= 0 ? 1 : -1) * 2000;
      let turn = 0;
      if (MODE === 'yaw') turn = Math.abs(trueErr) > 0.05 ? (trueErr > 0 ? -1 : 1) : 0;
      else turn = Math.abs(errPx) > W * 0.02 ? (errPx > 0 ? 1 : -1) : 0;
      if (turn !== 0 && lastTurn !== 0 && turn !== lastTurn) flips++;
      if (turn !== 0) lastTurn = turn;
      if (turn === 0 && hd > 30) aligned.push(Math.abs(trueErr) * 57.3);
      const wantY = hd > 30 ? 45 : o.y + 1.2; const tgtS = hd < 8 ? 3 : hd < 30 ? 8 : 17;
      const straight = MODE === 'yaw' ? Math.abs(trueErr) < 0.6 : !behind && Math.abs(errPx) < W * 0.2;
      G.key('KeyD', turn > 0); G.key('KeyA', turn < 0);
      G.key('KeyW', straight && d.player.speed < tgtS); G.key('KeyS', d.player.speed > tgtS + 2 || (!straight && d.player.speed > 4));
      G.key('Space', p.y < wantY - 1); G.key('ShiftLeft', p.y > wantY + 1); G.key('KeyE', false);
      G.advance(1 / 60, false); t += 1 / 60;
      const d2 = window.__THREE_GAME_DIAGNOSTICS__; if (d2.objective && d2.objective.phase + d2.objective.name + d2.deliveries !== key0) done = true;
    }
    G.render?.(); d = window.__THREE_GAME_DIAGNOSTICS__;
    const s = aligned.sort((a, b) => a - b);
    legs.push({ leg, t: +t.toFixed(1), done, flips, alignedMed: +(s[Math.floor(s.length / 2)] || 0).toFixed(1), alignedP90: +(s[Math.floor(s.length * 0.9)] || 0).toFixed(1), crashes: (d.crashes || 0) - crashes0 });
    if (!done) break;
  }
  for (const k of ['KeyW', 'KeyA', 'KeyD', 'KeyS', 'Space', 'ShiftLeft']) G.key(k, false);
  return { legs, score: d.score, deliveries: d.deliveries };
}, { LEGS, MODE });
const tot = res.legs.reduce((a, l) => a + l.t, 0), flips = res.legs.reduce((a, l) => a + l.flips, 0);
console.log('MARKER', JSON.stringify({ port: PORT, mode: MODE, seed: SEED, mobile: MOBILE, legsDone: res.legs.filter((l) => l.done).length, totalT: +tot.toFixed(1), flips, deliveries: res.deliveries, legs: res.legs }));
await browser.close();
