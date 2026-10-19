// Round 41 critic (new): the nav marker (diamond, edge arrow, distance pill) vs the platform's 64 px top-left corner during
// real play. video-pilot39c.js flies a real-time run (pickups, deliveries, pops); every 100 ms the painted marker parts are
// checked against the corner. Env: PORT (5193), RUNS ("iPhone 13 landscape:22,...") , MAXT (s), Q (extra query).
import { chromium, devices } from '@playwright/test';
const PORT = process.env.PORT || '5193', OUT = process.env.OUTDIR || '/tmp/', MAXT = Number(process.env.MAXT || 60);
const RUNS = (process.env.RUNS || 'iPhone 13 landscape:22,iPhone 13 landscape:130,Pixel 7 landscape:22,desktop:22').split(',');
const browser = await chromium.launch({ channel: 'chromium' });
for (const run of RUNS) {
  const [dev, seed] = run.split(':'); const touch = dev !== 'desktop';
  const ctx = await browser.newContext(touch ? { ...devices[dev] } : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript({ path: new URL('./video-pilot39c.js', import.meta.url).pathname });
  await page.addInitScript(() => { try { localStorage.setItem('drone-dash-played-v1', '1'); } catch {} });
  await page.goto(`http://127.0.0.1:${PORT}/?seed=${seed}${process.env.Q || '&hud=canvas'}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
  if (touch) await page.tap('#play-button'); else await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  await page.evaluate((t) => window.__AP.start({ touch: t, harbour: false }), touch);
  const t0 = Date.now(); let n = 0, hit = 0, offHit = 0, shot = 0; const parts = {}; let worst = null; let ovN = 0, ovMax = 0;
  while ((Date.now() - t0) / 1000 < MAXT) {
    await page.waitForTimeout(100);
    const s = await page.evaluate(() => {
      const nav = document.getElementById('nav-marker'); if (!nav || getComputedStyle(nav).display === 'none') return { st: window.__THREE_GAME_DIAGNOSTICS__.state, in: [] };
      const out = [];
      for (const sel of ['.nav-diamond', '.nav-arrow', '.nav-distance']) {
        const e = nav.querySelector(sel); const r = e.getBoundingClientRect(); const op = Number(getComputedStyle(e).opacity);
        if (op > 0.05 && r.left < 64 && r.top < 64 && r.right > 0 && r.bottom > 0) out.push({ sel, r: [r.left, r.top, r.right, r.bottom].map(Math.round) });
      }
      const a = document.querySelector('.hud-score').getBoundingClientRect(), b = document.getElementById('objective').getBoundingClientRect(); const ov = b.width > 0 ? Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) : 0;
      return { st: window.__THREE_GAME_DIAGNOSTICS__.state, in: out, off: nav.classList.contains('offscreen'), ov: Math.round(ov) };
    });
    if (s.st !== 'playing') break;
    n++; if (s.ov > 0) { ovN++; ovMax = Math.max(ovMax, s.ov); }
    if (s.in.length) { hit++; if (s.off) offHit++; for (const p of s.in) parts[p.sel] = (parts[p.sel] || 0) + 1; if (!worst) worst = s.in; if (shot < 1) { shot++; await page.screenshot({ path: OUT + `navcorner-${dev.split(' ')[0].toLowerCase()}-${seed}.jpg`, type: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: 360, height: 180 } }); } }
  }
  console.log('NAVCORNER', run, JSON.stringify({ q: process.env.Q || '&hud=canvas', scoreObjOverlap: ovN, ovMax, samples: n, inCorner: hit, offscreen: offHit, parts, first: worst, errs: errs.slice(0, 2) }));
  await ctx.close();
}
await browser.close();
