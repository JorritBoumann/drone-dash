// Round 48 builder: runs shiftbot48.js on a dev server for profiles x seeds and prints one JSON line per run.
// PORT=5392 (round 47 copy) or 5391 (working copy). SEEDS=22,58,130,daily PROFILES=casual,good,perfect
// "daily" opens ?daily=DATE (default 2026-10-20), the daily city of that date.
import { chromium } from 'playwright';
import fs from 'node:fs';
const PORT = process.env.PORT || '5391';
const seeds = (process.env.SEEDS || '22,58,130').split(',');
const profiles = (process.env.PROFILES || 'casual,good,perfect').split(',');
const TUNE = process.env.TUNE ? JSON.parse(process.env.TUNE) : null;
const bot = fs.readFileSync(new URL('./shiftbot48.js', import.meta.url), 'utf8');
const browser = await chromium.launch();
for (const seed of seeds) {
  for (const prof of profiles) {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => { try { localStorage.setItem('drone-dash-played-v1', '1'); } catch {} });
    await page.addInitScript(bot);
    const q = seed === 'daily' ? `?daily=${process.env.DATE || '2026-10-20'}` : `?seed=${seed}`;
    for (let tries = 0; ; tries++) {
      try {
        await page.goto(`http://127.0.0.1:${PORT}/${q}`, { waitUntil: 'networkidle', timeout: 120000 });
        await page.waitForFunction(() => window.__GAME__ && window.__THREE_GAME_DIAGNOSTICS__, null, { timeout: 120000 });
        break;
      } catch (e) { if (tries >= 2) throw e; }
    }
    await page.waitForTimeout(500);
    await page.evaluate(([p, t]) => window.__SB.begin(p, t), [prof, TUNE]);
    let r; const t0 = Date.now();
    for (;;) { r = await page.evaluate(() => window.__SB.step(10)); if (r.done || r.t > 400) break; }
    const city = await page.evaluate(() => window.__GAME__.city());
    console.log(JSON.stringify({ seed, city: city.mode === 'daily' ? `daily ${city.date} (${city.seed})` : city.seed, ...r, errors, wallS: Math.round((Date.now() - t0) / 1000) }));
    await ctx.close();
  }
}
await browser.close();
