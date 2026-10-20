// Round 41 critic (new): measures fixes A, B, C, D and checks F on the dev server (5191).
// A: slow motion vs the slipstream timers and the slow-clock reward. The page's /src/main.ts is replaced (route) by a copy
//    that keeps the Game instance as window.__G, so slow motion can be held on (slowMo) frame by frame with the fixed-step
//    hook. Compares per real second: slow-clock seconds added, meter drain, chain window, with and without slow motion.
// B: phone, real CDP touches on the stick and the boost button, then blur / hidden tab / Escape-pause: stick state.
// C: localStorage that throws on access (getter), and one that throws on setItem only: full run cycle, M and N.
// D: listeners on #music-toggle before and after Game.dispose() (same __G instance).
// F: help line, music chip title and label text.
import { chromium, devices } from '@playwright/test';
const PORT = process.env.PORT || '5191';
const URL_ = `http://127.0.0.1:${PORT}/?seed=22`;
const ONLY = (process.env.ONLY || 'A,B,C,D,F').split(',');
const browser = await chromium.launch({ channel: 'chromium' });
const MAIN = `import '/src/styles.css';
import { Game } from '/src/game/Game.ts';
const canvas = document.querySelector('#game-canvas'); canvas.tabIndex = 0;
const game = new Game(canvas); game.boot(); window.__G = game;`;
async function withG(page) {
  await page.route('**/src/main.ts', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: MAIN }));
}
const out = {};

if (ONLY.includes('A')) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await withG(page);
  await page.goto(URL_, { waitUntil: 'networkidle' }); await page.waitForTimeout(1000);
  out.A = await page.evaluate(() => {
    const G = window.__G, H = window.__GAME__;
    if (!G) return { err: 'no __G' };
    H.externalClock(true); H.start(); H.advance(0.5, false);
    const S = () => window.__THREE_GAME_DIAGNOSTICS__.slipstream;
    const res = {};
    // 1) slow-clock reward: draft pace and heading forced to 1, budget unlimited, high over the city (no walls)
    G.slipClockPace = () => 1; G.slipTowardTarget = () => 1;
    const clockRun = (slow, frames) => {
      const s0 = S().seconds, t0 = window.__THREE_GAME_DIAGNOSTICS__.timeLeft; let ts = 0;
      for (let i = 0; i < frames; i++) { G.slipBudget = 99; G.stale = false; if (slow) { G.slowMo = 1; G.hitStop = 0; } else { G.slowMo = 0; G.hitStop = 0; } H.place(0, 60, 0, 0, 14); H.advance(1 / 60, false); ts += window.__THREE_GAME_DIAGNOSTICS__.feel.timeScale; }
      const d = window.__THREE_GAME_DIAGNOSTICS__;
      return { addedPerRealSec: +((S().seconds - s0) / (frames / 60)).toFixed(4), clockK: d.slipstream.clockK, gain: +d.slipstream.clockGain.toFixed(4), meanTimeScale: +(ts / frames).toFixed(3) };
    };
    res.clockNormal = clockRun(false, 60); res.clockSlow = clockRun(true, 60); res.clockNormal2 = clockRun(false, 60);
    // hit-stop (0.08x) too
    res.clockHitStop = (() => { const s0 = S().seconds; let ts = 0; for (let i = 0; i < 30; i++) { G.slipBudget = 99; G.stale = false; G.hitStop = 1; H.place(0, 60, 0, 0, 14); H.advance(1 / 60, false); ts += window.__THREE_GAME_DIAGNOSTICS__.feel.timeScale; } G.hitStop = 0; return { addedPerRealSec: +((S().seconds - s0) / 0.5).toFixed(4), meanTimeScale: +(ts / 30).toFixed(3) }; })();
    // 2) meter drain: level set, not drafting (high in open air), past grace
    const drainRun = (slow) => {
      G.slip.level = 0.8; G.slip.since = 10; G.slip.chain = 0;
      const l0 = G.slip.level;
      for (let i = 0; i < 30; i++) { G.slowMo = slow ? 1 : 0; G.hitStop = 0; G.slip.since = Math.max(G.slip.since, 10); H.place(0, 60, 0, 0, 14); H.advance(1 / 60, false); }
      return { dropPerRealSec: +((l0 - G.slip.level) / 0.5).toFixed(4) };
    };
    res.drainNormal = drainRun(false); res.drainSlow = drainRun(true);
    // 3) grace before the drain: since from 0, real seconds until the level starts to fall
    const graceRun = (slow) => {
      G.slip.level = 0.8; G.slip.since = 0; let f = 0;
      for (; f < 600; f++) { G.slowMo = slow ? 1 : 0; G.hitStop = 0; const before = G.slip.level; H.place(0, 60, 0, 0, 14); H.advance(1 / 60, false); if (G.slip.level < before - 1e-9) break; }
      return { realSecondsToDrain: +(f / 60).toFixed(3) };
    };
    res.graceNormal = graceRun(false); res.graceSlow = graceRun(true);
    // 4) chain window: chain 3 just paid, not drafting: real seconds until the chain is lost
    const chainRun = (slow) => {
      G.slip.chain = 3; G.slip.sincePayout = 0; G.slip.since = 0; G.slip.level = 0.5; let f = 0;
      for (; f < 900; f++) { G.slowMo = slow ? 1 : 0; G.hitStop = 0; H.place(0, 60, 0, 0, 14); H.advance(1 / 60, false); if (G.slip.chain === 0) break; }
      return { realSecondsToLoseChain: +(f / 60).toFixed(3) };
    };
    res.chainNormal = chainRun(false); res.chainSlow = chainRun(true);
    // 5) distance-based fill may follow scaled motion: report fill per real second while drafting is forced
    G.slowMo = 0; G.hitStop = 0;
    return res;
  });
  out.A.errs = errs;
  await ctx.close();
}

