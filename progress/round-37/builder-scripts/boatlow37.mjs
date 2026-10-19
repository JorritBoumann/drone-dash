// Round 37 builder: low boat views for the near-water A/B. Same poses as hullwater35.mjs (boat frame: u toward the bow,
// v to starboard, h above its water): low-side [0, 6, 0.35] and low-quarter [-5, 4, 0.45], plus a 2 m and 4 m view by
// the marina. Kinds sail, rib, row (moving). Deterministic: manualRender + fixed advance.
// Env: PORT, TAG, SEEDS (130,22 = golden, morning), OUTDIR, MOBILE=1.
import { chromium, devices } from '@playwright/test';
const OUT = process.env.OUTDIR || '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/r37/shots/';
const PORT = process.env.PORT || '5190'; const TAG = process.env.TAG || 'r37';
const MOBILE = !!process.env.MOBILE; const SEEDS = (process.env.SEEDS || '130,22').split(',').map(Number);
const MOOD = { 130: 'golden', 22: 'morning', 33: 'dusk', 58: 'noon' };
const browser = await chromium.launch({ channel: 'chromium' });
for (const SEED of SEEDS) {
  const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}${MOBILE ? '' : '&post=1'}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); G.place(0, 60, 0, 0, 0); });
  await page.waitForFunction(() => window.__GAME__.assetsReady().on && window.__GAME__.boats().length > 0, null, { timeout: 30000 });
  await page.evaluate(() => { const G = window.__GAME__; G.advance(3, false); window.__THREE_GAME_TEST_HOOKS__?.hideDebugUi?.(true); });
  const boats = await page.evaluate(() => window.__GAME__.boats());
  const flat = [];
  for (const kind of ['sail', 'rib', 'row']) {
    let bi = boats.findIndex((q) => q.kind === kind && q.moving); if (bi < 0) bi = boats.findIndex((q) => q.kind === kind); if (bi < 0) continue;
    for (const [name, cl, tl] of [['low-side', [0, 6, 0.35], [0, 0, 0.3]], ['low-quarter', [-5, 4, 0.45], [0, 0, 0.3]], ['quarter-2m', [-7, 5, 2.0], [0, 0, 0.3]]]) {
      const f = await page.evaluate(([bi, cl, tl]) => {
        const G = window.__GAME__; let b = G.boats()[bi];
        const W = (B, l) => { const fx = Math.sin(B.yaw), fz = Math.cos(B.yaw), px = Math.cos(B.yaw), pz = -Math.sin(B.yaw); return [B.x + fx * l[0] + px * l[1], B.water + l[2], B.z + fz * l[0] + pz * l[1]]; };
        const c0 = W(b, cl); G.place(c0[0], c0[1] + 30, c0[2], 0, 0); G.advance(1 / 60, false);
        b = G.boats()[bi]; const c = W(b, cl), t = W(b, tl); G.renderFrom(c[0], c[1], c[2], t[0], t[1], t[2]);
        const cv = document.getElementById('game-canvas'); const gl = cv.getContext('webgl2'); const buf = new Uint8Array(4); const s = new Set();
        for (let i = 0; i < 25; i++) { gl.readPixels(Math.floor(cv.width * (0.05 + 0.9 * (i % 5) / 4)), Math.floor(cv.height * (0.05 + 0.9 * Math.floor(i / 5) / 4)), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf); s.add(buf.slice(0, 3).join(',')); }
        return s.size;
      }, [bi, cl, tl]);
      flat.push(f);
      await page.screenshot({ path: OUT + `bl37-${TAG}${MOBILE ? '-m' : ''}-${MOOD[SEED]}-${kind}-${name}.jpg`, type: 'jpeg', quality: 82 });
    }
  }
  console.log('BOATLOW', SEED, TAG, 'distinct', flat.join(','), 'errs', errs.slice(0, 3).join(' | '));
  await ctx.close();
}
await browser.close();
