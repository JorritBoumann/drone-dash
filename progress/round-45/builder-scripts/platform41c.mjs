// Round 41 critic (new): the production build from a nested path inside a cross-origin iframe, as the Stateloop Play Worker
// serves it. Outer page http://localhost:5195 (OUTER) frames http://127.0.0.1:5194/nested/game/?seed=22&slLaunch=x&foo=bar.
// Checks: failed requests, play, seed parity with the dev server (5197), mock StateloopSession calls and the
// stateloop:session-complete event per run, no throw without the mock, Escape (single pauses, no preventDefault /
// stopPropagation on Escape), and the 64 px top-left corner on desktop and phone.
import { chromium, devices } from '@playwright/test';
const OUT = process.env.OUTDIR || '/tmp/';
const Q = process.env.Q || '?seed=22&slLaunch=x&foo=bar';
const OUTER = 'http://localhost:5195/' + Q;
const log = (...a) => console.log(...a);
const browser = await chromium.launch({ channel: 'chromium' });

const MOCK = () => {
  if (location.port !== '5194') return;
  window.__slCalls = []; window.__slEvents = []; window.__escLog = [];
  if (!window.__NO_MOCK__) window.StateloopSession = { complete: (d) => { window.__slCalls.push(JSON.parse(JSON.stringify(d))); } };
  addEventListener('stateloop:session-complete', (e) => window.__slEvents.push(e.detail));
  for (const m of ['preventDefault', 'stopPropagation', 'stopImmediatePropagation']) {
    const orig = Event.prototype[m];
    Event.prototype[m] = function (...a) { if (this instanceof KeyboardEvent && (this.key === 'Escape' || this.code === 'Escape')) window.__escLog.push({ m, type: this.type, stack: new Error().stack.split('\n').slice(2, 4).join(' | ') }); return orig.apply(this, a); };
  }
  // the platform's own double-Escape listener: registered first on window, capture and bubble, plus document bubble
  window.__escSeen = [];
  addEventListener('keydown', (e) => { if (e.key === 'Escape') window.__escSeen.push({ ph: 'win-cap', t: performance.now(), dp: e.defaultPrevented }); }, true);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') window.__escSeen.push({ ph: 'win-bub', t: performance.now(), dp: e.defaultPrevented }); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.__escSeen.push({ ph: 'doc-bub', t: performance.now(), dp: e.defaultPrevented }); });
};
const NOMOCK = () => { window.__NO_MOCK__ = true; };

// all visible elements (not the canvas or containers) that intersect the 64x64 top-left corner
const CORNER = () => {
  const out = [];
  for (const e of document.querySelectorAll('body *')) {
    if (e.id === 'game-canvas' || e.id === 'app' || e.tagName === 'SCRIPT' || e.tagName === 'STYLE') continue;
    const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    if (!(r.left < 64 && r.top < 64 && r.right > 0 && r.bottom > 0)) continue;
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05) continue;
    let p = e, op = 1; while (p && p !== document.body) { const s = getComputedStyle(p); op *= Number(s.opacity); if (s.display === 'none' || s.visibility === 'hidden') { op = 0; break; } p = p.parentElement; }
    if (op < 0.05) continue;
    // containers with no paint of their own are fine: skip elements whose own box has no background, border, text or image
    const own = (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none' || parseFloat(cs.borderTopWidth) > 0 || cs.boxShadow !== 'none' || [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || ['svg', 'IMG', 'CANVAS', 'BUTTON', 'INPUT'].includes(e.tagName));
    if (!own) continue;
    out.push({ id: e.id || e.className?.baseVal || e.className || e.tagName, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });
  }
  const ch = window.__GAME__?.canvasHud?.();
  const cpan = ch && ch.on ? ch.panels.filter((p) => p.visible && p.box && p.box.x < 64 && p.box.y < 64 && p.opacity > 0.05).map((p) => ({ panel: p.name, ...p.box })) : [];
  return { html: out, canvas: cpan, state: window.__THREE_GAME_DIAGNOSTICS__?.state };
};

