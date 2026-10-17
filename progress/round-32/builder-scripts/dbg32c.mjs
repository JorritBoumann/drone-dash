import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
await page.goto('http://127.0.0.1:5190/?seed=22', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
await page.waitForFunction(() => window.__GAME__.assetsReady().on && window.__GAME__.boats().length > 0, null, { timeout: 30000 });
const r = await page.evaluate(() => {
  const G = window.__GAME__; G.advance(2, false); const out = [];
  for (let k = 0; k < 600 && !(G.boats().find((q) => q.kind === 'ferry').speed > 2.5); k++) G.advance(1 / 20, false);
  const b = G.boats().find((q) => q.kind === 'ferry'); const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
  G.place(b.x + fx * (b.len / 2 + 6), 1.4, b.z + fz * (b.len / 2 + 6), Math.atan2(fx, fz), 0);
  for (let i = 0; i < 420; i++) {
    G.advance(1 / 60, false); const d = G.diagnostics(); const p = d.player.position; const bb = G.boats().find((q) => q.kind === 'ferry');
    const ox = p.x - bb.x, oz = p.z - bb.z, s = Math.sin(bb.yaw), c = Math.cos(bb.yaw);
    if (i > 150 && i % 8 === 0) out.push([i, 'lx', (ox * c - oz * s).toFixed(2), 'lz', (ox * s + oz * c).toFixed(2), 'y', p.y.toFixed(2), 'spd', d.player.speed.toFixed(1), 'bus', bb.speed.toFixed(1), bb.yaw.toFixed(2)]);
  }
  return out;
});
for (const l of r) console.log(l.join(' '));
await browser.close();
