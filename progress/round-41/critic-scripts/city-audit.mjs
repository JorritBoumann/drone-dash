// Round 15 critic (new): city-audit. Loads the game N times with no ?seed (a real random city each time) and checks:
// spawn (inside geometry? drifts or crashes with no input?), first pickup distance, and every pad with my own audit
// (stricter than the builder's: 1.5 m clear column up to the ceiling, buried sphere, awnings, pad height vs ceiling,
// doorstep distance to the nearest road), plus the builder's padAudit hook for comparison. Read-only.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const OUT = (process.env.OUTDIR || new URL('../critic/', import.meta.url).pathname);
const N = Number(process.env.N || 24); const SEEDS = process.env.SEEDS ? process.env.SEEDS.split(',') : null;
const browser = await chromium.launch({ channel: 'chromium' });
const rows = [];
for (let i = 0; i < (SEEDS ? SEEDS.length : N); i++) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('http://127.0.0.1:5191/' + (SEEDS ? '?seed=' + SEEDS[i] : ''), { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
  const r = await page.evaluate(async () => {
    const G = window.__GAME__; const city = G.city(); const seed = city.seed;
    const { generateCity } = await import('/src/world/CityGenerator.ts');
    const { createSeededRandom } = await import('/src/core/random.ts');
    const L = generateCity(createSeededRandom(seed));
    const dXZ = (b, x, z) => Math.hypot(Math.max(b.minX - x, 0, x - b.maxX), Math.max(b.minZ - z, 0, z - b.maxZ));
    const inBox = (b, x, y, z, r) => Math.hypot(dXZ(b, x, z), Math.max(b.minY - y, 0, y - b.maxY)) < r;
    const nearRoad = (v) => Math.min(...L.roadCenters.map((c) => Math.abs(c - v)));
    const issues = [], tight = [];
    for (const s of L.sites) {
      const { x, y, z } = s.pos; const hy = y + 0.95 + 0.25;
      for (const b of L.colliders) {
        if (b.maxY <= y + 0.35) continue;
        if (inBox(b, x, hy, z, 0.95)) { issues.push({ site: s.name, kind: s.kind, p: 'buried', d: `top ${b.maxY.toFixed(1)}` }); continue; }
        if (dXZ(b, x, z) < 1.5 && b.minY < 105) (dXZ(b, x, z) < 1.2 ? issues : tight).push({ site: s.name, kind: s.kind, p: 'overhang', d: `${b.minY.toFixed(1)}-${b.maxY.toFixed(1)} at ${dXZ(b, x, z).toFixed(2)}${b.soft ? ' soft' : ''}` });
      }
      for (const b of L.awnings) if (dXZ(b, x, z) < 1.2) (dXZ(b, x, z) < 0.95 ? issues : tight).push({ site: s.name, kind: s.kind, p: 'awning', d: dXZ(b, x, z).toFixed(2) });
      if (y > 95) issues.push({ site: s.name, kind: s.kind, p: 'high', d: y.toFixed(1) });
      if (Math.abs(x) > L.half || Math.abs(z) > L.half) issues.push({ site: s.name, kind: s.kind, p: 'outside', d: `${x.toFixed(0)},${z.toFixed(0)}` });
      if (s.kind === 'doorstep' && Math.min(nearRoad(x), nearRoad(z)) > 14) issues.push({ site: s.name, kind: s.kind, p: 'far-from-road', d: Math.min(nearRoad(x), nearRoad(z)).toFixed(1) });
    }
    const kinds = {}; for (const s of L.sites) kinds[s.kind] = (kinds[s.kind] || 0) + 1;
    const towers = L.sites.filter((s) => s.kind === 'rooftop' && s.pos.y > 26).length; const maxPad = Math.max(...L.sites.map((s) => s.pos.y));
    const hmax = Math.max(...L.colliders.map((b) => b.maxY)); const parks = L.sites.filter((s) => s.kind === 'park').map((s) => `${Math.round(s.pos.x)},${Math.round(s.pos.z)}`);
    const builder = G.padAudit ? G.padAudit([seed])[0].issues : null;
    L.geometry.dispose();
    const d0 = window.__THREE_GAME_DIAGNOSTICS__; const sp = d0.player.position;
    const spawnHit = L.colliders.filter((b) => inBox(b, sp.x, sp.y, sp.z, 0.95)).length;
    G.start(); G.manualRender(true); let d = G.advance(0.05, false); const start = { ...d.player.position }; const o = d.objective.position;
    const first = { name: d.objective.name, straight: Math.hypot(o.x - start.x, o.z - start.z), dy: o.y - start.y, grid: Math.abs(o.x - start.x) + Math.abs(o.z - start.z) };
    d = G.advance(3, false); const drift = Math.hypot(d.player.position.x - start.x, d.player.position.z - start.z);
    return { seed, mode: city.mode, sites: L.sites.length, kinds, towers, maxPad, hmax, parks: parks.length, buildings: d.world.buildings, trees: d.world.trees, spawn: { x: sp.x, y: sp.y, z: sp.z, hit: spawnHit, crashes3s: d.crashes, drift3s: drift, dy3s: d.player.position.y - start.y }, first, issues, tight: tight.length, tightEx: tight.slice(0, 2), builder };
  });
  r.errors = errs.length;
  const bad = r.issues.length > 0 || r.spawn.hit > 0 || r.spawn.crashes3s > 0 || r.first.straight > 120;
  if (i < 4 || bad) { await page.evaluate(() => window.__GAME__.advance(0.0001, true)); await page.screenshot({ path: OUT + `V-city${r.seed}-start${bad ? '-BAD' : ''}.jpg`, type: 'jpeg', quality: 80 }); }
  if (r.issues.length) {
    // fly the camera to the first bad pad: place the drone 7 m above it and render
    const s = await page.evaluate((name) => window.__GAME__.sites().find((q) => q.name === name), r.issues[0].site);
    await page.evaluate((s) => { window.__GAME__.place(s.x, s.y + 7, s.z + 6, 0, 0); window.__GAME__.advance(0.6, true); }, s);
    await page.screenshot({ path: OUT + `V-city${r.seed}-pad-${r.issues[0].p}.jpg`, type: 'jpeg', quality: 80 });
  }
  rows.push(r); console.log('CITY ' + JSON.stringify(r));
  await page.close();
}
const fs1 = rows.map((r) => r.first.straight).sort((a, b) => a - b);
console.log('SUMMARY ' + JSON.stringify({ n: rows.length, distinctSeeds: new Set(rows.map((r) => r.seed)).size, withIssues: rows.filter((r) => r.issues.length).length, issues: rows.reduce((a, r) => a + r.issues.length, 0), tight: rows.reduce((a, r) => a + r.tight, 0), builderIssues: rows.reduce((a, r) => a + (r.builder ? r.builder.length : 0), 0), spawnHit: rows.filter((r) => r.spawn.hit).length, spawnCrash: rows.filter((r) => r.spawn.crashes3s).length, firstMin: fs1[0], firstMed: fs1[fs1.length >> 1], firstMax: fs1[fs1.length - 1], errors: rows.reduce((a, r) => a + r.errors, 0), towers: rows.map((r) => r.towers), hmax: rows.map((r) => Math.round(r.hmax)), parks: rows.map((r) => r.parks) }));
fs.writeFileSync(OUT + 'city-audit.json', JSON.stringify(rows, null, 1));
await browser.close();
