// Round 31: load a seed, start, report console errors and shader errors.
import { chromium, devices } from '@playwright/test';
const PORT = process.env.PORT || 5190, SEED = process.env.SEED || 130;
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext(process.env.MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text().slice(0, 600)); });
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.evaluate(() => { window.__GAME__.start(); });
await page.waitForTimeout(3000);
console.log(JSON.stringify(await page.evaluate(() => ({ a: window.__GAME__.assetsReady(), r: window.__GAME__.renderStats(), b: window.__GAME__.boats ? window.__GAME__.boats().length : -1 }))));
console.log(errs.join('\n') || 'no errors');
await browser.close();
