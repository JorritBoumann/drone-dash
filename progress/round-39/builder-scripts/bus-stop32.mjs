import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
for (const seed of (process.env.SEEDS || "22,58,4711,9001").split(",").map(Number)) {
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto('http://127.0.0.1:5190/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
await page.waitForFunction(() => window.__GAME__.assetsReady().on && window.__GAME__.boats().length > 0, null, { timeout: 30000 });
const r = await page.evaluate(() => {
  const G = window.__GAME__; const out = []; let stopped = 0, lastState = null, t = 0;
  const bi = G.boats().findIndex((b) => b.kind === 'ferry');
  for (let k = 0; k < 1400; k++) { G.advance(0.5, false); t += 0.5; const b = G.boats()[bi]; const st = b.speed < 0.01 ? 'stop' : 'move'; if (st !== lastState) { out.push(`${t.toFixed(1)}:${st}@${b.x.toFixed(1)},${b.z.toFixed(1)}`); lastState = st; } }
  return out;
});
console.log(seed, r.length, r.slice(0, 30).join(' '));
await page.close();
}
await browser.close();
