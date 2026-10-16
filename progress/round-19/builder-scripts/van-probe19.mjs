// Round 19 builder (new): rush-hour van draft. Deterministic. After rush hour starts, fly a rush lane in the vans' lane at
// 3 m, holding W, and log how often the van draft is on and the street bonus banked a second; the same flight before
// 60 s on the same lane is the control.
import { chromium } from '@playwright/test';
const SEED = process.env.SEED || '22';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
await page.goto('http://127.0.0.1:5188/?seed=' + SEED, { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
await page.evaluate(() => { window.__GAME__.externalClock(true); window.__GAME__.start(); window.__GAME__.manualRender(true); });
const lanes = await page.evaluate(() => window.__GAME__.rushLanes());
const fly = async (label) => {
  // behind a live van (6 m back, same lane and height, its heading, 15 m/s) or, before rush hour, on the same lane
  const ok = await page.evaluate((L) => { const g = window.__GAME__; const v = g.vans().find((q) => Math.abs(q.x) < 90 && Math.abs(q.z) < 90); if (v) g.place(v.x - v.dx * 6, 3.1, v.z - v.dz * 6, Math.atan2(-v.dx, -v.dz), 15); else g.place(-150, 3.1, L.at + 2.9, -Math.PI / 2, 15); g.key('KeyW', true); return !!v; }, lanes[0]);
  let on = 0, n = 0; const b0 = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.slipstream.points);
  for (let i = 0; i < 160; i++) { const d = await page.evaluate(() => { window.__GAME__.advance(0.05, false); const D = window.__THREE_GAME_DIAGNOSTICS__; return { v: D.vanDraft, x: D.player.position.x }; }); n++; if (d.v) on++; if (i > 10 && Math.abs(d.x) > 140) break; }
  const b1 = await page.evaluate(() => { window.__GAME__.key('KeyW', false); return window.__THREE_GAME_DIAGNOSTICS__.slipstream.points; });
  console.log(JSON.stringify({ label, behindVan: ok, frames: n, vanDraftFrames: on, banked: b1 - b0 }));
};
await fly('before');
// keep the clock alive to 60 s: finish legs by placing the drone on the pad every 4 s
await page.evaluate(() => { const g = window.__GAME__; for (let i = 0; i < 64; i++) { const o = window.__THREE_GAME_DIAGNOSTICS__.objective.position; if (i % 4 === 0) g.place(o.x, o.y + 1.3, o.z, 0, 0); else g.place(0, 60, 0, 0, 0); g.advance(1, false); } });
const rush = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.escalation);
console.log('rush', JSON.stringify(rush).slice(0, 80));
for (let k = 0; k < 4; k++) { await fly('rush' + k); await page.evaluate(() => window.__GAME__.advance(1.3, false)); }
await browser.close();
