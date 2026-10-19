// Round 24 builder: phone HUD overlap probe (init script, 10 Hz while playing).
// Reads the real visible boxes: nav marker children (arrow, diamond, distance), touch stick and buttons, top pills
// (timer, objective, route hint), centre pops, and the drone's projected screen box (__GAME__.droneBox, real camera).
window.__hp = { samples: 0, markerVis: 0, markerHit: 0, markerHitBy: {}, droneSamples: 0, droneUnderPill: 0, high: 0, highUnder: 0, popVis: 0, popOnDrone: 0, popBy: {}, first: [], droneY: [] };
setInterval(() => {
  const d = window.__THREE_GAME_DIAGNOSTICS__, G = window.__GAME__;
  if (!d || d.state !== 'playing' || !G || !G.droneBox) return;
  const H = window.__hp; H.samples++;
  const vis = (e) => { if (!e) return null; let p = e; while (p && p !== document.body) { const c = getComputedStyle(p); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.15) return null; p = p.parentElement; } const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 ? r : null; };
  const q = (s) => document.querySelector(s);
  const ix = (a, b) => a && b && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  const t = performance.now() | 0;
  // 1. marker over controls
  const parts = ['.nav-arrow', '.nav-diamond', '#nav-distance'].map((s) => [s, vis(q(s))]).filter((x) => x[1]);
  const ctl = ['#touch-stick', '#up-button', '#down-button', '#boost-button'].map((s) => [s, vis(q(s))]).filter((x) => x[1]);
  if (parts.length) H.markerVis++;
  let mh = false;
  for (const [ps, pr] of parts) for (const [cs, cr] of ctl) if (ix(pr, cr)) { mh = true; const k = ps + '>' + cs; H.markerHitBy[k] = (H.markerHitBy[k] || 0) + 1; if (H.first.length < 20) H.first.push({ t, k, alt: +d.player.position.y.toFixed(1) }); }
  if (mh) H.markerHit++;
  // 2. drone under the top pills
  const b = G.droneBox();
  if (!b.behind && Number.isFinite(b.x)) {
    const dr = { left: b.x, right: b.x + b.w, top: b.y, bottom: b.y + b.h };
    H.droneSamples++;
    const hi = d.player.position.y > 30; if (hi) H.high++;
    const pills = ['#timer', '#objective', '#route-hint'].map((s) => [s, vis(q(s))]).filter((x) => x[1]);
    let under = false; for (const [ps, pr] of pills) if (ix(dr, pr)) { under = true; const k = 'drone<' + ps; H.markerHitBy[k] = (H.markerHitBy[k] || 0) + 1; }
    if (under) { H.droneUnderPill++; if (hi) H.highUnder++; if (H.first.length < 20) H.first.push({ t, k: 'drone-under', alt: +d.player.position.y.toFixed(1), box: [b.x | 0, b.y | 0, b.w | 0, b.h | 0] }); }
    if (H.samples % 10 === 0) H.droneY.push([+d.player.position.y.toFixed(1), Math.round(b.y), Math.round(b.h), Math.round(b.shift || 0)]);
    // 3. centre pops over the drone
    const pops = ['#pop', '#slip-pop', '#medal-pop', '#event-pop'].map((s) => [s, vis(q(s))]).filter((x) => x[1]);
    if (pops.length) { H.popVis++; let on = false; for (const [ps, pr] of pops) if (ix(dr, pr)) { on = true; H.popBy[ps] = (H.popBy[ps] || 0) + 1; } if (on) { H.popOnDrone++; if (H.first.length < 20) H.first.push({ t, k: 'pop-on-drone', txt: pops.map((p) => q(p[0]).textContent.trim().slice(0, 30)).join('|') }); } }
  }
}, 100);
