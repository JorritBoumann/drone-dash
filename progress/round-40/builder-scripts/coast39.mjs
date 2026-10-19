import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 800, height: 450 } })).newPage();
await page.goto('http://127.0.0.1:5190/?seed=22', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
for (const sa of [25, 0]) {
  const r = await page.evaluate((sa) => { const G = window.__GAME__; G.start(); G.manualRender(true); G.tune({ FLIGHT: { scrapeAngle: sa } });
    G.place(-150, 12, 22, -Math.PI / 2, 12); G.advance(0.2, false); G.key('KeyW', true); G.key('KeyE', true); const out = [];
    for (let i = 0; i < 270; i++) { if (i === 150) G.key('KeyE', false); const d = G.advance(1 / 60, false); if (i % 15 === 0) out.push([i, d.player.speed.toFixed(1), d.player.position.x.toFixed(1), d.player.position.z.toFixed(2), d.player.boosting, d.slipstream.drafting, d.contact.scrape?.toFixed(1)].join(' ')); }
    G.key('KeyW', false); return out; }, sa);
  console.log('scrapeAngle', sa); console.log(r.join('\n'));
}
await browser.close();
