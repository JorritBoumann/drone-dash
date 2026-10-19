// Round 40 critic: matching minimap captures for the blind A/B. One build per run (PORT). Saves raw full-frame PNGs
// (device pixels) plus a JSON of canvas rects, drone state and HUD overlaps to RAW. Names carry the build tag, so the
// raw folder is never opened while judging; ab-compose40.py builds the blind pair images.
// env: PORT, TAG (build tag for file names), RAW (dir), JOBS ("22:desk:straight,turn,..;58:phone:...")
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
const PORT = process.env.PORT || '5191', TAG = process.env.TAG || 'x', RAW = process.env.RAW;
fs.mkdirSync(RAW, { recursive: true });
const JOBS = (process.env.JOBS || '22:desk:straight,turn,shore,ahead,behind,shortcut;58:phone:straight,turn,shore,ahead,behind,shortcut;130:desk:turn,shore,behind;130:phone:straight,ahead,shortcut')
  .split(';').map((j) => { const [seed, dev, spots] = j.split(':'); return { seed: +seed, dev, spots: spots.split(',') }; });
const browser = await chromium.launch({ channel: 'chromium' });
const meta = [];
const HUDSEL = ['.hud-score', '#timer', '#objective', '#route-hint', '.hud-right', '#slip', '#wind', '.boost', '.telemetry', '#view-hint', '#nav-marker', '#gate-tag', '#slip-pop', '#medal-pop', '#event-pop', '#pop', '#touch-stick', '#up-button', '#boost-button', '#down-button', '#music-toggle', '#pause-button'];
for (const job of JOBS) {
  const ctx = job.dev === 'phone' ? await browser.newContext({ ...devices['iPhone 13 landscape'] }) : await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${PORT}/?seed=${job.seed}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const G = window.__GAME__; G.start(); G.manualRender(true); G.tune({ RUN: { startTime: 999 } }); G.advance(0.5, true); });
  await page.waitForTimeout(1500);
  if (job.dev === 'phone') { await page.touchscreen.tap(375, 140); await page.waitForTimeout(100); }
  const keys = new Set();
  const setKeys = async (down) => {
    for (const k of [...keys]) if (!down.includes(k)) { await page.evaluate((k) => window.__GAME__.key(k, false), k); keys.delete(k); }
    for (const k of down) if (!keys.has(k)) { await page.evaluate((k) => window.__GAME__.key(k, true), k); keys.add(k); }
  };
  const adv = (s) => page.evaluate((s) => window.__GAME__.advance(s, false), s);
  async function capture(spot, extra = {}) {
    await page.waitForTimeout(60);
    const st = await page.evaluate((HUDSEL) => {
      const G = window.__GAME__; const d = G.advance(1 / 60, true);
      const c = [...document.querySelectorAll('canvas')].find((c) => c.className.includes('minimap') && !c.hidden);
      const all = [...document.querySelectorAll('canvas')].filter((c) => c.className.includes('minimap')).length;
      let box = null; if (c) { const b = c.getBoundingClientRect(); box = { l: b.left, t: b.top, r: b.right, b: b.bottom }; }
      const hits = [];
      if (box) for (const s of HUDSEL) for (const el of document.querySelectorAll(s)) {
        const b = el.getBoundingClientRect(), cs = getComputedStyle(el);
        if (b.width < 1 || b.height < 1 || cs.visibility === 'hidden' || +cs.opacity < 0.05 || el.closest('[hidden]')) continue;
        const ix = Math.min(box.r, b.right) - Math.max(box.l, b.left), iy = Math.min(box.b, b.bottom) - Math.max(box.t, b.top);
        if (ix > 0 && iy > 0) hits.push({ s, area: Math.round(ix * iy) });
      }
      const vw = innerWidth, vh = innerHeight;
      const onScreen = box ? Math.max(0, Math.min(box.r, vw) - Math.max(box.l, 0)) * Math.max(0, Math.min(box.b, vh) - Math.max(box.t, 0)) / ((box.r - box.l) * (box.b - box.t)) : 0;
      return { vw, vh, dpr: devicePixelRatio, box, count: all, onScreen, hits, p: d.player.position, yaw: d.player.yaw, speed: d.player.speed, obj: d.objective, mark: d.routeMark ? { gate: d.routeMark.gate, inward: d.routeMark.inward, exit: d.routeMark.exit, kind: d.routeMark.kind, stage: d.routeMark.stage } : null, mood: d.city?.mood };
    }, HUDSEL);
    const name = `${TAG}-${job.seed}-${job.dev}-${spot}`;
    await page.screenshot({ path: `${RAW}/${name}.png` });
    meta.push({ name, tag: TAG, seed: job.seed, dev: job.dev, spot, ...st, ...extra });
    console.log(name, JSON.stringify({ box: st.box, onScreen: +st.onScreen.toFixed(2), count: st.count, hits: st.hits, p: st.p, yaw: st.yaw, sp: st.speed }));
  }
  const fwdYaw = (fx, fz) => Math.atan2(-fx, -fz);
  for (const spot of job.spots) {
    await setKeys([]);
    if (spot === 'straight') {
      await page.evaluate(() => { const G = window.__GAME__; G.place(-120, 12, 22, -Math.PI / 2, 10); G.advance(0.2, false); });
      await setKeys(['KeyW']); await adv(1.6);
      await capture(spot);
    } else if (spot === 'turn') {
      await page.evaluate(() => { const G = window.__GAME__; G.place(-120, 12, 22, -Math.PI / 2, 10); G.advance(0.2, false); });
      await setKeys(['KeyW']); await adv(1.2); await setKeys(['KeyW', 'KeyD']); await adv(0.45);
      await capture(spot);
    } else if (spot === 'shore') {
      // east promenade road x = 154 heading north (-z): the sea is on the right
      await page.evaluate(() => { const G = window.__GAME__; G.place(154, 10, 90, 0, 8); G.advance(0.2, false); });
      await setKeys(['KeyW']); await adv(1.2);
      await capture(spot);
    } else if (spot === 'ahead' || spot === 'behind') {
      const want = spot === 'ahead' ? [70, 115] : [175, 240];
      const r = await page.evaluate(([lo, hi, ahead]) => {
        const G = window.__GAME__, o = G.diagnostics().objective.position, C = [-154, -110, -66, -22, 22, 66, 110, 154];
        let best = null;
        for (const x of C) for (const z of C) { const dd = Math.hypot(o.x - x, o.z - z); if (dd < lo || dd > hi) continue; const sc = Math.abs(dd - (lo + hi) / 2) + (Math.abs(x) > 150 || Math.abs(z) > 150 ? 30 : 0); if (!best || sc < best.sc) best = { x, z, sc, dd }; }
        if (!best) return null;
        let fx = o.x - best.x, fz = o.z - best.z; const n = Math.hypot(fx, fz); fx /= n; fz /= n; if (!ahead) { fx = -fx; fz = -fz; }
        const yaw = Math.atan2(-fx, -fz); let y = 12; while (G.insideSolid(best.x, y, best.z, 1.5) && y < 120) y += 4;
        G.place(best.x, y, best.z, yaw, 0); G.advance(0.6, false);
        return { ...best, yaw, y, o };
      }, [want[0], want[1], spot === 'ahead']);
      if (!r) { console.log('no spot for', spot); continue; }
      await capture(spot, { setup: r });
    } else if (spot === 'shortcut') {
      const r = await page.evaluate(() => {
        const G = window.__GAME__;
        for (let leg = 0; leg < 16; leg++) {
          const d = G.diagnostics();
          if (d.routeMark && d.routeMark.gate) return { leg, mark: d.routeMark };
          const ph = d.objective.phase;
          for (let i = 0; i < 60; i++) { const dd = G.diagnostics(); if (dd.objective.phase !== ph) break; const o = dd.objective.position; G.place(o.x, o.y + 1.2, o.z, 0, 0); G.advance(0.25, false); }
          G.advance(0.5, false);
        }
        return null;
      });
      if (!r) { console.log('no shortcut leg'); continue; }
      const g = r.mark.gate, inw = r.mark.inward;
      await page.evaluate(([g, inw]) => { const G = window.__GAME__; const yaw = Math.atan2(-inw.x, -inw.z); G.place(g.x - inw.x * 45, Math.max(g.y, 8), g.z - inw.z * 45, yaw, 6); G.advance(0.3, false); }, [g, inw]);
      await setKeys(['KeyW']); await adv(0.5);
      await capture(spot, { leg: r.leg });
    }
  }
  await setKeys([]);
  if (errs.length) console.log('page errors', errs.slice(0, 3));
  await ctx.close();
}
fs.writeFileSync(`${RAW}/meta-${TAG}.json`, JSON.stringify(meta, null, 1));
await browser.close();
