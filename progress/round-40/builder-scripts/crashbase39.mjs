// Round 39 builder: what a head-on wall crash does on screen, on any build (no round 39 hooks needed). The drone hovers
// 7 m from the block face at x = -52 on the z = 66 road (seed 22), then W is held until it hits (about 11 m/s, like the
// round 38 video crash at 0:40.7). Fixed step, 60 Hz. Logs per frame: wall loss, crash count, the camera's offset from
// its own smoothed path (shake), the drone's screen box; saves a frame every 1/15 s from contact to 1.2 s after.
// env: PORT, TAG
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const PORT = process.env.PORT || '5190', TAG = process.env.TAG || 'r39';
const OUT = (process.env.OUTDIR || new URL('../critic/', import.meta.url).pathname) + `crashbase-${TAG}/`;
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(`http://127.0.0.1:${PORT}/?seed=22`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
await page.evaluate(() => { const G = window.__GAME__; G.start(); G.manualRender(true); G.tune({ RUN: { startTime: 999 } }); });
await page.waitForTimeout(1500);
await page.evaluate(() => { const G = window.__GAME__; G.place(-52, 10, 65, 0, 0); G.advance(1.5, false); G.key('KeyW', true); });
const rows = [];
let contactF = -1, shot = 0;
for (let f = 0; f < 150; f++) {
  const d = await page.evaluate(() => { const G = window.__GAME__; const d = G.advance(1 / 60, true); const b = G.droneBox(); return { sp: d.player.speed, z: d.player.position.z, wl: d.contact.wallLoss, bump: d.contact.bump, crashes: d.crashes, cam: d.camera, b, feel: d.feel || null }; });
  if (contactF < 0 && d.bump > 0) { contactF = f; await page.evaluate(() => window.__GAME__.key('KeyW', false)); }
  rows.push({ f, ...d });
  if (contactF >= 0 && (f - contactF) % 4 === 0 && f - contactF <= 72) await page.screenshot({ path: OUT + `t${String(Math.round((f - contactF) / 0.6)).padStart(3, '0')}.jpg`, type: 'jpeg', quality: 80, clip: { x: 320, y: 120, width: 640, height: 400 } }), shot++;
}
const c = rows[contactF];
const crashF = rows.findIndex((r) => r.crashes > rows[0].crashes);
// camera jitter: distance of each frame's camera from the mean of its neighbours (+-3 frames) after contact
let jit = 0;
for (let i = contactF + 3; i < Math.min(rows.length - 3, contactF + 60); i++) {
  const m = [0, 0, 0]; for (let k = -3; k <= 3; k++) { m[0] += rows[i + k].cam.x / 7; m[1] += rows[i + k].cam.y / 7; m[2] += rows[i + k].cam.z / 7; }
  jit = Math.max(jit, Math.hypot(rows[i].cam.x - m[0], rows[i].cam.y - m[1], rows[i].cam.z - m[2]));
}
const ar = rows.slice(contactF, contactF + 72).map((r) => r.b.h / Math.max(1, r.b.w));
console.log(TAG, `impact ${c.bump.toFixed(1)} m/s (speed before ${rows[contactF - 1].sp.toFixed(1)}), loss in the hit ${rows.slice(contactF, contactF + 12).reduce((s, r) => s + r.wl, 0).toFixed(1)}; crash charged ${crashF >= 0 ? `${((crashF - contactF) / 60).toFixed(3)} s after contact` : 'no'}; camera jitter peak ${jit.toFixed(3)} m; drone box h/w ${Math.min(...ar).toFixed(2)}..${Math.max(...ar).toFixed(2)} (level hover ${(rows[contactF - 20].b.h / rows[contactF - 20].b.w).toFixed(2)}); frames ${shot}`);
if (rows[contactF].feel) {
  const fl = rows.slice(contactF, contactF + 72).map((r) => r.feel);
  console.log(TAG, `tilt peak pitch ${Math.max(...fl.map((x) => Math.abs(x.tiltX))).toFixed(1)} roll ${Math.max(...fl.map((x) => Math.abs(x.tiltZ))).toFixed(1)} deg, particles peak ${Math.max(...fl.map((x) => x.particles))}, slow-mo ${Math.max(...fl.map((x) => x.slowMo)).toFixed(2)} s, impact fx at +${(fl.findIndex((x) => x.impacts > rows[0].feel.impacts) / 60).toFixed(3)} s`);
}
fs.writeFileSync(OUT + 'rows.json', JSON.stringify(rows));
await browser.close();
