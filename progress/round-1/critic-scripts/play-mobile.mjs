import { chromium, devices } from '@playwright/test';
const OUT = new URL('../critic/', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'] });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
console.log('viewport', page.viewportSize());
await page.screenshot({ path: OUT + 'm01-title.png' });
const box = async (sel) => page.evaluate((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null; }, sel);
const play = await box('#play-button') || await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((b) => /play/i.test(b.textContent)); const r = b.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
console.log('play button', play);
await page.touchscreen.tap(play.x + play.w / 2, play.y + play.h / 2);
await page.waitForTimeout(800);
const stick = await box('#touch-stick'), up = await box('#up-button'), boost = await box('#boost-button'), down = await box('#down-button');
console.log({ stick, up, boost, down });
const sc = { x: stick.x + stick.w / 2, y: stick.y + stick.h / 2 };
const t = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
const diag = () => page.evaluate(() => { const d = window.__THREE_GAME_DIAGNOSTICS__; return { st: d.state, pos: [d.player.position.x, d.player.position.y, d.player.position.z].map((n) => n.toFixed(1)).join(','), spd: d.player.speed.toFixed(1), obj: d.objective?.name, post: d.renderer.post, dpr: d.canvas.dpr, fps: d.fps }; });
console.log('before', await diag());
// thumb on stick, push up; second thumb on climb
await t('touchStart', [{ x: sc.x, y: sc.y, id: 1 }]);
for (let i = 1; i <= 10; i++) { await t('touchMove', [{ x: sc.x, y: sc.y - i * 5, id: 1 }]); await page.waitForTimeout(16); }
await t('touchStart', [{ x: sc.x, y: sc.y - 50, id: 1 }, { x: up.x + up.w / 2, y: up.y + up.h / 2, id: 2 }]);
await page.waitForTimeout(1500);
await page.screenshot({ path: OUT + 'm02-flying-stick-and-climb.png' });
console.log('after climb', await diag());
await t('touchEnd', [{ x: sc.x, y: sc.y - 50, id: 1 }]);
// steer right with stick, boost
await t('touchStart', [{ x: sc.x, y: sc.y, id: 3 }]);
for (let i = 1; i <= 8; i++) { await t('touchMove', [{ x: sc.x + i * 5, y: sc.y - i * 4, id: 3 }]); await page.waitForTimeout(16); }
await t('touchStart', [{ x: sc.x + 40, y: sc.y - 32, id: 3 }, { x: boost.x + boost.w / 2, y: boost.y + boost.h / 2, id: 4 }]);
await page.waitForTimeout(2000);
await page.screenshot({ path: OUT + 'm03-boost-turn.png' });
console.log('after boost turn', await diag());
await t('touchEnd', []);
await page.waitForTimeout(1000);
await page.screenshot({ path: OUT + 'm04-hover-hud.png' });
// HUD overlap check
const rects = await page.evaluate(() => Object.fromEntries(['timer', 'objective', 'touch-stick', 'up-button', 'boost-button', 'down-button', 'pause-button', 'nav-marker'].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [id, [r.x, r.y, r.width, r.height].map(Math.round)]; })));
console.log('rects', JSON.stringify(rects));
await page.evaluate(() => window.__GAME__.end());
await page.waitForTimeout(1200);
await page.screenshot({ path: OUT + 'm05-game-over.png' });
console.log('errors', errors);
await browser.close();
