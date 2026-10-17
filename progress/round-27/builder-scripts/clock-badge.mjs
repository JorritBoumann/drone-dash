// Round 12 critic (new): the slow-clock badge as a player sees it. Desktop 1280x720 or MOBILE=1 (iPhone 13 held sideways, touch).
// Deterministic: place the drone on a street, hold forward with the game's own key hook, advance with rendering, and
// screenshot the HUD at three draft levels (centre crawl, centre cruise, tight hug at cruise). Logs the badge text,
// its size on screen, its font size and the timer value a second apart.
import { chromium, devices } from '@playwright/test';
const MOBILE = !!process.env.MOBILE; const P = MOBILE ? 'm' : 'd'; const SEED = process.env.SEED || '22';
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = MOBILE ? await browser.newContext({ ...devices['iPhone 13 landscape'] }) : await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5190/?seed=' + SEED, { waitUntil: 'networkidle' }); await page.waitForTimeout(1000);
const yz = await page.evaluate(() => { const G = window.__GAME__; G.start(); G.manualRender(true); for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { G.place(66, 7, -128, yaw, 0); G.key('KeyW', true); const d = G.advance(0.6, false); G.key('KeyW', false); if (d.player.position.z + 128 > 2) return yaw; } return 0; });
for (const c of [{ n: 'crawl-centre', off: 0, cap: 7 }, { n: 'cruise-centre', off: 0, cap: 15 }, { n: 'hug-cruise', off: 6.5, cap: 15 }]) {
  const r = await page.evaluate(({ off, cap, yz }) => {
    const G = window.__GAME__; G.restart(); G.start(); G.advance(0.1, false); G.place(66 + off, 7, -128, yz, 8);
    let d; const run = (s) => { for (let i = 0; i < s * 20; i++) { d = G.advance(0.05, false); G.key('KeyW', d.player.speed < cap); G.key('Space', d.player.position.y < 6.3); G.key('ShiftLeft', d.player.position.y > 7.7); } };
    run(4); const tA = d.timeLeft; run(1); const tB = d.timeLeft; G.advance(0.02, true);
    const b = document.getElementById('timer-slow'); const r = b.getBoundingClientRect(); const cs = getComputedStyle(b); const tm = document.getElementById('timer').getBoundingClientRect();
    return { text: b.textContent, shown: document.getElementById('timer').classList.contains('slow'), badge: { w: Math.round(r.width), h: Math.round(r.height), font: cs.fontSize }, timer: { w: Math.round(tm.width), h: Math.round(tm.height), x: Math.round(tm.x), y: Math.round(tm.y) }, clockPerSec: +(tA - tB).toFixed(2), gain: +d.slipstream.clockGain.toFixed(2), rate: +d.slipstream.rate.toFixed(1), chain: d.slipstream.chain, timerText: document.getElementById('timer').innerText.replace(/\s+/g, ' ') };
  }, { ...c, yz });
  console.log(P + ' ' + c.n + ' ' + JSON.stringify(r));
  await page.screenshot({ path: OUT + `${P}-clock-${c.n}.jpg`, type: 'jpeg', quality: 80 });
  await page.evaluate(() => { for (const k of ['KeyW', 'Space', 'ShiftLeft']) window.__GAME__.key(k, false); });
}
await browser.close();
