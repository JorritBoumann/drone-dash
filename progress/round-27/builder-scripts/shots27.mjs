// Round 27 builder: fixed camera poses for before/after facade and people shots. Street level, mid height, cruise height,
// on three seeds (three light moods). MOBILE=1 for iPhone 13 landscape. TAG names the set (before / after).
import { chromium, devices } from '@playwright/test';
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const MOBILE = !!process.env.MOBILE; const TAG = process.env.TAG || 'after';
const seeds = (process.env.SEEDS || '130,4,22').split(',');
const PORT = process.env.PORT || '5190';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const browser = await chromium.launch({ channel: 'chromium' });
const poses = [
  ['street', 25, 2.4, -30, Math.PI],
  ['street-b', -19, 2.6, 40, 0],
  ['junction', 14, 3.0, 8, -Math.PI / 4 * 3],
  ['facade', 63.5, 6, -40, Math.PI * 0.85],
  ['mid', 25, 10, -30, Math.PI],
  ['cruise', 22, 24, -40, Math.PI],
  ['high', 22, 45, -120, Math.PI],
];
for (const seed of seeds) {
  const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://127.0.0.1:' + PORT + '/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  await page.evaluate(() => { window.__GAME__.tune({ RUN: { startTime: 999 } }); window.__GAME__.start(); });
  await page.waitForTimeout(800);
  const mood = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.city.mood);
  const out = {};
  // a park: fountain centre = park pad x - 7.5; look up the north path toward the fountain over the benches
  const park = await page.evaluate(() => window.__GAME__.sites().find((s) => s.kind === 'park'));
  const extra = park ? [['park', park.x - 7.5 + 3.2, 2.6, park.z - 19, Math.PI], ['door', 0, 0, 0, 0]] : [];
  const door = await page.evaluate(() => window.__GAME__.sites().filter((s) => s.kind === 'doorstep').sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0]);
  if (door) extra[1] = ['door', door.x + 5, 2.4, door.z + 5, Math.atan2(-5, -5)];
  for (const [name, x, y, z, yaw] of [...poses, ...extra.filter((e) => e[1] !== 0)]) {
    if (ONLY && !ONLY.includes(name)) continue;
    await page.evaluate(([x, y, z, yaw]) => window.__GAME__.place(x, y, z, yaw, 0), [x, y, z, yaw]);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: OUT + `${TAG}-${MOBILE ? 'm' : 'd'}-${seed}-${name}.jpg`, type: 'jpeg', quality: 82 });
    out[name] = await page.evaluate(() => { const d = window.__THREE_GAME_DIAGNOSTICS__; const g = window.__GAME__; return { calls: d.renderer.calls, tris: d.renderer.triangles, people: d.street.peopleDrawn, crashes: d.crashes, ...(g.archetypesInView ? g.archetypesInView(70) : {}) }; });
  }
  console.log('SEED', seed, mood, JSON.stringify(out), 'ERRORS', JSON.stringify(errors));
  await ctx.close();
}
await browser.close();
