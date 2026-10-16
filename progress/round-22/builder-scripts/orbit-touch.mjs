// Round 21 builder: touch orbit on iPhone 13 landscape (CDP multi-touch). A finger dragging on empty screen orbits;
// the stick (turn + forward) and the Boost button keep working while that finger drags; a drag on the stick does not orbit.
import { chromium, devices } from '@playwright/test';
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const URL_ = process.env.URL || 'http://127.0.0.1:5190/';
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'] });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(URL_ + '?seed=130', { waitUntil: 'networkidle' }); await page.waitForTimeout(1000);
const cdp = await ctx.newCDPSession(page);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([id, x, y]) => ({ id, x, y })) });
const b = await page.evaluate(() => { const b = document.getElementById('play-button'); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await page.waitForTimeout(400);
await touch('touchStart', [[9, b.x, b.y]]); await touch('touchEnd', [[9, b.x, b.y]]);
await page.waitForTimeout(3200);
const shot = (n) => page.screenshot({ path: OUT + n + '.jpg', type: 'jpeg', quality: 80 });
const diag = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__THREE_GAME_DIAGNOSTICS__)));
const deg = (r) => +(r * 180 / Math.PI).toFixed(1);
const box = (sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; }, sel);
const stick = await box('#touch-stick'), boost = await box('#boost-button');
const vp = page.viewportSize();
const res = { viewport: vp };
await shot('m-01-hint');
let d = await diag(); res.base = { yaw: deg(d.camera.behind.yaw), droneYaw: deg(d.player.yaw), speed: +d.player.speed.toFixed(1) };
// 1) one finger on empty screen drags 150 px right
const ex = vp.width * 0.6, ey = vp.height * 0.35;
await touch('touchStart', [[1, ex, ey]]);
for (let i = 1; i <= 15; i++) { await touch('touchMove', [[1, ex + i * 10, ey]]); await page.waitForTimeout(16); }
await page.waitForTimeout(300); d = await diag(); res.oneFinger = { yaw: deg(d.camera.behind.yaw), view: deg(d.camera.view.yaw) };
await shot('m-02-one-finger-orbit');
await touch('touchEnd', [[1, ex + 150, ey]]);
await page.waitForTimeout(1600); d = await diag(); res.afterRelease = { yaw: deg(d.camera.behind.yaw) };
// 2) stick drag alone must not orbit
await touch('touchStart', [[2, stick.x, stick.y]]);
for (let i = 1; i <= 8; i++) { await touch('touchMove', [[2, stick.x + i * 6, stick.y - i * 5]]); await page.waitForTimeout(16); }
await page.waitForTimeout(200); d = await diag(); res.stickOnly = { view: deg(d.camera.view.yaw), speed: +d.player.speed.toFixed(1) };
await touch('touchEnd', [[2, stick.x + 48, stick.y - 40]]);
await page.waitForTimeout(800);
// 3) three fingers: stick (forward + right), Boost held, and an orbit drag on empty screen
d = await diag(); const y0 = d.player.yaw, s0 = d.player.speed;
const sp = [2, stick.x + stick.w * 0.25, stick.y - stick.w * 0.38];
await touch('touchStart', [sp]);
await touch('touchStart', [sp, [3, boost.x, boost.y]]);
await touch('touchStart', [sp, [3, boost.x, boost.y], [4, ex, ey]]);
let boosting = false;
for (let i = 1; i <= 25; i++) { await touch('touchMove', [sp, [3, boost.x, boost.y], [4, ex - i * 8, ey + i * 2]]); await page.waitForTimeout(25); const q = await diag(); boosting ||= !!q.player.boosting; }
d = await diag();
res.threeFingers = { boosting, droneTurned: deg(d.player.yaw - y0), speed: [+s0.toFixed(1), +d.player.speed.toFixed(1)], viewYaw: deg(d.camera.view.yaw), behindYaw: deg(d.camera.behind.yaw), held: d.camera.view.free };
await shot('m-03-stick-boost-and-orbit');
await touch('touchEnd', [[4, ex - 200, ey + 50]]);
await touch('touchEnd', [[3, boost.x, boost.y]]);
await touch('touchEnd', [sp]);
await page.waitForTimeout(1600); d = await diag(); res.allReleased = { yaw: deg(d.camera.behind.yaw), boosting: !!d.player.boosting };
res.errors = errors;
console.log(JSON.stringify(res));
await browser.close();
