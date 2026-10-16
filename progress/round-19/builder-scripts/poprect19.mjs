import { chromium, devices } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
await page.goto('http://127.0.0.1:5188/?seed=58', { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
await page.evaluate(() => window.__GAME__.start()); await page.waitForTimeout(800);
const r = await page.evaluate(() => { const o = (id) => { const e = document.getElementById(id); const b = e.getBoundingClientRect(); return [id, Math.round(b.top), Math.round(b.bottom), getComputedStyle(e).top]; }; return { vw: innerWidth, vh: innerHeight, rects: ['pop', 'medal-pop', 'event-pop', 'objective', 'route-hint', 'timer'].map(o) }; });
console.log(JSON.stringify(r));
await browser.close();
