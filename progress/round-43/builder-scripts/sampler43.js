// Round 43 builder (from the round 42 critic's sampler42.js): adds per-frame checks that markers are on screen and off the
// touch controls, event labels fully on screen, the HTML game-over card vs the corner every frame, and closes the
// full-screen-filter gap (only #speed-lines and #hit-flash are skipped now).
// Round 42 critic (new): in-page per-frame sampler, started with window.__S43.start(). Every animation frame in play
// (and on the game-over screen): (1) every painted HUD box and nav/gate marker part vs the platform corner (64 px plus
// the safe-area inset, read from env()), (2) event labels vs the objective pill vs the score panel, (3) medal pops vs
// the drone's screen box, (4) the canvas centre-message scale during its fade-in. The full DOM scan runs every 3rd frame;
// the fast-moving parts (nav marker, gate tag, pops, canvas panels) every frame.
// KNOWN GAP (found after the runs): the full-screen-effect filter (box > 80% of the viewport both ways) also skipped the
// game-over card when it is wide; the card was measured from the final screenshots instead (see critic.md).
(() => {
  const S = { frames: 0, scans: 0, corner: [], cornerN: 0, cornerFrames: 0, ov: {}, ovFrames: 0, touchN: 0, medal: { n: 0, hit: 0, ex: [] }, scale: { n: 0, bad: 0, ex: [], minRatio: 9, maxRatio: 0 }, over: 0, overCorner: 0, overCanvas: 0, firstHit: null, states: {} };
  window.__S43 = S; S.offScreen = 0; S.offEx = []; S.onCtl = 0; S.ctlEx = []; S.evOff = 0; S.evEx = []; S.markerFrames = 0; S.evFrames = 0; S.overCardCorner = 0; S.overCardEx = null;
  let cb = null;
  const corner = () => {
    if (!cb) { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:0;top:0;width:calc(64px + env(safe-area-inset-left,0px));height:calc(64px + env(safe-area-inset-top,0px));visibility:hidden;pointer-events:none'; document.body.appendChild(d); const r = d.getBoundingClientRect(); cb = { r: r.width, b: r.height }; S.cornerBox = cb; }
    return cb;
  };
  const opac = (e) => { let p = e, op = 1; while (p && p !== document.documentElement) { const s = getComputedStyle(p); if (s.display === 'none' || s.visibility === 'hidden') return 0; op *= Number(s.opacity); p = p.parentElement; } return op; };
  const paints = (e, cs) => cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none' || parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0 || cs.boxShadow !== 'none' || [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || ['svg', 'IMG', 'CANVAS', 'BUTTON', 'INPUT'].includes(e.tagName);
  const inC = (r, c) => r.width >= 1 && r.height >= 1 && r.left < c.r && r.top < c.b && r.right > 0 && r.bottom > 0;
  const nm = (e) => e.id || (typeof e.className === 'string' ? e.className : e.className?.baseVal) || e.tagName;
  const inter = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
  const gap = (a, b) => Math.max(a.l - b.r, b.l - a.r, a.t - b.b, b.t - a.b);
  const R = (r) => ({ l: r.left, t: r.top, r: r.right, b: r.bottom });
  const visBox = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); if (r.width < 1 || opac(e) < 0.05) return null; return R(r); };
  let lastEvKey = '', evStart = 0;
  const tick = () => {
    requestAnimationFrame(tick);
    if (!S.on) return;
    const G = window.__GAME__, D = window.__THREE_GAME_DIAGNOSTICS__; if (!G || !D) return;
    const st = D.state; S.states[st] = (S.states[st] || 0) + 1;
    if (st !== 'playing' && st !== 'over') return;
    S.frames++;
    const c = corner(); const hits = [];
    const full = S.frames % 3 === 0;
    if (full) {
      S.scans++;
      for (const e of document.querySelectorAll('body *')) {
        if (e.id === 'game-canvas' || e.id === 'app' || e.classList.contains('screen') || e.tagName === 'SCRIPT' || e.tagName === 'STYLE' || e.style.visibility === 'hidden' && e.getAttribute('aria-hidden') === 'true') continue;
        const r = e.getBoundingClientRect(); if (!inC(r, c)) continue; if (e.id === 'speed-lines' || e.id === 'hit-flash') continue; // full-screen effects only (r43: the wide over card is no longer skipped)
        const cs = getComputedStyle(e); if (!paints(e, cs)) continue; if (opac(e) < 0.05) continue;
        hits.push({ k: 'html', n: nm(e), b: [r.left, r.top, r.right, r.bottom].map(Math.round) });
      }
    } else {
      for (const sel of ['.nav-diamond', '.nav-arrow', '.nav-distance', '.gate-tag-pill', '.gate-tag-arrow', '#pop', '#event-pop', '#medal-pop', '#slip-pop']) {
        const e = document.querySelector(sel); if (!e) continue; const r = e.getBoundingClientRect(); if (!inC(r, c)) continue; if (opac(e) < 0.05) continue;
        hits.push({ k: 'html', n: sel, b: [r.left, r.top, r.right, r.bottom].map(Math.round) });
      }
    }
    // r43: markers (nav + gate tag) every frame: fully on screen, never on a touch control
    const ctl = []; for (const sel of ['#touch-stick', '.stick-hint', '#up-button', '#boost-button', '#down-button']) { const e = document.querySelector(sel); if (!e) continue; const r = e.getBoundingClientRect(); if (r.width >= 1 && opac(e) > 0.05) ctl.push(R(r)); }
    if (st === 'playing') {
      let any = false;
      for (const sel of ['.nav-diamond', '.nav-arrow', '.nav-distance', '.gate-tag-pill', '.gate-tag-arrow']) {
        const e = document.querySelector(sel); if (!e) continue; const r = e.getBoundingClientRect(); if (r.width < 1 || opac(e) < 0.05) continue; any = true;
        if (r.left < -0.5 || r.top < -0.5 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) { S.offScreen++; if (S.offEx.length < 8) S.offEx.push({ f: S.frames, sel, b: [r.left, r.top, r.right, r.bottom].map(Math.round) }); }
        const b = R(r); for (const q of ctl) if (inter(b, q) > 0) { S.onCtl++; if (S.ctlEx.length < 8) S.ctlEx.push({ f: S.frames, sel, b: Object.values(b).map(Math.round), q: Object.values(q).map(Math.round) }); }
      }
      if (any) S.markerFrames++;
    }
    if (st === 'over') { const e = document.querySelector('.over-card'); if (e && opac(e) > 0.05) { const r = e.getBoundingClientRect(); if (inC(r, c)) { S.overCardCorner++; S.overCardEx = [r.left, r.top, r.right, r.bottom].map(Math.round); } S.overCardBox = [r.left, r.top, r.right, r.bottom].map(Math.round); } }
    const ch = G.canvasHud();
    const panels = ch && ch.on ? ch.panels.filter((p) => p.visible && p.box && p.opacity > 0.05) : [];
    for (const p of panels) { const b = p.box; if (b.x < c.r && b.y < c.b && b.x + b.w > 0 && b.y + b.h > 0) hits.push({ k: 'canvas', n: p.name, b: [b.x, b.y, b.x + b.w, b.y + b.h].map(Math.round) }); }
    if (st === 'playing') {
      const evb = [];
      for (const p of panels) if (p.name === 'event') evb.push(['canvas:event', p.box.x, p.box.y, p.box.x + p.box.w, p.box.y + p.box.h]);
      if (!(ch && ch.on)) for (const sel of ['#pop', '#event-pop', '#medal-pop', '#slip-pop']) { const e = document.querySelector(sel); if (!e) continue; const r = e.getBoundingClientRect(); if (r.width < 1 || opac(e) < 0.05) continue; evb.push([sel, r.left, r.top, r.right, r.bottom]); }
      if (evb.length) S.evFrames++;
      for (const [n, l, t, r2, b] of evb) if (l < -0.5 || t < -0.5 || r2 > innerWidth + 0.5 || b > innerHeight + 0.5) { S.evOff++; if (S.evEx.length < 8) S.evEx.push({ f: S.frames, n, b: [l, t, r2, b].map(Math.round) }); }
    }
    if (st === 'over') { S.over++; if (panels.some((p) => p.name === 'over')) S.overCanvas++; if (hits.length) S.overCorner++; }
    if (hits.length) { S.cornerFrames++; S.byName = S.byName || {}; for (const h of hits) { const k = h.k + ':' + h.n; S.byName[k] = (S.byName[k] || 0) + 1; } if (S.corner.length < 30) S.corner.push({ f: S.frames, st, full, hits }); if (!S.firstHit) S.firstHit = { t: performance.now(), hits }; }
    if (st !== 'playing') return;
    // overlaps: event labels vs objective vs score
    const boxes = {};
    if (ch && ch.on) {
      for (const p of panels) if (['event', 'objective', 'score'].includes(p.name)) boxes[p.name] = { l: p.box.x, t: p.box.y, r: p.box.x + p.box.w, b: p.box.y + p.box.h };
    } else {
      for (const [k, s] of [['score', '.hud-score'], ['objective', '#objective'], ['pop', '#pop'], ['event', '#event-pop'], ['medal', '#medal-pop'], ['slip', '#slip-pop']]) { const b = visBox(s); if (b) boxes[k] = b; }
    }
    const ks = Object.keys(boxes); let any = false;
    for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
      const a = boxes[ks[i]], b = boxes[ks[j]]; const pr = [ks[i], ks[j]].sort().join('+');
      const isLabel = (k) => !['score', 'objective'].includes(k);
      {
        const g = inter(a, b);
        if (g > 0) { any = true; const o = S.ov[pr] = S.ov[pr] || { n: 0, max: 0, ex: null }; o.n++; if (g > o.max) { o.max = Math.round(g); o.ex = { f: S.frames, a: Object.values(a).map(Math.round), b: Object.values(b).map(Math.round) }; } }
        else if (gap(a, b) < 2 && (isLabel(ks[i]) || isLabel(ks[j]))) S.touchN++;
      }
    }
    if (any) S.ovFrames++;
    // medal pops vs the drone (every 2nd frame: droneBox projects vertices)
    let medalBox = null;
    if (ch && ch.on) { if (ch.event && ch.event.kind === 'medal' && boxes.event) medalBox = boxes.event; }
    else medalBox = boxes.medal || null;
    if (medalBox && S.frames % 2 === 0) {
      const d = G.droneBox && G.droneBox();
      if (d && Number.isFinite(d.x) && !d.behind) {
        const db = { l: d.x, t: d.y, r: d.x + d.w, b: d.y + d.h };
        S.medal.n++;
        const g = inter(medalBox, db);
        if (g > 0) { S.medal.hit++; if (S.medal.ex.length < 5) S.medal.ex.push({ f: S.frames, area: Math.round(g), droneArea: Math.round((db.r - db.l) * (db.b - db.t)), m: Object.values(medalBox).map(Math.round), d: Object.values(db).map(Math.round) }); }
      } else if (d) S.medal.raw = d;
    }
    // canvas centre-message scale during the fade-in
    if (ch && ch.on && ch.event) {
      const e = ch.event; const key = e.main + '|' + e.sub + '|' + e.kind;
      if (e.age < 400 && e.alloc[0] > 0) {
        const rx = e.meshScale[0] / e.alloc[0], ry = e.meshScale[1] / e.alloc[1];
        const want = e.age < 160 ? 0.9 + 0.1 * (e.age / 160) : 1;
        S.scale.n++; S.scale.minRatio = Math.min(S.scale.minRatio, rx); S.scale.maxRatio = Math.max(S.scale.maxRatio, rx);
        if (Math.abs(rx - want) > 0.02 || Math.abs(ry - rx) > 0.001 || rx < 0.89 || rx > 1.001) { S.scale.bad++; if (S.scale.ex.length < 5) S.scale.ex.push({ key, age: Math.round(e.age), rx, ry, want }); }
      }
    }
  };
  S.start = () => { S.on = true; };
  requestAnimationFrame(tick);
})();
