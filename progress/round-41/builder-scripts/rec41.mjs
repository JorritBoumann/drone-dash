// Round 41 builder: the canvas HUD in a canvas-only recording. Production build on 5293, ?hud=canvas.
// Per config: real-time run, MediaRecorder on canvas.captureStream(30) for 6 s (pickup placed at 2 s so a pickup pop and a
// deliver objective show), a frame from the WebM saved as JPEG, plus a pixel A/B per panel (HUD pass on vs off) and the
// 64 px corner / overlap check of every visible HUD box. Usage: node rec41.mjs [configs]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const SHOTS = 'progress/round-41/builder-shots', OUT = 'progress/round-41/builder-scripts/out';
fs.mkdirSync(OUT, { recursive: true });
const ALL = {
  d22: { seed: 22, vp: { width: 1280, height: 720 }, dpr: 1 },
  d58: { seed: 58, vp: { width: 1280, height: 720 }, dpr: 2 },
  d130: { seed: 130, vp: { width: 1280, height: 720 }, dpr: 1 },
  m22: { seed: 22, vp: { width: 844, height: 390 }, dpr: 3, touch: true },
  m58: { seed: 58, vp: { width: 844, height: 390 }, dpr: 3, touch: true },
};
const pick = (process.argv[2] || 'd22,d58,m22,m58').split(',');
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const results = {};
for (const name of pick) {
  const C = ALL[name];
  const ctx = await browser.newContext({ viewport: C.vp, deviceScaleFactor: C.dpr, isMobile: !!C.touch, hasTouch: !!C.touch });
  await ctx.addInitScript(() => { try { localStorage.setItem('drone-dash-played-v1', '1'); } catch {} });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:5293/?seed=${C.seed}&hud=canvas&slLaunch=1&x=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__GAME__ && window.__GAME__.assetsReady?.(), null, { timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(1500);
  if (C.touch) await page.tap('#play-button'); else await page.click('#play-button');
  await page.waitForTimeout(300);
  // record the canvas only
  await page.evaluate(() => {
    const cv = document.getElementById('game-canvas');
    const rec = new MediaRecorder(cv.captureStream(30), { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 6e6 });
    window.__chunks = []; rec.ondataavailable = (e) => e.data.size && window.__chunks.push(e.data); rec.start(250); window.__rec = rec;
  });
  // overlap + corner samples during the run
  const samples = { n: 0, corner: 0, overlap: {}, cornerWho: {} };
  const sample = async () => {
    const r = await page.evaluate(() => {
      const H = window.__GAME__.canvasHud(); const boxes = [];
      for (const p of H.panels) if (p.visible && p.box) boxes.push({ n: 'c:' + p.name, ...p.box });
      for (const sel of ['#touch-stick', '#up-button', '#boost-button', '#down-button', '.boost', '.hud-right', '#nav-marker', '#gate-tag', '#route-hint', '#wind', '.telemetry', '#music-toggle']) {
        const e = document.querySelector(sel); if (!e) continue; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) continue;
        const b = e.getBoundingClientRect(); if (b.width > 0 && b.height > 0) boxes.push({ n: sel, x: b.left, y: b.top, w: b.width, h: b.height });
      }
      return boxes;
    });
    samples.n++;
    const hit = (a, b) => a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;
    for (const a of r) if (a.x < 64 && a.y < 64) { samples.corner++; samples.cornerWho[a.n] = (samples.cornerWho[a.n] || 0) + 1; }
    for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
      if (!r[i].n.startsWith('c:') && !r[j].n.startsWith('c:')) continue;
      if ((r[i].n === 'c:event' || r[j].n === 'c:event') && (r[i].n === '#nav-marker' || r[j].n === '#nav-marker')) continue; // pops and the marker are placed apart by the HTML rules
      if (hit(r[i], r[j])) { const k = `${r[i].n}~${r[j].n}`; samples.overlap[k] = (samples.overlap[k] || 0) + 1; }
    }
  };
  await page.evaluate(() => window.__GAME__.key('KeyW', true));
  for (let i = 0; i < 20; i++) { await page.waitForTimeout(100); await sample(); }
  // place the drone on the pickup pad: pickup pop, deliver objective
  await page.evaluate(() => { const o = window.__THREE_GAME_DIAGNOSTICS__.objective.position; window.__GAME__.key('KeyW', false); window.__GAME__.place(o.x, o.y + 1.2, o.z, 0, 0); });
  for (let i = 0; i < 15; i++) { await page.waitForTimeout(100); await sample(); }
  await page.evaluate(() => window.__GAME__.key('KeyW', true));
  for (let i = 0; i < 25; i++) { await page.waitForTimeout(100); await sample(); }
  await page.evaluate(() => window.__GAME__.key('KeyW', false));
  const webm = await page.evaluate(async () => {
    await new Promise((res) => { window.__rec.onstop = res; window.__rec.stop(); });
    const blob = new Blob(window.__chunks, { type: 'video/webm' });
    window.__blob = blob;
    const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
  });
  fs.writeFileSync(`${OUT}/rec-${name}.webm`, Buffer.from(webm, 'base64'));
  // frames from the recording (decoded from the WebM: canvas pixels only)
  const frames = await page.evaluate(async () => {
    const v = document.createElement('video'); v.muted = true; v.src = URL.createObjectURL(window.__blob); v.playsInline = true;
    await v.play(); const out = [];
    const grab = () => { const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0); return c.toDataURL('image/jpeg', 0.8); };
    await new Promise((res) => { const tick = () => { if (v.currentTime >= 2.6 && out.length === 0) out.push(grab()); if (v.currentTime >= 5.2 && out.length === 1) { out.push(grab()); return res(); } if (v.ended) { out.push(grab()); return res(); } requestAnimationFrame(tick); }; tick(); });
    return { out, w: v.videoWidth, h: v.videoHeight };
  });
  frames.out.forEach((d, i) => fs.writeFileSync(`${SHOTS}/rec-${name}-${i ? 'deliver' : 'pickup'}.jpg`, Buffer.from(d.split(',')[1], 'base64')));
  // pixel A/B per panel at a fixed step: the HUD pass on against off
  const ab = await page.evaluate(() => {
    const G = window.__GAME__, cv = document.getElementById('game-canvas');
    G.manualRender(true);
    const grab = () => { const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const x = c.getContext('2d'); x.drawImage(cv, 0, 0); return x.getImageData(0, 0, c.width, c.height); };
    G.canvasHudOff(false); G.advance(0.25, true); const on = grab();
    G.canvasHudOff(true); G.advance(0, true); const off = grab();
    G.canvasHudOff(false); G.advance(0, true);
    const H = G.canvasHud(), sx = cv.width / cv.clientWidth, res = {};
    for (const p of H.panels) {
      if (!p.visible || !p.box) { res[p.name] = 'hidden'; continue; }
      let n = 0, d = 0; const b = p.box;
      for (let y = Math.max(0, Math.floor(b.y * sx)); y < Math.min(cv.height, (b.y + b.h) * sx); y += 2) for (let x = Math.max(0, Math.floor(b.x * sx)); x < Math.min(cv.width, (b.x + b.w) * sx); x += 2) {
        const i = (y * cv.width + x) * 4; n++; if (Math.abs(on.data[i] - off.data[i]) + Math.abs(on.data[i + 1] - off.data[i + 1]) + Math.abs(on.data[i + 2] - off.data[i + 2]) > 24) d++;
      }
      res[p.name] = +(d / Math.max(1, n)).toFixed(3);
    }
    G.manualRender(false);
    return { changed: res, panels: H.panels.map((p) => ({ n: p.name, v: p.visible, b: p.box && [p.box.x, p.box.y, p.box.w, p.box.h].map(Math.round), draws: p.draws, tex: p.tex })), uploads: H.uploads, msMean: +H.msMean.toFixed(3), msMax: +H.msMax.toFixed(2), frames: H.frames, buffer: [cv.width, cv.height], css: [cv.clientWidth, cv.clientHeight], event: H.event };
  });
  const d = await page.evaluate(() => { const x = window.__THREE_GAME_DIAGNOSTICS__; return { state: x.state, mood: x.city?.mood, calls: x.renderer?.calls ?? x.drawCalls, tris: x.renderer?.triangles ?? x.triangles }; });
  results[name] = { video: frames.w + 'x' + frames.h, webmKB: Math.round(webm.length * 0.75 / 1024), ...ab, diag: d, samples, errors };
  await ctx.close();
}
console.log(JSON.stringify(results, null, 1));
await browser.close();
