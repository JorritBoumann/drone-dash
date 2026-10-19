// Round 38 builder: GPU time of the water (timer query, water on minus water off) in low free-camera views where the
// phone's new near layers draw: 1.5 m and 4 m over open sea and the marina, plus a 25 m cruise view. MOBILE=1 for the
// iPhone 13 profile. PORT (5190), TAG, SEED (130). Same measuring loop as water31.mjs.
import { chromium, devices } from '@playwright/test';
const PORT = process.env.PORT || '5190'; const TAG = process.env.TAG || 'r38'; const MOBILE = !!process.env.MOBILE; const SEED = process.env.SEED || '130';
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}${MOBILE ? '' : '&post=1'}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
await page.waitForFunction(() => window.__GAME__.assetsReady().on, null, { timeout: 30000 });
await page.evaluate(() => { const G = window.__GAME__; G.advance(3, false); G.hideDebugUi?.(true); });
const res = await page.evaluate(async (views) => {
  const G = window.__GAME__; const c = document.getElementById('game-canvas'); const gl = c.getContext('webgl2');
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'); const px = new Uint8Array(4);
  const wait = () => new Promise((r) => setTimeout(r, 20));
  const measure = async (cam, tgt) => {
    const g = [];
    for (let i = 0; i < 30; i++) {
      G.advance(1 / 60, false);
      let q = null; if (ext) { q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); }
      G.renderFrom(...cam, ...tgt); if (ext) gl.endQuery(ext.TIME_ELAPSED_EXT); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      if (q) { let tries = 0; while (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) && tries++ < 50) await wait(); if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) g.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(q); }
      await wait();
    }
    const s = g.slice(5).sort((x, y) => x - y); return s.length ? +s[s.length >> 1].toFixed(3) : null;
  };
  const out = { ext: !!ext, w: c.width, h: c.height };
  for (const [nm, cam, tgt] of views) {
    G.waterOn(true); const on = await measure(cam, tgt); G.waterOn(false); const off = await measure(cam, tgt); G.waterOn(true);
    out[nm] = { on, off, water: on != null && off != null ? +(on - off).toFixed(3) : null };
  }
  return out;
}, [['sea-1.5m', [182, 0.8, 20], [230, -0.5, 20]], ['sea-4m', [182, 3.3, 20], [230, -0.5, 20]], ['marina-1.5m', [-30, 0.8, 190], [-44, -0.5, 172]], ['marina-4m', [-30, 3.3, 192], [-44, -0.5, 172]], ['cruise-25m', [140, 25, 30], [220, 0, 30]]]);
console.log('GPU38', TAG, MOBILE ? 'mobile' : 'desktop', JSON.stringify(res));
await browser.close();
