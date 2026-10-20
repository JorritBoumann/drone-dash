// Round 41 critic (new): the platform's 64 px top-left corner vs the world-anchored nav marker (diamond, edge arrow and
// distance pill) and every other painted HUD element. Deterministic sweep: the drone at its start pad and 3 other spots,
// yaw 0..355 in 5 degree steps, 3 heights; per step the camera settles (fixed-step 0.6 s) and every painted element
// inside #app is checked against the corner. Env: PORT (5191), SEED (22), DEVS, Q (extra query, e.g. &hud=canvas).
import { chromium, devices } from '@playwright/test';
const PORT = process.env.PORT || '5191', SEED = process.env.SEED || '22', OUT = process.env.OUTDIR || '/tmp/';
const DEVS = (process.env.DEVS || 'desktop,iPhone 13 landscape,Pixel 7 landscape').split(',');
const browser = await chromium.launch({ channel: 'chromium' });
for (const dev of DEVS) {
  const ctx = await browser.newContext(dev === 'desktop' ? { viewport: { width: 1280, height: 720 } } : { ...devices[dev] });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('drone-dash-played-v1', '1'); } catch {} });
  await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}${process.env.Q || ''}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1000);
  await page.evaluate(() => { window.__GAME__.externalClock(true); window.__GAME__.start(); window.__GAME__.advance(0.3); });
  const res = await page.evaluate(() => {
    const H = window.__GAME__, D = () => window.__THREE_GAME_DIAGNOSTICS__;
    const p0 = D().player.position, o = D().objective.position;
    const spots = [p0, { x: o.x + 60, y: 0, z: o.z + 60 }, { x: o.x - 70, y: 0, z: o.z + 10 }, { x: o.x + 10, y: 0, z: o.z - 80 }];
    const painted = (e) => { const cs = getComputedStyle(e); return cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none' || parseFloat(cs.borderTopWidth) > 0 || [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || ['svg', 'IMG', 'BUTTON'].includes(e.tagName) || cs.borderTopColor !== cs.color && parseFloat(cs.borderBottomWidth) > 0; };
    const shown = (e) => { let p = e, op = 1; while (p && p.id !== 'app') { const s = getComputedStyle(p); if (s.display === 'none' || s.visibility === 'hidden') return false; op *= Number(s.opacity); p = p.parentElement; } return op > 0.05; };
    const hits = {}; let steps = 0, stepsHit = 0, navHit = 0; let first = null;
    for (let si = 0; si < spots.length; si++) for (const alt of [8, 30, 60]) for (let deg = 0; deg < 360; deg += 5) {
      const s = spots[si]; const yaw = deg * Math.PI / 180;
      H.place(s.x, si === 0 ? s.y + alt * 0 + Math.max(alt, s.y) : alt, s.z, yaw, 0); H.advance(0.6, false); H.place(s.x, si === 0 ? Math.max(alt, s.y) : alt, s.z, yaw, 0); H.advance(1 / 60, true);
      steps++; let any = false;
      for (const e of document.querySelectorAll('#app *')) {
        if (e.id === 'game-canvas' || e.id === 'speed-lines' || e.id === 'hit-flash' || /-screen$/.test(e.id) || e.closest('.screen')) continue;
        const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || !(r.left < 64 && r.top < 64 && r.right > 0 && r.bottom > 0)) continue;
        if (!painted(e) || !shown(e)) continue;
        const k = (e.id || e.className?.baseVal || e.className || e.tagName) + ''; hits[k] = (hits[k] || 0) + 1; any = true;
        if (e.closest('#nav-marker')) navHit++;
        if (!first) first = { si, alt, deg, k, r: [r.left, r.top, r.width, r.height].map(Math.round) };
      }
      if (any) stepsHit++;
    }
    return { steps, stepsHit, hits, first, vw: innerWidth, vh: innerHeight };
  });
  console.log('CORNER', dev, process.env.Q || '', JSON.stringify(res), errs.slice(0, 2));
  if (res.first) {
    const f = res.first;
    await page.evaluate(([si, alt, deg]) => { const H = window.__GAME__, D = window.__THREE_GAME_DIAGNOSTICS__; const o = D.objective.position; const p0 = { x: 51.5, y: 14.49, z: 88 }; const spots = [p0, { x: o.x + 60, z: o.z + 60 }, { x: o.x - 70, z: o.z + 10 }, { x: o.x + 10, z: o.z - 80 }]; const s = spots[si]; H.place(s.x, si === 0 ? Math.max(alt, 14.49) : alt, s.z, deg * Math.PI / 180, 0); H.advance(0.6, false); H.place(s.x, si === 0 ? Math.max(alt, 14.49) : alt, s.z, deg * Math.PI / 180, 0); H.advance(1 / 60, true); }, [f.si, f.alt, f.deg]);
    await page.screenshot({ path: OUT + `corner-${dev.split(' ')[0].toLowerCase()}-${SEED}.jpg`, type: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: Math.min(400, res.vw), height: Math.min(200, res.vh) } });
  }
  await ctx.close();
}
await browser.close();
