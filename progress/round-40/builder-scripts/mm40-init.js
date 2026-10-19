// Round 40 builder (new): every 100 ms in play, the minimap box against every other HUD box (controls, meters, pills,
// chips, pops, nav marker, gate tag). Logged as MM40 by hud-probe34.
window.__mm40 = { n: 0, hit: {}, any: 0, box: null };
setInterval(() => {
  const d = window.__THREE_GAME_DIAGNOSTICS__; if (!d || d.state !== 'playing') return;
  const mm = document.getElementById('minimap'); if (!mm || mm.hidden) return;
  const vis = (e) => { if (!e) return null; let p = e; while (p && p !== document.body) { const c = getComputedStyle(p); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.15) return null; p = p.parentElement; } const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 ? r : null; };
  const m = vis(mm); if (!m) return;
  const M = window.__mm40; M.n++; M.box = [m.left | 0, m.top | 0, m.width | 0, m.height | 0];
  const ix = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  let hitAny = false;
  for (const s of ['#touch-stick', '.stick-hint', '#up-button', '#down-button', '#boost-button', '.hud-bottom', '#slip', '.boost', '.hud-score', '.hud-center', '#objective', '#timer', '#route-hint', '.hud-right', '#pop', '#slip-pop', '#medal-pop', '#event-pop', '.nav-arrow', '.nav-diamond', '#nav-distance', '#gate-tag', '#view-hint', '#combo-chip', '#wind']) {
    const r = vis(document.querySelector(s)); if (r && ix(m, r)) { M.hit[s] = (M.hit[s] || 0) + 1; hitAny = true; }
  }
  if (hitAny) M.any++;
}, 100);
