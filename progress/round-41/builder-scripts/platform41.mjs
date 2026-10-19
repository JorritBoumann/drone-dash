// Round 41 builder: Stateloop platform checks on the production build.
// Nested path (5291 /nested/game/) inside a cross-origin iframe (host 5292). Mock StateloopSession, CustomEvent, Escape,
// unknown query keys, seed parsing, failed requests. Usage: node platform41.mjs [shotdir]
import { chromium } from '@playwright/test';
const SHOTS = process.argv[2] || 'progress/round-41/builder-shots';
const HOST = 'http://127.0.0.1:5292/', GAME = 'http://127.0.0.1:5291/nested/game/';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const out = {};
async function session(mock, query, viewport = { width: 1280, height: 720 }) {
  const ctx = await browser.newContext({ viewport });
  if (mock) await ctx.addInitScript(() => {
    if (!location.port.endsWith('5291')) return;
    window.__slCalls = [];
    window.StateloopSession = { complete: (d) => { window.__slCalls.push(JSON.parse(JSON.stringify(d))); } };
  });
  await ctx.addInitScript(() => {
    if (!location.port.endsWith('5291')) return;
    window.__slEvents = [];
    window.addEventListener('stateloop:session-complete', (e) => window.__slEvents.push(e.detail));
    window.__esc = [];
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setTimeout(() => window.__esc.push({ prevented: e.defaultPrevented }), 0); });
  });
  const page = await ctx.newPage();
  const failed = [], errors = [], reqs = [];
  page.on('requestfailed', (r) => failed.push(`${r.url()} ${r.failure()?.errorText}`));
  page.on('response', (r) => { reqs.push(r.url()); if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(HOST + query, { waitUntil: 'load' });
  const frame = await (await page.waitForSelector('iframe')).contentFrame();
  await frame.waitForFunction(() => window.__GAME__ && window.__THREE_GAME_DIAGNOSTICS__, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  return { ctx, page, frame, failed, errors, reqs };
}
// 1. mock bridge, platform flags and unknown keys
{
  const s = await session(true, '?seed=22&slLaunch=1&slSession=abc123&cfg=%7B%22x%22%3A1%7D&utm_source=test&debugx');
  const f = s.frame;
  out.loadSeed = await f.evaluate(() => window.__GAME__.session());
  out.hud = await f.evaluate(() => window.__GAME__.canvasHud().on);
  out.origin = await f.evaluate(() => location.href);
  // play by keyboard inside the iframe: click the Play button, fly 4 s, Escape pauses, Escape resumes
  await f.click('#play-button');
  await s.page.waitForTimeout(500);
  await s.page.keyboard.down('KeyW'); await s.page.waitForTimeout(4000); await s.page.keyboard.up('KeyW');
  const d0 = await f.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
  out.flew = { state: d0.state, speed: d0.player?.speed, runTime: d0.feel?.runTime };
  await s.page.keyboard.press('Escape'); await s.page.waitForTimeout(300);
  out.escPause = await f.evaluate(() => window.__GAME__.state);
  await s.page.keyboard.press('Escape'); await s.page.waitForTimeout(300);
  out.escResume = await f.evaluate(() => window.__GAME__.state);
  out.escEvents = await f.evaluate(() => window.__esc);
  await s.page.screenshot({ path: `${SHOTS}/iframe-nested-desktop.jpg`, type: 'jpeg', quality: 70 });
  // natural end: run 1 to time-up (fixed steps), then end hook twice more (must not report again)
  await f.evaluate(() => { window.__GAME__.manualRender(true); window.__GAME__.advance(90, true); });
  out.afterRun1 = await f.evaluate(() => ({ state: window.__GAME__.state, calls: window.__slCalls.length, events: window.__slEvents.length, last: window.__slCalls.at(-1), ev: window.__slEvents.at(-1) }));
  await f.evaluate(() => { window.__GAME__.end(); window.__GAME__.end(); });
  out.afterExtraEnd = await f.evaluate(() => ({ calls: window.__slCalls.length, events: window.__slEvents.length }));
  // run 2 ends by the end hook (quit)
  await f.evaluate(() => { window.__GAME__.start(); window.__GAME__.advance(5, true); window.__GAME__.end(); });
  out.afterRun2 = await f.evaluate(() => ({ calls: window.__slCalls.length, events: window.__slEvents.length, last: window.__slCalls.at(-1), same: JSON.stringify(window.__slCalls.at(-1)) === JSON.stringify(window.__slEvents.at(-1)) }));
  out.failed1 = s.failed; out.errors1 = s.errors; out.requests1 = s.reqs.length;
  out.assetReqs = s.reqs.filter((u) => /\.(glb|webp|png|jpg|ktx2|woff2?)$/.test(u)).map((u) => u.replace(/^https?:\/\/[^/]+/, ''));
  await s.ctx.close();
}
// 2. no mock: no error, event still fires once, HTML HUD by default (no slLaunch)
{
  const s = await session(false, '?seed=58&foo=1&bar');
  const f = s.frame;
  out.noMock = await f.evaluate(() => { const G = window.__GAME__; G.start(); G.manualRender(true); G.advance(90, true); return { state: G.state, events: window.__slEvents.length, session: G.session(), hud: G.canvasHud().on }; });
  out.failed2 = s.failed; out.errors2 = s.errors;
  await s.ctx.close();
}
// 3. seed parsing
{
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  out.seeds = [];
  for (const q of ['?seed=22', '?seed=22&seed=99', '?seed=9f86d081-884c-4d63', '?seed=9f86d081-884c-4d63', '?seed=123456789012345678901', '?seed=', '?seed=-7', '?seed=%20130%20']) {
    await page.goto(GAME + 'index.html' + q, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__GAME__, null, { timeout: 30000 });
    const r = await page.evaluate(() => { const G = window.__GAME__; G.manualRender(true); G.start(); G.advance(1, false); const d = window.__THREE_GAME_DIAGNOSTICS__; return { ...G.session(), target: d.objective?.name ?? d.delivery?.target ?? null }; });
    out.seeds.push({ q, seed: r.seed, mode: r.mode });
  }
  out.seedErrors = errors;
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
