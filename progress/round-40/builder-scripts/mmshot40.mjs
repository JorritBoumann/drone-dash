// Round 40 builder: close-up of the minimap at device pixel ratio 2 (desktop) / 3 (iPhone), after flying a few seconds.
import { chromium, devices } from '@playwright/test';
const SEED = process.env.SEED || '22', PORT = process.env.PORT || '5190', DEV = process.env.DEV || 'desktop', MOBILE = DEV !== 'desktop';
const OUT = process.env.OUTDIR || new URL('../builder-shots/', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1000);
await page.evaluate((s) => { const G = window.__GAME__; G.start(); G.manualRender(true); G.key('KeyW', true); G.key('KeyD', true); G.advance(Number(s), false); G.key('KeyD', false); G.advance(0.4, true); G.key('KeyW', false); }, process.env.T || '1.2');
await page.waitForTimeout(700);
const b = await page.evaluate(() => window.__GAME__.minimap.box);
await page.screenshot({ path: `${OUT}${process.env.NAME || 'mmclose'}.jpg`, type: 'jpeg', quality: 90, clip: { x: b.l - 8, y: b.t - 8, width: b.r - b.l + 16, height: b.b - b.t + 16 } });
console.log(JSON.stringify(await page.evaluate(() => window.__GAME__.minimap)));
await browser.close();
