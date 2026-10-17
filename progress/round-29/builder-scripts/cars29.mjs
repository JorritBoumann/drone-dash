// Round 29 builder: wheels. Side views (6 m and 30 m) of each vehicle type, then a 3.5 m view of one moving car's front
// wheel in two frames 0.06 s apart (the rim holes turn), and a car mid-turn from above-front (front wheels steer).
import { chromium } from '@playwright/test';
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const seed = +(process.env.SEED || 22), Q = process.env.Q || '', PORT = process.env.PORT || '5191', TAG = process.env.TAG || 'car29';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(`http://127.0.0.1:${PORT}/?seed=${seed}${Q}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
await page.evaluate(() => { window.__GAME__.start(); window.__GAME__.manualRender(true); });
if (!Q) await page.waitForFunction(() => window.__GAME__.assetsReady().on, null, { timeout: 30000 });
await page.evaluate(() => { const G = window.__GAME__; G.place(22, 3, 40, 0, 0); G.advance(1 / 20, false); });
const cars = await page.evaluate(() => { const out = {}; for (const c of window.__GAME__.traffic()) if (c.kind === 'car' && c.mode === 'lane' && !out[c.type]) out[c.type] = c; return out; });
const look = (c, d, h, ty, along = 0) => page.evaluate(([c, d, h, ty, along]) => { const G = window.__GAME__; const now = G.traffic().find((q) => Math.hypot(q.x - c.x, q.z - c.z) < 3) || c;
  const sx = -now.fz, sz = now.fx; const px = now.x + sx * d + now.fx * along, pz = now.z + sz * d + now.fz * along; G.place(now.x + sx * (d + 5), 4, now.z + sz * (d + 5), 0, 0); G.advance(1 / 60, false); G.place(now.x + sx * (d + 5), 4, now.z + sz * (d + 5), 0, 0);
  const n2 = G.traffic().find((q) => Math.hypot(q.x - now.x, q.z - now.z) < 3) || now; G.renderFrom(px, h, pz, n2.x + n2.fx * along, ty, n2.z + n2.fz * along); return n2; }, [c, d, h, ty, along]);
for (const [t, c] of Object.entries(cars)) for (const d of [6, 30]) { await look(c, d, 1.6, 0.8); await page.screenshot({ path: OUT + `${TAG}-${Q ? 'old' : 'new'}-${seed}-t${t}-${d}m.jpg`, type: 'jpeg', quality: 80 }); }
// spin: a moving car, front wheel close up, two frames
const mov = await page.evaluate(() => window.__GAME__.traffic().find((c) => c.kind === 'car' && c.mode === 'lane' && c.type <= 2 && Math.abs(c.x) < 120 && Math.abs(c.z) < 120));
if (mov) for (let k = 0; k < 2; k++) { const n = await look(mov, 3.2, 0.55, 0.32, 1.15); mov.x = n.x; mov.z = n.z; await page.screenshot({ path: OUT + `${TAG}-spin-f${k}.jpg`, type: 'jpeg', quality: 85 }); await page.evaluate(() => window.__GAME__.advance(0.06, false)); }
// steer: find a car mid-turn, view from in front and above
for (let i = 0; i < 80; i++) { const turn = await page.evaluate(() => window.__GAME__.traffic().find((c) => c.kind === 'car' && c.mode === 'turn' && c.type <= 2));
  if (turn) { await page.evaluate((c) => { const G = window.__GAME__; G.place(c.x + c.fx * 9, 6, c.z + c.fz * 9, 0, 0); G.renderFrom(c.x + c.fx * 4.5 - c.fz * 1.5, 2.6, c.z + c.fz * 4.5 + c.fx * 1.5, c.x + c.fx * 1.2, 0.3, c.z + c.fz * 1.2); }, turn); await page.screenshot({ path: OUT + `${TAG}-steer.jpg`, type: 'jpeg', quality: 85 }); break; }
  await page.evaluate(() => window.__GAME__.advance(0.25, false)); }
console.log('CARS', Object.keys(cars).join(','));
await browser.close();
