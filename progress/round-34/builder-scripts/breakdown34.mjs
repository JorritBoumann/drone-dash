// Round 34 builder (copy of round 33 breakdown33): triangles and draw calls per mesh at given spots (fixed step, rush on, assets on).
import { chromium, devices } from '@playwright/test';
const MOBILE = !!process.env.MOBILE;
const SPOTS = JSON.parse(process.env.SPOTS || '[[130,-90,3,0,0],[130,0,3,-30,3.14],[22,-90,3,0,0]]');
const browser = await chromium.launch({ channel: 'chromium' });
for (const [seed, x, y, z, yaw] of SPOTS) {
  const page = await (await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto('http://127.0.0.1:' + (process.env.PORT || 5190) + '/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
  await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
  await page.waitForFunction(() => window.__GAME__.assetsReady().on, null, { timeout: 30000 });
  const r = await page.evaluate(([x, y, z, yaw]) => { const G = window.__GAME__; G.rush(true); G.advance(3, false);
    for (let i = 0; i < 4; i++) { G.place(x, y, z, yaw, 0); G.advance(1 / 20, false); } G.advance(1 / 60, true);
    const b = G.triBreakdown(1500); G.detailOn(false); G.advance(1 / 60, true); const nod = G.renderStats(); G.detailOn(true); G.advance(1 / 60, true); return { stats: G.renderStats(), b, detail: { tris: b.all - nod.tris, calls: b.calls - nod.calls }, diag: window.__THREE_GAME_DIAGNOSTICS__.detail?.chunks }; }, [x, y, z, yaw]);
  console.log('SPOT', seed, x, y, z, yaw, JSON.stringify(r.stats), 'all', r.b.all, 'calls', r.b.calls, 'sumParts', r.b.parts.reduce((a, p) => a + p.tris, 0), 'sumCalls', r.b.parts.reduce((a, p) => a + p.calls, 0), 'detail', JSON.stringify(r.detail));
  const agg = {}; for (const p of r.b.parts) { const k = p.name; agg[k] = agg[k] || { tris: 0, calls: 0, n: 0 }; agg[k].tris += p.tris; agg[k].calls += p.calls; agg[k].n++; }
  for (const [k, v] of Object.entries(agg).sort((a, b) => b[1].tris - a[1].tris)) console.log('  ', k.padEnd(34), String(v.tris).padStart(8), 'calls', v.calls, 'n', v.n);
  if (process.env.SHOT) await page.screenshot({ path: new URL('../builder-shots/', import.meta.url).pathname + `bd34-${process.env.SHOT}-${seed}-${x}-${y}-${z}.jpg`, type: 'jpeg', quality: 75 });
  await page.close();
}
await browser.close();
