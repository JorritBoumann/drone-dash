// Round 34 builder (new): first load of a production build under `vite preview`. Fresh context per run (empty cache).
// Logs: bytes transferred (all, and JS), the load event, time until the Play button shows and the game hooks exist, the
// JS chunks fetched, then presses Play and logs main-thread long tasks for 4 s after it. PORTS (default 4193,4194), RUNS.
import { chromium } from '@playwright/test';
const PORTS = (process.env.PORTS || '4193,4194').split(','); const RUNS = Number(process.env.RUNS || 3);
const browser = await chromium.launch({ channel: 'chromium' });
for (const PORT of PORTS) for (let run = 0; run < RUNS; run++) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.__lt = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch {} });
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${PORT}/?seed=22`, { waitUntil: 'load' });
  const tLoad = Date.now() - t0;
  await page.waitForFunction(() => { const b = document.getElementById('play-button'); return !!window.__GAME__ && b && b.offsetParent && getComputedStyle(document.getElementById('app')).visibility === 'visible'; }, null, { timeout: 30000 });
  const tReady = Date.now() - t0;
  await page.waitForLoadState('networkidle');
  const res = await page.evaluate(() => performance.getEntriesByType('resource').map((r) => [r.name.split('/').pop(), r.transferSize, r.initiatorType]));
  const nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return { html: n.transferSize, dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) }; });
  const all = res.reduce((a, r) => a + r[1], 0) + nav.html; const js = res.filter((r) => /\.js/.test(r[0])).reduce((a, r) => a + r[1], 0);
  const ltBefore = await page.evaluate(() => window.__lt.length);
  const tPlay = await page.evaluate(() => performance.now());
  await page.keyboard.press('Enter'); await page.waitForTimeout(4000);
  const lt = await page.evaluate((t) => window.__lt.filter((e) => e[0] >= t), tPlay);
  console.log('LOAD', PORT, 'run', run + 1, JSON.stringify({ bytesMB: +(all / 1e6).toFixed(2), jsKB: Math.round(js / 1000), dcl: nav.dcl, loadEvent: nav.load, wallLoad: tLoad, playReady: tReady, longTasksBeforePlay: ltBefore, longTasksAfterPlay: lt, state: await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.state), chunks: res.filter((r) => /\.js/.test(r[0])).map((r) => r[0] + ':' + Math.round(r[1] / 1000) + 'k') }));
  await ctx.close();
}
await browser.close();
