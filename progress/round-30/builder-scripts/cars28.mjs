// Round 28 critic (new): side views of each car type with the drone (and so the LOD camera) right beside the car.
// MODE=render uses renderFrom from the drone spot; both a near (6 m) and a 30 m side view; also ?assets=0 for the old cars.
import { chromium } from '@playwright/test';
const OUT = '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/r30out/';
const seed = +(process.env.SEED || 22), Q = process.env.Q || '';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(`http://127.0.0.1:5190/?seed=${seed}${Q}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
await page.evaluate(() => { window.__GAME__.start(); window.__GAME__.manualRender(true); });
if (!Q) await page.waitForFunction(() => window.__GAME__.assetsReady().on, null, { timeout: 30000 });
await page.evaluate(() => { const G = window.__GAME__; G.place(22, 3, 40, 0, 0); G.advance(1 / 20, false); });
const cars = await page.evaluate(() => { const out = {}; for (const c of window.__GAME__.traffic()) if (c.kind === 'car' && c.mode === 'lane' && !out[c.type]) out[c.type] = c; return out; });
for (const [t, c] of Object.entries(cars)) for (const d of [6, 30]) {
  await page.evaluate(([c, d]) => { const G = window.__GAME__; const sx = -c.fz, sz = c.fx; const px = c.x + sx * d, pz = c.z + sz * d;
    const ox = c.x + sx * (d + 5), oz = c.z + sz * (d + 5); G.place(ox, 4, oz, 0, 0); G.advance(1 / 60, false); G.place(ox, 4, oz, 0, 0);
    // freeze: render from the drone spot looking at where the car is now
    const now = G.traffic().find((q) => Math.hypot(q.x - c.x, q.z - c.z) < 3) || c; G.renderFrom(px, 1.6, pz, now.x, 0.8, now.z); }, [c, d]);
  await page.screenshot({ path: OUT + `car28-${Q ? 'old' : 'new'}-${seed}-t${t}-${d}m.jpg`, type: 'jpeg', quality: 80 });
}
console.log('CARS', Object.keys(cars).join(','));
await browser.close();
