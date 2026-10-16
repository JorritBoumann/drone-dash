// Round 4 critic: desktop flow as a careless player. Start with Enter, hold W and boost at street height,
// steer a little at random, so the run ends by the clock with crashes. Screenshots: crash pop sequence
// (0, 0.4, 1.0 s after a crash), game-over screen, and 0.5 s after pressing Enter to restart.
import { chromium } from '@playwright/test';
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto('http://127.0.0.1:5188/?seed=33', { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
await page.keyboard.press('Enter'); await page.waitForTimeout(300);
const diag = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__THREE_GAME_DIAGNOSTICS__)));
await page.keyboard.down('KeyW'); await page.keyboard.down('KeyE');
let d = await diag(), crashSeq = 0; const t0 = Date.now(); let turn = null;
while (d.state === 'playing' && Date.now() - t0 < 120000) {
  const prev = d; d = await diag();
  if (d.player.position.y > 9) await page.keyboard.down('ShiftLeft'); else await page.keyboard.up('ShiftLeft');
  if (d.player.position.y < 5) await page.keyboard.down('Space'); else await page.keyboard.up('Space');
  if (Math.random() < 0.03) { if (turn) await page.keyboard.up(turn); turn = Math.random() < 0.5 ? 'KeyA' : 'KeyD'; await page.keyboard.down(turn); setTimeout(() => page.keyboard.up(turn).catch(() => {}), 500); }
  if (d.crashes > prev.crashes && crashSeq < 2) {
    crashSeq++;
    for (const ms of [0, 400, 1000]) { if (ms) await page.waitForTimeout(ms === 400 ? 400 : 600); await page.screenshot({ path: OUT + `F-crash${crashSeq}-${ms}ms.jpg`, type: 'jpeg', quality: 80 }); }
  }
  await page.waitForTimeout(50);
}
for (const k of ['KeyW', 'KeyE', 'ShiftLeft', 'Space', 'KeyA', 'KeyD']) await page.keyboard.up(k);
console.log('end', d.state, 'wall s', ((Date.now() - t0) / 1000).toFixed(0), 'crashes', d.crashes, 'deliveries', d.deliveries, 'score', d.score);
await page.waitForTimeout(1500); await page.screenshot({ path: OUT + 'F-game-over.jpg', type: 'jpeg', quality: 80 });
console.log('over text', await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 400)));
await page.keyboard.press('Enter'); await page.waitForTimeout(500);
d = await diag(); console.log('after Enter', d.state, d.timeLeft.toFixed(1), 'score', d.score, 'crashes', d.crashes);
await page.screenshot({ path: OUT + 'F-restart.jpg', type: 'jpeg', quality: 80 });
await browser.close();
