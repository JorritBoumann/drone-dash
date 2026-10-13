// Builder check (round 4): fly the play-desktop autopilot and pair every sampled speed drop with what it cost.
// A drop under 6 m/s must leave combo, score and clock (beyond drain) untouched; a drop over 8 m/s must cost.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const rows = [];
for (const seed of (process.env.SEEDS || '22,58,130').split(',')) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto('http://127.0.0.1:5188/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(1000);
  await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  const held = new Set(); const setKey = async (k, on) => { if (on && !held.has(k)) { held.add(k); await page.keyboard.down(k); } if (!on && held.has(k)) { held.delete(k); await page.keyboard.up(k); } };
  const diag = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__THREE_GAME_DIAGNOSTICS__)));
  let last = await diag(); const start = Date.now();
  while (Date.now() - start < Number(process.env.DUR || 90000)) {
    const d = await diag(); if (d.state !== 'playing') break;
    const p = d.player.position, c = d.camera, o = d.objective.position; const hd = Math.hypot(o.x - p.x, o.z - p.z);
    let err = Math.atan2(o.x - p.x, o.z - p.z) - Math.atan2(p.x - c.x, p.z - c.z); while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
    await setKey('KeyD', Math.abs(err) > 0.12 && err < 0); await setKey('KeyA', Math.abs(err) > 0.12 && err > 0);
    await setKey('KeyW', Math.abs(err) < 0.9);
    const wantY = hd > 25 ? Math.max(o.y + 6, 40) : o.y + 1.2; await setKey('Space', p.y < wantY - 1.5); await setKey('ShiftLeft', p.y > wantY + 1.5);
    await setKey('KeyE', hd > 60 && Math.abs(err) < 0.3 && d.player.boost > 0.3);
    const drop = last.player.speed - d.player.speed;
    if (drop > 2) {
      const dt = d.elapsed - last.elapsed; const delivered = d.deliveries !== last.deliveries;
      rows.push({ seed, drop: +drop.toFixed(1), crashes: d.crashes - last.crashes, comboDrop: !delivered && d.combo < last.combo, extraTime: delivered ? null : +((last.timeLeft - d.timeLeft) - dt).toFixed(2), scoreLost: d.score < last.score });
    }
    last = d; await page.waitForTimeout(60);
  }
  for (const k of [...held]) await setKey(k, false);
  await page.close();
}
const charged = (r) => r.crashes > 0 || r.comboDrop || r.scoreLost || (r.extraTime ?? 0) > 0.5;
const small = rows.filter((r) => r.drop < 6), big = rows.filter((r) => r.drop > 8);
for (const r of rows) console.log(JSON.stringify(r));
console.log('drops<6', small.length, 'charged', small.filter(charged).length, '| drops>8', big.length, 'charged in sample', big.filter(charged).length);
await browser.close();
