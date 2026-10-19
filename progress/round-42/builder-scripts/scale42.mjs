// Round 42 builder: acceptance 2. The canvas HUD centre message's pop-in scale over its first 300 ms, every frame, for
// the first events of a real-time piloted run. Intended: s = 0.9 + 0.1 * age / 160 for age < 160 ms, then 1; the quad
// scale must be (allocW * s, allocH * s) on every frame (it shrank frame after frame before the fix).
// Env: PORT (5191), DEV (desktop | iphone), SEED (22), MAXT (s), EVENTS (3).
import { chromium, devices } from '@playwright/test';
const PORT = process.env.PORT || '5191', MAXT = Number(process.env.MAXT || 70), DEVN = process.env.DEV || 'desktop', SEED = process.env.SEED || '22', NEV = Number(process.env.EVENTS || 3);
const touch = DEVN !== 'desktop';
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext(touch ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
await page.addInitScript({ path: new URL('../../round-41/critic-scripts/video-pilot39c.js', import.meta.url).pathname });
await page.addInitScript(() => { try { localStorage.setItem('drone-dash-played-v1', '1'); } catch {} });
await page.addInitScript((n) => {
  const L = (window.__SC = { events: [] });
  let cur = null;
  function tick() {
    requestAnimationFrame(tick);
    if (!window.__GAME__ || window.__THREE_GAME_DIAGNOSTICS__?.state !== 'playing' || L.events.length > n) return;
    const s = window.__GAME__.canvasHud();
    const e = s.event; if (!e) return;
    const key = e.main + '|' + e.sub;
    if (!cur || cur.key !== key || e.age < cur.lastAge) { cur = { key, main: e.main, rows: [] }; L.events.push(cur); }
    cur.lastAge = e.age;
    if (e.age <= 300) cur.rows.push({ age: Math.round(e.age), s: +e.scale.toFixed(4), exp: +(e.age < 160 ? 0.9 + 0.1 * (e.age / 160) : 1).toFixed(4), mx: +(e.meshScale[0] / e.alloc[0]).toFixed(4), my: +(e.meshScale[1] / e.alloc[1]).toFixed(4) });
  }
  requestAnimationFrame(tick);
}, NEV);
await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}&hud=canvas`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
if (touch) await page.tap('#play-button'); else await page.keyboard.press('Enter');
await page.waitForTimeout(500);
await page.evaluate((t) => window.__AP.start({ touch: t, harbour: false }), touch);
const t0 = Date.now();
while ((Date.now() - t0) / 1000 < MAXT) { await page.waitForTimeout(1000); const n = await page.evaluate(() => window.__SC.events.filter((e) => e.rows.length).length); if (n >= NEV) break; }
const L = await page.evaluate(() => window.__SC);
let worst = 0, rows = 0;
for (const e of L.events.filter((q) => q.rows.length)) {
  console.log('EVENT', JSON.stringify(e.main), 'frames<=300ms', e.rows.length);
  for (const r of e.rows) { rows++; worst = Math.max(worst, Math.abs(r.s - r.exp), Math.abs(r.mx - r.s), Math.abs(r.my - r.s)); console.log('  ', JSON.stringify(r)); }
}
console.log('SCALE42', DEVN, JSON.stringify({ events: L.events.filter((q) => q.rows.length).length, rows, worstAbsDiff: +worst.toFixed(4), errs: errs.slice(0, 2) }));
await browser.close();
