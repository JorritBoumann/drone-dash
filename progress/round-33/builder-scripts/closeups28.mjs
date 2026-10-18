// Round 28 critic (new): (1) every street prop instance and near-tree / car instance read from the live scene (scene caught
// by patching Object3D.updateMatrixWorld on the page's own three module), each prop's base checked against the ground by a
// ray straight down onto the city meshes (float / sink); (2) close-up renders of each car model beside people and a door,
// both tree species and the props (scale and style). Seed 22 and 130, desktop.
import { chromium } from '@playwright/test';
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const SEEDS = (process.env.SEEDS || '22,130').split(',').map(Number);
const browser = await chromium.launch({ channel: 'chromium' });
for (const seed of SEEDS) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto('http://127.0.0.1:5190/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
  await page.evaluate(() => { window.__GAME__.start(); window.__GAME__.manualRender(true); });
  await page.waitForFunction(() => window.__GAME__.assetsReady().on, null, { timeout: 30000 });
  const url = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name).find((n) => /\/deps\/three\.js/.test(n)));
  await page.evaluate(async (u) => { const T = await import(u); window.__T = T; const o = T.Object3D.prototype.updateMatrixWorld;
    T.Object3D.prototype.updateMatrixWorld = function (f) { if (this.isScene) window.__scene = this; return o.call(this, f); }; }, url);
  await page.evaluate(() => { const G = window.__GAME__; G.place(22, 3, 40, 0, 0); G.advance(1 / 20, true); });
  const ok = await page.evaluate(() => !!window.__scene); console.log('SCENE', seed, ok);
  // sweep the drone over a grid so every prop / tree gets drawn once; collect instance positions per mesh name
  const res = await page.evaluate(() => {
    const T = window.__T, S = window.__scene, G = window.__GAME__;
    const ground = []; S.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && !o.isBatchedMesh && !o.isSkinnedMesh && o.visible && o.geometry && o.geometry.getAttribute('position').count > 2000) ground.push(o); });
    const seen = new Map(); const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
    for (let x = -150; x <= 150; x += 25) for (let z = -150; z <= 150; z += 25) {
      G.place(x, 3, z, 0, 0); G.advance(1 / 20, false); G.advance(1 / 60, true);
      S.traverse((o) => { if (!o.isInstancedMesh || !/^street-props-|^tree-/.test(o.name)) return;
        for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); m.decompose(p, q, s); if (s.x === 0) continue; const k = o.name + ':' + p.x.toFixed(2) + ',' + p.z.toFixed(2); if (!seen.has(k)) seen.set(k, { name: o.name, x: p.x, y: p.y, z: p.z, minY: (o.geometry.boundingBox || (o.geometry.computeBoundingBox(), o.geometry.boundingBox)).min.y * s.y }); } });
    }
    const rc = new T.Raycaster(); const down = new T.Vector3(0, -1, 0);
    const stats = {}; const bad = [];
    for (const v of seen.values()) {
      rc.set(new T.Vector3(v.x, v.y + 1.5, v.z), down); rc.far = 6;
      const hit = rc.intersectObjects(ground, false)[0];
      const gy = hit ? hit.point.y : null; const base = v.y + v.minY; const d = gy === null ? null : base - gy;
      const st = stats[v.name] || (stats[v.name] = { n: 0, noGround: 0, float: 0, sink: 0, maxUp: -9, maxDown: 9 });
      st.n++; if (d === null) { st.noGround++; continue; }
      st.maxUp = Math.max(st.maxUp, d); st.maxDown = Math.min(st.maxDown, d);
      if (d > 0.06) { st.float++; if (bad.length < 30) bad.push({ ...v, gy, d }); } if (d < -0.12) { st.sink++; if (bad.length < 30) bad.push({ ...v, gy, d }); }
    }
    return { stats, bad, total: seen.size, groundMeshes: ground.length };
  });
  console.log('FLOAT', seed, JSON.stringify(res));
  // close-ups: cars of each type with people, trees, props
  const shots = await page.evaluate(() => { const G = window.__GAME__; G.place(22, 3, 40, 0, 0); G.advance(1 / 20, false);
    const cars = G.traffic().filter((c) => c.kind === 'car'); const out = {};
    for (const t of [0, 1, 2, 3, 4]) { const c = cars.find((c) => c.type === t && c.mode === 'lane'); if (c) out['car' + t] = c; } return out; });
  for (const [name, c] of Object.entries(shots)) {
    await page.evaluate(([c]) => { const G = window.__GAME__; G.place(c.x + 12, 20, c.z + 12, 0, 0); G.advance(1 / 60, false);
      const sx = -c.fz, sz = c.fx; G.renderFrom(c.x + sx * 5.5 + c.fx * 2, 1.7, c.z + sz * 5.5 + c.fz * 2, c.x, 0.9, c.z); }, [c]);
    await page.screenshot({ path: OUT + `close28-${seed}-${name}.jpg`, type: 'jpeg', quality: 80 });
    console.log('CAR', seed, name, JSON.stringify({ type: c.type, len: c.len, wid: c.wid, h: c.y1 }));
  }
  const pts = await page.evaluate(() => { const S = window.__scene, T = window.__T, m = new T.Matrix4(), p = new T.Vector3(); const out = [];
    S.traverse((o) => { if (o.isInstancedMesh && /^street-props-|^tree-.*canop/.test(o.name) && o.count > 0) { o.getMatrixAt(Math.floor(o.count / 2), m); p.setFromMatrixPosition(m); out.push({ name: o.name, x: p.x, y: p.y, z: p.z }); } }); return out; });
  for (const q of pts) {
    await page.evaluate(([q]) => { const G = window.__GAME__; G.place(q.x, 3, q.z + 0.01, 0, 0); G.advance(1 / 60, false); G.renderFrom(q.x + 3.2, 1.7, q.z + 3.2, q.x, q.name.startsWith('tree') ? 2.5 : 0.6, q.z); }, [q]);
    await page.screenshot({ path: OUT + `close28-${seed}-${q.name}.jpg`, type: 'jpeg', quality: 80 });
  }
  console.log('PROPSHOTS', seed, pts.map((q) => q.name).join(' '));
  await page.context().close();
}
await browser.close();
