// Round 34 critic (new): cold load of a build (PORT, default 5193 = production preview). Fresh context per run.
// Logs ms from navigation start to: title + Play button on screen (styled), window.__GAME__ ready, street assets on
// (assetsReady().on); bytes transferred (resource timing, encoded) at Play-ready and at 8 s; then presses Play (Enter /
// CDP tap), holds forward 4 s and logs long tasks after Play, rAF max, and shader programs compiled after Play.
import { chromium, devices } from '@playwright/test';
const PORT = process.env.PORT || '5193', RUNS = Number(process.env.RUNS || 2), DEVS = (process.env.DEVS || 'desktop,iphone').split(',');
const browser = await chromium.launch({ channel: 'chromium' });
for (const dev of DEVS) for (let run = 1; run <= RUNS; run++) {
  const ctx = await browser.newContext(dev === 'iphone' ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__lt = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([+e.startTime.toFixed(0), +e.duration.toFixed(0)]); }).observe({ type: 'longtask', buffered: true }); } catch {}
    window.__fr = []; let l = performance.now(); const f = (t) => { window.__fr.push([+t.toFixed(1), +(t - l).toFixed(1)]); l = t; requestAnimationFrame(f); }; requestAnimationFrame(f);
    window.__ld = {}; const bytes = () => { let s = 0; for (const e of performance.getEntriesByType('resource')) s += e.transferSize || e.encodedBodySize || 0; const n = performance.getEntriesByType('navigation')[0]; return s + (n ? (n.transferSize || n.encodedBodySize || 0) : 0); };
    window.__bytes = bytes;
    const poll = () => { const L = window.__ld, t = +performance.now().toFixed(0);
      const pb = document.getElementById('play-button'); const ts = document.getElementById('title-screen');
      if (L.play == null && pb && ts && getComputedStyle(ts).position === 'absolute' && getComputedStyle(document.getElementById('app')).visibility === 'visible') { const r = pb.getBoundingClientRect(); if (r.width > 20 && r.height > 10) { L.play = t; L.playBytes = bytes(); } }
      if (L.game == null && window.__GAME__) { L.game = t; L.gameBytes = bytes(); }
      if (L.assets == null && window.__GAME__?.assetsReady?.().on) { L.assets = t; L.assetBytes = bytes(); }
      if (L.assets == null || L.play == null) setTimeout(poll, 10); };
    poll();
  });
  await page.goto(`http://127.0.0.1:${PORT}/?seed=22`, { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__ld.play != null && window.__ld.game != null, null, { timeout: 30000 });
  await page.waitForTimeout(Math.max(0, 8000 - await page.evaluate(() => performance.now())));
  const L = await page.evaluate(() => ({ ...window.__ld, bytes8s: window.__bytes(), res: performance.getEntriesByType('resource').map((e) => [e.name.split('/').pop().slice(0, 40), e.transferSize || e.encodedBodySize]).sort((a, b) => b[1] - a[1]).slice(0, 8) }));
  const before = await page.evaluate(() => window.__GAME__.programs());
  const tPlay = await page.evaluate(() => performance.now());
  if (dev === 'iphone') {
    const cdp = await ctx.newCDPSession(page);
    const b = await page.evaluate(() => { const r = document.getElementById('play-button').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x, y: b.y, id: 9 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: b.x, y: b.y, id: 9 }] });
  } else { await page.keyboard.press('Enter'); await page.keyboard.down('KeyW'); }
  await page.waitForTimeout(4000);
  const r = await page.evaluate((t0) => { const fr = window.__fr.filter((f) => f[0] >= t0 && f[0] < t0 + 4000).map((f) => f[1]).sort((a, b) => a - b); return { st: window.__THREE_GAME_DIAGNOSTICS__.state, n: fr.length, p95: fr[Math.floor(fr.length * 0.95)], max: fr[fr.length - 1], lt: window.__lt.filter((x) => x[0] >= t0), ltBefore: window.__lt.filter((x) => x[0] < t0) }; }, tPlay);
  const after = await page.evaluate(() => window.__GAME__.programs());
  console.log('LOAD', PORT, dev, run, JSON.stringify({ playReadyMs: L.play, playMB: +(L.playBytes / 1e6).toFixed(2), gameMs: L.game, assetsMs: L.assets, assetsMB: L.assetBytes ? +(L.assetBytes / 1e6).toFixed(2) : null, at8sMB: +(L.bytes8s / 1e6).toFixed(2), top: L.res,
    afterPlay: { state: r.st, frames: r.n, p95: r.p95, max: r.max, longTasks: r.lt, longTasksBeforePlay: r.ltBefore.length, newPrograms: after.filter((p) => !before.includes(p)).length } }));
  await ctx.close();
}
await browser.close();
