// Round 25 critic: log every frame over 40 ms with run time and what the game was doing (log-only).
window.__big = []; window.__t0 = null;
(function f(){ let l = performance.now(); const g = (t) => { const dt = t - l; l = t; const d = window.__THREE_GAME_DIAGNOSTICS__;
  if (d && d.state === 'playing') { if (window.__t0 === null) window.__t0 = t; if (dt > 40) { const q = (s) => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g,' ').trim().slice(0,40) : ''; };
    window.__big.push({ rt: +((t - window.__t0) / 1000).toFixed(2), dt: +dt.toFixed(1), del: d.deliveries, ph: d.objective && d.objective.phase, score: d.score, pop: q('#pop'), ev: q('#event-pop'), medal: q('#medal-pop'), cls: document.getElementById('app').className, rush: !!(d.escalation && d.escalation.on) }); } }
  requestAnimationFrame(g); }; requestAnimationFrame(g); })();
