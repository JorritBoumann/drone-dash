// Round 45 builder: the music toggle (N, and the chip) still works with the new mix, and the toggle click plays.
// Dev server (PORT, default 5197), desktop. Also checks that audio is suspended before the first gesture.
import { chromium } from '@playwright/test';
const PORT = process.env.PORT || '5197';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://127.0.0.1:${PORT}/?seed=22`, { waitUntil: 'networkidle' }); await page.waitForTimeout(2500);
const A = () => page.evaluate(() => { const a = window.__THREE_GAME_DIAGNOSTICS__.audio; return { state: a.state, enabled: a.music.enabled, playing: a.music.playing, gain: a.music.gain, sampled: a.sfx && a.sfx.sampled, sprite: a.sfx && a.sfx.sprite }; });
const out = { beforeGesture: await A() };
await page.keyboard.press('ShiftLeft'); await page.waitForTimeout(1500); out.afterGesture = await A();
await page.keyboard.press('KeyN'); await page.waitForTimeout(600); out.afterN1 = await A();
await page.keyboard.press('KeyN'); await page.waitForTimeout(1500); out.afterN2 = await A();
await page.keyboard.press('Enter'); await page.waitForTimeout(2000); out.inRun = await A();
await page.keyboard.press('KeyN'); await page.waitForTimeout(600); out.inRunN1 = await A();
await page.keyboard.press('KeyN'); await page.waitForTimeout(1500); out.inRunN2 = await A();
await page.click('#music-toggle', { trial: true }).then(() => 'ok').catch((e) => 'no chip in run: ' + String(e).slice(0, 60));
console.log('TOGGLE', JSON.stringify(out));
console.log('ERRORS', JSON.stringify(errors));
await browser.close();
