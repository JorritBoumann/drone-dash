// Round 38 builder: close-ups of the moored rib (tube facets), free camera, deterministic (manualRender + advance).
// PORT (5191), TAG (r38), SEED (130). Three views: side, quarter, high quarter, 4 to 6 m from the boat.
import { chromium } from '@playwright/test';
const OUT = process.env.OUTDIR || '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/c39/shots/';
const PORT = process.env.PORT || '5191'; const TAG = process.env.TAG || 'r38'; const SEED = process.env.SEED || '22';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}&post=1`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
await page.waitForFunction(() => window.__GAME__.assetsReady().on, null, { timeout: 30000 });
await page.evaluate(() => { const G = window.__GAME__; G.advance(3, false); G.hideDebugUi?.(true); });
await page.waitForTimeout(2500);
await page.addStyleTag({ content: 'body * { visibility: hidden !important; } #game-canvas { visibility: visible !important; }' });
const b = (await page.evaluate(() => window.__GAME__.boats())).find((q) => q.kind === 'rib' && !q.moving);
const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
for (const [nm, along, side, up] of [['side', 0, 4.2, 1.2], ['quarter', 3.2, 3.2, 1.6], ['high', -3, 3.5, 3.2]]) {
  const cx = b.x + fx * along + fz * side, cz = b.z + fz * along - fx * side;
  await page.evaluate(([cx, up, cz, tx, tz]) => { const G = window.__GAME__; G.advance(1 / 60, false); G.renderFrom(cx, up, cz, tx, -0.3, tz); }, [cx, up, cz, b.x, b.z]);
  await page.screenshot({ path: OUT + `rib38-${TAG}-${nm}.jpg`, type: 'jpeg', quality: 85 });
}
console.log('RIB', TAG, JSON.stringify(b));
await browser.close();
