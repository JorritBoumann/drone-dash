// Round 36 builder: fixed boat views for the wake and detail work and the blind A/B (same seed, time and pose relative to
// the boat on both builds). Views are given in the boat frame (u toward the bow, v to starboard, h above its water),
// as in the critic's hullwater35.mjs. Env: PORT, TAG, SEED (130), MOBILE=1, OUTDIR, VIEWS (comma list of names).
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
const OUT = process.env.OUTDIR; const PORT = process.env.PORT || '5190'; const TAG = process.env.TAG || 'r36';
const SEED = Number(process.env.SEED || 130); const MOBILE = !!process.env.MOBILE;
const ALL = {
  // name: [kind, moving, cam, target]
  'sail-above': ['sail', true, [0.01, 0.4, 9], [0, 0, 0]],
  'sail-cruise': ['sail', true, [-26, 6, 18], [-4, 0, 0]],
  'rib-cruise': ['rib', true, [-24, 8, 18], [-6, 0, 0]],
  'rib-above': ['rib', true, [-3, 0.4, 10], [-3, 0, 0]],
  'ferry-above': ['ferry', true, [-4, 0.4, 20], [-4, 0, 0]],
  'ferry-stern': ['ferry', true, [-18.2, -1.3, 3.5], [0, 0, 1.1]],
  'sail-side': ['sail', true, [0, 7, 2.5], [0, 0, 1.6]],
  'sail-quarter': ['sail', true, [-5, 4, 0.9], [0, 0, 1.4]],
  'sail-moored-close': ['sail', false, [1.5, 3.2, 2.2], [-0.5, 0, 1.2]],
  'row-into-hull': ['row', false, [-1, 2.2, 3.0], [0.2, 0, 0.2]],
  'row-quarter': ['row', false, [-4, 3.2, 1.2], [0, 0, 0.4]],
  'rib-close': ['rib', true, [0.3, 2.1, 1.4], [-0.3, -0.3, 0.1]],
  'rib-quarter': ['rib', true, [-4.5, 3.5, 1.0], [0, 0, 0.4]],
  'ferry-close': ['ferry', true, [0.3, 2.2, 1.4], [-0.3, -0.3, 0.1]],
  'ferry-quarter': ['ferry', true, [-11, 9, 2.0], [0, 0, 2.0]],
  'ferry-side': ['ferry', true, [0, 15, 5.5], [0, 0, 2.5]],
};
const names = (process.env.VIEWS || Object.keys(ALL).join(',')).split(',');
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}${MOBILE ? '' : '&post=1'}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); G.place(0, 60, 0, 0, 0); });
await page.waitForFunction(() => window.__GAME__.assetsReady().on && window.__GAME__.boats().length > 0, null, { timeout: 30000 });
await page.evaluate(() => { window.__GAME__.advance(3, false); window.__THREE_GAME_TEST_HOOKS__?.hideDebugUi?.(true); });
for (const name of names) {
  const [kind, moving, cl, tl] = ALL[name];
  const url = await page.evaluate(([kind, moving, cl, tl]) => {
    const G = window.__GAME__; const bb = G.boats();
    let bi = bb.findIndex((q) => q.kind === kind && q.moving === moving); if (bi < 0) bi = bb.findIndex((q) => q.kind === kind);
    const b0 = bb[bi];
    // park the drone over the boat for a moment, so the game camera (which decides the hull-lid range switch) is there
    for (let k = 0; k < 40; k++) { G.place(b0.x, b0.water + 40, b0.z, 0, 0); G.advance(1 / 60, false); }
    const B = G.boats()[bi];
    const fx = Math.sin(B.yaw), fz = Math.cos(B.yaw), px = Math.cos(B.yaw), pz = -Math.sin(B.yaw);
    const W = (l) => [B.x + fx * l[0] + px * l[1], B.water + l[2], B.z + fz * l[0] + pz * l[1]];
    const c = W(cl), t = W(tl);
    G.renderFrom(c[0], c[1], c[2], t[0], t[1], t[2]);
    return document.getElementById('game-canvas').toDataURL('image/jpeg', 0.86);
  }, [kind, moving, cl, tl]);
  fs.writeFileSync(`${OUT}/${TAG}${MOBILE ? '-m' : ''}-${SEED}-${name}.jpg`, Buffer.from(url.split(',')[1], 'base64'));
}
console.log('done', TAG, SEED, names.length, 'errors', JSON.stringify(errs.slice(0, 5)));
await browser.close();
