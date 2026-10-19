// Round 38 critic (new): 1920x1080 stills for the gemini review, from the real game camera and HUD (no debug UI).
// Deterministic (manualRender + advance). title (130), busy street (58, rush hour, the spot with the most cars and people
// ahead), cruise height at golden hour (130, two headings), low over the harbour (22 and 33), a delivery with its pop
// (130) and the game-over screen (130, after three deliveries). Env: PORT (5191), ONLY (comma list of shot names).
import { chromium } from '@playwright/test';
const OUT = process.env.OUTDIR || '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/c38/media/';
import fs from 'node:fs'; fs.mkdirSync(OUT, { recursive: true });
const PORT = process.env.PORT || '5191'; const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (n) => !ONLY || ONLY.includes(n);
const browser = await chromium.launch({ channel: 'chromium' });
const open = async (seed) => {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => console.log('ERR', String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/?seed=${seed}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__GAME__ && window.__GAME__.assetsReady().on, null, { timeout: 30000 });
  return { ctx, page };
};
const startRun = async (page, tune) => {
  await page.evaluate((tune) => { const G = window.__GAME__; if (tune) G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); G.advance(1, false); G.hideDebugUi?.(true); }, tune);
  await page.waitForTimeout(2600); // the title card fades out in real time
};
// fly the drone along a line with place() each frame (so speed, bank and the camera behave as in flight), then render
const fly = (page, pts, secs) => page.evaluate(([pts, secs]) => {
  const G = window.__GAME__; const n = Math.round(secs * 60);
  for (let i = 0; i <= n; i++) {
    const u = i / n; const seg = Math.min(pts.length - 2, Math.floor(u * (pts.length - 1))); const v = u * (pts.length - 1) - seg;
    const a = pts[seg], b = pts[seg + 1]; const x = a[0] + (b[0] - a[0]) * v, y = a[1] + (b[1] - a[1]) * v, z = a[2] + (b[2] - a[2]) * v;
    const yaw = Math.atan2(-(b[0] - a[0]), -(b[2] - a[2])); const sp = Math.hypot(b[0] - a[0], b[2] - a[2]) / (secs / (pts.length - 1));
    G.place(x, y, z, yaw, sp); G.advance(1 / 60, i === n);
  }
}, [pts, secs]);
const shot = (page, name) => page.screenshot({ path: OUT + name + '.png' });

