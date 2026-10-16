// Round 22 builder: pedestrian probe. Deterministic (manualRender + advance). SEEDS (default 22,58,130). Port 5190.
// 1. Placement: every person (all of them, near or frozen) sampled once a second for 20 s while the drone hops round the
//    city: inside a solid collider at 1 m (__GAME__.insideSolid), or standing on the road (closer than 5.9 m to a street
//    centre line). Both must be 0.
// 2. Pads: LEGS legs per seed. For a ground pad (doorstep, park, depot) the drone waits 30 m off for 3 s, then flies in
//    low (8 m/s over the last 12 m) and lands on it; every 0.05 s of the last 2.5 s before the pickup or drop, and on the
//    frame of it, counts people inside the pad radius. Rooftop legs are just completed. Must be 0.
// 3. Reaction: the drone flies low (3 m) and fast (about 14 m/s) along a curb for 6 s, then high (30 m) on the same line.
//    Counts reactions (duck, arms up, look up, step aside) in each pass and shoots one frame mid-reaction.
import { chromium } from '@playwright/test';
const SEEDS = (process.env.SEEDS || '22,58,130').split(',').map(Number);
const LEGS = Number(process.env.LEGS || 12);
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chromium' });
const tot = { inside: 0, onRoad: 0, padViol: 0, groundLegs: 0, lowReact: 0, highReact: 0 };
for (const seed of SEEDS) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:5190/?seed=${seed}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
  // 3. reaction: low pass along the curb of the street at x = -22 (block edge at x = -16), then high
  await page.evaluate(() => window.__GAME__.start()); await page.waitForTimeout(1500);
  const before = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.street.reactions);
  await page.evaluate(() => window.__GAME__.place(-17.2, 3, -150, Math.PI, 14));
  await page.keyboard.down('KeyW');
  let shot = false, maxReacting = 0;
  for (let k = 0; k < 30; k++) {
    await page.waitForTimeout(200);
    const st = await page.evaluate(() => { const d = window.__THREE_GAME_DIAGNOSTICS__; return { r: d.street.reacting, y: d.player.position.y, v: d.player.speed }; });
    await page.evaluate(() => { const p = window.__THREE_GAME_DIAGNOSTICS__.player.position; if (p.y > 3.6 || p.y < 2.4) window.__GAME__.place(-17.2, 3, p.z, Math.PI, Math.max(12, window.__THREE_GAME_DIAGNOSTICS__.player.speed)); });
    maxReacting = Math.max(maxReacting, st.r);
    if (!shot && st.r >= 3) { shot = true; await page.screenshot({ path: `${OUT}react-s${seed}.jpg`, type: 'jpeg', quality: 82 }); }
  }
  await page.keyboard.up('KeyW');
  const mid = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.street.reactions);
  await page.evaluate(() => window.__GAME__.place(-17.2, 30, -150, Math.PI, 14));
  await page.keyboard.down('KeyW');
  for (let k = 0; k < 30; k++) { await page.waitForTimeout(200); await page.evaluate(() => { const p = window.__THREE_GAME_DIAGNOSTICS__.player.position; if (p.y < 28) window.__GAME__.place(-17.2, 30, p.z, Math.PI, Math.max(12, window.__THREE_GAME_DIAGNOSTICS__.player.speed)); }); }
  await page.keyboard.up('KeyW');
  const after = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.street.reactions);
  const react = { low: mid - before, high: after - mid, maxReacting, shot };
  const res = await page.evaluate(async ([LEGS]) => {
    const g = window.__GAME__;
    g.start(); g.manualRender(true);
    const D = () => window.__THREE_GAME_DIAGNOSTICS__;
    const rc = [-154, -110, -66, -22, 22, 66, 110, 154];
    const near = (v) => rc.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
    // 1. placement
    let inside = 0, onRoad = 0, checked = 0;
    const hops = [[0, 0], [-100, -60], [80, 90], [-130, 120], [120, -120]];
    for (let s = 0; s < 20; s++) {
      const h = hops[s % hops.length];
      g.place(h[0] + 3, 25, h[1] + 3, 0, 0);
      g.advance(1, false);
      for (const p of g.people()) {
        checked++;
        if (g.insideSolid(p.x, p.y + 0.8, p.z, 0)) inside++;
        if (Math.abs(p.x) < 182 && Math.abs(p.z) < 182 && (Math.abs(p.x - near(p.x)) < 5.9 || Math.abs(p.z - near(p.z)) < 5.9)) onRoad++;
      }
    }
    // 2. pads
    const sites = g.sites();
    let padViol = 0, groundLegs = 0, legs = 0, maxNear = 0;
    const legLog = [];
    while (legs < LEGS && D().state === 'playing') {
      const o = D().objective; const t = o.position; const phase = o.phase;
      const site = sites.find((s) => Math.abs(s.x - t.x) < 0.01 && Math.abs(s.z - t.z) < 0.01);
      const radius = site ? ({ doorstep: 1.7, park: 2.4, depot: 2.6, rooftop: 3 })[site.kind] : 2;
      const ground = t.y < 2;
      let viol = 0, peak = 0, around = 0;
      const count = () => { const ps = g.people(); around = Math.max(around, ps.filter((p) => Math.hypot(p.x - t.x, p.z - t.z) < radius + 4).length); return ps.filter((p) => Math.hypot(p.x - t.x, p.z - t.z) < radius).length; };
      if (ground) {
        groundLegs++;
        // wait off the pad, then come in low along x
        g.place(t.x - 30, 12, t.z, -Math.PI / 2, 0);
        g.advance(3, false);
        for (let k = 0; k < 50; k++) {
          const u = k / 50;
          g.place(t.x - 12 * (1 - u), t.y + 1.2 + 6 * (1 - u), t.z, -Math.PI / 2, 4);
          g.advance(0.05, false);
          const c = count(); peak = Math.max(peak, c); if (c) viol++;
          if (D().objective.phase !== phase || D().objective.name !== o.name) break;
        }
      }
      // land on it (the pickup / drop fires on arrival)
      for (let k = 0; k < 20 && D().objective.phase === phase && D().objective.name === o.name; k++) {
        g.place(t.x, t.y + 1.0, t.z, 0, 0);
        if (ground) { const c = count(); peak = Math.max(peak, c); if (c) viol++; }
        g.advance(0.05, false);
      }
      padViol += viol; maxNear = Math.max(maxNear, peak);
      legLog.push({ kind: site?.kind ?? '?', phase, viol, peak, around });
      legs++;
    }
    return { checked, inside, onRoad, legs, groundLegs, padViol, maxNear, legLog, street: D().street };
  }, [LEGS]);
  console.log('PEOPLE ' + JSON.stringify({ seed, ...res, legLog: undefined, react, errors }));
  console.log('LEGS ' + JSON.stringify(res.legLog));
  tot.inside += res.inside; tot.onRoad += res.onRoad; tot.padViol += res.padViol; tot.groundLegs += res.groundLegs; tot.lowReact += react.low; tot.highReact += react.high;
  await page.close();
}
console.log('TOTAL ' + JSON.stringify(tot));
await browser.close();
