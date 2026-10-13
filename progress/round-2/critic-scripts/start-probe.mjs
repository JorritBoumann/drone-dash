// After Enter with no input: when does the target nav marker come on screen, and where is the camera? Also first-second hitches.
import { chromium, devices } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
for (const [name, opts] of [['desktop', { viewport: { width: 1280, height: 720 } }], ['mobile', devices['iPhone 13 landscape']]]) {
  const page = await (await browser.newContext(opts)).newPage();
  await page.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' }); await page.waitForTimeout(2000);
  await page.evaluate(() => { window.__fd = []; let l = performance.now(); const f = (t) => { window.__fd.push(t - l); l = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await page.evaluate(() => window.__GAME__.start());
  const t0 = Date.now(); const samples = [];
  while (Date.now() - t0 < 2500) { samples.push(await page.evaluate(() => { const d = window.__THREE_GAME_DIAGNOSTICS__; const p = d.player.position, c = d.camera; return [document.getElementById('nav-marker').classList.contains('offscreen') ? 'off' : 'on', +Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z).toFixed(1)]; }).then((v) => [Date.now() - t0, ...v])); await page.waitForTimeout(100); }
  const fd = await page.evaluate(() => window.__fd);
  console.log(name, 'first on-screen ms', samples.find((s) => s[1] === 'on')?.[0], 'camDist@0', samples[0][2], 'camDist@1s', samples.find((s) => s[0] > 1000)[2], 'camDist@2.4s', samples.at(-1)[2], 'frames>50ms in first 2.5s', fd.filter((v) => v > 50).map((v) => v.toFixed(0)).join(','));
  console.log('  ', samples.map((s) => s.join(':')).join(' '));
}
await browser.close();
