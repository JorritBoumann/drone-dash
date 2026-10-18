// Round 29 critic (new): desktop hover and cruise framing, round 29 (port 5191) against round 28 (port 5192, scratchpad copy
// of commit 0a60215). Deterministic (manualRender, 30 Hz steps, real game keys). Seed 22, drone at 6 m on an avenue.
// Per build: hover 3 s (no keys), then W for 3 s, then W+E (boost) 2 s. Logs drone box height / screen height and camera
// distance; screenshots each phase with the HUD on.
import { chromium } from '@playwright/test';
const OUT = (process.env.OUTDIR || new URL('../critic/', import.meta.url).pathname);
const PORTS = (process.env.PORTS || '5191,5192').split(',');
const browser = await chromium.launch({ channel: 'chromium' });
for (const port of PORTS) {
  const tag = port === '5191' ? 'r29' : 'r28';
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.addInitScript(() => { try { localStorage.setItem('drone-dash-played-v1', '1'); } catch {} });
  await page.goto(`http://127.0.0.1:${port}/?seed=22`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 999 } }); G.manualRender(true); });
  await page.waitForFunction(() => window.__GAME__.assetsReady().on, null, { timeout: 30000 }).catch(() => {});
  const m = () => page.evaluate(() => { const G = window.__GAME__, d = window.__THREE_GAME_DIAGNOSTICS__; const b = G.droneBox(); const p = d.player.position, c = d.camera;
    return { hf: +(b.h / innerHeight).toFixed(3), wf: +(b.w / innerWidth).toFixed(3), L: +Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z).toFixed(2), camUp: +(c.y - p.y).toFixed(2), spd: +d.player.speed.toFixed(1) }; });
  const steps = (n) => page.evaluate((n) => { for (let i = 0; i < n; i++) window.__GAME__.advance(1 / 30, true); }, n);
  await page.evaluate(() => { const G = window.__GAME__; G.place(22, 6, 60, Math.PI, 0); });
  await steps(90); const hover = await m(); await page.screenshot({ path: OUT + `hover29-${tag}-hover.jpg`, type: 'jpeg', quality: 80 });
  await page.keyboard.down('KeyW');
  const cruise = []; for (let i = 0; i < 6; i++) { await steps(15); cruise.push(await m()); }
  await page.screenshot({ path: OUT + `hover29-${tag}-cruise.jpg`, type: 'jpeg', quality: 80 });
  await page.keyboard.down('KeyE');
  const boost = []; for (let i = 0; i < 4; i++) { await steps(15); boost.push(await m()); }
  await page.screenshot({ path: OUT + `hover29-${tag}-boost.jpg`, type: 'jpeg', quality: 80 });
  await page.keyboard.up('KeyE'); await page.keyboard.up('KeyW');
  console.log('FRAMING', tag, JSON.stringify({ hover, cruise, boost }));
  await page.context().close();
}
await browser.close();
