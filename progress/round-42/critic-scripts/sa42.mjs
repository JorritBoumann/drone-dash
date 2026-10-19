import { chromium, devices } from '@playwright/test';
const b = await chromium.launch({ channel: 'chromium' });
console.log(b.version());
const ctx = await b.newContext({ ...devices['iPhone 13 landscape'] }); const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
try { await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { left: 47, right: 47, top: 0, bottom: 21 } }); console.log('override ok'); } catch (e) { console.log('ERR', e.message); }
await p.goto('http://127.0.0.1:5193/?seed=22', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
console.log(await p.evaluate(() => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:0;top:0;width:env(safe-area-inset-left,0px);height:10px'; document.body.appendChild(d); return { inset: d.getBoundingClientRect().width, score: document.querySelector('.hud-score').getBoundingClientRect().toJSON() }; }));
await b.close();
