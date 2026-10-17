// Round 27 builder: detail kit and people counts on a seed (diagnostics only).
import { chromium, devices } from '@playwright/test';
const MOBILE = !!process.env.MOBILE; const PORT = process.env.PORT || '5190';
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
for (const seed of (process.env.SEEDS || '22,58,130').split(',')) {
  await page.goto(`http://127.0.0.1:${PORT}/?seed=${seed}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  await page.evaluate(() => { window.__GAME__.tune({ RUN: { startTime: 999 } }); window.__GAME__.start(); });
  await page.evaluate(() => window.__GAME__.place(25, 2.4, -30, Math.PI, 0)); await page.waitForTimeout(1500);
  const d = await page.evaluate(() => { const d = window.__THREE_GAME_DIAGNOSTICS__; return { detail: d.detail, calls: d.renderer.calls, tris: d.renderer.triangles, people: d.street.people, drawn: d.street.peopleDrawn }; });
  console.log('SEED', seed, JSON.stringify(d));
}
await browser.close();
