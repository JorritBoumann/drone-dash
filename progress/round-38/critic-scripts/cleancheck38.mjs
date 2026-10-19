// Round 38 critic (new): is the water38 "clean" shot really free of every HUD and DOM overlay pixel? Same set-up and
// drone places as water38.mjs. In the clean state it then also hides the game canvas: what is left on screen must be the
// plain page background. Any pixel that differs from it is a DOM element (or pseudo-element) still painting.
// It also lists elements and ::before/::after that still compute as visible. PNG shots. Env: PORT, SEEDS, MOBILE=1.
import { chromium, devices } from '@playwright/test';
const OUT = process.env.OUTDIR || '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/c38/shots/';
const PORT = process.env.PORT || '5191'; const MOBILE = !!process.env.MOBILE; const SEEDS = (process.env.SEEDS || '130,33').split(',').map(Number);
const browser = await chromium.launch({ channel: 'chromium' });
const M = MOBILE ? '-m' : '';
for (const SEED of SEEDS) {
  const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}${MOBILE ? '' : '&post=1'}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
  await page.waitForFunction(() => window.__GAME__.assetsReady().on, null, { timeout: 30000 });
  await page.evaluate(() => { const G = window.__GAME__; G.advance(3, false); G.hideDebugUi?.(true); });
  await page.waitForTimeout(2500);
  await page.addStyleTag({ content: 'html.clean38 * { visibility: hidden !important; } html.clean38 #game-canvas { visibility: visible !important; } html.nocanvas38 #game-canvas { visibility: hidden !important; }' });
  for (const [name, p, yaw] of [['g-cruise', [140, 24, 30], -Math.PI / 2], ['g-low', [182, 2.0, 20], -Math.PI / 2]]) {
    await page.evaluate(([p, yaw]) => { const G = window.__GAME__; for (let i = 0; i < 40; i++) { G.place(p[0], p[1], p[2], yaw, 0); G.advance(1 / 60, false); } G.advance(1 / 60, true); }, [p, yaw]);
    await page.evaluate(() => document.documentElement.classList.add('clean38'));
    const still = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('*')) {
        if (el.id === 'game-canvas') continue;
        for (const pse of [null, '::before', '::after']) {
          const cs = getComputedStyle(el, pse);
          if (pse && (cs.content === 'none' || cs.content === 'normal')) continue;
          if (cs.visibility !== 'hidden' && cs.display !== 'none' && el !== document.documentElement && el !== document.body && el !== document.head && !el.closest('head')) out.push((el.id ? '#' + el.id : el.tagName + '.' + el.className) + (pse || ''));
        }
      }
      return out.slice(0, 20);
    });
    await page.screenshot({ path: OUT + `clean38${M}-${SEED}-${name}-clean.png` });
    await page.evaluate(() => document.documentElement.classList.add('nocanvas38'));
    await page.screenshot({ path: OUT + `clean38${M}-${SEED}-${name}-nocanvas.png` });
    await page.evaluate(() => document.documentElement.classList.remove('clean38', 'nocanvas38'));
    const bg = await page.evaluate(() => [getComputedStyle(document.documentElement).backgroundColor, getComputedStyle(document.body).backgroundColor, getComputedStyle(document.body).backgroundImage]);
    console.log('CLEAN', SEED, name, JSON.stringify({ stillVisible: still, bg }));
  }
  await ctx.close();
}
await browser.close();