if (ONLY.includes('B')) {
  const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'] });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('drone-dash-played-v1', '1'); } catch {} });
  await page.goto(URL_, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
  const cdp = await ctx.newCDPSession(page);
  const tap = async (sel) => { const b = await page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x, y: b.y, id: 9 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
  const box = (sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; }, sel);
  const st = () => page.evaluate(() => ({ ...window.__GAME__.stick(), state: window.__THREE_GAME_DIAGNOSTICS__.state, boostCls: document.getElementById('boost-button').className, upCls: document.getElementById('up-button').className }));
  const press = async () => {
    const s = await box('#touch-stick'), b = await box('#boost-button');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: s.x, y: s.y, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: s.x + s.w * 0.3, y: s.y - s.w * 0.3, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: s.x + s.w * 0.3, y: s.y - s.w * 0.3, id: 1 }, { x: b.x, y: b.y, id: 2 }] });
    await page.waitForTimeout(250);
  };
  const resume = async () => { await page.evaluate(() => { if (window.__THREE_GAME_DIAGNOSTICS__.state === 'paused') window.__GAME__.resume(); }); await page.waitForTimeout(200); };
  await tap('#play-button'); await page.waitForTimeout(600);
  const r = { started: (await st()).state };
  const cases = {
    blur: () => page.evaluate(() => window.dispatchEvent(new Event('blur'))),
    hidden: () => page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); }),
    pauseButton: () => page.evaluate(() => window.__GAME__.pause()),
    lostCapture: () => page.evaluate(() => { const s = document.getElementById('touch-stick'); for (const id of [1, 2, 3, 77]) { try { if (s.hasPointerCapture(id)) s.releasePointerCapture(id); } catch {} } const b = document.getElementById('boost-button'); s.dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: window.__GAME__.stick().id ?? 1, pointerType: 'touch', bubbles: true })); b.dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: 2, pointerType: 'touch', bubbles: true })); }),
  };
  for (const [name, fn] of Object.entries(cases)) {
    await press();
    const held = await st();
    await fn(); await page.waitForTimeout(250);
    const after = await st();
    // lift the fingers (the OS would send touchcancel after an app switch)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    if (name === 'hidden') await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
    await resume();
    const back = await st();
    r[name] = { held, after, afterResume: back };
  }
  // after all that: a fresh press still works
  await press(); r.pressAgain = await st(); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(150); r.release = await st();
  r.errs = errs; out.B = r;
  await ctx.close();
}

if (ONLY.includes('C')) {
  out.C = {};
  for (const mode of ['getter-throws', 'set-throws']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.addInitScript((m) => {
      if (m === 'getter-throws') {
        for (const k of ['localStorage', 'sessionStorage']) Object.defineProperty(window, k, { configurable: true, get() { throw new DOMException('The operation is insecure.', 'SecurityError'); } });
      } else {
        const fake = { getItem: () => null, setItem: () => { throw new DOMException('QuotaExceededError', 'QuotaExceededError'); }, removeItem: () => { throw new DOMException('denied', 'SecurityError'); }, clear() {}, key: () => null, length: 0 };
        Object.defineProperty(window, 'localStorage', { configurable: true, get: () => fake });
      }
    }, mode);
    const page = await ctx.newPage(); const errs = [], cons = [];
    page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') cons.push(m.text().slice(0, 160)); });
    await page.goto(URL_, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
    const probe = await page.evaluate(() => { try { localStorage; return 'accessible'; } catch (e) { return 'throws ' + e.name; } });
    const r = { probe, title: await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.state) };
    await page.keyboard.press('Enter'); await page.waitForTimeout(500);
    await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
    r.play = await page.evaluate(() => ({ s: window.__THREE_GAME_DIAGNOSTICS__.state, sp: +window.__THREE_GAME_DIAGNOSTICS__.player.speed.toFixed(1) }));
    const mm0 = await page.evaluate(() => window.__GAME__.minimap.visible);
    await page.keyboard.press('KeyM'); await page.waitForTimeout(200);
    const mm1 = await page.evaluate(() => window.__GAME__.minimap.visible);
    await page.keyboard.press('KeyM'); await page.waitForTimeout(200);
    const mu0 = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.audio.music);
    await page.keyboard.press('KeyN'); await page.waitForTimeout(200);
    const mu1 = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.audio.music);
    r.mapToggle = [mm0, mm1]; r.music = [JSON.stringify(mu0).slice(0, 80), JSON.stringify(mu1).slice(0, 80)];
    await page.keyboard.press('Escape'); await page.waitForTimeout(200); r.paused = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.state);
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    await page.evaluate(() => { window.__GAME__.externalClock(true); for (let i = 0; i < 90 && window.__THREE_GAME_DIAGNOSTICS__.state !== 'over'; i++) window.__GAME__.advance(1, false); window.__GAME__.externalClock(false); });
    await page.waitForTimeout(800);
    r.over = await page.evaluate(() => ({ s: window.__THREE_GAME_DIAGNOSTICS__.state, best: window.__THREE_GAME_DIAGNOSTICS__.goals.best, overVisible: !document.getElementById('over-screen').hidden }));
    await page.click('#again-button'); await page.waitForTimeout(600);
    r.replay = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.state);
    // new city (page reload path) and daily
    r.errs = errs; r.consoleErrors = cons.slice(0, 5);
    out.C[mode] = r;
    await ctx.close();
  }
}

