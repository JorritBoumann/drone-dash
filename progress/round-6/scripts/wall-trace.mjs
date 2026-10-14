import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
await page.goto('http://127.0.0.1:5188/?seed=22', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
await page.evaluate(() => { window.__GAME__.start(); window.__GAME__.manualRender(true); });
const out = await page.evaluate(() => {
  const G = window.__GAME__; const bx = 8, rz = 22; let face = null;
  for (let d = 5; d <= 20; d += 0.5) { G.place(bx, 10, rz - d, 0, 0); const r = G.advance(1 / 60); if (r.player.position.z > rz - d + 0.3) { face = rz - d + 0.95; break; } }
  const res = {};
  for (const hold of [true, false]) {
    G.key('KeyW', false); G.place(bx, 10, rz, 0, 0); G.advance(1.5);
    G.place(bx, 10, face + 1.5, 0, 16); let d = G.advance(1 / 60); if (hold) G.key('KeyW', true);
    const rows = [];
    for (let i = 0; i < 20; i++) { d = G.advance(1 / 60); rows.push([+d.player.position.z.toFixed(2), +d.player.speed.toFixed(2), +d.contact.wallLoss.toFixed(2), +d.contact.bump.toFixed(1)]); }
    G.key('KeyW', false); res[hold ? 'held' : 'off'] = { face, rows, last: d.lastCrash };
  }
  return res;
});
console.log(JSON.stringify(out));
await browser.close();
