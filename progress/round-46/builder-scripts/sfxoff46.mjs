// Round 46 builder (critic item H): the effects switch. In flight, RMS of the effects, drone and ambience buses and of the
// music bus with effects on, then off, then on again (an AnalyserNode on each of the game's tap points, 2 s each).
import { chromium } from '@playwright/test';
const PORT = Number(process.env.PORT || 5199); if (PORT === 5188) throw new Error('5188 is the owner');
const browser = await chromium.launch({ channel: 'chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://127.0.0.1:${PORT}/?seed=22&music=breakbeat`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
await page.keyboard.press('ShiftLeft'); await page.waitForTimeout(300);
await page.keyboard.press('Enter'); await page.waitForTimeout(1200);
await page.keyboard.down('KeyW');
await page.evaluate(() => { const t = window.__GAME__.audioTaps(); const ctx = t.out.context; window.__an = {}; for (const k of ['sfx', 'bed', 'amb', 'music', 'out']) { const a = ctx.createAnalyser(); a.fftSize = 2048; t[k].connect(a); window.__an[k] = a; } });
const measure = async () => page.evaluate(async () => { const acc = {}; const buf = new Float32Array(2048); for (let i = 0; i < 40; i++) { for (const [k, a] of Object.entries(window.__an)) { a.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; acc[k] = (acc[k] || 0) + s / buf.length; } await new Promise((r) => setTimeout(r, 50)); } const o = {}; for (const k in acc) o[k] = +(10 * Math.log10(acc[k] / 40 + 1e-15)).toFixed(1); return o; });
const on1 = await measure();
await page.evaluate(() => window.__GAME__.sfx(false)); await page.waitForTimeout(400);
const off = await measure();
await page.keyboard.press('KeyE'); await page.waitForTimeout(100); // a boost press while off: must stay silent
const offBoost = await measure();
await page.evaluate(() => window.__GAME__.sfx(true)); await page.waitForTimeout(400);
const on2 = await measure();
await page.keyboard.up('KeyW');
console.log(JSON.stringify({ on1, off, offBoost, on2, saved: await page.evaluate(() => localStorage.getItem('drone-dash-sfx-v1')), errors }));
await browser.close();
