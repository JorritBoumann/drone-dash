// Round 20 builder: iPhone 13 landscape: rectangles of the centre pops (each forced visible at its peak) against the slipstream
// and boost meters, the cue line, the route hint and objective pill. Prints overlaps.
import { chromium } from '@playwright/test';
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5188/?seed=' + (process.env.SEED || '58'), { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
await page.evaluate(() => { window.__GAME__.start(); });
await page.waitForTimeout(1500);
const res = await page.evaluate(() => {
  const R = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), b: Math.round(r.bottom), r: Math.round(r.right) }; };
  document.getElementById('slip').classList.add('show', 'on', 'active');
  const fixed = { slip: R(document.getElementById('slip')), boost: R(document.querySelector('.boost')), cue: R(document.getElementById('slip-cue')), hint: R(document.getElementById('route-hint')), objective: R(document.querySelector('.objective') || document.getElementById('objective-name')), telemetry: R(document.querySelector('.telemetry')) };
  const pops = {};
  for (const [id, main, sub] of [['pop', 'Crash!', '-3 sec · x1.3 combo lost'], ['event-pop', 'Rush hour', 'Rush parcels pay +150 if you beat the tag'], ['medal-pop', 'Silver!', 'Next: Gold 4,500'], ['slip-pop', '+120', 'Banked · chain x3']]) {
    const el = document.getElementById(id);
    const s = el.querySelector('strong'); if (s) s.textContent = main; const sp = el.querySelector('span'); if (sp) sp.textContent = sub;
    el.style.animation = 'none'; el.style.opacity = '1';
    pops[id] = R(el);
    el.style.opacity = ''; el.style.animation = '';
  }
  return { fixed, pops };
});
const hit = (a, b) => a.w > 0 && b.w > 0 && a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;
const over = [];
for (const [pk, pr] of Object.entries(res.pops)) for (const [fk, fr] of Object.entries(res.fixed)) if (hit(pr, fr)) over.push(pk + ' x ' + fk);
console.log(JSON.stringify(res)); console.log('OVERLAPS', over.length, JSON.stringify(over));
await browser.close();
