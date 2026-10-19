// Round 40 builder: boost tail and cruise streaks, fixed step 60 Hz, seed 22, road z = 22 heading east, 12 m up.
// After a full boost with W held: seconds at >= 22 m/s after the boost ends, seconds until 18 m/s, peak slowdown
// (0.1 s window). Cruise: streak level at steady 16.8 m/s and at 11 m/s. Guards: W-only top speed.
import { chromium } from '@playwright/test';
const PORT = process.env.PORT || '5190';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
await page.goto(`http://127.0.0.1:${PORT}/?seed=22`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
const r = await page.evaluate(() => {
  const G = window.__GAME__; G.start(); G.manualRender(true); G.tune({ RUN: { startTime: 9999 } });
  const keys = (on) => { for (const k of ['KeyW', 'KeyE', 'KeyA', 'KeyD', 'KeyS']) G.key(k, on.includes(k)); };
  const out = {};
  // B: full boost with W held, then W held
  G.place(-150, 12, 22, -Math.PI / 2, 0); G.advance(0.5, false);
  const sp = []; let off = -1, peak = 0;
  for (let i = 0; i < 14 * 60; i++) {
    const d0 = window.__THREE_GAME_DIAGNOSTICS__;
    const boosting = off < 0 && (i < 30 || d0.player.boost > 0.02);
    keys(boosting ? ['KeyW', 'KeyE'] : ['KeyW']);
    const d = G.advance(1 / 60, false);
    sp.push(d.player.speed); peak = Math.max(peak, d.player.speed);
    if (off < 0 && i > 30 && !d.player.boosting) off = i;
  }
  keys([]);
  const after = sp.slice(off);
  let above22 = 0; while (above22 < after.length && after[above22] >= 22) above22++;
  let to18 = 0; while (to18 < after.length && after[to18] > 18) to18++;
  let maxDecel = 0; for (let i = 6; i < after.length; i++) maxDecel = Math.max(maxDecel, (after[i - 6] - after[i]) / 0.1);
  out.B = { peak: +peak.toFixed(2), boostEndsAt: +(off / 60).toFixed(2), speedAtEnd: +sp[off].toFixed(2), above22s: +(above22 / 60).toFixed(2), to18s: +(to18 / 60).toFixed(2), maxDecel: +maxDecel.toFixed(2), final: +sp[sp.length - 1].toFixed(2), trace: after.filter((_, i) => i % 30 === 0).map((v) => +v.toFixed(1)) };
  // A: W only from rest 12 s: top speed and streak level at cruise
  G.place(-150, 12, 22, -Math.PI / 2, 0); G.advance(0.5, false);
  let maxA = 0, streak = 0;
  for (let i = 0; i < 12 * 60; i++) { keys(['KeyW']); const d = G.advance(1 / 60, false); maxA = Math.max(maxA, d.player.speed); streak = d.feel.streaks; }
  out.A = { max: +maxA.toFixed(2), streakAtCruise: +streak.toFixed(3), speed: +window.__THREE_GAME_DIAGNOSTICS__.player.speed.toFixed(2) };
  // slow: hold about 11 m/s (W pulsed), streak level must be 0
  G.place(-150, 12, 22, -Math.PI / 2, 0); G.advance(0.5, false);
  let maxSlow = 0, sMax = 0;
  for (let i = 0; i < 8 * 60; i++) { const s = window.__THREE_GAME_DIAGNOSTICS__.player.speed; keys(s < 10.5 ? ['KeyW'] : []); const d = G.advance(1 / 60, false); if (i > 120) { maxSlow = Math.max(maxSlow, d.player.speed); sMax = Math.max(sMax, d.feel.streaks); } }
  out.slow = { maxSpeed: +maxSlow.toFixed(2), maxStreak: +sMax.toFixed(4) };
  keys([]);
  return out;
});
console.log(PORT, JSON.stringify(r));
await browser.close();
