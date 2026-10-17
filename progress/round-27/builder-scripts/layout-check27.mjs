// Round 27 builder: the city layout must not change. Compares every solid collider, every site and the pad audit between
// the new build (5190) and the round 26 baseline (5191) on the given seeds.
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
const seeds = (process.env.SEEDS || '22,58,130,4,317').split(',');
const get = async (port, seed) => {
  await page.goto(`http://127.0.0.1:${port}/?seed=${seed}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(300);
  return page.evaluate((seed) => {
    const g = window.__GAME__;
    return { solids: JSON.stringify(g.solidAt(0, 0, 0, 5000)), sites: JSON.stringify(g.sites()), audit: g.padAudit([+seed])[0].issues.length, d: window.__THREE_GAME_DIAGNOSTICS__ };
  }, seed);
};
const h = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);
let ok = true;
for (const seed of seeds) {
  const a = await get(5190, seed), b = await get(5191, seed);
  const same = a.solids === b.solids && a.sites === b.sites;
  ok = ok && same && a.audit === 0;
  console.log('SEED', seed, JSON.stringify({ solids: JSON.parse(a.solids).length, solidsHash: [h(a.solids), h(b.solids)], sitesHash: [h(a.sites), h(b.sites)], padAuditIssues: [a.audit, b.audit], colliders: [a.d.world?.colliders ?? null], same }));
}
console.log(ok ? 'LAYOUT UNCHANGED' : 'LAYOUT DIFFERS');
await browser.close();
