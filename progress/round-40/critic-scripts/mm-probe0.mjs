// Round 40 critic: quick look at both builds' minimap DOM, diagnostics and mood per seed.
import { chromium, devices } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
for (const port of [5191, 5192]) for (const seed of [22, 58, 130]) for (const mob of [0, 1]) {
  const ctx = mob ? await browser.newContext({ ...devices['iPhone 13 landscape'] }) : await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/?seed=${seed}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(async () => {
    const G = window.__GAME__; G.start(); G.manualRender(true); G.tune({ RUN: { startTime: 999 } });
    G.advance(1.0, true);
    await new Promise((r) => setTimeout(r, 100)); G.advance(1 / 60, true);
    const d = G.diagnostics();
    const cs = [...document.querySelectorAll('canvas')].filter((c) => c.className.includes('minimap')).map((c) => { const b = c.getBoundingClientRect(); return { id: c.id, cls: c.className, w: c.width, h: c.height, l: Math.round(b.left), t: Math.round(b.top), cw: Math.round(b.width), ch: Math.round(b.height), hidden: c.hidden, disp: getComputedStyle(c).display, vis: getComputedStyle(c).visibility }; });
    return { mood: d.city?.mood, dpr: devicePixelRatio, vw: innerWidth, vh: innerHeight, mm: G.minimap ?? d.minimap ?? null, cs };
  });
  console.log(port, seed, mob ? 'phone' : 'desk', JSON.stringify(r), errs.slice(0, 2).join(' | '));
  await ctx.close();
}
await browser.close();
