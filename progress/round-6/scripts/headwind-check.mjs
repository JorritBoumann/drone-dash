// Round 6 builder: top speed with W held (and with boost) at several altitudes, deterministic.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
await page.goto('http://127.0.0.1:5188/?seed=22', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
await page.evaluate(() => { window.__GAME__.start(); window.__GAME__.manualRender(true); });
const out = await page.evaluate(() => {
  const G = window.__GAME__; const res = [];
  for (const y of [7, 20, 27, 31, 35, 45, 80]) for (const boost of [false, true]) {
    G.place(0, y, 0, 0, 0); G.key('KeyW', true); if (boost) G.key('KeyE', true);
    let d; let ys = 0; for (let i = 0; i < 90; i++) { d = G.advance(1 / 60); ys = d.player.position.y; G.place(d.player.position.x > 150 ? -150 : d.player.position.x, y, d.player.position.z < -150 ? 150 : d.player.position.z, 0, d.player.speed); }
    G.key('KeyW', false); G.key('KeyE', false);
    res.push({ y, boost, speed: +d.player.speed.toFixed(1) });
  }
  return res;
});
console.log(JSON.stringify(out));
await browser.close();
