// Round 13 critic (new): the round 13 slow-clock badge states as a player sees them. Desktop 1280x720 or MOBILE=1
// (iPhone 13 held sideways). Deterministic (place + advance with the game's key hook). Waits for the title overlay to fade.
// States: toward the pickup at a hug (budget seconds shown), the same after the budget is spent, flying away (wrong way).
import { chromium, devices } from '@playwright/test';
const MOBILE = !!process.env.MOBILE; const P = MOBILE ? 'm' : 'd'; const SEED = process.env.SEED || '22';
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = MOBILE ? await browser.newContext({ ...devices['iPhone 13 landscape'] }) : await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5188/?seed=' + SEED, { waitUntil: 'networkidle' }); await page.waitForTimeout(1000);
const info = await page.evaluate(() => { const G = window.__GAME__; G.start(); G.manualRender(true); const d = G.advance(0.1, false); let yz = 0; for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { G.place(66, 7, -128, yaw, 0); G.key('KeyW', true); const dd = G.advance(0.6, false); G.key('KeyW', false); if (dd.player.position.z + 128 > 2) { yz = yaw; break; } } return { yz, t: d.objective.position }; });
await page.waitForTimeout(2500); // let the title overlay fade out in real time
// fly the street through x = road nearest the target, toward it (from the far side) or away from it
const road = 22 + 44 * Math.round((info.t.x - 22) / 44);
const towardDir = info.t.z > 0 ? 1 : -1; // start at the far negative/positive end and fly toward the target's z
const cases = [
  { n: 'toward-2s', secs: 2, dir: towardDir },
  { n: 'toward-12s-spent', secs: 12, dir: towardDir },
  { n: 'away-3s-wrongway', secs: 3, dir: -towardDir },
];
for (const c of cases) {
  const r = await page.evaluate(({ c, yz, road }) => {
    const G = window.__GAME__; G.restart(); G.start(); G.advance(0.1, false);
    const z0 = -c.dir * 150; const yaw = c.dir > 0 ? yz : yz + Math.PI;
    G.place(road + 6.5, 7, z0, yaw, 12);
    let d; const log = [];
    for (let i = 0; i < c.secs * 20; i++) { d = G.advance(0.05, false); G.key('KeyW', d.player.speed < 15); G.key('Space', d.player.position.y < 6.3); G.key('ShiftLeft', d.player.position.y > 7.7); if (i % 20 === 19) log.push({ s: (i + 1) / 20, clock: +d.timeLeft.toFixed(1), budget: +d.slipstream.budget.toFixed(1), toward: +d.slipstream.toward.toFixed(2), gain: +d.slipstream.clockGain.toFixed(2), badge: document.getElementById('timer-slow').textContent }); }
    G.advance(0.02, true);
    const b = document.getElementById('timer-slow'); const r = b.getBoundingClientRect(); const cs = getComputedStyle(b);
    return { text: b.textContent, cls: document.getElementById('timer').className, badge: { w: Math.round(r.width), h: Math.round(r.height), font: cs.fontSize, color: cs.color }, log, z: +d.player.position.z.toFixed(0) };
  }, { c, yz: info.yz, road });
  console.log(P + ' ' + c.n + ' ' + JSON.stringify(r));
  await page.screenshot({ path: OUT + `${P}-badge13-${c.n}.jpg`, type: 'jpeg', quality: 80 });
  await page.evaluate(() => { for (const k of ['KeyW', 'Space', 'ShiftLeft']) window.__GAME__.key(k, false); });
}
console.log('target', JSON.stringify(info.t), 'road', road);
await browser.close();
