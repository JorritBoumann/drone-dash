// Round 22 builder: prints the first console errors (shader compile) and the first people records. Port 5190.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
let nmsg = 0; page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && nmsg++ < 4) console.log(m.type(), m.text().slice(0, 1500)); });
await page.goto('http://127.0.0.1:5190/?seed=22', { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
await page.evaluate(() => window.__GAME__.start()); await page.waitForTimeout(1000);
console.log(JSON.stringify((await page.evaluate(() => window.__GAME__.people())).slice(0, 3)));
console.log('console errors+warnings: ' + nmsg);
await browser.close();
