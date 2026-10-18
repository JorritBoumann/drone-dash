// Round 29 critic (new): does the round 29 view culling of far trees pop in view? Deterministic (manualRender, 60 Hz steps,
// a frame drawn every step). The drone hovers at a spot; the camera is orbited fast with the game's own view hook (as a
// right-drag would) at a few pitches, and the drone itself is spun fast (yaw). After every frame: the live render camera
// (caught by patching lookAt) and the blob canopy instances ('tree-canopies'). A tree is an LOD tree if its blob
// disappears at some heading (its model took over). A pop risk is an LOD tree drawn as a blob while inside the camera's
// frustum and inside the model range (22.5 m to range - 1.5 m). People: the culled set uses the same frustum (code read);
// here the count of people drawn is logged per frame to see jumps. SEED, MOBILE=1.
import { chromium, devices } from '@playwright/test';
const OUT = (process.env.OUTDIR || new URL('../builder-shots/', import.meta.url).pathname);
const MOBILE = !!process.env.MOBILE, SEED = process.env.SEED || '130';
const SPOTS = JSON.parse(process.env.SPOTS || '[[-60,3,30],[30,16,60],[-60,8,90],[30,3,60]]');
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } })).newPage();
await page.goto('http://127.0.0.1:5190/?seed=' + SEED, { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
await page.waitForFunction(() => window.__GAME__.assetsReady().on, null, { timeout: 30000 });
const url = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name).find((n) => /\/deps\/three\.js/.test(n)));
await page.evaluate(async (u) => { const T = await import(u); window.__T = T; const o = T.Object3D.prototype.updateMatrixWorld;
  T.Object3D.prototype.updateMatrixWorld = function (f) { if (this.isScene) window.__scene = this; return o.call(this, f); };
  const la = T.Object3D.prototype.lookAt; T.Object3D.prototype.lookAt = function (...a) { if (this.isPerspectiveCamera) window.__cam = this; return la.apply(this, a); }; }, url);
const all = [];
for (const [x, y, z] of SPOTS) {
  const r = await page.evaluate(([x, y, z, MOBILE]) => {
    const T = window.__T, G = window.__GAME__;
    G.place(x, y, z, 0, 0); G.advance(1 / 60, true);
    const S = window.__scene, B = S.getObjectByName('tree-canopies');
    const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3(), F = new T.Frustum(), PM = new T.Matrix4(), sph = new T.Sphere();
    const frames = [];
    const sample = (tag) => {
      const C = window.__cam; C.updateMatrixWorld(); PM.multiplyMatrices(C.projectionMatrix, C.matrixWorldInverse); F.setFromProjectionMatrix(PM);
      const cp = C.position; const tr = (MOBILE ? 62 : 80) * (cp.y > 25 ? Math.max(0.55, 1 - (cp.y - 25) / 60) : 1);
      const blobs = [];
      for (let i = 0; i < B.count; i++) { B.getMatrixAt(i, m); m.decompose(p, q, s); if (s.x === 0) continue; const d = Math.hypot(p.x - cp.x, p.z - cp.z);
        if (d > 22.5 && d < tr - 1.5) blobs.push({ k: p.x.toFixed(1) + ',' + p.z.toFixed(1), d, inF: F.intersectsSphere(sph.set(p, 2.2 * Math.max(1, s.y))) }); }
      const ppl = []; S.traverse((o) => { if (o.isInstancedMesh && /people|ped/i.test(o.name)) ppl.push(o.name + ':' + o.count); });
      frames.push({ tag, blobs, ppl: ppl.join('|') });
    };
    // 1) slow full turn (to learn which blobs are LOD trees): drone yaw in 72 steps, settled
    const seenAt = new Map();
    for (let i = 0; i < 72; i++) { const yaw = i * Math.PI / 36; for (let k = 0; k < 3; k++) { G.place(x, y, z, yaw, 0); G.advance(1 / 60, true); } sample('slow');
      const f = frames[frames.length - 1]; for (const b of f.blobs) seenAt.set(b.k, (seenAt.get(b.k) || 0) + 1); }
    const lod = new Set([...seenAt].filter(([, n]) => n < 72).map(([k]) => k));
    // 2) fast orbit with the view hook at three pitches, 3) fast drone spin
    for (const pitch of [0, -0.5, 0.35]) {
      G.place(x, y, z, 0, 0); G.view(0, pitch, 0, false); G.advance(1 / 60, true);
      for (let i = 0; i < 120; i++) { G.place(x, y, z, 0, 0); G.view(0.09, 0, 0, true); G.advance(1 / 60, true); sample('orbit' + pitch); }
      G.view(0, 0, 0, false); for (let i = 0; i < 30; i++) { G.place(x, y, z, 0, 0); G.advance(1 / 60, true); }
    }
    for (let i = 0; i < 120; i++) { G.place(x, y, z, i * 0.1, 0); G.advance(1 / 60, true); sample('spin'); }
    const fast = frames.filter((f) => f.tag !== 'slow');
    const pops = fast.map((f) => f.blobs.filter((b) => lod.has(b.k) && b.inF)); const slowPops = frames.filter((f) => f.tag === 'slow').map((f) => f.blobs.filter((b) => lod.has(b.k) && b.inF));
    const ex = []; fast.forEach((f, i) => { if (pops[i].length && ex.length < 6) ex.push({ tag: f.tag, n: pops[i].length, d: pops[i].map((b) => +b.d.toFixed(1)).slice(0, 4) }); });
    return { spot: [x, y, z], lodTrees: lod.size, fastFrames: fast.length, framesWithPop: pops.filter((p) => p.length).length, maxPerFrame: Math.max(0, ...pops.map((p) => p.length)),
      slowFramesWithPop: slowPops.filter((p) => p.length).length, ex, ppl: [...new Set(fast.map((f) => f.ppl))].slice(0, 3) };
  }, [x, y, z, MOBILE]);
  console.log('POP', MOBILE ? 'mobile' : 'desktop', SEED, JSON.stringify(r)); all.push(r);
}
// a fast-orbit filmstrip at the first spot: 4 frames 1/15 s apart while turning (to look for popping by eye)
if (process.env.SHOTS) {
  const [x, y, z] = SPOTS[0];
  await page.evaluate(([x, y, z]) => { const G = window.__GAME__; G.place(x, y, z, 0, 0); G.view(0, -0.15, 0, false); for (let i = 0; i < 10; i++) { G.place(x, y, z, 0, 0); G.advance(1 / 60, true); } }, [x, y, z]);
  for (let f = 0; f < 4; f++) {
    await page.evaluate(([x, y, z]) => { const G = window.__GAME__; for (let i = 0; i < 4; i++) { G.place(x, y, z, 0, 0); G.view(0.12, 0, 0, true); G.advance(1 / 60, true); } }, [x, y, z]);
    await page.screenshot({ path: OUT + `pop29-${MOBILE ? 'm' : 'd'}-${SEED}-f${f}.jpg`, type: 'jpeg', quality: 80 });
  }
}
await browser.close();
