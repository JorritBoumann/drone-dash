// Round 29 builder: first-flight hitch probe. Same timing as the critic's hud-probe27 (goto networkidle, 1.2 s, then
// Enter or a tap on Play), fresh profile. Prints the biggest frames in the first 3 s of play with their GL / audio cost.
import { chromium, devices } from '@playwright/test';
const DEV = process.env.DEV || 'desktop', SEED = process.env.SEED || '22', PORT = process.env.PORT || '5191', WAIT = Number(process.env.WAIT ?? 1200);
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext(DEV === 'iphone' ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.addInitScript({ path: new URL('./hitch29-init.js', import.meta.url).pathname });
await page.addInitScript({ path: new URL('./hitch-init.js', import.meta.url).pathname });
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(WAIT);
const progBefore = await page.evaluate(() => window.__GAME__.programs ? window.__GAME__.programs() : []);
const tStart = await page.evaluate(() => performance.now() - window.__h29.t0);
if (DEV === 'iphone') { const b = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((b) => /^\s*play/i.test(b.textContent) && b.offsetParent); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }); await page.touchscreen.tap(b.x, b.y); }
else await page.keyboard.press('Enter');
await page.keyboard.down('KeyW'); await page.waitForTimeout(3000); await page.keyboard.up('KeyW');
const H = await page.evaluate(() => window.__h29);
const progAfter = await page.evaluate(() => window.__GAME__.programs ? window.__GAME__.programs() : []);
console.log('PROGRAMS before', progBefore.length, 'new after start', JSON.stringify(progAfter.filter((p) => !progBefore.includes(p))));
const play = H.frames.filter((f) => f.at >= tStart - 50);
const top = [...play].sort((a, b) => b.dt - a.dt).slice(0, 5);
const pre = H.frames.filter((f) => f.at < tStart && f.dt > 40).sort((a, b) => b.dt - a.dt).slice(0, 4);
console.log('HITCH29', DEV, SEED, JSON.stringify({ startAt: Math.round(tStart), maxPlay: top[0] && top[0].dt, top, firstPlaying: play.find((f) => f.st === 'playing'), titleBig: pre, audio: H.marks, links: H.frames.reduce((s, f) => s + f.n, 0), big: await page.evaluate(() => window.__big.slice(0, 5)), errors }));
await browser.close();
