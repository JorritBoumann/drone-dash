// Round 29 critic (new): wheels. Deterministic (manualRender + advance at 20 Hz, a frame drawn each step).
// The live scene is caught by patching Object3D.updateMatrixWorld on the page's three module (as closeups28.mjs).
// Each step: every near car (under 52 m from the drone, which carries the LOD camera) and the 'traffic-wheels' instances
// inside its footprint. Checks: wheel count per car; wheel bottom height (centre y minus radius); spin (the wheel's turn
// about its axle between steps, times radius, against the car's own distance moved); steer angle of the front wheels on
// turns (sign against the turn direction). Then side views at street level for each car type, and a turning car.
import { chromium } from '@playwright/test';
const OUT = new URL('./out/', import.meta.url).pathname;
const SEEDS = (process.env.SEEDS || '22,130').split(',').map(Number);
const browser = await chromium.launch({ channel: 'chromium' });
for (const seed of SEEDS) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto('http://127.0.0.1:5190/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
  await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
  await page.waitForFunction(() => window.__GAME__.assetsReady().on, null, { timeout: 30000 });
  const url = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name).find((n) => /\/deps\/three\.js/.test(n)));
  await page.evaluate(async (u) => { const T = await import(u); window.__T = T; const o = T.Object3D.prototype.updateMatrixWorld;
    T.Object3D.prototype.updateMatrixWorld = function (f) { if (this.isScene) window.__scene = this; return o.call(this, f); }; }, url);
  const res = await page.evaluate(() => {
    const T = window.__T, G = window.__GAME__; G.place(22, 3, 40, 0, 0); G.advance(1 / 20, true);
    const S = window.__scene, W = S.getObjectByName('traffic-wheels');
    if (!W) return { err: 'no traffic-wheels' };
    const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3(), qc = new T.Quaternion(), up = new T.Vector3(0, 1, 0);
    const st = { steps: 0, nearCars: 0, wheelCount: {}, byType: {}, bottom: { min: 9, max: -9 }, spin: [], steerTurn: [], steerLane: [], orphan: 0, wheelsTotal: 0 };
    const prevW = new Map(); // car key -> {x,z,spin[]}
    // a few drone spots down avenues (camera follows the drone), rush on half the time
    const spots = [[22, 3, 40, 0], [-22, 3, -60, Math.PI], [66, 3, 10, Math.PI / 2], [-110, 3, 30, -Math.PI / 2], [154, 3, 0, 0], [0, 3, 154, Math.PI / 2]];
    let k = 0;
    for (const [x, y, z, yaw] of spots) {
      G.rush(k++ % 2 === 1); prevW.clear();
      for (let i = 0; i < 60; i++) {
        G.place(x, y, z, yaw, 0); G.advance(1 / 20, true); st.steps++;
        const cm = window.__THREE_GAME_DIAGNOSTICS__.camera; const cars = G.traffic().filter((c) => c.kind === 'car' && Math.hypot(c.x - cm.x, c.z - cm.z) < 52);
        const wl = []; for (let j = 0; j < W.count; j++) { W.getMatrixAt(j, m); m.decompose(p, q, s); wl.push({ x: p.x, y: p.y, z: p.z, r: s.y, q: q.clone(), used: false }); }
        st.wheelsTotal = Math.max(st.wheelsTotal, W.count);
        for (const c of cars) {
          st.nearCars++;
          const mine = wl.filter((w) => { const dx = w.x - c.x, dz = w.z - c.z; const al = dx * c.fx + dz * c.fz, lat = dx * c.fz - dz * c.fx; return Math.abs(al) < c.len / 2 + 0.4 && Math.abs(lat) < c.wid / 2 + 0.5; });
          mine.forEach((w) => (w.used = true));
          st.wheelCount[mine.length] = (st.wheelCount[mine.length] || 0) + 1;
          const bt = (st.byType[c.type] = st.byType[c.type] || { n: 0, wheels: {} }); bt.n++; bt.wheels[mine.length] = (bt.wheels[mine.length] || 0) + 1;
          qc.setFromAxisAngle(up, Math.atan2(c.fx, c.fz)).invert();
          const ang = mine.map((w) => { const lq = qc.clone().multiply(w.q); const ax = new T.Vector3(1, 0, 0).applyQuaternion(lq); const steer = Math.atan2(-ax.z, ax.x);
            const v = new T.Vector3(0, 1, 0).applyQuaternion(lq).applyAxisAngle(up, -steer); const al = (w.x - c.x) * c.fx + (w.z - c.z) * c.fz;
            st.bottom.min = Math.min(st.bottom.min, w.y - w.r); st.bottom.max = Math.max(st.bottom.max, w.y - w.r);
            return { steer, spin: Math.atan2(v.z, v.y), al, r: w.r }; });
          const key = c.type + ':' + Math.round(c.x / 6) + ':' + Math.round(c.z / 6);
          // match last step's record by nearest position (cars move < 1 m a step)
          let best = null, bd = 2.5; for (const [kk, v] of prevW) { const dd = Math.hypot(v.x - c.x, v.z - c.z); if (dd < bd && v.type === c.type) { bd = dd; best = kk; } }
          if (best && ang.length && prevW.get(best).ang.length === ang.length) {
            const pv = prevW.get(best); const moved = Math.hypot(c.x - pv.x, c.z - pv.z);
            let ds = ang[0].spin - pv.ang[0].spin; ds = Math.atan2(Math.sin(ds), Math.cos(ds));
            if (moved > 0.05 && moved < 1.5) st.spin.push([+moved.toFixed(3), +(ds * ang[0].r).toFixed(3)]);
            if (moved < 0.01) st.spin.push([0, +(ds * ang[0].r).toFixed(3)]);
            let dyaw = Math.atan2(c.fx, c.fz) - pv.yaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
            const front = ang.filter((a) => a.al > 0.3), rear = ang.filter((a) => a.al < -0.3);
            const fs = front.length ? front.reduce((a, b) => a + b.steer, 0) / front.length : 0, rs = rear.length ? Math.max(...rear.map((a) => Math.abs(a.steer))) : 0;
            if (c.mode === 'turn' && moved > 0.1) st.steerTurn.push([+dyaw.toFixed(3), +fs.toFixed(3), +rs.toFixed(3)]);
            else if (c.mode === 'lane' && moved > 0.1 && Math.abs(dyaw) < 0.001) st.steerLane.push(+Math.abs(fs).toFixed(3));
            prevW.delete(best);
          }
          prevW.set(key + ':' + st.steps, { x: c.x, z: c.z, type: c.type, yaw: Math.atan2(c.fx, c.fz), ang });
        }
        st.orphan += wl.filter((w) => !w.used && Math.hypot(w.x - cm.x, w.z - cm.z) < 49).length;
      }
    }
    // summaries
    const sp = st.spin.filter((r) => r[0] > 0); const err = sp.map((r) => Math.abs(r[1] - r[0]) / r[0]); err.sort((a, b) => a - b);
    const still = st.spin.filter((r) => r[0] === 0);
    const tt = st.steerTurn; const sameSign = tt.filter((r) => Math.abs(r[0]) > 0.01 && Math.sign(r[0]) === Math.sign(r[1]) && Math.abs(r[1]) > 0.03).length;
    const sl = st.steerLane.slice().sort((a, b) => a - b);
    return { steps: st.steps, nearCars: st.nearCars, wheelCount: st.wheelCount, byType: st.byType, bottom: st.bottom, orphanWheels: st.orphan, maxWheelInstances: st.wheelsTotal,
      spin: { n: sp.length, medianRelErr: err[err.length >> 1], p95RelErr: err[Math.floor(err.length * 0.95)], backwards: sp.filter((r) => r[1] < 0).length, stillN: still.length, stillMaxMove: Math.max(0, ...still.map((r) => Math.abs(r[1]))) },
      steer: { turnSamples: tt.length, turning: tt.filter((r) => Math.abs(r[0]) > 0.01).length, frontSteersIntoTurn: sameSign, maxFront: Math.max(0, ...tt.map((r) => Math.abs(r[1]))), maxRear: Math.max(0, ...tt.map((r) => r[2])), laneN: sl.length, laneP95: sl[Math.floor(sl.length * 0.95)] || 0, examples: tt.filter((r) => Math.abs(r[0]) > 0.01).slice(0, 6) } };
  });
  console.log('WHEELS', seed, JSON.stringify(res));
  // street-level screenshots: a side view of each car type at 6 m (drone beside it), and a turning car from the front
  if (seed === SEEDS[0] && !process.env.NOSHOT) {
    await page.evaluate(() => { const G = window.__GAME__; G.rush(true); G.place(22, 3, 40, 0, 0); for (let i = 0; i < 40; i++) G.advance(1 / 20, false); });
    const cars = await page.evaluate(() => { const out = {}; for (const c of window.__GAME__.traffic()) if (c.kind === 'car' && c.mode === 'lane' && !out[c.type]) out[c.type] = c; return out; });
    for (const [t, c] of Object.entries(cars)) {
      await page.evaluate((c) => { const G = window.__GAME__; const sx = -c.fz, sz = c.fx; const px = c.x + sx * 6, pz = c.z + sz * 6;
        G.place(c.x + sx * 11, 4, c.z + sz * 11, 0, 0); G.advance(1 / 60, false); G.place(c.x + sx * 11, 4, c.z + sz * 11, 0, 0);
        const now = G.traffic().find((q) => Math.hypot(q.x - c.x, q.z - c.z) < 3) || c; G.renderFrom(px + now.fx * 2, 1.3, pz + now.fz * 2, now.x, 0.6, now.z); }, c);
      await page.screenshot({ path: OUT + `car29-${seed}-t${t}-side6m.jpg`, type: 'jpeg', quality: 80 });
    }
    // a car mid-turn, seen from ahead and above the kerb
    let turned = false;
    for (let i = 0; i < 400 && !turned; i++) {
      turned = await page.evaluate(() => { const G = window.__GAME__; G.place(22, 3, 40, 0, 0); G.advance(1 / 20, false);
        const c = G.traffic().find((q) => q.kind === 'car' && q.mode === 'turn' && Math.hypot(q.x - 22, q.z - 40) < 45);
        if (!c) return false; for (let k = 0; k < 3; k++) { G.place(22, 3, 40, 0, 0); G.advance(1 / 20, false); }
        const n = G.traffic().find((q) => Math.hypot(q.x - c.x, q.z - c.z) < 3) || c; if (n.mode !== 'turn') return false;
        G.renderFrom(n.x + n.fx * 5 - n.fz * 2, 1.6, n.z + n.fz * 5 + n.fx * 2, n.x, 0.4, n.z); return true; });
    }
    if (turned) await page.screenshot({ path: OUT + `car29-${seed}-turning.jpg`, type: 'jpeg', quality: 80 });
    console.log('SHOTS', Object.keys(cars).join(','), 'turning', turned);
  }
  await page.context().close();
}
await browser.close();
