// Round 31: water (and boats) screenshots from fixed camera poses, one seed per light mood, desktop and phone.
// TAG=before|after PORT=5190 DEV=desktop|phone node water-shots.mjs
import { chromium, devices } from '@playwright/test';
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const PORT = process.env.PORT || 5190;
const TAG = process.env.TAG || 'after';
const DEVS = (process.env.DEV || 'desktop,phone').split(',');
const MOODS = [[130, 'golden'], [22, 'morning'], [4, 'dusk'], [58, 'noon']];
const VIEWS = (process.env.VIEWS || 'cruise,low,shore').split(',');
// camera pose, look target (south shore, the seawall is at z = 164)
const POSE = {
  cruise: [10, 34, 128, 40, 0, 215],
  low: [-30, 2.2, 182, 60, 0.6, 205],
  shore: [-14, 6.5, 158, 30, -0.6, 176],
  marina: [-12, 22, 146, -46, 0, 178],
  wide: [40, 75, 100, -10, 0, 235],
};
const browser = await chromium.launch({ channel: 'chromium' });
for (const dev of DEVS) {
  const ctx = await browser.newContext(dev === 'phone' ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
  for (const [seed, mood] of MOODS) {
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/?seed=${seed}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.evaluate(() => { window.__GAME__.start(); window.__GAME__.manualRender(true); });
    await page.waitForFunction(() => window.__GAME__.assetsReady().on, null, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(800);
    for (const v of VIEWS) {
      const p = POSE[v];
      await page.evaluate((p) => {
        const G = window.__GAME__;
        G.place(p[3] * 0.5 + p[0] * 0.5, Math.max(4, p[1]), Math.min(150, p[2]), 0, 0);
        G.advance(0.5, false);
        G.renderFrom(...p);
      }, p);
      await page.waitForTimeout(100);
      await page.screenshot({ path: `${OUT}${TAG}-water-${dev}-${mood}-${v}.jpg`, type: 'jpeg', quality: 78 });
    }
    const st = await page.evaluate(() => window.__GAME__.renderStats());
    console.log(dev, seed, mood, JSON.stringify(st));
    await page.close();
  }
  await ctx.close();
}
await browser.close();
