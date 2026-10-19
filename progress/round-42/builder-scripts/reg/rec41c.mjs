// Round 41 critic (new): records the WebGL canvas ALONE (canvas.captureStream + MediaRecorder, as the Stateloop recorder
// does) with ?hud=canvas, while video-pilot39c.js plays a real-time run (street flight, pickup, delivery, crash).
// Clips are back-to-back CLIP-second WebM segments; segments are saved to RECDIR. Also samples the canvas HUD panel
// boxes every 100 ms: panel-on-panel overlaps, the 64 px corner, off-screen panels, and HUD cost.
// Env: PORT (5193 production), SEED, DEV (desk1 | desk2 | phone), MAXT (s of play), CLIP (s), Q (extra query).
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
const PORT = process.env.PORT || '5193'; const SEED = process.env.SEED || '22'; const DEV = process.env.DEV || 'desk1';
const MAXT = Number(process.env.MAXT || 70); const CLIP = Number(process.env.CLIP || 12);
const REC = process.env.RECDIR || '/tmp/rec/'; fs.mkdirSync(REC, { recursive: true });
const TAG = `${DEV}-s${SEED}`;
const browser = await chromium.launch({ channel: 'chromium' });
const opts = DEV === 'phone' ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: DEV === 'desk2' ? 2 : 1 };
const ctx = await browser.newContext(opts);
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
await page.addInitScript({ path: new URL('./video-pilot39c.js', import.meta.url).pathname });
await page.addInitScript(() => { try { localStorage.setItem('drone-dash-played-v1', '1'); } catch {} });
await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}&hud=canvas${process.env.Q || ''}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__GAME__ && window.__GAME__.assetsReady().on, null, { timeout: 30000 });
await page.waitForTimeout(1200);
const info = await page.evaluate(() => { const c = document.getElementById('game-canvas'); return { cw: c.width, ch: c.height, css: [c.clientWidth, c.clientHeight], dpr: devicePixelRatio, hud: window.__GAME__.canvasHud().on, cls: document.getElementById('app').className, mood: window.__THREE_GAME_DIAGNOSTICS__.city.mood, post: window.__THREE_GAME_DIAGNOSTICS__.renderer?.post }; });
console.log('INFO', TAG, JSON.stringify(info));
// recorder in the page: back-to-back segments, each kept as base64 when stopped
await page.evaluate((clip) => {
  const c = document.getElementById('game-canvas');
  const stream = c.captureStream(30);
  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
  window.__REC = { segs: [], mime, on: true };
  const startSeg = () => {
    if (!window.__REC.on) return;
    const chunks = []; const t0 = performance.now();
    const mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3_500_000 });
    mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    mr.onstop = async () => { const b = new Blob(chunks, { type: mime }); const buf = new Uint8Array(await b.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000)); window.__REC.segs.push({ t0, t1: performance.now(), data: btoa(s) }); };
    mr.start(1000);
    window.__REC.cur = mr;
    setTimeout(() => { if (mr.state !== 'inactive') mr.stop(); startSeg(); }, clip * 1000);
  };
  window.__REC.stop = () => { window.__REC.on = false; if (window.__REC.cur && window.__REC.cur.state !== 'inactive') window.__REC.cur.stop(); };
  window.__REC.tStart = performance.now();
  startSeg();
}, CLIP);
await page.waitForTimeout(1500);
if (DEV === 'phone') await page.tap('#play-button'); else await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'playing', null, { timeout: 10000 });
await page.evaluate(() => window.__GAME__.canvasHud(true));
await page.evaluate((touch) => window.__AP.start({ touch, harbour: false }), DEV === 'phone');
const tPlay = Date.now();
const samples = []; let delivered = 0; let after = null;
while (true) {
  await page.waitForTimeout(100);
  const s = await page.evaluate(() => {
    const ch = window.__GAME__.canvasHud(); const d = window.__THREE_GAME_DIAGNOSTICS__;
    return { t: performance.now() - window.__REC.tStart, state: d.state, del: d.deliveries, crashes: d.crashes, chain: d.slipstream.chain, ev: ch.event, panels: ch.panels.filter((p) => p.visible && p.box && p.opacity > 0.05).map((p) => ({ n: p.name, ...p.box, o: +p.opacity.toFixed(2) })), vw: innerWidth, vh: innerHeight, log: window.__AP.log.length };
  });
  samples.push(s);
  if (s.del >= 2 && after === null) after = Date.now();
  if (s.state !== 'playing' || (Date.now() - tPlay) / 1000 > MAXT || (after && Date.now() - after > 4000)) break;
}
const cost = await page.evaluate(() => window.__GAME__.canvasHud());
const aplog = await page.evaluate(() => window.__AP.log);
await page.evaluate(() => { window.__AP.stop(); window.__REC.stop(); });
await page.waitForTimeout(1500);
const segs = await page.evaluate(() => window.__REC.segs.map((s) => ({ t0: s.t0 - window.__REC.tStart, t1: s.t1 - window.__REC.tStart, data: s.data })));
const files = [];
segs.forEach((s, i) => { const f = REC + `${TAG}-seg${i}.webm`; fs.writeFileSync(f, Buffer.from(s.data, 'base64')); files.push({ f, t0: +(s.t0 / 1000).toFixed(1), t1: +(s.t1 / 1000).toFixed(1), MB: +(fs.statSync(f).size / 1e6).toFixed(2) }); });
// overlap analysis
const inter = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const pairs = {}; let corner = 0, off = 0, n = 0;
for (const s of samples) {
  if (s.state !== 'playing') continue; n++;
  for (let i = 0; i < s.panels.length; i++) {
    const a = s.panels[i];
    if (a.x < 64 && a.y < 64) corner++;
    if (a.x < -1 || a.y < -1 || a.x + a.w > s.vw + 1 || a.y + a.h > s.vh + 1) off++;
    for (let j = i + 1; j < s.panels.length; j++) { const b = s.panels[j]; const g = inter(a, b); if (g > 0) { const k = [a.n, b.n].sort().join('+'); pairs[k] = pairs[k] || { n: 0, maxArea: 0, ex: null }; pairs[k].n++; if (g > pairs[k].maxArea) { pairs[k].maxArea = Math.round(g); pairs[k].ex = { t: +(s.t / 1000).toFixed(1), a, b }; } } }
  }
}
// also: touching (gap < 2 px) objective vs event
let touch = 0; for (const s of samples) { const o = s.panels.find((p) => p.n === 'objective'), e = s.panels.find((p) => p.n === 'event'); if (o && e) { const gx = Math.max(o.x - (e.x + e.w), e.x - (o.x + o.w)), gy = Math.max(o.y - (e.y + e.h), e.y - (o.y + o.h)); if (Math.max(gx, gy) < 2) touch++; } }
const evs = [...new Set(samples.map((s) => s.ev && s.ev.main + ' / ' + s.ev.sub).filter(Boolean))];
const maxChain = Math.max(...samples.map((s) => s.chain || 0));
fs.writeFileSync(REC + `${TAG}-samples.json`, JSON.stringify({ info, samples, aplog }));
console.log('REC', TAG, JSON.stringify({ files, playSamples: n, pairs, objEventTouch: touch, corner, off, events: evs, maxChain, aplog: aplog.map((e) => e.k + '@' + e.t).join(' '), cost: { msMean: cost.msMean, msMax: cost.msMax, uploads: cost.uploads, frames: cost.frames }, errs: errs.slice(0, 3) }));
await browser.close();
