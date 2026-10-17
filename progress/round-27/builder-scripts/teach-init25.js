// Round 25 builder: init script. (1) First appearance of every HUD element, in run seconds (the game's own runTime is not
// exposed, so run time = seconds since the state first became 'playing'). (2) Camera to drone distance every frame, with
// the corridor framing weight, so open-street samples can be counted.
window.__t25 = { first: {}, cam: { n: 0, open: 0, under2: 0, under25: 0, min: 99, minAt: null, rows: [] }, t0: null };
const IDS = ['score-value', 'timer', 'objective', 'nav-marker', 'goal', 'combo-chip', 'slip', 'timer-slow', 'objective-bank', 'score-pending', 'objective-rush', 'route-hint', 'gate-tag', 'wind', 'view-hint', 'pop', 'slip-pop', 'medal-pop', 'event-pop', 'time-bonus'];
(function loop() {
  const f = (now) => {
    const T = window.__t25, d = window.__THREE_GAME_DIAGNOSTICS__;
    if (d && d.state === 'playing' && T.t0 === null) T.t0 = now;
    if (d && T.t0 !== null && d.state === 'playing') {
      const t = (now - T.t0) / 1000;
      for (const id of IDS) {
        if (T.first[id] !== undefined) continue;
        const e = document.getElementById(id); if (!e) continue;
        const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
        let op = 1; for (let n = e; n && n.nodeType === 1; n = n.parentElement) { const c = getComputedStyle(n); op *= Number(c.opacity); if (c.display === 'none' || c.visibility === 'hidden') { op = 0; break; } }
        if (r.width > 0 && r.height > 0 && op > 0.05 && !e.hidden && cs.display !== 'none') T.first[id] = { t: Math.round(t * 10) / 10, text: (e.innerText || '').replace(/\s+/g, ' ').slice(0, 80) };
      }
      const c = d.camera, p = d.player && d.player.position;
      if (c && p) {
        const dist = Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z); const cw = (c.corridor && c.corridor.w) || 0; const C = T.cam;
        C.n++;
        if (cw < 0.05 && p.y < 30) { C.open++; if (dist < 2) C.under2++; if (dist < 2.5) C.under25++; if (dist < C.min) { C.min = dist; C.minAt = { t: Math.round(t * 10) / 10, x: p.x, y: p.y, z: p.z, ph: d.objective && d.objective.phase } } }
        if (dist < 2.5 && C.rows.length < 400) C.rows.push({ t: Math.round(t * 100) / 100, dist: Math.round(dist * 100) / 100, cw: Math.round(cw * 100) / 100, py: Math.round(p.y * 10) / 10, del: d.deliveries });
      }
    }
    requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
})();
// (3) Route tag check (10 Hz): the visible .gate-tag pill (and its edge arrow when shown) against the stick with its
// "Fly" label, the buttons, the top panels, and the screen edges.
window.__t25.tag = { samples: 0, vis: 0, onCtl: 0, onFly: 0, onTop: 0, offScreen: 0, ex: [] };
setInterval(() => {
  const d = window.__THREE_GAME_DIAGNOSTICS__; if (!d || d.state !== 'playing') return;
  const T = window.__t25.tag; T.samples++;
  const vis = (e) => { if (!e) return null; let p = e; while (p && p !== document.body) { const c = getComputedStyle(p); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.15) return null; p = p.parentElement; } const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 ? r : null; };
  const q = (s) => document.querySelector(s);
  const ix = (a, b) => a && b && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  const parts = ['.gate-tag-pill', '.gate-tag-arrow'].map((s) => vis(q(s))).filter(Boolean);
  if (!parts.length) return;
  T.vis++;
  const st = vis(q('#touch-stick')); const fly = st ? { left: st.left, right: st.right, top: st.top - 20, bottom: st.top } : null;
  const ctl = ['#touch-stick', '#up-button', '#down-button', '#boost-button'].map((s) => vis(q(s))).filter(Boolean);
  const top = ['.hud-score', '.hud-center', '.hud-right'].map((s) => vis(q(s))).filter(Boolean);
  const pill = vis(q('.gate-tag-pill'));
  let c = false, f = false, tp = false;
  for (const p of parts) { if (ctl.some((r) => ix(p, r))) c = true; if (ix(p, fly)) f = true; if (top.some((r) => ix(p, r))) tp = true; }
  if (c) T.onCtl++; if (f) T.onFly++; if (tp) T.onTop++;
  if (pill && (pill.left < 0 || pill.top < 0 || pill.right > innerWidth || pill.bottom > innerHeight)) T.offScreen++;
  if ((c || f || tp) && T.ex.length < 8) T.ex.push({ t: performance.now() | 0, c, f, tp, pill: pill ? [pill.left | 0, pill.top | 0, pill.width | 0] : null, text: (q('#gate-tag-name') || {}).textContent });
}, 100);
