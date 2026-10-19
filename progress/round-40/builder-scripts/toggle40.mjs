// Round 40 builder: M toggles the minimap in a run (remembered across a reload); on the title M / N still toggle music.
import { chromium } from '@playwright/test';
const PORT = process.env.PORT || '5190';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://127.0.0.1:${PORT}/?seed=22`, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.removeItem('drone-dash-minimap-v1')); await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(800);
const st = () => page.evaluate(() => ({ state: window.__GAME__.state, mm: window.__GAME__.minimap.visible, hidden: document.getElementById('minimap').hidden, ls: localStorage.getItem('drone-dash-minimap-v1'), music: window.__THREE_GAME_DIAGNOSTICS__.audio.music.enabled }));
console.log('title', JSON.stringify(await st()));
await page.keyboard.press('KeyM'); await page.waitForTimeout(200); console.log('title after M', JSON.stringify(await st()));
await page.keyboard.press('KeyN'); await page.waitForTimeout(200); console.log('title after N', JSON.stringify(await st()));
await page.keyboard.press('Enter'); await page.waitForTimeout(800); console.log('run', JSON.stringify(await st()));
await page.keyboard.press('KeyM'); await page.waitForTimeout(200); console.log('run after M', JSON.stringify(await st()));
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(800); await page.keyboard.press('Enter'); await page.waitForTimeout(800);
console.log('after reload', JSON.stringify(await st()));
await page.keyboard.press('KeyM'); await page.waitForTimeout(200); console.log('run after M again', JSON.stringify(await st()));
console.log('errors', errors.length, errors.slice(0, 2));
await browser.close();
