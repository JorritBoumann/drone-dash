// Round 15 builder: city variety acceptance. (1) 3 fresh loads with no seed: city fingerprint + first pickup.
// (2) Daily city: 3 loads on the same day give the same city; a mocked next day gives another. (3) The daily best is
// saved separately from the overall best (teleport delivery via the place hook, then end the run). (4) ?seed=22 still
// gives the round 14 fingerprint. Screenshots of the title and game-over city lines.
import { chromium } from '@playwright/test';
const OUT = '../builder-shots/';
const browser = await chromium.launch({ channel: 'chromium' });
const fp = async (page) => page.evaluate(() => { const G = window.__GAME__; const s = G.sites(); const f = s.map((q) => `${q.name}@${Math.round(q.x)},${Math.round(q.z)},${q.y.toFixed(1)}`).join('|');
  let h = 0; for (const c of f) h = (h * 31 + c.charCodeAt(0)) >>> 0; const d = G.diagnostics();
  return { hash: h.toString(16), sites: s.length, seed: d.seed, city: d.city, label: document.getElementById('city-label').innerText, dailyLine: !document.getElementById('daily-line').hidden ? document.getElementById('daily-line').innerText : null }; });
const first = async (page) => page.evaluate(() => { const G = window.__GAME__; G.externalClock(true); G.start(); const d = G.advance(0.05, false); return d.objective.name; });
const mockDate = (iso) => `{ const RealDate = Date; const fixed = new RealDate('${iso}').getTime(); const off = fixed - RealDate.now();
  class MockDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + off); } static now() { return RealDate.now() + off; } }
  globalThis.Date = MockDate; }`;
async function load(url, { date, storage, shot } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, storageState: storage });
  if (date) await ctx.addInitScript(mockDate(date));
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('http://127.0.0.1:5188/' + url, { waitUntil: 'networkidle' }); await page.waitForTimeout(700);
  if (shot) await page.screenshot({ path: OUT + shot, type: 'jpeg', quality: 80 });
  return { ctx, page, errs };
}
const R = { fresh: [], daily: [], nextDay: null, seed22: null };
for (let i = 0; i < 3; i++) { const { ctx, page, errs } = await load('', { shot: i === 0 ? 'V-title-fresh.jpg' : undefined }); const f = await fp(page); f.first = await first(page); f.errors = errs.length; R.fresh.push(f); await ctx.close(); }
for (let i = 0; i < 3; i++) { const { ctx, page } = await load('?daily', { date: '2026-10-15T09:00:00', shot: i === 0 ? 'V-title-daily.jpg' : undefined }); const f = await fp(page); f.first = await first(page); R.daily.push(f); await ctx.close(); }
{ const { ctx, page } = await load('?daily', { date: '2026-10-16T09:00:00' }); R.nextDay = await fp(page); R.nextDay.first = await first(page); await ctx.close(); }
{ const { ctx, page } = await load('?seed=22'); R.seed22 = await fp(page); R.seed22.first = await first(page); await ctx.close(); }
// daily best: one delivery by teleport on the daily city, then end; check storage and the title line after reload
{
  const { ctx, page } = await load('?daily', { date: '2026-10-15T09:00:00' });
  const run = await page.evaluate(() => { const G = window.__GAME__; G.externalClock(true); G.start(); let d = G.advance(0.05, false);
    for (let k = 0; k < 2; k++) { const p = d.objective.position; G.place(p.x, p.y + 1.3, p.z, 0, 0); d = G.advance(0.3, false); }
    const score = d.score; G.end(); d = G.advance(0.05, false);
    return { score, state: d.state, city: d.city, daily: localStorage.getItem('drone-dash-daily-v1'), best: localStorage.getItem('drone-dash-best-v1'), overCity: document.getElementById('over-city').innerText, overDaily: document.getElementById('over-daily').innerText, again: document.getElementById('again-button').innerText }; });
  await page.waitForTimeout(900); await page.screenshot({ path: OUT + 'V-over-daily.jpg', type: 'jpeg', quality: 80 });
  R.dailyRun = run; const storage = await ctx.storageState(); await ctx.close();
  const a = await load('?daily', { date: '2026-10-15T09:00:00', storage, shot: 'V-title-daily-best.jpg' }); R.dailyAfter = await fp(a.page); await a.ctx.close();
  const b = await load('?daily', { date: '2026-10-16T09:00:00', storage }); R.dailyNextDayAfter = await fp(b.page); await b.ctx.close();
  const c = await load('', { storage }); R.randomAfter = await fp(c.page); R.randomAfter.best = await c.page.evaluate(() => document.getElementById('title-best').innerText); await c.ctx.close();
}
console.log(JSON.stringify(R, null, 1));
const uniq = new Set(R.fresh.map((f) => f.hash + '/' + f.first)).size;
console.log('SUMMARY ' + JSON.stringify({ freshDistinct: uniq, freshSeeds: R.fresh.map((f) => f.seed), dailySame: new Set(R.daily.map((f) => f.hash)).size === 1, dailySeed: R.daily[0].seed, nextDaySeed: R.nextDay.seed, nextDayDiffers: R.nextDay.hash !== R.daily[0].hash, seed22: R.seed22.hash, seed22first: R.seed22.first, dailyBestSaved: R.dailyRun.daily, overallBest: R.dailyRun.best, dailyLineAfter: R.dailyAfter.dailyLine, dailyLineNextDay: R.dailyNextDayAfter.dailyLine, randomDailyLine: R.randomAfter.dailyLine }));
await browser.close();
