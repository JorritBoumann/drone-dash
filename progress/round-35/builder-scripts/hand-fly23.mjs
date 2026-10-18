// Round 23 critic: hand-fly20 with overlap-init23.js. Round 20 critic: hand-fly + overlap-init.js (HUD overlap sampler, log-only). Control unchanged. OVSHOT=1 screenshots the first 3 overlaps.
// Round 6 critic: hand-style flight of both lines, desktop (keyboard) or MOBILE=1 (iPhone 13 landscape, CDP touch).
// Phase 1 (LOWT s): low street line with the route-play-rt low pilot. Phase 2 (HIGHT s): straight line at 40 m with boost.
// Screenshots: first draft, meter half, first payout pop, chained payout, high wind chip, high boost. Logs frame times, HUD rects, overlaps.
import { chromium, devices } from '@playwright/test';
const OUT = (process.env.OUTDIR || new URL('../builder-shots/', import.meta.url).pathname) + (process.env.PFX || '');
const MOBILE = !!process.env.MOBILE; const P = MOBILE ? 'm' : 'd'; const SEED = process.env.SEED || '22';
const LOWT = Number(process.env.LOWT || 50), HIGHT = Number(process.env.HIGHT || 30);
const ROADS = [-154, -110, -66, -22, 22, 66, 110, 154];
const nr = (v) => ROADS.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
function route(p, o) {
  const onX = Math.abs(p.x - nr(p.x)) < Math.abs(p.z - nr(p.z));
  const Xc = nr(p.x), Zc = nr(p.z), Xt = nr(o.x), Zt = nr(o.z);
  const finalOnX = Math.abs(o.x - Xt) < Math.abs(o.z - Zt);
  const last = finalOnX ? { x: Xt, z: o.z } : { x: o.x, z: Zt };
  let pts;
  if (onX) pts = finalOnX && Xc === Xt ? [{ x: Xc, z: p.z }, last] : [{ x: Xc, z: p.z }, { x: Xc, z: Zt }, { x: Xt, z: Zt }, last];
  else pts = !finalOnX && Zc === Zt ? [{ x: p.x, z: Zc }, last] : [{ x: p.x, z: Zc }, { x: Xt, z: Zc }, { x: Xt, z: Zt }, last];
  pts.push({ x: o.x, z: o.z, final: true });
  const out = []; for (const q of pts) { const l = out[out.length - 1] || p; if (Math.hypot(q.x - l.x, q.z - l.z) > 3 || q.final) out.push(q); }
  return out;
}
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.addInitScript({ path: new URL('./overlap-init23.js', import.meta.url).pathname });
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://127.0.0.1:5190/?seed=' + SEED, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
const shot = (n) => page.screenshot({ path: OUT + `${P}-${n}.jpg`, type: 'jpeg', quality: 80 });
await shot('h01-title');
const box = (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, sel);
let input;
if (MOBILE) {
  const cdp = await ctx.newCDPSession(page);
  const b = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((b) => /^\s*play/i.test(b.textContent) && b.offsetParent); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x, y: b.y, id: 9 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: b.x, y: b.y, id: 9 }] });
  await page.waitForTimeout(300);
  const stick = await box('#touch-stick'), bt = { up: await box('#up-button'), down: await box('#down-button'), boost: await box('#boost-button') };
  const sc = { x: stick.x + stick.w / 2, y: stick.y + stick.h / 2 }; const R = stick.w * 0.4; const ctr = (q) => ({ x: q.x + q.w / 2, y: q.y + q.h / 2 });
  let active = {}, btn = null;
  const send = (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: Object.entries(active).map(([id, p]) => ({ x: p.x, y: p.y, id: Number(id) })) });
  input = async ({ turn, fwd, lift, boost }) => { // turn -1 left..1 right, fwd -1..1, lift -1/0/1
    const had = !!active[1]; active[1] = { x: sc.x + turn * R, y: sc.y - fwd * R }; if (!had) await send('touchStart');
    const which = boost ? 'boost' : lift > 0 ? 'up' : lift < 0 ? 'down' : null;
    if (which !== btn) { if (btn) { const g = active[2]; delete active[2]; await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: g.x, y: g.y, id: 2 }] }); } btn = which; if (which) { active[2] = ctr(bt[which]); await send('touchStart'); } }
    await send('touchMove');
  };
} else {
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  const held = new Set(); const key = async (k, on) => { if (on && !held.has(k)) { held.add(k); await page.keyboard.down(k); } if (!on && held.has(k)) { held.delete(k); await page.keyboard.up(k); } };
  input = async ({ turn, fwd, lift, boost }) => { await key('KeyA', turn < -0.2); await key('KeyD', turn > 0.2); await key('KeyW', fwd > 0.2); await key('KeyS', fwd < -0.2); await key('Space', lift > 0); await key('ShiftLeft', lift < 0); await key('KeyE', !!boost); };
}
let ovN = 0, ovLast = 0;
const diag = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__THREE_GAME_DIAGNOSTICS__)));
await page.evaluate(() => { window.__fd = []; let l = performance.now(); const f = (t) => { window.__fd.push(t - l); l = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
let d = await diag(), prev = d; const t0 = Date.now(); let legKey = '', wps = [], leaving = true, posHist = [], unstick = 0; const shots = {}; const log = []; let lastPay = 0, lastDel = 0;
const hudIds = ['timer', 'objective', 'score', 'boost-meter', 'slip', 'wind', 'combo', 'touch-stick', 'up-button', 'down-button', 'boost-button', 'pause-button', 'telemetry'];
const rects = () => page.evaluate((ids) => ids.map((id) => { const e = document.getElementById(id) || document.querySelector('.' + id); if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { id, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), vis: cs.opacity !== '0' && cs.visibility !== 'hidden' && r.width > 0 }; }).filter(Boolean), hudIds);
let dt = 0.06, tl = Date.now();
while (d.state === 'playing') {
  const el = (Date.now() - t0) / 1000; if (el > LOWT + HIGHT) break; const low = el < LOWT;
  const p = d.player.position, c = d.camera, o = d.objective.position; const k = d.objective.phase + d.objective.name + low;
  if (k !== legKey) { legKey = k; leaving = true; posHist = []; wps = low ? route(p, o) : [{ x: o.x, z: o.z, final: true }]; }
  const hd = Math.hypot(o.x - p.x, o.z - p.z); let w = wps[0]; let wd = Math.hypot(w.x - p.x, w.z - p.z);
  if (!w.final && (wd < 4 || hd < 14)) { leaving = false; wps.shift(); w = wps[0]; wd = Math.hypot(w.x - p.x, w.z - p.z); }
  const vx = (p.x - prev.player.position.x) / dt, vz = (p.z - prev.player.position.z) / dt; const head = low && Math.hypot(vx, vz) > 4 ? Math.atan2(vx, vz) : Math.atan2(p.x - c.x, p.z - c.z);
  let err = Math.atan2(w.x - p.x, w.z - p.z) - head; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
  posHist.push([el, p.x, p.z]); while (posHist.length && posHist[0][0] < el - 3) posHist.shift();
  if (unstick <= 0 && posHist.length > 25 && el - posHist[0][0] > 2.7 && Math.hypot(posHist[0][1] - p.x, posHist[0][2] - p.z) < 1.5 && hd > 3) { unstick = 1.2; posHist = []; }
  let wantY, tgt, boost = false;
  if (!low) { wantY = hd > 25 ? Math.max(o.y + 6, 40) : o.y + 1.2; tgt = hd < 8 ? 4 : 99; boost = hd > 60 && Math.abs(err) < 0.3 && d.player.boost > 0.3; }
  else { const raised = o.y > 2; const offRoad = leaving && Math.min(Math.abs(p.x - nr(p.x)), Math.abs(p.z - nr(p.z))) > 6.5;
    wantY = offRoad && hd >= 30 ? 26 : hd < 30 ? (raised ? o.y + 1.5 : o.y + 1.2) : (raised && hd < 45 ? o.y + 2 : 7);
    const corner = !w.final && wd < 14; tgt = hd < 8 ? 4 : corner ? 7 : w.final && hd < 25 ? 8 : 16;
    boost = !corner && !w.final && wd > 55 && Math.abs(err) < 0.12 && d.player.boost > 0.3; if (raised && hd < 30 && p.y < o.y - 0.5) tgt = 1; if (Math.abs(err) > 0.5) tgt = Math.min(tgt, 8); }
  if (unstick > 0) { unstick -= dt; await input({ turn: 0, fwd: -1, lift: 1 }); }
  else await input({ turn: Math.abs(err) > 0.1 ? (err < 0 ? 1 : -1) : 0, fwd: d.player.speed > tgt + 3 || (Math.abs(err) > 1.2 && d.player.speed > 4) ? -1 : Math.abs(err) < 0.8 && d.player.speed < tgt ? 1 : 0, lift: p.y < wantY - 1.2 ? 1 : p.y > wantY + 1.2 ? -1 : 0, boost });
  prev = d; await page.waitForTimeout(30); d = await diag(); if (process.env.OVSHOT && ovN < 4) { const n = await page.evaluate(() => Object.values(window.__ov.hits).reduce((a, b) => a + b, 0)); if (n > ovLast + 3) { ovLast = n; ovN++; await shot('ov' + ovN); } } const now = Date.now(); dt = Math.max(0.03, (now - tl) / 1000); tl = now;
  const s = d.slipstream;
  if (s.drafting && !shots.draft && el > 2) { shots.draft = 1; await shot('h02-low-drafting'); log.push(['first draft', el.toFixed(1), 'y', p.y.toFixed(1), 'spd', d.player.speed.toFixed(1)]); }
  if (s.level > 0.5 && !shots.half) { shots.half = 1; await shot('h03-low-meter-half'); }
  if (s.payouts > lastPay) { lastPay = s.payouts; log.push(['payout', s.payouts, el.toFixed(1), 'chain', s.chain, 'pts', s.points, 'combo', d.combo]); if (!shots.pay) { shots.pay = 1; await page.waitForTimeout(80); await shot('h04-low-payout-pop'); log.push(['rects at payout', JSON.stringify(await rects())]); } else if (s.chain > 1 && !shots.chain) { shots.chain = 1; await page.waitForTimeout(80); await shot('h05-low-payout-chain'); } }
  if (d.deliveries > lastDel) { lastDel = d.deliveries; log.push(['deliver', lastDel, el.toFixed(1), 'score', d.score, 'combo', d.combo, 'low', low]); }
  if (!low && d.player.headwind > 0.9 && !shots.wind) { shots.wind = 1; await shot('h06-high-wind'); log.push(['rects at wind', JSON.stringify(await rects())]); }
  if (!low && d.player.boosting && d.player.headwind > 0.9 && !shots.hb) { shots.hb = 1; await page.waitForTimeout(600); await shot('h07-high-boost'); log.push(['high boost speed', d.player.speed.toFixed(1)]); }
  if (d.crashes > prev.crashes) log.push(['crash', el.toFixed(1), 'low', low, 'y', p.y.toFixed(1), 'loss', d.lastCrash?.loss?.toFixed(1)]);
}
await shot('h08-end');
console.log('OVERLAP', JSON.stringify(await page.evaluate(() => window.__ov)));
const fd = await page.evaluate(() => window.__fd.slice(30)); fd.sort((a, b) => a - b);
console.log(log.map((l) => l.join(' ')).join('\n'));
console.log(`${P} frames ${fd.length} median ${fd[Math.floor(fd.length / 2)].toFixed(2)} p95 ${fd[Math.floor(fd.length * 0.95)].toFixed(2)} max ${fd[fd.length - 1].toFixed(1)} over20 ${fd.filter((x) => x > 20).length} | final score ${d.score} deliveries ${d.deliveries} payouts ${d.slipstream.payouts} crashes ${d.crashes} errors ${errors.length}`);
await browser.close();
