import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
await page.goto('http://127.0.0.1:5190/?seed=22', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
await page.waitForFunction(() => window.__GAME__.assetsReady().on && window.__GAME__.boats().length > 0, null, { timeout: 30000 });
const r = await page.evaluate(() => {
  const G = window.__GAME__; G.advance(2, false);
  const out = [];
  let b = G.boats().filter((q) => q.moving)[0];
  out.push(['boat', b.x, b.z, b.yaw, b.speed, b.y]);
  out.push(['cols', JSON.stringify(G.boatColliders().slice(0, 3))]);
  const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), px = Math.cos(b.yaw), pz = -Math.sin(b.yaw);
  const D = 16, V = 14, T = D / V; const aimX = b.x + fx * b.speed * T, aimZ = b.z + fz * b.speed * T;
  const dx = -px, dz = -pz; const sx = aimX - dx * D, sz = aimZ - dz * D; const yaw = Math.atan2(-dx, -dz);
  G.place(sx, 3.6, sz, yaw, V); G.key('KeyW', true);
  for (let i = 0; i < 60; i++) { G.advance(1 / 60, false); const d = G.diagnostics(); const p = d.player.position; const bb = G.boats().filter((q) => q.moving)[0]; out.push([i, +p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +d.player.speed.toFixed(1), 'boat', +bb.x.toFixed(2), +bb.z.toFixed(2), JSON.stringify(d.contact), d.crashes]); }
  return out;
});
for (const l of r) console.log(l.join(' '));
await browser.close();
