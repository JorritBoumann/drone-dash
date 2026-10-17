// Round 31: one shot from a free camera pose. POSE="px,py,pz,tx,ty,tz" SEED OUT [MOBILE] [T=seconds advanced]
import { chromium, devices } from '@playwright/test';
const PORT = process.env.PORT || 5190, SEED = process.env.SEED || 130;
const pose = process.env.POSE.split(',').map(Number);
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext(process.env.MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.evaluate(() => { window.__GAME__.start(); window.__GAME__.manualRender(true); });
await page.waitForFunction(() => window.__GAME__.assetsReady().on, null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(900);
await page.evaluate(([p, t]) => { const G = window.__GAME__; G.place(p[0], Math.max(4, p[1]), Math.min(150, p[2]), 0, 0); G.advance(t, false); G.renderFrom(...p); }, [pose, Number(process.env.T || 0.5)]);
await page.screenshot({ path: process.env.OUT, type: 'jpeg', quality: 80 });
await browser.close();
