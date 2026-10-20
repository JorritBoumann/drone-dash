// Round 16 critic (new): load the game N times with no ?seed and print the random city seed, mood and park count.
import { chromium } from '@playwright/test';
const N = Number(process.env.N || 16);
const browser = await chromium.launch({ channel: 'chromium' });
for (let i = 0; i < N; i++) {
  const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
  await page.goto('http://127.0.0.1:5191/', { waitUntil: 'networkidle' }); await page.waitForTimeout(300);
  const r = await page.evaluate(() => ({ ...window.__GAME__.city(), mood: window.__THREE_GAME_DIAGNOSTICS__.city.mood, parks: window.__THREE_GAME_DIAGNOSTICS__.city.parks }));
  console.log('SEED ' + JSON.stringify(r)); await page.close();
}
await browser.close();
