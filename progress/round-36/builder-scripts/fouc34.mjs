// Round 34 critic (new): flash of unstyled content on a cold load. Fresh context (no cache) per run.
// Records the first DUR ms (default 2000) after navigation two ways:
//  1. a rAF sampler (runs before every painted frame): #app visibility, whether styles.css has applied (#title-screen
//     is position:absolute/fixed and the body background is the stylesheet's #f0b98a), any visible element outside #app,
//     and the first time the title card and Play button are on screen.
//  2. a CDP screencast (every frame the compositor sends), saved as JPEGs to OUTDIR/fouc/<tag>/.
// A frame is BAD when #app is visible before styles.css applies. PORTS (default 5191 dev, 5193 prod), DEVS desktop,iphone,
// CPU=4 for 4x CPU throttle. TAG prefix for file names.
import { chromium, devices } from '@playwright/test';
import fs from 'fs';
const OUT = (process.env.OUTDIR || new URL('../critic/', import.meta.url).pathname) + 'fouc/';
const PORTS = (process.env.PORTS || '5191,5193').split(','); const DEVS = (process.env.DEVS || 'desktop,iphone').split(',');
const CPU = Number(process.env.CPU || 1); const DUR = Number(process.env.DUR || 2000); const RUNS = Number(process.env.RUNS || 2);
const NAME = { 5191: 'dev34', 5192: 'dev33c', 5193: 'prod34' };
const browser = await chromium.launch({ channel: 'chromium' });
for (const port of PORTS) for (const dev of DEVS) for (let run = 1; run <= RUNS; run++) {
  const tag = `${NAME[port] || port}-${dev}${CPU > 1 ? '-cpu' + CPU : ''}-${run}`;
  const dir = OUT + tag + '/'; fs.mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext(dev === 'iphone' ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const S = window.__fouc = { rows: [], titleAt: null, playAt: null, firstVisAt: null, cssAt: null };
    const styled = () => { const t = document.getElementById('title-screen'); if (!t) return false; const p = getComputedStyle(t).position; return p === 'absolute' || p === 'fixed'; };
    const tick = (ts) => {
      const app = document.getElementById('app'); const now = +performance.now().toFixed(1);
      if (app) {
        const vis = getComputedStyle(app).visibility === 'visible'; const css = styled();
        const bg = getComputedStyle(document.body).backgroundColor;
        let outside = 0; for (const el of document.body.children) { if (el === app || el.tagName === 'SCRIPT') continue; const r = el.getBoundingClientRect(); if (r.width > 4 && r.height > 4 && getComputedStyle(el).visibility === 'visible' && getComputedStyle(el).display !== 'none') outside++; }
        const tc = document.querySelector('.title-card'); const pb = document.getElementById('play-button');
        const onScr = (e) => { if (!e || !vis) return false; const r = e.getBoundingClientRect(); return r.width > 20 && r.height > 10 && r.bottom > 0 && r.top < innerHeight && +getComputedStyle(e).opacity > 0.5; };
        const tv = onScr(tc) && css, pv = onScr(pb) && css;
        if (vis && S.firstVisAt == null) S.firstVisAt = now; if (css && S.cssAt == null) S.cssAt = now;
        if (tv && S.titleAt == null) S.titleAt = now; if (pv && S.playAt == null) S.playAt = now;
        S.rows.push([now, vis ? 1 : 0, css ? 1 : 0, outside, bg, tv ? 1 : 0]);
      } else S.rows.push([now, -1, 0, 0, '', 0]);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const cdp = await ctx.newCDPSession(page);
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  const frames = []; let t0 = null;
  cdp.on('Page.screencastFrame', async (f) => { frames.push({ ts: f.metadata.timestamp, data: f.data }); try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {} });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, everyNthFrame: 1 });
  const wall0 = Date.now() / 1000;
  await page.goto(`http://127.0.0.1:${port}/?seed=22`, { waitUntil: 'commit' });
  await page.waitForTimeout(DUR);
  await cdp.send('Page.stopScreencast').catch(() => {});
  const S = await page.evaluate(() => ({ ...window.__fouc, nav: performance.getEntriesByType('navigation')[0]?.toJSON?.() }));
  const bad = S.rows.filter((r) => r[1] === 1 && r[2] === 0);
  const outsideRows = S.rows.filter((r) => r[3] > 0);
  let k = 0; for (const f of frames) { k++; fs.writeFileSync(dir + `f${String(k).padStart(3, '0')}-${Math.round((f.ts - wall0) * 1000)}ms.jpg`, Buffer.from(f.data, 'base64')); }
  console.log('FOUC', tag, JSON.stringify({ rafFrames: S.rows.length, firstRaf: S.rows[0]?.[0], firstVisAt: S.firstVisAt, cssAt: S.cssAt, titleAt: S.titleAt, playAt: S.playAt,
    badFrames: bad.length, badEx: bad.slice(0, 3), outsideFrames: outsideRows.length, hiddenFrames: S.rows.filter((r) => r[1] === 0).length, screencastFrames: frames.length,
    domContentLoaded: S.nav ? Math.round(S.nav.domContentLoadedEventEnd) : null, load: S.nav ? Math.round(S.nav.loadEventEnd) : null, lastRow: S.rows[S.rows.length - 1] }));
  await ctx.close();
}
await browser.close();