if (want('title')) {
  const { ctx, page } = await open(130); await page.waitForTimeout(1500); await shot(page, 'title-130'); await ctx.close();
}
if (want('street')) {
  const { ctx, page } = await open(58); await startRun(page, false);
  await page.evaluate(() => { const G = window.__GAME__; G.rush(true); G.advance(8, false); });
  const best = await page.evaluate(() => {
    const G = window.__GAME__; const R = [-154, -110, -66, -22, 22, 66, 110, 154]; const cars = G.traffic(); const ppl = G.people().filter((p) => !p.hidden);
    let best = null;
    for (const r of R) for (let s = -140; s <= 140; s += 11) for (const ax of [0, 1]) for (const dir of [1, -1]) {
      const x = ax ? r : s, z = ax ? s : r; const fx = ax ? 0 : dir, fz = ax ? dir : 0;
      let c = 0, p = 0;
      for (const v of cars) { const dx = v.x - x, dz = v.z - z; const f = dx * fx + dz * fz, l = Math.abs(dx * fz - dz * fx); if (f > 10 && f < 75 && l < 9) c++; }
      for (const q of ppl) { const dx = q.x - x, dz = q.z - z; const f = dx * fx + dz * fz, l = Math.abs(dx * fz - dz * fx); if (f > 8 && f < 45 && l < 15) p++; }
      const sc = c * 2 + p; if (!best || sc > best.sc) best = { x, z, fx, fz, c, p, sc };
    }
    return best;
  });
  console.log('STREET', JSON.stringify(best));
  const { x, z, fx, fz } = best;
  await fly(page, [[x - fx * 14, 5, z - fz * 14], [x, 4.2, z]], 1.6);
  await page.waitForTimeout(300); await shot(page, 'street-58'); await ctx.close();
}
if (want('cruise')) {
  const { ctx, page } = await open(130); await startRun(page, false);
  const A = Number(process.env.CRUISEY || 28);
  await fly(page, [[95, A, 80], [70, A, 60]], 2); await page.waitForTimeout(300); await shot(page, 'cruise-130-sun');
  await fly(page, [[-95, A, -80], [-70, A, -60]], 2); await page.waitForTimeout(300); await shot(page, 'cruise-130-lit');
  await fly(page, [[150, A, -22], [110, A, -22]], 2); await page.waitForTimeout(300); await shot(page, 'cruise-130-west');
  await fly(page, [[-22, A, 150], [-22, A, 110]], 2); await page.waitForTimeout(300); await shot(page, 'cruise-130-north');
  await ctx.close();
}
if (want('harbour')) {
  for (const seed of [22, 33, 130]) {
    const { ctx, page } = await open(seed); await startRun(page, false);
    await fly(page, [[-44, 3.6, 214], [-44, 3.2, 197]], 2); await page.waitForTimeout(300); await shot(page, `harbour-${seed}`);
    await ctx.close();
  }
}
if (want('delivery') || want('over')) {
  const { ctx, page } = await open(130); await startRun(page, false);
  const legs = []; let shotDone = false;
  for (let leg = 0; leg < 6; leg++) {
    const o = await page.evaluate(() => { const d = window.__THREE_GAME_DIAGNOSTICS__; return { ...d.objective.position, phase: d.objective.phase, del: d.deliveries }; });
    // approach along the nearest road, then in to the pad
    const R = [-154, -110, -66, -22, 22, 66, 110, 154]; const nr = (v) => R.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
    const onX = Math.abs(o.x - nr(o.x)) < Math.abs(o.z - nr(o.z));
    const road = onX ? [nr(o.x), o.z] : [o.x, nr(o.z)];
    const back = onX ? [road[0], road[1] + 30] : [road[0] + 30, road[1]];
    await fly(page, [[back[0], 5, back[1]], [road[0], 3.5, road[1]], [o.x, o.y + 1.4, o.z]], 3.2);
    const done = await page.evaluate(([o]) => { const G = window.__GAME__; const D = () => window.__THREE_GAME_DIAGNOSTICS__; const ph = D().objective.phase + D().objective.name;
      for (let k = 0; k < 400; k++) { G.place(o.x, o.y + 0.7, o.z, D().player.yaw, 0); G.advance(1 / 60, false); if (D().objective.phase + D().objective.name !== ph) return { k, score: D().score, del: D().deliveries, tier: D().goals?.tierName }; }
      return null; }, [o]);
    legs.push({ phase: o.phase, ...done });
    if (o.phase === 'deliver' && !shotDone && want('delivery')) {
      shotDone = true;
      await page.evaluate(() => { const G = window.__GAME__; const y = window.__THREE_GAME_DIAGNOSTICS__.player.yaw; const p = window.__THREE_GAME_DIAGNOSTICS__.player.position; for (let i = 0; i < 24; i++) { G.place(p.x, p.y + i * 0.05, p.z, y, 0); G.advance(1 / 60, i === 23); } });
      await page.waitForTimeout(420); await shot(page, 'delivery-130');
    }
    if (legs.filter((l) => l.phase === 'deliver').length >= 3) break;
  }
  console.log('LEGS', JSON.stringify(legs));
  if (want('over')) {
    await page.evaluate(() => { const G = window.__GAME__; G.manualRender(false); G.end(); });
    await page.waitForTimeout(2500); await shot(page, 'over-130');
    console.log('OVER', await page.evaluate(() => document.getElementById('over-medal-name')?.innerText + ' | ' + document.getElementById('over-score')?.innerText));
  }
  await ctx.close();
}
await browser.close();
