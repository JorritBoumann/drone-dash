// Round 18 critic (new): fly straight through every alley and tunnel on the given cities, from the road at one mouth to the
// road at the other, along the graph's centre line, at fixed height Y and entry speed SPD, holding W only (no steering, no
// boost). Logs charged crashes, free bumps, the worst lateral drift and the time. Tests that the street graph matches the
// built geometry and that a straight line through each feature is clean.
import { chromium } from '@playwright/test';
const OUT = new URL('./out/', import.meta.url).pathname;
const seeds = (process.env.SEEDS || '66352').split(','); const Y = Number(process.env.Y || 4.5); const SPD = Number(process.env.SPD || 14);
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
let tot = 0, bad = 0, shots = 0;
for (const seed of seeds) {
  await page.goto('http://127.0.0.1:5190/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
  await page.evaluate(() => { window.__GAME__.externalClock(true); window.__GAME__.start(); window.__GAME__.manualRender(true); });
  const feats = await page.evaluate(() => { const g = window.__GAME__; return g.features().filter((f) => f.kind !== 'diagonal').map((f) => { const rz = g.streetRoute({ x: f.x, z: f.z - 22 }, { x: f.x, z: f.z + 22 }, true); return { ...f, axis: rz.names.includes(f.name) && rz.length < 50 ? 'z' : 'x' }; }); });
  for (const f of feats) {
    for (const dir of [1, -1]) {
      const half = 22; // block centre to road centre
      const sx = f.axis === 'x' ? f.x - dir * half : f.x, sz = f.axis === 'z' ? f.z - dir * half : f.z;
      const yaw = f.axis === 'z' ? (dir > 0 ? Math.PI : 0) : (dir > 0 ? -Math.PI / 2 : Math.PI / 2);
      const res = await page.evaluate(async ([sx, sz, yaw, Y, SPD, axis, fx, fz, dir]) => {
        const g = window.__GAME__; g.key('KeyW', false);
        g.place(sx, Y, sz, yaw, SPD); let d = g.advance(0.02, false); const c0 = d.crashes; let bumps = 0, drift = 0, t = 0, minSp = 99;
        g.key('KeyW', true);
        while (t < 6) {
          d = g.advance(0.05, false); t += 0.05; const p = d.player.position;
          if (d.contact && d.contact.bump > 0) bumps++;
          const lat = axis === 'z' ? p.x - fx : p.z - fz; drift = Math.max(drift, Math.abs(lat)); minSp = Math.min(minSp, d.player.speed);
          const along = axis === 'z' ? (p.z - fz) * dir : (p.x - fx) * dir;
          if (along > 22) break;
        }
        g.key('KeyW', false);
        return { crashes: d.crashes - c0, bumps, drift: +drift.toFixed(2), t: +t.toFixed(2), minSp: +minSp.toFixed(1), y: +d.player.position.y.toFixed(1) };
      }, [sx, sz, yaw, Y, SPD, f.axis, f.x, f.z, dir]);
      tot++; if (res.crashes || res.bumps) bad++;
      console.log(JSON.stringify({ seed, kind: f.kind, name: f.name, axis: f.axis, dir, ...res }));
      if ((res.crashes || res.bumps) && shots < 6) { shots++; await page.evaluate(() => window.__GAME__.advance(0.0001, true)); await page.screenshot({ path: OUT + `A-seed${seed}-${f.name.replace(/\s/g, '')}-${dir}.jpg`, type: 'jpeg', quality: 80 }); }
      await page.evaluate(() => { window.__GAME__.restart(); });
      await page.evaluate(() => { window.__GAME__.externalClock(true); window.__GAME__.start(); window.__GAME__.manualRender(true); });
    }
  }
}
console.log(`ALLEYFLY Y ${Y} SPD ${SPD}: passes ${tot}, with a crash or bump ${bad}`);
await browser.close();
