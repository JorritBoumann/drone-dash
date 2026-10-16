// Round 15 critic (new): daily-probe. Checks the daily city: same seed across loads and fresh profiles on one day,
// a different seed on another (mocked) date, its own best saved apart from the overall best, and that a random-city
// run does not touch it. Scores a short run by placing the drone on the pads (debug place hook), then ends the run.
import { chromium } from '@playwright/test';
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chromium' });
const log = (k, v) => console.log(k + ' ' + JSON.stringify(v));
const cityOf = (page) => page.evaluate(() => ({ ...window.__GAME__.city(), title: document.getElementById('city-label')?.innerText, dailyLine: document.getElementById('daily-line')?.hidden === false ? document.getElementById('daily-line').innerText : null, first: (() => { const s = window.__GAME__.sites(); return s.length; })() }));
const firstObj = (page) => page.evaluate(() => { const G = window.__GAME__; G.start(); G.manualRender(true); const d = G.advance(0.05, false); const r = d.objective.name; G.end(); return r; });
async function scoreRun(page, legs = 4) {
  return page.evaluate((legs) => {
    const G = window.__GAME__; G.start(); G.manualRender(true); let d = G.advance(0.05, false);
    for (let i = 0; i < legs; i++) { const o = d.objective.position; G.place(o.x, o.y + 1.2, o.z, 0, 0); d = G.advance(1.0, false); }
    const s = d.score; G.end(); G.advance(0.1, true); return { score: s, deliveries: d.deliveries };
  }, legs);
}
const store = (page) => page.evaluate(() => ({ daily: localStorage.getItem('drone-dash-daily-v1'), best: localStorage.getItem('drone-dash-best-v1') }));
// 1. same day: two loads in one profile, one in a fresh profile
const ctxA = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const pA = await ctxA.newPage(); await pA.goto('http://127.0.0.1:5188/?daily', { waitUntil: 'networkidle' }); await pA.waitForTimeout(600);
const a1 = await cityOf(pA); await pA.screenshot({ path: OUT + 'D-daily-title-desktop.jpg', type: 'jpeg', quality: 80 });
const f1 = await firstObj(pA);
await pA.reload({ waitUntil: 'networkidle' }); await pA.waitForTimeout(600); const a2 = await cityOf(pA); const f2 = await firstObj(pA);
const pB = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); await pB.goto('http://127.0.0.1:5188/?daily', { waitUntil: 'networkidle' }); await pB.waitForTimeout(600); const b1 = await cityOf(pB);
log('SAMEDAY', { a1, a2, b1, first: [f1, f2], same: a1.seed === a2.seed && a1.seed === b1.seed, sameFirst: f1 === f2 });
// 2. other dates: mocked clock and the ?daily=YYYY-MM-DD form
const pC = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); await pC.clock.setFixedTime(new Date('2026-10-16T10:00:00')); await pC.goto('http://127.0.0.1:5188/?daily', { waitUntil: 'networkidle' }); await pC.waitForTimeout(600); const c1 = await cityOf(pC);
const pD = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); await pD.clock.setFixedTime(new Date('2026-12-31T23:30:00')); await pD.goto('http://127.0.0.1:5188/?daily', { waitUntil: 'networkidle' }); await pD.waitForTimeout(600); const d1 = await cityOf(pD);
log('OTHERDAY', { today: a1.seed, d1016: c1, d1231: d1, differ: c1.seed !== a1.seed && d1.seed !== a1.seed && c1.seed !== d1.seed });
// 3. own best: a daily run, then a random-city run with a higher score, then reload daily
const r1 = await scoreRun(pA, 4); await pA.waitForTimeout(1200); await pA.screenshot({ path: OUT + 'D-daily-over-desktop.jpg', type: 'jpeg', quality: 80 });
const overTxt = await pA.evaluate(() => ({ city: document.getElementById('over-city')?.innerText, daily: document.getElementById('over-daily')?.innerText, dailyHidden: document.getElementById('over-daily')?.hidden }));
const s1 = await store(pA);
await pA.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' }); await pA.waitForTimeout(600); const rnd = await cityOf(pA); const r2 = await scoreRun(pA, 8); await pA.waitForTimeout(800); const s2 = await store(pA);
await pA.goto('http://127.0.0.1:5188/?daily', { waitUntil: 'networkidle' }); await pA.waitForTimeout(600); const a3 = await cityOf(pA); await pA.screenshot({ path: OUT + 'D-daily-title-after-best.jpg', type: 'jpeg', quality: 80 });
// a second daily attempt: same parcels?
const fA = await pA.evaluate(() => { const G = window.__GAME__; const names = []; for (let k = 0; k < 2; k++) { G.start(); G.manualRender(true); let d = G.advance(0.05, false); const n = []; for (let i = 0; i < 4; i++) { n.push(d.objective.name); const o = d.objective.position; G.place(o.x, o.y + 1.2, o.z, 0, 0); d = G.advance(1.0, false); } names.push(n.join(' > ')); G.end(); G.advance(0.1, false); } return names; });
// the same date in another month's mocked clock shows no daily best
const pE = await ctxA.newPage(); await pE.clock.setFixedTime(new Date('2026-10-16T10:00:00')); await pE.goto('http://127.0.0.1:5188/?daily', { waitUntil: 'networkidle' }); await pE.waitForTimeout(600); const e1 = await cityOf(pE);
log('BEST', { dailyRun: r1, overTxt, storeAfterDaily: s1, randomCity: rnd.seed, randomRun: r2, storeAfterRandom: s2, dailyTitleAfter: a3, replayParcels: fA, sameParcelsOnReplay: fA[0] === fA[1], tomorrowSameProfile: e1 });
// mobile landscape title with the daily city
const pM = await (await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage(); await pM.goto('http://127.0.0.1:5188/?daily', { waitUntil: 'networkidle' }); await pM.waitForTimeout(800); await pM.screenshot({ path: OUT + 'D-daily-title-mobile.jpg', type: 'jpeg', quality: 80 });
const btn = await pM.evaluate(() => [...document.querySelectorAll('#title-screen button, .city-pick button, #play-button')].map((b) => { const r = b.getBoundingClientRect(); return { id: b.id, text: b.innerText, w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.y), vis: r.width > 0 && r.y < innerHeight && r.bottom <= innerHeight }; }));
const pR = await (await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage(); await pR.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' }); await pR.waitForTimeout(800); await pR.screenshot({ path: OUT + 'D-random-title-mobile.jpg', type: 'jpeg', quality: 80 });
const pRd = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); await pRd.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' }); await pRd.waitForTimeout(800); await pRd.screenshot({ path: OUT + 'D-random-title-desktop.jpg', type: 'jpeg', quality: 80 });
log('MOBILE', { buttons: btn });
await browser.close();
