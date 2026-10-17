// Round 28 builder: close-ups from a free camera (renderFrom hook): a walking person (3 frames 0.15 s apart, gait and
// head), the curb strip with street furniture, and the road with traffic. Desktop 1280x720. PORT, SEEDS env.
import { chromium } from '@playwright/test';
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const PORT = process.env.PORT || '5190';
const SEEDS = (process.env.SEEDS || '130,22').split(',');
const PREFIX = process.env.OUT_PREFIX || 'close28';
const browser = await chromium.launch({ channel: 'chromium' });
for (const seed of SEEDS) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto(`http://127.0.0.1:${PORT}/?seed=${seed}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  for (let i = 0; i < 60; i++) { if (await page.evaluate(() => window.__GAME__.assetsReady?.().on ?? true)) break; await page.waitForTimeout(250); }
  await page.evaluate(() => { const G = window.__GAME__; G.start(); G.manualRender(true); });
  await page.addStyleTag({ content: '.hud, #hud, .hud-top, .hud-bottom, #touch-stick, #up-button, #down-button, #boost-button, #pause-button, .nav-arrow, .nav-diamond, #nav-distance, #gate-tag, #pop, #event-pop, #slip-pop, #medal-pop, #view-hint, #music-toggle { visibility: hidden !important; } .screen { display: none !important; }' });
  // park the drone up high out of the way, let the street run
  await page.evaluate(() => { const G = window.__GAME__; for (let i = 0; i < 60; i++) { G.place(22, 30, 0, 0, 0); G.advance(1 / 20, false); } });
  const person = await page.evaluate(() => { const ps = window.__GAME__.people().filter((p) => p.walking); const c = { x: 28, z: 0 }; ps.sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z)); return ps[0]; });
  for (let f = 0; f < 3; f++) {
    await page.evaluate(([f]) => { const G = window.__GAME__; if (f > 0) for (let i = 0; i < 3; i++) { G.place(22, 30, 0, 0, 0); G.advance(1 / 20, false); } }, [f]);
    const p = await page.evaluate(([id]) => { const ps = window.__GAME__.people(); let best = null, bd = 1e9; for (const q of ps) { const d = Math.hypot(q.x - id.x, q.z - id.z); if (d < bd) { bd = d; best = q; } } return best; }, [person]);
    await page.evaluate(([p]) => window.__GAME__.renderFrom(p.x + 3.0, 1.55, p.z + 1.2, p.x, 1.0, p.z), [p]);
    await page.screenshot({ path: `${OUT}${PREFIX}-${seed}-person-f${f}.jpg`, type: 'jpeg', quality: 82 });
    Object.assign(person, { x: p.x, z: p.z });
  }
  await page.evaluate(() => window.__GAME__.renderFrom(29.4, 1.7, -13, 28.6, 0.7, 6));
  await page.screenshot({ path: `${OUT}${PREFIX}-${seed}-curb.jpg`, type: 'jpeg', quality: 82 });
  await page.evaluate(() => window.__GAME__.renderFrom(27.5, 2.2, -8, 20, 0.6, 6));
  await page.screenshot({ path: `${OUT}${PREFIX}-${seed}-road.jpg`, type: 'jpeg', quality: 82 });
  console.log('DONE', seed, JSON.stringify(person));
  await page.context().close();
}
await browser.close();
