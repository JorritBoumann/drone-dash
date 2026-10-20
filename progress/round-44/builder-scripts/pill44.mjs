// Round 44 builder (new): the objective pill on narrow screens, HTML and canvas HUD. Per frame for 3 s in play, first
// as the game sets it, then stressed (a long name, the rush chip and the street-bonus chip forced on). Inside the slot:
// the pill starts right of the score panel and ends left of the right chips, and (HTML) no child pokes out of the pill.
// Env: PORT (5191). Viewports: 568x320, 480x320, 667x375 (touch), 1280x720 desktop.
import { chromium, devices } from '@playwright/test';
const PORT = process.env.PORT || '5191';
const touch = (w, h) => ({ ...devices['iPhone SE'], viewport: { width: w, height: h }, screen: { width: w, height: h } });
const VPS = [['568x320', touch(568, 320)], ['480x320', touch(480, 320)], ['667x375', touch(667, 375)], ['desk', { viewport: { width: 1280, height: 720 } }]];
const browser = await chromium.launch({ channel: 'chromium' });
let bad = 0;
for (const [name, dev] of VPS) for (const q of ['', '&hud=canvas']) {
  const tag = `${name}|${q ? 'canvas' : 'html'}`;
  const ctx = await browser.newContext({ ...dev }); const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('drone-dash-played-v1', '1'); } catch {} });
  await page.goto(`http://127.0.0.1:${PORT}/?seed=22${q}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__GAME__ && window.__GAME__.assetsReady().on, null, { timeout: 30000 });
  await page.waitForTimeout(400);
  if (dev.hasTouch) await page.tap('#play-button'); else await page.click('#play-button');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'playing', null, { timeout: 10000 });
  const res = {};
  for (const stress of [false, true]) {
    res[stress ? 'stress' : 'natural'] = await page.evaluate(async (stress) => {
      const chud = window.__GAME__.canvasHud().on;
      const R = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? r : null; };
      let frames = 0, out = 0, poke = 0, maxW = 0, minGapL = 1e9, minGapR = 1e9, ex = null;
      if (stress) {
        // as the game does it (Hud.setObjective / setRush / writeBank refit the pill on the next frame): set once, let it settle
        document.getElementById('objective-name').textContent = 'Harbourmaster Lighthouse Tower North';
        document.getElementById('objective-rush').hidden = false; document.getElementById('objective-rush-value').textContent = '28';
        document.getElementById('objective-bank').hidden = false;
        await new Promise((r) => setTimeout(r, 400));
      }
      let hidden = 0;
      const t0 = performance.now();
      await new Promise((done) => {
        const f = () => {
          if (stress) {
            document.getElementById('objective-name').textContent = 'Harbourmaster Lighthouse Tower North';
            document.getElementById('objective-rush').hidden = false; document.getElementById('objective-rush-value').textContent = '28';
            document.getElementById('objective-bank').hidden = false;
          }
          const s = R('.hud-score'), r = R('.hud-right');
          let o;
          if (chud) {
            const st = window.__GAME__.canvasHud(); const p = st.panels.find((x) => x.name === 'objective'); const sp = st.panels.find((x) => x.name === 'score');
            o = p && p.visible && p.box && p.box.w > 0 ? { left: p.box.x, right: p.box.x + p.box.w } : null;
            const sb = sp && sp.visible && sp.box ? { right: sp.box.x + sp.box.w } : s;
            if (o) { frames++; maxW = Math.max(maxW, o.right - o.left); const gl = o.left - (sb ? sb.right : 0), gr = (r ? r.left : innerWidth) - o.right; minGapL = Math.min(minGapL, gl); minGapR = Math.min(minGapR, gr); if (gl < 0 || gr < 0 || o.left < 0 || o.right > innerWidth) { out++; ex = ex || { o, sb: sb && sb.right, r: r && r.left }; } }
          } else {
            o = R('#objective');
            if (o && getComputedStyle(document.getElementById('objective')).visibility === 'hidden') { hidden++; o = null; }
            if (o) {
              frames++; maxW = Math.max(maxW, o.width);
              const gl = o.left - (s ? s.right : 0), gr = (r ? r.left : innerWidth) - o.right; minGapL = Math.min(minGapL, gl); minGapR = Math.min(minGapR, gr);
              if (gl < 0 || gr < 0 || o.left < 0 || o.right > innerWidth) { out++; ex = ex || { o: [o.left, o.right], s: s && s.right, r: r && r.left }; }
              for (const c of document.getElementById('objective').children) { const b = c.getBoundingClientRect(); if (b.width > 0 && getComputedStyle(c).visibility !== 'hidden' && (b.right > o.right + 0.5 || b.left < o.left - 0.5)) { poke++; ex = ex || { poke: c.className, b: [b.left, b.right], o: [o.left, o.right] }; break; } }
            }
          }
          if (performance.now() - t0 < 3000) requestAnimationFrame(f); else done();
        };
        requestAnimationFrame(f);
      });
      return { chud, frames, hidden, fit: document.getElementById('objective').dataset.fit, out, poke, maxW: Math.round(maxW), minGapL: Math.round(minGapL), minGapR: Math.round(minGapR), ex };
    }, stress);
  }
  const shot = `${process.env.OUTDIR || '/tmp/'}pill44-${name}-${q ? 'canvas' : 'html'}.jpg`;
  await page.screenshot({ path: shot, type: 'jpeg', quality: 80 });
  if (res.natural.out || res.natural.poke || res.stress.out || res.stress.poke || errs.length) bad++;
  console.log('PILL44', tag, JSON.stringify({ ...res, errs: errs.slice(0, 2) }));
  await ctx.close();
}
console.log('PILL44 TOTAL bad cases', bad);
await browser.close();
