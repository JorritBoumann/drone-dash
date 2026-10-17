// Round 32 builder: harbour bus and route shots. The bus docked at the north landing and at the marina, the bus under
// way, and a wide view of the boat routes. Also logs the bus speed profile over 200 s (stops, dwell, cruise).
import { chromium } from '@playwright/test';
const OUT = new URL('./out/', import.meta.url).pathname;
const SEED = Number(process.env.SEED || 22);
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(`http://127.0.0.1:5190/?seed=${SEED}&post=1`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
await page.waitForFunction(() => window.__GAME__.assetsReady().on && window.__GAME__.boats().length > 0, null, { timeout: 30000 });
await page.evaluate(() => window.__GAME__.hideDebugUi?.(true));
await page.waitForTimeout(3500);
const log = [];
let shotDock = 0, shotMove = false;
for (let k = 0; k < 400; k++) {
  const b = await page.evaluate(() => { const G = window.__GAME__; G.advance(0.5, false); const q = G.boats().find((x) => x.kind === 'ferry'); return { x: q.x, z: q.z, yaw: q.yaw, speed: q.speed, t: G.diagnostics().elapsed }; });
  if (k % 4 === 0) log.push([+(k * 0.5).toFixed(1), +b.x.toFixed(1), +b.z.toFixed(1), +b.speed.toFixed(2)]);
  const shoot = async (name, cam, tgt) => { await page.evaluate(([c, t]) => window.__GAME__.renderFrom(c[0], c[1], c[2], t[0], t[1], t[2]), [cam, tgt]); await page.screenshot({ path: OUT + `bus32-${SEED}-${name}.jpg`, type: 'jpeg', quality: 80 }); };
  if (b.speed === 0 && shotDock < 2) {
    const side = b.z > 0 ? 1 : -1;
    await shoot(`docked-${side > 0 ? 'marina' : 'landing'}`, [b.x - 30, 14, b.z - side * 22], [b.x + 2, 0, b.z]);
    shotDock++; k += 20; await page.evaluate(() => window.__GAME__.advance(10, false));
  }
  if (!shotMove && b.speed > 4) { const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw); await shoot('underway', [b.x - fx * 26 + fz * 12, 9, b.z - fz * 26 - fx * 12], [b.x, 0, b.z]); shotMove = true; }
  if (shotDock >= 2 && shotMove) break;
}
console.log('BUS', SEED, JSON.stringify(log));
await page.evaluate(() => window.__GAME__.renderFrom(260, 120, 260, 120, 0, 120));
await page.screenshot({ path: OUT + `bus32-${SEED}-routes.jpg`, type: 'jpeg', quality: 80 });
await browser.close();
