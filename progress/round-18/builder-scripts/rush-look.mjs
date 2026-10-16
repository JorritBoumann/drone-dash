// Round 18 builder: rush hour in the world. Deterministic: start time raised (tune) so an idle drone reaches 60 s,
// drone parked 12 m above a rush lane looking along it. Screenshots at 55 s and 68 s of run time; logs rushLevel.
import { chromium } from '@playwright/test';
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const seeds = (process.env.SEEDS || '22').split(',');
const browser = await chromium.launch({ channel: 'chromium' });
for (const seed of seeds) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto('http://127.0.0.1:5188/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
  const lane = await page.evaluate(() => { window.__GAME__.tune({ RUN: { startTime: 200 } }); window.__GAME__.externalClock(true); window.__GAME__.start(); window.__GAME__.manualRender(true); return window.__GAME__.rushLanes()[0]; });
  await page.waitForTimeout(1200);
  const park = () => page.evaluate((l) => { const yaw = l.axis === 0 ? Math.PI / 2 : 0; window.__GAME__.place(l.axis === 0 ? 40 : l.at + 8, 12, l.axis === 0 ? l.at + 8 : 40, yaw, 0); }, lane);
  for (const [t, tag] of [[55, 'before'], [68, 'after']]) {
    let d = await page.evaluate(() => window.__GAME__.diagnostics());
    while (d.runTime === undefined ? false : d.runTime < t) { await park(); d = await page.evaluate(() => window.__GAME__.advance(1, false)); }
    if (d.runTime === undefined) { for (let k = 0; k < t; k++) { await park(); await page.evaluate(() => window.__GAME__.advance(1, false)); } }
    await park(); d = await page.evaluate(() => window.__GAME__.advance(0.2, true)); await page.waitForTimeout(150);
    await page.screenshot({ path: OUT + `R-seed${seed}-rush-${tag}.jpg`, type: 'jpeg', quality: 80 });
    console.log('RUSH ' + JSON.stringify({ seed, tag, runTime: d.runTime, state: d.state, rushLanes: d.city.rushLanes, log: (d.scoreLog || []).filter((e) => e.k === 'rushhour') }));
  }
  await page.close();
}
await browser.close();
