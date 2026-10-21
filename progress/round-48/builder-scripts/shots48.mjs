// Round 48 builder: screenshots for the critic. Plays with shiftbot48.js (deterministic), then renders a frame and saves:
//   hud-<dev><hud>.jpg   : HUD with shift progress (2 of 5 delivered), a tailwind ring ahead on the street
//   win-<dev><hud>.jpg   : the "Shift complete" card (good line, seed 130)
//   loss-<dev><hud>.jpg  : the "Out of time" card (slow line, seed 130)
//   nudge-<dev><hud>.jpg : the boost indicator nudge (full meter unused for 8 s)
// DEVS=desktop,phone HUDS=html,canvas PORT=5391
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
const PORT = process.env.PORT || '5391', SEED = process.env.SEED || '130';
const OUT = new URL('../shots/', import.meta.url).pathname;
const bot = fs.readFileSync(new URL('./shiftbot48.js', import.meta.url), 'utf8');
const browser = await chromium.launch();
const log = [];
async function open(dev, hud) {
  const ctx = await browser.newContext(dev === 'phone' ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('drone-dash-played-v1', '1'); } catch {} });
  await page.addInitScript(bot);
  await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}${hud === 'canvas' ? '&hud=canvas' : ''}`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForFunction(() => window.__GAME__ && window.__THREE_GAME_DIAGNOSTICS__, null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  return { ctx, page, errors };
}
const frame = (page) => page.evaluate(() => { for (let i = 0; i < 3; i++) window.__GAME__.advance(1 / 60, true); });
// the shot runs the game in real time for a moment (a screenshot waits for a real frame), then hands it back to the bot
const shot = async (page, name) => {
  await page.evaluate(() => { window.__GAME__.manualRender(false); window.__GAME__.externalClock(false); });
  await page.waitForTimeout(120);
  await page.screenshot({ path: OUT + name, type: 'jpeg', quality: 85, timeout: 90000 });
  await page.evaluate(() => { window.__GAME__.manualRender(true); window.__GAME__.externalClock(true); });
  log.push(name);
};
for (const dev of (process.env.DEVS || 'desktop,phone').split(',')) {
  for (const hud of (process.env.HUDS || 'html,canvas').split(',')) {
    const tag = `${dev}${hud === 'canvas' ? '-canvas' : ''}`;
    // a won shift; on the way, a HUD shot at 2 delivered with a ring 18 to 32 m ahead
    let { ctx, page, errors } = await open(dev, hud);
    await page.evaluate(() => window.__SB.begin('good'));
    let hudDone = false, r;
    for (let i = 0; i < 4000; i++) {
      r = await page.evaluate(() => window.__SB.step(0.1));
      if (r.done) break;
      if (!hudDone && r.deliveries >= 2) {
        const ahead = await page.evaluate(() => {
          const d = window.__THREE_GAME_DIAGNOSTICS__, p = d.player.position, fx = -Math.sin(d.player.yaw), fz = -Math.cos(d.player.yaw);
          return (d.rings || []).some((q) => { if (!q.on) return false; const dx = q.x - p.x, dz = q.z - p.z, dist = Math.hypot(dx, dz); return dist > 18 && dist < 32 && (dx * fx + dz * fz) / dist > 0.95; });
        });
        if (ahead) { await frame(page); await shot(page, `hud-${tag}.jpg`); hudDone = true; }
      }
    }
    await page.evaluate(() => { window.__GAME__.advance(2.5, true); });
    await page.waitForTimeout(400);
    await frame(page);
    await shot(page, `win-${tag}.jpg`);
    log.push(JSON.stringify({ tag, win: r.win, left: r.timeLeftEnd, score: r.score, errors }));
    await ctx.close();
    // a lost shift (the slow line)
    ({ ctx, page, errors } = await open(dev, hud));
    await page.evaluate(() => window.__SB.begin('slow'));
    for (let i = 0; i < 400; i++) { r = await page.evaluate(() => window.__SB.step(1)); if (r.done) break; }
    await page.evaluate(() => { window.__GAME__.advance(1, true); });
    await page.waitForTimeout(400);
    await frame(page);
    await shot(page, `loss-${tag}.jpg`);
    log.push(JSON.stringify({ tag, win: r.win, deliveries: r.deliveries, score: r.score, errors }));
    await ctx.close();
    // the boost nudge: start, hover 9 s without boosting
    ({ ctx, page, errors } = await open(dev, hud));
    await page.evaluate(() => { const G = window.__GAME__; G.manualRender(true); G.externalClock(true); G.start(); G.advance(9.2, true); });
    await page.waitForTimeout(500);
    await frame(page);
    await shot(page, `nudge-${tag}.jpg`);
    log.push(JSON.stringify({ tag, nudge: await page.evaluate(() => document.querySelector('.boost').classList.contains('nudge')), errors }));
    await ctx.close();
  }
}
console.log(log.join('\n'));
await browser.close();
