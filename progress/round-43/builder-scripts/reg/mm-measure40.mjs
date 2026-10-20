// Round 40 critic: minimap measurements on any build, from the canvas pixels (no build-specific probe data needed).
// Orientation, bearing error (poses over a run + real-time carving), edge clamp, alley test, shore seam, restart and
// new city, placement on several screens, per-frame cost (CDP profiler + DOM query counts), DPI.
// env: PORT, TAG, BUILD (m|w: colour set), OUT (shot dir), PARTS (comma list)
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
const PORT = process.env.PORT || '5191', TAG = process.env.TAG || 'x', BUILD = process.env.BUILD || 'm';
const OUT = process.env.OUT || '/tmp/'; fs.mkdirSync(OUT, { recursive: true });
const PARTS = (process.env.PARTS || 'orient,bearing,realtime,clamp,alley,seam,restart,place,cost,dpi').split(',');
const COL = BUILD === 'm'
  ? { mark: [[255, 176, 46], [20, 201, 160], [255, 93, 74]], water: [[108, 180, 205], [90, 164, 192]], street: [[253, 245, 232]], alley: [[198, 214, 226], [253, 245, 232]] }
  : { mark: [[242, 165, 43], [19, 185, 155]], water: [[34, 89, 106], [22, 70, 90]], street: [[131, 125, 114]], alley: [[232, 212, 177]] };
