// Round 34 builder: just the g-low game-camera view (drone 2 m over the bay, as water31.mjs) for a quick look while
// tuning the near water. LABEL names the output; OUTDIR defaults to the scratchpad. Desktop 1280x720, bloom on.
import { chromium } from '@playwright/test';
const PORT = process.env.PORT || '5190'; const LABEL = process.env.LABEL || 'x';
const OUTDIR = process.env.OUTDIR || '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/wl/';
const SEEDS = (process.env.SEEDS || '130,33').split(',').map(Number);
const browser = await chromium.launch({ channel: 'chromium' });
for (const SEED of SEEDS) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}&post=1`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
  await page.waitForFunction(() => window.__GAME__.assetsReady().on, null, { timeout: 30000 });
  await page.evaluate(() => { const G = window.__GAME__; G.advance(3, false); G.hideDebugUi?.(true); });
  if (process.env.DBG) await page.evaluate((d) => { window.__WDBG__?.value.set(...d); }, process.env.DBG.split(',').map(Number)); // round 34 temp: water layer scales (d2, d3, swell, d1)
  if (process.env.BOATS === '0') await page.evaluate(() => window.__GAME__.boatsOn(false));
  if (process.env.RS === '0') await page.evaluate(() => { const m = window.__WMESH__; m.receiveShadow = false; m.material.needsUpdate = true; });
  for (const [name, p, yaw] of [['g-low', [182, 2.0, 20], -Math.PI / 2], ['g-low1', [182, 1.0, 20], -Math.PI / 2]]) {
    await page.evaluate(([p, yaw]) => { const G = window.__GAME__; for (let i = 0; i < 40; i++) { G.place(p[0], p[1], p[2], yaw, 0); G.advance(1 / 60, false); } G.advance(1 / 60, true); }, [p, yaw]);
    const cam = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.camera);
    console.log(SEED, name, 'cam', JSON.stringify(cam));
    await page.screenshot({ path: `${OUTDIR}wl-${LABEL}-${SEED}-${name}.jpg`, type: 'jpeg', quality: 85 });
  }
  await page.close();
}
await browser.close();
