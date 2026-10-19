// Round 37 builder: the sailboat ride-along, forced. The drone is placed at rest on the top of a moving boat's hull box
// (centre a radius above the box top, at several points along the hull), no input, and run for 4 s at 60 Hz. Counts the
// longest run of frames in contact with the hull (gap < radius + 3 cm) and with the centre inside the soft (mast and
// sail) column. Env: PORT, SEEDS (22), KINDS (sail,rib,row,ferry).
import { chromium } from '@playwright/test';
const PORT = process.env.PORT || '5190'; const SEEDS = (process.env.SEEDS || '22').split(',').map(Number);
const KINDS = (process.env.KINDS || 'sail,rib,row,ferry').split(',');
const browser = await chromium.launch({ channel: 'chromium' });
for (const SEED of SEEDS) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
  await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
  await page.waitForFunction(() => window.__GAME__.assetsReady().on && window.__GAME__.boats().length > 0, null, { timeout: 30000 });
  const res = await page.evaluate((KINDS) => {
    const G = window.__GAME__; G.advance(2, false);
    const NP = { sail: 2, rib: 1, row: 1, ferry: 3 }; const R = 0.95;
    const colsOf = () => { const C = G.boatColliders(); const B = G.boats(); let k = 0; return B.map((b) => { const c = C.slice(k, k + NP[b.kind]); k += NP[b.kind]; return c; }); };
    const local = (p, c) => { const ox = p.x - c.x, oz = p.z - c.z; return [ox * c.c - oz * c.s, ox * c.s + oz * c.c]; };
    const inside = (p, c) => { const [lx, lz] = local(p, c); return Math.abs(lx) < c.hx && Math.abs(lz) < c.hz && p.y > c.y0 && p.y < c.y1; };
    const dist = (p, c) => { const [lx, lz] = local(p, c); const dx = Math.max(Math.abs(lx) - c.hx, 0), dz = Math.max(Math.abs(lz) - c.hz, 0), dy = Math.max(c.y0 - p.y, p.y - c.y1, 0); return Math.hypot(dx, dy, dz); };
    const out = [];
    for (const kind of KINDS) {
      const bi = G.boats().findIndex((b) => b.kind === kind && b.moving); if (bi < 0) continue;
      for (const f of [0.7, 0.35, 0, -0.35, -0.7]) {
        const hull = colsOf()[bi].find((c) => !c.soft);
        // a point along the hull's centre line, f of the half length toward the bow
        const lz = f * hull.hz; const x = hull.x + lz * hull.s, z = hull.z + lz * hull.c;
        G.place(x, hull.y1 + R, z, 0, 0);
        let run = 0, longest = 0, srun = 0, soft = 0, frames = 0;
        for (let s = 0; s < 240; s++) {
          const d = G.advance(1 / 60, false); const p = d.player.position; const mine = colsOf()[bi];
          let md = 99; for (const c of mine) if (!c.soft) md = Math.min(md, dist(p, c));
          if (md < R + 0.03) { run++; longest = Math.max(longest, run); } else run = 0;
          if (mine.some((c) => c.soft && inside(p, c))) { srun++; soft = Math.max(soft, srun); } else srun = 0;
          frames++;
        }
        out.push({ kind, f, longest, soft });
        G.advance(1, false);
      }
    }
    return out;
  }, KINDS);
  for (const r of res) console.log('RIDE', SEED, JSON.stringify(r));
  const w = (k) => Math.max(...res.filter((r) => r.kind === k).map((r) => r.longest));
  console.log('SUMMARY', SEED, KINDS.map((k) => `${k} longest ${w(k)} soft ${Math.max(...res.filter((r) => r.kind === k).map((r) => r.soft))}`).join(' | '));
}
await browser.close();
