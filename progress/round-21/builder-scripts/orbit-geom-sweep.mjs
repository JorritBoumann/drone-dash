// Round 21 builder: deterministic worst-case sweep. The drone is placed inside every alley and tunnel and tight
// against building walls (seeds 22, 58, 130); at each spot a held drag swings the camera a full turn while the pitch
// rocks between its limits, at the farthest and nearest zoom, then the view is released and eases back.
// Every simulated frame (also the moves between spots) checks the camera against the solid colliders:
// inside (pad 0), near-plane graze (pad 0.15), below street (y < 0.5).
import { chromium } from '@playwright/test';
const URL_ = process.env.URL || 'http://127.0.0.1:5190/';
const seeds = (process.env.SEEDS || '22,58,130').split(',');
const browser = await chromium.launch({ channel: 'chromium' });
const all = [];
for (const seed of seeds) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL_ + '?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const G = window.__GAME__; G.tune({ RUN: { startTime: 100000 } }); G.start(); G.manualRender(true);
    const roads = [-154, -110, -66, -22, 22, 66, 110, 154];
    const spots = [];
    for (const f of G.features()) if (f.kind !== 'diagonal') { spots.push({ k: f.kind, x: f.x, y: 2.4, z: f.z }); if (f.kind === 'alley') spots.push({ k: 'alley-high', x: f.x, y: 7, z: f.z }); }
    // wall hugs: from a road centre, step sideways until the drone sphere would touch a wall, then stop just short
    let rs = 7;
    const rnd = () => ((rs = (rs * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 16; i++) {
      const alongX = i % 2 === 0, road = roads[1 + Math.floor(rnd() * 6)], t = -140 + rnd() * 280, dir = rnd() < 0.5 ? -1 : 1, y = 1.6 + rnd() * 8;
      let s = 0; const pos = (s) => (alongX ? { x: t, z: road + dir * s } : { x: road + dir * s, z: t });
      if (G.insideSolid(pos(0).x, y, pos(0).z, 1.0)) continue;
      while (s < 20 && !G.insideSolid(pos(s + 0.1).x, y, pos(s + 0.1).z, 0.97)) s += 0.1;
      if (s >= 20) continue;
      spots.push({ k: 'wall', ...pos(s), y });
    }
    const process_bad = 12; let frames = 0, inside = 0, near = 0, below = 0, minClear = 99; const bad = [];
    const check = (d, spot, phase) => {
      if (d.state !== 'playing') throw new Error('run ended');
      frames++;
      const c = d.camera;
      const ins = G.insideSolid(c.x, c.y, c.z, 0), nr = G.insideSolid(c.x, c.y, c.z, 0.15);
      if (ins) inside++; if (nr) near++; if (c.y < 0.5) below++;
      if ((ins || nr || c.y < 0.5) && bad.length < (process_bad ?? 12)) bad.push({ spot: spot.k, phase, box: ins ? G.solidAt(c.x, c.y, c.z, 0) : null, f: frames, cam: [c.x, c.y, c.z].map((v) => +v.toFixed(2)), p: [d.player.position.x, d.player.position.y, d.player.position.z].map((v) => +v.toFixed(2)), ins, nr });
    };
    const zooms = [1, -2];
    for (const spot of spots) {
      for (const zs of zooms) {
        G.view(0, 0, zs, false);
        for (const yaw0 of [0, Math.PI / 2]) {
          G.place(spot.x, spot.y, spot.z, yaw0, 0);
          for (let i = 0; i < 40; i++) { G.place(spot.x, spot.y, spot.z, yaw0, 0); check(G.advance(1 / 60, false), spot, 'settle'); }
          for (let i = 0; i < 150; i++) {
            const pitch = Math.sin((i / 150) * Math.PI * 4) * 0.06; // rocks the pitch into both clamps
            G.view((Math.PI * 2) / 150, pitch, 0, true);
            G.place(spot.x, spot.y, spot.z, yaw0, 0);
            check(G.advance(1 / 60, false), spot, 'orbit');
          }
          G.view(0, 0, 0, false);
          for (let i = 0; i < 90; i++) { G.place(spot.x, spot.y, spot.z, yaw0, 0); check(G.advance(1 / 60, false), spot, 'return'); }
        }
      }
    }
    G.view(0, 0, -5, false); G.view(0, 0, 0, false);
    return { spots: spots.length, kinds: spots.reduce((a, s) => ((a[s.k] = (a[s.k] || 0) + 1), a), {}), frames, inside, near, below, bad };
  });
  r.seed = seed; r.errors = errors; all.push(r);
  console.log(JSON.stringify(r));
  await page.close();
}
await browser.close();
