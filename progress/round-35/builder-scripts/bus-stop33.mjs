// Round 33 critic: harbour bus over SIMT seconds (default 700) per seed, fixed step 0.25 s. Logs every stop with its
// length and place, then a summary: stops, pier alternation, longest stop, any stop over dwell + 2 s (11 s).
import { chromium } from '@playwright/test';
const SIMT = +(process.env.SIMT || 700);
const browser = await chromium.launch({ channel: 'chromium' });
for (const seed of (process.env.SEEDS || '22,58,4711,9001').split(',').map(Number)) {
  const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
  await page.goto('http://127.0.0.1:5190/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
  await page.waitForFunction(() => window.__GAME__.assetsReady().on && window.__GAME__.boats().length > 0, null, { timeout: 30000 });
  const r = await page.evaluate((SIMT) => {
    const G = window.__GAME__; const bi = G.boats().findIndex((b) => b.kind === 'ferry'); const stops = []; let cur = null, t = 0, maxSpeed = 0, slowMove = 0;
    for (let k = 0; k < SIMT * 4; k++) { G.advance(0.25, false); t += 0.25; const b = G.boats()[bi]; maxSpeed = Math.max(maxSpeed, b.speed);
      if (b.speed < 0.01) { if (!cur) cur = { t0: t, x: +b.x.toFixed(2), z: +b.z.toFixed(2) }; }
      else { if (b.speed < 0.3) slowMove += 0.25; if (cur) { cur.len = +(t - cur.t0).toFixed(2); stops.push(cur); cur = null; } } }
    if (cur) { cur.len = +(t - cur.t0).toFixed(2); cur.open = true; stops.push(cur); }
    return { stops, maxSpeed: +maxSpeed.toFixed(2), slowMove };
  }, SIMT);
  const lens = r.stops.filter((s) => !s.open).map((s) => s.len); const piers = r.stops.map((s) => Math.round(s.x));
  let alt = 0; for (let i = 1; i < piers.length; i++) if (piers[i] !== piers[i - 1]) alt++;
  console.log('STOPS', seed, r.stops.map((s) => `${s.t0}s@${s.x}:${s.len}s${s.open ? '(open)' : ''}`).join(' '));
  console.log('SUMMARY', JSON.stringify({ seed, simT: SIMT, stops: r.stops.length, piers: [...new Set(piers)], alternations: alt, of: piers.length - 1, minStop: Math.min(...lens), maxStop: Math.max(...lens, ...r.stops.filter((s) => s.open).map((s) => s.len)), over11: r.stops.filter((s) => s.len > 11).length, maxSpeed: r.maxSpeed, creepSeconds: r.slowMove }));
  await page.close();
}
await browser.close();
