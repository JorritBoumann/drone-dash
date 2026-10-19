// Round 34 critic (new): every 50 ms in play, each visible centre pop (real DOM rect, ancestors checked) against the real
// drone box (__GAME__.droneBox(), every visible vertex through the render camera) and the other HUD boxes, by pop and target.
window.__p34 = { n: 0, popN: {}, onDrone: {}, hit: {}, off: 0, twoPops: 0, gapMin: 1e9, gaps: [], ex: [] };
setInterval(() => {
  const d = window.__THREE_GAME_DIAGNOSTICS__, G = window.__GAME__;
  if (!d || d.state !== 'playing' || !G || !G.droneBox) return;
  const P = window.__p34; P.n++;
  const vis = (e) => { if (!e) return null; let p = e; while (p && p !== document.body) { const c = getComputedStyle(p); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.15) return null; p = p.parentElement; } const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 ? r : null; };
  const q = (s) => document.querySelector(s);
  const ix = (a, b) => a && b && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  const pops = ['#pop', '#slip-pop', '#medal-pop', '#event-pop'].map((s) => [s, vis(q(s))]).filter((x) => x[1]);
  if (!pops.length) return;
  if (pops.length > 1 && ix(pops[0][1], pops[1][1])) P.twoPops++;
  const b = G.droneBox(); const dr = !b.behind && Number.isFinite(b.x) ? { left: b.x, right: b.x + b.w, top: b.y, bottom: b.y + b.h } : null;
  const others = ['.nav-arrow', '.nav-diamond', '#nav-distance', '.hud-score', '.hud-center', '.hud-right', '.hud-bottom', '#view-hint', '#route-hint', '#objective', '#timer', '#touch-stick', '#up-button', '#down-button', '#boost-button', '#gate-tag', '#combo-chip', '#slip', '#slip-cue', '#wind'].map((s) => [s, vis(q(s))]).filter((x) => x[1]);
  for (const [ps, pr] of pops) {
    P.popN[ps] = (P.popN[ps] || 0) + 1;
    if (pr.left < 0 || pr.top < 0 || pr.right > innerWidth || pr.bottom > innerHeight) P.off++;
    if (dr) {
      if (ix(dr, pr)) { P.onDrone[ps] = (P.onDrone[ps] || 0) + 1; if (P.ex.length < 12) P.ex.push({ t: performance.now() | 0, ps, pr: [pr.left | 0, pr.top | 0, pr.width | 0, pr.height | 0], dr: [b.x | 0, b.y | 0, b.w | 0, b.h | 0], txt: q(ps).textContent.trim().slice(0, 30) }); }
      const gx = Math.max(0, dr.left - pr.right, pr.left - dr.right), gy = Math.max(0, dr.top - pr.bottom, pr.top - dr.bottom); const g = Math.hypot(gx, gy);
      P.gapMin = Math.min(P.gapMin, g); if (P.n % 4 === 0) P.gaps.push(Math.round(g));
    }
    for (const [os, or] of others) if (ix(pr, or)) { const k = ps + '>' + os; P.hit[k] = (P.hit[k] || 0) + 1; }
  }
}, 50);
