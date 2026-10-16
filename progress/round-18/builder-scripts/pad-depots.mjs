// Round 18 builder: pad audit (round 15 hook) on many seeds, plus depot and site counts per seed (loads each seed).
import { chromium } from '@playwright/test';
const seeds = (process.env.SEEDS || '22,58,130').split(',').map(Number);
const b = await chromium.launch({ channel: 'chromium' });
const p = await (await b.newContext({ viewport: { width: 640, height: 360 } })).newPage();
await p.goto('http://127.0.0.1:5188/?seed=1', { waitUntil: 'networkidle' });
const r = await p.evaluate((seeds) => window.__GAME__.padAudit(seeds).map((x) => ({ seed: x.seed, sites: x.sites, issues: x.issues.length, detail: x.issues.slice(0, 3) })), seeds);
let bad = 0; for (const x of r) { bad += x.issues; console.log('AUDIT ' + JSON.stringify(x)); }
if (process.env.DEPOTS) for (const s of seeds) { await p.goto('http://127.0.0.1:5188/?seed=' + s, { waitUntil: 'networkidle' }); const k = await p.evaluate(() => { const c = {}; for (const q of window.__GAME__.sites()) c[q.kind] = (c[q.kind] || 0) + 1; return c; }); console.log('KINDS ' + s + ' ' + JSON.stringify(k)); }
console.log(`AUDITSUM seeds ${seeds.length} issues ${bad}`);
await b.close();