const browser = await chromium.launch({ channel: 'chromium' });
const res = { tag: TAG };
const log = (...a) => console.log(...a);
async function open(opts = {}) {
  const ctx = opts.phone ? await browser.newContext({ ...devices[opts.phone] }) : await browser.newContext({ viewport: opts.vp || { width: 1280, height: 720 }, deviceScaleFactor: opts.dpr || 1 });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${PORT}/?seed=${opts.seed || 22}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { localStorage.removeItem('drone-dash-minimap-v1'); });
  await page.evaluate((COL) => {
    window.__COL = COL;
    const near = (d, i, cs, tol) => cs.some((c) => Math.abs(d[i] - c[0]) <= tol && Math.abs(d[i + 1] - c[1]) <= tol && Math.abs(d[i + 2] - c[2]) <= tol);
    window.__mm = () => [...document.querySelectorAll('canvas')].find((c) => c.className.includes('minimap') && !c.hidden);
    // largest blob of marker colour: centroid angle (deg clockwise from up) and radius as a share of the half size
    window.__marker = () => {
      const c = window.__mm(); if (!c) return null;
      const w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data;
      const m = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) if (near(d, i * 4, COL.mark, 14)) m[i] = 1;
      let best = null; const seen = new Uint8Array(w * h), st = [];
      for (let s = 0; s < w * h; s++) { if (!m[s] || seen[s]) continue; let n = 0, sx = 0, sy = 0; st.push(s); seen[s] = 1;
        while (st.length) { const q = st.pop(), x = q % w, y = (q / w) | 0; n++; sx += x; sy += y;
          for (const nb of [q - 1, q + 1, q - w, q + w]) if (nb >= 0 && nb < w * h && m[nb] && !seen[nb] && Math.abs((nb % w) - x) <= 1) { seen[nb] = 1; st.push(nb); } }
        if (!best || n > best.n) best = { n, x: sx / n, y: sy / n }; }
      if (!best) return { none: true, w };
      const dx = best.x - w / 2 + 0.5, dy = best.y - h / 2 + 0.5;
      return { ang: Math.atan2(dx, -dy) * 180 / Math.PI, r: Math.hypot(dx, dy) / (w / 2), n: best.n, w };
    };
    // share of pixels matching a colour set in four half-discs (excluding a centre band) and along two rays
    window.__zones = (key) => {
      const c = window.__mm(); const w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data, R = w / 2;
      const z = { left: [0, 0], right: [0, 0], top: [0, 0], bottom: [0, 0], up: [0, 0], rightRay: [0, 0], centre: [0, 0] };
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dx = x - R + 0.5, dy = y - R + 0.5, r = Math.hypot(dx, dy); if (r > R * 0.88) continue;
        const hit = near(d, (y * w + x) * 4, COL[key], 16) ? 1 : 0;
        if (dx < -R * 0.1) { z.left[0] += hit; z.left[1]++; } if (dx > R * 0.1) { z.right[0] += hit; z.right[1]++; }
        if (dy < -R * 0.1) { z.top[0] += hit; z.top[1]++; } if (dy > R * 0.1) { z.bottom[0] += hit; z.bottom[1]++; }
        if (Math.abs(dx) <= 1.5 && dy < -R * 0.15) { z.up[0] += hit; z.up[1]++; } if (Math.abs(dy) <= 1.5 && dx > R * 0.15) { z.rightRay[0] += hit; z.rightRay[1]++; }
        if (r < R * 0.18 && r > R * 0.1) { z.centre[0] += hit; z.centre[1]++; } }
      const o = {}; for (const k in z) o[k] = z[k][1] ? +(z[k][0] / z[k][1]).toFixed(3) : null; return o;
    };
    window.__hash = () => { const c = window.__mm(); if (!c) return 0; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let hsh = 0; for (let i = 0; i < d.length; i += 97) hsh = (hsh * 31 + d[i]) | 0; return hsh; };
  }, COL);
  await page.evaluate(() => { const G = window.__GAME__; G.start(); G.manualRender(true); G.tune({ RUN: { startTime: 999 } }); G.advance(0.5, true); });
  await page.waitForTimeout(1300);
  return { ctx, page, errs };
}
// place, settle, let both builds draw (W throttles on real time), then read
async function poseRead(page, x, y, z, yaw, what = 'marker') {
  await page.evaluate(([x, y, z, yaw]) => { const G = window.__GAME__; G.place(x, y, z, yaw, 0); G.advance(0.1, false); }, [x, y, z, yaw]);
  await page.waitForTimeout(40);
  return page.evaluate((what) => { const G = window.__GAME__; G.advance(1 / 60, false); G.advance(1 / 60, true); const d = G.diagnostics(); const p = d.player.position, o = d.objective?.position;
    let tb = null, dist = null; if (o) { const dx = o.x - p.x, dz = o.z - p.z, y = d.player.yaw; tb = Math.atan2(Math.cos(y) * dx - Math.sin(y) * dz, -Math.sin(y) * dx - Math.cos(y) * dz) * 180 / Math.PI; dist = Math.hypot(dx, dz); }
    return { p, yaw: d.player.yaw, tb, dist, phase: d.objective?.phase, mk: what === 'marker' ? window.__marker() : null, zones: what !== 'marker' ? window.__zones(what) : null, probe: G.minimap?.last ? G.minimap.last.markerAngle : null };
  }, what);
}
const wrap = (a) => { let x = a; while (x > 180) x -= 360; while (x < -180) x += 360; return x; };
const freeY = (page, x, z, y0 = 12) => page.evaluate(([x, z, y0]) => { const G = window.__GAME__; let y = y0; while (G.insideSolid(x, y, z, 1.5) && y < 140) y += 4; return y; }, [x, z, y0]);
async function crop(page, name) { const b = await page.evaluate(() => { const r = window.__mm().getBoundingClientRect(); return { x: r.left - 10, y: r.top - 10, width: r.width + 20, height: r.height + 20 }; }); await page.screenshot({ path: `${OUT}${name}.jpg`, type: 'jpeg', quality: 80, clip: b }); }

