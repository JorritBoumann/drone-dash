// Round 19 builder (debug): does the message probe's crash placement hit a wall? Deterministic.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
await page.goto('http://127.0.0.1:5188/?seed=' + (process.env.SEED || '58'), { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
await page.evaluate(() => { window.__GAME__.externalClock(true); window.__GAME__.start(); window.__GAME__.manualRender(true); });
const r = await page.evaluate(() => { const G = window.__GAME__; const f = G.features().filter((q) => q.kind === 'alley')[0];
  const rz = G.streetRoute({ x: f.x, z: f.z - 22 }, { x: f.x, z: f.z + 22 }, true); const axis = rz.names.includes(f.name) && rz.length < 50 ? 'z' : 'x';
  G.key('KeyW', true); if (axis === 'z') G.place(f.x + 19, 4, f.z + 6, Math.PI / 2, 19); else G.place(f.x + 6, 4, f.z + 19, 0, 19);
  const out = []; for (let i = 0; i < 20; i++) { const d = G.advance(0.05, false); out.push([+d.player.position.x.toFixed(1), +d.player.position.z.toFixed(1), +d.player.speed.toFixed(1), d.crashes]); } return { f, axis, out }; });
console.log(JSON.stringify(r));
await browser.close();
