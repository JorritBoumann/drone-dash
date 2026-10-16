// Round 19 builder (new): centre messages never overlap. Real time (one browser, nothing else running). One run on SEED
// fires every centre message trigger, several close together: deliveries and pickups (place on the pad), payouts (placed
// fast in an alley), crashes (placed fast at a wall), medals (from the deliveries), rush hour at 60 s (a delivery and a
// crash right around it), overtime (pick up, then let the clock run out) and the overtime delivery. Every 50 ms it
// reads the four centre elements (#pop, #medal-pop, #event-pop, #slip-pop) and counts frames where two of them are
// visible (opacity > 0.05) with overlapping boxes. Also counts overlaps of a centre message with the objective pill or
// the route hint. Desktop or MOBILE=1 (iPhone 13 landscape).
import { chromium, devices } from '@playwright/test';
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const SEED = process.env.SEED || '22'; const MOBILE = !!process.env.MOBILE; const tag = MOBILE ? 'm' : 'd';
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5188/?seed=' + SEED, { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
await page.evaluate(() => window.__GAME__.start());
const t0 = Date.now(); const T = () => (Date.now() - t0) / 1000;
const sample = () => page.evaluate(() => {
  const ids = ['pop', 'medal-pop', 'event-pop', 'slip-pop'];
  const vis = [];
  for (const id of ids) { const el = document.getElementById(id); const op = +getComputedStyle(el).opacity; if (op > 0.05) { const r = el.getBoundingClientRect(); vis.push({ id, op, r: [r.left, r.top, r.right, r.bottom], text: el.textContent.trim().slice(0, 40) }); } }
  const hud = ['objective', 'route-hint'].map((id) => { const el = document.getElementById(id); const r = el.getBoundingClientRect(); return { id, op: +getComputedStyle(el).opacity, r: [r.left, r.top, r.right, r.bottom] }; }).filter((h) => h.op > 0.05);
  const hit = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  const pairs = []; for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) if (hit(vis[i].r, vis[j].r)) pairs.push(vis[i].id + '+' + vis[j].id);
  const hudHits = []; for (const v of vis) for (const h of hud) if (hit(v.r, h.r)) hudHits.push(v.id + '/' + h.id);
  const d = window.__THREE_GAME_DIAGNOSTICS__;
  return { vis: vis.map((v) => v.id), texts: vis.map((v) => v.text), pairs, hudHits, state: d.state, timeLeft: d.timeLeft, del: d.deliveries, crashes: d.crashes, ot: d.ending?.overtime, payouts: d.slipstream?.payouts, tier: d.goals?.tier, rush: d.escalation?.on };
});
const g = (fn, arg) => page.evaluate(fn, arg);
const finishLeg = () => g(() => { const d = window.__THREE_GAME_DIAGNOSTICS__; const o = d.objective.position; window.__GAME__.place(o.x, o.y + 1.3, o.z, 0, 0); });
// an alley strip and a wall to crash into
const city = await g(() => ({ feats: window.__GAME__.features().filter((f) => f.kind === 'alley'), sites: window.__GAME__.sites() }));
const al = city.feats[0];
const axis = await g((f) => { const r = window.__GAME__.streetRoute({ x: f.x, z: f.z - 22 }, { x: f.x, z: f.z + 22 }, true); return r.names.includes(f.name) && r.length < 50 ? 'z' : 'x'; }, al);
const payout = () => g(([f, axis]) => { const G = window.__GAME__; if (axis === 'z') G.place(f.x, 4.5, f.z - 20, Math.PI, 16); else G.place(f.x - 20, 4.5, f.z, -Math.PI / 2, 16); }, [al, axis]);
const crash = () => g(([f, axis]) => { const G = window.__GAME__; G.key('KeyW', true); if (axis === 'z') G.place(f.x + 19, 4, f.z + 6, Math.PI / 2, 19); else G.place(f.x + 6, 4, f.z + 19, 0, 19); }, [al, axis]);
const counts = { frames: 0, overlapFrames: 0, pairs: {}, hudHits: {}, seen: {} }; const events = [];
let lastAct = 0, phase = 'deliver', shot = 0, otShot = false;
while (T() < 320) {
  const s = await sample();
  counts.frames++;
  for (const id of s.vis) counts.seen[id] = (counts.seen[id] || 0) + 1;
  if (s.pairs.length) { counts.overlapFrames++; for (const p of s.pairs) counts.pairs[p] = (counts.pairs[p] || 0) + 1; if (shot < 4) { shot++; await page.screenshot({ path: OUT + `O-${tag}-seed${SEED}-overlap${shot}.jpg`, type: 'jpeg', quality: 80 }); } }
  for (const h of s.hudHits) counts.hudHits[h] = (counts.hudHits[h] || 0) + 1;
  if (s.state !== 'playing') break;
  const t = T();
  // scripted triggers
  if (phase === 'deliver' && t - lastAct > 2.2) {
    lastAct = t;
    const k = Math.floor(t / 2.2) % 5;
    if (k === 2) { await payout(); events.push(['payout', +t.toFixed(1)]); }
    else if (k === 4) { await crash(); events.push(['crash', +t.toFixed(1)]); await page.waitForTimeout(900); await g(() => window.__GAME__.key('KeyW', false)); await finishLeg(); events.push(['leg', +t.toFixed(1)]); }
    else { await finishLeg(); events.push(['leg', +t.toFixed(1)]); }
    if (t > 62 && s.del >= 1) phase = 'wait';
  }
  // rush at 60 s: a delivery and a crash right on it
  if (t > 59.6 && t < 60.3 && !events.some((e) => e[0] === 'rushleg')) { await finishLeg(); events.push(['rushleg', +t.toFixed(1)]); await crash(); await page.waitForTimeout(700); await g(() => window.__GAME__.key('KeyW', false)); }
  if (phase === 'wait') {
    // carry a parcel and let the clock run out (overtime), then deliver
    // deliver what is aboard while the clock is long; pick up the next parcel only in the last 2.5 s (overtime needs
    // the leg to be on schedule when the clock hits 0)
    const d = await g(() => window.__THREE_GAME_DIAGNOSTICS__.objective.phase);
    if (d !== 'pickup' && s.timeLeft > 4 && !s.ot) { await finishLeg(); events.push(['drop', +t.toFixed(1)]); }
    else if (d === 'pickup' && s.timeLeft < 2.5) { await finishLeg(); events.push(['pick', +t.toFixed(1)]); }
    else if (!s.ot) await g(() => window.__GAME__.place(0, 60, 0, 0, 0));
    if (s.ot) { phase = 'ot'; await page.waitForTimeout(1200); if (!otShot) { otShot = true; await page.screenshot({ path: OUT + `O-${tag}-seed${SEED}-overtime.jpg`, type: 'jpeg', quality: 80 }); } await finishLeg(); events.push(['otdrop', +t.toFixed(1)]); }
  }
  await page.waitForTimeout(50);
}
const fin = await g(() => { const d = window.__THREE_GAME_DIAGNOSTICS__; return { state: d.state, score: d.score, del: d.deliveries, crashes: d.crashes, payouts: d.slipstream.payouts, tier: d.goals?.tier, rushAt: d.escalation?.startedAt, ot: d.ending, centreLog: d.centreLog }; });
console.log(JSON.stringify({ seed: SEED, mobile: MOBILE, counts, events, fin }));
console.log(`MSG ${tag} seed ${SEED}: frames ${counts.frames}, overlap frames ${counts.overlapFrames}, seen ${JSON.stringify(counts.seen)}, crashes ${fin.crashes}, deliveries ${fin.del}, payouts ${fin.payouts}, tier ${fin.tier}, rush at ${fin.rushAt}, overtime ${fin.ot?.overtime}, hud overlaps ${JSON.stringify(counts.hudHits)}`);
await browser.close();
