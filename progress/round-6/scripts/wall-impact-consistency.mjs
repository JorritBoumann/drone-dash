// Round 6 builder: is crash severity independent of the forward key? Place the drone short of real block faces
// (seed 22, 10 m up) at several speeds, with W held or released, and log the real impact speed (bump, the speed into
// the wall at first contact) against the game's loss and whether a crash was charged.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
await page.goto('http://127.0.0.1:5188/?seed=22', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
await page.evaluate(() => { window.__GAME__.start(); window.__GAME__.manualRender(true); });
const rows = await page.evaluate(() => {
  const G = window.__GAME__; const out = [];
  for (const [bx, rz] of [[8, 22], [-36, 66], [52, 110], [-80, -22]]) {
    let face = null;
    for (let d = 5; d <= 20; d += 0.5) { G.place(bx, 10, rz - d, 0, 0); const r = G.advance(1 / 60); if (r.player.position.z > rz - d + 0.3) { face = rz - d + 0.95; break; } }
    if (face == null) continue;
    for (const hold of [true, false]) for (const v of [8, 9, 10, 11, 12, 13, 14, 16, 18]) {
      G.key('KeyW', false);
      { const q = G.diagnostics(); if (q.state !== 'playing' || q.timeLeft < 20) { G.start(); G.manualRender(true); } }
      G.place(bx, 10, rz, 0, 0); G.advance(1.5);
      G.place(bx, 10, face + 1.5, 0, v); let d = G.advance(1 / 60); const c0 = d.crashes; if (hold) G.key('KeyW', true);
      let impact = 0;
      for (let i = 0; i < 45; i++) { d = G.advance(1 / 60); if (!impact && d.contact.bump > 0) impact = d.contact.bump; }
      G.key('KeyW', false);
      out.push({ bx, rz, hold, v, impact: +impact.toFixed(1), charged: d.crashes - c0, loss: d.lastCrash && d.crashes > c0 ? +d.lastCrash.loss.toFixed(1) : null });
    }
  }
  return out;
});
const byImpact = {};
for (const r of rows) { const k = Math.floor(r.impact); (byImpact[k] ||= { held: [0, 0], off: [0, 0] })[r.hold ? 'held' : 'off'][r.charged ? 0 : 1]++; }
console.log('impact m/s (floored): held charged/free, off charged/free');
for (const k of Object.keys(byImpact).sort((a, b) => a - b)) console.log(k.padStart(3), 'held', byImpact[k].held.join('/'), ' off', byImpact[k].off.join('/'));
const ratio = rows.filter((r) => r.loss).map((r) => ({ hold: r.hold, k: r.loss / r.impact }));
for (const h of [true, false]) { const s = ratio.filter((r) => r.hold === h).map((r) => r.k); console.log(h ? 'held' : 'off ', 'loss/impact mean', (s.reduce((a, b) => a + b, 0) / s.length).toFixed(3), 'n', s.length); }
await browser.close();
