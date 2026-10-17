// Round 22 critic: frame time at street level (4 m) down a downtown avenue, 12 s normal then 12 s rush hour. MOBILE=1 for iPhone 13.
import { chromium, devices } from '@playwright/test';
const MOBILE = !!process.env.MOBILE; const SEED = process.env.SEED || '22';
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://127.0.0.1:' + (process.env.PORT || '5190') + '/?seed=' + SEED + (process.env.QS || ''), { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
await page.evaluate(() => { window.__GAME__.tune({ RUN: { startTime: 999 } }); window.__GAME__.start(); });
await page.waitForTimeout(1000);
if (process.env.HOOK) await page.evaluate((h) => window.__GAME__.assetParts(JSON.parse(h)), process.env.HOOK);
const run = async (label, rush) => {
  await page.evaluate((r) => window.__GAME__.rush(r), rush);
  if (rush) await page.waitForTimeout(3000);
  await page.evaluate(() => window.__GAME__.place(22, 4, -120, Math.PI, 8));
  await page.waitForTimeout(300);
  await page.evaluate(() => { window.__fd = []; window.__dc = []; window.__st = []; let l = performance.now(); const f = (t) => { if (!window.__fdOn) return; window.__fd.push(t - l); l = t; const d = window.__THREE_GAME_DIAGNOSTICS__; window.__dc.push(d.renderer.calls); if (window.__fd.length % 30 === 0) window.__st.push([d.street.cars, d.street.vans, d.street.peopleDrawn, d.street.msTraffic, d.street.msPeople, d.renderer.triangles]); requestAnimationFrame(f); }; window.__fdOn = true; requestAnimationFrame(f); });
  const t0 = Date.now(); let wDown = false;
  while (Date.now() - t0 < 12000) {
    const d = await page.evaluate(() => { const d = window.__THREE_GAME_DIAGNOSTICS__; return { sp: d.player.speed, x: d.player.position.x, yaw: d.player.yaw }; });
    const want = d.sp < 10; if (want !== wDown) { wDown = want; await (want ? page.keyboard.down('KeyW') : page.keyboard.up('KeyW')); }
    await page.waitForTimeout(100);
  }
  if (wDown) await page.keyboard.up('KeyW');
  const r = await page.evaluate(() => { window.__fdOn = false; return { fd: window.__fd.slice(2), dc: window.__dc, st: window.__st }; });
  const fd = r.fd.slice().sort((a, b) => a - b); const q = (p) => fd[Math.floor(p * (fd.length - 1))];
  const avg = (i) => +(r.st.reduce((s, x) => s + x[i], 0) / r.st.length).toFixed(3);
  if (process.env.DUMP) { const bins = []; let acc = 0, slow = 0, n = 0; for (const x of r.fd) { acc += x; n++; if (x > 12) slow++; if (acc >= 1000) { bins.push(`${n}/${slow}`); acc = 0; slow = 0; n = 0; } } console.log('BINS', label, bins.join(' ')); }
  console.log('PERF', MOBILE ? 'mobile' : 'desktop', label, JSON.stringify({ frames: fd.length, median: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), p99: +q(0.99).toFixed(2), max: +fd.at(-1).toFixed(1), over20: fd.filter((x) => x > 20).length, callsMax: Math.max(...r.dc), callsMed: r.dc.sort((a, b) => a - b)[r.dc.length >> 1], cars: avg(0), vans: avg(1), peopleDrawn: avg(2), msTraffic: avg(3), msPeople: avg(4), tris: Math.max(...r.st.map((x) => x[5])) }));
};
await run('normal', false);
await run('rush', true);
console.log('ERRORS', JSON.stringify(errors));
await browser.close();
