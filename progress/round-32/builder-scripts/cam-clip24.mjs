// Round 24 critic: cam-clip.mjs plus MOBILE=1 (iPhone 13 landscape, use with NOORBIT=1) to test the touch view shift in tunnels.
// Round 22 critic: real-time flights through alleys and tunnels with random real mouse orbit (right-drag) and wheel input.
// Per frame (cam-sampler.js): camera inside a solid box (pad 0 / 0.1), drone hidden behind a solid, camera pops.
import { chromium, devices } from '@playwright/test';
const OUT = new URL('./out/', import.meta.url).pathname;
const SEED = process.env.SEED || '22'; const TOTAL = Number(process.env.TOTAL || 62);
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext(process.env.MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } })).newPage();
await page.addInitScript({ path: new URL('./cam-sampler.js', import.meta.url).pathname });
await page.goto('http://127.0.0.1:5190/?seed=' + SEED, { waitUntil: 'networkidle' }); await page.waitForTimeout(1000);
await page.evaluate(() => window.__GAME__.tune({ RUN: { startTime: 999 } }));
await page.keyboard.press('Enter'); await page.waitForTimeout(500);
const feats = await page.evaluate(() => {
  const G = window.__GAME__; const out = [];
  for (const f of G.features()) {
    if (f.kind === 'diagonal') continue;
    const clear = (x, z, y) => !G.insideSolid(x, y, z, 0.3);
    const ax = clear(f.x - 12, f.z, 2) && clear(f.x + 12, f.z, 2) && clear(f.x, f.z, 2) ? 'x' : clear(f.x, f.z - 12, 2) && clear(f.x, f.z + 12, 2) && clear(f.x, f.z, 2) ? 'z' : null;
    if (!ax) continue;
    let roof = 60; for (let y = 1; y < 60; y += 0.25) if (G.insideSolid(f.x, y, f.z, 0)) { roof = y; break; }
    out.push({ kind: f.kind, name: f.name, x: f.x, z: f.z, L: f.length, ax, roof });
  }
  return out;
});
console.log('FEATURES', JSON.stringify(feats));
const tun = feats.filter((f) => f.kind === 'tunnel'), al = feats.filter((f) => f.kind === 'alley');
const plan = []; for (let i = 0; plan.length < 12 && i < 12; i++) { if (tun[i % Math.max(1, tun.length)] && i < tun.length * 2) plan.push(tun[i % tun.length]); if (al[i]) plan.push(al[i]); }
await page.evaluate(() => { window.__cs.on = true; });
const held = new Set(); const key = async (k, on) => { if (on && !held.has(k)) { held.add(k); await page.keyboard.down(k); } if (!on && held.has(k)) { held.delete(k); await page.keyboard.up(k); } };
let rnd = 12345; const R = () => (rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648;
let mx = 640, my = 360, dragging = false, vx = 0, vy = 0, nextToggle = 0;
const tStart = Date.now(); let pass = 0, shots = 0;
for (const f of plan) {
  if ((Date.now() - tStart) / 1000 > TOTAL) break;
  pass++;
  const dir = f.ax === 'x' ? [pass % 2 ? 1 : -1, 0] : [0, pass % 2 ? 1 : -1];
  const y = f.kind === 'tunnel' ? Math.min(3.2, f.roof - 1.6) : 3.5;
  const sx = f.x - dir[0] * (f.L / 2 + 10), sz = f.z - dir[1] * (f.L / 2 + 10);
  const yaw = Math.atan2(-dir[0], -dir[1]);
  await page.evaluate(([sx, y, sz, yaw]) => window.__GAME__.place(sx, y, sz, yaw, 8), [sx, y, sz, yaw]);
  await page.evaluate((k) => window.__cs.rows.push({ mark: k }), `pass${pass}-${f.kind}-${f.name}`);
  const t0 = Date.now(); let shot = false;
  while ((Date.now() - t0) / 1000 < 6.5) {
    const d = await page.evaluate(() => { const d = window.__THREE_GAME_DIAGNOSTICS__; return { p: d.player.position, yaw: d.player.yaw, sp: d.player.speed, crashes: d.crashes }; });
    // steer along the centre line, 10 m ahead
    const along = (d.p.x - f.x) * dir[0] + (d.p.z - f.z) * dir[1];
    const tx = f.x + dir[0] * (along + 10), tz = f.z + dir[1] * (along + 10);
    const want = Math.atan2(-(tx - d.p.x), -(tz - d.p.z)); let err = want - d.yaw; err = Math.atan2(Math.sin(err), Math.cos(err));
    await key('KeyA', err > 0.04); await key('KeyD', err < -0.04);
    await key('KeyW', d.sp < 11); await key('KeyS', d.sp > 14);
    await key('Space', d.p.y < y - 0.4); await key('ShiftLeft', d.p.y > y + 0.4);
    // random orbit input
    const now = (Date.now() - tStart) / 1000;
    if (!process.env.NOORBIT && now > nextToggle) { dragging = !dragging; nextToggle = now + 0.3 + R() * 1.1; vx = (R() - 0.5) * 1400; vy = (R() - 0.5) * 700; if (dragging) { mx = 640; my = 360; await page.mouse.move(mx, my); await page.mouse.down({ button: 'right' }); } else { await page.mouse.up({ button: 'right' }); if (R() < 0.3) await page.mouse.wheel(0, (R() - 0.5) * 400); } }
    if (dragging) { mx = Math.max(20, Math.min(1260, mx + vx * 0.05)); my = Math.max(20, Math.min(700, my + vy * 0.05)); await page.mouse.move(mx, my); }
    if (!shot && Math.abs(along) < 4 && shots < 8) { shot = true; shots++; await page.screenshot({ path: OUT + `cam-clip-${SEED}${(process.env.MOBILE ? '-m' : '') + (process.env.NOORBIT ? '-noorbit' : '')}-${pass}-${f.kind}.jpg`, type: 'jpeg', quality: 80 }); }
    await page.waitForTimeout(40);
  }
}
if (dragging) await page.mouse.up({ button: 'right' });
for (const k of [...held]) await key(k, false);
const rows = await page.evaluate(() => window.__cs.rows);
const fs = await import('fs'); fs.writeFileSync(new URL(`./cam-clip-${SEED}${(process.env.MOBILE ? '-m' : '') + (process.env.NOORBIT ? '-noorbit' : '')}-rows.json`, import.meta.url).pathname, JSON.stringify(rows));
let m = '', per = {}; const all = []; let kk = 0;
for (const r of rows) { if (!r.mark && (r.st !== 'playing' || kk++ < 90)) continue; if (r.mark) { kk = 0; m = r.mark; per[m] = { frames: 0, in0: 0, in1: 0, occ: 0, pops: 0, maxPop: 0, under: 0, minDist: 99, crashes0: null, crashes: 0 }; continue; } if (!m) continue; r.m = m; all.push(r); const s = per[m]; s.frames++; s.in0 += r.in0 ? 1 : 0; s.in1 += r.in1 ? 1 : 0; s.occ += r.occ; s.under += r.under; s.minDist = Math.min(s.minDist, r.dist); if (s.crashes0 === null) s.crashes0 = r.crashes; s.crashes = r.crashes - s.crashes0; }
for (let i = 1; i < all.length; i++) { const a = all[i - 1], b = all[i]; if (a.m !== b.m) continue; const j = Math.hypot((b.cx - a.cx) - (b.px - a.px), (b.cy - a.cy) - (b.py - a.py), (b.cz - a.cz) - (b.pz - a.pz)); if (j > 1.0) { per[b.m].pops++; } per[b.m].maxPop = Math.max(per[b.m].maxPop, +j.toFixed(2)); }
for (const [k, v] of Object.entries(per)) console.log('PASS', k, JSON.stringify({ ...v, minDist: +v.minDist.toFixed(2) }));
const tot = all.length; const secs = all.length ? all.at(-1).t - all[0].t : 0;
console.log('TOTAL', JSON.stringify({ seed: SEED, secs: +secs.toFixed(1), frames: tot, in0: all.filter((r) => r.in0).length, in1: all.filter((r) => r.in1).length, occ: all.filter((r) => r.occ).length, under: all.filter((r) => r.under).length, pops1m: Object.values(per).reduce((s, v) => s + v.pops, 0), close1m: all.filter((r) => r.dist < 1.5).length, freeShare: +(all.filter((r) => r.free > 0.5).length / tot).toFixed(2) }));
await browser.close();
