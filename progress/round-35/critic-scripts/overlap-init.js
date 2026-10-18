// Round 20 critic: in-page HUD overlap sampler (10 Hz). A pop counts while its computed opacity > 0.15 and it has size.
// Records every sample where a centre pop rectangle intersects a meter, cue or pill, and nav marker / gate tag over the hint pill.
window.__ov = { samples: 0, popVis: 0, hits: {}, first: [] };
setInterval(() => {
  const vis = (e) => { if (!e) return null; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.15) return null; let p = e.parentElement; while (p) { const c = getComputedStyle(p); if (c.display === 'none' || +c.opacity < 0.15 || c.visibility === 'hidden') return null; p = p.parentElement; } const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 ? r : null; };
  const g = (id) => document.getElementById(id) || document.querySelector(id);
  const hud = g('hud'); if (!hud || !window.__THREE_GAME_DIAGNOSTICS__ || window.__THREE_GAME_DIAGNOSTICS__.state !== 'playing') return;
  window.__ov.samples++;
  const pops = ['slip-pop', 'medal-pop', 'event-pop', 'pop'];
  const meters = ['slip', '.boost-track', 'slip-cue', 'route-hint', 'objective', 'timer', 'touch-stick', 'up-button', 'down-button', 'boost-button'];
  const ix = (a, b) => a && b && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  let anyPop = false;
  for (const p of pops) { const a = vis(g(p)); if (!a) continue; anyPop = true;
    for (const m of meters) { const b = vis(g(m)); if (ix(a, b)) { const k = p + '>' + m; window.__ov.hits[k] = (window.__ov.hits[k] || 0) + 1; if (window.__ov.first.length < 12) window.__ov.first.push({ k, t: performance.now() | 0, txt: g(p).textContent.trim().slice(0, 40) }); } } }
  for (const p of pops) for (const q of pops) if (p < q && ix(vis(g(p)), vis(g(q)))) { const k = p + '>' + q; window.__ov.hits[k] = (window.__ov.hits[k] || 0) + 1; }
  if (anyPop) window.__ov.popVis++;
  for (const p of ['nav-marker', 'gate-tag']) for (const m of ['route-hint', 'objective', 'slip', '.boost-track']) { if (ix(vis(g(p)), vis(g(m)))) { const k = p + '>' + m; window.__ov.hits[k] = (window.__ov.hits[k] || 0) + 1; } }
}, 100);
