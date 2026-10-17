// Round 28 builder: street furniture placement audit (pads, alley / tunnel corridors, diagonal, roads, lamp posts and
// trunks: all 0), prop density near the six art spots, and the shop-front audit, on several seeds. PORT env.
import { chromium } from '@playwright/test';
const PORT = process.env.PORT || '5190';
const SEEDS = (process.env.SEEDS || '22,58,130,4,317').split(',');
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
for (const seed of SEEDS) {
  await page.goto(`http://127.0.0.1:${PORT}/?seed=${seed}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const G = window.__GAME__;
    const spots = [[22, 40], [22, 0], [-22, 0], [66, -22], [-66, 66], [0, -110]];
    return { place: G.propPlacementAudit(), shops: G.shopAudit(), near40: spots.map(([x, z]) => { const a = G.streetPropAudit(40, x, z); return { at: [x, z], count: a.count, kinds: a.kindCount, perTenM: a.perTenM }; }) };
  });
  console.log('SEED', seed, JSON.stringify(r));
}
await browser.close();
