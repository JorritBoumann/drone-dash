// Round 38 critic (new): records a gameplay video for the gemini review. Real-time play, driven by video-pilot38.js
// (in-page, per frame). Frames come from a CDP screencast (JPEG, with timestamps) and are saved to FRAMES; encode38.mjs
// turns them into a 30 fps WebM. Also saves PNG stills at chosen moments (SHOTS). Env: PORT (5190), SEED (130),
// MOBILE=1 (iPhone 13 landscape), TAG, MAXT (s of play, 80), AFTER (s to keep after the medal, 4).
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
const S = '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/c38/';
const PORT = process.env.PORT || '5190'; const SEED = process.env.SEED || '130'; const MOBILE = !!process.env.MOBILE;
const TAG = process.env.TAG || (MOBILE ? 'phone' : 'desktop'); const MAXT = Number(process.env.MAXT || 80); const AFTER = Number(process.env.AFTER || 4);
const FR = S + `frames-${TAG}/`; fs.rmSync(FR, { recursive: true, force: true }); fs.mkdirSync(FR, { recursive: true });
const SHOTS = process.env.SHOTDIR || S + 'shots/'; const STILLS = !!process.env.STILLS;
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
await page.addInitScript({ path: new URL('./video-pilot38.js', import.meta.url).pathname });
await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__GAME__ && window.__GAME__.assetsReady().on, null, { timeout: 30000 });
await page.waitForTimeout(1500);
const cdp = await ctx.newCDPSession(page); const frames = [];
cdp.on('Page.screencastFrame', async (f) => {
  const n = frames.length; fs.writeFileSync(FR + String(n).padStart(5, '0') + '.jpg', Buffer.from(f.data, 'base64'));
  frames.push(f.metadata.timestamp); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
});
const vw = MOBILE ? 1500 : 1280, vh = MOBILE ? 684 : 720;
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: vw, maxHeight: vh, everyNthFrame: 1 });
const tRec = Date.now() / 1000; const marks = [{ t: 0, k: 'title' }];
await page.waitForTimeout(2200);
await page.keyboard.press('Enter'); marks.push({ t: +(Date.now() / 1000 - tRec).toFixed(2), k: 'enter' });
await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'playing', null, { timeout: 10000 });
const tPlay = Date.now() / 1000; marks.push({ t: +(tPlay - tRec).toFixed(2), k: 'playing' });
await page.evaluate((touch) => window.__AP.start({ touch }), MOBILE);
let medalAt = null, shot = 0, pickAt = null, delivAt = null; const fps = [];
while (true) {
  await page.waitForTimeout(250);
  const st = await page.evaluate(() => ({ log: window.__AP.log, on: window.__AP.on, d: (() => { const d = window.__THREE_GAME_DIAGNOSTICS__; return { state: d.state, score: d.score, fps: d.fps, slip: d.slipstream && { chain: d.slipstream.chain, payouts: d.slipstream.payouts } }; })() }));
  const now = Date.now() / 1000 - tPlay; fps.push(st.d.fps);
  const m = st.log.filter((e) => e.k === 'deliver')[1]; if (m && medalAt === null) medalAt = now; // stop AFTER s after the second delivery
  const pk = st.log.find((e) => e.k === 'pickup'); if (pk && pickAt === null) pickAt = now;
  // a mid-flight still: 5 s after the first pickup (flying the street with the parcel)
  if (STILLS && pickAt !== null && shot === 0 && now > pickAt + 5) { shot = 1; await page.screenshot({ path: SHOTS + `media-${TAG}-midflight.png` }); marks.push({ t: +(Date.now() / 1000 - tRec).toFixed(2), k: 'still-midflight' }); }
  const dv = st.log.find((e) => e.k === 'deliver'); if (dv && delivAt === null) { delivAt = now; if (STILLS) { await page.waitForTimeout(450); await page.screenshot({ path: SHOTS + `media-${TAG}-delivery.png` }); marks.push({ t: +(Date.now() / 1000 - tRec).toFixed(2), k: 'still-delivery' }); } }
  if (st.d.state !== 'playing' || !st.on || now > MAXT || (medalAt !== null && now > medalAt + AFTER)) break;
}
await page.waitForTimeout(300);
await cdp.send('Page.stopScreencast');
const log = await page.evaluate(() => window.__AP.log);
await page.evaluate(() => window.__AP.stop && window.__AP.stop());
fs.writeFileSync(FR + 'frames.json', JSON.stringify({ tRec, tPlay, frames, marks, log }));
console.log('VIDEO', TAG, JSON.stringify({ frames: frames.length, span: +(frames[frames.length - 1] - frames[0]).toFixed(1), playOffset: +(tPlay - tRec).toFixed(2), marks, log, fpsMed: fps.sort((a, b) => a - b)[fps.length >> 1], errs: errs.slice(0, 3) }));
await browser.close();
