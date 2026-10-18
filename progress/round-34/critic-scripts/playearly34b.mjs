// Round 34 critic (new): Play pressed at a fixed time after navigation (AT ms, default 300), at the button's spot taken
// from a warm load, without waiting on page scripts. Logs whether the game code existed and whether the run starts.
import { chromium } from '@playwright/test';
const PORT = process.env.PORT || '5193'; const ATS = (process.env.ATS || '250,400').split(',').map(Number);
const browser = await chromium.launch({ channel: 'chromium' });
let ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); let page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${PORT}/?seed=22`, { waitUntil: 'networkidle' });
const r = await page.evaluate(() => { const r = document.getElementById('play-button').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await ctx.close();
for (const AT of ATS) {
  ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); page = await ctx.newPage();
  await page.addInitScript(() => { window.__clk = []; addEventListener('click', (e) => window.__clk.push([Math.round(performance.now()), e.target.id, !!window.__GAME__]), true); });
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${PORT}/?seed=22`, { waitUntil: 'commit' });
  const wait = AT - (Date.now() - t0); if (wait > 0) await page.waitForTimeout(wait);
  await page.mouse.click(r.x, r.y);
  await page.waitForTimeout(4000);
  const st = await page.evaluate(() => ({ state: window.__THREE_GAME_DIAGNOSTICS__?.state, appState: document.getElementById('app').dataset.state, clicks: window.__clk }));
  console.log('PLAYEARLYB', AT, JSON.stringify(st));
  await ctx.close();
}
await browser.close();
