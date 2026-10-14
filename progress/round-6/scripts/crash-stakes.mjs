// Deliver twice with the arrival bot (to build a combo and carry a parcel), then boost at 8-12 m altitude
// straight ahead until a hard crash. Logs time left, combo, score and carrying just before and 1 s after the hit.
import { chromium } from '@playwright/test';
const OUT = new URL('../shots/', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chromium' });
for (const seed of (process.env.SEEDS || '22,58,130').split(',')) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto('http://127.0.0.1:5188/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(1000);
  await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  const held = new Set(); const setKey = async (k, on) => { if (on && !held.has(k)) { held.add(k); await page.keyboard.down(k); } if (!on && held.has(k)) { held.delete(k); await page.keyboard.up(k); } };
  const diag = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__THREE_GAME_DIAGNOSTICS__)));
  let d = await diag(); const start = Date.now();
  while (Date.now() - start < 60000 && !(d.deliveries >= 2 && d.player.carrying)) {
    d = await diag(); if (d.state !== 'playing') break;
    const p = d.player.position, c = d.camera, o = d.objective.position; const hd = Math.hypot(o.x - p.x, o.z - p.z);
    let err = Math.atan2(o.x - p.x, o.z - p.z) - Math.atan2(p.x - c.x, p.z - c.z); while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
    await setKey('KeyD', Math.abs(err) > 0.12 && err < 0); await setKey('KeyA', Math.abs(err) > 0.12 && err > 0);
    await setKey('KeyW', Math.abs(err) < 0.9 && !(hd < 8 && d.player.speed > 5)); await setKey('KeyS', hd < 8 && d.player.speed > 7);
    const wantY = hd > 25 ? Math.max(o.y + 6, 40) : o.y + 1.2; await setKey('Space', p.y < wantY - 1.5); await setKey('ShiftLeft', p.y > wantY + 1.5);
    await page.waitForTimeout(60);
  }
  for (const k of [...held]) await setKey(k, false);
  // drop to ~10 m, then boost straight
  for (let i = 0; i < 60; i++) { d = await diag(); if (d.player.position.y < 11) break; await setKey('ShiftLeft', true); await page.waitForTimeout(60); }
  await setKey('ShiftLeft', false);
  await setKey('KeyW', true); await setKey('KeyE', true);
  let last = d, hit = null; const t0 = Date.now();
  while (Date.now() - t0 < 8000) {
    d = await diag(); const p = d.player.position;
    await setKey('Space', p.y < 9); await setKey('ShiftLeft', p.y > 12);
    if (last.player.speed - d.player.speed > 8) { hit = { before: last, after0: d }; await page.screenshot({ path: OUT + `X-seed${seed}-crash.jpg`, type: "jpeg", quality: 80 }); break; }
    last = d; await page.waitForTimeout(30);
  }
  for (const k of [...held]) await setKey(k, false);
  if (!hit) { console.log(seed, 'no hard crash found'); await page.close(); continue; }
  await page.waitForTimeout(1000); const a = await diag();
  const f = (x) => ({ speed: +x.player.speed.toFixed(1), timeLeft: +x.timeLeft.toFixed(1), combo: x.combo, score: x.score, carrying: x.player.carrying, deliveries: x.deliveries });
  console.log(seed, 'BEFORE', JSON.stringify(f(hit.before)), 'AT HIT', JSON.stringify(f(hit.after0)), 'AFTER 1s', JSON.stringify(f(a)));
  await page.close();
}
await browser.close();
