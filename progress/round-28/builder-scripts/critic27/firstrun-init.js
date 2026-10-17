// Round 25 critic: first-run HUD logger (init script). Every 100 ms while playing: which HUD parts are visible (element and
// ancestors displayed, visible, opacity >= 0.15, size > 2 px). Logs first appearance (s since play began) and every distinct
// text shown in the pop / event / slip / medal banners, with time. Log-only.
window.__fr = { t0: null, first: {}, shows: [], lastTxt: {}, samples: 0, teach: null, vis: {} };
setInterval(() => {
  const d = window.__THREE_GAME_DIAGNOSTICS__; if (!d || d.state !== 'playing') return;
  const F = window.__fr; const now = performance.now() / 1000; if (F.t0 === null) F.t0 = now; const t = +(now - F.t0).toFixed(1); F.samples++;
  const vis = (e) => { if (!e) return false; let p = e; while (p && p !== document.body) { const c = getComputedStyle(p); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.15) return false; p = p.parentElement; } const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight; };
  const sels = ['.hud-score', '#score-pending', '#goal', '#combo-chip', '#timer', '#time-bonus', '#timer-slow', '#time-penalty', '#objective', '#objective-bank', '#objective-rush', '#route-hint', '#deliveries-value', '#slip', '#slip-cue', '#wind', '#boost-fill', '#speed-value', '#alt-value', '#view-hint', '.nav-diamond', '#nav-distance', '#gate-tag', '#slip-pop', '#medal-pop', '#event-pop', '#pop', '#pause-button', '#music-toggle', '#touch-stick', '#boost-button'];
  for (const s of sels) { const v = vis(document.querySelector(s)); if (v && F.first[s] === undefined) F.first[s] = t; F.vis[s] = (F.vis[s] || 0) + (v ? 1 : 0); }
  for (const s of ['#pop', '#event-pop', '#slip-pop', '#medal-pop', '#view-hint', '#time-bonus']) { const e = document.querySelector(s); const v = vis(e); const txt = v ? e.textContent.replace(/\s+/g, ' ').trim().slice(0, 80) : ''; if (txt && txt !== F.lastTxt[s]) F.shows.push({ t, s, txt }); F.lastTxt[s] = txt; }
  F.teach = d.teach || null; F.score = d.score; F.deliveries = d.deliveries;
}, 100);
