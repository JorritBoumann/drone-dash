// Round 42 critic (new): the production build at the root path, as Vercel serves a static dist/ (5193). Desktop and
// iPhone 13: console errors and warnings, failed requests, HTML HUD shown (no canvas-hud class), play. Then every row of
// the README controls table, with real input (keyboard, mouse buttons, wheel on desktop; real CDP touch on the phone).
import { chromium, devices } from '@playwright/test';
const OUT = process.env.OUTDIR || '/tmp/'; const PORT = process.env.PORT || '5193';
const browser = await chromium.launch({ channel: 'chromium' });
const D = (p) => p.evaluate(() => { const d = window.__THREE_GAME_DIAGNOSTICS__; return { st: d.state, pos: d.player.position, speed: d.player.speed, boost: d.player.boost, boosting: d.player.boosting, yaw: d.player.yaw, cam: { x: d.camera.x, y: d.camera.y, z: d.camera.z, view: d.camera.view }, music: d.audio.music, mm: !document.getElementById('minimap').hidden && getComputedStyle(document.getElementById('minimap')).display !== 'none' && Number(getComputedStyle(document.getElementById('minimap')).opacity) > 0.05 }; });
for (const dev of (process.env.DEVS || 'desktop|iPhone 13 landscape').split('|')) {
  const touch = dev !== 'desktop';
  const ctx = await browser.newContext(touch ? { ...devices[dev] } : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); const cons = [], failed = [], bad = [], errs = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) cons.push(m.type() + ': ' + m.text().slice(0, 160)); });
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('requestfailed', (r) => failed.push(r.url()));
  page.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
  const r = { dev };
  r.title = await page.evaluate(() => ({ state: window.__THREE_GAME_DIAGNOSTICS__.state, seed: window.__THREE_GAME_DIAGNOSTICS__.seed, mode: window.__THREE_GAME_DIAGNOSTICS__.city.mode }));
  if (touch) await page.tap('#play-button'); else await page.click('#play-button');
  await page.waitForTimeout(1500);
  r.hud = await page.evaluate(() => { const v = (s) => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); let p = e, op = 1; while (p) { op *= Number(getComputedStyle(p).opacity); p = p.parentElement; } return b.width > 0 && op > 0.5; }; return { cls: document.getElementById('app').className, chud: window.__GAME__.canvasHud().on, score: v('.hud-score'), timer: v('#timer'), objective: v('#objective'), minimap: v('#minimap'), boost: v('.boost') }; });
  const ctl = {};
  if (!touch) {
    const hold = async (k, ms = 1200) => { const a = await D(page); await page.keyboard.down(k); await page.waitForTimeout(ms); const b = await D(page); await page.keyboard.up(k); await page.waitForTimeout(300); return [a, b]; };
    let [a, b] = await hold('KeyW'); ctl.W = +b.speed.toFixed(1);
    [a, b] = await hold('ArrowUp'); ctl.ArrowUp = +b.speed.toFixed(1);
    [a, b] = await hold('KeyA', 800); ctl.A_yaw = +(b.yaw - a.yaw).toFixed(2);
    [a, b] = await hold('ArrowRight', 800); ctl.ArrowRight_yaw = +(b.yaw - a.yaw).toFixed(2);
    [a, b] = await hold('KeyD', 800); ctl.D_yaw = +(b.yaw - a.yaw).toFixed(2);
    [a, b] = await hold('Space'); ctl.Space_dy = +(b.pos.y - a.pos.y).toFixed(1);
    [a, b] = await hold('ShiftLeft', 800); ctl.Shift_dy = +(b.pos.y - a.pos.y).toFixed(1);
    await hold('Space');
    [a, b] = await hold('KeyC', 800); ctl.C_dy = +(b.pos.y - a.pos.y).toFixed(1);
    await page.keyboard.down('KeyW'); [a, b] = await hold('KeyE', 900); await page.keyboard.up('KeyW'); ctl.E = { boosting: b.boosting, boostFrom: +a.boost.toFixed(2), boostTo: +b.boost.toFixed(2) };
    await page.waitForTimeout(1500);
    a = await D(page); await page.mouse.move(640, 500); await page.mouse.down({ button: 'left' }); await page.waitForTimeout(700); b = await D(page); await page.mouse.up({ button: 'left' }); ctl.leftClick = { boosting: b.boosting, boostFrom: +a.boost.toFixed(2), boostTo: +b.boost.toFixed(2) };
    await page.waitForTimeout(500);
    a = await D(page); await page.mouse.move(640, 400); await page.mouse.down({ button: 'right' }); for (let i = 1; i <= 10; i++) { await page.mouse.move(640 + i * 25, 400); await page.waitForTimeout(16); } b = await D(page); await page.mouse.up({ button: 'right' }); ctl.rightDrag_cam = +Math.hypot(b.cam.x - a.cam.x, b.cam.z - a.cam.z).toFixed(1); ctl.rightDragView = b.cam.view;
    await page.waitForTimeout(1200);
    a = await D(page); await page.mouse.move(640, 400); for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(60); } await page.waitForTimeout(300); b = await D(page); ctl.wheel_camDist = [a, b].map((s) => +Math.hypot(s.cam.x - s.pos.x, s.cam.y - s.pos.y, s.cam.z - s.pos.z).toFixed(1)); ctl.wheelView = b.cam.view;
    a = await D(page); await page.keyboard.press('KeyM'); await page.waitForTimeout(500); b = await D(page); await page.keyboard.press('KeyM'); await page.waitForTimeout(300); ctl.M_minimap = [a.mm, b.mm, (await D(page)).mm];
    a = await D(page); await page.keyboard.press('KeyN'); await page.waitForTimeout(400); b = await D(page); await page.keyboard.press('KeyN'); ctl.N_music = [a.music.enabled, b.music.enabled];
    await page.keyboard.press('Escape'); await page.waitForTimeout(400); ctl.Escape = (await D(page)).st; await page.keyboard.press('Escape'); await page.waitForTimeout(400); ctl.Escape2 = (await D(page)).st;
    await page.keyboard.press('KeyP'); await page.waitForTimeout(400); ctl.P = (await D(page)).st; await page.keyboard.press('KeyP'); await page.waitForTimeout(400); ctl.P2 = (await D(page)).st;
  } else {
    const cdp = await ctx.newCDPSession(page);
    const tp = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: p[2] ?? i })) });
    const box = (s) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return b.width ? [b.left + b.width / 2, b.top + b.height / 2] : null; }, s);
    ctl.buttons = await page.evaluate(() => [...document.querySelectorAll('#touch-controls button, .hud-right button, #music-toggle, #pause-button, [aria-label]')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && getComputedStyle(e).visibility !== 'hidden'; }).map((e) => (e.id || e.className) + ':' + (e.getAttribute('aria-label') || e.textContent.trim()).slice(0, 24)));
    const st = await box('#touch-stick');
    let a = await D(page); await tp('touchStart', [[st[0], st[1], 1]]); for (let i = 1; i <= 6; i++) { await tp('touchMove', [[st[0], st[1] - i * 8, 1]]); await page.waitForTimeout(30); } await page.waitForTimeout(1200); let b = await D(page); await tp('touchEnd', []); ctl.stickFwd_speed = +b.speed.toFixed(1);
    for (const [id, k] of [['#up-button', 'up_dy'], ['#down-button', 'down_dy']]) { const c = await box(id); a = await D(page); await tp('touchStart', [[c[0], c[1], 2]]); await page.waitForTimeout(900); b = await D(page); await tp('touchEnd', []); ctl[k] = +(b.pos.y - a.pos.y).toFixed(1); await page.waitForTimeout(300); }
    { const c = await box('#boost-button'); await tp('touchStart', [[st[0], st[1], 1]]); await tp('touchMove', [[st[0], st[1] - 48, 1]]); a = await D(page); await tp('touchStart', [[st[0], st[1] - 48, 1], [c[0], c[1], 2]]); await page.waitForTimeout(700); b = await D(page); await tp('touchEnd', []); ctl.boostBtn = { boosting: b.boosting, from: +a.boost.toFixed(2), to: +b.boost.toFixed(2) }; }
    await page.waitForTimeout(1200);
    a = await D(page); await tp('touchStart', [[420, 140, 3]]); for (let i = 1; i <= 10; i++) { await tp('touchMove', [[420 + i * 15, 140, 3]]); await page.waitForTimeout(20); } b = await D(page); await tp('touchEnd', []); ctl.oneFingerLook_cam = +Math.hypot(b.cam.x - a.cam.x, b.cam.z - a.cam.z).toFixed(1);
    a = await D(page); await tp('touchStart', [[350, 160, 4], [450, 160, 5]]); for (let i = 1; i <= 8; i++) { await tp('touchMove', [[350 - i * 10, 160, 4], [450 + i * 10, 160, 5]]); await page.waitForTimeout(20); } await tp('touchEnd', []); await page.waitForTimeout(300); b = await D(page); ctl.pinch_camDist = [a, b].map((s) => +Math.hypot(s.cam.x - s.pos.x, s.cam.y - s.pos.y, s.cam.z - s.pos.z).toFixed(1));
    a = await D(page); const mm = await box('#minimap'); if (mm) { await page.touchscreen.tap(mm[0], mm[1]); await page.waitForTimeout(400); } ctl.tapMinimap = [a.mm, (await D(page)).mm];
    const musVis = () => page.evaluate(() => { const e = document.getElementById('music-toggle'); const b = e.getBoundingClientRect(); let p = e, op = 1; while (p) { const s = getComputedStyle(p); if (s.display === 'none' || s.visibility === 'hidden') return false; op *= Number(s.opacity); p = p.parentElement; } return b.width > 0 && op > 0.3 ? [Math.round(b.left), Math.round(b.top)] : false; });
    ctl.musicVisibleInPlay = await musVis();
    if (ctl.musicVisibleInPlay) { a = await D(page); await page.tap('#music-toggle'); await page.waitForTimeout(400); ctl.musicBtn = [a.music.enabled, (await D(page)).music.enabled]; await page.tap('#music-toggle'); }
    await page.tap('#pause-button'); await page.waitForTimeout(400); ctl.pauseBtn = (await D(page)).st;
    ctl.musicVisibleInPause = await musVis();
    if (ctl.musicVisibleInPause) { a = await D(page); await page.tap('#music-toggle'); await page.waitForTimeout(400); ctl.musicBtnPause = [a.music.enabled, (await D(page)).music.enabled]; }
  }
  r.ctl = ctl;
  await page.screenshot({ path: OUT + `root-${touch ? 'phone' : 'desk'}.jpg`, type: 'jpeg', quality: 80 });
  r.console = cons; r.errors = errs; r.failed = failed; r.bad = bad;
  console.log('ROOT', JSON.stringify(r));
  await ctx.close();
}
await browser.close();
