// Round 42 critic (new): the HTML game-over card box frame by frame through its entry animation (card-in, which
// overshoots), vs the 64 px corner. iPhone 13 and Pixel 7 landscape, HTML HUD and ?hud=canvas, seed 22, production 5193.
import { chromium, devices } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
for (const dev of ['iPhone 13 landscape', 'Pixel 7 landscape']) for (const q of ['', '&hud=canvas']) {
  const ctx = await browser.newContext({ ...devices[dev] }); const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('drone-dash-played-v1', '1'); } catch {} });
  await page.goto('http://127.0.0.1:5193/?seed=22' + q, { waitUntil: 'networkidle' }); await page.waitForTimeout(1000);
  await page.tap('#play-button'); await page.waitForTimeout(800);
  await page.evaluate(() => { window.__oc = []; const f = () => { const e = document.querySelector('.over-card'); const r = e.getBoundingClientRect(); if (window.__THREE_GAME_DIAGNOSTICS__.state === 'over' && r.width > 0) window.__oc.push([performance.now(), r.left, r.top, r.right, r.bottom, getComputedStyle(e).opacity].map((v) => +(+v).toFixed(1))); requestAnimationFrame(f); }; requestAnimationFrame(f); });
  for (let i = 0; i < 300; i++) { if ((await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.state)) === 'over') break; await page.evaluate(() => window.__GAME__.advance(1, false)); }
  await page.waitForTimeout(1500);
  const oc = await page.evaluate(() => window.__oc);
  const inC = oc.filter((r) => r[1] < 64 && r[2] < 64 && r[5] > 0.05);
  console.log('OVERCARD', dev, q || 'html', JSON.stringify({ frames: oc.length, inCorner: inC.length, msInCorner: inC.length ? +(inC.at(-1)[0] - inC[0][0]).toFixed(0) : 0, first: oc[0], minLT: [Math.min(...oc.map((r) => r[1])), Math.min(...oc.map((r) => r[2]))], rest: oc.at(-1), ex: inC.slice(0, 3) }));
  await ctx.close();
}
await browser.close();
