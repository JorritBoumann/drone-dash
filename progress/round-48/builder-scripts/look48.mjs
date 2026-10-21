// Round 48 builder: quick look at the rings and the HUD. Starts a run on SEED, puts the drone 40 m before the first ring
// facing it, flies a little and saves a screenshot. DEV=desktop|phone, Q extra query (e.g. &hud=canvas).
import { chromium, devices } from 'playwright';
const PORT = process.env.PORT || '5391', SEED = process.env.SEED || '130', DEV = process.env.DEV || 'desktop';
const OUT = process.env.OUT || new URL('../shots/', import.meta.url).pathname;
const browser = await chromium.launch();
const ctx = await browser.newContext(DEV === 'phone' ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.addInitScript(() => { try { localStorage.setItem('drone-dash-played-v1', '1'); } catch {} });
await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}${process.env.Q || ''}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__GAME__ && window.__THREE_GAME_DIAGNOSTICS__);
await page.waitForTimeout(1500);
const info = await page.evaluate(async (back) => {
  const G = window.__GAME__; G.start();
  await new Promise((r) => setTimeout(r, 400));
  const d = window.__THREE_GAME_DIAGNOSTICS__;
  const r = d.rings[0];
  if (!r) return { rings: 0 };
  const yaw = Math.atan2(-r.dx, -r.dz); // forward (-sin yaw, -cos yaw) = (dx, dz)
  G.place(r.x - r.dx * back, r.y + 0.3, r.z - r.dz * back, yaw, 0);
  return { rings: d.rings.length, r };
}, Number(process.env.BACK || 40));
await page.waitForTimeout(Number(process.env.WAIT || 900));
await page.screenshot({ path: OUT + (process.env.NAME || `ring-${DEV}-s${SEED}.jpg`), type: 'jpeg', quality: 85 });
console.log(JSON.stringify({ info, errors }));
await browser.close();
