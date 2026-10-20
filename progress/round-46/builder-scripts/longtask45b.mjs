// Round 45 builder: long tasks (>50 ms) from Play for 12 s of flight, production build at the root (PORT, default 5193).
// The first press on the title unlocks the sound (as a player would); the sample sprite loads on the title.
// Also: every request of the load with its size (first-load bytes), and that the audio context is running in flight.
import { chromium, devices } from '@playwright/test';
const PORT = process.env.PORT || '5193'; const MOBILE = !!process.env.MOBILE;
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
const reqs = []; page.on('requestfinished', async (r) => { try { const s = await r.sizes(); reqs.push({ url: r.url().replace(/^https?:\/\/[^/]+/, ''), bytes: s.responseBodySize }); } catch {} });
const failed = []; page.on('requestfailed', (r) => failed.push(r.url()));
await page.addInitScript(() => { window.__lt = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); });
await page.goto(`http://127.0.0.1:${PORT}/?seed=22${process.env.Q || ""}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(3000);
const pre = await page.evaluate(() => ({ audio: window.__THREE_GAME_DIAGNOSTICS__.audio.state, sfx: window.__THREE_GAME_DIAGNOSTICS__.audio.sfx }));
if (MOBILE) await page.touchscreen.tap(300, 200); else await page.keyboard.press('ShiftLeft');
await page.waitForTimeout(1500);
const playAt = await page.evaluate(() => performance.now());
if (MOBILE) { await page.evaluate(() => window.__GAME__.start()); } else await page.keyboard.press('Enter');
await page.waitForTimeout(500);
if (!MOBILE) await page.keyboard.down('KeyW');
else await page.evaluate(() => window.__GAME__.key('KeyW', true));
for (let i = 0; i < 12; i++) { await page.waitForTimeout(1000); if (i % 3 === 0) { if (!MOBILE) await page.keyboard.press('KeyE'); } }
const r = await page.evaluate((p) => ({ lt: window.__lt.filter((x) => x[0] >= p), ltBefore: window.__lt.filter((x) => x[0] < p), audio: window.__THREE_GAME_DIAGNOSTICS__.audio.state, sfx: window.__THREE_GAME_DIAGNOSTICS__.audio.sfx, st: window.__THREE_GAME_DIAGNOSTICS__.state }), playAt);
const total = reqs.reduce((a, b) => a + (b.bytes || 0), 0);
console.log('LONGTASK', MOBILE ? 'mobile' : 'desktop', JSON.stringify({ afterPlay: r.lt, beforePlay: r.ltBefore, audioBeforeGesture: pre.audio, spriteBeforeGesture: pre.sfx && pre.sfx.sprite, audioInFlight: r.audio, sfx: r.sfx, state: r.st }));
console.log('LOAD', JSON.stringify({ requests: reqs.length, bytes: total, mb: +(total / 1048576).toFixed(2), audio: reqs.filter((x) => x.url.includes('audio')), failed }));
console.log('ERRORS', JSON.stringify(errors));
await browser.close();
