// Round 7 critic: game-over screen on desktop and iPhone 13 landscape after a short run.
import { chromium, devices } from '@playwright/test';
const OUT = new URL('./builder-shots/', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chromium' });
for (const [P, opts] of [['d', { viewport: { width: 1280, height: 720 } }], ['m', { ...devices['iPhone 13 landscape'] }]]) {
  const page = await (await browser.newContext(opts)).newPage();
  await page.goto('http://127.0.0.1:5188/?seed=22', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  await page.evaluate(() => window.__GAME__.start()); await page.waitForTimeout(1500);
  await page.evaluate(() => window.__GAME__.end()); await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + `${P}-r7-gameover.jpg`, type: 'jpeg', quality: 80 });
  console.log(P, (await page.evaluate(() => document.querySelector('#over-screen, .screen-over')?.innerText || document.body.innerText)).replace(/\s+/g, ' ').slice(0, 400));
}
await browser.close();
