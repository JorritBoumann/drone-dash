// Round 10 critic: real gesture path (no autoplay flag) and the music toggle, desktop and iPhone 13 landscape (touch).
// Title: first real click/tap starts the title loop. Chip: toggles music, survives reload. Visible on title, pause, game over.
import { chromium, devices } from '@playwright/test';
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chromium' });
for (const MOBILE of [false, true]) {
  const P = MOBILE ? 'm' : 'd';
  const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  const info = () => page.evaluate(() => { const g = window.__THREE_GAME_DIAGNOSTICS__; const b = document.getElementById('music-toggle'); const r = b.getBoundingClientRect(); const cs = getComputedStyle(b); return { state: g.state, ctx: g.audio.state, m: { playing: g.audio.music.playing, enabled: g.audio.music.enabled, gain: g.audio.music.gain, track: g.audio.music.track }, chip: { label: document.getElementById('music-label').innerText, ds: b.dataset.state, vis: r.width > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.1, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }, ls: localStorage.getItem('drone-dash-music-v1') }; });
  const press = async (sel) => { const r = await page.locator(sel).boundingBox(); if (MOBILE) await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); else await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2); };
  await page.goto('http://127.0.0.1:5190/', { waitUntil: 'networkidle' }); await page.evaluate(() => localStorage.removeItem('drone-dash-music-v1')); await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1000);
  console.log(P, 'before gesture', JSON.stringify(await info()));
  await page.screenshot({ path: OUT + `${P}-title-locked.jpg`, type: 'jpeg', quality: 80 });
  // a click / tap on the sky (not on any button)
  const vp = page.viewportSize(); if (MOBILE) await page.touchscreen.tap(vp.width * 0.08, vp.height * 0.12); else await page.mouse.click(vp.width * 0.08, vp.height * 0.12);
  await page.waitForTimeout(2500);
  console.log(P, 'after sky gesture', JSON.stringify(await info()));
  await page.screenshot({ path: OUT + `${P}-title-music-on.jpg`, type: 'jpeg', quality: 80 });
  await press('#music-toggle'); await page.waitForTimeout(600);
  console.log(P, 'after chip press', JSON.stringify(await info()));
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1000);
  console.log(P, 'after reload (pre-gesture)', JSON.stringify(await info()));
  if (MOBILE) await page.touchscreen.tap(vp.width * 0.08, vp.height * 0.12); else await page.mouse.click(vp.width * 0.08, vp.height * 0.12);
  await page.waitForTimeout(1500);
  console.log(P, 'after reload + gesture', JSON.stringify(await info()));
  await page.screenshot({ path: OUT + `${P}-title-music-off-after-reload.jpg`, type: 'jpeg', quality: 80 });
  await press('#music-toggle'); await page.waitForTimeout(600);
  console.log(P, 'chip again', JSON.stringify(await info()));
  // into the run, then pause, then game over
  await press('#play-button').catch(async () => { await page.keyboard.press('Enter'); }); await page.waitForTimeout(1500);
  console.log(P, 'in run', JSON.stringify(await info()));
  await page.evaluate(() => window.__GAME__.pause()); await page.waitForTimeout(500);
  console.log(P, 'paused', JSON.stringify(await info()));
  await page.screenshot({ path: OUT + `${P}-pause-chip.jpg`, type: 'jpeg', quality: 80 });
  await page.evaluate(() => window.__GAME__.resume()); await page.waitForTimeout(300);
  if (!MOBILE) { await page.keyboard.press('KeyM'); await page.waitForTimeout(300); console.log(P, 'M key in run', JSON.stringify(await info())); await page.keyboard.press('KeyM'); await page.waitForTimeout(300); }
  await page.evaluate(() => window.__GAME__.end()); await page.waitForTimeout(2500);
  console.log(P, 'game over', JSON.stringify(await info()));
  await page.screenshot({ path: OUT + `${P}-over-chip.jpg`, type: 'jpeg', quality: 80 });
  console.log(P, 'errors', errors.length, errors.slice(0, 3));
  await ctx.close();
}
await browser.close();
