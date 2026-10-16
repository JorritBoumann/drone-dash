import { chromium, devices } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'] });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5190/?seed=22', { waitUntil: 'networkidle' }); await page.waitForTimeout(1000);
await page.evaluate(() => window.__GAME__.start()); await page.waitForTimeout(1500);
const b = await page.evaluate(() => window.__GAME__.droneBox()); console.log(JSON.stringify(b)); await page.evaluate((b) => { const d = document.createElement('div'); d.style.cssText = 'position:absolute;z-index:99;border:2px solid red;left:' + b.x + 'px;top:' + b.y + 'px;width:' + b.w + 'px;height:' + b.h + 'px'; document.body.appendChild(d); }, b); await page.screenshot({ path: '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/box.jpg', type: 'jpeg' });
await browser.close();
