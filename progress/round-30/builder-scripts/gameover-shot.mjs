// Round 7 critic: game-over screen on desktop and iPhone 13 landscape after a short run.
import { chromium, devices } from '@playwright/test';
const OUT = '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/r30out/';
const browser = await chromium.launch({ channel: 'chromium' });
for (const [P, opts] of [['d', { viewport: { width: 1280, height: 720 } }], ['m', { ...devices['iPhone 13 landscape'] }]]) {
  const page = await (await browser.newContext(opts)).newPage();
  await page.goto('http://127.0.0.1:5190/?seed=22', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  await page.evaluate(() => window.__GAME__.start()); await page.waitForTimeout(1500);
  await page.evaluate(() => window.__GAME__.end()); await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + `${P}-r7-gameover.jpg`, type: 'jpeg', quality: 80 });
  console.log(P, (await page.evaluate(() => document.querySelector('#over-screen, .screen-over')?.innerText || document.body.innerText)).replace(/\s+/g, ' ').slice(0, 400));
}
await browser.close();
