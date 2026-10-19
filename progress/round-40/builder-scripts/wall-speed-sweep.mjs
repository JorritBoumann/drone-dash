// Round 5 critic: head-on hits into real block faces at set speeds, 10 m up, with W held (pressing into the wall) or W released.
// For each candidate face: find the face by placing the drone at rest and seeing where it gets pushed out,
// then place it 2 m short of the face at speed v, run 0.75 s, and read whether a crash was charged.
// 1.5 s of idle hover between tests so the game's 1.2 s crash window never hides a charge.
import { chromium } from '@playwright/test';
const seed = process.env.SEED || '22'; const Y = Number(process.env.Y || 10);
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto('http://127.0.0.1:5190/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
await page.evaluate(() => { window.__GAME__.start(); window.__GAME__.manualRender(true); });
const roads = [-154, -110, -66, -22, 22, 66, 110, 154];
const speeds = [3, 4, 5, 6, 7, 8, 10, 12, 16];
const rows = []; let faces = 0;
for (const rz of roads.slice(1)) for (const bx of [-140, -124, -96, -80, -52, -36, -8, 8, 36, 52, 80, 96, 124, 140]) {
  const face = await page.evaluate(([bx, rz, Y]) => {
    const G = window.__GAME__;
    for (let d = 5; d <= 20; d += 0.5) { G.place(bx, Y, rz - d, 0, 0); const r = G.advance(1 / 60); if (r.player.position.z > rz - d + 0.3) return rz - d + 0.95; }
    return null;
  }, [bx, rz, Y]);
  if (face == null) continue;
  // building must reach well above Y (no hop): check the column at Y+3 also blocks
  const tall = await page.evaluate(([bx, z, Y]) => { const G = window.__GAME__; G.place(bx, Y + 3, z - 0.6, 0, 0); const r = G.advance(1 / 60); return r.player.position.z > z - 0.6 + 0.3; }, [bx, face, Y]);
  if (!tall) continue;
  faces++;
  for (const hold of [true, false]) for (const v of speeds) {
    const r = await page.evaluate(([bx, rz, face, v, hold, Y]) => {
      const G = window.__GAME__; G.key('KeyW', false);
      { const q = G.diagnostics(); if (q.state !== 'playing' || q.timeLeft < 20) { G.restart(); G.start(); G.manualRender(true); } }
      G.place(bx, Y, rz, 0, 0); G.advance(1.5);
      G.place(bx, Y, face + 2.0, 0, v); let d = G.advance(1 / 60); const c0 = d.crashes, t0 = d.timeLeft;
      if (hold) G.key('KeyW', true);
      let sumWall = 0, ledge = 0;
      for (let i = 0; i < 45; i++) { d = G.advance(1 / 60); sumWall += d.contact?.wallLoss || 0; ledge += d.contact?.ledge || 0; }
      G.key('KeyW', false);
      return { crashes: d.crashes - c0, loss: d.lastCrash ? +d.lastCrash.loss.toFixed(1) : null, sumWall: +sumWall.toFixed(1), ledge: +ledge.toFixed(1), timeLost: +(t0 - d.timeLeft).toFixed(2) };
    }, [bx, rz, face, v, hold, Y]);
    rows.push({ bx, rz, v, hold, ...r });
  }
}
for (const r of rows.filter((r) => r.v === 6 && r.hold)) console.log(JSON.stringify(r));
console.log(`seed ${seed}, y ${Y} m, tall faces tested: ${faces}`);
for (const hold of [true, false]) for (const v of speeds) {
  const s = rows.filter((r) => r.hold === hold && r.v === v); const ch = s.filter((r) => r.crashes > 0);
  console.log(`W ${hold ? 'held' : 'off '} impact ${String(v).padStart(2)} m/s: charged ${ch.length}/${s.length}  game loss when charged ${ch.map((r) => r.loss).sort((a, b) => a - b).join(',')}`);
}
await browser.close();
