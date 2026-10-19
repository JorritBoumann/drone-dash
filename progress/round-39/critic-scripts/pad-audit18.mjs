// Round 18 critic (new): broken-pad audit on fresh cities. For each seed: the game's padAudit hook (buried, overhang,
// awning, outside), plus my own check of pads that sit inside an alley or tunnel (within the alley strip) or within 12 m of a
// tunnel mouth/centre: listed with their clearance to the nearest collider top above them is covered by padAudit's overhang.
import { chromium } from '@playwright/test';
const seeds = (process.env.SEEDS || '1,2,3').split(',').map(Number);
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
let totalIssues = 0, totalSites = 0, inAlley = 0, nearTunnel = 0;
for (const seed of seeds) {
  await page.goto('http://127.0.0.1:5191/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(300);
  const r = await page.evaluate((seed) => {
    const g = window.__GAME__;
    const audit = g.padAudit([seed])[0];
    const feats = g.features().filter((f) => f.kind !== 'diagonal');
    // axis: a short probe route along z through the centre; if it uses the alley the alley runs along z
    const fa = feats.map((f) => { const rz = g.streetRoute({ x: f.x, z: f.z - 22 }, { x: f.x, z: f.z + 22 }, true); return { ...f, axis: rz.names.includes(f.name) && rz.length < 50 ? 'z' : 'x' }; });
    const sites = g.sites();
    const hits = [];
    for (const s of sites) for (const f of fa) {
      const along = f.axis === 'z' ? Math.abs(s.z - f.z) : Math.abs(s.x - f.x), across = f.axis === 'z' ? Math.abs(s.x - f.x) : Math.abs(s.z - f.z);
      const inStrip = across < 4 && along < 22;
      const nearT = f.kind === 'tunnel' && Math.hypot(s.x - f.x, s.z - f.z) < 22 && across < 12;
      if (inStrip || nearT) hits.push({ site: s.name, kind: s.kind, y: +s.y.toFixed(1), feat: f.kind, fname: f.name, inStrip, across: +across.toFixed(1), along: +along.toFixed(1), flagged: audit.issues.some((i) => i.site === s.name) });
    }
    return { seed, sites: audit.sites, issues: audit.issues, feats: fa.map((f) => f.kind + ':' + f.axis), hits };
  }, seed);
  totalIssues += r.issues.length; totalSites += r.sites; inAlley += r.hits.filter((h) => h.inStrip).length; nearTunnel += r.hits.filter((h) => h.feat === 'tunnel').length;
  console.log(JSON.stringify(r));
}
console.log(`PADAUDIT seeds ${seeds.length} sites ${totalSites} issues ${totalIssues} padsInAlleyStrip ${inAlley} padsNearTunnel ${nearTunnel}`);
await browser.close();
