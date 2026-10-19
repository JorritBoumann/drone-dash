// Round 42 critic (new): full real-time runs with the video pilot (video-pilot39c.js) and the per-frame sampler
// (sampler42.js): the 64 px corner (plus safe area), event label / objective / score overlaps, medal pops vs the drone,
// the canvas centre-message scale, and the game-over card (corner, canvas card). Env: PORT (5193), DEV (iphone | pixel),
// (p915: Pixel 7 at a 915x412 viewport) SEED, Q ('' HTML HUD or '&hud=canvas'), SAFE (1: emulate iPhone landscape safe-area insets 47/47/0/21), MAXT (s).
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
const PORT = process.env.PORT || '5193', OUT = process.env.OUTDIR || '/tmp/', SEED = process.env.SEED || '22', Q = process.env.Q ?? '';
const DEV = process.env.DEV || 'iphone', MAXT = Number(process.env.MAXT || 200);
const dev = DEV === 'pixel' ? devices['Pixel 7 landscape'] : DEV === 'p915' ? { ...devices['Pixel 7 landscape'], viewport: { width: 915, height: 412 }, screen: { width: 915, height: 412 } } : devices['iPhone 13 landscape'];
const TAG = `${DEV}-s${SEED}-${Q ? 'canvas' : 'html'}${process.env.SAFE ? '-safe' : ''}`;
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext({ ...dev });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
if (process.env.SAFE) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { left: 47, right: 47, top: 0, bottom: 21 } }); }
await page.addInitScript({ path: new URL('./video-pilot39c.js', import.meta.url).pathname });
await page.addInitScript({ path: new URL('./sampler42.js', import.meta.url).pathname });
await page.addInitScript(() => { try { localStorage.setItem('drone-dash-played-v1', '1'); } catch {} });
await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}${Q}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__GAME__ && window.__GAME__.assetsReady().on, null, { timeout: 30000 });
await page.waitForTimeout(1000);
const vp = await page.evaluate(() => ({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio, chud: window.__GAME__.canvasHud().on }));
await page.tap('#play-button');
await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'playing', null, { timeout: 10000 });
await page.evaluate(() => { window.__S42.start(); window.__AP.start({ touch: true, harbour: false }); });
const t0 = Date.now(); let shots = 0;
while ((Date.now() - t0) / 1000 < MAXT) {
  await page.waitForTimeout(500);
  const s = await page.evaluate(() => ({ st: window.__THREE_GAME_DIAGNOSTICS__.state, c: window.__S42.cornerFrames, o: window.__S42.ovFrames }));
  if (s.st === 'over') break;
}
await page.waitForTimeout(2500);
const over = await page.evaluate(() => ({ st: window.__THREE_GAME_DIAGNOSTICS__.state, score: window.__THREE_GAME_DIAGNOSTICS__.score, del: window.__THREE_GAME_DIAGNOSTICS__.deliveries }));
await page.screenshot({ path: OUT + `over-${TAG}.jpg`, type: 'jpeg', quality: 80 });
const S = await page.evaluate(() => { const s = window.__S42; s.on = false; return JSON.parse(JSON.stringify(s)); });
const log = await page.evaluate(() => window.__AP.log.map((e) => e.k + '@' + e.t).join(' '));
fs.writeFileSync(OUT + `play42-${TAG}.json`, JSON.stringify(S));
console.log('PLAY42', TAG, JSON.stringify({ vp, over, cornerBox: S.cornerBox, frames: S.frames, scans: S.scans, cornerFrames: S.cornerFrames, byName: S.byName, cornerEx: S.corner.slice(0, 4), overFrames: S.over, overCanvasFrames: S.overCanvas, overCorner: S.overCorner, ovFrames: S.ovFrames, ov: S.ov, touch2px: S.touchN, medal: S.medal, scale: S.scale, errs: errs.slice(0, 3), runSec: (Date.now() - t0) / 1000, ap: log.slice(0, 300) }));
await browser.close();
