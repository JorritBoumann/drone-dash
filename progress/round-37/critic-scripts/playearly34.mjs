// Round 34 critic (new): on a cold production load the Play button shows long before the game code runs. Click (desktop)
// or tap (phone) Play as soon as it is on screen, then wait 4 s: does the run start, or is the press lost?
import { chromium, devices } from '@playwright/test';
const PORT = process.env.PORT || '5193';
const browser = await chromium.launch({ channel: 'chromium' });
for (const dev of ['desktop', 'iphone']) {
  const ctx = await browser.newContext(dev === 'iphone' ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/?seed=22`, { waitUntil: 'commit' });
  await page.waitForFunction(() => { const b = document.getElementById('play-button'); const t = document.getElementById('title-screen'); return b && t && getComputedStyle(t).position === 'absolute' && b.getBoundingClientRect().width > 20; }, null, { polling: 10 });
  const at = await page.evaluate(() => ({ t: Math.round(performance.now()), game: !!window.__GAME__ }));
  const r = await page.evaluate(() => { const r = document.getElementById('play-button').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (dev === 'iphone') { const cdp = await ctx.newCDPSession(page); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y, id: 3 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
  else await page.mouse.click(r.x, r.y);
  await page.waitForTimeout(4000);
  const st = await page.evaluate(() => ({ state: window.__THREE_GAME_DIAGNOSTICS__?.state, appState: document.getElementById('app').dataset.state }));
  console.log('PLAYEARLY', dev, JSON.stringify({ pressedAtMs: at.t, gameExistedAtPress: at.game, after4s: st }));
  await ctx.close();
}
await browser.close();
