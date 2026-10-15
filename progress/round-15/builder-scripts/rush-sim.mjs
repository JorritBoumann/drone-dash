// Round 15 builder: fast deterministic rush-hour check. Teleports onto each pad after a fixed flight time (FLY s per leg)
// so legs are slow enough to miss some rush windows; logs the escalation diagnostics and the rush HUD; screenshots.
import { chromium } from '@playwright/test';
const SEED = Number(process.env.SEED || 22); const FLY = Number(process.env.FLY || 9); const OUT = '../builder-shots/';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
await page.goto('http://127.0.0.1:5188/?seed=' + SEED, { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
await page.evaluate(() => { const G = window.__GAME__; G.externalClock(true); G.start(); G.advance(0.05, false); });
let shots = 0; const log = [];
for (let leg = 0; leg < 40; leg++) {
  const r = await page.evaluate(({ FLY }) => { const G = window.__GAME__; let d = G.diagnostics(); if (d.state !== 'playing') return { over: true, d };
    const p = d.objective.position; const t = d.runTime; d = G.advance(FLY, false); if (d.state !== 'playing') return { over: true, d };
    G.place(p.x, p.y + 1.3, p.z, 0, 0); d = G.advance(0.3, true);
    return { over: d.state !== 'playing', esc: d.escalation, score: d.score, phase: d.objective && d.objective.phase, rushTag: document.getElementById('objective-rush').hidden ? null : document.getElementById('objective-rush').innerText, d: null }; }, { FLY });
  if (r.over) { log.push({ end: r.d.score, esc: r.d.escalation, bd: r.d.breakdown }); break; }
  log.push({ leg, score: r.score, phase: r.phase, stage: r.esc.stage, orders: r.esc.orders, made: r.esc.made, missed: r.esc.missed, active: r.esc.active, left: +r.esc.left.toFixed(1), tag: r.rushTag });
  if (r.esc.active && shots < 2) { shots++; await page.waitForTimeout(200); await page.screenshot({ path: OUT + `R-rush-sim-seed${SEED}-${shots}.jpg`, type: 'jpeg', quality: 80 }); }
}
const fin = await page.evaluate(() => { const d = window.__GAME__.diagnostics(); return { score: d.score, bd: d.breakdown, esc: d.escalation, rushLog: d.scoreLog.filter((e) => e.k.startsWith('rush')), dom: [...document.querySelectorAll('#over-breakdown > div')].map((r) => r.innerText.replace(/\s+/g, ' ')) }; });
for (const l of log) console.log(JSON.stringify(l));
console.log('FINAL ' + JSON.stringify(fin)); console.log('ERRORS ' + errs.length + ' ' + errs.slice(0, 3).join(' | '));
await browser.close();
