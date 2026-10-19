// Round 25 critic: 24c plus route-tag checks (X.gate*) and camera distance (X.cam*). Round 24 critic: the builder's hud-probe-init.js logic (1 to 3 below, unchanged rules) plus extra checks in H.x.
// Every box is a real getBoundingClientRect of a visible element (ancestors checked for display/visibility/opacity),
// the drone box is __GAME__.droneBox() (every visible drone vertex through the real render camera, view offset included).
window.__hp = { samples: 0, markerVis: 0, markerHit: 0, markerHitBy: {}, droneSamples: 0, droneUnderPill: 0, high: 0, highUnder: 0, popVis: 0, popOnDrone: 0, popBy: {}, first: [], droneY: [],
  x: { markerOnFly: 0, markerOnTop: 0, popOverCtl: 0, popOverTop: 0, otherOnDrone: {}, droneOverBottom: 0, droneOverCtl: 0, droneOff: 0, shiftOn: 0, shiftSum: 0, shiftMax: 0, yFrac: [0,0,0,0,0,0,0,0,0,0], hiYFrac: [0,0,0,0,0,0,0,0,0,0], hiShift: 0, markerHitEx: [], gateVis: 0, gateOnCtl: 0, gateOnFly: 0, gateOnTop: 0, gateOffScreen: 0, gateEx: [], camN: 0, camOpenN: 0, camOpen2: 0, camOpen25: 0, camMin: 99, camOpenMin: 99, camEx: [] } };
