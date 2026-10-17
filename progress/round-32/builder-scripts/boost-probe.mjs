// Round 6 critic: top speed probe. Climb to ALT, then hold W (+E if BOOST) for 6 s along the camera heading. Logs speed, boost tank, headwind, altitude every 0.5 s.
import { chromium } from '@playwright/test';
const ALT = Number(process.env.ALT || 10); const BOOST = !!process.env.BOOST; const seed = process.env.SEED || '22';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto('http://127.0.0.1:5190/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
await page.keyboard.press('Enter'); await page.waitForTimeout(200);
const diag = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__THREE_GAME_DIAGNOSTICS__)));
let d = await diag();
await page.keyboard.down('Space'); while ((d = await diag()).player.position.y < ALT) await page.waitForTimeout(30); await page.keyboard.up('Space');
await page.keyboard.down('KeyW'); if (BOOST) await page.keyboard.down('KeyE');
const t0 = Date.now(); const out = []; let maxS = 0;
while (Date.now() - t0 < 6000) { d = await diag(); const y = d.player.position.y; if (y < ALT - 1) await page.keyboard.down('Space'); else await page.keyboard.up('Space'); if (y > ALT + 1) await page.keyboard.down('ShiftLeft'); else await page.keyboard.up('ShiftLeft'); maxS = Math.max(maxS, d.player.speed); if (out.length < (Date.now() - t0) / 500) out.push(`${((Date.now() - t0) / 1000).toFixed(1)}s v${d.player.speed.toFixed(1)} b${d.player.boost.toFixed(2)} hw${(d.player.headwind || 0).toFixed(2)} y${y.toFixed(0)} cr${d.crashes}`); await page.waitForTimeout(30); }
console.log(`ALT ${ALT} BOOST ${BOOST} seed ${seed} max ${maxS.toFixed(1)}`); console.log(out.join(' | '));
await browser.close();
