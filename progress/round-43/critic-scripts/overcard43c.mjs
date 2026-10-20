// Round 43 critic (new): a forced long game-over card, longer than any real result: 8 breakdown rows with long labels,
// a 7-digit score and a very long time line. HTML card and canvas card, per frame for 1.6 s from the card's entry
// animation (replayed), vs the corner box (64 px plus the safe-area inset) and the viewport. Also: the music toggle vs
// the card (overlap area at rest), canvas card uploads after the change (should be 1, then 0 while idle), and the natural
// (short) card before the change. Env: PORT (5193), OUTDIR.
import { chromium, devices } from '@playwright/test';
const PORT = process.env.PORT || '5193', OUT = process.env.OUTDIR || '/tmp/';
const p915 = { ...devices['Pixel 7 landscape'], viewport: { width: 915, height: 412 }, screen: { width: 915, height: 412 } };
const SAFE_L = { left: 47, right: 47, top: 0, bottom: 21 }, SAFE_P = { left: 0, right: 0, top: 47, bottom: 34 };
const DEVS = [['iphone-safe', devices['iPhone 13 landscape'], SAFE_L], ['iphone', devices['iPhone 13 landscape'], null], ['pixel', devices['Pixel 7 landscape'], null], ['p915', p915, null], ['iphone-portrait-safe', devices['iPhone 13'], SAFE_P], ['desk', { viewport: { width: 1280, height: 720 } }, null]];
const SHOTS = new Set(['iphone-safe|html', 'iphone-safe|canvas', 'p915|html', 'iphone-portrait-safe|html']);
const browser = await chromium.launch({ channel: 'chromium' });
let bad = 0;
for (const [name, dev, safe] of DEVS) for (const q of ['', '&hud=canvas']) {
  const tag = `${name}|${q ? 'canvas' : 'html'}`;
  const ctx = await browser.newContext({ ...dev }); const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  if (safe) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: safe }); }
  await page.addInitScript(() => { try { localStorage.setItem('drone-dash-played-v1', '1'); } catch {} });
  await page.goto(`http://127.0.0.1:${PORT}/?seed=22${q}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__GAME__ && window.__GAME__.assetsReady().on, null, { timeout: 30000 });
  await page.waitForTimeout(400);
  if (dev.hasTouch) await page.tap('#play-button'); else await page.click('#play-button');
  await page.waitForTimeout(500);
  for (let i = 0; i < 300; i++) { if ((await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.state)) === 'over') break; await page.evaluate(() => window.__GAME__.advance(1, false)); }
  await page.waitForTimeout(700);
  const M = () => {
    const cp = document.createElement('div'); cp.style.cssText = 'position:fixed;left:0;top:0;width:calc(64px + env(safe-area-inset-left,0px));height:calc(64px + env(safe-area-inset-top,0px));visibility:hidden'; document.body.appendChild(cp);
    const cb = cp.getBoundingClientRect(); cp.remove();
    const card = document.querySelector('.over-card').getBoundingClientRect();
    const mt = document.getElementById('music-toggle'); const mr = mt.getBoundingClientRect(); const ms = getComputedStyle(mt);
    const ov = Math.max(0, Math.min(card.right, mr.right) - Math.max(card.left, mr.left)) * Math.max(0, Math.min(card.bottom, mr.bottom) - Math.max(card.top, mr.top));
    const c = window.__GAME__.canvasHud(); const op = c.on ? c.panels.find((p) => p.name === 'over') : null;
    return { cb: [cb.width, cb.height], card: [card.left, card.top, card.right, card.bottom].map(Math.round), music: ms.display === 'none' || ms.visibility === 'hidden' || mr.width === 0 ? null : { box: [mr.left, mr.top, mr.right, mr.bottom].map(Math.round), z: ms.zIndex, overlapPx: Math.round(ov), text: mt.textContent.trim().slice(0, 30) }, canvasCard: op && op.visible ? [op.box.x, op.box.y, op.box.x + op.box.w, op.box.y + op.box.h].map(Math.round) : null, uploads: c.on ? c.uploads : -1 };
  };
  const natural = await page.evaluate(M);
  await page.evaluate(() => {
    const row = (l, d, v, cls = '') => `<div class="${cls}"><dt>${l}${d ? ` <small>${d}</small>` : ''}</dt><dd>${v}</dd></div>`;
    document.getElementById('over-breakdown').innerHTML = [row('Deliveries', '×14 · 6 alley drops · 3 rooftop drops', '+7,000'), row('Fast drops', '×11 under par, best 4.2 s', '+3,300'), row('Rush orders', '5 of 6 in time · two in overtime', '+3,000'), row('Combo bonus', 'up to ×4.5 · chain of 9', '+4,950'), row('Street bonus', '22 runs · best 612 · 11 alleys and 5 bridges and 2 tunnels', '+2,445'), row('Slipstream', '38 s in tow behind 12 ferries 🚁🚢', '+1,120'), row('Last leg', '91% flown at time-up', '+512'), row('Clean flight', 'no crash in the last 90 s', '+900'), `<div class="total"><dt>Score</dt><dd>1,234,567</dd></div>`].join('');
    document.getElementById('over-score').textContent = '1,234,567';
    document.getElementById('over-medal').dataset.m = '4';
    document.getElementById('over-medal-name').textContent = 'Platinum medal';
    document.getElementById('over-time').innerHTML = 'Flew 5:48 <small>56 s start +186 s drops +48.5 s slipstream +41.5 s overtime (delivered) +12 s rush bonus <em>−13.5 s 6 crashes</em></small>';
    const card = document.querySelector('.over-card'); card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
    window.__oc = []; window.__ocOn = true;
    const f = () => { if (!window.__ocOn) return; const e = document.querySelector('.over-card'); const r = e.getBoundingClientRect(); const c = window.__GAME__.canvasHud(); const ov = c.on ? c.panels.find((p) => p.name === 'over') : null;
      window.__oc.push({ h: [r.left, r.top, r.right, r.bottom, +getComputedStyle(e).opacity], c: ov && ov.visible ? [ov.box.x, ov.box.y, ov.box.x + ov.box.w, ov.box.y + ov.box.h, ov.opacity] : null, u: c.on ? c.uploads : -1, sv: e.scrollHeight > e.clientHeight + 1, sh: e.scrollWidth > e.clientWidth + 1 }); requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
  await page.waitForTimeout(1600);
  const R = await page.evaluate(() => { window.__ocOn = false; return { oc: window.__oc, vw: innerWidth, vh: innerHeight }; });
  const rest = await page.evaluate(M);
  await page.waitForTimeout(1000);
  const idle = await page.evaluate(M);
  const [cr, cbt] = rest.cb;
  const inC = (b) => b && b[0] < cr && b[1] < cbt && b[4] > 0.05;
  const offV = (b) => b && (b[0] < -0.5 || b[1] < -0.5 || b[2] > R.vw + 0.5 || b[3] > R.vh + 0.5);
  const hC = R.oc.filter((o) => inC(o.h)).length, cC = R.oc.filter((o) => inC(o.c)).length;
  const hOff = R.oc.filter((o) => offV(o.h)).length, cOff = R.oc.filter((o) => offV(o.c)).length;
  const ups = [...new Set(R.oc.map((o) => o.u))];
  if (hC || cC || hOff || cOff || errs.length) bad++;
  console.log('OVERCARD43C', tag, JSON.stringify({ vp: [R.vw, R.vh], corner: rest.cb, frames: R.oc.length, htmlInCorner: hC, canvasInCorner: cC, htmlOffScreen: hOff, canvasOffScreen: cOff, minHtmlLT: [Math.min(...R.oc.map((o) => o.h[0])), Math.min(...R.oc.map((o) => o.h[1]))].map(Math.round), natural, rest, uploadsDuring: ups, uploadsIdle1s: idle.uploads - rest.uploads, scrollsV: R.oc.at(-1).sv, scrollsH: R.oc.at(-1).sh, errs }));
  if (SHOTS.has(tag)) await page.screenshot({ path: `${OUT}overcard43c-${name}-${q ? 'canvas' : 'html'}.jpg`, type: 'jpeg', quality: 80 });
  await ctx.close();
}
console.log('OVERCARD43C TOTAL bad cases', bad);
await browser.close();
