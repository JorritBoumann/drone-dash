// Round 38 builder: the water31.mjs game-camera views g-cruise and g-low (same drone places, same set-up), each shot
// twice: "hud" (as the player sees it, the old metric) and "clean" (every DOM element hidden except the game canvas,
// so no HUD or overlay pixel reaches the metric). Also the DOM rects of every visible overlay element (rects-*.json),
// so contrast38.py can mask them on the hud shot too. Optional EXTRA=1: water37.mjs views (sea / marina at ALTS).
// Env: PORT (5190), TAG, SEEDS (130,22,33,58), MOBILE=1, OUTDIR, EXTRA=1, ALTS (15,24), PLACES (sea,marina)
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
const OUT = process.env.OUTDIR || '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/c38/shots/';
const PORT = process.env.PORT || '5191'; const TAG = process.env.TAG || 'r38';
const MOBILE = !!process.env.MOBILE; const SEEDS = (process.env.SEEDS || '130,22,33,58').split(',').map(Number);
const EXTRA = !!process.env.EXTRA; const ALTS = (process.env.ALTS || '15,24').split(',').map(Number);
const PLACES = (process.env.PLACES || 'sea,marina').split(','); const METRIC = process.env.METRIC !== '0';
const MOOD = { 130: 'golden', 22: 'morning', 33: 'dusk', 58: 'noon' };
const browser = await chromium.launch({ channel: 'chromium' });
const M = MOBILE ? '-m' : '';
for (const SEED of SEEDS) {
  const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}${MOBILE ? '' : '&post=1'}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
  await page.waitForFunction(() => window.__GAME__.assetsReady().on, null, { timeout: 30000 });
  await page.evaluate(() => { const G = window.__GAME__; G.advance(3, false); G.hideDebugUi?.(true); });
  await page.waitForTimeout(2500); // the title card fades out in real time
  await page.addStyleTag({ content: 'html.clean38 * { visibility: hidden !important; } html.clean38 #game-canvas { visibility: visible !important; }' });
  const rects = {};
  const both = async (name, place) => {
    await place();
    await page.evaluate(() => document.documentElement.classList.add('clean38'));
    await page.screenshot({ path: OUT + `water38-${TAG}${M}-${SEED}-${name}-clean.jpg`, type: 'jpeg', quality: 80 });
    await page.evaluate(() => document.documentElement.classList.remove('clean38'));
    await page.screenshot({ path: OUT + `water38-${TAG}${M}-${SEED}-${name}-hud.jpg`, type: 'jpeg', quality: 80 });
    rects[name] = await page.evaluate(() => {
      const out = []; const dpr = window.devicePixelRatio;
      for (const el of document.querySelectorAll('body *')) {
        if (el.id === 'game-canvas' || el.contains(document.getElementById('game-canvas'))) continue;
        const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
        const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
        out.push([r.left * dpr, r.top * dpr, r.right * dpr, r.bottom * dpr].map(Math.round));
      }
      return out;
    });
  };
  const at = (p, yaw) => () => page.evaluate(([p, yaw]) => { const G = window.__GAME__; for (let i = 0; i < 40; i++) { G.place(p[0], p[1], p[2], yaw, 0); G.advance(1 / 60, false); } G.advance(1 / 60, true); }, [p, yaw]);
  if (METRIC) {
    await both('g-cruise', at([140, 24, 30], -Math.PI / 2));
    await both('g-low', at([182, 2.0, 20], -Math.PI / 2));
  }
  if (EXTRA) {
    const boats = await page.evaluate(() => window.__GAME__.boats());
    const mb = boats.filter((b) => !b.moving).sort((a, b) => Math.hypot(b.x, b.z) - Math.hypot(a.x, a.z))[0];
    const ml = Math.hypot(mb.x, mb.z), ox = mb.x / ml, oz = mb.z / ml;
    const places = { sea: [[182, 20], -Math.PI / 2], marina: [[mb.x + ox * 11, mb.z + oz * 11], Math.atan2(ox, oz)] };
    for (const pl of PLACES) for (const alt of ALTS) {
      const [[x, z], yaw] = places[pl];
      await both(`${MOOD[SEED]}-${pl}-${alt}m`, at([x, alt, z], yaw));
    }
  }
  fs.writeFileSync(OUT + `rects38-${TAG}${M}-${SEED}.json`, JSON.stringify(rects));
  console.log('DONE', SEED, errs.slice(0, 3));
  await ctx.close();
}
await browser.close();
