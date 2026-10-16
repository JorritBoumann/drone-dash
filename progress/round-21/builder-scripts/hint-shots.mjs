// Round 21 builder: first-run camera hint next to the slipstream meter and its hint (desktop and iPhone 13 landscape).
import { chromium, devices } from '@playwright/test';
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const URL_ = process.env.URL || 'http://127.0.0.1:5190/';
const browser = await chromium.launch({ channel: 'chromium' });
for (const mobile of [false, true]) {
  const ctx = await browser.newContext(mobile ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(URL_ + '?seed=22', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  if (mobile) await page.evaluate(() => document.getElementById('app').classList.add('touch'));
  await page.screenshot({ path: OUT + (mobile ? 'm' : 'd') + '-00-title.jpg', type: 'jpeg', quality: 80 });
  await page.evaluate(() => window.__GAME__.start());
  await page.waitForTimeout(1800);
  // fly to the nearest wall fast so the slipstream meter (and its first-run hint) comes on while the camera hint shows
  const G = (f, a) => page.evaluate(f, a);
  await G(() => { window.__GAME__.place(22 - 4.5, 6, 30, 0, 14); window.__GAME__.key('KeyW', true); });
  let r = null;
  for (let i = 0; i < 30; i++) { await page.waitForTimeout(100); r = await G(() => ({ slip: document.getElementById('slip').className, vh: document.getElementById('view-hint').className })); if (r.slip.includes('on')) break; }
  await page.waitForTimeout(400);
  const rects = await G(() => ['view-hint', 'slip'].map((id) => { const e = document.getElementById(id); const b = e.getBoundingClientRect(); return { id, cls: e.className, top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right) }; }).concat([(() => { const e = document.querySelector('.slip-hint'); const b = e.getBoundingClientRect(); return { id: 'slip-hint', op: getComputedStyle(e).opacity, top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right) }; })()]));
  console.log(mobile ? 'mobile' : 'desktop', JSON.stringify(rects));
  await page.screenshot({ path: OUT + (mobile ? 'm' : 'd') + '-08-view-hint-with-slip-hint.jpg', type: 'jpeg', quality: 80 });
  await ctx.close();
}
await browser.close();
