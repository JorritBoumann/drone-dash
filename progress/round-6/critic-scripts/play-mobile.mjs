// NOTE: CDP touchEnd ends the touch points it lists, so lifting one finger lists only that finger.
// iPhone 13 landscape, touch only (CDP touches). Full flow: title, play, flight, pickup, deliver, game over, restart.
import { chromium, devices } from '@playwright/test';
const OUT = new URL('../critic/', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'] });
const page = await ctx.newPage();
await page.addInitScript(() => {
  const orig = window.requestAnimationFrame.bind(window); window.__px = [];
  window.requestAnimationFrame = (cb) => orig((t) => { cb(t); try { const c = document.getElementById('game-canvas'); const gl = c.getContext('webgl2'); const buf = new Uint8Array(16); const out = new Set(); for (let i = 0; i < 9; i++) { gl.readPixels(Math.floor(c.width * (0.1 + 0.1 * i)), Math.floor(c.height * (0.2 + 0.07 * i)), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf); out.add(buf.slice(0, 3).join(',')); } window.__px.push(out.size); } catch (e) { window.__px.push(-1); } });
});
const cdp = await ctx.newCDPSession(page);
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: OUT + 'm01-title.jpg', type: 'jpeg', quality: 80 });
const box = (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, sel);
const tapSel = async (re) => { const b = await page.evaluate((src) => { const re = new RegExp(src, 'i'); const b = [...document.querySelectorAll('button')].find((b) => re.test(b.textContent) && b.offsetParent); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; }, re); if (b) await page.touchscreen.tap(b.x, b.y); return b; };
console.log('play button', await tapSel('^\\s*play'));
await page.waitForTimeout(250); await page.screenshot({ path: OUT + 'm02-takeoff-250ms.jpg', type: 'jpeg', quality: 80 });
const stick = await box('#touch-stick'), up = await box('#up-button'), boost = await box('#boost-button'), down = await box('#down-button');
const rects = await page.evaluate(() => Object.fromEntries(['timer', 'objective', 'touch-stick', 'up-button', 'boost-button', 'down-button', 'pause-button', 'score', 'boost-meter'].map((id) => { const e = document.getElementById(id); if (!e) return [id, null]; const r = e.getBoundingClientRect(); return [id, [r.x, r.y, r.width, r.height].map(Math.round)]; })));
console.log('rects', JSON.stringify(rects));
const sc = { x: stick.x + stick.w / 2, y: stick.y + stick.h / 2 }; const R = stick.w * 0.4;
const ctr = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
let active = {}; // id -> {x,y}
const send = async (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: Object.entries(active).map(([id, p]) => ({ x: p.x, y: p.y, id: Number(id) })) });
let btn = null;
async function control(sx, sy, which) {
  const had = !!active[1]; active[1] = { x: sc.x + sx * R, y: sc.y + sy * R };
  if (!had) await send('touchStart'); 
  if (which !== btn) { if (btn) { const gone = active[2]; delete active[2]; await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: gone.x, y: gone.y, id: 2 }] }); } btn = which; if (which) { active[2] = ctr({ up, down, boost }[which]); await send('touchStart'); } }
  await send('touchMove');
}
async function releaseAll() { active = {}; btn = null; await send('touchEnd'); }
const diag = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__THREE_GAME_DIAGNOSTICS__)));
let d = await diag(); console.log('post', d.renderer.post, 'dpr', d.canvas.dpr, 'canvas', d.canvas.width, d.canvas.height);
await page.evaluate(() => { window.__fd = []; let l = performance.now(); const f = (t) => { window.__fd.push(t - l); l = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
const shots = {}; const ev = []; let lastDel = 0, lastSpeed = 0; const start = Date.now(); let hist = [], unstick = 0;
while (Date.now() - start < Number(process.env.DUR||75000)) {
  d = await diag(); const el = (Date.now() - start) / 1000;
  if (d.state !== 'playing') { ev.push(['state', d.state, el.toFixed(1)]); break; }
  const p = d.player.position, c = d.camera, o = d.objective.position;
  const heading = Math.atan2(p.x - c.x, p.z - c.z); let err = Math.atan2(o.x - p.x, o.z - p.z) - heading; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
  const hd = Math.hypot(o.x - p.x, o.z - p.z);
  hist.push([el, hd]); while (hist.length && hist[0][0] < el - 3) hist.shift();
  if (unstick <= 0 && el > 4 && hist.length > 5 && Math.abs(hist[0][1] - hd) < 1 && hd > 4) { unstick = 1.5; ev.push(['unstick', el.toFixed(1), 'hd', hd.toFixed(0)]); }
  const wantY = hd > 25 ? Math.max(o.y + 6, 40) : o.y + 1.2;
  if (unstick > 0) { unstick -= 0.08; await control(0, 0.8, 'up'); }
  else {
    const sx = Math.max(-1, Math.min(1, -err * 1.6));
    const sy = Math.abs(err) > 0.9 ? 0 : (hd < 6 && d.player.speed > 6 ? 0.5 : -1);
    const which = p.y < wantY - 1.5 ? 'up' : p.y > wantY + 1.5 ? 'down' : (hd > 60 && Math.abs(err) < 0.3 && d.player.boost > 0.3 ? 'boost' : null);
    await control(sx, sy, which);
  }
  if (!shots.f && el > 3) { shots.f = 1; await page.screenshot({ path: OUT + 'm03-flight.jpg', type: 'jpeg', quality: 80 }); }
  if (d.player.carrying && !shots.c) { shots.c = 1; ev.push(['picked', el.toFixed(1), 'tl', d.timeLeft.toFixed(1)]); await page.screenshot({ path: OUT + 'm04-picked-up.jpg', type: 'jpeg', quality: 80 }); }
  if (d.player.carrying && hd < 30 && !shots.c2) { shots.c2 = 1; await page.screenshot({ path: OUT + 'm05-carrying-near-drop.jpg', type: 'jpeg', quality: 80 }); }
  if (d.deliveries > lastDel) { lastDel = d.deliveries; ev.push(['delivered', lastDel, el.toFixed(1), 'score', d.score, 'tl', d.timeLeft.toFixed(1)]); if (!shots.dl) { shots.dl = 1; await page.waitForTimeout(100); await page.screenshot({ path: OUT + 'm06-delivery.jpg', type: 'jpeg', quality: 80 }); } }
  if (lastSpeed - d.player.speed > 5) { ev.push(['bump', el.toFixed(1), lastSpeed.toFixed(1), d.player.speed.toFixed(1)]); if (!shots.b) { shots.b = 1; await page.screenshot({ path: OUT + 'm07-bump.jpg', type: 'jpeg', quality: 80 }); } }
  lastSpeed = d.player.speed;
  if (process.env.TRACE && Math.floor(el*2)!==globalThis.__lt){globalThis.__lt=Math.floor(el*2); console.log('T',el.toFixed(1),'p',p.x.toFixed(0),p.y.toFixed(0),p.z.toFixed(0),'hd',hd.toFixed(0),'err',err.toFixed(2),'spd',d.player.speed.toFixed(1),'btn',btn, 'knob', await page.evaluate(()=>document.getElementById('touch-knob').style.transform.replace(/calc\(-50% /g,'')));}
  await page.waitForTimeout(60);
}
await releaseAll();
const fd = await page.evaluate(() => window.__fd.slice(30)); const s = [...fd].sort((a, b) => a - b); const q = (x) => s[Math.floor(s.length * x)];
console.log('FRAMES', JSON.stringify({ n: s.length, median: q(0.5).toFixed(2), p95: q(0.95).toFixed(2), max: s.at(-1).toFixed(1), over20: s.filter((v) => v > 20).length }));
console.log('EVENTS', JSON.stringify(ev));
await page.waitForTimeout(1500); await page.screenshot({ path: OUT + 'm08-game-over.jpg', type: 'jpeg', quality: 80 });
console.log('fly again', await tapSel('fly again'));
await page.waitForTimeout(300); d = await diag(); console.log('after restart', d.state, d.timeLeft.toFixed(1)); await page.screenshot({ path: OUT + 'm09-restart.jpg', type: 'jpeg', quality: 80 });
const px = await page.evaluate(() => window.__px.slice()); console.log('PIXEL frames', px.length, 'flat', px.filter((v) => v === 1).length);
console.log('errors', errors);
await browser.close();
