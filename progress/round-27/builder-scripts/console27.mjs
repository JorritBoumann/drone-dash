// Round 27 builder: print console errors / warnings of a page load (shader compile errors land here).
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const msgs = []; page.on('console', (m) => { msgs.push(m.type() + ': ' + m.text()); }); page.on('pageerror', (e) => msgs.push('pageerror ' + e));
await page.goto('http://127.0.0.1:5190/?seed=' + (process.env.SEED || 130), { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
console.log(msgs.join('\n').slice(0, 6000));
await browser.close();
