// Round 18 critic (new): real-time frame times while flying through features. Seed 44840, real rAF loop (no external clock).
// Places the drone at the mouth of 2 tunnels, 2 alleys and on a boulevard, holds W for 2.5 s in each (12.5 s of flight),
// and records requestAnimationFrame intervals. Desktop 1280x720 or MOBILE=1 (iPhone 13 landscape).
import { chromium, devices } from '@playwright/test';
const MOBILE = !!process.env.MOBILE;
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } })).newPage();
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://127.0.0.1:5190/?seed=44840', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
await page.evaluate(() => window.__GAME__.start()); await page.waitForTimeout(500);
const spots = await page.evaluate(() => { const g = window.__GAME__; const fs = g.features(); const out = [];
  for (const kind of ['tunnel', 'alley']) for (const f of fs.filter((q) => q.kind === kind).slice(0, 2)) { const rz = g.streetRoute({ x: f.x, z: f.z - 22 }, { x: f.x, z: f.z + 22 }, true); const axis = rz.names.includes(f.name) && rz.length < 50 ? 'z' : 'x'; out.push({ kind, x: axis === 'x' ? f.x - 26 : f.x, z: axis === 'z' ? f.z - 26 : f.z, yaw: axis === 'z' ? Math.PI : -Math.PI / 2, y: kind === 'tunnel' ? 3.5 : 5 }); }
  const d = fs.find((q) => q.kind === 'diagonal'); out.push({ kind: 'diagonal', x: d.x, z: d.z, yaw: 0, y: 6 }); return out; });
await page.evaluate(() => { window.__ft = []; let last = performance.now(); const f = (t) => { window.__ft.push(t - last); last = t; window.__raf = requestAnimationFrame(f); }; window.__raf = requestAnimationFrame(f); });
for (const s of spots) {
  await page.evaluate((s) => window.__GAME__.place(s.x, s.y, s.z, s.yaw, 12), s);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(2500); await page.keyboard.up('KeyW');
}
const ft = await page.evaluate(() => { cancelAnimationFrame(window.__raf); return window.__ft.slice(2); });
const s = [...ft].sort((a, b) => a - b); const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
const d = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
console.log('PERF ' + JSON.stringify({ mobile: MOBILE, spots: spots.map((x) => x.kind), seconds: +(ft.reduce((a, b) => a + b, 0) / 1000).toFixed(1), frames: ft.length, median: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), max: +s[s.length - 1].toFixed(1), over20: ft.filter((x) => x > 20).length, calls: d.renderer.calls, tris: d.renderer.triangles, crashes: d.crashes, errors }));
await browser.close();
