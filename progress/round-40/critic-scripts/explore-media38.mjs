// Round 38 critic (new, for the gemini media): per seed, the start pose, the first legs' objective positions (teleport
// the drone onto each objective and advance until the phase changes), the sites and the boats. Deterministic, no shots.
import { chromium } from '@playwright/test';
const PORT = process.env.PORT || '5191'; const SEEDS = (process.env.SEEDS || '130,22,58,11,7,44,91,33').split(',').map(Number);
const browser = await chromium.launch({ channel: 'chromium' });
for (const SEED of SEEDS) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); G.advance(0.5, false);
    const D = () => JSON.parse(JSON.stringify(window.__THREE_GAME_DIAGNOSTICS__));
    const d0 = D(); const start = d0.player.position; const legs = [];
    for (let leg = 0; leg < 5; leg++) {
      const d = D(); const o = d.objective.position; const ph = d.objective.phase + '|' + d.objective.name;
      legs.push({ phase: d.objective.phase, name: d.objective.name, x: +o.x.toFixed(1), y: +o.y.toFixed(1), z: +o.z.toFixed(1), score: d.score });
      let k = 0; while (k++ < 600) { G.place(o.x, o.y + 0.6, o.z, 0, 0); G.advance(1 / 20, false); const e = D(); if (e.objective.phase + '|' + e.objective.name !== ph) break; }
    }
    const boats = G.boats().map((b) => ({ kind: b.kind, moving: b.moving, x: +b.x.toFixed(0), z: +b.z.toFixed(0) }));
    return { start, legs, city: G.city(), sites: G.sites().map((s) => `${s.kind}:${s.name}@${s.x.toFixed(0)},${s.y.toFixed(0)},${s.z.toFixed(0)}`), boats, score: D().score, tier: D().goals?.tierName };
  });
  console.log('SEED', SEED, JSON.stringify(r));
  await page.close();
}
await browser.close();
