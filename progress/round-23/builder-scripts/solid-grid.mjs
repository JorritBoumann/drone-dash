import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto('http://127.0.0.1:5190/?seed=130', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
const out = await page.evaluate(() => { const G = window.__GAME__; const lines = [];
  for (const y of [3.2, 6, 7.5]) { lines.push('y=' + y + '  x from -20 to 64 step 2 (cols), z from 20 to -20 step 2 (rows)');
    for (let z = 20; z >= -20; z -= 2) { let s = ''; for (let x = -20; x <= 64; x += 2) s += G.insideSolid(x, y, z, 0) ? '#' : '.'; lines.push(String(z).padStart(4) + ' ' + s); } }
  return lines.join('\n'); });
console.log(out); await browser.close();
