// Round 43 builder: the game-over card (HTML and canvas) after a long, high-scoring result, vs the 64 px corner plus the
// safe-area inset, on every frame for 1.5 s after the card appears (entry animation included). The run is ended with the
// debug clock (advance), then the HTML card gets the longest real result shape: 7 breakdown rows (rush orders and a last
// leg), a 6-digit score and a time line with overtime and crashes. That mutation also tests that the canvas card redraws
// once per changed result. Env: PORT (5193), OUTDIR.
import { chromium, devices } from '@playwright/test';
const PORT = process.env.PORT || '5193', OUT = process.env.OUTDIR || '/tmp/';
const p915 = { ...devices['Pixel 7 landscape'], viewport: { width: 915, height: 412 }, screen: { width: 915, height: 412 } };
const DEVS = [['iphone-safe', devices['iPhone 13 landscape'], true], ['iphone', devices['iPhone 13 landscape'], false], ['pixel', devices['Pixel 7 landscape'], false], ['p915', p915, false], ['desk', { viewport: { width: 1280, height: 720 } }, false], ['iphone-portrait-safe', devices['iPhone 13'], true]];
const browser = await chromium.launch({ channel: 'chromium' });
let bad = 0;
for (const [name, dev, safe] of DEVS) for (const q of ['', '&hud=canvas']) {
  const ctx = await browser.newContext({ ...dev }); const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  if (safe) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: name.includes('portrait') ? { left: 0, right: 0, top: 47, bottom: 34 } : { left: 47, right: 47, top: 0, bottom: 21 } }); }
  await page.addInitScript(() => { try { localStorage.setItem('drone-dash-played-v1', '1'); } catch {} });
  await page.goto(`http://127.0.0.1:${PORT}/?seed=22${q}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__GAME__ && window.__GAME__.assetsReady().on, null, { timeout: 30000 });
  await page.waitForTimeout(500);
  if (dev.hasTouch) await page.tap('#play-button'); else await page.click('#play-button');
  await page.waitForTimeout(600);
  for (let i = 0; i < 300; i++) { if ((await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.state)) === 'over') break; await page.evaluate(() => window.__GAME__.advance(1, false)); }
  await page.waitForTimeout(300);
  const drawsBefore = await page.evaluate(() => { const c = window.__GAME__.canvasHud(); return c.on ? c.panels.find((p) => p.name === 'over').draws : -1; });
  await page.evaluate(() => {
    const row = (l, d, v, cls = '') => `<div class="${cls}"><dt>${l}${d ? ` <small>${d}</small>` : ''}</dt><dd>${v}</dd></div>`;
    document.getElementById('over-breakdown').innerHTML = [row('Deliveries', '×9', '+4,500'), row('Fast drops', '×7', '+2,100'), row('Rush orders', '3 of 4 in time', '+1,800'), row('Combo bonus', 'up to ×3.5', '+2,950'), row('Street bonus', '14 runs · best 412 · 8 alleys and 3 bridges', '+1,445'), row('Last leg', '83% flown at time-up', '+412'), `<div class="total"><dt>Score</dt><dd>123,207</dd></div>`].join('');
    document.getElementById('over-score').textContent = '123,207';
    document.getElementById('over-medal').dataset.m = '4';
    document.getElementById('over-medal-name').textContent = 'Platinum medal';
    document.getElementById('over-time').innerHTML = 'Flew 4:12 <small>56 s start +146 s drops +38.5 s slipstream +31.5 s overtime (delivered) <em>−9.5 s 4 crashes</em></small>';
    window.__oc = []; window.__ocOn = true;
    const cp = document.createElement('div'); cp.style.cssText = 'position:fixed;left:0;top:0;width:calc(64px + env(safe-area-inset-left,0px));height:calc(64px + env(safe-area-inset-top,0px));visibility:hidden'; document.body.appendChild(cp);
    const cb = cp.getBoundingClientRect(); window.__cb = [cb.width, cb.height];
    const f = () => { if (!window.__ocOn) return; const e = document.querySelector('.over-card'); const r = e.getBoundingClientRect(); const c = window.__GAME__.canvasHud(); const ov = c.on ? c.panels.find((p) => p.name === 'over') : null;
      window.__oc.push({ h: [r.left, r.top, r.right, r.bottom, +getComputedStyle(e).opacity], c: ov && ov.visible ? [ov.box.x, ov.box.y, ov.box.x + ov.box.w, ov.box.y + ov.box.h, ov.opacity, ov.draws] : null, sh: e.scrollHeight > e.clientHeight + 1, sw: e.scrollWidth > e.clientWidth + 1 }); requestAnimationFrame(f); };
    // replay the entry animation so its overshoot is measured too
    const card = document.querySelector('.over-card'); card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
    requestAnimationFrame(f);
  });
  await page.waitForTimeout(1500);
  const R = await page.evaluate(() => { window.__ocOn = false; return { oc: window.__oc, cb: window.__cb, vw: innerWidth, vh: innerHeight }; });
  const [cr, cbt] = R.cb;
  const inC = (b) => b && b[0] < cr && b[1] < cbt && b[4] > 0.05;
  const offV = (b) => b && (b[0] < -0.5 || b[1] < -0.5 || b[2] > R.vw + 0.5 || b[3] > R.vh + 0.5);
  const hC = R.oc.filter((o) => inC(o.h)).length, cC = R.oc.filter((o) => inC(o.c)).length;
  const hOff = R.oc.filter((o) => offV(o.h)).length, cOff = R.oc.filter((o) => offV(o.c)).length;
  const draws = [...new Set(R.oc.map((o) => o.c ? o.c[5] : -1))];
  const last = R.oc.at(-1);
  if (hC || cC || hOff || cOff || errs.length) bad++;
  console.log('OVERCARD43', name, q ? 'canvas' : 'html', JSON.stringify({ vp: [R.vw, R.vh], corner: R.cb, frames: R.oc.length, htmlInCorner: hC, canvasInCorner: cC, htmlOffScreen: hOff, canvasOffScreen: cOff, htmlRest: last.h.map(Math.round), canvasRest: last.c && last.c.slice(0, 4).map(Math.round), minHtmlLT: [Math.min(...R.oc.map((o) => o.h[0])), Math.min(...R.oc.map((o) => o.h[1]))].map(Math.round), scrollsV: last.sh, scrollsH: last.sw, canvasDrawsBefore: drawsBefore, canvasDrawsDuring: draws, errs }));
  await page.screenshot({ path: `${OUT}overcard43-${name}-${q ? 'canvas' : 'html'}.jpg`, type: 'jpeg', quality: 80 });
  await ctx.close();
}
console.log('OVERCARD43 TOTAL bad cases', bad);
await browser.close();
