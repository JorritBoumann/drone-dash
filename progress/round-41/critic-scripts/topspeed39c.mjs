// Round 39 critic (new): top speed, fixed step 60 Hz, seed 22, long road z = 22 heading east, 12 m up, any build (PORT).
// A: W held from rest 12 s. B: W+E (boost) until the boost runs out, then W held 10 s. C: boost 2.5 s, then W held with a
// hard carve (A 0.4 s, D 0.4 s) every 2 s for 10 s. D: speedbug39 (a turn at top speed). Logs max, and speed after.
import { chromium } from '@playwright/test';
const PORT = process.env.PORT || '5191';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
await page.goto(`http://127.0.0.1:${PORT}/?seed=22`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
const r = await page.evaluate(() => {
  const G = window.__GAME__; G.start(); G.manualRender(true); G.tune({ RUN: { startTime: 9999 } });
  const keys = (on) => { for (const k of ['KeyW', 'KeyE', 'KeyA', 'KeyD', 'KeyS']) G.key(k, on.includes(k)); };
  const run = (plan, secs) => { const tr = []; let max = 0, boostOff = null; for (let i = 0; i < secs * 60; i++) { keys(plan(i / 60)); const d = G.advance(1 / 60, false); max = Math.max(max, d.player.speed); if (boostOff === null && i > 10 && !d.player.boosting && plan(i / 60).includes('KeyE')) boostOff = i / 60; if (i % 30 === 29) tr.push(+d.player.speed.toFixed(1)); } keys([]); return { max: +max.toFixed(1), boostOff, trace: tr }; };
  const out = {};
  G.place(-150, 12, 22, -Math.PI / 2, 0); G.advance(0.5, false);
  out.A = run(() => ['KeyW'], 12);
  G.place(-150, 12, 22, -Math.PI / 2, 0); G.advance(0.5, false); { const st = G.diagnostics(); out.boostStart = st.player.boost; }
  let bo = null; out.B = run((t) => { const d = window.__THREE_GAME_DIAGNOSTICS__; if (bo === null && d && d.player.boost < 0.02 && t > 0.5) bo = t; return bo === null ? ['KeyW', 'KeyE'] : ['KeyW']; }, 16); out.B.boostEmptyAt = bo;
  G.place(-150, 12, 22, -Math.PI / 2, 0); G.advance(3, false);
  out.C = run((t) => { if (t < 2.5) return ['KeyW', 'KeyE']; const m = (t - 2.5) % 2; return m < 0.4 ? ['KeyW', 'KeyA'] : m < 0.8 ? ['KeyW', 'KeyD'] : ['KeyW']; }, 12.5);
  G.place(-120, 10, 60.33, -Math.PI / 2, 12); G.advance(1 / 60, false);
  out.D = run((t) => (t >= 207 / 60 && t < 220 / 60 ? ['KeyW', 'KeyA'] : ['KeyW']), 5);
  return out;
});
console.log(PORT, JSON.stringify(r));
await browser.close();
