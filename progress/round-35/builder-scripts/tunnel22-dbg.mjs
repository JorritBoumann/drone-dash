// Round 23 critic: seed 22 Organ Tunnel (-88, 0, along z). cam-clip screenshots at the centre showed no drone. Fly it with
// screenshots every 0.5 s and log drone, camera and the projection.
import { chromium } from '@playwright/test';
const OUT = (process.env.OUTDIR || new URL('../builder-shots/', import.meta.url).pathname);
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.addInitScript({ path: new URL('./cam-sampler.js', import.meta.url).pathname });
await page.goto('http://127.0.0.1:5190/?seed=22', { waitUntil: 'networkidle' }); await page.waitForTimeout(1000);
await page.evaluate(() => window.__GAME__.tune({ RUN: { startTime: 999 } }));
await page.keyboard.press('Enter'); await page.waitForTimeout(600);
await page.evaluate(() => window.__GAME__.place(-88, 3.2, -32, Math.PI, 8)); await page.waitForTimeout(200);
await page.keyboard.down('KeyW');
for (let i = 0; i < 9; i++) {
  await page.waitForTimeout(450);
  const d = await page.evaluate(() => { const d = window.__THREE_GAME_DIAGNOSTICS__, cs = window.__cs; const p = d.player.position; cs.V.set(p.x, p.y, p.z).project(cs.cam); return { p: [p.x, p.y, p.z].map((v) => +v.toFixed(1)), sp: +d.player.speed.toFixed(1), cam: [d.camera.x, d.camera.y, d.camera.z].map((v) => +v.toFixed(1)), camObj: [cs.cam.position.x, cs.cam.position.y, cs.cam.position.z].map((v) => +v.toFixed(1)), proj: [cs.V.x, cs.V.y, cs.V.z].map((v) => +v.toFixed(2)), corW: d.camera.corridor }; });
  if (d.sp < 9) await page.keyboard.down('KeyW'); else await page.keyboard.up('KeyW');
  console.log(i, JSON.stringify(d));
  await page.screenshot({ path: OUT + `dbg-22-organ-${i}.jpg`, type: 'jpeg', quality: 80 });
}
// the gap-fly pass 5 wedge: drone placed at (88, 16, -53) facing +z with W held
await page.keyboard.up('KeyW');
await page.evaluate(() => window.__GAME__.place(88, 16, -53, Math.PI, 8)); await page.keyboard.down('KeyW'); await page.waitForTimeout(2500);
const w = await page.evaluate(() => { const G = window.__GAME__, d = window.__THREE_GAME_DIAGNOSTICS__, p = d.player.position; return { p: [p.x, p.y, p.z].map((v) => +v.toFixed(2)), sp: d.player.speed, cam: [d.camera.x, d.camera.y, d.camera.z].map((v) => +v.toFixed(2)), solidsAhead: G.solidAt(p.x, p.y, p.z + 1, 0.3), solidsBehind: G.solidAt(p.x, p.y, p.z - 2, 0.3), contact: d.contact, crashes: d.crashes }; });
console.log('WEDGE', JSON.stringify(w));
await page.screenshot({ path: OUT + 'dbg-22-wedge.jpg', type: 'jpeg', quality: 80 });
await page.keyboard.up('KeyW');
await browser.close();
