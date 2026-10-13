// Isolates the touch climb/descend buttons: fresh holds, and up->down switching with/without the stick held.
import { chromium, devices } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'] });
const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
await page.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
await page.evaluate(() => window.__GAME__.start()); await page.waitForTimeout(500);
const c = (id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, id);
const up = await c('up-button'), down = await c('down-button'), st = await c('touch-stick');
const y = () => page.evaluate(() => +window.__THREE_GAME_DIAGNOSTICS__.player.position.y.toFixed(1));
const cls = () => page.evaluate(() => ['up-button', 'down-button'].map((i) => document.getElementById(i).className).join(' | '));
const t = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
async function hold(label, pts, ms = 1200) { const a = await y(); await t('touchStart', pts); await page.waitForTimeout(ms / 2); const k = await cls(); await page.waitForTimeout(ms / 2); const b = await y(); await t('touchEnd', []); await page.waitForTimeout(400); console.log(label, 'y', a, '->', b, 'classes mid-hold:', k); }
await hold('A up alone (id 5)', [{ ...up, id: 5 }]);
await hold('B down alone (id 6)', [{ ...down, id: 6 }]);
await hold('C up again, id 7', [{ ...up, id: 7 }], 2400);
// switching sequence like a thumb sliding / lifting
await t('touchStart', [{ ...st, id: 1 }]); await t('touchStart', [{ ...st, id: 1 }, { ...up, id: 2 }]); await page.waitForTimeout(800);
console.log('D1 stick+up', await y(), await cls());
await t('touchEnd', [{ ...st, id: 1 }]); await page.waitForTimeout(100); console.log('D2 after lifting up finger', await y(), await cls());
await t('touchStart', [{ ...st, id: 1 }, { ...down, id: 2 }]); const a = await y(); await page.waitForTimeout(1200); console.log('D3 stick+down (reused id 2)', a, '->', await y(), await cls());
await t('touchEnd', []); await page.waitForTimeout(300);
await t('touchStart', [{ ...st, id: 1 }]); await t('touchStart', [{ ...st, id: 1 }, { ...down, id: 9 }]); const b = await y(); await page.waitForTimeout(1200); console.log('E stick+down (new id 9)', b, '->', await y(), await cls());
await t('touchEnd', []);
await browser.close();
