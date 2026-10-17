// Round 23 critic: seed 44 Gallery Tunnel (0,0): the cam-clip bot stalled at x = -13.2 with the drone hidden. Reproduce.
import { chromium } from '@playwright/test';
const OUT = new URL('./out/', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto('http://127.0.0.1:5190/?seed=44', { waitUntil: 'networkidle' }); await page.waitForTimeout(1000);
await page.evaluate(() => window.__GAME__.tune({ RUN: { startTime: 999 } }));
await page.keyboard.press('Enter'); await page.waitForTimeout(600);
const info = await page.evaluate(() => { const G = window.__GAME__; const cor = G.camCorridors(); const near = cor.filter((c) => Math.abs((c.axis === 'x' ? 0 : 0) - c.c) < 30 && c.a0 < 30 && c.a1 > -30);
  const solids = []; for (let x = -24; x <= 0; x += 1) { const s = G.solidAt(x, 3.2, 0.5, 0); if (s.length) solids.push([x, s.map((b) => [b.minX, b.maxX, b.minY, b.maxY, b.minZ, b.maxZ].map((v) => +v.toFixed(1)))]); }
  const f = G.features().filter((f) => Math.hypot(f.x, f.z) < 30); return { near, solids: solids.slice(0, 4), f }; });
console.log(JSON.stringify(info));
await page.evaluate(() => window.__GAME__.place(-32, 3.2, 0, -Math.PI / 2, 8)); await page.waitForTimeout(300);
await page.keyboard.down('KeyW'); await page.waitForTimeout(2500);
await page.screenshot({ path: OUT + 'dbg-44-gallery-a.jpg', type: 'jpeg', quality: 80 });
await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
const d = await page.evaluate(() => { const d = window.__THREE_GAME_DIAGNOSTICS__; return { p: d.player.position, sp: d.player.speed, cam: { x: d.camera.x, y: d.camera.y, z: d.camera.z }, crashes: d.crashes, contact: d.contact }; });
console.log(JSON.stringify(d));
await page.screenshot({ path: OUT + 'dbg-44-gallery-b.jpg', type: 'jpeg', quality: 80 });
await page.evaluate(() => window.__GAME__.place(-13.2, 12, 0.5, -Math.PI / 2, 0)); await page.waitForTimeout(1500);
await page.screenshot({ path: OUT + 'dbg-44-gallery-c-above.jpg', type: 'jpeg', quality: 80 });
await browser.close();
