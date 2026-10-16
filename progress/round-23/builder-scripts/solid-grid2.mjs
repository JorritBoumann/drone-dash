// Round 23 builder: fine solid map (debug).
import { chromium } from '@playwright/test';
const [SEED, X0, X1, Z0, Z1, Y, ST] = (process.env.Q || '130,0,24,-3,3,3.2,0.5').split(',').map(Number);
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
await page.goto('http://127.0.0.1:5190/?seed=' + SEED, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
console.log(await page.evaluate(([X0, X1, Z0, Z1, Y, ST]) => { const G = window.__GAME__; const L = [];
  for (let z = Z1; z >= Z0 - 1e-6; z -= ST / 2) { let s = ''; for (let x = X0; x <= X1 + 1e-6; x += ST) s += G.insideSolid(x, Y, z, 0) ? '#' : '.'; L.push(z.toFixed(2).padStart(6) + ' ' + s); } return L.join('\n'); }, [X0, X1, Z0, Z1, Y, ST]));
await browser.close();
