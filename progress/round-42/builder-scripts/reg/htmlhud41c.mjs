// Round 41 critic (new): without ?hud=canvas (and outside the platform) the HTML HUD is the one shown: no canvas-hud class,
// canvas HUD off, the HTML panels painted. Production build (5193), desktop and phone, one screenshot each in play.
import { chromium, devices } from '@playwright/test';
const OUT = process.env.OUTDIR || '/tmp/';
const browser = await chromium.launch({ channel: 'chromium' });
for (const dev of ['desktop', 'iPhone 13 landscape']) {
  const ctx = await browser.newContext(dev === 'desktop' ? { viewport: { width: 1280, height: 720 } } : { ...devices[dev] });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('drone-dash-played-v1', '1'); } catch {} });
  await page.goto('http://127.0.0.1:5193/?seed=22', { waitUntil: 'networkidle' }); await page.waitForTimeout(1000);
  if (dev === 'desktop') await page.keyboard.press('Enter'); else await page.tap('#play-button');
  await page.evaluate(() => window.__GAME__.key('KeyW', true)); await page.waitForTimeout(2500); await page.evaluate(() => window.__GAME__.key('KeyW', false));
  const r = await page.evaluate(() => {
    const vis = (s) => { const e = document.querySelector(s); const cs = getComputedStyle(e); const b = e.getBoundingClientRect(); return cs.visibility + ' ' + Math.round(b.left) + ',' + Math.round(b.top); };
    return { cls: document.getElementById('app').className, chud: window.__GAME__.canvasHud().on, score: vis('.hud-score'), timer: vis('#timer'), objective: vis('#objective'), minimap: vis('#minimap') };
  });
  console.log('HTMLHUD', dev, JSON.stringify(r));
  await page.screenshot({ path: OUT + `htmlhud-${dev === 'desktop' ? 'desk' : 'phone'}-22.jpg`, type: 'jpeg', quality: 80 });
  await ctx.close();
}
await browser.close();
