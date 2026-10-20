// Round 46 builder: does every title-card line stay on screen (desktop, iPhone 13, SE, a 640x360 phone)?
import { chromium, devices } from '@playwright/test';
const PORT = Number(process.env.PORT || 5199); if (PORT === 5188) throw new Error('5188 is the owner');
const browser = await chromium.launch({ channel: 'chromium' });
for (const [name, opts] of [['desk', { viewport: { width: 1280, height: 720 } }], ['iphone13', { ...devices['iPhone 13 landscape'] }], ['se', { viewport: { width: 568, height: 320 }, isMobile: true, hasTouch: true }], ['640x360', { viewport: { width: 640, height: 360 }, isMobile: true, hasTouch: true }]]) {
  const ctx = await browser.newContext(opts); const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/?seed=22`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
  const r = await page.evaluate(() => [...document.querySelectorAll('#title-screen .title-card > *')].filter((e) => e.offsetParent).map((e) => { const b = e.getBoundingClientRect(); return { el: e.className || e.id || e.tagName, top: Math.round(b.top), bottom: Math.round(b.bottom), out: b.bottom > innerHeight + 0.5 || b.top < -0.5 }; }));
  console.log(name, JSON.stringify(r.filter((x) => x.out)), 'last', JSON.stringify(r[r.length - 1]));
  await ctx.close();
}
await browser.close();
