// Round 36 critic (new): wakes from above, for the blind A/B against the round 35 control. Fixed step, manualRender.
// Per seed and moving boat kind: run until the boat is at speed, then two views:
//   top    : straight down from 16 m (30 m for the bus), centred 0.4 boat lengths behind the transom
//   cruise : game-camera-like view from 20 m up, 26 m behind and 10 m to the side, looking at the water behind the boat
// Env: PORT (5191), TAG (r36 / r35c), SEEDS (130,22,33), MOBILE=1, OUTDIR.
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
const OUT = (process.env.OUTDIR || new URL('../critic/', import.meta.url).pathname);
const PORT = process.env.PORT || '5191'; const TAG = process.env.TAG || (PORT === '5192' ? 'r35c' : 'r36');
const MOBILE = !!process.env.MOBILE; const MOOD = { 130: 'golden', 22: 'morning', 33: 'dusk', 58: 'noon' };
const browser = await chromium.launch({ channel: 'chromium' });
for (const SEED of (process.env.SEEDS || '130,22,33').split(',').map(Number)) {
  const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}${MOBILE ? '' : '&post=1'}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); G.place(0, 60, 0, 0, 0); });
  await page.waitForFunction(() => window.__GAME__.assetsReady().on && window.__GAME__.boats().length > 0, null, { timeout: 30000 });
  await page.evaluate(() => { window.__GAME__.advance(3, false); window.__THREE_GAME_TEST_HOOKS__?.hideDebugUi?.(true); });
  for (const kind of ['sail', 'rib', 'ferry', 'row']) {
    for (const v of ['top', 'cruise']) {
      const info = await page.evaluate(([kind, v]) => {
        const G = window.__GAME__; const find = () => G.boats().find((q) => q.kind === kind && q.moving);
        let b = find(); if (!b) return null; let g = 0;
        while (b.speed < (kind === 'row' ? 0.8 : 2) && g++ < 300) { G.advance(0.5, false); b = find(); }
        const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), px = Math.cos(b.yaw), pz = -Math.sin(b.yaw);
        const back = b.len * 0.9; const s = kind === 'ferry' ? 1.9 : 1;
        let cam, tgt;
        if (v === 'top') { const c = [b.x - fx * back, b.z - fz * back]; cam = [c[0] + fx * 0.01, 16 * s, c[1] + fz * 0.01]; tgt = [c[0], b.water, c[1]]; }
        else { cam = [b.x - fx * 26 * s + px * 10 * s, 20 * s, b.z - fz * 26 * s + pz * 10 * s]; tgt = [b.x - fx * back, b.water, b.z - fz * back]; }
        G.place(cam[0], cam[1] + 30, cam[2], 0, 0); G.advance(1 / 60, false);
        G.renderFrom(cam[0], cam[1], cam[2], tgt[0], tgt[1], tgt[2]);
        const cv = document.getElementById('game-canvas'); const gl = cv.getContext('webgl2');
        const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight; const pxb = new Uint8Array(W * H * 4);
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pxb);
        const c2 = document.createElement('canvas'); c2.width = W; c2.height = H; const x = c2.getContext('2d'); const id = x.createImageData(W, H);
        for (let y = 0; y < H; y++) id.data.set(pxb.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
        x.putImageData(id, 0, 0); const jpg = c2.toDataURL('image/jpeg', 0.8);
        return { jpg, speed: +b.speed.toFixed(2), x: +b.x.toFixed(1), z: +b.z.toFixed(1), t: g };
      }, [kind, v]);
      if (!info) continue;
      fs.writeFileSync(OUT + `wake36-${TAG}${MOBILE ? '-m' : ''}-${MOOD[SEED] || SEED}-${kind}-${v}.jpg`, Buffer.from(info.jpg.split(',')[1], 'base64')); delete info.jpg;
      console.log('WAKE', SEED, kind, v, JSON.stringify(info));
    }
  }
  await ctx.close();
}
await browser.close();