if (ONLY.includes('D')) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => {
    const live = new Map(); window.__lst = live; let n = 0;
    const key = (t) => (t === window ? 'window' : t === document ? 'document' : t && t.id ? '#' + t.id : null);
    const add = EventTarget.prototype.addEventListener, rem = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (type, fn, opt) { const k = key(this); if (k && fn) { const cap = typeof opt === 'boolean' ? opt : !!opt?.capture; const id = k + '|' + type + '|' + cap; const arr = live.get(id) || []; if (!arr.includes(fn)) arr.push(fn); live.set(id, arr); } return add.call(this, type, fn, opt); };
    EventTarget.prototype.removeEventListener = function (type, fn, opt) { const k = key(this); if (k && fn) { const cap = typeof opt === 'boolean' ? opt : !!opt?.capture; const id = k + '|' + type + '|' + cap; const arr = live.get(id) || []; const i = arr.indexOf(fn); if (i >= 0) arr.splice(i, 1); live.set(id, arr); } return rem.call(this, type, fn, opt); };
    window.__lstCount = (pfx) => [...live.entries()].filter(([k, v]) => k.startsWith(pfx) && v.length).map(([k, v]) => k + ' x' + v.length);
  });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await withG(page);
  await page.goto(URL_, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
  const r = {};
  r.musicBefore = await page.evaluate(() => window.__lstCount('#music-toggle'));
  r.windowBefore = await page.evaluate(() => window.__lstCount('window').length);
  r.allIdBefore = await page.evaluate(() => window.__lstCount('#').length);
  await page.evaluate(() => window.__G.dispose()); await page.waitForTimeout(300);
  r.musicAfter = await page.evaluate(() => window.__lstCount('#music-toggle'));
  r.windowAfter = await page.evaluate(() => window.__lstCount('window'));
  r.documentAfter = await page.evaluate(() => window.__lstCount('document'));
  r.idAfter = await page.evaluate(() => window.__lstCount('#'));
  // a click on the chip after dispose must do nothing and throw nothing
  await page.click('#music-toggle', { force: true }).catch((e) => { r.clickErr = String(e).slice(0, 100); });
  await page.waitForTimeout(300);
  r.errs = errs; out.D = r;
  await ctx.close();
}

if (ONLY.includes('F')) {
  const r = {};
  for (const dev of ['desk', 'phone']) {
    const ctx = await browser.newContext(dev === 'phone' ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    await page.goto(URL_, { waitUntil: 'networkidle' }); await page.waitForTimeout(1000);
    const grab = () => page.evaluate(() => {
      const vis = (e) => !!(e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
      const help = [...document.querySelectorAll('li, p, span, div')].filter((e) => /\bmap\b|\bmusic\b/i.test(e.textContent) && e.children.length < 8 && e.textContent.length < 120 && vis(e)).map((e) => e.textContent.trim().replace(/\s+/g, ' '));
      const mt = document.getElementById('music-toggle');
      const allTitles = [...document.querySelectorAll('[title], [aria-label]')].map((e) => (e.getAttribute('title') || '') + ' ' + (e.getAttribute('aria-label') || '')).filter((t) => /music|map/i.test(t));
      const wrongM = document.body.innerHTML.match(/[^<>]{0,30}\(M\)[^<>]{0,10}|Music \(M\)|<kbd>M<\/kbd>\s*music/gi);
      return { help: [...new Set(help)].slice(0, 6), chipTitle: mt.getAttribute('title'), chipAria: mt.getAttribute('aria-label'), chipLabel: document.getElementById('music-label').textContent, titles: [...new Set(allTitles)], wrongM };
    });
    r[dev + '-title'] = await grab();
    if (dev === 'desk') { await page.keyboard.press('Enter'); await page.waitForTimeout(500); r['desk-play'] = await grab(); await page.keyboard.press('Escape'); await page.waitForTimeout(300); r['desk-pause'] = await grab(); }
    await ctx.close();
  }
  out.F = r;
}
for (const [k, v] of Object.entries(out)) console.log('FIX', k, JSON.stringify(v));
await browser.close();
