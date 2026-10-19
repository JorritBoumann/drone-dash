// Round 39 critic (new): how big is the drone on screen as speed changes? Any build (PORT). Fixed step 60 Hz, seed 22,
// road z = 22 heading east, 12 m up: hover 2 s, W 3 s, W+E boost 2.5 s, W 2 s, S 1 s, hover 2 s. Per frame: speed,
// camera-to-drone distance, vertical FOV, drone share of screen height (1.2 m body / view height at that distance).
// Screenshots (JPEG 80) at cruise and at the boost top. MOBILE=1 for iPhone 13 landscape. TAG names the shots.
import { chromium, devices } from '@playwright/test';
const PORT = process.env.PORT || '5190', TAG = process.env.TAG || 'r39', M = !!process.env.MOBILE;
const OUT = new URL('../critic/', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = M ? await browser.newContext({ ...devices['iPhone 13 landscape'] }) : await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${PORT}/?seed=22`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
await page.evaluate(() => { const G = window.__GAME__; G.start(); G.manualRender(true); G.tune({ RUN: { startTime: 9999 } }); G.place(-150, 12, 22, -Math.PI / 2, 0); G.advance(1, false); });
const rows = [];
async function seg(name, secs, keys, shotAt) {
  const r = await page.evaluate(([name, secs, keys]) => {
    const G = window.__GAME__; for (const k of ['KeyW', 'KeyE', 'KeyS']) G.key(k, keys.includes(k)); const out = [];
    for (let i = 0; i < secs * 60; i++) { const d = G.advance(1 / 60, i === secs * 60 - 1); const c = d.camera, p = d.player.position; const dist = Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z); out.push({ seg: name, sp: d.player.speed, dist, fov: c.fov, share: 1.2 / (2 * dist * Math.tan(c.fov * Math.PI / 360)) }); }
    return out; }, [name, secs, keys]);
  rows.push(...r);
  if (shotAt) await page.screenshot({ path: `${OUT}size-${TAG}-${M ? 'm' : 'd'}-${name}.jpg`, type: 'jpeg', quality: 80 });
}
await seg('hover', 2, [], true); await seg('cruise', 3, ['KeyW'], true); await seg('boost', 2.5, ['KeyW', 'KeyE'], true); await seg('coast', 2, ['KeyW']); await seg('brake', 1, ['KeyS']); await seg('hover2', 2, [], true);
const f = (x) => x.toFixed(3);
for (const s of ['hover', 'cruise', 'boost', 'coast', 'brake', 'hover2']) { const a = rows.filter((r) => r.seg === s), last = a[a.length - 1]; console.log(`${TAG} ${M ? 'phone' : 'desktop'} ${s}: end speed ${last.sp.toFixed(1)}, dist ${last.dist.toFixed(2)} m, fov ${last.fov.toFixed(1)}, drone share of height ${f(last.share)} (min in segment ${f(Math.min(...a.map((r) => r.share)))})`); }
for (const [a, b] of [[0, 2], [2, 10], [10, 16], [16, 18], [18, 25], [25, 40]]) { const s = rows.filter((r) => r.sp >= a && r.sp < b); if (s.length) console.log(`  ${a}-${b} m/s: n ${s.length}, mean share ${f(s.reduce((q, r) => q + r.share, 0) / s.length)}, mean dist ${(s.reduce((q, r) => q + r.dist, 0) / s.length).toFixed(2)}`); }
await browser.close();
