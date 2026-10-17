// Round 22 critic: deterministic van slipstream check. Rush on, tail the nearest van 5 m behind at its height for 6 s; log vanDraft share and slip points.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
for (const seed of ['22', '58', '130']) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  await page.goto('http://127.0.0.1:5190/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const G = window.__GAME__; G.tune({ RUN: { startTime: 999 } }); G.start(); G.manualRender(true); G.advance(0.5, false); G.rush(true); G.advance(6, false);
    const res = [];
    for (let k = 0; k < 3; k++) {
      let d = G.diagnostics(); const p = d.player.position;
      const vans = G.vans(); if (!vans.length) return { err: 'no vans' };
      const v = vans.slice().sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[k];
      const vy = v.y ?? 3.1; const dx = v.dx, dz = v.dz;
      const yaw = Math.atan2(-dx, -dz);
      G.place(v.x - dx * 5, vy, v.z - dz * 5, yaw, v.speed ?? 10);
      const pts0 = d.slipstream.points, bank0 = d.slipstream.bankTotal; let draft = 0, n = 0, slip = 0, gapMax = 0;
      for (let i = 0; i < 120; i++) {
        d = G.diagnostics(); const pp = d.player.position;
        const vv = G.vans().reduce((a, b) => (Math.hypot(b.x - pp.x, b.z - pp.z) < Math.hypot(a.x - pp.x, a.z - pp.z) ? b : a));
        const gap = (vv.x - pp.x) * vv.dx + (vv.z - pp.z) * vv.dz; gapMax = Math.max(gapMax, gap);
        const lat = (pp.x - vv.x) * -vv.dz + (pp.z - vv.z) * vv.dx; // lateral offset
        const sp = d.player.speed; const vs = vv.speed ?? 10;
        const want = vs + (gap - 5) * 1.5;
        G.key('KeyW', sp < want); G.key('KeyS', sp > want + 1.5);
        const head = Math.atan2(-(vv.x - vv.dx * 2 - pp.x), -(vv.z - vv.dz * 2 - pp.z)); let e = head - d.player.yaw; e = Math.atan2(Math.sin(e), Math.cos(e));
        G.key('KeyA', e > 0.03); G.key('KeyD', e < -0.03); G.key('Space', pp.y < (vv.y ?? 3.1) - 0.3); G.key('ShiftLeft', pp.y > (vv.y ?? 3.1) + 0.3);
        d = G.advance(0.05, false); n++; if (d.vanDraft) draft++; if (d.slipstream.drafting) slip++;
      }
      for (const kk of ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space', 'ShiftLeft']) G.key(kk, false);
      res.push({ van: Object.keys(v).join(','), draftShare: +(draft / n).toFixed(2), slipDraftShare: +(slip / n).toFixed(2), bankGain: Math.round(d.slipstream.bankTotal - bank0), pointsGain: Math.round(d.slipstream.points - pts0), crashes: d.crashes, gapMax: +gapMax.toFixed(1) });
    }
    return res;
  });
  console.log('VAN', seed, JSON.stringify(r));
  await page.context().close();
}
await browser.close();
