// Round 22 critic: street-life screenshots (real time) at cruise and street level, normal and rush, plus a low pass. MOBILE=1 for iPhone 13.
import { chromium, devices } from '@playwright/test';
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const MOBILE = !!process.env.MOBILE; const P = MOBILE ? 'sl-m' : 'sl-d';
const seeds = (process.env.SEEDS || '4,22,130').split(',');
const browser = await chromium.launch({ channel: 'chromium' });
for (const seed of seeds) {
  const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://127.0.0.1:5190/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  await page.evaluate(() => { window.__GAME__.tune({ RUN: { startTime: 999 } }); window.__GAME__.start(); });
  await page.waitForTimeout(800);
  const mood = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.city.mood);
  const shot = (n) => page.screenshot({ path: OUT + `${P}-${seed}-${n}.jpg`, type: 'jpeg', quality: 80 });
  const place = (x, y, z, yaw, sp = 0) => page.evaluate(([x, y, z, yaw, sp]) => window.__GAME__.place(x, y, z, yaw, sp), [x, y, z, yaw, sp]);
  const st = () => page.evaluate(() => { const d = window.__THREE_GAME_DIAGNOSTICS__; return { ...d.street, calls: d.renderer.calls, tris: d.renderer.triangles }; });
  // cruise height 24 m over a downtown avenue (x = 22), looking along +z
  await place(22, 24, -40, Math.PI); await page.waitForTimeout(1800); await shot('a-cruise24'); const s1 = await st();
  // high, looking far down the avenue: pop-in line
  await place(22, 45, -120, Math.PI); await page.waitForTimeout(1800); await shot('b-high45');
  // street level 2.4 m over the kerb lane, looking along +z
  await place(25, 2.4, -30, Math.PI); await page.waitForTimeout(2200); await shot('c-street'); const s2 = await st();
  // a crossing at street level, looking across the junction
  await place(14, 3.0, 8, -Math.PI / 4 * 3); await page.waitForTimeout(1600); await shot('d-junction');
  // rush hour on, street level
  await page.evaluate(() => window.__GAME__.rush(true)); await page.waitForTimeout(3500);
  await place(25, 3.0, -30, Math.PI); await page.waitForTimeout(1800); await shot('e-rush-street'); const s3 = await st();
  await place(22, 20, -60, Math.PI); await page.waitForTimeout(1500); await shot('f-rush-cruise');
  await page.evaluate(() => window.__GAME__.rush(false));
  // low fast pass along the sidewalk ring (x = 22 + 6 + 1.75), 1.6 m up, 15 m/s
  const r0 = (await st()).reactions;
  await place(29.6, 1.8, -60, Math.PI, 15); await page.keyboard.down('KeyW');
  await page.waitForTimeout(900); await shot('g-lowpass'); await page.waitForTimeout(400); await shot('h-lowpass2');
  await page.waitForTimeout(1200); await page.keyboard.up('KeyW');
  const r1 = await st();
  console.log('SEED', seed, mood, JSON.stringify({ cruise: s1, street: s2, rush: s3, reactionsInPass: r1.reactions - r0, reactingNow: r1.reacting, crashes: await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.crashes), errors }));
  await ctx.close();
}
await browser.close();
