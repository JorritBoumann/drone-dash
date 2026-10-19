// Round 40 builder: minimap acceptance. A simple fixed-step autopilot flies a full run (climb, head for the objective at
// altitude, drop onto the pad). Every minimap draw: the marker angle against the true bearing to the objective (from
// the diagnostics' position, yaw and objective, not the minimap's own numbers). Every 0.25 s of sim: the minimap box
// against the HUD and (phone) the touch controls, meters, pops and objective pill. Screenshots at set moments.
// DEV=desktop|iphone SEED=22 PORT=5190 SHOTS=1 MAXT=200
import { chromium, devices } from '@playwright/test';
const SEED = process.env.SEED || '22', PORT = process.env.PORT || '5190', DEV = process.env.DEV || 'desktop';
const MOBILE = DEV !== 'desktop', P = (MOBILE ? 'm' : 'd') + '-' + SEED, MAXT = Number(process.env.MAXT || 200);
const OUT = process.env.OUTDIR || new URL('../builder-shots/', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}`, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.setItem('drone-dash-played-v1', '1'); localStorage.removeItem('drone-dash-minimap-v1'); } catch {} });
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
await page.evaluate(() => {
  const G = window.__GAME__; G.start(); G.manualRender(true);
  window.__ap = { errs: [], n: 0, clamped: 0, inside: 0, shortcut: 0, lastDraws: -1 };
  window.__apStep = (secs) => {
    const A = window.__ap;
    const keys = (on) => { for (const k of ['KeyW', 'KeyA', 'KeyD', 'Space', 'KeyC', 'KeyE']) G.key(k, on.includes(k)); };
    for (let i = 0; i < Math.round(secs * 60); i++) {
      const d = window.__THREE_GAME_DIAGNOSTICS__;
      if (!d || d.state !== 'playing' || !d.objective?.position) { keys([]); G.advance(1 / 60, false); continue; }
      const p = d.player.position, o = d.objective.position, yaw = d.player.yaw;
      const dx = o.x - p.x, dz = o.z - p.z, hd = Math.hypot(dx, dz);
      const r = dx * Math.cos(yaw) - dz * Math.sin(yaw), f = -dx * Math.sin(yaw) - dz * Math.cos(yaw);
      const ang = Math.atan2(r, f);
      const k = [];
      if (ang > 0.06) k.push('KeyD'); else if (ang < -0.06) k.push('KeyA');
      const cruiseY = 46;
      if (hd > 14) {
        if (p.y < cruiseY - 2) k.push('Space');
        if (p.y > cruiseY - 14 && Math.abs(ang) < 0.7) k.push('KeyW');
      } else {
        if (p.y > o.y + 1.2) k.push('KeyC');
        if (hd > 3 && Math.abs(ang) < 0.5) k.push('KeyW');
      }
      keys(k);
      G.advance(1 / 60, false);
      const mm = G.minimap;
      if (mm.draws !== A.lastDraws && mm.last && Number.isFinite(mm.last.ox)) {
        A.lastDraws = mm.draws;
        const d2 = window.__THREE_GAME_DIAGNOSTICS__, p2 = d2.player.position, o2 = d2.objective?.position;
        if (o2 && Math.abs(o2.x - mm.last.ox) < 0.01) {
          const ex = o2.x - p2.x, ez = o2.z - p2.z, y2 = d2.player.yaw;
          const rr = ex * Math.cos(y2) - ez * Math.sin(y2), ff = -ex * Math.sin(y2) - ez * Math.cos(y2);
          const truth = (Math.atan2(rr, ff) * 180) / Math.PI;
          let e = mm.last.markerAngle - truth; e = ((e + 540) % 360) - 180;
          if (Math.hypot(ex, ez) > 2) { A.errs.push(Math.abs(e)); A.n++; if (mm.last.markerClamped) A.clamped++; else A.inside++; }
          if (mm.last.shortcutShown) A.shortcut++;
        }
      }
    }
    keys([]);
    G.advance(0, true);
    return window.__THREE_GAME_DIAGNOSTICS__.state;
  };
  // the HUD boxes the map must never cover (visible ones only)
  window.__mmOverlap = () => {
    const G = window.__GAME__, box = G.minimap.box; if (!box) return { hits: [], box: null };
    const vis = (el) => { if (!el) return null; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return null; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? r : null; };
    const sel = { stick: '#touch-stick', buttons: '.touch-buttons', meters: '.hud-bottom', slip: '#slip', boost: '.boost', score: '.hud-score', centre: '.hud-center', objective: '#objective', timer: '#timer', route: '#route-hint', right: '.hud-right', pop: '#pop.show', slipPop: '#slip-pop.show', medalPop: '#medal-pop.show', eventPop: '#event-pop.show', gateTag: '#gate-tag.show', view: '#view-hint.show' };
    const hits = [];
    for (const [k, s] of Object.entries(sel)) {
      const el = document.querySelector(s); const r = vis(el); if (!r) continue;
      const pad = k === 'stick' ? 20 : 0; // the stick's "Fly" label above it
      if (r.left < box.r && r.right > box.l && r.top - pad < box.b && r.bottom > box.t) hits.push(k);
    }
    return { hits, box };
  };
});
const st = await page.evaluate(() => ({ mood: window.__THREE_GAME_DIAGNOSTICS__.city.mood, mm: window.__GAME__.minimap }));
console.log(P, 'mood', st.mood, 'minimap', JSON.stringify(st.mm));
let t = 0, overlaps = 0, samples = 0; const overlapKinds = {}; let shots = 0; const shotAt = new Set([3, 12, 30, 60, 100]);
let sawClamped = false, sawInside = false, sawCut = false, state = 'playing';
while (t < MAXT && state === 'playing') {
  state = await page.evaluate(() => window.__apStep(0.25)); t += 0.25;
  await page.waitForTimeout(30);
  const o = await page.evaluate(() => window.__mmOverlap()); samples++;
  if (o.hits.length) { overlaps++; for (const h of o.hits) overlapKinds[h] = (overlapKinds[h] || 0) + 1; }
  const L = await page.evaluate(() => window.__GAME__.minimap.last);
  const want = shotAt.has(t) || (!sawClamped && L?.markerClamped && t > 2) || (!sawInside && L && !L.markerClamped) || (!sawCut && L?.shortcutShown);
  if (L?.markerClamped) sawClamped = true; if (L && !L.markerClamped) sawInside = true; if (L?.shortcutShown) sawCut = true;
  if (process.env.SHOTS !== '0' && want && shots < 7) {
    const tag = shotAt.has(t) ? `t${t}` : L?.shortcutShown ? 'shortcut' : L?.markerClamped ? 'edge' : 'inside';
    await page.screenshot({ path: `${OUT}mm-${P}-${tag}.jpg`, type: 'jpeg', quality: 78 }); shots++;
    const b = (await page.evaluate(() => window.__GAME__.minimap.box));
    if (b) await page.screenshot({ path: `${OUT}mm-${P}-${tag}-zoom.jpg`, type: 'jpeg', quality: 85, clip: { x: b.l - 6, y: b.t - 6, width: b.r - b.l + 12, height: b.b - b.t + 12 } });
  }
}
const res = await page.evaluate(() => { const A = window.__ap; const e = A.errs.slice().sort((a, b) => a - b); const d = window.__THREE_GAME_DIAGNOSTICS__; return { n: A.n, inside: A.inside, clamped: A.clamped, shortcutDraws: A.shortcut, errMax: e.length ? e[e.length - 1] : null, errP99: e.length ? e[Math.floor(e.length * 0.99)] : null, errMean: e.length ? e.reduce((a, b) => a + b, 0) / e.length : null, over5: e.filter((x) => x >= 5).length, deliveries: d.deliveries, score: d.score, state: d.state, crashes: d.crashes, mm: window.__GAME__.minimapStats() }; });
console.log(P, 'simT', t, 'bearing', JSON.stringify(res));
console.log(P, 'overlap samples', overlaps, 'of', samples, JSON.stringify(overlapKinds));
console.log(P, 'errors', errors.length, errors.slice(0, 3));
await browser.close();