if (PARTS.includes('orient')) {
  const { ctx, page } = await open({ seed: 22 });
  const o = await page.evaluate(() => window.__GAME__.diagnostics().objective.position);
  const y = Math.max(70, await freeY(page, o.x - 80, o.z, 70));
  const east = await poseRead(page, o.x - 80, y, o.z, -Math.PI / 2);
  await crop(page, `orient-${TAG}-east-target-ahead`);
  const north = await poseRead(page, o.x, y, o.z + 80, 0);
  const rs = {};
  for (const [k, x, z, yaw] of [['streetE', -88, 22, -Math.PI / 2], ['streetN', -22, 88, 0], ['streetW', 88, -22, Math.PI / 2], ['streetS', 22, -88, Math.PI]]) rs[k] = (await poseRead(page, x, 12, z, yaw, 'street')).zones;
  await poseRead(page, -88, 12, 22, -Math.PI / 2, 'street'); await crop(page, `orient-${TAG}-east-street`);
  const sea = {};
  for (const [k, x, z, yaw, want] of [['promN', 154, 72, 0, 'right'], ['promS', 154, -72, Math.PI, 'left'], ['southE', -72, 154, -Math.PI / 2, 'right'], ['southW', 72, 154, Math.PI / 2, 'left']]) { const r = await poseRead(page, x, 10, z, yaw, 'water'); sea[k] = { want, ...r.zones }; if (k === 'promN') await crop(page, `orient-${TAG}-north-sea-right`); if (k === 'southE') await crop(page, `orient-${TAG}-east-sea-right`); }
  res.orient = { eastTarget: { tb: east.tb, mk: east.mk }, northTarget: { tb: north.tb, mk: north.mk }, street: rs, sea };
  log('orient', JSON.stringify(res.orient));
  await ctx.close();
}
if (PARTS.includes('bearing')) {
  const rows = [];
  for (const seed of [22, 58, 130]) {
    const { ctx, page } = await open({ seed });
    for (let leg = 0; leg < 6; leg++) {
      for (let k = 0; k < 20; k++) {
        const C = [-154, -110, -66, -22, 22, 66, 110, 154];
        const along = Math.random() < 0.5, c = C[(Math.random() * 8) | 0], t = -150 + Math.random() * 300;
        const x = along ? t : c, z = along ? c : t, yaw = Math.random() * Math.PI * 2 - Math.PI;
        const y = await freeY(page, x, z, 12);
        const r = await poseRead(page, x, y, z, yaw);
        if (r.dist == null) continue;
        rows.push({ seed, leg, dist: r.dist, tb: r.tb, ang: r.mk?.ang ?? null, rr: r.mk?.r ?? null, n: r.mk?.n ?? 0, probe: r.probe, phase: r.phase });
      }
      await page.evaluate(() => { const G = window.__GAME__; const ph0 = G.diagnostics().objective.phase; for (let i = 0; i < 60; i++) { const d = G.diagnostics(); if (d.objective.phase !== ph0) break; const o = d.objective.position; G.place(o.x, o.y + 1.2, o.z, 0, 0); G.advance(0.25, false); } G.advance(0.5, false); });
    }
    await ctx.close();
  }
  const use = rows.filter((r) => r.dist >= 15);
  const errs = use.filter((r) => r.ang != null).map((r) => Math.abs(wrap(r.ang - r.tb))).sort((a, b) => a - b);
  const q = (a, p) => a[Math.min(a.length - 1, Math.floor(p * a.length))];
  const missing = use.filter((r) => r.ang == null).length;
  res.bearing = { n: use.length, found: errs.length, missing, median: q(errs, 0.5), p95: q(errs, 0.95), max: errs[errs.length - 1], over20: errs.filter((e) => e > 20).length, over90: errs.filter((e) => e > 90).length,
    byPhase: Object.fromEntries(['pickup', 'deliver', 'drop'].map((ph) => { const e = use.filter((r) => r.phase === ph && r.ang != null).map((r) => Math.abs(wrap(r.ang - r.tb))).sort((a, b) => a - b); return [ph, e.length ? { n: e.length, median: q(e, 0.5), p95: q(e, 0.95) } : null]; })) };
  fs.writeFileSync(`${OUT}bearing-${TAG}.json`, JSON.stringify(rows));
  log('bearing', JSON.stringify(res.bearing));
}
if (PARTS.includes('realtime')) {
  const { ctx, page } = await open({ seed: 22 });
  await page.evaluate(() => { const G = window.__GAME__; G.place(-120, 30, 22, -Math.PI / 2, 10); G.advance(0.2, true); G.manualRender(false); });
  const keys = [['KeyW', 'KeyD'], ['KeyW'], ['KeyW', 'KeyA'], ['KeyW', 'KeyD']];
  const errs = [];
  for (const ks of keys) {
    for (const k of ks) await page.evaluate((k) => window.__GAME__.key(k, true), k);
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(50);
      const r = await page.evaluate(() => { const d = window.__GAME__.diagnostics(); const p = d.player.position, o = d.objective.position, y = d.player.yaw; const dx = o.x - p.x, dz = o.z - p.z;
        return { tb: Math.atan2(Math.cos(y) * dx - Math.sin(y) * dz, -Math.sin(y) * dx - Math.cos(y) * dz) * 180 / Math.PI, dist: Math.hypot(dx, dz), mk: window.__marker() }; });
      if (r.dist > 15 && r.mk && r.mk.ang != null) errs.push(Math.abs(wrap(r.mk.ang - r.tb)));
    }
    for (const k of ks) await page.evaluate((k) => window.__GAME__.key(k, false), k);
  }
  errs.sort((a, b) => a - b);
  res.realtime = { n: errs.length, median: errs[errs.length >> 1], p95: errs[Math.floor(errs.length * 0.95)], max: errs[errs.length - 1], over90: errs.filter((e) => e > 90).length };
  log('realtime', JSON.stringify(res.realtime));
  await ctx.close();
}
if (PARTS.includes('clamp')) {
  const { ctx, page } = await open({ seed: 22 });
  const o = await page.evaluate(() => window.__GAME__.diagnostics().objective.position);
  const rows = [];
  // stand at distance d from the target, facing it (target dead ahead), above the roofs
  for (const d of [100, 120, 130, 135, 140, 145, 150, 155, 160, 180, 200]) {
    const ang = Math.atan2(-o.z, -o.x); // go toward the island centre side so the drone stays over the city
    const x = o.x + Math.cos(ang) * d, z = o.z + Math.sin(ang) * d, fx = o.x - x, fz = o.z - z;
    const r = await poseRead(page, x, 90, z, Math.atan2(-fx, -fz));
    rows.push({ d, dist: +r.dist.toFixed(1), rr: r.mk ? +r.mk.r.toFixed(3) : null, n: r.mk?.n, ang: r.mk ? +r.mk.ang.toFixed(1) : null });
    if (d === 140 || d === 160) await crop(page, `clamp-${TAG}-${d}m`);
  }
  res.clamp = rows; log('clamp', JSON.stringify(rows));
  await ctx.close();
}
if (PARTS.includes('alley')) {
  const { ctx, page } = await open({ seed: 22 });
  const cors = await page.evaluate(() => window.__GAME__.camCorridors().filter((c) => c.hw < 4.5 && c.roofY > 30).slice(0, 6));
  const rows = [];
  let i = 0;
  for (const c of cors) {
    const mid = (c.a0 + c.a1) / 2, x = c.axis === 'x' ? mid : c.c, z = c.axis === 'x' ? c.c : mid, yaw = c.axis === 'x' ? -Math.PI / 2 : 0;
    const r = await poseRead(page, x, 6, z, yaw, 'alley');
    const s = await poseRead(page, x, 6, z, yaw, 'street');
    rows.push({ axis: c.axis, c: c.c, hw: c.hw, alleyUp: r.zones.up, alleyCentre: r.zones.centre, streetUp: s.zones.up });
    if (i++ < 1) await crop(page, `alley-${TAG}`);
  }
  res.alley = rows; log('alley', JSON.stringify(rows));
  await ctx.close();
}
if (PARTS.includes('seam')) {
  const { ctx, page } = await open({ seed: 22 });
  // corner of the island, looking out to sea: count the two water shades (inside and outside the static bitmap)
  await poseRead(page, 150, 12, 150, -Math.PI * 0.75, 'water');
  const r = await page.evaluate(() => { const c = window.__mm(); const w = c.width, d = c.getContext('2d').getImageData(0, 0, w, w).data; const hist = {};
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 250) continue; const k = `${d[i]},${d[i + 1]},${d[i + 2]}`; hist[k] = (hist[k] || 0) + 1; }
    return Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 6); });
  await crop(page, `seam-${TAG}-corner`);
  res.seam = r; log('seam', JSON.stringify(r));
  await ctx.close();
}
if (PARTS.includes('restart')) {
  const { ctx, page } = await open({ seed: 22 });
  const step = async () => { await page.evaluate(() => { const G = window.__GAME__; G.key('KeyW', true); G.key('KeyD', true); G.advance(0.5, false); }); await page.waitForTimeout(40); return page.evaluate(() => { window.__GAME__.advance(2 / 60, true); return { n: [...document.querySelectorAll('canvas')].filter((c) => c.className.includes('minimap')).length, vis: [...document.querySelectorAll('canvas')].filter((c) => c.className.includes('minimap') && !c.hidden && c.getBoundingClientRect().width > 0).length, h: window.__hash() }; }); };
  const out = [];
  for (let k = 0; k < 3; k++) {
    const a = await step(), b = await step();
    out.push({ when: k === 0 ? 'first run' : `after restart ${k}`, canvases: b.n, visible: b.vis, changes: a.h !== b.h });
    await page.evaluate(() => { const G = window.__GAME__; G.key('KeyW', false); G.key('KeyD', false); G.restart(); G.advance(0.3, true); });
    await page.waitForTimeout(800);
  }
  // new city: the title's New City button (end the run first)
  await page.evaluate(() => { const G = window.__GAME__; G.end(); });
  await page.waitForTimeout(800);
  const url0 = page.url();
  const btn = await page.$('#title-screen button:has-text("New city"), button:has-text("New city"), button:has-text("NEW CITY")');
  let nav = false;
  if (btn) { try { await Promise.all([page.waitForNavigation({ timeout: 6000 }), btn.click({ force: true })]); nav = true; } catch { nav = false; } }
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => ({ url: location.href, n: [...document.querySelectorAll('canvas')].filter((c) => c.className.includes('minimap')).length }));
  out.push({ when: 'new city', button: !!btn, navigated: nav, url0, ...after });
  res.restart = out; log('restart', JSON.stringify(out));
  await ctx.close();
}
if (PARTS.includes('place')) {
  const SEL = ['.hud-score', '#timer', '#objective', '#route-hint', '.hud-right', '#slip', '#wind', '.boost', '.telemetry', '#view-hint', '#nav-marker', '#gate-tag', '#slip-pop', '#medal-pop', '#event-pop', '#pop', '#touch-stick', '#up-button', '#boost-button', '#down-button', '#music-toggle', '#pause-button', '#combo-chip', '#goal'];
  const screens = [{ n: 'desk1280x720', vp: { width: 1280, height: 720 } }, { n: 'desk1024x600', vp: { width: 1024, height: 600 } }, { n: 'desk1920x1080', vp: { width: 1920, height: 1080 } }, { n: 'desk800x500', vp: { width: 800, height: 500 } }, { n: 'iphone13', phone: 'iPhone 13 landscape' }, { n: 'iphoneSE', phone: 'iPhone SE landscape' }, { n: 'pixel7', phone: 'Pixel 7 landscape' }];
  const out = [];
  for (const s of screens) {
    const { ctx, page } = await open({ seed: 58, vp: s.vp, phone: s.phone });
    if (s.phone) { await page.touchscreen.tap(Math.round((await page.evaluate(() => innerWidth)) / 2), 120); await page.waitForTimeout(100); }
    let worst = { off: 0, hits: {} }, samples = 0, boxes = new Set();
    // a run with drops (pops, medal, combo) : teleport legs, sampling every 0.25 s of play
    for (let leg = 0; leg < 8; leg++) {
      for (let i = 0; i < 12; i++) {
        await page.evaluate((leg) => { const G = window.__GAME__; const d = G.diagnostics(); const o = d.objective.position; if (leg % 2 === 0) G.place(o.x, o.y + 1.2, o.z, 0, 0); G.advance(0.25, false); }, leg);
        await page.waitForTimeout(40);
        const r = await page.evaluate((SEL) => { window.__GAME__.advance(1 / 60, true); const c = window.__mm(); if (!c) return null; const b = c.getBoundingClientRect(); const box = { l: b.left, t: b.top, r: b.right, b: b.bottom };
          const vis = Math.max(0, Math.min(box.r, innerWidth) - Math.max(box.l, 0)) * Math.max(0, Math.min(box.b, innerHeight) - Math.max(box.t, 0)) / (b.width * b.height);
          const hits = []; for (const s of SEL) for (const el of document.querySelectorAll(s)) { const e = el.getBoundingClientRect(), cs = getComputedStyle(el); if (e.width < 1 || e.height < 1 || cs.visibility === 'hidden' || +cs.opacity < 0.05 || el.closest('[hidden]')) continue;
            const ix = Math.min(box.r, e.right) - Math.max(box.l, e.left), iy = Math.min(box.b, e.bottom) - Math.max(box.t, e.top); if (ix > 2 && iy > 2) hits.push(s); }
          return { box: `${Math.round(box.l)},${Math.round(box.t)},${Math.round(b.width)}`, off: 1 - vis, hits }; }, SEL);
        if (!r) continue; samples++; boxes.add(r.box); worst.off = Math.max(worst.off, r.off); for (const h of r.hits) worst.hits[h] = (worst.hits[h] || 0) + 1;
      }
      if (leg % 2 === 1) await page.evaluate(() => { const G = window.__GAME__; for (let i = 0; i < 40; i++) { const d = G.diagnostics(); const o = d.objective.position; G.place(o.x, o.y + 1.2, o.z, 0, 0); G.advance(0.25, false); if (d.objective.phase === 'pickup' && i > 2) break; } });
    }
    const vw = await page.evaluate(() => `${innerWidth}x${innerHeight}`);
    await page.screenshot({ path: `${OUT}place-${TAG}-${s.n}.jpg`, type: 'jpeg', quality: 80, scale: 'css' });
    out.push({ screen: s.n, vw, samples, boxes: [...boxes].slice(0, 6), maxOffScreen: +worst.off.toFixed(2), overlaps: worst.hits });
    log('place', JSON.stringify(out[out.length - 1]));
    await ctx.close();
  }
  res.place = out;
}
if (PARTS.includes('cost')) {
  const out = {};
  for (const mapOn of [true, false]) {
    const { ctx, page } = await open({ seed: 22 });
    if (!mapOn) { await page.keyboard.press('KeyM'); await page.waitForTimeout(100); }
    const vis = await page.evaluate(() => !!window.__mm()); log('cost: opened', mapOn);
    // DOM query counters (NOWRAP=1 skips them)
    if (!process.env.NOWRAP) await page.evaluate(() => { const c = window.__cnt = { qs: 0, gbcr: 0, gcs: 0 }; const qs = Document.prototype.querySelector; Document.prototype.querySelector = function (...a) { c.qs++; return qs.apply(this, a); };
      const g = Element.prototype.getBoundingClientRect; Element.prototype.getBoundingClientRect = function () { c.gbcr++; return g.call(this); }; const gc = window.getComputedStyle; window.getComputedStyle = function (...a) { c.gcs++; return gc.apply(window, a); }; });
    await page.evaluate(() => { const G = window.__GAME__; G.place(-120, 14, 22, -Math.PI / 2, 10); G.advance(0.2, true); G.key('KeyW', true); G.manualRender(false); });
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
    await page.evaluate(() => { window.__cnt = window.__cnt || { qs: 0, gbcr: 0, gcs: 0 }; window.__cnt.qs = window.__cnt.gbcr = window.__cnt.gcs = 0; window.__f0 = window.__GAME__.diagnostics().frame; });
    await cdp.send('Profiler.start'); log('cost: profiling');
    // steer gently so the drone keeps flying: alternate A and D
    for (let i = 0; i < 8; i++) { await page.evaluate((i) => { const G = window.__GAME__; G.key(i % 2 ? 'KeyA' : 'KeyD', true); }, i); await page.waitForTimeout(400); await page.evaluate((i) => { const G = window.__GAME__; G.key(i % 2 ? 'KeyA' : 'KeyD', false); }, i); await page.waitForTimeout(600); log('cost: step', i); }
    log('cost: stopping'); const { profile } = await cdp.send('Profiler.stop'); log('cost: profile nodes', profile.nodes.length, profile.samples.length);
    const cnt = await page.evaluate(() => ({ ...window.__cnt, frames: window.__GAME__.diagnostics().frame - window.__f0 }));
    // attribute sample time: any stack with a Minimap.ts frame, updateMinimap / mmBox, or (W) DOM queries made from Game.update
    const byId = new Map(profile.nodes.map((n) => [n.id, n])); const parent = new Map(); for (const n of profile.nodes) for (const ch of n.children || []) parent.set(ch, n.id);
    const cls = new Map();
    const classify = (id) => { if (cls.has(id)) return cls.get(id); let cur = id, child = null, hit = false; while (cur != null) { const n = byId.get(cur), f = n.callFrame;
        if (/Minimap\.ts/.test(f.url) || /^(updateMinimap|mmBox)$/.test(f.functionName)) { hit = true; break; }
        if (/Game\.ts/.test(f.url) && f.functionName === 'update' && child != null) { const cf = byId.get(child).callFrame; if (/^(querySelector|getBoundingClientRect|touchLayout|getComputedStyle|getPropertyValue)$/.test(cf.functionName)) { hit = true; break; } }
        child = cur; cur = parent.get(cur); }
      cls.set(id, hit); return hit; };
    let tMap = 0, tAll = 0; for (let i = 0; i < profile.samples.length; i++) { const dt = (profile.timeDeltas[i + 1] ?? 0) / 1000; const n = byId.get(profile.samples[i]); if (n.callFrame.functionName === '(idle)') continue; tAll += dt; if (classify(profile.samples[i])) tMap += dt; }
    out[mapOn ? 'on' : 'off'] = { visible: vis, frames: cnt.frames, msPerFrameMap: +(tMap / cnt.frames).toFixed(3), msPerFrameBusy: +(tAll / cnt.frames).toFixed(2), qsPerFrame: +(cnt.qs / cnt.frames).toFixed(1), gbcrPerFrame: +(cnt.gbcr / cnt.frames).toFixed(1), gcsPerFrame: +(cnt.gcs / cnt.frames).toFixed(1), probe: await page.evaluate(() => window.__GAME__.minimapStats ? window.__GAME__.minimapStats() : null) };
    log('cost', mapOn ? 'on' : 'off', JSON.stringify(out[mapOn ? 'on' : 'off']));
    await ctx.close();
  }
  res.cost = out;
}
if (PARTS.includes('dpi')) {
  const out = [];
  for (const s of [{ n: 'desk dpr1', dpr: 1 }, { n: 'desk dpr2', dpr: 2 }, { n: 'iphone13 dpr3', phone: 'iPhone 13 landscape' }]) {
    const { ctx, page } = await open({ seed: 22, dpr: s.dpr, phone: s.phone });
    await poseRead(page, -88, 12, 22, -Math.PI / 2);
    const r = await page.evaluate(() => { const c = window.__mm(); const b = c.getBoundingClientRect(); return { css: Math.round(b.width), backing: c.width, dpr: devicePixelRatio, ratio: +(c.width / (b.width * devicePixelRatio)).toFixed(2) }; });
    out.push({ screen: s.n, ...r }); log('dpi', JSON.stringify(out[out.length - 1]));
    if (s.dpr === 2) { await page.evaluate(() => { const c = window.__mm(); c.style.outline = 'none'; }); const b = await page.evaluate(() => { const r = window.__mm().getBoundingClientRect(); return { x: Math.max(0, r.left - 6), y: Math.max(0, r.top - 6), width: r.width + 12, height: r.height + 12 }; }); await page.screenshot({ path: `${OUT}dpi2-${TAG}.jpg`, type: 'jpeg', quality: 80, clip: b }); }
    await ctx.close();
  }
  res.dpi = out;
}
fs.writeFileSync(`${OUT}measure-${TAG}.json`, JSON.stringify(res, null, 1));
await browser.close();
