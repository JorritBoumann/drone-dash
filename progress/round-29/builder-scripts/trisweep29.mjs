// Round 28 critic (new): worst-case triangles and draw calls. Deterministic (manualRender + advance), rush on, assets on.
// The drone sits on a 30 m grid over the whole city at 3, 16 and 38 m, facing 4 ways; one rendered frame each.
import { chromium, devices } from '@playwright/test';
const MOBILE = !!process.env.MOBILE, SEED = process.env.SEED || '22';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } })).newPage();
await page.goto('http://127.0.0.1:' + (process.env.PORT || 5191) + '/?seed=' + SEED, { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
await page.waitForFunction(() => window.__GAME__.assetsReady().on, null, { timeout: 30000 });
if (process.env.BREAK) await page.evaluate(() => { window.__BRK = 1; });
const r = await page.evaluate(() => { const G = window.__GAME__; G.rush(true); G.advance(3, false);
  const out = { n: 0, trisMax: 0, callsMax: 0, worstT: null, worstC: null, over600: 0, over150: 0, tris: [] };
  for (const y of [3, 16, 38]) for (let x = -150; x <= 150; x += 30) for (let z = -150; z <= 150; z += 30) for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    if (G.insideSolid(x, y, z, 0.6)) continue;
    for (let i = 0; i < 4; i++) { G.place(x, y, z, yaw, 0); G.advance(1 / 20, false); }
    G.advance(1 / 60, true); const rs = G.renderStats ? G.renderStats() : null; const d = rs ? { triangles: rs.tris, calls: rs.calls } : window.__THREE_GAME_DIAGNOSTICS__.renderer; out.n++; out.tris.push(d.triangles);
    if (d.triangles > out.trisMax) { out.trisMax = d.triangles; out.worstT = [x, y, z, +yaw.toFixed(2)]; }
    if (d.calls > out.callsMax) { out.callsMax = d.calls; out.worstC = [x, y, z, +yaw.toFixed(2)]; }
    if (d.triangles > 600000) { out.over600++; if (window.__BRK && (out.brk = out.brk || []).length < 3) { const c = window.__THREE_GAME_DIAGNOSTICS__.camera; out.brk.push({ at: [x, y, z, +yaw.toFixed(2)], tris: d.triangles, cam: [+c.x.toFixed(1), +c.y.toFixed(1), +c.z.toFixed(1)], b: G.triBreakdown(6000) }); } } if (d.calls > 150) out.over150++; }
  const s = out.tris.sort((a, b) => a - b); out.p50 = s[s.length >> 1]; out.p95 = s[Math.floor(s.length * 0.95)]; delete out.tris; return out; });
console.log('TRISWEEP29', MOBILE ? 'mobile' : 'desktop', SEED, JSON.stringify(r));
if (r.worstT) { await page.evaluate(([x, y, z, yaw]) => { const G = window.__GAME__; for (let i = 0; i < 4; i++) { G.place(x, y, z, yaw, 0); G.advance(1 / 20, false); } G.advance(1 / 60, true); }, r.worstT);
  await page.screenshot({ path: new URL('../builder-shots/', import.meta.url).pathname + `tris29-${MOBILE ? 'm' : 'd'}-${SEED}-worst.jpg`, type: 'jpeg', quality: 80 }); }
if (r.worstT && process.env.BREAK) { const b = await page.evaluate(([x, y, z, yaw]) => { const G = window.__GAME__; for (let i = 0; i < 4; i++) { G.place(x, y, z, yaw, 0); G.advance(1 / 20, false); } G.advance(1 / 60, true); return G.triBreakdown(4000); }, r.worstT); console.log('BREAK', JSON.stringify(b)); }
await browser.close();
