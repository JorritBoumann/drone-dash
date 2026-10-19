// Round 42 critic: seeds41c.mjs with the README seed cases (sign kept, wrap, padding, text). Round 41 critic (new): odd `seed` values the Play Worker might send (production build, 5193). Per value: page errors,
// the seed and city mode the game used, start a run and fly 1 s, and whether two loads of the same value give one city.
import { chromium } from '@playwright/test';
const PORT = process.env.PORT || '5193';
const VALUES = (process.env.VALUES || '22|-22|4294967274|4294967318|022|%2022%20|-5|5|9007199254740993|abc|f3a9-uuid-x|22.7|').split('|');
const browser = await chromium.launch({ channel: 'chromium' });
for (const v of VALUES) {
  const sig = [];
  let line = null;
  for (let k = 0; k < 2; k++) {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } }); const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
    await page.goto(`http://127.0.0.1:${PORT}/?seed=${v}&slLaunch=x&foo=bar`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
    const r = await page.evaluate(() => { const d = window.__THREE_GAME_DIAGNOSTICS__; return d ? { seed: d.seed, mode: d.city.mode, mood: d.city.mood, sites: window.__GAME__.sites().slice(0, 3).map((s) => s.name).join('/'), sig: JSON.stringify(window.__GAME__.sites()).length + ':' + window.__GAME__.sites().slice(0, 8).map((s) => s.name + Math.round(s.x) + ',' + Math.round(s.z)).join('/') } : null; });
    await page.keyboard.press('Enter'); await page.keyboard.down('KeyW'); await page.waitForTimeout(1000); await page.keyboard.up('KeyW');
    const st = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.state);
    sig.push(JSON.stringify(r));
    if (!line) line = { value: v, ...r, state: st, errs };
    await ctx.close();
  }
  console.log('SEED', JSON.stringify({ ...line, sameCityTwice: sig[0] === sig[1] }));
}
await browser.close();
