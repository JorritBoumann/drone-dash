// Round 37 critic (new): game-camera water views for the player-look sweep. Per seed (mood): drone at 1, 4, 15 and 24 m,
// in open sea (x 182, facing +x away from the city) and by the marina (x -44, z 150, facing the moored boats), plus a
// 1 m view facing the sun. Deterministic: manualRender + advance (same set-up as water31.mjs).
// Env: PORT (5191), TAG (r37), SEEDS (130,22,33,58), MOBILE=1, OUTDIR, ALTS (1,4,15,24), PLACES (sea,marina,sun)
import { chromium, devices } from '@playwright/test';
const OUT = process.env.OUTDIR || '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/r38/shots/';
const PORT = process.env.PORT || '5190'; const TAG = process.env.TAG || 'r37';
const MOBILE = !!process.env.MOBILE; const SEEDS = (process.env.SEEDS || '130,22,33,58').split(',').map(Number);
const ALTS = (process.env.ALTS || '1,4,15,24').split(',').map(Number); const PLACES = (process.env.PLACES || 'sea,marina,sun').split(',');
const MOOD = { 130: 'golden', 22: 'morning', 33: 'dusk', 58: 'noon' };
const SUN = { 130: [-0.72, 0.34, -0.6], 22: [0.55, 0.62, -0.56], 33: [0.78, 0.24, 0.58], 58: [-0.35, 0.72, 0.6] };
const browser = await chromium.launch({ channel: 'chromium' });
for (const SEED of SEEDS) {
  const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}${MOBILE ? '' : '&post=1'}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
  await page.waitForFunction(() => window.__GAME__.assetsReady().on, null, { timeout: 30000 });
  await page.evaluate(() => { const G = window.__GAME__; G.advance(3, false); G.hideDebugUi?.(true); });
  await page.waitForTimeout(2500); // the title card fades out in real time
  const sd = SUN[SEED]; const sunYaw = Math.atan2(-sd[0], -sd[2]); // forward = (-sin yaw, -cos yaw) toward the sun
  // marina: 11 m out from a moored boat, on the side away from the city centre, facing the boat
  const boats = await page.evaluate(() => window.__GAME__.boats());
  const mb = boats.filter((b) => !b.moving).sort((a, b) => Math.hypot(b.x, b.z) - Math.hypot(a.x, a.z))[0];
  const ml = Math.hypot(mb.x, mb.z), ox = mb.x / ml, oz = mb.z / ml;
  const sl = Math.hypot(sd[0], sd[2]), ux = sd[0] / sl, uz = sd[2] / sl, R = 205 / Math.max(Math.abs(ux), Math.abs(uz));
  const places = { sea: [[182, 20], -Math.PI / 2], marina: [[mb.x + ox * 11, mb.z + oz * 11], Math.atan2(ox, oz)], sun: [[ux * R, uz * R], sunYaw] };
  for (const pl of PLACES) for (const alt of (pl === 'sun' ? [1] : ALTS)) {
    const [[x, z], yaw] = places[pl];
    await page.evaluate(([x, y, z, yaw]) => { const G = window.__GAME__; for (let i = 0; i < 40; i++) { G.place(x, y, z, yaw, 0); G.advance(1 / 60, false); } G.advance(1 / 60, true); }, [x, alt, z, yaw]);
    await page.screenshot({ path: OUT + `w37-${TAG}${MOBILE ? '-m' : ''}-${MOOD[SEED]}-${pl}-${alt}m.jpg`, type: 'jpeg', quality: 80 });
  }
  console.log('DONE', SEED, errs.slice(0, 3));
  await ctx.close();
}
await browser.close();
