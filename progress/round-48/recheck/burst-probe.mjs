// Re-check probe: real-time keyboard through one tailwind ring on seed 130 (setup puts the drone 24 m before the
// first live ring, facing it, at 16 m/s). Variants: W held; W held + a short D tap (keyboard lane correction);
// W released at the ring. Samples speed and gust every frame for 1.6 s after the take.
import { chromium } from '/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/node_modules/playwright/index.mjs';
const variants = [['hold', 0], ['tap150', 0.15], ['tap300', 0.3], ['tap500', 0.5], ['release', -1]];
const browser = await chromium.launch({ channel: 'chromium' });
const out = [];
for (const rep of [1, 2]) for (const [name, tap] of variants) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('drone-dash-played-v1', '1'); } catch {} });
  await page.goto('http://127.0.0.1:5395/?seed=130', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__GAME__ && window.__THREE_GAME_DIAGNOSTICS__);
  await page.click('#play-button'); await page.waitForTimeout(800);
  const ok = await page.evaluate(() => {
    const r = window.__THREE_GAME_DIAGNOSTICS__.rings.find((q) => q.on); if (!r) return null;
    const yaw = Math.atan2(-r.dx, -r.dz);
    window.__GAME__.place(r.x - r.dx * 24, r.y, r.z - r.dz * 24, yaw, 16);
    window.__s = []; const t0 = { v: null };
    const f = () => { const d = window.__THREE_GAME_DIAGNOSTICS__; const tk = d.ringStats?.taken ?? 0;
      if (tk > 0 && t0.v === null) t0.v = performance.now();
      if (t0.v !== null) window.__s.push([+((performance.now() - t0.v) / 1000).toFixed(3), +d.player.speed.toFixed(1), +(d.ringStats?.gust ?? 0).toFixed(2)]);
      if (t0.v === null || performance.now() - t0.v < 1700) requestAnimationFrame(f); };
    requestAnimationFrame(f); return { r };
  });
  await page.keyboard.down('KeyW');
  const t = Date.now();
  while (Date.now() - t < 4000) { const tk = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.ringStats?.taken ?? 0); if (tk > 0) break; await page.waitForTimeout(15); }
  if (tap < 0) await page.keyboard.up('KeyW');
  else if (tap > 0) { await page.waitForTimeout(100); await page.keyboard.down('KeyD'); await page.waitForTimeout(tap * 1000); await page.keyboard.up('KeyD'); }
  await page.waitForTimeout(1800);
  const s = await page.evaluate(() => window.__s);
  const at = (x) => s.find((q) => q[0] >= x) ?? s.at(-1);
  const v0 = s[0]?.[1], peak = Math.max(...s.map((q) => q[1])), gustEnd = (s.find((q) => q[2] === 0) ?? [null])[0];
  const row = { rep, name, ring: !!ok, taken: s.length > 0, v0, peak, gain: +(peak - v0).toFixed(1), gustEndsAt: gustEnd, v05: at(0.5)[1], v10: at(1.0)[1], v15: at(1.5)[1] };
  console.log(JSON.stringify(row)); out.push(row);
  if (rep === 1 && name === 'hold') {
    // CSS check: the objective pill's fade back (the class goes on for 0.35 s, as seen in phone runs)
    const css = await page.evaluate(async () => { const el = document.querySelector('.objective'); const smp = []; const t0 = performance.now();
      el.classList.add('see-through'); await new Promise((r) => setTimeout(r, 350)); const tOff = performance.now(); el.classList.remove('see-through');
      while (performance.now() - t0 < 900) { smp.push([Math.round(performance.now() - tOff), +(+getComputedStyle(el).opacity).toFixed(2)]); await new Promise((r) => requestAnimationFrame(r)); }
      return smp.filter((_, i) => i % 3 === 0); });
    console.log('CSS objective opacity [ms after class removed, opacity]', JSON.stringify(css));
  }
  await ctx.close();
}
await browser.close();
