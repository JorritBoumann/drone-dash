// Round 23 critic: diagonal promenade screenshots (desktop and iPhone 13 landscape). Drone hovers on the promenade looking
// along it at 5 m and 16 m, plus one shot from the side street. No camera input.
import { chromium, devices } from '@playwright/test';
const OUT = new URL('../../builder-shots/', import.meta.url).pathname;
const MOBILE = !!process.env.MOBILE; const P = MOBILE ? 'm' : 'd';
const browser = await chromium.launch({ channel: 'chromium' });
for (const seed of (process.env.SEEDS || '22,4').split(',')) {
  const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:5190/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(1000);
  await page.evaluate(() => window.__GAME__.tune({ RUN: { startTime: 999 } }));
  if (MOBILE) await page.tap('#play-button'); else await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  const diags = await page.evaluate(() => {
    const G = window.__GAME__;
    return G.features().filter((f) => f.kind === 'diagonal').map((f) => {
      const clear = (dx, dz) => { let n = 0; for (let s = -40; s <= 40; s += 4) if (!G.insideSolid(f.x + dx * s, 2, f.z + dz * s, 0)) n++; return n; };
      const a = clear(Math.SQRT1_2, Math.SQRT1_2), b = clear(Math.SQRT1_2, -Math.SQRT1_2);
      return { name: f.name, x: f.x, z: f.z, dx: Math.SQRT1_2, dz: a >= b ? Math.SQRT1_2 : -Math.SQRT1_2 };
    });
  });
  for (const [i, f] of diags.slice(0, 2).entries()) {
    for (const h of [5, 16]) {
      const off = 20; const x = f.x - f.dx * off, z = f.z - f.dz * off; const yaw = Math.atan2(-f.dx, -f.dz);
      await page.evaluate(([x, h, z, yaw]) => window.__GAME__.place(x, h, z, yaw, 0), [x, h, z, yaw]);
      await page.waitForTimeout(1800);
      await page.screenshot({ path: OUT + `prom-${P}-${seed}-${i}-${h}m.jpg`, type: 'jpeg', quality: 80 });
    }
  }
  console.log('DIAG', seed, JSON.stringify(diags));
  await ctx.close();
}
await browser.close();
