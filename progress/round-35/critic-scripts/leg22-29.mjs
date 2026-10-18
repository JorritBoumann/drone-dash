// Round 29 critic (new): both roof bots stall on seed 22's second delivery (picked up at about 20 s, never delivered). Is the
// target reachable? Deterministic (manualRender, 60 Hz). Legs are done by placing the drone on each pad until the second
// delivery is the objective. Then: where is it, what is above it, and does a plain descent from 3 m and from 12 m above it
// deliver? Also where the camera is at that moment (bot heading = camera to drone). PORT for the round 28 build.
import { chromium } from '@playwright/test';
const OUT = (process.env.OUTDIR || new URL('../critic/', import.meta.url).pathname);
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.addInitScript(() => { try { localStorage.setItem('drone-dash-played-v1', '1'); } catch {} });
await page.goto('http://127.0.0.1:' + (process.env.PORT || 5191) + '/?seed=22', { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 999 } }); G.start(); G.manualRender(true); });
const r = await page.evaluate(() => {
  const G = window.__GAME__; const D = () => window.__THREE_GAME_DIAGNOSTICS__; const out = { legs: [] };
  const doEvent = () => { const d = D(), o = d.objective.position, c0 = d.player.carrying, n0 = d.deliveries;
    for (let i = 0; i < 400; i++) { G.place(o.x, o.y + 0.9, o.z, 0, 0); G.advance(1 / 60, true); const e = D(); if (e.player.carrying !== c0 || e.deliveries !== n0) return true; } return false; };
  // leg 1: pick + drop, leg 2: pick
  for (let k = 0; k < 3; k++) { const d = D(); out.legs.push({ phase: d.objective.phase, name: d.objective.name, pos: d.objective.position }); if (!doEvent()) { out.fail = k; return out; } }
  const d = D(); const o = { ...d.objective.position }; out.target = { phase: d.objective.phase, name: d.objective.name, pos: o };
  let roof = null; for (let y = o.y + 1; y < o.y + 60; y += 0.25) if (G.insideSolid(o.x, y, o.z, 0)) { roof = +(y - o.y).toFixed(2); break; }
  out.solidAbovePad = roof;
  const tryDescent = (h) => { const n0 = D().deliveries; G.place(o.x, o.y + h, o.z, 0, 0); for (let i = 0; i < 60; i++) { G.place(o.x, o.y + h, o.z, 0, 0); G.advance(1 / 60, true); }
    G.key('ShiftLeft', true); let t = 0; for (; t < 600 && D().deliveries === n0; t++) G.advance(1 / 60, true); G.key('ShiftLeft', false);
    const e = D(); return { h, delivered: e.deliveries > n0, secs: +(t / 60).toFixed(1), y: +e.player.position.y.toFixed(1), crashes: e.crashes }; };
  out.d3 = tryDescent(3);
  return out;
});
console.log('LEG22', JSON.stringify(r));
await page.screenshot({ path: OUT + `leg22-${process.env.PORT === '5192' ? 'r28' : 'r29'}-target.jpg`, type: 'jpeg', quality: 80 });
await browser.close();
