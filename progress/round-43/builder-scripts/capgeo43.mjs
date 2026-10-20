// Round 43 builder: sail-boat hull and cap geometry (model space): bounds, cap outline, hull top-edge points near the bow.
import { chromium, devices } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'] });
await ctx.addInitScript(() => { window.__THREE_DEVTOOLS__ = new EventTarget(); window.__obs = []; window.__THREE_DEVTOOLS__.addEventListener('observe', (e) => window.__obs.push(e.detail)); });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5191/?seed=130', { waitUntil: 'networkidle' });
await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); G.place(0, 60, 0, 0, 0); });
await page.waitForFunction(() => window.__GAME__.assetsReady().on && window.__GAME__.boats().length > 0, null, { timeout: 30000 });
const r = await page.evaluate(() => {
  window.__GAME__.advance(1, false);
  const scene = window.__obs.find((o) => o && o.isScene && o.getObjectByName('boats-sail'));
  const out = {};
  for (const n of ['boats-sail', 'boats-cap-sail']) {
    const m = scene.getObjectByName(n); const g = m.geometry; g.computeBoundingBox(); const p = g.getAttribute('position');
    out[n] = { box: [g.boundingBox.min.toArray(), g.boundingBox.max.toArray()].map((a) => a.map((v) => +v.toFixed(3))), verts: p.count };
    if (n.includes('cap')) { const pts = []; for (let i = 0; i < p.count; i++) pts.push([p.getX(i), p.getY(i), p.getZ(i)].map((v) => +v.toFixed(2))); out[n].pts = pts; }
    else { // hull vertices forward of the cap's front: top points per x/z slice
      const pts = []; for (let i = 0; i < p.count; i++) pts.push([p.getX(i), p.getY(i), p.getZ(i)]);
      out[n].sample = pts;
    }
    out[n].mat = m.matrixWorld.elements.map((v) => +v.toFixed(3));
  }
  const b = window.__GAME__.boats().find((q) => q.kind === 'sail' && !q.moving); out.boat = b;
  return out;
});
const cap = r['boats-cap-sail'];
console.log('HULL box', JSON.stringify(r['boats-sail'].box), 'verts', r['boats-sail'].verts);
console.log('CAP box', JSON.stringify(cap.box), 'verts', cap.verts, JSON.stringify(cap.pts));
// the hull's long axis: the larger horizontal extent
const hb = r['boats-sail'].box; const longX = (hb[1][0] - hb[0][0]) > (hb[1][2] - hb[0][2]);
console.log('long axis', longX ? 'x' : 'z');
// per slice along the long axis: highest hull point near the centreline region and width at the cap height
const S = r['boats-sail'].sample; const capY = cap.box[1][1];
for (let a = Math.floor(hb[0][longX ? 0 : 2] * 4) / 4; a <= hb[1][longX ? 0 : 2]; a += 0.25) {
  const sl = S.filter((p) => Math.abs((longX ? p[0] : p[2]) - a) < 0.125 && p[1] > capY - 0.6 && p[1] < capY + 0.5);
  if (!sl.length) continue;
  const lat = sl.map((p) => (longX ? p[2] : p[0]));
  console.log('slice', a.toFixed(2), 'n', sl.length, 'lat', Math.min(...lat).toFixed(2), Math.max(...lat).toFixed(2), 'y', Math.min(...sl.map((p) => p[1])).toFixed(2), Math.max(...sl.map((p) => p[1])).toFixed(2));
}
console.log('BOAT', JSON.stringify(r.boat));
await browser.close();
