// Round 21 builder: trackpad. Synthetic wheel events as a Mac trackpad sends them: fractional deltaX -> yaw,
// fractional deltaY -> pitch, ctrlKey (pinch) -> zoom. Then reload: the zoom is restored from localStorage.
import { chromium } from '@playwright/test';
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const URL_ = process.env.URL || 'http://127.0.0.1:5190/';
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(URL_ + '?seed=58', { waitUntil: 'networkidle' }); await page.waitForTimeout(1000);
await page.keyboard.press('Enter'); await page.waitForTimeout(3000);
const diag = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__THREE_GAME_DIAGNOSTICS__)));
const shot = (n) => page.screenshot({ path: OUT + n + '.jpg', type: 'jpeg', quality: 80 });
const deg = (r) => +(r * 180 / Math.PI).toFixed(1);
// a trackpad gesture: N events, 16 ms apart, eased deltas (fractional), like macOS sends them
const wheel = (opts) => page.evaluate(async ({ dx, dy, n, ctrl }) => {
  const c = document.getElementById('game-canvas');
  let prevented = 0;
  for (let i = 0; i < n; i++) {
    const s = Math.sin(((i + 0.5) / n) * Math.PI) * 1.5707;
    const ev = new WheelEvent('wheel', { deltaX: dx * s * 1.0137, deltaY: dy * s * 0.9871, deltaMode: 0, ctrlKey: !!ctrl, bubbles: true, cancelable: true, clientX: 640, clientY: 360 });
    c.dispatchEvent(ev); if (ev.defaultPrevented) prevented++;
    await new Promise((r) => setTimeout(r, 16));
  }
  return prevented;
}, opts);
const res = {};
let d = await diag(); res.base = { yaw: deg(d.camera.behind.yaw), elev: deg(d.camera.behind.elev), zoom: d.camera.view.zoom };
res.prevented1 = await wheel({ dx: 6.5, dy: 0, n: 30 }); // swipe: total ~195 px sideways
await page.waitForTimeout(150); d = await diag(); res.afterSwipeX = { yaw: deg(d.camera.behind.yaw), view: deg(d.camera.view.yaw), zoom: d.camera.view.zoom };
await shot('t-01-trackpad-swipe-x');
await wheel({ dx: 0.4, dy: 5.3, n: 25 }); // swipe down: look down
await page.waitForTimeout(150); d = await diag(); res.afterSwipeY = { elev: deg(d.camera.behind.elev), viewPitch: deg(d.camera.view.pitch), zoom: d.camera.view.zoom };
await shot('t-02-trackpad-swipe-y');
// pure vertical fractional swipe with no deltaX at all (classification by fraction)
await page.waitForTimeout(1600); d = await diag(); res.returned = { yaw: deg(d.camera.behind.yaw), elev: deg(d.camera.behind.elev) };
await wheel({ dx: 0, dy: -3.37, n: 20 });
await page.waitForTimeout(150); d = await diag(); res.afterPureY = { viewPitch: deg(d.camera.view.pitch), zoom: d.camera.view.zoom };
await page.waitForTimeout(1600);
// pinch out (zoom in): ctrl + negative deltaY
await wheel({ dx: 0, dy: -2.6, n: 20, ctrl: true });
await page.waitForTimeout(600); d = await diag(); res.afterPinchIn = { zoom: +d.camera.view.zoom.toFixed(3), dist: +d.camera.view.distance.toFixed(2), viewYaw: deg(d.camera.view.yaw) };
await shot('t-03-pinch-zoom-in');
await wheel({ dx: 0, dy: 4.1, n: 30, ctrl: true });
await page.waitForTimeout(600); d = await diag(); res.afterPinchOut = { zoom: +d.camera.view.zoom.toFixed(3), dist: +d.camera.view.distance.toFixed(2) };
await shot('t-04-pinch-zoom-out');
await page.waitForTimeout(1000);
res.saved = await page.evaluate(() => localStorage.getItem('drone-dash-cam-zoom'));
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(800);
await page.keyboard.press('Enter'); await page.waitForTimeout(2500);
d = await diag(); res.afterReload = { zoom: +d.camera.view.zoom.toFixed(3), dist: +d.camera.view.distance.toFixed(2) };
// storage blocked: the game still runs
await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('blocked'); }; });
await wheel({ dx: 0, dy: -2, n: 10, ctrl: true }); await page.waitForTimeout(900);
d = await diag(); res.blockedStorageZoom = +d.camera.view.zoom.toFixed(3);
// leave the zoom at the default for later scripts
await page.evaluate(() => { delete Storage.prototype.setItem; localStorage.removeItem('drone-dash-cam-zoom'); });
res.errors = errors;
console.log(JSON.stringify(res));
await browser.close();
