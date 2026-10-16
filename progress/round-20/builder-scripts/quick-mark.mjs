// Round 20 builder: quick look at the route mark at leg start (deterministic). SEED, MOBILE.
import { chromium } from '@playwright/test';
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const SEED = process.env.SEED || '22'; const MOBILE = !!process.env.MOBILE;
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext(MOBILE ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
await page.goto('http://127.0.0.1:5188/?seed=' + SEED, { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
await page.evaluate(() => { window.__GAME__.externalClock(true); window.__GAME__.start(); window.__GAME__.manualRender(true); });
let d = await page.evaluate(() => JSON.parse(JSON.stringify(window.__GAME__.advance(0.5, true))));
for (let leg = 0; leg < 12 && !d.routeMark; leg++) {
  const o = d.objective.position;
  await page.evaluate((o) => window.__GAME__.place(o.x, o.y + 1.2, o.z, 0, 0), o);
  d = await page.evaluate(() => JSON.parse(JSON.stringify(window.__GAME__.advance(0.6, true))));
}
console.log(await page.evaluate(() => { const e = document.getElementById('gate-tag'); const r = e.querySelector('.gate-tag-pill').getBoundingClientRect(); return JSON.stringify({ cls: e.className, tr: e.style.transform, op: getComputedStyle(e).opacity, r: [r.x, r.y, r.width, r.height] }); }));
console.log(JSON.stringify({ hint: d.routeHint, mark: d.routeMark, obj: d.objective, p: d.player.position, dom: await page.evaluate(() => document.getElementById('route-hint').textContent) }));
await page.screenshot({ path: OUT + `K-${MOBILE ? 'm' : 'd'}-seed${SEED}-start.jpg`, type: 'jpeg', quality: 80 });
// teleport to the gate approach to look at the arch
if (d.routeMark) {
  const m = d.routeMark; const back = Number(process.env.BACK || 12), side = Number(process.env.SIDE || 0); const a = { x: m.gate.x - m.inward.x * back + m.inward.z * side, z: m.gate.z - m.inward.z * back - m.inward.x * side };
  const yaw = Math.atan2(-(m.gate.x - a.x), -(m.gate.z - a.z));
  await page.evaluate(([a, yaw]) => window.__GAME__.place(a.x, 6, a.z, yaw, 0), [a, yaw]); await page.waitForTimeout(1500);
  d = await page.evaluate(() => JSON.parse(JSON.stringify(window.__GAME__.advance(1.2, true))));
  await page.screenshot({ path: OUT + `K-${MOBILE ? 'm' : 'd'}-seed${SEED}-arch.jpg`, type: 'jpeg', quality: 80 });
  console.log(JSON.stringify({ mark: d.routeMark, prog: d.progress }));
}
console.log('errors', errs);
await browser.close();
