// Round 16 builder: title and in-run screenshots of cities with different looks (mood, parks). Log: city diagnostics.
import { chromium } from '@playwright/test';
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const seeds = (process.env.SEEDS || '11,22,33,58').split(',');
const browser = await chromium.launch({ channel: 'chromium' });
for (const seed of seeds) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('http://127.0.0.1:5188/' + (seed === 'random' ? '' : '?seed=' + seed), { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
  const c = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.city);
  await page.screenshot({ path: OUT + `L-${c.seed}-${c.mood.replace(/ /g, '')}-title.jpg`, type: 'jpeg', quality: 80 });
  await page.keyboard.press('Enter'); await page.waitForTimeout(2500);
  await page.screenshot({ path: OUT + `L-${c.seed}-${c.mood.replace(/ /g, '')}-play.jpg`, type: 'jpeg', quality: 80 });
  const d = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
  console.log(JSON.stringify({ seed: c.seed, city: c, first: d.objective, errs }));
  await page.close();
}
await browser.close();
