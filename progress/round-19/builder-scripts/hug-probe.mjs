// Round 7 critic (copied to round 8): hug-probe. Deterministic (manualRender + advance). Places the drone on a straight street at 7 m,
// at a lateral offset from the road centre, holds forward (optionally capped speed) for 12 s, and counts slipstream
// payouts, mean quality and hug. Offsets 0 (lazy centre), 3, 5, 6.5 (2.5 m from a facade at 9 m).
import { chromium } from '@playwright/test';
const SEED = process.env.SEED || '22'; const T = Number(process.env.T || 12);
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
await page.goto('http://127.0.0.1:5188/?seed=' + SEED, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
const run = (args) => page.evaluate(async ({ x, z, yaw, cap, T, dx, dz }) => {
  const G = window.__GAME__; G.start(); G.manualRender(true); G.advance(0.1, false);
  G.place(x, 7, z, yaw, 8); let d = G.advance(0.05, false); const p0 = d.slipstream.payouts, pts0 = d.slipstream.points, c0 = d.crashes;
  let q = 0, h = 0, n = 0, sp = 0; const startT = d.timeLeft;
  for (let i = 0; i < T * 20; i++) {
    G.key('KeyW', !cap || d.player.speed < cap);
    const y = d.player.position.y; G.key('Space', y < 6.3); G.key('ShiftLeft', y > 7.7);
    d = G.advance(0.05, false); q += d.slipstream.quality; h += d.slipstream.hug; sp += d.player.speed; n++;
  }
  G.key('KeyW', false); G.key('Space', false); G.key('ShiftLeft', false);
  const p = d.player.position;
  return { payouts: d.slipstream.payouts - p0, pts: d.slipstream.points - pts0, chain: d.slipstream.chain, crashes: d.crashes - c0, meanQ: +(q / n).toFixed(2), meanHug: +(h / n).toFixed(2), meanSpeed: +(sp / n).toFixed(1), drift: +(dx ? p.x - x : p.z - z).toFixed(1), travelled: +Math.hypot(p.x - x, p.z - z).toFixed(0) };
}, { ...args, T });
// find yaw that moves along +z
const G0 = await page.evaluate(() => { const G = window.__GAME__; G.start(); G.manualRender(true); const out = []; for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { G.place(22, 7, -150, yaw, 0); G.key('KeyW', true); G.advance(1, false); G.key('KeyW', false); const p = window.__THREE_GAME_DIAGNOSTICS__.player.position; out.push({ yaw, dx: p.x - 22, dz: p.z + 150 }); } return out; });
console.log(JSON.stringify(G0));
const yz = G0.find((o) => o.dz > 3 && Math.abs(o.dx) < 1).yaw;
for (const road of (process.env.ROADS || '-22,22,66').split(',').map(Number)) for (const cap of [0, 9]) for (const off of [0, 3, 5, 6.5]) {
  const r = await run({ x: road + off, z: -150, yaw: yz, cap, dx: 1, dz: 0 });
  console.log(JSON.stringify({ seed: SEED, road, cap: cap || 'cruise', off, ...r }));
}
await browser.close();
