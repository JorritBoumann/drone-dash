// Round 32 builder: fast tuning loop. Only the game-camera g-cruise and g-low views of water31.mjs, desktop, 4 moods.
import { chromium } from '@playwright/test';
const OUT = new URL('./out/fast/', import.meta.url).pathname;
const SEEDS = (process.env.SEEDS || '130,22,33,58').split(',').map(Number);
const browser = await chromium.launch({ channel: 'chromium' });
for (const SEED of SEEDS) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`http://127.0.0.1:5190/?seed=${SEED}&post=1`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
  await page.waitForFunction(() => window.__GAME__.assetsReady().on, null, { timeout: 30000 });
  await page.evaluate(() => { const G = window.__GAME__; G.advance(3, false); window.__GAME__.hideDebugUi?.(true); }); await page.waitForTimeout(3500);
  const game = [['g-cruise', [140, 24, 30], -Math.PI / 2], ['g-low', [182, 2.0, 20], -Math.PI / 2], ['g-mid', [140, 12, 30], -Math.PI / 2], ['g-sun', [0, 18, 0], 0]];
  for (const [name, p, yaw] of game) {
    await page.evaluate(([p, yaw]) => { const G = window.__GAME__; for (let i = 0; i < 40; i++) { G.place(p[0], p[1], p[2], yaw, 0); G.advance(1 / 60, false); } G.advance(1 / 60, true); }, [p, yaw]);
    await page.screenshot({ path: OUT + `water31-r31-${SEED}-${name}.jpg`, type: 'jpeg', quality: 80 });
  }
  if (errs.length) console.log(SEED, errs.slice(0, 3));
  await ctx.close();
}
await browser.close();
