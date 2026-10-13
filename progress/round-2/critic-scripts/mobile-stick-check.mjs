// Checks that a CDP touch on the stick produces the expected turn/thrust (driver sanity check).
import { chromium, devices } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'] });
const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
await page.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
await page.evaluate(() => window.__GAME__.start()); await page.waitForTimeout(500);
const st = await page.evaluate(() => { const r = document.getElementById('touch-stick').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, R: r.width * 0.4 }; });
const diag = () => page.evaluate(() => { const d = window.__THREE_GAME_DIAGNOSTICS__; const p = d.player.position, c = d.camera; return { p: [p.x, p.y, p.z].map((v) => +v.toFixed(1)), head: +Math.atan2(p.x - c.x, p.z - c.z).toFixed(2), spd: +d.player.speed.toFixed(1), knob: document.getElementById('touch-knob').style.transform }; });
const t = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
for (const [name, sx, sy] of [['forward', 0, -1], ['forward+left', -0.6, -0.8], ['forward+right', 0.6, -0.8]]) {
  const a = await diag();
  await t('touchStart', [{ x: st.x, y: st.y, id: 1 }]);
  await t('touchMove', [{ x: st.x + sx * st.R, y: st.y + sy * st.R, id: 1 }]);
  for (let i = 0; i < 15; i++) { await page.waitForTimeout(100); await t('touchMove', [{ x: st.x + sx * st.R, y: st.y + sy * st.R, id: 1 }]); }
  const b = await diag(); await t('touchEnd', []); await page.waitForTimeout(800);
  console.log(name, 'head', a.head, '->', b.head, 'spd', b.spd, 'knob', b.knob, 'pos', a.p, '->', b.p);
}
await browser.close();
