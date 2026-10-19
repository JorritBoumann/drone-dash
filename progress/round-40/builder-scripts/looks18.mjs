// Round 18 critic (new): what a player sees. (1) N fresh loads (no ?seed): title shot, then 4 s of straight flight; logs the
// feature counts. (2) On SEED: fly straight through a tunnel and an alley (place at the mouth, hold W), screenshots
// entering / inside / leaving, camera height vs the drone; desktop or MOBILE=1 (iPhone 13 landscape, touch).
// (3) Rush hour: hover over a rush lane, shots at 55 s and 66 s. Deterministic (advance) except the fresh loads' title shot.
import { chromium, devices } from '@playwright/test';
const OUT = (process.env.OUTDIR || new URL('../critic/', import.meta.url).pathname);
const MOBILE = !!process.env.MOBILE; const tag = MOBILE ? 'm' : 'd'; const N = Number(process.env.N || 0); const SEED = process.env.SEED || '44840';
const browser = await chromium.launch({ channel: 'chromium' });
const ctxOpts = MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } };
const shot = async (page, name) => { await page.evaluate(() => window.__GAME__.advance(0.0001, true)); await page.screenshot({ path: OUT + name + '.jpg', type: 'jpeg', quality: 80 }); };
for (let i = 0; i < N; i++) {
  const page = await (await browser.newContext(ctxOpts)).newPage();
  await page.goto('http://127.0.0.1:5190/', { waitUntil: 'networkidle' }); await page.waitForTimeout(900);
  const c = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.city);
  await page.screenshot({ path: OUT + `L-${tag}-load${i + 1}-seed${c.seed}-title.jpg`, type: 'jpeg', quality: 80 });
  await page.evaluate(() => { window.__GAME__.externalClock(true); window.__GAME__.start(); window.__GAME__.manualRender(true); window.__GAME__.key('KeyW', true); window.__GAME__.key('Space', true); window.__GAME__.advance(1.2, false); window.__GAME__.key('Space', false); window.__GAME__.advance(3, false); });
  await shot(page, `L-${tag}-load${i + 1}-seed${c.seed}-fly4s`);
  console.log('LOAD ' + JSON.stringify({ i: i + 1, seed: c.seed, mood: c.mood, features: c.features }));
  await page.close();
}
if (process.env.FLY) {
  const page = await (await browser.newContext(ctxOpts)).newPage();
  await page.goto('http://127.0.0.1:5190/?seed=' + SEED, { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
  await page.evaluate(() => { window.__GAME__.externalClock(true); window.__GAME__.start(); window.__GAME__.manualRender(true); });
  const feats = await page.evaluate(() => { const g = window.__GAME__; return g.features().filter((f) => f.kind !== 'diagonal').map((f) => { const rz = g.streetRoute({ x: f.x, z: f.z - 22 }, { x: f.x, z: f.z + 22 }, true); return { ...f, axis: rz.names.includes(f.name) && rz.length < 50 ? 'z' : 'x' }; }); });
  for (const kind of ['tunnel', 'alley']) {
    const f = feats.find((q) => q.kind === kind); if (!f) continue;
    const Y = kind === 'tunnel' ? 3.5 : 5;
    const sx = f.axis === 'x' ? f.x - 30 : f.x, sz = f.axis === 'z' ? f.z - 30 : f.z, yaw = f.axis === 'z' ? Math.PI : -Math.PI / 2;
    await page.evaluate(([sx, sz, yaw, Y]) => { const g = window.__GAME__; g.place(sx, Y, sz, yaw, 12); g.advance(0.6, false); g.key('KeyW', true); }, [sx, sz, yaw, Y]);
    const log = [];
    for (const [t, lbl] of [[0.4, 'enter'], [0.9, 'inside'], [1.6, 'leave']]) {
      const d = await page.evaluate((t) => window.__GAME__.advance(t, false), t === 0.4 ? 0.4 : t === 0.9 ? 0.5 : 0.7);
      log.push({ lbl, y: +d.player.position.y.toFixed(1), camY: +d.camera.y.toFixed(1), camDist: +Math.hypot(d.camera.x - d.player.position.x, d.camera.z - d.player.position.z).toFixed(1), sp: +d.player.speed.toFixed(1), crashes: d.crashes });
      await shot(page, `F-${tag}-seed${SEED}-${kind}-${lbl}`);
    }
    await page.evaluate(() => window.__GAME__.key('KeyW', false));
    console.log('FLY ' + JSON.stringify({ kind, name: f.name, axis: f.axis, log }));
  }
  // rush hour: hover above a rush lane and compare 55 s and 66 s
  const lane = await page.evaluate(() => window.__GAME__.rushLanes()[0]);
  await page.evaluate(() => { window.__GAME__.tune({ RUN: { startTime: 120 } }); window.__GAME__.restart(); window.__GAME__.externalClock(true); window.__GAME__.start(); window.__GAME__.manualRender(true); });
  const px = lane.axis === 0 ? 0 : lane.at + 9, pz = lane.axis === 0 ? lane.at + 9 : 0;
  for (const [until, lbl] of [[55, 'before'], [66, 'after']]) {
    const d = await page.evaluate(([px, pz, until]) => { const g = window.__GAME__; let d = g.diagnostics(); let guard = 0; while ((d.elapsed ?? 0) < until && guard++ < 2000) { g.place(px, 14, pz, Math.PI / 2, 0); d = g.advance(0.25, false); if (d.state !== 'playing') break; } return d; }, [px, pz, until]);
    await shot(page, `R-${tag}-seed${SEED}-rush-${lbl}`);
    console.log('RUSH ' + JSON.stringify({ lbl, elapsed: d.elapsed, state: d.state, rushLanes: d.city?.rushLanes, esc: d.escalation ? { on: d.escalation.on, stage: d.escalation.stage } : null, timeLeft: d.timeLeft }));
  }
}
await browser.close();
