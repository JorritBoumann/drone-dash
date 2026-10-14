// Round 6 builder: screenshots of the slipstream meter/payout in a street and the high-wind chip above the roofs (seed 22).
import { chromium } from '@playwright/test';
const OUT = new URL('../shots/', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto('http://127.0.0.1:5188/?seed=22', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
await page.keyboard.press('Enter'); await page.waitForTimeout(400);
// street run along x = 22 road (runs along z), heading -z, 7 m up
await page.evaluate(() => window.__GAME__.place(22, 7, 140, 0, 14));
await page.keyboard.down('KeyW');
let best = null;
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(100);
  const s = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.slipstream);
  if (i === 12) await page.screenshot({ path: OUT + 's1-street-drafting.jpg', type: 'jpeg', quality: 80 });
  if (s.payouts > 0 && !best) { best = s; await page.waitForTimeout(150); await page.screenshot({ path: OUT + 's2-street-payout.jpg', type: 'jpeg', quality: 80 }); }
  const p = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.player.position);
  if (p.z < -120) break;
}
console.log('street', JSON.stringify(await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.slipstream)));
await page.keyboard.up('KeyW');
await page.evaluate(() => window.__GAME__.place(0, 42, 120, 0, 14));
await page.keyboard.down('KeyW');
await page.waitForTimeout(1500);
await page.screenshot({ path: OUT + 's3-high-wind.jpg', type: 'jpeg', quality: 80 });
console.log('high', JSON.stringify(await page.evaluate(() => ({ hw: window.__THREE_GAME_DIAGNOSTICS__.player.headwind, sp: window.__THREE_GAME_DIAGNOSTICS__.player.speed }))));
await page.keyboard.up('KeyW');
await browser.close();
