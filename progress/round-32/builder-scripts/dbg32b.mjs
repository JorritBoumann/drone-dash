import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
await page.goto('http://127.0.0.1:5190/?seed=22', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
await page.waitForFunction(() => window.__GAME__.assetsReady().on && window.__GAME__.boats().length > 0, null, { timeout: 30000 });
const r = await page.evaluate(() => {
  const G = window.__GAME__; G.advance(2, false); const out = [];
  const b = G.boats().find((q) => q.kind === 'ferry'); const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
  const aimX = b.x + fx * b.speed * 11 / 12, aimZ = b.z + fz * b.speed * 11 / 12; const dx = -fx, dz = -fz; const off = 11 + b.len / 2;
  G.place(aimX - dx * off, 1.4, aimZ - dz * off, Math.atan2(-dx, -dz), 12); G.key('KeyW', true);
  for (let i = 0; i < 140; i++) {
    if (i === 67) G.key('KeyW', false);
    G.advance(1 / 60, false); const d = G.diagnostics(); const p = d.player.position; const bb = G.boats().find((q) => q.kind === 'ferry');
    const ox = p.x - bb.x, oz = p.z - bb.z, s = Math.sin(bb.yaw), c = Math.cos(bb.yaw);
    if (i > 40 && i % 3 === 0) out.push([i, 'lx', (ox * c - oz * s).toFixed(2), 'lz', (ox * s + oz * c).toFixed(2), 'y', p.y.toFixed(2), 'spd', d.player.speed.toFixed(1), 'bus', bb.speed, JSON.stringify(d.contact)]);
  }
  return out;
});
for (const l of r) console.log(l.join(' '));
await browser.close();
