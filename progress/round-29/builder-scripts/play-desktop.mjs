import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';
const DUR = Number(process.env.DUR||170000); const PROBE = !!process.env.PROBE; const SEED = process.env.SEED||'';
function variety(buf){const p=PNG.sync.read(buf);const set=new Set();for(let y=120;y<640;y+=8)for(let x=0;x<p.width;x+=8){const i=(y*p.width+x)*4;set.add((p.data[i]>>3)+','+(p.data[i+1]>>3)+','+(p.data[i+2]>>3));}return set.size;}
const probe=[];
const RETRY=[];async function shot(page,path){for(let i=0;i<25;i++){const b=await page.screenshot();const v=variety(b);if(v>100){await page.screenshot({path,type:"jpeg",quality:80});RETRY.push([path.split("/").pop(),i,v]);return i;}await page.waitForTimeout(40);}await page.screenshot({path});RETRY.push([path.split("/").pop(),-1]);return -1;}
import * as require_fs from 'node:fs';
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
let bytes = 0; const reqs = [];
page.on('response', async (r) => { try { const b = await r.body(); bytes += b.length; reqs.push([r.url().slice(-60), b.length]); } catch {} });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const t0 = Date.now();
await page.goto('http://127.0.0.1:5191/'+(SEED?'?seed='+SEED:''), { waitUntil: 'networkidle' });
const loadMs = Date.now() - t0;
await page.waitForTimeout(2500);
await shot(page, OUT + 'd01-title.jpg');
console.log('LOAD', { loadMs, MB: (bytes / 1e6).toFixed(2), n: reqs.length });
// frame sampler
await page.evaluate(() => { window.__fd = []; let last = performance.now(); const f = (t) => { window.__fd.push(t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
await shot(page, OUT + 'd02-takeoff.jpg');
const diag = () => page.evaluate(() => { const d = window.__THREE_GAME_DIAGNOSTICS__; return JSON.parse(JSON.stringify(d)); });
const navInfo = () => page.evaluate(() => { const n = document.getElementById('nav-marker'); const r = n.getBoundingClientRect(); return { cls: n.className, x: Math.round(r.x), y: Math.round(r.y), dist: document.getElementById('nav-distance').textContent, obj: document.getElementById('objective').textContent.replace(/\s+/g,' ').trim(), pop: document.getElementById('pop').className + ' ' + document.getElementById('pop').textContent.trim() }; });
const held = new Set();
async function setKey(k, on) { if (on && !held.has(k)) { held.add(k); await page.keyboard.down(k); } if (!on && held.has(k)) { held.delete(k); await page.keyboard.up(k); } }
const log = []; let lastPhase = null, lastDeliv = 0, lastSpeed = 0, shots = {}, bumps = [];
let mode = 'auto';
const start = Date.now();
let sampledFrames = false;
while (Date.now() - start < DUR) {
  const d = await diag();
  if (d.state !== 'playing') { log.push(['state', d.state, (Date.now() - start) / 1000]); break; }
  const p = d.player.position, c = d.camera, o = d.objective.position;
  const fx = p.x - c.x, fz = p.z - c.z; const heading = Math.atan2(fx, fz);
  const tx = o.x - p.x, tz = o.z - p.z; const want = Math.atan2(tx, tz);
  let err = want - heading; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
  const hd = Math.hypot(tx, tz);
  // collision test: at ~t=6s after first delivery, fly at low altitude straight forward
  const el = (Date.now() - start) / 1000;
  if (mode === 'auto') {
    // +err means target is to the "left"? determine sign empirically: atan2(x,z) increases CCW from +z toward +x
    const turnRight = err < 0; // tested below via log
    await setKey('KeyD', Math.abs(err) > 0.12 && turnRight);
    await setKey('KeyA', Math.abs(err) > 0.12 && !turnRight);
    await setKey('KeyW', Math.abs(err) < 0.9);
    const wantY = hd > 25 ? Math.max(o.y + 6, 40) : o.y + 1.2;
    await setKey('Space', p.y < wantY - 1.5);
    await setKey('ShiftLeft', p.y > wantY + 1.5);
    await setKey('KeyE', hd > 60 && Math.abs(err) < 0.3 && d.player.boost > 0.3);
  }
  if (d.objective.phase !== lastPhase) { log.push(['phase', d.objective.phase, d.objective.name, el.toFixed(1), 'tl', d.timeLeft.toFixed(1)]); lastPhase = d.objective.phase; }
  if (d.player.carrying && !shots.carry) { shots.carry = 1; await page.waitForTimeout(150); await shot(page, OUT + 'd05-parcel-picked.jpg'); }
  if (d.player.carrying && el > 0 && shots.carry === 1 && hd < 120 && !shots.carry2) { shots.carry2 = 1; await shot(page, OUT + 'd06-carrying-enroute.jpg'); }
  if (!shots.flight && el > 3) { shots.flight = 1; await shot(page, OUT + 'd03-flying.jpg'); }
  if (!shots.near && !d.player.carrying && hd < 20) { shots.near = 1; await shot(page, OUT + 'd04-near-pickup.jpg'); }
  if (d.deliveries > lastDeliv) { log.push(['delivered', d.deliveries, el.toFixed(1), 'score', d.score, 'tl', d.timeLeft.toFixed(1)]); lastDeliv = d.deliveries; if (!shots.deliv) { shots.deliv = 1; await page.waitForTimeout(120); await shot(page, OUT + 'd07-delivery.jpg'); } }
  if (!globalThis.__hist) globalThis.__hist=[]; __hist.push([el,hd]); while(__hist.length&&__hist[0][0]<el-6)__hist.shift(); if(el>10&&hd<40&&Math.abs(__hist[0][1]-hd)<1.5&&!shots.stuck){shots.stuck=1; log.push(['STUCK',el.toFixed(1),'target',JSON.stringify(o),'pl',JSON.stringify(p)]); await shot(page, OUT+'d08-stuck-near-drop.jpg');}
  if (lastSpeed - d.player.speed > 5 && !shots.bump) { shots.bump=1; await shot(page, OUT+'d08b-after-bump.jpg'); }
  if (lastSpeed - d.player.speed > 5) bumps.push({ t: el.toFixed(1), from: lastSpeed.toFixed(1), to: d.player.speed.toFixed(1), y: p.y.toFixed(1) });
  lastSpeed = d.player.speed;
  if (Math.floor(el) % 5 === 0 && !shots['n' + Math.floor(el)]) { shots['n' + Math.floor(el)] = 1; log.push(['t', el.toFixed(0), 'pos', p.x.toFixed(0), p.y.toFixed(0), p.z.toFixed(0), 'spd', d.player.speed.toFixed(1), 'err', err.toFixed(2), 'hd', hd.toFixed(0), 'nav', JSON.stringify(await navInfo()), 'fps', d.fps, 'calls', d.drawCalls, 'tris', d.renderer.triangles]); }
  if (!sampledFrames && el > 12) { sampledFrames = true; }
  if (PROBE) { const v = variety(await page.screenshot()); probe.push([el.toFixed(1), v, 'cam', c.x.toFixed(1), c.y.toFixed(1), c.z.toFixed(1), 'pl', p.x.toFixed(1), p.y.toFixed(1), p.z.toFixed(1)].join(' ')); if (v < 60 && !shots.blank) { shots.blank = 1; await shot(page, OUT + 'd10-blank-camera-inside-building.jpg'); } }
  await page.waitForTimeout(60);
}
if (PROBE) console.log(probe.join('\n'));
for (const k of [...held]) await setKey(k, false);
const fd = await page.evaluate(() => window.__fd.slice(30));
const s = [...fd].sort((a, b) => a - b); const q = (x) => s[Math.floor(s.length * x)];
console.log('FRAMES', { n: s.length, median: q(0.5).toFixed(2), p95: q(0.95).toFixed(2), p99: q(0.99).toFixed(2), max: s[s.length - 1].toFixed(1), over20: s.filter((v) => v > 20).length, over33: s.filter((v) => v > 33).length, fps: (1000 / q(0.5)).toFixed(1) });
await page.waitForTimeout(1500);
await shot(page, OUT + 'd09-game-over.jpg');
console.log(JSON.stringify(log, null, 0).replace(/\],\[/g, ']\n['));
console.log('BUMPS', JSON.stringify(bumps));
console.log('ERRORS', errors.slice(0, 5));
console.log('overText', await page.evaluate(() => document.querySelector('[data-screen="over"], #over, .screen-over')?.textContent?.replace(/\s+/g, ' ').slice(0, 300)));
console.log('SHOTS', JSON.stringify(RETRY));
await browser.close();
