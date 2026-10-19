// Round 40 critic: DOM queries per frame (querySelector, getBoundingClientRect, getComputedStyle) with the map on and
// off, real time, desktop, any build. Also the time spent inside them (performance.now, coarse).
import { chromium } from '@playwright/test';
const PORT = process.env.PORT || '5191';
const browser = await chromium.launch({ channel: 'chromium' });
for (const on of [true, false]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/?seed=22`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
  await page.evaluate(() => localStorage.removeItem('drone-dash-minimap-v1'));
  await page.evaluate(() => { const G = window.__GAME__; G.start(); G.manualRender(true); G.tune({ RUN: { startTime: 999 } }); G.advance(0.5, true); });
  await page.waitForTimeout(1300);
  if (!on) { await page.keyboard.press('KeyM'); await page.waitForTimeout(100); }
  await page.evaluate(() => { const c = window.__cnt = { qs: 0, gbcr: 0, gcs: 0, ms: 0 };
    const wrapM = (proto, name, key) => { const f = proto[name]; proto[name] = function (...a) { const t = performance.now(); try { return f.apply(this, a); } finally { c[key]++; c.ms += performance.now() - t; } }; };
    wrapM(Document.prototype, 'querySelector', 'qs'); wrapM(Element.prototype, 'getBoundingClientRect', 'gbcr');
    const gc = window.getComputedStyle; window.getComputedStyle = function (...a) { const t = performance.now(); try { return gc.apply(window, a); } finally { c.gcs++; c.ms += performance.now() - t; } }; });
  await page.evaluate(() => { const G = window.__GAME__; G.place(-120, 14, 22, -Math.PI / 2, 10); G.advance(0.2, true); G.key('KeyW', true); G.manualRender(false); });
  await page.waitForTimeout(500);
  await page.evaluate(() => { const c = window.__cnt; c.qs = c.gbcr = c.gcs = c.ms = 0; window.__f0 = window.__GAME__.diagnostics().frame; });
  await page.waitForTimeout(4000);
  const r = await page.evaluate(() => { const c = window.__cnt, f = window.__GAME__.diagnostics().frame - window.__f0; return { frames: f, qs: +(c.qs / f).toFixed(1), gbcr: +(c.gbcr / f).toFixed(1), gcs: +(c.gcs / f).toFixed(1), msInside: +(c.ms / f).toFixed(3), visible: !!document.querySelector('canvas.minimap:not([hidden])') }; });
  console.log(PORT, on ? 'map on ' : 'map off', JSON.stringify(r));
  await ctx.close();
}
await browser.close();
