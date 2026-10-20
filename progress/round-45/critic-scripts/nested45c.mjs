// Round 45 critic: the production build under /nested/game/: is the sound sprite fetched from the nested path and ready?
import { chromium } from '@playwright/test';
const b = await chromium.launch({ channel: 'chromium' }); const p = await (await b.newContext()).newPage();
const r = []; p.on('response', (x) => { if (x.url().includes('sfx.mp3')) r.push(x.url() + ' ' + x.status()); }); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
await p.goto('http://127.0.0.1:5194/nested/game/?seed=22&slLaunch=x', { waitUntil: 'load' }); await p.waitForTimeout(2500);
await p.keyboard.press('ShiftLeft'); await p.waitForTimeout(800);
console.log(JSON.stringify({ sprite: await p.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.audio.sfx.sprite), actx: await p.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.audio.state), responses: r, errs }));
await b.close();
