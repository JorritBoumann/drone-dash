// Round 16 critic (new): draftable street frontage per city. Samples every road centre line (every 2 m, at the street
// bot's 7 m), and counts a sample as draftable when a building face within SLIPSTREAM.reach (16 m) has its roof above
// 7 - roofSlack (5.5 m). Also the share with a face within 9 m (one side close). Read-only, uses the game's generator.
import { chromium } from '@playwright/test';
const SEEDS = (process.env.SEEDS || '80258,40443,66012,97343,73243,12668,96842,54408,19093,84143,62367,36020').split(',');
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
await page.goto('http://127.0.0.1:5188/?seed=1', { waitUntil: 'networkidle' });
for (const seed of SEEDS) {
  const r = await page.evaluate(async (seed) => {
    const { generateCity } = await import('/src/world/CityGenerator.ts'); const { createSeededRandom } = await import('/src/core/random.ts'); const { cityLook } = await import('/src/game/cities.ts');
    const L = generateCity(createSeededRandom(seed), 7, cityLook(seed).parks);
    const cols = L.colliders.filter((b) => b.maxY >= 5.5 && !b.soft);
    const dXZ = (b, x, z) => Math.hypot(Math.max(b.minX - x, 0, x - b.maxX), Math.max(b.minZ - z, 0, z - b.maxZ));
    let n = 0, d16 = 0, d9 = 0; const H = L.half;
    for (const c of L.roadCenters) for (let t = -H; t <= H; t += 2) for (const [x, z] of [[c, t], [t, c]]) {
      n++; let m = 99; for (const b of cols) { const d = dXZ(b, x, z); if (d < m) m = d; } if (m <= 16) d16++; if (m <= 9) d9++;
    }
    L.geometry.dispose();
    return { seed, n, draft16: +(d16 / n).toFixed(3), close9: +(d9 / n).toFixed(3), buildings: cols.length };
  }, Number(seed));
  console.log('FRONT ' + JSON.stringify(r));
}
await browser.close();
