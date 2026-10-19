// Round 42 builder: acceptance 1, 4 and 5 in one real-time run per device / seed / HUD mode.
// The round 39 video pilot flies a whole run. An in-page sampler checks EVERY animation frame (not every 100 ms):
//  1. corner: nav marker parts (diamond, arrow, distance pill), the gate tag (pill and arrow), every HTML HUD panel and
//     centre pop that is visible, and (canvas HUD) every canvas panel box, against the 64 px top-left corner.
//  4. overlaps: event labels (visible HTML pops, or the canvas event panel) vs the objective pill and the score panel,
//     and the objective pill vs the score panel.
//  5. at game over (canvas HUD): the HTML is hidden and the page shot shows only the canvas (game-over card).
// Env: PORT (5191), RUNS ("iphone:22,android:58,..."), MODES ("canvas,html"), MAXT (s), OUTDIR.
import { chromium, devices } from '@playwright/test';
const PORT = process.env.PORT || '5191', OUT = process.env.OUTDIR || '/tmp/', MAXT = Number(process.env.MAXT || 260);
const RUNS = (process.env.RUNS || 'iphone:22,iphone:58,iphone:130,android:22,android:58,android:130').split(',');
const MODES = (process.env.MODES || 'canvas,html').split(',');
const DEV = {
  iphone: { ...devices['iPhone 13 landscape'] },
  android: { viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, userAgent: devices['Pixel 7'].userAgent },
  desktop: { viewport: { width: 1280, height: 720 } },
};
const sampler = () => {
  const R = (window.__R42 = { frames: 0, corner: 0, cornerParts: {}, ov: {}, ovFrames: 0, firstCorner: null, firstOv: null, running: false });
  const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null; };
  const vis = (e) => { if (!e) return false; let n = e; while (n && n !== document.body) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return false; n = n.parentElement; } return true; };
  const inCorner = (b) => b && b.l < 64 && b.t < 64 && b.r > 0 && b.b > 0;
  const hit = (a, b) => a && b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
  const cb = (p) => p && p.box ? { l: p.box.x, t: p.box.y, r: p.box.x + p.box.w, b: p.box.y + p.box.h } : null;
  function tick() {
    requestAnimationFrame(tick);
    const st = window.__THREE_GAME_DIAGNOSTICS__?.state;
    if (st !== 'playing') return;
    R.running = true;
    R.frames++;
    const parts = [];
    const nav = document.getElementById('nav-marker');
    if (nav && getComputedStyle(nav).display !== 'none') for (const s of ['.nav-diamond', '.nav-arrow', '.nav-distance']) { const e = nav.querySelector(s); if (e && Number(getComputedStyle(e).opacity) > 0.05) parts.push(['nav' + s, box(e)]); }
    const gt = document.getElementById('gate-tag');
    if (gt && gt.classList.contains('show') && vis(gt)) for (const e of gt.querySelectorAll('*')) if (vis(e)) parts.push(['gate', box(e)]);
    const chud = document.getElementById('app').classList.contains('canvas-hud');
    const H = { score: document.querySelector('.hud-score'), objective: document.getElementById('objective'), timer: document.getElementById('timer'), right: document.querySelector('.hud-right'), minimap: document.getElementById('minimap') };
    const pops = ['pop', 'slip-pop', 'medal-pop', 'event-pop'].map((id) => document.getElementById(id));
    let score, obj, events = [];
    if (!chud) {
      for (const [k, e] of Object.entries(H)) if (vis(e)) parts.push(['html-' + k, box(e)]);
      for (const e of pops) if (vis(e)) { parts.push(['html-' + e.id, box(e)]); events.push([e.id, box(e)]); }
      score = vis(H.score) ? box(H.score) : null; obj = vis(H.objective) ? box(H.objective) : null;
    } else {
      const s = window.__GAME__.canvasHud();
      const P = Object.fromEntries((s.panels || []).map((p) => [p.name, p]));
      for (const p of s.panels || []) if (p.visible && p.opacity > 0.05) parts.push(['canvas-' + p.name, cb(p)]);
      score = P.score?.visible ? cb(P.score) : null; obj = P.objective?.visible ? cb(P.objective) : null;
      if (P.event?.visible && P.event.opacity > 0.05) events.push(['canvas-event', cb(P.event)]);
    }
    let cHit = false;
    for (const [k, b] of parts) if (inCorner(b)) { cHit = true; R.cornerParts[k] = (R.cornerParts[k] || 0) + 1; if (!R.firstCorner) R.firstCorner = { k, b, f: R.frames }; }
    if (cHit) R.corner++;
    let o = false;
    const add = (k, a, b) => { if (hit(a, b)) { o = true; R.ov[k] = (R.ov[k] || 0) + 1; if (!R.firstOv) R.firstOv = { k, a, b, f: R.frames }; } };
    add('objective-score', obj, score);
    for (const [k, b] of events) { add(k + '-objective', b, obj); add(k + '-score', b, score); }
    if (o) R.ovFrames++;
  }
  requestAnimationFrame(tick);
};
const browser = await chromium.launch({ channel: 'chromium' });
for (const mode of MODES) for (const run of RUNS) {
  const [dev, seed] = run.split(':'); const touch = dev !== 'desktop';
  const ctx = await browser.newContext(DEV[dev]);
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript({ path: new URL('../../round-41/critic-scripts/video-pilot39c.js', import.meta.url).pathname });
  await page.addInitScript(() => { try { localStorage.setItem('drone-dash-played-v1', '1'); } catch {} });
  await page.addInitScript(sampler);
  await page.goto(`http://127.0.0.1:${PORT}/?seed=${seed}&hud=${mode}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
  if (touch) await page.tap('#play-button'); else await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  await page.evaluate((t) => window.__AP.start({ touch: t, harbour: false }), touch);
  const t0 = Date.now();
  while ((Date.now() - t0) / 1000 < MAXT) { await page.waitForTimeout(1000); const st = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.state); if (st !== 'playing' && st !== 'paused') break; }
  const st = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.state);
  const R = await page.evaluate(() => window.__R42);
  let over = null;
  if (st === 'over') {
    await page.waitForTimeout(700);
    const sess = await page.evaluate(() => window.__GAME__.session());
    if (mode === 'canvas') {
      over = await page.evaluate(() => { const s = window.__GAME__.canvasHud(); const p = (s.panels || []).find((q) => q.name === 'over'); return p ? { visible: p.visible, box: p.box, opacity: p.opacity } : null; });
      await page.addStyleTag({ content: '#app > *:not(canvas), #app section, #app .screen { visibility: hidden !important; }' });
      await page.waitForTimeout(300);
      await page.screenshot({ path: OUT + `over-canvas-${dev}-${seed}.jpg`, type: 'jpeg', quality: 85 });
    }
    over = { ...over, completes: sess.completes, score: sess.last?.score, medal: sess.last?.medal, seed: sess.seed };
  }
  console.log('R42', mode, run, JSON.stringify({ state: st, secs: Math.round((Date.now() - t0) / 1000), frames: R.frames, cornerFrames: R.corner, cornerParts: R.cornerParts, firstCorner: R.firstCorner, overlapFrames: R.ovFrames, overlaps: R.ov, firstOv: R.firstOv, over, errs: errs.slice(0, 2) }));
  await ctx.close();
}
await browser.close();
