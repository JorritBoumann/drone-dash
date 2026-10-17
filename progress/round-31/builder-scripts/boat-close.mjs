// Round 31: close-ups of a moving boat of each kind (wake, bob, heel) and the moored ones. SEED, PORT.
import { chromium } from '@playwright/test';
const PORT = process.env.PORT || 5190, SEED = Number(process.env.SEED || 22);
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
await page.waitForFunction(() => window.__GAME__.boats().length > 0, null, { timeout: 30000 });
await page.waitForTimeout(900);
for (const kind of ['rib', 'sail', 'ferry']) {
  await page.evaluate((kind) => {
    const G = window.__GAME__;
    const b0 = G.boats().find((b) => b.kind === kind && b.moving);
    G.place(Math.max(-185, Math.min(185, b0.x)), 12, Math.max(-185, Math.min(185, b0.z)), 0, 0);
    G.advance(1 / 60, false);
    const b = G.boats().find((q) => q.kind === kind && q.moving);
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), px = Math.cos(b.yaw), pz = -Math.sin(b.yaw);
    const back = kind === 'ferry' ? 34 : 16, side = kind === 'ferry' ? 18 : 9, up = kind === 'ferry' ? 14 : 6;
    G.renderFrom(b.x - fx * back + px * side, up, b.z - fz * back + pz * side, b.x + fx * 2, 0, b.z + fz * 2);
  }, kind);
  await page.screenshot({ path: `${OUT}after-boat-${SEED}-${kind}.jpg`, type: 'jpeg', quality: 80 });
}
await browser.close();
