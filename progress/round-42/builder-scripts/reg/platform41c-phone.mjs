// Round 41 critic (new): phone (iPhone 13 landscape) in the cross-origin iframe, outer page with a device-width viewport.
// Real tap on Play, then the video pilot plays a full run to its natural end; logs the session detail, the 64 px corner
// (title, play, over) and failed requests. Env: DEVICE (iPhone 13 landscape), SEED (22), PILOT (1).
import { chromium, devices } from '@playwright/test';
const OUT = process.env.OUTDIR || '/tmp/';
const SEED = process.env.SEED || '22';
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext({ ...devices[process.env.DEVICE || 'iPhone 13 landscape'] });
await ctx.addInitScript(() => {
  if (location.port !== '5194') return;
  window.__slCalls = []; window.__slEvents = [];
  window.StateloopSession = { complete: (d) => window.__slCalls.push(JSON.parse(JSON.stringify(d))) };
  addEventListener('stateloop:session-complete', (e) => window.__slEvents.push(e.detail));
});
await ctx.addInitScript({ path: new URL('./video-pilot39c.js', import.meta.url).pathname });
const page = await ctx.newPage();
const failed = [], bad = [], errors = [];
page.on('requestfailed', (r) => failed.push(r.url()));
page.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://localhost:5195/?seed=${SEED}&slLaunch=x&foo=bar`, { waitUntil: 'networkidle' });
let f; for (let i = 0; i < 100 && !f; i++) { f = page.frames().find((x) => x.url().includes(':5194/')); if (f) { try { if (!(await f.evaluate(() => !!window.__GAME__))) f = null; } catch { f = null; } } if (!f) await page.waitForTimeout(200); }
await page.waitForFunction(() => true); await page.waitForTimeout(2000);
const vp = await f.evaluate(() => ({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio, hud: window.__GAME__.canvasHud().on }));
const CORNER = () => {
  const out = [];
  for (const e of document.querySelectorAll('body *')) {
    if (e.id === 'game-canvas' || e.id === 'app' || /-screen$/.test(e.id)) continue;
    const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || !(r.left < 64 && r.top < 64)) continue;
    let p = e, op = 1; while (p && p !== document.body) { const s = getComputedStyle(p); op *= Number(s.opacity); if (s.display === 'none' || s.visibility === 'hidden') { op = 0; break; } p = p.parentElement; }
    if (op < 0.05) continue;
    const cs = getComputedStyle(e);
    const own = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none' || parseFloat(cs.borderTopWidth) > 0 || [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || ['svg', 'IMG', 'CANVAS', 'BUTTON'].includes(e.tagName);
    if (own) out.push((e.id || e.className?.baseVal || e.className || e.tagName) + `@${Math.round(r.left)},${Math.round(r.top)}`);
  }
  const ch = window.__GAME__.canvasHud();
  return { state: window.__THREE_GAME_DIAGNOSTICS__.state, html: out, canvas: (ch.panels || []).filter((p) => p.visible && p.box && p.box.x < 64 && p.box.y < 64).map((p) => p.name) };
};
const corner = { title: await f.evaluate(CORNER) };
await page.screenshot({ path: OUT + 'plat-phone-iframe-title.jpg', type: 'jpeg', quality: 80 });
await f.locator('#play-button').tap();
await page.waitForTimeout(800);
const afterTap = await f.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.state);
let hit = null;
if (afterTap !== 'playing') hit = await f.evaluate(() => { const b = document.getElementById('play-button').getBoundingClientRect(); const e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return { box: [b.left, b.top, b.width, b.height], top: e && (e.id || e.className) }; });
console.log('TAP', JSON.stringify({ vp, afterTap, hit }));
if (afterTap === 'playing' && process.env.PILOT !== '0') {
  await f.evaluate(() => window.__AP.start({ touch: true, harbour: false }));
  let shot = false;
  for (let i = 0; i < 1200; i++) {
    await page.waitForTimeout(250);
    const s = await f.evaluate(() => ({ st: window.__THREE_GAME_DIAGNOSTICS__.state, del: window.__THREE_GAME_DIAGNOSTICS__.deliveries }));
    if (!corner.play && i > 20) corner.play = await f.evaluate(CORNER);
    if (!shot && s.del >= 1) { shot = true; await page.waitForTimeout(300); await page.screenshot({ path: OUT + 'plat-phone-iframe-play.jpg', type: 'jpeg', quality: 80 }); }
    if (s.st === 'over') break;
  }
  await page.waitForTimeout(2500);
  corner.over = await f.evaluate(CORNER);
  await page.screenshot({ path: OUT + 'plat-phone-iframe-over.jpg', type: 'jpeg', quality: 80 });
}
const sess = await f.evaluate(() => ({ calls: window.__slCalls, events: window.__slEvents.length, diag: (({ score, deliveries, breakdown }) => ({ score, deliveries, total: breakdown.total }))(window.__THREE_GAME_DIAGNOSTICS__) }));
console.log('PHONE', JSON.stringify({ corner, sess, failed, bad, errors }));
await browser.close();
