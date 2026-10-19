// Round 27 critic (new): distance from the spawn to the first pickup (straight and street route) on a first run, seeds from SEEDS.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' }); const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
for (const s of (process.env.SEEDS || '22,58,130').split(',')) {
  await page.goto('http://127.0.0.1:5191/?seed=' + s, { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
  const r = await page.evaluate(() => { const G = window.__GAME__; G.start(); G.manualRender(true); G.externalClock(true); const d = G.advance(0.05, false); const p = d.player.position, o = d.objective.position;
    const rt = G.streetRoute({ x: p.x, z: p.z }, { x: o.x, z: o.z }); let L = null; try { const pts = rt.points || rt.path || rt; if (Array.isArray(pts)) { L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); } else if (rt && rt.length) L = rt.length; } catch (e) {}
    return { straight: +Math.hypot(o.x - p.x, o.z - p.z).toFixed(0), route: L === null ? JSON.stringify(rt).slice(0, 120) : +L.toFixed(0), oy: +o.y.toFixed(1), name: d.objective.name }; });
  console.log('FIRSTLEG', s, JSON.stringify(r));
}
await browser.close();
