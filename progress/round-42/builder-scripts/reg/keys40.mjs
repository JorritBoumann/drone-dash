// Round 40 critic (new): M and N keys and their help text. Title: help list, music chip title, M and N on the title.
// In a run: M hides / shows the minimap (state remembered), N toggles music, M does not touch music.
import { chromium } from '@playwright/test';
const PORT = process.env.PORT || '5191';
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${PORT}/?seed=22`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
const st = () => page.evaluate(() => { const G = window.__GAME__, d = G.diagnostics(); const c = document.querySelector('canvas.minimap'); return { state: G.state, music: d.audio?.music?.enabled ?? d.audio?.music?.on ?? JSON.stringify(d.audio?.music ?? null).slice(0, 80), chip: document.getElementById('music-toggle')?.getAttribute('aria-pressed'), chipState: document.getElementById('music-toggle')?.dataset.state, map: c ? !c.hidden : null, mapStore: localStorage.getItem('drone-dash-minimap-v1') }; });
const help = await page.evaluate(() => ({ list: [...document.querySelectorAll('.controls-hint li')].map((l) => l.textContent.trim()), touch: document.querySelector('.controls-touch')?.textContent.trim(), chipTitle: document.getElementById('music-toggle')?.title, chipLabel: document.getElementById('music-label')?.textContent }));
console.log('help', JSON.stringify(help));
console.log('title start', JSON.stringify(await st()));
await page.keyboard.press('KeyN'); await page.waitForTimeout(200); console.log('title after N', JSON.stringify(await st()));
await page.keyboard.press('KeyM'); await page.waitForTimeout(200); console.log('title after M', JSON.stringify(await st()));
await page.keyboard.press('Enter'); await page.waitForTimeout(1500); console.log('playing', JSON.stringify(await st()));
await page.keyboard.press('KeyM'); await page.waitForTimeout(300); console.log('run after M', JSON.stringify(await st()));
await page.keyboard.press('KeyN'); await page.waitForTimeout(300); console.log('run after N', JSON.stringify(await st()));
await page.keyboard.press('KeyM'); await page.waitForTimeout(300); console.log('run after M again', JSON.stringify(await st()));
await page.keyboard.press('KeyM'); await page.waitForTimeout(300);
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1200); await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
console.log('after reload (map was hidden)', JSON.stringify(await st()));
await page.keyboard.press('Escape'); await page.waitForTimeout(400); console.log('paused', JSON.stringify(await st()));
await page.keyboard.press('KeyM'); await page.waitForTimeout(300); console.log('paused after M', JSON.stringify(await st()));
await browser.close();
