// Round 27 builder: the detail kit keeps out of pad landing columns, alley / tunnel corridors and roads (all 0).
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
for (const seed of (process.env.SEEDS || '22,58,130,4,317').split(',')) {
  await page.goto(`http://127.0.0.1:5190/?seed=${seed}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(300);
  console.log('SEED', seed, JSON.stringify(await page.evaluate(() => window.__GAME__.detailAudit())));
}
await browser.close();
