// Round 22 critic: real-time desktop camera controls. Real mouse right-drag, wheel, synthetic trackpad wheel, ctrl-pinch, left-click boost.
import { chromium } from '@playwright/test';
const OUT = new URL('../../builder-shots/', import.meta.url).pathname;
const SEED = process.env.SEED || '22';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.addInitScript({ path: new URL('./cam-sampler.js', import.meta.url).pathname });
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://127.0.0.1:5190/?seed=' + SEED, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
const shot = (n) => page.screenshot({ path: OUT + `cam-d-${n}.jpg`, type: 'jpeg', quality: 80 });
await shot('01-title');
console.log('TITLE-CONTROLS', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('li, .controls-touch, .view-hint')].map((e) => e.innerText.replace(/\s+/g, ' ')).filter((s) => /look|drag|zoom|boost|swipe/i.test(s)))));
await page.keyboard.press('Enter'); await page.waitForTimeout(600);
const hint = await page.evaluate(() => { const e = document.getElementById('view-hint'); if (!e) return null; const cs = getComputedStyle(e); return { text: e.innerText, vis: cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && e.getBoundingClientRect().width > 0, op: cs.opacity }; });
console.log('INGAME-HINT', JSON.stringify(hint));
await shot('02-start-hint');
await page.evaluate(() => { window.__cs.on = true; });
const mark = (k) => page.evaluate((k) => { window.__cs.rows.push({ mark: k, t: performance.now() / 1000 }); }, k);
await page.keyboard.down('KeyW'); await page.waitForTimeout(1500);
// 1. right-drag 300 px right over 0.5 s, hold 0.3 s, release, watch 2.5 s
await page.mouse.move(640, 360);
await mark('drag1'); await page.mouse.down({ button: 'right' });
for (let i = 1; i <= 20; i++) { await page.mouse.move(640 + i * 15, 360); await page.waitForTimeout(25); }
await page.waitForTimeout(300); await shot('03-rightdrag-held');
await mark('release1'); await page.mouse.up({ button: 'right' });
await page.waitForTimeout(2500);
// 2. right-drag up (look down from above) 150 px
await mark('drag2'); await page.mouse.down({ button: 'right' });
for (let i = 1; i <= 15; i++) { await page.mouse.move(640, 360 + i * 10); await page.waitForTimeout(25); }
await page.waitForTimeout(200); await shot('04-drag-pitch');
await mark('release2'); await page.mouse.up({ button: 'right' }); await page.waitForTimeout(2200);
// 3. mouse wheel: 3 notches out, then 3 in
await mark('wheelout'); for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(80); }
await page.waitForTimeout(700); await shot('05-wheel-out');
await mark('wheelin'); for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -100); await page.waitForTimeout(80); }
await page.waitForTimeout(700); await shot('06-wheel-in');
for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(80); }
await page.waitForTimeout(600);
// 4. synthetic trackpad two-finger swipe left (fractional px deltas, deltaX), 30 events at 60 Hz, plus a tail
await mark('trackpad'); await page.evaluate(async () => { const c = document.querySelector('canvas'); for (let i = 0; i < 30; i++) { c.dispatchEvent(new WheelEvent('wheel', { deltaX: -9.5 + Math.sin(i) * 0.5, deltaY: 1.25, deltaMode: 0, bubbles: true, cancelable: true })); await new Promise((r) => setTimeout(r, 16)); } });
await page.waitForTimeout(150); await shot('07-trackpad');
await mark('trackpad-end'); await page.waitForTimeout(2200);
// 4b. trackpad vertical only (deltaY fractional, no deltaX): should orbit pitch, not zoom
await mark('trackpadV'); await page.evaluate(async () => { const c = document.querySelector('canvas'); for (let i = 0; i < 25; i++) { c.dispatchEvent(new WheelEvent('wheel', { deltaX: 0, deltaY: 6.5, deltaMode: 0, bubbles: true, cancelable: true })); await new Promise((r) => setTimeout(r, 16)); } });
await mark('trackpadV-end'); await page.waitForTimeout(2000);
// 5. ctrl-pinch (real ctrl + wheel through CDP) in, then synthetic ctrl wheel out
await mark('pinch'); await page.keyboard.down('Control'); for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, -6); await page.waitForTimeout(16); } await page.keyboard.up('Control');
await page.waitForTimeout(500); await shot('08-pinch-in');
await mark('pinch2'); await page.evaluate(async () => { const c = document.querySelector('canvas'); for (let i = 0; i < 12; i++) { c.dispatchEvent(new WheelEvent('wheel', { deltaY: 6, ctrlKey: true, deltaMode: 0, bubbles: true, cancelable: true })); await new Promise((r) => setTimeout(r, 16)); } });
await page.waitForTimeout(600);
// 6. left-click boost
await mark('boost'); await page.mouse.down({ button: 'left' }); await page.waitForTimeout(900); await shot('09-leftboost');
await mark('boost-up'); await page.mouse.up({ button: 'left' }); await page.waitForTimeout(800);
// 7. chord: right-drag then left press during it
await mark('chord'); await page.mouse.down({ button: 'right' }); for (let i = 1; i <= 10; i++) { await page.mouse.move(640 - i * 15, 360); await page.waitForTimeout(25); }
await page.mouse.down({ button: 'left' }); await page.waitForTimeout(600); await mark('chord-left-up'); await page.mouse.up({ button: 'left' }); await page.waitForTimeout(300); await page.mouse.up({ button: 'right' }); await mark('chord-end');
await page.waitForTimeout(2000);
await page.keyboard.up('KeyW');
const rows = await page.evaluate(() => window.__cs.rows);
const fs = await import('fs'); fs.writeFileSync(OUT + '../critic-scripts/cam-desktop-rows.json', JSON.stringify(rows));
// analysis
const marks = {}; rows.forEach((r, i) => { if (r.mark) marks[r.mark] = i; });
const seg = (a, b) => rows.slice(marks[a], b ? marks[b] : rows.length).filter((r) => !r.mark);
const deg = (r) => r * 180 / Math.PI;
function easeBack(from) { const s = seg(from); const t0 = s[0].t; let peak = 0; let back = null; for (const r of s) { peak = Math.max(peak, Math.abs(r.yaw) + Math.abs(r.pitch)); if (back === null && Math.abs(r.yaw) < 0.035 && Math.abs(r.pitch) < 0.035) back = r.t - t0; } return { startDeg: +deg(Math.abs(s[0].yaw) + Math.abs(s[0].pitch)).toFixed(1), backIn: back && +back.toFixed(2) }; }
const s1 = seg('drag1', 'release1'); console.log('DRAG1', JSON.stringify({ yawMaxDeg: +deg(Math.max(...s1.map((r) => Math.abs(r.yaw)))).toFixed(1), behindYawEnd: +deg(s1.at(-1).by).toFixed(1), ease: easeBack('release1') }));
const s2 = seg('drag2', 'release2'); console.log('DRAG2', JSON.stringify({ pitchMaxDeg: +deg(Math.max(...s2.map((r) => r.pitch))).toFixed(1), elevEnd: +deg(s2.at(-1).be).toFixed(1), ease: easeBack('release2') }));
const zo = seg('wheelout', 'wheelin'), zi = seg('wheelin', 'trackpad');
console.log('WHEEL', JSON.stringify({ zoomStart: zo[0].zoom.toFixed(3), zoomOut: zo.at(-1).zoom.toFixed(3), yawDuringWheel: deg(Math.max(...zo.map((r) => Math.abs(r.yaw)))).toFixed(1), zoomIn: zi.at(-1).zoom.toFixed(3), distOut: Math.max(...zo.map((r) => r.dist)).toFixed(1), distIn: Math.min(...zi.map((r) => r.dist)).toFixed(1) }));
const tp = seg('trackpad', 'trackpad-end'); console.log('TRACKPAD', JSON.stringify({ yawMaxDeg: deg(Math.max(...tp.map((r) => Math.abs(r.yaw)))).toFixed(1), zoomChange: (tp.at(-1).zoom - tp[0].zoom).toFixed(3), ease: easeBack('trackpad-end') }));
const tv = seg('trackpadV', 'trackpadV-end'); console.log('TRACKPAD-V', JSON.stringify({ pitchMaxDeg: deg(Math.max(...tv.map((r) => Math.abs(r.pitch)))).toFixed(1), zoomChange: (tv.at(-1).zoom - tv[0].zoom).toFixed(3) }));
const pz = seg('pinch', 'pinch2'), pz2 = seg('pinch2', 'boost'); console.log('PINCH', JSON.stringify({ zoomA: pz[0].zoom.toFixed(3), zoomIn: pz.at(-1).zoom.toFixed(3), yaw: deg(Math.max(...pz.map((r) => Math.abs(r.yaw)))).toFixed(1), zoomOut: pz2.at(-1).zoom.toFixed(3) }));
const bs = seg('boost', 'boost-up'), bu = seg('boost-up', 'chord'); const firstB = bs.find((r) => r.boosting); console.log('BOOST', JSON.stringify({ boostAfter: firstB ? +(firstB.t - bs[0].t).toFixed(3) : null, speed0: bs[0].speed.toFixed(1), speedMax: Math.max(...bs.map((r) => r.speed)).toFixed(1), stillBoostingAfterUp: bu.slice(10).some((r) => r.boosting), orbitDuringBoost: deg(Math.max(...bs.map((r) => Math.abs(r.yaw)))).toFixed(1) }));
const ch = seg('chord', 'chord-left-up'), che = seg('chord-left-up', 'chord-end'); console.log('CHORD', JSON.stringify({ boostDuringDrag: ch.some((r) => r.boosting), boostAfterLeftUp: che.slice(6).some((r) => r.boosting), yawDeg: deg(Math.max(...ch.map((r) => Math.abs(r.yaw)))).toFixed(1) }));
// smoothness: per-frame camera jump relative to drone motion
let maxJ = 0, nJ = 0; const all = rows.filter((r) => !r.mark); for (let i = 1; i < all.length; i++) { const a = all[i - 1], b = all[i]; const j = Math.hypot((b.cx - a.cx) - (b.px - a.px), (b.cy - a.cy) - (b.py - a.py), (b.cz - a.cz) - (b.pz - a.pz)); maxJ = Math.max(maxJ, j); if (j > 0.5) nJ++; }
console.log('SMOOTH', JSON.stringify({ frames: all.length, maxRelJump: maxJ.toFixed(2), jumpsOver05: nJ, in0: all.filter((r) => r.in0).length, occ: all.filter((r) => r.occ).length, errors }));
await browser.close();
