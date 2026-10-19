// Round 40 critic: why the lazy bot stalled on seed 130. Real-time: title, Enter, W held 6 s, log state, timeLeft, url.
import { chromium } from '@playwright/test';
const PORT = process.env.PORT || '5191';
const browser = await chromium.launch({ channel: 'chromium' });
for (let run = 0; run < 2; run++) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) console.log('navigated', f.url()); });
  await page.goto(`http://127.0.0.1:${PORT}/?seed=130`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  const foc = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  const a = await page.evaluate(() => { const d = window.__THREE_GAME_DIAGNOSTICS__; return { st: d?.state, left: d?.timeLeft, url: location.href }; });
  await page.keyboard.down('KeyW'); await page.waitForTimeout(6000); await page.keyboard.up('KeyW');
  const b = await page.evaluate(() => { const d = window.__THREE_GAME_DIAGNOSTICS__; return { st: d?.state, left: d?.timeLeft, sp: d?.player.speed, teach: d?.teach?.queue, url: location.href }; });
  console.log(PORT, 'run', run, 'focus', foc, JSON.stringify(a), JSON.stringify(b));
}
await browser.close();
