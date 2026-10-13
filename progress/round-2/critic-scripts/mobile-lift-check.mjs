// Lifting one of two fingers: compare CDP encodings, and log the DOM pointer events the buttons receive.
import { chromium, devices } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'] });
const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
await page.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
await page.evaluate(() => { window.__GAME__.start(); window.__pe = []; for (const id of ['up-button', 'down-button', 'touch-stick']) for (const ty of ['pointerdown', 'pointerup', 'pointercancel', 'pointerleave']) document.getElementById(id).addEventListener(ty, (e) => window.__pe.push(id + ':' + ty + '#' + e.pointerId)); });
await page.waitForTimeout(400);
const c = (id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, id);
const up = await c('up-button'), st = await c('touch-stick');
const cls = () => page.evaluate(() => document.getElementById('up-button').className);
const pe = () => page.evaluate(() => window.__pe.splice(0).join(' '));
const t = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
for (const how of ['touchEnd-with-remaining', 'touchMove-with-remaining']) {
  await t('touchStart', [{ ...st, id: 1 }]); await t('touchStart', [{ ...st, id: 1 }, { ...up, id: 2 }]); await page.waitForTimeout(300);
  if (how === 'touchEnd-with-remaining') await t('touchEnd', [{ ...st, id: 1 }]); else await t('touchMove', [{ ...st, id: 1 }]);
  await page.waitForTimeout(300); console.log(how, '-> up class', await cls(), '| events', await pe());
  await t('touchEnd', []); await page.waitForTimeout(300); console.log('  after all fingers up:', await cls(), '|', await pe());
}
await browser.close();
