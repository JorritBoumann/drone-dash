import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
for (const seed of (process.env.SEEDS || "22,58,4711,9001").split(",").map(Number)) {
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto('http://127.0.0.1:5190/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
await page.waitForFunction(() => window.__GAME__.assetsReady().on && window.__GAME__.boats().length > 0, null, { timeout: 30000 });
const r = await page.evaluate((STEPS) => {
  const G = window.__GAME__; const out = []; let stopped = 0, lastState = null, t = 0;
  const bi = G.boats().findIndex((b) => b.kind === 'ferry');
  for (let k = 0; k < STEPS; k++) { G.advance(0.5, false); t += 0.5; const b = G.boats()[bi]; const st = b.speed < 0.01 ? 'stop' : 'move'; if (st !== lastState) { out.push(`${t.toFixed(1)}:${st}@${b.x.toFixed(1)},${b.z.toFixed(1)}`); lastState = st; } }
  return out;
}, +process.env.STEPS || 1400);
console.log(seed, r.length, r.slice(0, 40).join(' '));
{ // round 33 builder: summary. Stops by pier, longest stop (s), stops per pier.
  const ev = r.map((e) => { const [t, rest] = e.split(':'); const [st, xz] = rest.split('@'); return { t: +t, st, x: +xz.split(',')[0] }; });
  const stops = []; for (let i = 0; i < ev.length; i++) if (ev[i].st === 'stop') stops.push({ x: ev[i].x, dur: (ev[i + 1] ? ev[i + 1].t : 1e9) - ev[i].t });
  const per = {}; for (const s of stops) per[s.x] = (per[s.x] || 0) + 1;
  console.log('SUMMARY', seed, 'stops', stops.length, 'perPier', JSON.stringify(per), 'longestStop', Math.max(...stops.map((s) => s.dur)), 'lastOpen', stops.length && stops[stops.length - 1].dur > 1e8);
}
await page.close();
}
await browser.close();
