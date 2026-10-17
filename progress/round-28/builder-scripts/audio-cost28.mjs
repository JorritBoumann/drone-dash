import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext()).newPage();
await page.goto('http://127.0.0.1:5190/?seed=22', { waitUntil: 'load' });
await page.waitForTimeout(3000);
const r = await page.evaluate(() => {
  const t = [performance.now()];
  const ctx = new AudioContext(); t.push(performance.now());
  const len = Math.floor(ctx.sampleRate * 1.6); const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); } t.push(performance.now());
  const conv = ctx.createConvolver(); conv.buffer = ir; t.push(performance.now());
  return t.slice(1).map((x, i) => +(x - t[i]).toFixed(1));
});
console.log('ctx, ir, convolver ms', r);
const s = await page.evaluate(() => { const a = performance.now(); window.__GAME__.start(); return performance.now() - a; });
console.log('start ms with a context already made elsewhere', s.toFixed(1));
await browser.close();
