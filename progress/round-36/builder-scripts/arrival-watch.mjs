// arrival-metrics.mjs plus a trace and screenshots every ~0.7 s on the final approach of legs whose name contains WATCH.
// Per-leg timing on 4 seeds: cruise (leg start -> first within 30 m) vs final approach (30 m -> trigger).
// Autopilot: steer to target, cruise at 40 m, descend inside 25 m, back off and climb when stalled 3 s.
import { chromium } from '@playwright/test';
const OUT = (process.env.OUTDIR || new URL('../builder-shots/', import.meta.url).pathname);
const browser = await chromium.launch({ channel: 'chromium' });
const all = [];
for (const seed of (process.env.SEEDS || '11,22,33,44').split(',')) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto('http://127.0.0.1:5190/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
  await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  const diag = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__THREE_GAME_DIAGNOSTICS__)));
  const held = new Set(); const setKey = async (k, on) => { if (on && !held.has(k)) { held.add(k); await page.keyboard.down(k); } if (!on && held.has(k)) { held.delete(k); await page.keyboard.up(k); } };
  const start = Date.now(); let leg = null, hist = [], unstick = 0, lastSpeed = 0, shotStall = false;
  const newLeg = (d, el) => ({ seed, phase: d.objective.phase, name: d.objective.name, ty: +d.objective.position.y.toFixed(1), t0: el, t30: null, bumpsFinal: 0, stallsFinal: 0, finalSamples: 0, finalOffscreen: 0, finalOnRoof: 0 });
  while (Date.now() - start < 95000) {
    const d = await diag(); const el = (Date.now() - start) / 1000;
    if (d.state !== 'playing') { if (leg) { leg.end = 'timeout'; leg.final = leg.t30 != null ? +(el - leg.t30).toFixed(1) : null; all.push(leg); } break; }
    if (!leg) leg = newLeg(d, el);
    if (d.objective.phase !== leg.phase || d.objective.name !== leg.name) { leg.end = 'arrived'; leg.cruise = +((leg.t30 ?? el) - leg.t0).toFixed(1); leg.final = leg.t30 != null ? +(el - leg.t30).toFixed(1) : 0; all.push(leg); leg = newLeg(d, el); }
    const p = d.player.position, c = d.camera, o = d.objective.position;
    let err = Math.atan2(o.x - p.x, o.z - p.z) - Math.atan2(p.x - c.x, p.z - c.z); while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
    const hd = Math.hypot(o.x - p.x, o.z - p.z);
    if (leg.t30 == null && hd < 30) leg.t30 = el;
    if (leg.t30 != null && lastSpeed - d.player.speed > 5) leg.bumpsFinal++;
    lastSpeed = d.player.speed;
    if (leg.t30 != null && process.env.WATCH && leg.name.includes(process.env.WATCH) && Math.floor((el - leg.t30) * 1.5) !== leg.__w) { leg.__w = Math.floor((el - leg.t30) * 1.5); console.log('W', leg.name, (el - leg.t30).toFixed(1), 'hd', hd.toFixed(1), 'above', (p.y - o.y).toFixed(1), 'spd', d.player.speed.toFixed(1), 'keys', [...held].join('+')); await page.screenshot({ path: OUT + `W-seed${seed}-${process.env.WATCH}-${(el - leg.t30).toFixed(1)}s.jpg`, type: 'jpeg', quality: 80 }); }
    if (leg.t30 != null) { leg.finalSamples++; const off = await page.evaluate(() => document.getElementById('nav-marker').classList.contains('offscreen')); if (off) leg.finalOffscreen++; if (p.y - o.y > 4 && d.player.speed < 3) leg.finalOnRoof++; }
    hist.push([el, hd]); while (hist.length && hist[0][0] < el - 3) hist.shift();
    if (unstick <= 0 && el - leg.t0 > 3 && hist.length > 5 && Math.abs(hist[0][1] - hd) < 1 && hd > 3) { unstick = 1.5; if (leg.t30 != null) leg.stallsFinal++; if (!shotStall && leg.t30 != null) { shotStall = true; await page.screenshot({ path: OUT + `A-seed${seed}-stall-final-approach.jpg`, type: "jpeg", quality: 80 }); } }
    if (unstick > 0) { unstick -= 0.08; for (const k of ['KeyW', 'KeyA', 'KeyD', 'ShiftLeft', 'KeyE']) await setKey(k, false); await setKey('KeyS', true); await setKey('Space', true); await page.waitForTimeout(60); await setKey('KeyS', false); continue; }
    await setKey('KeyD', Math.abs(err) > 0.12 && err < 0); await setKey('KeyA', Math.abs(err) > 0.12 && err > 0);
    await setKey('KeyW', Math.abs(err) < 0.9 && !(hd < 8 && d.player.speed > 5));
    await setKey('KeyS', hd < 8 && d.player.speed > 7);
    const wantY = hd > 25 ? Math.max(o.y + 6, 40) : o.y + 1.2;
    await setKey('Space', p.y < wantY - 1.5); await setKey('ShiftLeft', p.y > wantY + 1.5);
    await setKey('KeyE', hd > 60 && Math.abs(err) < 0.3 && d.player.boost > 0.3);
    await page.waitForTimeout(60);
  }
  for (const k of [...held]) await setKey(k, false);
  await page.close();
}
for (const l of all) console.log(JSON.stringify(l));
const arr = all.filter((l) => l.end === 'arrived'); const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
console.log('legs', all.length, 'arrived', arr.length, 'timeouts', all.length - arr.length);
console.log('median cruise s', med(arr.map((l) => l.cruise)), 'median final-30m s', med(arr.map((l) => l.final)), 'sum cruise', arr.reduce((a, l) => a + l.cruise, 0).toFixed(1), 'sum final', arr.reduce((a, l) => a + l.final, 0).toFixed(1));
for (const k of ['street (y<2)', 'raised (y>=2)']) { const s = arr.filter((l) => (k[0] === 's') === (l.ty < 2)); console.log(k, 'n', s.length, 'median final', med(s.map((l) => l.final)), 'stalls', s.reduce((a, l) => a + l.stallsFinal, 0)); }
const fs_ = arr.concat(all.filter((l) => l.end !== 'arrived'));
const S = fs_.reduce((a, l) => a + l.finalSamples, 0), Off = fs_.reduce((a, l) => a + l.finalOffscreen, 0), Roof = fs_.reduce((a, l) => a + l.finalOnRoof, 0);
console.log('final-approach samples', S, 'nav marker offscreen', Off, (100 * Off / S).toFixed(1) + '%', 'slow (<3 m/s) and >4 m above target', Roof, (100 * Roof / S).toFixed(1) + '%');
await browser.close();
