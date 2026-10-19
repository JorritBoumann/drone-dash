// Round 39 builder: a turn at top cruise speed with W held, on any build: does the speed run away past 17 m/s?
import { chromium } from '@playwright/test';
const PORT = process.env.PORT || '5191';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
await page.goto(`http://127.0.0.1:${PORT}/?seed=22`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
const r = await page.evaluate(() => { const G = window.__GAME__; G.start(); G.manualRender(true); G.tune({ RUN: { startTime: 999 } });
  G.place(-120, 10, 60.33, -Math.PI / 2, 12); G.advance(1 / 60, false); G.key('KeyW', true); const out = []; let max = 0;
  for (let i = 0; i < 300; i++) { if (i === 207) G.key('KeyA', true); if (i === 220) G.key('KeyA', false); const d = G.advance(1 / 60, false); max = Math.max(max, d.player.speed); if (i % 15 === 0) out.push(d.player.speed.toFixed(1)); }
  G.key('KeyW', false); return { max: max.toFixed(1), trace: out.join(' ') }; });
console.log(PORT, JSON.stringify(r));
await browser.close();