setInterval(() => {
  const d = window.__THREE_GAME_DIAGNOSTICS__, G = window.__GAME__;
  if (!d || d.state !== 'playing' || !G || !G.droneBox) return;
  const H = window.__hp, X = H.x; H.samples++;
  const vis = (e) => { if (!e) return null; let p = e; while (p && p !== document.body) { const c = getComputedStyle(p); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.15) return null; p = p.parentElement; } const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 ? r : null; };
  const q = (s) => document.querySelector(s);
  const ix = (a, b) => a && b && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  const t = performance.now() | 0;
  const W = innerWidth, Hh = innerHeight;
  const parts = ['.nav-arrow', '.nav-diamond', '#nav-distance'].map((s) => [s, vis(q(s))]).filter((x) => x[1]);
  const ctl = ['#touch-stick', '#up-button', '#down-button', '#boost-button'].map((s) => [s, vis(q(s))]).filter((x) => x[1]);
  if (parts.length) H.markerVis++;
  let mh = false;
  for (const [ps, pr] of parts) for (const [cs, cr] of ctl) if (ix(pr, cr)) { mh = true; const k = ps + '>' + cs; H.markerHitBy[k] = (H.markerHitBy[k] || 0) + 1; if (X.markerHitEx.length < 10) X.markerHitEx.push({ t, k, pr: [pr.left|0, pr.top|0, pr.width|0, pr.height|0], cr: [cr.left|0, cr.top|0, cr.width|0, cr.height|0] }); }
  if (mh) H.markerHit++;
  const st = vis(q('#touch-stick')); const fly = st ? { left: st.left, right: st.right, top: st.top - 20, bottom: st.top } : null;
  if (parts.some(([, pr]) => ix(pr, fly))) X.markerOnFly++;
  const topEls = ['.hud-score', '.hud-center', '.hud-right'].map((s) => vis(q(s))).filter(Boolean);
  if (parts.some(([, pr]) => topEls.some((r) => ix(pr, r)))) X.markerOnTop++;

  { const gp = vis(q('#gate-tag .gate-tag-pill')) || vis(q('#gate-tag'));
    if (gp) { X.gateVis++; const gc = ctl.some(([, cr]) => ix(gp, cr)), gf = ix(gp, fly), gtop = topEls.some((r) => ix(gp, r)), goff = gp.left < 0 || gp.top < 0 || gp.right > W || gp.bottom > Hh;
      if (gc) X.gateOnCtl++; if (gf) X.gateOnFly++; if (gtop) X.gateOnTop++; if (goff) X.gateOffScreen++;
      if ((gc || gf || goff) && X.gateEx.length < 10) X.gateEx.push({ t, gc, gf, gtop, goff, r: [gp.left|0, gp.top|0, gp.width|0, gp.height|0], txt: q('#gate-tag').textContent.trim().slice(0, 30) }); } }
  { const c = d.camera, p = d.player.position; if (c && p) { const L = Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z); X.camN++; X.camMin = Math.min(X.camMin, +L.toFixed(2)); const open = !d.narrow;
      if (open) { X.camOpenN++; X.camOpenMin = Math.min(X.camOpenMin, +L.toFixed(2)); if (L < 2) { X.camOpen2++; if (X.camEx.length < 10) X.camEx.push({ t, L: +L.toFixed(2), alt: +p.y.toFixed(1), ph: d.objective && d.objective.phase }); } if (L < 2.5) X.camOpen25++; } } }
  const b = G.droneBox();
  if (!b.behind && Number.isFinite(b.x)) {
    const dr = { left: b.x, right: b.x + b.w, top: b.y, bottom: b.y + b.h };
    H.droneSamples++;
    const hi = d.player.position.y > 30; if (hi) H.high++;
    const pills = ['#timer', '#objective', '#route-hint'].map((s) => [s, vis(q(s))]).filter((x) => x[1]);
    let under = false; for (const [ps, pr] of pills) if (ix(dr, pr)) { under = true; const k = 'drone<' + ps; H.markerHitBy[k] = (H.markerHitBy[k] || 0) + 1; }
    if (under) { H.droneUnderPill++; if (hi) H.highUnder++; if (H.first.length < 20) H.first.push({ t, k: 'drone-under', alt: +d.player.position.y.toFixed(1), box: [b.x | 0, b.y | 0, b.w | 0, b.h | 0] }); }
    if (H.samples % 10 === 0) H.droneY.push([+d.player.position.y.toFixed(1), Math.round(b.y), Math.round(b.h), Math.round(b.shift || 0)]);
    const pops = ['#pop', '#slip-pop', '#medal-pop', '#event-pop'].map((s) => [s, vis(q(s))]).filter((x) => x[1]);
    if (pops.length) { H.popVis++; let on = false; for (const [ps, pr] of pops) if (ix(dr, pr)) { on = true; H.popBy[ps] = (H.popBy[ps] || 0) + 1; } if (on) { H.popOnDrone++; if (H.first.length < 20) H.first.push({ t, k: 'pop-on-drone', txt: pops.map((p) => q(p[0]).textContent.trim().slice(0, 30)).join('|') }); }
      if (pops.some(([, pr]) => ctl.some(([, cr]) => ix(pr, cr)))) X.popOverCtl++;
      if (pops.some(([, pr]) => topEls.some((r) => ix(pr, r)))) X.popOverTop++; }
    for (const s of ['#view-hint', '#slip-cue', '#gate-tag', '#combo-chip', '#wind', '#slip', '#time-bonus', '#time-penalty']) { const r = vis(q(s)); if (r && ix(dr, r)) X.otherOnDrone[s] = (X.otherOnDrone[s] || 0) + 1; }
    const bot = vis(q('.hud-bottom')); if (ix(dr, bot)) X.droneOverBottom++;
    if (ctl.some(([, cr]) => ix(dr, cr))) X.droneOverCtl++;
    if (dr.bottom < 0 || dr.top > Hh || dr.right < 0 || dr.left > W) X.droneOff++;
    const sh = b.shift || 0; if (sh > 0.5) X.shiftOn++; X.shiftSum += sh; X.shiftMax = Math.max(X.shiftMax, sh); if (hi) X.hiShift += sh;
    const yc = (dr.top + dr.bottom) / 2 / Hh; const bin = Math.max(0, Math.min(9, Math.floor(yc * 10))); X.yFrac[bin]++; if (hi) X.hiYFrac[bin]++;
  }
}, 100);
