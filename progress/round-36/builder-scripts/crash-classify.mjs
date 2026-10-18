// Round 4 critic: deterministic (manualRender + advance) flights on 8 seeds at a chosen cruise altitude, no boost.
// Logs every charged crash (diagnostics.crashes goes up) with the context a player would feel:
// speed before/after, altitude, distance to target, whether the drone rose right after (ledge-hop signature),
// and whether Space (climb) was held. Also counts free bumps (speed loss 2..7 m/s per 50 ms step, no crash).
// ALT=12 node crash-classify.mjs   (default ALT=12; ALT=40 matches the arrival bot)
import { chromium } from '@playwright/test';
const OUT = (process.env.OUTDIR || new URL('../builder-shots/', import.meta.url).pathname);
const ALT = Number(process.env.ALT || 12); const SIMT = Number(process.env.SIMT || 120);
const seeds = (process.env.SEEDS || '11,22,33,44,7,58,91,130').split(',');
const browser = await chromium.launch({ channel: 'chromium' });
const crashes = []; let free = 0, simTotal = 0, delivTotal = 0, shots = 0;
for (const seed of seeds) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto('http://127.0.0.1:5190/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  await page.evaluate(() => { window.__GAME__.start(); window.__GAME__.manualRender(true); });
  const held = new Set();
  const key = async (k, on) => { if (on && !held.has(k)) { held.add(k); await page.evaluate((k) => window.__GAME__.key(k, true), k); } if (!on && held.has(k)) { held.delete(k); await page.evaluate((k) => window.__GAME__.key(k, false), k); } };
  const step = (s, r = false) => page.evaluate(([s, r]) => JSON.parse(JSON.stringify(window.__GAME__.advance(s, r))), [s, r]);
  let d = await step(0.05); let simT = 0, prev = d, hist = [], unstick = 0, pending = [];
  while (simT < SIMT && d.state === 'playing') {
    const p = d.player.position, c = d.camera, o = d.objective.position;
    const hd = Math.hypot(o.x - p.x, o.z - p.z);
    let err = Math.atan2(o.x - p.x, o.z - p.z) - Math.atan2(p.x - c.x, p.z - c.z); while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
    hist.push([simT, hd]); while (hist.length && hist[0][0] < simT - 3) hist.shift();
    if (unstick <= 0 && hist.length > 50 && Math.abs(hist[0][1] - hd) < 1 && hd > 3) unstick = 1.2;
    if (unstick > 0) { unstick -= 0.05; for (const k of ['KeyW', 'KeyA', 'KeyD', 'ShiftLeft']) await key(k, false); await key('KeyS', true); await key('Space', true); }
    else {
      await key('KeyS', hd < 8 && d.player.speed > 7);
      await key('KeyD', Math.abs(err) > 0.12 && err < 0); await key('KeyA', Math.abs(err) > 0.12 && err > 0);
      await key('KeyW', Math.abs(err) < 0.9 && !(hd < 8 && d.player.speed > 5));
      const wantY = hd > 25 ? Math.max(o.y + 6, ALT) : o.y + 1.2;
      await key('Space', p.y < wantY - 1.5); await key('ShiftLeft', p.y > wantY + 1.5);
    }
    prev = d; d = await step(0.05); simT += 0.05;
    const loss = prev.player.speed - d.player.speed;
    for (const e of pending) if (e.y03 == null && simT - e.t >= 0.3) e.y03 = +d.player.position.y.toFixed(1);
    if (d.crashes > prev.crashes) {
      const e = { seed, t: +simT.toFixed(2), from: +prev.player.speed.toFixed(1), to: +d.player.speed.toFixed(1), y: +d.player.position.y.toFixed(1), hd: +hd.toFixed(0), climbHeld: held.has('Space'), unstick: unstick > 0, carrying: prev.player.carrying, comboLost: prev.combo, timeLost: +(prev.timeLeft - d.timeLeft).toFixed(1) };
      crashes.push(e); pending.push(e);
      if (shots < 8) { shots++; await step(0.0001, true); await page.screenshot({ path: OUT + `K-alt${ALT}-seed${seed}-crash${shots}.jpg`, type: 'jpeg', quality: 80 }); }
    } else if (loss > 2 && loss < 7) free++;
  }
  simTotal += simT; delivTotal += d.deliveries;
  for (const k of [...held]) await key(k, false);
  await page.close();
}
for (const e of crashes) console.log(JSON.stringify({ ...e, rose: e.y03 != null ? +(e.y03 - e.y).toFixed(1) : null }));
const hop = crashes.filter((e) => e.y03 != null && e.y03 - e.y > 0.8 && !e.climbHeld);
console.log(`ALT ${ALT}: sim ${simTotal.toFixed(0)} s, deliveries ${delivTotal}, charged crashes ${crashes.length} (${(crashes.length / simTotal * 60).toFixed(1)}/min), from<10 m/s ${crashes.filter((e) => e.from < 10).length}, rose >0.8 m w/o climb (hop-like) ${hop.length}, near target <30 m ${crashes.filter((e) => e.hd < 30).length}, free bumps ${free}`);
await browser.close();
