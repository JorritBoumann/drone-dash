// Round 21 builder: desktop mouse orbit. Right-drag 200 px -> yaw change; release -> back behind within 1.5 s;
// left click without movement still boosts and does not orbit; right-drag up/down pitches; chorded left during a
// right-drag boosts; no context menu.
import { chromium } from '@playwright/test';
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const URL_ = process.env.URL || 'http://127.0.0.1:5190/';
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(URL_ + '?seed=22', { waitUntil: 'networkidle' }); await page.waitForTimeout(1000);
await page.keyboard.press('Enter'); await page.waitForTimeout(3000);
const diag = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__THREE_GAME_DIAGNOSTICS__)));
const shot = (n) => page.screenshot({ path: OUT + n + '.jpg', type: 'jpeg', quality: 80 });
await page.evaluate(() => { window.__ctx = 0; window.addEventListener('contextmenu', (e) => { if (!e.defaultPrevented) window.__ctx++; }); });
const deg = (r) => +(r * 180 / Math.PI).toFixed(1);
const res = {};
let d = await diag();
res.baseYaw = deg(d.camera.behind.yaw); res.baseElev = deg(d.camera.behind.elev);
await shot('d-01-behind');
// 1) right-drag 200 px to the right
await page.mouse.move(640, 360);
await page.mouse.down({ button: 'right' });
for (let i = 1; i <= 20; i++) { await page.mouse.move(640 + i * 10, 360); await page.waitForTimeout(15); }
await page.waitForTimeout(400);
d = await diag(); res.heldYaw = deg(d.camera.behind.yaw); res.heldView = deg(d.camera.view.yaw);
await shot('d-02-right-drag-200px');
await page.waitForTimeout(800);
d = await diag(); res.heldYawAfter1_2s = deg(d.camera.behind.yaw);
await page.mouse.up({ button: 'right' });
const t0 = Date.now(); let back = null; const trace = [];
while (Date.now() - t0 < 2500) {
  d = await diag(); const t = (Date.now() - t0) / 1000; trace.push([+t.toFixed(2), deg(d.camera.behind.yaw)]);
  if (back === null && Math.abs(d.camera.behind.yaw) < 0.035) back = +t.toFixed(2);
  if (t > 0.6 && t < 0.7) await shot('d-03-easing-back');
  await page.waitForTimeout(40);
}
res.backBehindAfter_s = back; res.releaseTrace = trace.filter((_, i) => i % 4 === 0);
// 2) pitch: right-drag up 150 px (look up, camera lower) then down 300 px (look down from above)
await page.mouse.move(640, 360); await page.mouse.down({ button: 'right' });
for (let i = 1; i <= 15; i++) { await page.mouse.move(640, 360 - i * 10); await page.waitForTimeout(15); }
await page.waitForTimeout(400); d = await diag(); res.elevUp = deg(d.camera.behind.elev); await shot('d-04-drag-up-low-view');
for (let i = 1; i <= 40; i++) { await page.mouse.move(640 - i * 6, 210 + i * 10); await page.waitForTimeout(15); }
await page.waitForTimeout(400); d = await diag(); res.elevDown = deg(d.camera.behind.elev); res.yawDownLeft = deg(d.camera.behind.yaw); await shot('d-05-drag-down-left-high-view');
// a huge drag down must clamp, not flip
for (let i = 1; i <= 40; i++) { await page.mouse.move(400, 610 + i * 2); await page.waitForTimeout(5); }
await page.mouse.move(400, 100); await page.mouse.move(400, 700);
await page.waitForTimeout(300); d = await diag(); res.elevClampMax = deg(d.camera.behind.elev);
await page.mouse.up({ button: 'right' });
await page.waitForTimeout(1800);
d = await diag(); res.afterReturn = { yaw: deg(d.camera.behind.yaw), elev: deg(d.camera.behind.elev) };
// 3) left click without movement: boost, no orbit
const b0 = d.player.boost;
await page.mouse.move(640, 360); await page.mouse.down({ button: 'left' });
let boosting = false; for (let i = 0; i < 10; i++) { await page.waitForTimeout(40); const q = await diag(); boosting ||= !!q.player.boosting; }
d = await diag(); res.leftClick = { boosting, boostMeter: [+b0.toFixed(2), +d.player.boost.toFixed(2)], viewYaw: deg(d.camera.view.yaw) };
await page.mouse.up({ button: 'left' }); await page.waitForTimeout(200); d = await diag(); res.leftClick.boostingAfterUp = !!d.player.boosting;
await page.waitForTimeout(1500);
// 4) chord: right-drag, press left while dragging -> boost; release left -> stop boost; orbit continues
await page.mouse.move(640, 360); await page.mouse.down({ button: 'right' });
for (let i = 1; i <= 5; i++) { await page.mouse.move(640 - i * 10, 360); await page.waitForTimeout(15); }
await page.mouse.down({ button: 'left' }); await page.waitForTimeout(250); d = await diag(); res.chordBoost = !!d.player.boosting;
for (let i = 6; i <= 15; i++) { await page.mouse.move(640 - i * 10, 360); await page.waitForTimeout(15); }
await page.mouse.up({ button: 'left' }); await page.waitForTimeout(250); d = await diag(); res.chordBoostAfterLeftUp = !!d.player.boosting; res.chordYaw = deg(d.camera.behind.yaw);
await page.mouse.up({ button: 'right' });
res.contextMenusNotBlocked = await page.evaluate(() => window.__ctx);
// 5) mouse wheel zoom (real CDP wheel, 100 px notches)
await page.waitForTimeout(1500);
d = await diag(); const z0 = d.camera.view.zoom;
for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(60); }
await page.waitForTimeout(500); d = await diag(); res.wheelOut = { zoom: [+z0.toFixed(3), +d.camera.view.zoom.toFixed(3)], dist: +d.camera.view.distance.toFixed(2), yaw: deg(d.camera.view.yaw) };
await shot('d-06-wheel-zoom-out');
for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -100); await page.waitForTimeout(60); }
await page.waitForTimeout(500); d = await diag(); res.wheelIn = { zoom: +d.camera.view.zoom.toFixed(3), dist: +d.camera.view.distance.toFixed(2) };
await shot('d-07-wheel-zoom-in');
for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(60); }
res.errors = errors;
console.log(JSON.stringify(res, null, 1));
await browser.close();
