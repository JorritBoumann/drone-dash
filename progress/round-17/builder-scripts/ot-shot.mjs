// Round 17 builder: overtime and time-up screenshots (deterministic, teleports onto pads with the place() hook).
// Run A: pick up, clock runs out -> overtime banner and timer; deliver in overtime -> "Made it!"; game-over card.
// Run B: one delivery, pick up again, fly part of the leg with a bank, let overtime expire -> game-over "Last leg" row.
import { chromium } from '@playwright/test';
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const b = await chromium.launch({ channel: 'chromium' });
const MOBILE = !!process.env.MOBILE;
const ctx = await b.newContext(MOBILE ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 720 } });
const p = await ctx.newPage();
const tag = MOBILE ? 'm' : 'd';
await p.goto('http://127.0.0.1:5188/?seed=' + (process.env.SEED || '32124'), { waitUntil: 'networkidle' }); await p.waitForTimeout(600);
const adv = (s, r = true) => p.evaluate(([s, r]) => JSON.parse(JSON.stringify(window.__GAME__.advance(s, r))), [s, r]);
const onTarget = async () => p.evaluate(() => { const o = window.__THREE_GAME_DIAGNOSTICS__.objective.position; window.__GAME__.place(o.x, o.y + 1.4, o.z, 0, 0); });
const shot = async (name) => { await adv(0.0001, true); await p.screenshot({ path: OUT + `${name}-${tag}.jpg`, type: 'jpeg', quality: 80 }); };
// Run A
await p.evaluate(() => { window.__GAME__.tune({ RUN: { startTime: 6 } }); window.__GAME__.externalClock(true); window.__GAME__.start(); window.__GAME__.manualRender(true); });
await adv(0.5); await onTarget(); let d = await adv(0.3);
console.log('A picked', d.objective.phase, d.timeLeft.toFixed(1));
while (d.timeLeft > 0.05 && !d.ending.overtime) d = await adv(0.1, false);
d = await adv(0.6); console.log('A overtime', JSON.stringify(d.ending), d.timeLeft.toFixed(1), d.audio.music.section, d.audio.music.overtime);
await shot('OT-start');
d = await adv(1.5); await shot('OT-mid');
await onTarget(); d = await adv(0.4); console.log('A final', JSON.stringify(d.ending), d.state, d.score);
await shot('OT-madeit');
d = await adv(2.5); console.log('A end', d.state, JSON.stringify(d.breakdown));
await p.waitForTimeout(300); await shot('OT-gameover');
const rowsA = await p.evaluate(() => [...document.querySelectorAll('#over-breakdown > div')].map((r) => r.innerText.replace(/\s+/g, ' ')).concat([document.getElementById('over-time').innerText.replace(/\s+/g, ' ')]));
console.log('A rows', JSON.stringify(rowsA));
// Run B
await p.evaluate(() => { window.__GAME__.tune({ RUN: { startTime: 30 } }); window.__GAME__.start(); });
await adv(0.5); await onTarget(); d = await adv(0.3); await onTarget(); d = await adv(0.3);
console.log('B delivered', d.deliveries, d.timeLeft.toFixed(1));
await onTarget(); d = await adv(0.3); console.log('B picked', d.objective.phase);
// put a bank on the parcel (test of the time-up share): fly toward the drop for a while along the line to it
await p.evaluate(() => { const g = window.__THREE_GAME_DIAGNOSTICS__; const o = g.objective.position, q = g.player.position; const k = 0.55; window.__GAME__.place(q.x + (o.x - q.x) * k, Math.max(q.y, o.y) + 6, q.z + (o.z - q.z) * k, 0, 0); });
d = await adv(0.1);
await p.evaluate(() => { window.__GAME__.tune({}); });
while (d.state === 'playing') d = await adv(0.5, false);
const fin = await adv(0.0001, true);
console.log('B end', fin.deliveries, JSON.stringify(fin.ending), JSON.stringify(fin.breakdown), (fin.scoreLog || []).filter((e) => ['partial', 'overtime', 'end', 'pay'].includes(e.k)).map((e) => e.k + ':' + e.v + ':' + (e.c ?? '')).join(' '));
await p.waitForTimeout(300); await shot('TU-gameover');
const rowsB = await p.evaluate(() => [...document.querySelectorAll('#over-breakdown > div')].map((r) => r.innerText.replace(/\s+/g, ' ')).concat([document.getElementById('over-time').innerText.replace(/\s+/g, ' ')]));
console.log('B rows', JSON.stringify(rowsB));
await b.close();
