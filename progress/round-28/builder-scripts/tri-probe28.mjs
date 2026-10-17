// Round 28 builder: triangle / draw-call breakdown at the art views (assets on/off, street life off, detail off).
import { chromium } from '@playwright/test';
const PORT = process.env.PORT || '5190';
const SEED = process.env.SEED || '22';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
for (let i = 0; i < 60; i++) { if (await page.evaluate(() => window.__GAME__.assetsReady?.().on ?? true)) break; await page.waitForTimeout(250); }
await page.evaluate(() => { window.__GAME__.start(); window.__GAME__.manualRender(true); });
const views = [['shopfront', 22, 3, 0, -Math.PI / 2], ['cruise-down', 22, 38, 60, 0, [0.6, 0.5, 0]], ['street', 22, 3, 40, 0]];
for (const [name, x, y, z, yaw, view] of views) {
  for (const cfg of ['all', 'noAssets', 'noStreet', 'noDetail']) {
    const r = await page.evaluate(([x, y, z, yaw, view, cfg]) => {
      const G = window.__GAME__, d = window.__THREE_GAME_DIAGNOSTICS__;
      G.assetsOn?.(cfg !== 'noAssets'); G.streetLife(cfg !== 'noStreet', cfg !== 'noStreet'); G.detailOn(cfg !== 'noDetail');
      for (let i = 0; i < 30; i++) { G.place(x, y, z, yaw, 0); G.advance(1 / 20, false); }
      if (view) G.view(view[0], view[1], view[2]);
      for (let i = 0; i < 10; i++) { G.place(x, y, z, yaw, 0); G.advance(1 / 20, false); }
      let calls = 0, tris = 0, minT = 1e9;
      for (let k = 0; k < 8; k++) { G.place(x, y, z, yaw, 0); G.advance(1 / 60, true); calls = Math.max(calls, d.renderer.calls); tris = Math.max(tris, d.renderer.triangles); minT = Math.min(minT, d.renderer.triangles); }
      return { calls, tris, minT };
    }, [x, y, z, yaw, view ?? null, cfg]);
    console.log(name, cfg, JSON.stringify(r));
  }
}
await browser.close();
