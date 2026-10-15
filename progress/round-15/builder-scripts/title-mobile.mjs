// Round 15 builder: title and game-over cards on an iPhone 13 held sideways (touch), daily city.
import { chromium, devices } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'] });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5188/?daily', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
await page.screenshot({ path: '../builder-shots/V-m-title-daily.jpg', type: 'jpeg', quality: 80 });
await page.evaluate(() => { const G = window.__GAME__; G.externalClock(true); G.start(); let d = G.advance(0.05, false); const p = d.objective.position; G.place(p.x, p.y + 1.3, p.z, 0, 0); G.advance(0.3, false); G.end(); G.advance(0.05, false); });
await page.waitForTimeout(900); await page.screenshot({ path: '../builder-shots/V-m-over-daily.jpg', type: 'jpeg', quality: 80 });
await browser.close();
