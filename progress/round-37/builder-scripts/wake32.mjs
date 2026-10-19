// Round 32 critic (new): screenshots of wakes looking toward a low sun (golden hour 130, dusk 33), plus harbour-bus scale
// views (alongside the pier, from the promenade game camera, beside the marina boats). Fixed step, manualRender.
import { chromium } from '@playwright/test';
const OUT = (process.env.OUTDIR || new URL('../critic/', import.meta.url).pathname);
const SUN = { 130: [-0.72, 0.34, -0.6], 33: [0.78, 0.24, 0.58], 22: [0.55, 0.62, -0.56] };
const browser = await chromium.launch({ channel: 'chromium' });
for (const SEED of (process.env.SEEDS || '130,33,22').split(',').map(Number)) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto(`http://127.0.0.1:5190/?seed=${SEED}&post=1`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
  await page.waitForFunction(() => window.__GAME__.assetsReady().on, null, { timeout: 30000 });
  await page.evaluate(() => { window.__GAME__.advance(3, true); window.__GAME__.hideDebugUi?.(true); }); await page.waitForTimeout(3000); await page.evaluate(() => window.__GAME__.advance(0.5, true));
  const sd = SUN[SEED]; const h = Math.hypot(sd[0], sd[2]); const sx = sd[0] / h, sz = sd[2] / h;
  for (const kind of ['rib', 'ferry', 'sail']) {
    const info = await page.evaluate(([kind, sx, sz]) => {
      const G = window.__GAME__; let b = G.boats().find((q) => q.kind === kind && q.moving); let g = 0;
      while (b.speed < 2 && g++ < 200) { G.advance(0.5, false); b = G.boats().find((q) => q.kind === kind && q.moving); }
      const D = kind === 'ferry' ? 42 : 26, up = kind === 'ferry' ? 16 : 11;
      // camera on the far side from the sun, a little behind the boat, looking toward the sun over the boat
      const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
      const cam = [b.x - sx * D - fx * 8, up, b.z - sz * D - fz * 8];
      G.advance(1 / 60, false); G.renderFrom(cam[0], cam[1], cam[2], b.x + sx * 10, -0.7, b.z + sz * 10);
      return { speed: b.speed, x: b.x, z: b.z };
    }, [kind, sx, sz]);
    await page.screenshot({ path: OUT + `wake32-${SEED}-sunward-${kind}.jpg`, type: 'jpeg', quality: 80 });
    console.log('WAKESHOT', SEED, kind, JSON.stringify(info));
  }
  if (SEED === 22 || SEED === 130) {
    // harbour bus scale: a moving bus from the promenade (game camera at 6 m on the wall), and the bus at its pier
    const r = await page.evaluate(() => {
      const G = window.__GAME__; let b = G.boats().find((q) => q.kind === 'ferry'); let g = 0;
      while ((b.speed < 2 || Math.abs(Math.abs(b.x) - 183) > 1 && Math.abs(Math.abs(b.z) - 183) > 1) && g++ < 400) { G.advance(0.25, false); b = G.boats().find((q) => q.kind === 'ferry'); }
      return b;
    });
    // drone on the wall side, 10 m inside the bus lane, facing the bus
    await page.evaluate((b) => { const G = window.__GAME__; const onX = Math.abs(Math.abs(b.x) - 183) < 1; const px = onX ? Math.sign(b.x) * 162 : b.x + Math.sin(b.yaw) * 14; const pz = onX ? b.z + Math.cos(b.yaw) * 14 : Math.sign(b.z) * 162; const yaw = onX ? (b.x > 0 ? -Math.PI / 2 : Math.PI / 2) : (b.z > 0 ? Math.PI : 0); for (let i = 0; i < 30; i++) { G.place(px, 5, pz, yaw, 0); G.advance(1 / 60, false); } G.advance(1 / 60, true); }, r);
    await page.screenshot({ path: OUT + `bus32-${SEED}-from-promenade.jpg`, type: 'jpeg', quality: 80 });
    // run until the bus reaches its first stop, then frame it beside the pier
    const st = await page.evaluate(() => { const G = window.__GAME__; let t = 0; let b; for (; t < 400; t += 0.5) { G.advance(0.5, false); b = G.boats().find((q) => q.kind === 'ferry'); if (b.speed < 0.01) break; } G.advance(4, false); b = G.boats().find((q) => q.kind === 'ferry'); return { t, x: b.x, z: b.z, speed: b.speed }; });
    await page.evaluate((b) => { const G = window.__GAME__; G.advance(1 / 60, false); G.renderFrom(b.x + 22, 9, b.z - Math.sign(b.z) * 26, b.x, 0, b.z); }, st);
    await page.screenshot({ path: OUT + `bus32-${SEED}-at-pier.jpg`, type: 'jpeg', quality: 80 });
    const later = await page.evaluate(() => { const G = window.__GAME__; G.advance(60, false); const b = G.boats().find((q) => q.kind === 'ferry'); return { x: b.x, z: b.z, speed: b.speed }; });
    console.log('BUSSTOP', SEED, JSON.stringify(st), 'after 60 s more', JSON.stringify(later));
    await page.evaluate(() => { const G = window.__GAME__; for (let i = 0; i < 30; i++) { G.place(-30, 4, 150, Math.PI, 0); G.advance(1 / 60, false); } G.advance(1 / 60, true); });
    await page.screenshot({ path: OUT + `bus32-${SEED}-marina-game-cam.jpg`, type: 'jpeg', quality: 80 });
  }
  await page.close();
}
await browser.close();
