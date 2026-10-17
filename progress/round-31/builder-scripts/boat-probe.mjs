// Round 31: boat probe, fixed step (1/60 s) for 120 s of game time. Per step: every hull (from the game's boat list) against
// the seawall (hull corners outside the island), every other hull and the marina docks (oriented-box overlap); the boats'
// drawn positions (instance matrices) against the swell height at their spot (waterAt with the camera fade); moving
// boats, kinds, wakes. SEEDS=22,130 PORT=5190 node boat-probe.mjs
import { chromium, devices } from '@playwright/test';
const PORT = process.env.PORT || 5190;
const SEEDS = (process.env.SEEDS || '22,130').split(',').map(Number);
const SECS = Number(process.env.SECS || 120);
const browser = await chromium.launch({ channel: 'chromium' });
for (const seed of SEEDS) {
  const ctx = await browser.newContext(process.env.MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/?seed=${seed}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
  await page.waitForFunction(() => window.__GAME__.boats().length > 0, null, { timeout: 30000 });
  const res = await page.evaluate(async (SECS) => {
    const G = window.__GAME__;
    const DRAFT = { sail: 0.42, rib: 0.34, ferry: 1.25, row: 0.32 };
    const fade = (d) => { const t = Math.min(1, Math.max(0, (d - 150) / 230)); return 1 - t * t * (3 - 2 * t); };
    const corners = (h) => { const fx = Math.sin(h.yaw), fz = Math.cos(h.yaw), px = Math.cos(h.yaw), pz = -Math.sin(h.yaw); const out = []; for (const a of [-1, 1]) for (const c of [-1, 1]) out.push([h.x + fx * a * h.hl + px * c * h.hb, h.z + fz * a * h.hl + pz * c * h.hb]); return out; };
    const axesOf = (h) => [[Math.sin(h.yaw), Math.cos(h.yaw)], [Math.cos(h.yaw), -Math.sin(h.yaw)]];
    const overlap = (A, B, axes) => { for (const [ax, az] of axes) { let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity; for (const [x, z] of A) { const v = x * ax + z * az; a0 = Math.min(a0, v); a1 = Math.max(a1, v); } for (const [x, z] of B) { const v = x * ax + z * az; b0 = Math.min(b0, v); b1 = Math.max(b1, v); } if (a1 < b0 || b1 < a0) return false; } return true; };
    const st = { steps: 0, shoreHits: 0, minShore: Infinity, pairHits: 0, dockHits: 0, minPairGap: Infinity, bobErrMax: 0, bobErrN: 0, heaveMin: {}, heaveMax: {}, waterMin: {}, waterMax: {}, moving: 0, kinds: [], wakes: 0, firstBad: null };
    const N = Math.round(SECS * 60);
    for (let i = 0; i < N; i++) {
      G.advance(1 / 60, false);
      const fp = G.boatFootprints();
      const snap = G.boats();
      const cam = window.__THREE_GAME_DIAGNOSTICS__.camera;
      if (i === 0) { st.moving = snap.filter((b) => b.moving).length; st.kinds = [...new Set(snap.map((b) => b.kind))]; st.wakes = st.moving; }
      st.steps++;
      const cs = fp.hulls.map(corners);
      snap.forEach((b) => { st.minShore = Math.min(st.minShore, b.shore); if (b.shore <= 0) { st.shoreHits++; st.firstBad ??= { t: i / 60, what: 'shore', b }; } });
      for (let a = 0; a < cs.length; a++) {
        for (let b = a + 1; b < cs.length; b++) {
          const d = Math.hypot(fp.hulls[a].x - fp.hulls[b].x, fp.hulls[a].z - fp.hulls[b].z) - fp.hulls[a].hl - fp.hulls[b].hl;
          st.minPairGap = Math.min(st.minPairGap, d);
          if (d < 0 && overlap(cs[a], cs[b], [...axesOf(fp.hulls[a]), ...axesOf(fp.hulls[b])])) { st.pairHits++; st.firstBad ??= { t: i / 60, what: 'pair', a: fp.hulls[a], b: fp.hulls[b] }; }
        }
        for (const d of fp.docks) {
          const D = [[d.x - d.hx, d.z - d.hz], [d.x + d.hx, d.z - d.hz], [d.x + d.hx, d.z + d.hz], [d.x - d.hx, d.z + d.hz]];
          if (overlap(cs[a], D, [...axesOf(fp.hulls[a]), [1, 0], [0, 1]])) { st.dockHits++; st.firstBad ??= { t: i / 60, what: 'dock', a: fp.hulls[a], d }; }
        }
      }
      // drawn boats: instance matrices against the swell (every 10th step)
      if (i % 10 === 0) {
        for (const kind of ['sail', 'rib', 'ferry', 'row']) {
          const mi = G.meshInfo('boats-' + kind, 8);
          if (!mi) continue;
          for (const [x, y, z] of mi.first) {
            const w = G.waterAt(x, z) * fade(Math.hypot(x - cam.x, z - cam.z));
            const heave = y + DRAFT[kind] + 0.7;
            const err = Math.abs(heave - w);
            st.bobErrMax = Math.max(st.bobErrMax, err); st.bobErrN++;
            st.heaveMin[kind] = Math.min(st.heaveMin[kind] ?? 9, heave); st.heaveMax[kind] = Math.max(st.heaveMax[kind] ?? -9, heave);
            st.waterMin[kind] = Math.min(st.waterMin[kind] ?? 9, w); st.waterMax[kind] = Math.max(st.waterMax[kind] ?? -9, w);
          }
        }
      }
      if (i % 600 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    st.minShore = +st.minShore.toFixed(2); st.minPairGap = +st.minPairGap.toFixed(2); st.bobErrMax = +st.bobErrMax.toFixed(4);
    for (const k of ['heaveMin', 'heaveMax', 'waterMin', 'waterMax']) for (const kk in st[k]) st[k][kk] = +st[k][kk].toFixed(3);
    return st;
  }, SECS);
  console.log('BOATS', seed, JSON.stringify(res));
  await ctx.close();
}
await browser.close();
