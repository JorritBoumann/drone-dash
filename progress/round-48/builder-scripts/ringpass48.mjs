// Round 48 fix pass: a ring pass on desktop and phone (812x375). Starts a run on SEED, puts the drone BACK m before the
// first ring facing it, holds W (game key hook), screenshots once the ring is taken (the burst), and on the way also
// once at 40 to 60 m out to check that the objective pill and route chip fade when the ring is behind them.
import { chromium, devices } from 'playwright';
const PORT = process.env.PORT || '5397', SEED = process.env.SEED || '130', Q = process.env.Q ?? `?seed=${SEED}`, RING = Number(process.env.RING || 0);
const OUT = new URL('../fixpass/', import.meta.url).pathname;
const browser = await chromium.launch();
for (const dev of ['desktop', 'phone']) {
  const ctx = await browser.newContext(dev === 'phone' ? { ...devices['iPhone 13 landscape'], viewport: { width: 812, height: 375 } } : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('drone-dash-played-v1', '1'); } catch {} });
  await page.goto(`http://127.0.0.1:${PORT}/${Q}`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForFunction(() => window.__GAME__ && window.__THREE_GAME_DIAGNOSTICS__, null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(async () => {
    const G = window.__GAME__; G.start();
    await new Promise((res) => setTimeout(res, 500));
    const d = window.__THREE_GAME_DIAGNOSTICS__, q = d.rings[0];
    G.place(q.x - q.dx * 62, q.y, q.z - q.dz * 62, Math.atan2(-q.dx, -q.dz), 0);
    return q;
  });
  await page.waitForTimeout(1800); // camera settles behind the drone
  // fly with the game's own fixed step (a slow headless frame rate would stretch game time), W held all the way
  await page.evaluate(() => { const G = window.__GAME__; G.manualRender(true); G.externalClock(true); G.key('KeyW', true); window.__trk = []; });
  const real = async (name) => {
    await page.evaluate(() => { window.__GAME__.manualRender(false); window.__GAME__.externalClock(false); });
    await page.waitForTimeout(120);
    await page.screenshot({ path: OUT + name, type: 'jpeg', quality: 85, timeout: 90000 });
    await page.evaluate(() => { window.__GAME__.manualRender(true); window.__GAME__.externalClock(true); });
  };
  let seen = null, taken = false, peak = 0, after = 0, seeFrames = 0, seeShot = 0;
  for (let i = 0; i < 300; i++) {
    const s = await page.evaluate((q) => {
      const d = window.__GAME__.advance(0.05, false), p = d.player.position;
      window.__trk.push([Math.round(p.x), +p.y.toFixed(1), Math.round(p.z), +d.player.speed.toFixed(1), d.player.boosting ? 1 : 0]);
      return { dist: Math.hypot(q.x - p.x, q.z - p.z), taken: d.ringStats.taken, sp: d.player.speed,
        see: document.getElementById('objective').classList.contains('see-through') };
    }, r);
    peak = Math.max(peak, s.sp);
    if (s.see) { seeFrames++; if (!seeShot) { seeShot = Math.round(s.dist); await real(`ring-seethrough-${dev}.jpg`); } }
    if (!seen && s.dist < 52 && s.dist > 30) { await real(`ring-ahead-${dev}.jpg`); seen = { dist: Math.round(s.dist), seeThrough: s.see }; }
    if (!taken && s.taken > 0) { taken = true; after = i; }
    if (taken && i === after + 6) await real(`ring-pass-${dev}.jpg`);
    if (taken && i > after + 40) break;
  }
  const trk = await page.evaluate(() => window.__trk.filter((_, i) => i % 5 === 0));
  console.log(JSON.stringify({ dev, seeFrames, seeShotAtM: seeShot, ring: r, seen, taken, peakSpeed: +peak.toFixed(1), errors, trk }));
  await ctx.close();
}
await browser.close();
