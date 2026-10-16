// Round 23 builder: debug the camera corridor framing at one tunnel.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto('http://127.0.0.1:5190/?seed=' + (process.env.SEED || 130), { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
await page.evaluate(() => window.__GAME__.tune({ RUN: { startTime: 999 } })); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
const X = Number(process.env.X || 44), Z = Number(process.env.Z || 0);
console.log(JSON.stringify((await page.evaluate(() => window.__GAME__.camCorridors())).filter((c) => Math.abs((c.axis === 'x' ? c.c : (c.a0 + c.a1) / 2) - 0) < 1 || c.roofY < 99)));
await page.evaluate(([x, z]) => window.__GAME__.place(x - 20, 3.2, z, -Math.PI / 2, 8), [X, Z]);
for (let i = 0; i < 12; i++) { await page.waitForTimeout(250); console.log(JSON.stringify(await page.evaluate(() => { const d = window.__THREE_GAME_DIAGNOSTICS__; return { p: d.player.position, c: { x: d.camera.x, y: d.camera.y, z: d.camera.z }, cor: d.camera.corridor }; }))); }
await page.screenshot({ path: new URL('../builder-shots/', import.meta.url).pathname + 'dbg-tunnel.jpg', type: 'jpeg', quality: 70 });
await browser.close();
