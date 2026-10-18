// Round 29 critic (new): the one-sample spikes in the camera test (drone box 42-43% of screen height for one 100 ms sample,
// camera distance 8.8 -> 5.9 -> 8.8 m) all came while the bot climbed at about 10 m/s just after a pickup or drop.
// Repro, deterministic (manualRender, 60 Hz steps, real keys): the drone hovers 2.5 m from a facade at 2 m for 2 s, then
// climbs (Space), or climbs while backing off (Space+S, the bot's unstick), or climbs and turns (Space+A), 2.5 s.
// Logs per frame: camera distance, camera move relative to the drone, drone box height / screen height.
import { chromium, devices } from '@playwright/test';
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const MOBILE = !!process.env.MOBILE;
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } })).newPage();
await page.addInitScript(() => { try { localStorage.setItem('drone-dash-played-v1', '1'); } catch {} });
const res = [];
for (const seed of [22, 130]) {
  await page.goto('http://127.0.0.1:' + (process.env.PORT || 5190) + '/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
  await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 999 } }); G.start(); G.manualRender(true); });
  // real pickups and drops: the drone is placed over the objective pad and held there until the pickup / drop lands
  // (the game then holds the wide camera floor for 3.2 s), then it climbs at once
  const modes = ['up', 'upback', 'upturn', 'upfwd'];
  for (let ev = 0; ev < 16; ev++) {
    const mode = modes[ev % 4];
    const got = await page.evaluate(() => { const G = window.__GAME__; let d = window.__THREE_GAME_DIAGNOSTICS__;
      for (let i = 0; i < 300 && !(d.objective && d.objective.position); i++) { G.advance(1 / 60, true); d = window.__THREE_GAME_DIAGNOSTICS__; }
      if (!(d.objective && d.objective.position)) return null; const o = d.objective.position; const c0 = d.player.carrying, n0 = d.deliveries;
      // settle the camera 5 m off the pad first (a teleport leaves the camera far away), then onto the pad
      for (let i = 0; i < 120; i++) { G.place(o.x + 5, o.y + 2.5, o.z, Math.PI / 2, 0); G.advance(1 / 60, true); }
      for (let i = 0; i < 400; i++) { G.place(o.x, o.y + 0.9, o.z, 0, 0); G.advance(1 / 60, true); d = window.__THREE_GAME_DIAGNOSTICS__; if (d.player.carrying !== c0 || d.deliveries !== n0) return { k: d.deliveries !== n0 ? 'drop' : 'pick', wall: G.insideSolid(o.x, o.y + 1, o.z, 4), y: o.y }; }
      return null; });
    if (!got) { console.log('NOEVENT', seed, ev); continue; }
    await page.keyboard.down('Space'); if (mode === 'upback') await page.keyboard.down('KeyS'); if (mode === 'upturn') await page.keyboard.down('KeyA'); if (mode === 'upfwd') await page.keyboard.down('KeyW');
    const shotsSoFar = res.filter((r) => r.shot).length;
    const rows = await page.evaluate((wantShot) => { const G = window.__GAME__, out = []; let last = null;
      for (let i = 0; i < 150; i++) { G.advance(1 / 60, true); const d = window.__THREE_GAME_DIAGNOSTICS__, p = d.player.position, c = d.camera, b = G.droneBox();
        const rel = [c.x - p.x, c.y - p.y, c.z - p.z]; const L = Math.hypot(...rel); const jump = last ? Math.hypot(rel[0] - last[0], rel[1] - last[1], rel[2] - last[2]) : 0; last = rel;
        out.push([+L.toFixed(2), +jump.toFixed(2), +(b.h / innerHeight).toFixed(3), +p.y.toFixed(1)]); if (wantShot && b.h / innerHeight >= 0.4) { out.shot = true; break; } } return { r: out, shot: !!out.shot }; }, shotsSoFar < 3).then((x) => { const r = x.r; r.shot = x.shot; return r; });
    if (rows.shot) await page.screenshot({ path: OUT + `climb29-${process.env.PORT === '5192' ? 'r28-' : ''}${MOBILE ? 'm' : 'd'}-${seed}-${ev}-spike.jpg`, type: 'jpeg', quality: 80 });
    for (const k of ['Space', 'KeyS', 'KeyA', 'KeyW']) await page.keyboard.up(k);
    const big = rows.slice(1).filter((r) => r[1] > 1.7).length;
    const maxHf = Math.max(...rows.map((r) => r[2])), minL = Math.min(...rows.map((r) => r[0])), maxJump = Math.max(...rows.slice(1).map((r) => r[1]));
    res.push({ seed, ev: got.k, wall: got.wall, padY: +got.y.toFixed(1), mode, maxHf, minL, maxJump, over40: rows.filter((r) => r[2] >= 0.4).length, jumps17: big, shot: rows.shot });
    if ((maxHf >= 0.4 || maxJump > 1.8) && res.filter((r) => r.maxHf >= 0.4 || r.maxJump > 1.8).length <= 3) {
      console.log('TRACE', seed, got.k, mode, JSON.stringify(rows.filter((r, i) => i % 3 === 0 || r[2] >= 0.35 || r[1] > 1.5)));
    }
  }
}
const n = res.length, bad = res.filter((r) => r.maxHf >= 0.4), jumps = res.filter((r) => r.maxJump > 1.8);
console.log('CLIMB', MOBILE ? 'mobile' : 'desktop', JSON.stringify({ climbs: n, withHf40: bad.length, framesHf40: res.reduce((a, r) => a + r.over40, 0), framesTotal: n * 150, maxHf: Math.max(...res.map((r) => r.maxHf)), minL: Math.min(...res.map((r) => r.minL)), maxJump: Math.max(...res.map((r) => r.maxJump)), jumpsOver1p8: jumps.length, framesJump17: res.reduce((a, r) => a + r.jumps17, 0), byMode: Object.fromEntries(['up','upback','upturn','upfwd'].map((m) => [m, res.filter((r) => r.mode === m && r.jumps17 > 0).length + '/' + res.filter((r) => r.mode === m).length])), worst: res.sort((a, b) => b.maxHf - a.maxHf).slice(0, 5) }));
await browser.close();
