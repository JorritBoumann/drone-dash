// Round 19 critic (new): alley and tunnel ENTRY off a 90-degree turn at speed (the fairness question). Deterministic.
// For each alley/tunnel block: start on the cross road 45 m before the mouth, heading along the road at speed SPD and height Y
// (4.5 alley, 3.5 tunnel). Pilot: aims at the road crossing in front of the mouth; LEAD m before it, aims 12 m inside the
// alley (a cut corner, like a player). BRAKE=1 also brakes to 10 m/s for the turn. Counts charged crashes and bumps.
import { chromium } from '@playwright/test';
const OUT = '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/r30out/';
const seeds = (process.env.SEEDS || '16068').split(','); const SPD = Number(process.env.SPD || 16); const LEAD = Number(process.env.LEAD || 9); const BRAKE = !!process.env.BRAKE;
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
let tot = 0, bad = 0, crashT = 0, shots = 0; const byKind = {};
for (const seed of seeds) {
  await page.goto('http://127.0.0.1:5190/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(400);
  await page.evaluate(() => { window.__GAME__.externalClock(true); window.__GAME__.start(); window.__GAME__.manualRender(true); });
  const feats = await page.evaluate(() => { const g = window.__GAME__; return g.features().filter((f) => f.kind !== 'diagonal').map((f) => { const rz = g.streetRoute({ x: f.x, z: f.z - 22 }, { x: f.x, z: f.z + 22 }, true); return { ...f, axis: rz.names.includes(f.name) && rz.length < 50 ? 'z' : 'x' }; }); });
  for (const f of feats) for (const side of [1, -1]) {
    const res = await page.evaluate(([f, side, SPD, LEAD, BRAKE]) => {
      const g = window.__GAME__; for (const k of ['KeyW', 'KeyA', 'KeyD', 'KeyS', 'Space', 'ShiftLeft']) g.key(k, false);
      const Y = f.kind === 'tunnel' ? 3.5 : 4.5;
      // enter at the -axis end (north / west mouth). Cross road through (f.x, f.z-22) [axis z] or (f.x-22, f.z) [axis x].
      const A = f.axis === 'z' ? { x: f.x, z: f.z - 22 } : { x: f.x - 22, z: f.z };
      const start = f.axis === 'z' ? { x: f.x - side * 45, z: f.z - 22 } : { x: f.x - 22, z: f.z - side * 45 };
      const yaw = Math.atan2(-(A.x - start.x), -(A.z - start.z));
      const inside = f.axis === 'z' ? { x: f.x, z: f.z - 22 + 50 } : { x: f.x - 22 + 50, z: f.z };
      g.place(start.x, Y, start.z, yaw, SPD); let d = g.advance(0.02, false); const c0 = d.crashes; let bumps = 0, t = 0, turned = false, minSp = 99, prev = d.player.position;
      while (t < 12) {
        const p = d.player.position; const vx = (p.x - prev.x) / 0.05, vz = (p.z - prev.z) / 0.05; prev = { ...p };
        if (!turned && Math.hypot(A.x - p.x, A.z - p.z) < LEAD) turned = true;
        const w = turned ? inside : A; const head = Math.hypot(vx, vz) > 2 ? Math.atan2(vx, vz) : Math.atan2(A.x - start.x, A.z - start.z);
        let err = Math.atan2(w.x - p.x, w.z - p.z) - head; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
        const tgt = BRAKE && turned && Math.abs(err) > 0.3 ? 10 : SPD;
        g.key('KeyD', err < -0.06); g.key('KeyA', err > 0.06); g.key('KeyW', d.player.speed < tgt && Math.abs(err) < 1.2); g.key('KeyS', d.player.speed > tgt + 2);
        g.key('Space', p.y < Y - 0.6); g.key('ShiftLeft', p.y > Y + 0.6);
        d = g.advance(0.05, false); t += 0.05; if (d.contact && d.contact.bump > 0) bumps++; minSp = Math.min(minSp, d.player.speed);
        const q = d.player.position; const along = f.axis === 'z' ? q.z - (f.z - 22) : q.x - (f.x - 22);
        if (along > 30) break;
      }
      for (const k of ['KeyW', 'KeyA', 'KeyD', 'KeyS', 'Space', 'ShiftLeft']) g.key(k, false);
      const q = d.player.position; const along = f.axis === 'z' ? q.z - (f.z - 22) : q.x - (f.x - 22);
      return { crashes: d.crashes - c0, bumps, t: +t.toFixed(2), minSp: +minSp.toFixed(1), through: along > 30, end: [+q.x.toFixed(1), +q.y.toFixed(1), +q.z.toFixed(1)], turned };
    }, [f, side, SPD, LEAD, BRAKE]);
    tot++; if (res.crashes) bad++; byKind[f.kind] = byKind[f.kind] || { n: 0, crash: 0, through: 0 }; byKind[f.kind].n++; byKind[f.kind].crash += res.crashes ? 1 : 0; byKind[f.kind].through += res.through ? 1 : 0;
    console.log(JSON.stringify({ seed, kind: f.kind, name: f.name, axis: f.axis, side, ...res }));
    if ((res.crashes || !res.through) && shots < 3 && process.env.SHOTS) { shots++; await page.evaluate(() => window.__GAME__.advance(0.0001, true)); await page.screenshot({ path: OUT + `E-seed${seed}-${f.name.replace(/\s/g, '')}-spd${SPD}.jpg`, type: 'jpeg', quality: 80 }); }
    await page.evaluate(() => { window.__GAME__.restart(); window.__GAME__.externalClock(true); window.__GAME__.start(); window.__GAME__.manualRender(true); });
  }
}
console.log(`ENTRY SPD ${SPD} LEAD ${LEAD} BRAKE ${BRAKE}: entries ${tot}, with a charged crash ${bad} (${(bad / tot * 100).toFixed(0)}%) ${JSON.stringify(byKind)}`);
await browser.close();