async function gameFrame(page) {
  for (let i = 0; i < 100; i++) { const f = page.frames().find((f) => f.url().includes(':5194/')); if (f) { try { if (await f.evaluate(() => !!window.__THREE_GAME_DIAGNOSTICS__)) return f; } catch {} } await page.waitForTimeout(200); }
  throw new Error('no game frame');
}
const D = (f) => f.evaluate(() => { const d = window.__THREE_GAME_DIAGNOSTICS__; return { state: d.state, seed: d.seed, mode: d.city.mode, score: d.score, timeLeft: d.timeLeft, pos: d.player.position, speed: d.player.speed, obj: d.objective }; });

async function runOnce(label, ctxOpts, { mock = true, phone = false, shots = false } = {}) {
  const ctx = await browser.newContext(ctxOpts);
  if (!mock) await ctx.addInitScript(NOMOCK);
  await ctx.addInitScript(MOCK);
  const page = await ctx.newPage();
  const failed = [], bad = [], errors = [], consoleErr = [];
  page.on('requestfailed', (r) => failed.push(r.url() + ' ' + r.failure()?.errorText));
  page.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') consoleErr.push(m.type() + ': ' + m.text().slice(0, 200)); });
  await page.goto(OUTER, { waitUntil: 'networkidle' });
  const f = await gameFrame(page);
  await page.waitForTimeout(1500);
  const r = { label };
  r.url = f.url();
  r.d0 = await D(f);
  r.canvasHud = await f.evaluate(() => window.__GAME__.canvasHud().on);
  r.sites = await f.evaluate(() => JSON.stringify(window.__GAME__.sites?.() ?? window.__THREE_GAME_TEST_HOOKS__?.sites?.() ?? null));
  r.cornerTitle = await f.evaluate(CORNER);
  if (shots) await page.screenshot({ path: OUT + `plat-${label}-title.jpg`, type: 'jpeg', quality: 80 });
  // start: a real click on the Play button inside the iframe (also gives the frame focus)
  const play = f.locator('button', { hasText: /^\s*play/i }).first();
  if (phone) await play.tap(); else await play.click();
  await page.waitForTimeout(800);
  r.d1 = await D(f);
  r.firstObjective = r.d1.obj?.name;
  // fly a little
  if (!phone) { await page.keyboard.down('KeyW'); await page.waitForTimeout(2500); await page.keyboard.up('KeyW'); }
  else { await f.evaluate(() => window.__GAME__.key('KeyW', true)); await page.waitForTimeout(2500); await f.evaluate(() => window.__GAME__.key('KeyW', false)); }
  r.d2 = await D(f);
  r.moved = Math.hypot(r.d2.pos.x - r.d1.pos.x, r.d2.pos.z - r.d1.pos.z);
  r.cornerPlay = await f.evaluate(CORNER);
  if (shots) await page.screenshot({ path: OUT + `plat-${label}-play.jpg`, type: 'jpeg', quality: 80 });
  // single Escape pauses
  await f.evaluate(() => { window.__escLog.length = 0; window.__escSeen.length = 0; });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  r.afterEsc1 = (await D(f)).state;
  r.cornerPause = await f.evaluate(CORNER);
  await page.keyboard.press('Escape'); // resume
  await page.waitForTimeout(400);
  r.afterEsc2 = (await D(f)).state;
  // double Escape within 700 ms (the platform's exit gesture): 180 ms apart
  await page.keyboard.press('Escape'); await page.waitForTimeout(180); await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  r.afterDouble = (await D(f)).state;
  r.escLog = await f.evaluate(() => window.__escLog.slice());
  r.escSeen = await f.evaluate(() => window.__escSeen.map((e) => e.ph + (e.dp ? '!DP' : '')).join(','));
  if (r.afterDouble === 'paused') { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
  // run 1 to its natural end: let the sim run out the clock with the fixed-step hook (same update path)
  for (let i = 0; i < 200; i++) { const s = (await D(f)).state; if (s === 'over') break; await f.evaluate(() => window.__GAME__.advance(1, false)); }
  await page.waitForTimeout(1500);
  r.over1 = await D(f);
  r.cornerOver = await f.evaluate(CORNER);
  if (shots) await page.screenshot({ path: OUT + `plat-${label}-over.jpg`, type: 'jpeg', quality: 80 });
  // a debug end() on an ended run must not report again
  await f.evaluate(() => window.__GAME__.end());
  await page.waitForTimeout(3000);
  r.after1 = await f.evaluate(() => ({ calls: window.__slCalls.length, events: window.__slEvents.length, detail: window.__slCalls[0] ?? window.__slEvents[0], s: window.__GAME__.session() }));
  // run 2: Play again, end naturally
  const again = f.locator('#again-button, button:has-text("again"), button:has-text("Play again")').first();
  try { if (phone) await again.tap({ timeout: 3000 }); else await again.click({ timeout: 3000 }); } catch { await f.evaluate(() => window.__GAME__.restart()); }
  await page.waitForTimeout(800);
  r.run2state = (await D(f)).state;
  for (let i = 0; i < 200; i++) { const s = (await D(f)).state; if (s === 'over') break; await f.evaluate(() => window.__GAME__.advance(1, false)); }
  await page.waitForTimeout(1500);
  r.after2 = await f.evaluate(() => ({ calls: window.__slCalls.length, events: window.__slEvents.length, details: window.__slCalls.map((c) => c.run + ':' + c.score + ':' + c.runSeconds), evDetails: window.__slEvents.map((c) => c.run) }));
  // run 3 abandoned: restart from pause must not report
  await f.evaluate(() => window.__GAME__.restart()); await page.waitForTimeout(500);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await f.evaluate(() => window.__GAME__.restart()); await page.waitForTimeout(500);
  r.after3 = await f.evaluate(() => ({ calls: window.__slCalls.length, events: window.__slEvents.length }));
  r.failed = failed; r.bad = bad; r.errors = errors; r.console = consoleErr.slice(0, 10);
  r.requests = await page.evaluate(() => performance.getEntriesByType('resource').length);
  await ctx.close();
  return r;
}

const desk = { viewport: { width: 1280, height: 720 } };
const phone = { ...devices['iPhone 13 landscape'] };
const results = [];
results.push(await runOnce('desk-mock', desk, { shots: true }));
results.push(await runOnce('desk-nomock', desk, { mock: false }));
results.push(await runOnce('phone-mock', phone, { phone: true, shots: true }));
// seed parity: dev server ?seed=22 (plain) vs the iframe build
{
  const ctx = await browser.newContext(desk); const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:5197/?seed=22', { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
  const sites = await page.evaluate(() => JSON.stringify(window.__GAME__.sites?.() ?? window.__THREE_GAME_TEST_HOOKS__?.sites?.() ?? null));
  const d0 = await page.evaluate(() => ({ seed: window.__THREE_GAME_DIAGNOSTICS__.seed, mood: window.__THREE_GAME_DIAGNOSTICS__.city.mood, features: window.__THREE_GAME_DIAGNOSTICS__.city.features }));
  await page.keyboard.press('Enter'); await page.waitForTimeout(800);
  const obj = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.objective?.name);
  log('DEV', JSON.stringify({ d0, obj, sitesLen: sites.length }));
  for (const r of results) log('PARITY', r.label, 'sitesEqual', r.sites === sites, 'firstObjective', r.firstObjective, 'dev', obj);
  await ctx.close();
}
for (const r of results) { const { sites, ...rest } = r; log('RESULT', JSON.stringify(rest)); }
await browser.close();
