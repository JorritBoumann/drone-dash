// Real-time arrival bot (same steering as arrival-metrics) for 60 s; samples camera-to-drone distance and
// camera elevation angle over the drone, bucketed by speed and by distance to target.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const rows = [];
for (const seed of (process.env.SEEDS || '58,7').split(',')) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto('http://127.0.0.1:5190/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(1000);
  await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  const held = new Set(); const setKey = async (k, on) => { if (on && !held.has(k)) { held.add(k); await page.keyboard.down(k); } if (!on && held.has(k)) { held.delete(k); await page.keyboard.up(k); } };
  const start = Date.now();
  while (Date.now() - start < 60000) {
    const d = await page.evaluate(() => JSON.parse(JSON.stringify(window.__THREE_GAME_DIAGNOSTICS__))); if (d.state !== 'playing') break;
    const p = d.player.position, c = d.camera, o = d.objective.position; const hd = Math.hypot(o.x - p.x, o.z - p.z);
    const cd = Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z); const elev = Math.atan2(c.y - p.y, Math.hypot(c.x - p.x, c.z - p.z)) * 57.3;
    // Rebuild the cruise look point from CameraRig's formula (valid when the approach framing is off, hd > 45, level flight).
    const fx = (p.x - c.x), fz = (p.z - c.z), fl = Math.hypot(fx, fz) || 1; const below = p.y - o.y;
    let lookY = p.y + 0.7 - Math.min(5, p.y * 0.06); if (below > 4 && hd > 20) lookY -= Math.min(6, below * 0.12);
    const lx = p.x + fx / fl * 4, lz = p.z + fz / fl * 4;
    const pitch = Math.atan2(c.y - lookY, Math.hypot(lx - c.x, lz - c.z)); // down-pitch of the view axis
    const half = d.camera.fov / 2 / 57.3; const dAng = Math.atan2(c.y - p.y, Math.hypot(p.x - c.x, p.z - c.z)); // down angle to drone
    const droneScreenY = 0.5 + Math.tan(dAng - pitch) / (2 * Math.tan(half)); // 0 = top, 1 = bottom (approx, ignores roll)
    const topDown = pitch - half; // down angle of the top-edge ray
    const camAbove = c.y - p.y; const horiz = Math.hypot(p.x - c.x, p.z - c.z);
    const seeAhead = topDown > 0.005 ? camAbove / Math.tan(topDown) - horiz : 999; // m ahead of the drone where its own altitude leaves the top of frame
    rows.push({ droneScreenY, seeAhead, pitchDeg: pitch * 57.3, spd: d.player.speed, hd, cd, elev, alt: p.y, boost: held.has('KeyE') });
    let err = Math.atan2(o.x - p.x, o.z - p.z) - Math.atan2(p.x - c.x, p.z - c.z); while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
    await setKey('KeyD', Math.abs(err) > 0.12 && err < 0); await setKey('KeyA', Math.abs(err) > 0.12 && err > 0);
    await setKey('KeyW', Math.abs(err) < 0.9 && !(hd < 8 && d.player.speed > 5)); await setKey('KeyS', hd < 8 && d.player.speed > 7);
    const wantY = hd > 25 ? Math.max(o.y + 6, 40) : o.y + 1.2; await setKey('Space', p.y < wantY - 1.5); await setKey('ShiftLeft', p.y > wantY + 1.5);
    await setKey('KeyE', hd > 60 && Math.abs(err) < 0.3 && d.player.boost > 0.3);
    await page.waitForTimeout(60);
  }
  await page.close();
}
const stat = (name, f) => { const s = rows.filter(f); const q = (k, x) => { const a = s.map((r) => r[k]).sort((a, b) => a - b); return a[Math.floor(a.length * x)]?.toFixed(1); }; console.log(name, 'n', s.length, 'camDist p50/p95/max', q('cd', 0.5), q('cd', 0.95), q('cd', 0.999), 'elev deg p50/p95', q('elev', 0.5), q('elev', 0.95)); };
const s2 = rows.filter((r) => r.hd > 45); const qq = (k, x) => { const a = s2.map((r) => r[k]).sort((a, b) => a - b); return a[Math.floor(a.length * x)]?.toFixed(2); };
console.log('CRUISE hd>45 n', s2.length, 'drone screen y (0 top) p05/p50/p95', qq('droneScreenY', 0.05), qq('droneScreenY', 0.5), qq('droneScreenY', 0.95), 'view pitch deg p50/p95', qq('pitchDeg', 0.5), qq('pitchDeg', 0.95), 'see-ahead m at drone altitude p05/p50', qq('seeAhead', 0.05), qq('seeAhead', 0.5), 'share see-ahead < 25 m', (s2.filter((r) => r.seeAhead < 25).length / s2.length * 100).toFixed(1) + '%', 'drone in top 30% of frame', (s2.filter((r) => r.droneScreenY < 0.3).length / s2.length * 100).toFixed(1) + '%');
stat('cruise <12 m/s', (r) => r.hd > 45 && r.spd < 12); stat('cruise 12-20', (r) => r.hd > 45 && r.spd >= 12 && r.spd < 20); stat('boost >20', (r) => r.hd > 45 && r.spd >= 20); stat('final <18 m', (r) => r.hd < 18);
await browser.close();
