// Round 35 critic (new): water inside boat hulls, measured independently of the builder's cap mask.
// Fixed step (manualRender + advance). Per view three frames are rendered and read back inside the same task:
//   N  : the normal frame (saved as JPEG, flat check)
//   M  : the water's fragment output forced to magenta, caps as shipped ('depth')
//   M0 : the same with the caps off (positive control; on the round 34 control build there are no caps at all)
// Every magenta pixel near a boat is ray-marched against the drawn swell (G.waterShown) to its true water hit point.
// A hit inside the hull's core ellipse (0.36 len x 0.24 beam half axes, inside the waterline outline) is water seen inside
// the hull. Boats whose outline holds the camera below its rail height are skipped (camera inside that hull).
// Lid faults: pixels that differ between M and M0 where M0 is not water (the lid hid a boat part, a person, a wake...)
// or where M0 is water outside the generous hull outline (0.58 len x 0.58 beam): the lid hid sea beside the boat.
// Env: PORT (5191), SEEDS (130,22,33 = golden, morning, dusk), MOBILE=1, SWEEP=n time samples per kind, SHOTS=0,
// TAG (r35 / r34c), OUTDIR.
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
const OUT = (process.env.OUTDIR || '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/r38/shots/');
const PORT = process.env.PORT || '5190'; const TAG = process.env.TAG || (PORT === '5192' ? 'r34c' : 'r35');
const MOBILE = !!process.env.MOBILE; const SEEDS = (process.env.SEEDS || '130,22,33').split(',').map(Number);
const SHOTS = process.env.SHOTS !== '0'; const SWEEP = Number(process.env.SWEEP || 24);
const MOOD = { 130: 'golden', 22: 'morning', 33: 'dusk', 58: 'noon' };
const SUN = { golden: [-0.72, 0.34, -0.6], morning: [0.55, 0.62, -0.56], dusk: [0.78, 0.24, 0.58], noon: [-0.35, 0.72, 0.6] };
const browser = await chromium.launch({ channel: 'chromium' });
const summary = [];
for (const SEED of SEEDS) {
  const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => {
    window.__THREE_DEVTOOLS__ = new EventTarget(); window.__obs = [];
    window.__THREE_DEVTOOLS__.addEventListener('observe', (e) => window.__obs.push(e.detail));
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}${MOBILE ? '' : '&post=1'}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); G.place(0, 60, 0, 0, 0); });
  await page.waitForFunction(() => window.__GAME__.assetsReady().on && window.__GAME__.boats().length > 0, null, { timeout: 30000 });
  const setup = await page.evaluate(() => {
    const G = window.__GAME__; G.advance(3, false); window.__THREE_GAME_TEST_HOOKS__?.hideDebugUi?.(true);
    const scene = window.__obs.find((o) => o && o.isScene && o.getObjectByName('water'));
    const water = scene.getObjectByName('water'); const m = water.material;
    const ob = m.onBeforeCompile, ck = m.customProgramCacheKey;
    window.__mag = (on) => {
      if (on) {
        m.onBeforeCompile = function (sh, r) { ob.call(this, sh, r); sh.fragmentShader = sh.fragmentShader.replace(/\}\s*$/, '  gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);\n}'); };
        m.customProgramCacheKey = () => (ck ? ck.call(m) : '') + '|mag35';
      } else { m.onBeforeCompile = ob; m.customProgramCacheKey = ck; }
      m.needsUpdate = true;
    };
    window.__cams = [];
    scene.onBeforeRender = (r, s, cam) => { if (cam.isPerspectiveCamera) window.__cams.push({ w: cam.matrixWorld.elements.slice(), pi: cam.projectionMatrixInverse.elements.slice(), p: cam.projectionMatrix.elements.slice(), mi: cam.matrixWorldInverse.elements.slice() }); };
    // one frame of the whole pipeline: render from the pose, read the canvas back in the same task
    window.__frame = (c, t) => {
      window.__cams = []; G.renderFrom(c[0], c[1], c[2], t[0], t[1], t[2]);
      const cv = document.getElementById('game-canvas'); const gl = cv.getContext('webgl2');
      const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight; const px = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return { W, H, px, cam: window.__cams[window.__cams.length - 1] };
    };
    window.__jpeg = (f) => {
      const c2 = document.createElement('canvas'); c2.width = f.W; c2.height = f.H; const x = c2.getContext('2d'); const id = x.createImageData(f.W, f.H);
      for (let y = 0; y < f.H; y++) id.data.set(f.px.subarray((f.H - 1 - y) * f.W * 4, (f.H - y) * f.W * 4), y * f.W * 4);
      x.putImageData(id, 0, 0); return c2.toDataURL('image/jpeg', 0.8);
    };
    return { caps: typeof G.boatCaps === 'function', kinds: [...new Set(G.boats().map((b) => b.kind + (b.moving ? '' : '-moored')))] };
  });
  // one view: pose given in the boat's frame (u toward the bow, v to starboard, h above its water), re-read after each step
  const view = (b, cl, tl, save) => page.evaluate(([bi, cl, tl, save, caps]) => {
    const G = window.__GAME__; const b = G.boats()[bi];
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), px = Math.cos(b.yaw), pz = -Math.sin(b.yaw);
    const W = (l) => [b.x + fx * l[0] + px * l[1], b.water + l[2], b.z + fz * l[0] + pz * l[1]];
    const c = W(cl), t = W(tl);
    G.place(c[0], c[1] + 30, c[2], 0, 0); G.advance(1 / 60, false);
    const bb = G.boats(); const B = bb[bi];
    const fx2 = Math.sin(B.yaw), fz2 = Math.cos(B.yaw), px2 = Math.cos(B.yaw), pz2 = -Math.sin(B.yaw);
    const W2 = (l) => [B.x + fx2 * l[0] + px2 * l[1], B.water + l[2], B.z + fz2 * l[0] + pz2 * l[1]];
    const cam = W2(cl), tgt = W2(tl);
    const mag = (p, i) => p[i] > 110 && p[i + 2] > 110 && p[i + 1] < 60 && Math.abs(p[i] - p[i + 2]) < 90;
    if (caps) G.boatCaps('depth');
    window.__mag(false); const N = window.__frame(cam, tgt);
    window.__mag(true); const M = window.__frame(cam, tgt);
    if (caps) G.boatCaps('off'); const M0 = window.__frame(cam, tgt);
    if (caps) G.boatCaps('depth'); window.__mag(false);
    const { W: Wd, H } = M; const C = M.cam;
    // unproject (x, y in buffer px, bottom-left origin) to a world ray
    const mul = (m, v) => [0, 1, 2, 3].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * v[3]);
    const ray = (x, y) => {
      const nx = (x + 0.5) / Wd * 2 - 1, ny = (y + 0.5) / H * 2 - 1;
      const a = mul(C.pi, [nx, ny, -1, 1]), e = mul(C.pi, [nx, ny, 1, 1]);
      const A = mul(C.w, [a[0] / a[3], a[1] / a[3], a[2] / a[3], 1]), E = mul(C.w, [e[0] / e[3], e[1] / e[3], e[2] / e[3], 1]);
      const d = [E[0] - A[0], E[1] - A[1], E[2] - A[2]]; const L = Math.hypot(...d);
      return [A, d.map((q) => q / L)];
    };
    const hit = (o, d) => {
      // march between the planes water + 0.8 and water - 0.8 (local swell), then bisect
      const top = B.water + 0.8, bot = B.water - 0.8; if (d[1] >= 0 && o[1] > top) return null;
      let t0 = d[1] < 0 ? Math.max(0, (o[1] - top) / -d[1]) : 0; const t1 = d[1] < 0 ? (o[1] - bot) / -d[1] : 400;
      const f = (t) => (o[1] + d[1] * t) - G.waterShown(o[0] + d[0] * t, o[2] + d[2] * t);
      let prev = t0; for (let t = t0; t <= Math.min(t1, t0 + 400); t += 0.04) { if (f(t) < 0) { let lo = prev, hi = t; for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; if (f(m) < 0) hi = m; else lo = m; } return [o[0] + d[0] * hi, o[2] + d[2] * hi]; } prev = t; }
      return null;
    };
    const local = (q, h) => { const dx = q[0] - h.x, dz = q[1] - h.z; return [dx * Math.sin(h.yaw) + dz * Math.cos(h.yaw), dx * Math.cos(h.yaw) - dz * Math.sin(h.yaw)]; };
    const inE = (l, h, a, bfr) => (l[0] / (a * h.len)) ** 2 + (l[1] / (bfr * h.beam)) ** 2 < 1;
    // screen box of the boat (hull and rig)
    const P = (w) => { const v = mul(C.p, mul(C.mi, [w[0], w[1], w[2], 1])); return v[3] <= 0 ? null : [(v[0] / v[3] * 0.5 + 0.5) * Wd, (v[1] / v[3] * 0.5 + 0.5) * H]; };
    let x0 = Wd, x1 = 0, y0 = H, y1 = 0, behind = 0;
    for (const a of [-0.6, 0.6]) for (const s of [-0.6, 0.6]) for (const hh of [-1, B.kind === 'ferry' ? 6 : B.kind === 'sail' ? 9 : 2.5]) {
      const q = P(W2([a * B.len, s * B.beam, hh])); if (!q) { behind++; continue; }
      x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]);
    }
    if (behind) { x0 = 0; y0 = 0; x1 = Wd; y1 = H; }
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(Wd - 1, Math.ceil(x1)); y1 = Math.min(H - 1, Math.ceil(y1));
    const step = Wd > 1600 ? 3 : 2;
    const r = { kind: B.kind, moving: B.moving, roll: 0, box: (x1 - x0) * (y1 - y0), inHull: 0, inHull0: 0, lidNonWater: 0, lidOuterWater: 0, magN: 0, flat: 0, cam, B: { x: B.x, z: B.z, yaw: B.yaw, heave: B.heave } };
    const near = bb.filter((h) => Math.hypot(h.x - B.x, h.z - B.z) < 60 && !(inE(local([cam[0], cam[2]], h), h, 0.6, 0.6) && cam[1] < h.water + (h.kind === 'ferry' ? 6 : 1.2)));
    r.camInHull = bb.length - bb.filter((h) => !(inE(local([cam[0], cam[2]], h), h, 0.6, 0.6) && cam[1] < h.water + (h.kind === 'ferry' ? 6 : 1.2))).length;
    const ov = save ? new Uint8Array(M.px) : null;
    const cls = (pxs, x, y) => {
      const [o, d] = ray(x, y); const q = hit(o, d); if (!q) return 'none';
      for (const h of near) { const l = local(q, h); if (inE(l, h, 0.36, 0.24)) return 'in'; }
      for (const h of near) { const l = local(q, h); if (inE(l, h, 0.58, 0.58)) return 'rim'; }
      return 'out';
    };
    // enclosed water: magenta components (4-connected, full resolution) that do not touch the frame border; a pixel of
    // such a component whose water hit is not clear of the boat outline ('out') counts as a leak (water inside a hull)
    const enclosed = (F, mark) => {
      const lab = new Int32Array(Wd * H); let n = 0, leak = 0, maxComp = 0; const st = [];
      for (let p0 = 0; p0 < Wd * H; p0++) {
        if (lab[p0] || !mag(F.px, p0 * 4)) continue;
        n++; const comp = []; let border = false; st.push(p0); lab[p0] = n;
        while (st.length) { const p = st.pop(); comp.push(p); const x = p % Wd, y = (p - x) / Wd; if (x === 0 || y === 0 || x === Wd - 1 || y === H - 1) border = true;
          for (const q of [p - 1, p + 1, p - Wd, p + Wd]) { if (q < 0 || q >= Wd * H || lab[q]) continue; if ((q === p - 1 && x === 0) || (q === p + 1 && x === Wd - 1)) continue; if (mag(F.px, q * 4)) { lab[q] = n; st.push(q); } } }
        if (border) continue;
        const k = Math.max(1, Math.floor(comp.length / 400)); let inC = 0, tested = 0;
        for (let j = 0; j < comp.length; j += k) { const p = comp[j]; const c = cls(F.px, p % Wd, Math.floor(p / Wd)); tested++; if (c === 'in') inC++; }
        if (inC / tested >= 0.5) { leak += comp.length; maxComp = Math.max(maxComp, comp.length); if (mark) for (const p of comp) { mark[p * 4] = 0; mark[p * 4 + 1] = 255; mark[p * 4 + 2] = 0; } }
      }
      return { leak, maxComp };
    };
    const e1 = enclosed(M, ov), e0 = enclosed(M0, null);
    r.leak = e1.leak; r.leakMax = e1.maxComp; r.leak0 = e0.leak;
    for (let y = y0; y <= y1; y += step) for (let x = x0; x <= x1; x += step) {
      const i = (y * Wd + x) * 4;
      if (mag(N.px, i)) r.magN++;
      const m1 = mag(M.px, i), m0 = mag(M0.px, i);
      if (m1 && cls(M.px, x, y) === 'in') r.inHull++;
      if (m0 && cls(M0.px, x, y) === 'in') r.inHull0++;
      const same = M.px[i] === M0.px[i] && M.px[i + 1] === M0.px[i + 1] && M.px[i + 2] === M0.px[i + 2];
      if (!same) { if (!m0) r.lidNonWater++; else if (cls(M0.px, x, y) === 'out') r.lidOuterWater++; }
    }
    // flat check on the normal frame: 25 samples
    const set = new Set(); for (let k = 0; k < 25; k++) { const xx = Math.floor(Wd * (0.05 + 0.9 * (k % 5) / 4)), yy = Math.floor(H * (0.05 + 0.9 * Math.floor(k / 5) / 4)); const i = (yy * Wd + xx) * 4; set.add(N.px[i] + ',' + N.px[i + 1] + ',' + N.px[i + 2]); }
    r.flat = set.size <= 2 ? 1 : 0; r.distinct = set.size;
    if (save) { r.jpg = window.__jpeg(N); if (r.leak > 0 || r.lidNonWater > 0 || r.lidOuterWater > 0) { r.jpgM = window.__jpeg({ W: Wd, H, px: ov }); r.jpgM0 = window.__jpeg(M0); } }
    return r;
  }, [b, cl, tl, save, setup.caps]);
  const boats = await page.evaluate(() => window.__GAME__.boats());
  const pick = (kind, moving) => boats.findIndex((q) => q.kind === kind && q.moving === moving);
  const mood = MOOD[SEED] || String(SEED); const sun = SUN[mood] || SUN.golden;
  const res = { seed: SEED, mood, tag: TAG, mobile: MOBILE, caps: setup.caps, kinds: setup.kinds, views: [], sweep: {} };
  const targets = [['sail', true], ['sail', false], ['rib', true], ['row', true], ['row', false], ['ferry', true]];
  for (const [kind, moving] of targets) {
    let bi = pick(kind, moving); if (bi < 0) bi = pick(kind, !moving); if (bi < 0) continue;
    const b = boats[bi]; const L = b.len / 2, Bm = b.beam / 2; const s = kind === 'ferry' ? 2.2 : 1;
    // sun direction into the boat frame for the sun-behind-sail view
    const sh = Math.hypot(sun[0], sun[2]); const sx = sun[0] / sh, sz = sun[2] / sh;
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), px = Math.cos(b.yaw), pz = -Math.sin(b.yaw);
    const su = sx * fx + sz * fz, sv = sx * px + sz * pz;
    const views = [
      ['low-side', [0, 6 * s, 0.35], [0, 0, 0.3]],
      ['low-quarter', [-5 * s, 4 * s, 0.45], [0, 0, 0.3]],
      ['into-hull', [-1 * s, 2.2 * s, 3.0 * s], [0.2, 0, 0.2]],
      ['above', [0.01, 0.4, 9 * s], [0, 0, 0]],
      ['bow', [L + 5 * s, 0.6, 1.6 * s], [0, 0, 0.5]],
      ['stern', [-L - 5 * s, -0.6, 1.6 * s], [0, 0, 0.5]],
      ['side', [0, 7 * s, 2.5 * s], [0, 0, 0.5]],
      ['very-close', [0.3, Bm + 0.6, 1.4], [-0.3, -0.3, 0.1]],
      ...(kind === 'ferry' ? [] : [['inside-close', [0.4, 0.2, 1.6], [-0.4, 0, -0.1]]]),
      ['waterline-close', [0.5, Bm + 1.2, 0.12], [-0.5, 0, 0.25]],
    ];
    if (kind === 'sail') views.push(['sun-behind-sail', [-su * 9, -sv * 9, 1.6], [0, 0, 3.5]]);
    for (const [name, cl, tl] of views) {
      const r = await view(bi, cl, tl, SHOTS);
      const base = `hw35-${TAG}${MOBILE ? '-m' : ''}-${mood}-${kind}${moving ? '' : '-moored'}-${name}`;
      for (const [k, suf] of [['jpg', ''], ['jpgM', '-M'], ['jpgM0', '-M0']]) if (r[k]) { fs.writeFileSync(OUT + base + suf + '.jpg', Buffer.from(r[k].split(',')[1], 'base64')); delete r[k]; }
      r.view = name; res.views.push(r);
      console.log(JSON.stringify({ seed: SEED, kind, moving, view: name, camIn: r.camInHull, leak: r.leak, leakMax: r.leakMax, leak0: r.leak0, inHull: r.inHull, inHull0: r.inHull0, lidNonWater: r.lidNonWater, lidOuterWater: r.lidOuterWater, magN: r.magN, flat: r.flat, box: r.box }));
    }
    // bob / roll / planing sweep: time steps of 0.53 s, into-hull and low-quarter views, no images
    const sw = { frames: 0, leak: 0, leak0: 0, leakPx: 0, inHull: 0, inHull0: 0, lidNonWater: 0, lidOuterWater: 0, worst: null, heave: [9, -9] };
    for (let k = 0; k < SWEEP; k++) {
      await page.evaluate(() => window.__GAME__.advance(0.53, false));
      for (const [cl, tl] of [[[-1 * s, 2.2 * s, 3.0 * s], [0.2, 0, 0.2]], [[-5 * s, 4 * s, 0.45], [0, 0, 0.3]], kind === 'ferry' ? [[0, 7 * s, 2.5 * s], [0, 0, 0.5]] : [[0.4, 0.2, 1.6], [-0.4, 0, -0.1]]]) {
        const r = await view(bi, cl, tl, false); sw.frames++;
        sw.leak += r.leak > 0 ? 1 : 0; sw.leak0 += r.leak0 > 0 ? 1 : 0; sw.leakPx = Math.max(sw.leakPx, r.leak); sw.inHull += r.inHull > 0 ? 1 : 0; sw.inHull0 += r.inHull0 > 0 ? 1 : 0; sw.lidNonWater += r.lidNonWater > 0 ? 1 : 0; sw.lidOuterWater += r.lidOuterWater > 0 ? 1 : 0;
        sw.heave = [Math.min(sw.heave[0], r.B.heave), Math.max(sw.heave[1], r.B.heave)];
        if (r.inHull > (sw.worst?.inHull ?? 0)) sw.worst = { k, inHull: r.inHull };
      }
    }
    res.sweep[kind + (moving ? '' : '-moored')] = sw;
    console.log('SWEEP', SEED, kind, moving, JSON.stringify(sw));
  }
  res.errs = errs.slice(0, 5);
  summary.push(res);
  await ctx.close();
}
const tot = { leakViews: 0, leak0Views: 0, leakPxMax: 0, sweepLeak: 0, sweepLeak0: 0, views: 0, inHullViews: 0, inHull0Views: 0, lidNonWaterViews: 0, lidOuterViews: 0, flat: 0, sweepFrames: 0, sweepIn: 0, sweepIn0: 0, sweepLid: 0 };
for (const r of summary) {
  for (const v of r.views) { tot.views++; if (v.leak) tot.leakViews++; if (v.leak0) tot.leak0Views++; tot.leakPxMax = Math.max(tot.leakPxMax, v.leak); if (v.inHull) tot.inHullViews++; if (v.inHull0) tot.inHull0Views++; if (v.lidNonWater) tot.lidNonWaterViews++; if (v.lidOuterWater) tot.lidOuterViews++; tot.flat += v.flat; }
  for (const s of Object.values(r.sweep)) { tot.sweepFrames += s.frames; tot.sweepLeak += s.leak; tot.sweepLeak0 += s.leak0; tot.sweepIn += s.inHull; tot.sweepIn0 += s.inHull0; tot.sweepLid += s.lidNonWater + s.lidOuterWater; }
}
console.log('TOTAL', TAG, MOBILE ? 'phone' : 'desktop', JSON.stringify(tot));
console.log('ERRS', JSON.stringify(summary.map((r) => r.errs)));
fs.writeFileSync(OUT + `hw35-${TAG}${MOBILE ? '-m' : ''}-${SEEDS.join('_')}.json`, JSON.stringify(summary, null, 1));
await browser.close();
