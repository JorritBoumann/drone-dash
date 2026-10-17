// Round 16 critic (new): one city per light mood, desktop (keyboard) and iPhone 13 landscape (CDP touch).
// Title shot, then 5 s of flight (forward + climb) and an in-flight shot. Read-only.
import { chromium, devices } from '@playwright/test';
const OUT = new URL('../critic/', import.meta.url).pathname;
const SEEDS = (process.env.SEEDS || '80258,40443,66012,12668').split(',');
const browser = await chromium.launch({ channel: 'chromium' });
for (const mobile of [false, true]) for (const seed of SEEDS) {
  const ctx = await browser.newContext(mobile ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('http://127.0.0.1:5191/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
  const tag = `L-${mobile ? 'm' : 'd'}-seed${seed}`;
  const info = await page.evaluate(() => { const d = window.__THREE_GAME_DIAGNOSTICS__; const btn = (id) => { const e = document.getElementById(id); if (!e) return null; const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), text: e.innerText }; }; return { mood: d.city.mood, parks: d.city.parks, label: btn('city-label'), newCity: btn('city-new'), daily: btn('city-daily'), play: btn('play-button'), medals: document.getElementById('title-medals')?.innerText }; });
  await page.screenshot({ path: OUT + tag + '-title.jpg', type: 'jpeg', quality: 80 });
  if (mobile) {
    const b = await page.evaluate(() => { const r = document.getElementById('play-button').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await page.touchscreen.tap(b.x, b.y); await page.waitForTimeout(400);
    const cdp = await ctx.newCDPSession(page);
    const box = (id) => page.evaluate((i) => { const r = document.getElementById(i).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; }, id);
    const st = await box('touch-stick'), up = await box('up-button');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: st.x, y: st.y, id: 1 }, { x: up.x, y: up.y, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: st.x, y: st.y - st.w * 0.4, id: 1 }, { x: up.x, y: up.y, id: 2 }] });
    await page.waitForTimeout(2500);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: up.x, y: up.y, id: 2 }] });
    await page.waitForTimeout(2500);
  } else {
    await page.keyboard.press('Enter'); await page.waitForTimeout(400);
    await page.keyboard.down('KeyW'); await page.keyboard.down('Space'); await page.waitForTimeout(2500); await page.keyboard.up('Space'); await page.waitForTimeout(2500);
  }
  await page.screenshot({ path: OUT + tag + '-flight.jpg', type: 'jpeg', quality: 80 });
  const d = await page.evaluate(() => { const d = window.__THREE_GAME_DIAGNOSTICS__; return { state: d.state, y: d.player.position.y, crashes: d.crashes, obj: d.objective.name }; });
  console.log('LOOK ' + JSON.stringify({ seed, mobile, ...info, after5s: d, errors: errs.length }));
  await ctx.close();
}
await browser.close();
