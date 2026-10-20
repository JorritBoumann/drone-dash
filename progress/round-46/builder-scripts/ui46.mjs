// Round 46 builder: screenshots of the new sound controls (title and pause) on desktop, iPhone 13 landscape and iPhone SE
// landscape, plus a click test: the track switch and the effects switch change the audio state and are remembered.
import { chromium, devices } from '@playwright/test';
const PORT = Number(process.env.PORT || 5199); if (PORT === 5188) throw new Error('5188 is the owner');
const OUT = process.env.OUT || '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/b46/shots/';
import fs from 'node:fs'; fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium' });
const sizes = [['desk', { viewport: { width: 1280, height: 720 } }], ['iphone13', { ...devices['iPhone 13 landscape'] }], ['se', { viewport: { width: 568, height: 320 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]];
for (const [name, opts] of sizes) {
  const ctx = await browser.newContext(opts); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/?seed=22`, { waitUntil: 'networkidle' }); await page.waitForTimeout(2000);
  const box = async (sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.offsetParent).map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; }), sel);
  const inView = async (sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.offsetParent).every((e) => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth; }), sel);
  await page.screenshot({ path: OUT + `title-${name}.png` });
  console.log(name, 'title sound row', JSON.stringify(await box('#title-screen .sound-pick')), 'in view', await inView('#title-screen .sound-button'), 'play', JSON.stringify(await box('#play-button')));
  // click Breakbeat, then effects off
  await page.locator('#title-screen .track-button[data-track=breakbeat]').click(); await page.waitForTimeout(400);
  await page.locator('#title-screen .sfx-button').click(); await page.waitForTimeout(300);
  const st = await page.evaluate(() => { const m = window.__THREE_GAME_DIAGNOSTICS__.audio.music; return { track: m.soundtrack, sfx: m.sfxEnabled, playing: m.playing, ls: [localStorage.getItem('drone-dash-track-v1'), localStorage.getItem('drone-dash-sfx-v1')], pressed: [...document.querySelectorAll('#title-screen .sound-button')].map((b) => b.textContent + ':' + b.getAttribute('aria-pressed')) }; });
  console.log(name, 'after clicks', JSON.stringify(st));
  await page.screenshot({ path: OUT + `title-${name}-bb.png` });
  // reload: remembered
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
  console.log(name, 'after reload', JSON.stringify(await page.evaluate(() => { const m = window.__THREE_GAME_DIAGNOSTICS__.audio.music; return { track: m.soundtrack, sfx: m.sfxEnabled, pressed: [...document.querySelectorAll('#title-screen .sound-button')].map((b) => b.textContent + ':' + b.getAttribute('aria-pressed')) }; })));
  // pause screen
  await page.locator('#play-button').click(); await page.waitForTimeout(1500);
  await page.keyboard.press('Escape'); await page.waitForTimeout(600);
  await page.screenshot({ path: OUT + `pause-${name}.png` });
  console.log(name, 'pause sound row', JSON.stringify(await box('#pause-screen .sound-pick')), 'in view', await inView('#pause-screen .sound-button'));
  await page.locator('#pause-screen .track-button[data-track=classic]').click(); await page.waitForTimeout(300);
  await page.locator('#pause-screen .sfx-button').click(); await page.waitForTimeout(300);
  console.log(name, 'pause clicks', JSON.stringify(await page.evaluate(() => { const m = window.__THREE_GAME_DIAGNOSTICS__.audio.music; return { state: window.__THREE_GAME_DIAGNOSTICS__.state, track: m.soundtrack, sfx: m.sfxEnabled }; })));
  // URL flag wins for the page
  await page.goto(`http://127.0.0.1:${PORT}/?seed=22&music=breakbeat`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1000);
  console.log(name, 'url flag', JSON.stringify(await page.evaluate(() => ({ track: window.__THREE_GAME_DIAGNOSTICS__.audio.music.soundtrack, saved: localStorage.getItem('drone-dash-track-v1') }))));
  console.log(name, 'errors', JSON.stringify(errors));
  await ctx.close();
}
await browser.close();
