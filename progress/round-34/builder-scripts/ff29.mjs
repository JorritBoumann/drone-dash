// Round 29 critic (new): first-flight hitch. Fresh profile each run (new context, first-run state). Load, wait WAIT ms on
// the title (default 1200, as hud-probe; WAIT=1700 for a quick Play), press Play (Enter on desktop, a CDP tap on the
// phone), hold W. Logs: rAF frame intervals for the first 4 s of play (max, and the first 10), main-thread long tasks
// (PerformanceObserver 'longtask', start and duration) from Play on, and shader programs compiled after Play
// (G.programs() before Play and 4 s later: any new program is a compile on the first flight). DEV=desktop|iphone.
import { chromium, devices } from '@playwright/test';
const DEV = process.env.DEV || 'desktop', RUNS = Number(process.env.RUNS || 3), WAIT = Number(process.env.WAIT || 1200), SEED = process.env.SEED || '22';
const browser = await chromium.launch({ channel: 'chromium' });
for (let run = 1; run <= RUNS; run++) {
  const ctx = await browser.newContext(DEV === 'iphone' ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__lt = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([+e.startTime.toFixed(0), +e.duration.toFixed(0)]); }).observe({ type: 'longtask', buffered: true }); } catch {}
    window.__fr = []; let l = performance.now(); const f = (t) => { window.__fr.push([+t.toFixed(1), +(t - l).toFixed(1)]); l = t; requestAnimationFrame(f); }; requestAnimationFrame(f);
  });
  await page.goto('http://127.0.0.1:5190/?seed=' + SEED, { waitUntil: 'networkidle' }); await page.waitForTimeout(WAIT);
  const before = await page.evaluate(() => window.__GAME__.programs());
  const tPlay = await page.evaluate(() => performance.now());
  if (DEV === 'iphone') {
    const cdp = await ctx.newCDPSession(page);
    const b = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((b) => /^\s*play/i.test(b.textContent) && b.offsetParent); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x, y: b.y, id: 9 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: b.x, y: b.y, id: 9 }] });
  } else { await page.keyboard.press('Enter'); await page.keyboard.down('KeyW'); }
  await page.waitForTimeout(4000);
  const r = await page.evaluate((t0) => { const fr = window.__fr.filter((f) => f[0] >= t0 && f[0] < t0 + 4000); return { st: window.__THREE_GAME_DIAGNOSTICS__.state, n: fr.length, max: Math.max(...fr.map((f) => f[1])), at: (fr.find((f) => f[1] === Math.max(...fr.map((g) => g[1]))) || [0])[0] - t0, first: fr.slice(0, 10).map((f) => f[1]), sorted: fr.map((f) => f[1]).sort((a, b) => a - b), lt: window.__lt.filter((e) => e[0] >= t0 - 50).map((e) => [+(e[0] - t0).toFixed(0), e[1]]), ltTitle: window.__lt.filter((e) => e[0] < t0 - 50).length, assets: window.__GAME__.assetsReady() }; }, tPlay);
  const after = await page.evaluate(() => window.__GAME__.programs());
  const s = r.sorted; const med = s[s.length >> 1], p95 = s[Math.floor(s.length * 0.95)];
  const added = after.filter((p) => !before.includes(p)).map((p) => p.split(':').slice(0, 2).join(':'));
  console.log('FF', DEV, 'run', run, JSON.stringify({ wait: WAIT, state: r.st, frames: r.n, median: med, p95, max: r.max, maxAt: Math.round(r.at), first10: r.first, longTasksFromPlay: r.lt, programsBefore: before.length, programsAdded: added.length, added: added.slice(0, 12), assets: r.assets }));
  await ctx.close();
}
await browser.close();
