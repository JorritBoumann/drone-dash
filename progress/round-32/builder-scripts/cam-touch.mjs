// Round 22 critic: iPhone 13 landscape, real CDP touch. Finger 1 holds the stick forward; finger 2 drags empty screen to orbit.
import { chromium, devices } from '@playwright/test';
const OUT = new URL('./out/', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'] });
const page = await ctx.newPage();
await page.addInitScript({ path: new URL('./cam-sampler.js', import.meta.url).pathname });
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://127.0.0.1:5190/?seed=' + (process.env.SEED || '130'), { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
const shot = (n) => page.screenshot({ path: OUT + `cam-m-${n}.jpg`, type: 'jpeg', quality: 80 });
await shot('01-title');
const cdp = await ctx.newCDPSession(page);
const tap = async (x, y) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 9 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
const b = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((b) => /^\s*play/i.test(b.textContent) && b.offsetParent); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await tap(b.x, b.y); await page.waitForTimeout(500);
const box = (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, sel);
const stick = await box('#touch-stick'); const boost = await box('#boost-button');
const vp = page.viewportSize(); console.log('VP', JSON.stringify(vp), 'stick', JSON.stringify(stick), 'boost', JSON.stringify(boost));
const hintAt = []; for (const t of [0, 1, 2.5]) { if (t) await page.waitForTimeout(1000); hintAt.push(await page.evaluate(() => { const e = document.getElementById('view-hint'); const cs = getComputedStyle(e); const vis = [...e.children].map((c) => getComputedStyle(c).display + ':' + c.innerText); return { op: cs.opacity, disp: cs.display, vis }; })); }
console.log('HINT', JSON.stringify(hintAt));
await shot('02-start');
await page.evaluate(() => { window.__cs.on = true; });
const mark = (k) => page.evaluate((k) => window.__cs.rows.push({ mark: k }), k);
const sc = { x: stick.x + stick.w / 2, y: stick.y + stick.h / 2 }, R = stick.w * 0.4;
const pts = {}; const send = (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: Object.entries(pts).map(([id, p]) => ({ x: p.x, y: p.y, id: Number(id) })) });
pts[1] = { x: sc.x, y: sc.y }; await send('touchStart'); pts[1] = { x: sc.x, y: sc.y - R }; await send('touchMove');
await page.waitForTimeout(1500);
// drag finger 2 on empty screen (centre-right), 160 px right over 0.4 s, hold, release
const ex = vp.width * 0.62, ey = vp.height * 0.45;
await mark('drag'); pts[2] = { x: ex, y: ey }; await send('touchStart');
for (let i = 1; i <= 16; i++) { pts[2] = { x: ex + i * 10, y: ey }; pts[1] = { x: sc.x + Math.sin(i / 3) * 2, y: sc.y - R }; await send('touchMove'); await page.waitForTimeout(25); }
await page.waitForTimeout(250); await shot('03-drag-held');
await mark('release'); { const g = pts[2]; delete pts[2]; await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: g.x, y: g.y, id: 2 }] }); }
await page.waitForTimeout(2200); await shot('04-after-ease');
// vertical drag up (look down)
await mark('dragV'); pts[2] = { x: ex, y: ey }; await send('touchStart');
for (let i = 1; i <= 12; i++) { pts[2] = { x: ex, y: ey + i * 8 }; await send('touchMove'); await page.waitForTimeout(25); }
await mark('releaseV'); { const g = pts[2]; delete pts[2]; await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: g.x, y: g.y, id: 2 }] }); }
await page.waitForTimeout(2000);
// boost button press while stick held: must not orbit
await mark('boostbtn'); pts[3] = { x: boost.x + boost.w / 2, y: boost.y + boost.h / 2 }; await send('touchStart'); await page.waitForTimeout(800); { const g = pts[3]; delete pts[3]; await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: g.x, y: g.y, id: 3 }] }); }
await mark('end'); await page.waitForTimeout(600);
// drag starting on a HUD element (objective pill) region top centre
await mark('hud'); const pill = await box('#objective'); if (pill) { pts[4] = { x: pill.x + pill.w / 2, y: pill.y + pill.h / 2 }; await send('touchStart'); for (let i = 1; i <= 10; i++) { pts[4] = { x: pill.x + pill.w / 2 + i * 10, y: pill.y + pill.h / 2 }; await send('touchMove'); await page.waitForTimeout(25); } { const g = pts[4]; delete pts[4]; await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: g.x, y: g.y, id: 4 }] }); } }
await mark('hud-end'); await page.waitForTimeout(1500);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
const rows = await page.evaluate(() => window.__cs.rows); (await import('fs')).writeFileSync(new URL('./cam-touch-rows.json', import.meta.url).pathname, JSON.stringify(rows));
const marks = {}; rows.forEach((r, i) => { if (r.mark) marks[r.mark] = i; });
const seg = (a, b) => rows.slice(marks[a], b ? marks[b] : rows.length).filter((r) => !r.mark);
const deg = (x) => +(x * 180 / Math.PI).toFixed(1);
const back = (s) => { const t0 = s[0].t; const r = s.find((r) => Math.abs(r.yaw) < 0.035 && Math.abs(r.pitch) < 0.035); return r ? +(r.t - t0).toFixed(2) : null; };
const d = seg('drag', 'release'), rl = seg('release', 'dragV'), dv = seg('dragV', 'releaseV'), rv = seg('releaseV', 'boostbtn'), bb = seg('boostbtn', 'end'), hu = seg('hud', 'hud-end');
console.log('DRAG', JSON.stringify({ yawMax: deg(Math.max(...d.map((r) => Math.abs(r.yaw)))), speedDuring: +Math.min(...d.map((r) => r.speed)).toFixed(1), easeBack: back(rl), yawAtRelease: deg(rl[0].yaw) }));
console.log('DRAGV', JSON.stringify({ pitchMax: deg(Math.max(...dv.map((r) => Math.abs(r.pitch)))), easeBack: back(rv) }));
console.log('BOOSTBTN', JSON.stringify({ boosting: bb.some((r) => r.boosting), yawMax: deg(Math.max(...bb.map((r) => Math.abs(r.yaw)))) }));
console.log('HUDDRAG', JSON.stringify({ yawMax: deg(Math.max(...hu.map((r) => Math.abs(r.yaw)))) }));
const all = rows.filter((r) => !r.mark); let pops = 0; for (let i = 1; i < all.length; i++) { const a = all[i - 1], b2 = all[i]; if (Math.hypot((b2.cx - a.cx) - (b2.px - a.px), (b2.cy - a.cy) - (b2.py - a.py), (b2.cz - a.cz) - (b2.pz - a.pz)) > 1) pops++; }
console.log('SUM', JSON.stringify({ frames: all.length, pops, in0: all.filter((r) => r.in0).length, errors }));
await browser.close();
