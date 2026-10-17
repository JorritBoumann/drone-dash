// Round 28 builder copy: also logs played payout chimes (diagnostics slipstream.chimes) and whether their pop showed.
// Round 27 critic (new, log-only): early-feedback and phone camera logger. Every 100 ms while playing:
// - feedback events: a pop / banner / hint / slip pop / medal pop / time bonus with new text, a pickup or drop, a phase change.
// - reward checks: each slipstream payout (was the slip layer shown? was #slip-pop visible within 0.6 s?), each medal pass (medal pop within 0.6 s?).
// - introductions: each new teach.log entry with the state of its system at that moment.
// - camera: in the 3 s after a pickup or drop, the drone box height / screen height, and whether the drone was within 4 m of a solid at the event.
// - pops (any banner) intersecting the stick's "Fly" label.
window.__fb = { t0: null, ev: [], chimes: [], pays: [], medals: [], intros: [], cam: [], flyHits: 0, flyEx: [], popSamples: 0, meter: [] };
(function () {
  let prev = null, lastTxt = {}, pending = [], lastTeach = 0, win = [];
  const vis = (e) => { if (!e) return null; let p = e; while (p && p !== document.body) { const c = getComputedStyle(p); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.15) return null; p = p.parentElement; } const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight ? r : null; };
  const ix = (a, b) => a && b && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  const txt = (s) => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim().slice(0, 70) : ''; };
  setInterval(() => {
    const d = window.__THREE_GAME_DIAGNOSTICS__, G = window.__GAME__, F = window.__fb; if (!d || d.state !== 'playing' || !G) return;
    const now = performance.now() / 1000; if (F.t0 === null) F.t0 = now; const t = +(now - F.t0).toFixed(1);
    const app = document.getElementById('app').className;
    // feedback events
    for (const s of ['#pop', '#event-pop', '#slip-pop', '#medal-pop', '#view-hint', '#time-bonus']) { const v = vis(document.querySelector(s)); const x = v ? txt(s) : ''; if (x && x !== lastTxt[s]) F.ev.push({ t, k: 'show', s, x }); lastTxt[s] = x; }
    const slipVis = !!vis(document.querySelector('#slip'));
    if (prev) {
      if (d.deliveries > prev.deliveries) { F.ev.push({ t, k: 'drop' }); pending.push({ t, k: 'drop' }); }
      if (d.player.carrying && !prev.player.carrying) { F.ev.push({ t, k: 'pick' }); pending.push({ t, k: 'pick' }); }
      if (d.slipstream.payouts > prev.slipstream.payouts) F.pays.push({ t, shown: /\bl-slip\b/.test(app) || !/\bteach\b/.test(app), teach: /\bteach\b/.test(app), popAt: null, banked: d.slipstream.bank - prev.slipstream.bank });
      if ((d.slipstream.chimes || 0) > (prev.slipstream.chimes || 0)) F.chimes.push({ t, popAt: null });
      if (d.goals.passes > prev.goals.passes) F.medals.push({ t, tier: d.goals.tierName, popAt: null });
      if (slipVis && Math.abs(d.slipstream.level - prev.slipstream.level) > 0.004) F.meter.push(t);
    }
    const sp = vis(document.querySelector('#slip-pop')), mp = vis(document.querySelector('#medal-pop'));
    for (const p of F.pays) if (p.popAt === null && t - p.t <= 0.7 && sp) p.popAt = t;
    for (const c of F.chimes) if (c.popAt === null && t - c.t <= 0.7 && sp) c.popAt = t;
    for (const m of F.medals) if (m.popAt === null && t - m.t <= 0.7 && mp) m.popAt = t;
    // introductions
    const log = (d.teach && d.teach.log) || [];
    while (lastTeach < log.length) { const e = log[lastTeach++]; F.intros.push({ k: e.k, rt: e.t, t, alt: +d.player.position.y.toFixed(1), headwind: +d.player.headwind.toFixed(2), speed: +d.player.speed.toFixed(1), drafting: d.slipstream.drafting, level: +d.slipstream.level.toFixed(2), clockGain: +(d.slipstream.clockGain || 0).toFixed(3), gate: !!(d.routeMark && d.routeMark.tagOn), routeMark: !!d.routeMark, combo: d.combo, tier: d.goals.tierName, rush: d.escalation && d.escalation.on }); }
    // camera after pickup / drop
    const p = d.player.position;
    for (const e of pending) { e.wall = G.insideSolid(p.x, p.y, p.z, 4); e.wall2 = G.insideSolid(p.x, p.y, p.z, 2.5); win.push(e); }
    pending = [];
    win = win.filter((e) => t - e.t <= 3);
    if (win.length) { const b = G.droneBox(); if (!b.behind && Number.isFinite(b.h)) F.cam.push({ t, k: win[0].k, et: win[0].t, wall: win.some((e) => e.wall), wall2: win.some((e) => e.wall2), hf: +(b.h / innerHeight).toFixed(3), wf: +(b.w / innerWidth).toFixed(3), y: +p.y.toFixed(1), L: +Math.hypot(d.camera.x - p.x, d.camera.y - p.y, d.camera.z - p.z).toFixed(2) }); }
    // pops on the "Fly" label
    const fly = vis(document.querySelector('.stick-hint'));
    if (fly) { const pops = ['#pop', '#event-pop', '#slip-pop', '#medal-pop', '#view-hint', '#time-bonus', '#gate-tag'].map((s) => [s, vis(document.querySelector(s))]).filter((x) => x[1]);
      if (pops.length) { F.popSamples++; const h = pops.filter(([, r]) => ix(r, fly)); if (h.length) { F.flyHits++; if (F.flyEx.length < 10) F.flyEx.push({ t, s: h.map((x) => x[0] + ':' + txt(x[0]).slice(0, 30)).join('|') }); } } }
    prev = JSON.parse(JSON.stringify({ deliveries: d.deliveries, player: { carrying: d.player.carrying }, slipstream: { chimes: d.slipstream.chimes || 0, payouts: d.slipstream.payouts, level: d.slipstream.level, bank: d.slipstream.bank }, goals: { passes: d.goals.passes } }));
  }, 100);
})();
