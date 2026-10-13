import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';
const OUT = new URL('../critic/', import.meta.url).pathname;
const how = process.argv[2] || 'enter';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
function variety(buf) { const p = PNG.sync.read(buf); const set = new Set(); for (let y = 120; y < 640; y += 8) for (let x = 0; x < p.width; x += 8) { const i = (y * p.width + x) * 4; set.add((p.data[i] >> 3) + ',' + (p.data[i + 1] >> 3) + ',' + (p.data[i + 2] >> 3)); } return set.size; }
if (how === 'click') await page.click('#play-button, button:has-text("Play")'); else await page.keyboard.press('Enter');
if (how !== 'idle') await page.keyboard.down('KeyW');
const t0 = Date.now(); const rows = [];
let saved = false;
while (Date.now() - t0 < 14000) {
  const buf = await page.screenshot();
  const v = variety(buf);
  const d = await page.evaluate(() => { const g = window.__THREE_GAME_DIAGNOSTICS__; const c = g.camera, p = g.player.position; const top = document.elementFromPoint(640, 400); const app = document.getElementById('app'); return { cam: [c.x, c.y, c.z].map((n) => n.toFixed(1)).join(','), pl: [p.x, p.y, p.z].map((n) => n.toFixed(1)).join(','), fov: c.fov.toFixed(1), top: top.id || top.className, appState: app.dataset.state, tl: g.timeLeft.toFixed(1), hidden: g.world.hiddenProps }; });
  rows.push([((Date.now() - t0) / 1000).toFixed(2), v, JSON.stringify(d)]);
  if (v < 40 && !saved) { saved = true; await page.evaluate(() => { document.getElementById('hud').style.visibility = 'hidden'; }); await page.screenshot({ path: OUT + `probe-blank-${how}-hud-hidden.png` }); await page.evaluate(() => { document.getElementById('hud').style.visibility = ''; }); }
  await page.waitForTimeout(200);
}
console.log(how); for (const r of rows) console.log(r.join(' '));
await browser.close();
