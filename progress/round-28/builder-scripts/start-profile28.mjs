// Round 28 builder: CPU profile of __GAME__.start() (the first-flight hitch), top functions by self time. PORT env.
import { chromium } from '@playwright/test';
const PORT = process.env.PORT || '5192';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(`http://127.0.0.1:${PORT}/?seed=22`, { waitUntil: 'load' });
await page.waitForTimeout(6000); console.log('loaded');
const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
await cdp.send('Profiler.start');
const ms = await page.evaluate(() => { const a = performance.now(); window.__GAME__.start(); return performance.now() - a; });
const { profile } = await cdp.send('Profiler.stop');
const dt = profile.timeDeltas; const self = new Map(); const byId = new Map(profile.nodes.map((n) => [n.id, n]));
profile.samples.forEach((id, i) => { const n = byId.get(id); const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber + 1}`; self.set(k, (self.get(k) || 0) + (dt[i] || 0) / 1000); });
console.log('START ms', ms.toFixed(1));
for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(v.toFixed(1), k);
await browser.close();
