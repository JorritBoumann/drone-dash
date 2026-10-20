// Round 43 critic (new, from sampler42.js): in-page per-frame sampler, started with window.__S43.start().
// Every animation frame in play and on the game-over screen:
// (1) corner: the nav marker, gate tag, pops, the HTML game-over card and every canvas panel vs the corner box
//     (64 px plus the safe-area inset, read from env()); every 3rd frame a full scan of every painted element.
//     Fix of the round 42 gap: only boxes covering at least 98% of the viewport both ways are skipped (speed lines,
//     hit flash), and the .over-card is always checked, every frame.
// (2) markers: each nav marker part and gate tag part must be fully on screen (0.5 px tolerance) and (touch, in play)
//     must not touch the stick (with its "Fly" label, 20 px above) or the touch buttons. Both the button cluster box
//     (what the game avoids) and each single button are counted.
// (3) event labels: HTML pops (#pop, #event-pop, #medal-pop, #slip-pop) and the canvas event panel fully on screen.
// (4) overlaps between event labels, the objective pill and the score panel (as round 42).
// (5) the canvas centre-message scale during its fade-in (now times its fit factor).
// (6) on game over, how often the canvas card is re-uploaded (should be once, not per frame).
(() => {
  const S = { frames: 0, scans: 0, corner: [], cornerFrames: 0, byName: {}, ov: {}, ovFrames: 0, touchN: 0,
    mk: { n: 0, off: 0, offEx: [], ctl: 0, ctlEx: [], btn: 0, btnEx: [], byPart: {} },
    lab: { n: 0, off: 0, offEx: [] }, scale: { n: 0, bad: 0, ex: [], minRatio: 9, maxRatio: 0 },
    over: 0, overCorner: 0, overCanvas: 0, overCard: { n: 0, minL: 1e9, minT: 1e9, rest: null }, overUploads: [], states: {} };
  window.__S43 = S;
  let cb = null;
  const corner = () => {
    if (!cb) { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:0;top:0;width:calc(64px + env(safe-area-inset-left,0px));height:calc(64px + env(safe-area-inset-top,0px));visibility:hidden;pointer-events:none'; document.body.appendChild(d); const r = d.getBoundingClientRect(); cb = { r: r.width, b: r.height }; S.cornerBox = cb; }
    return cb;
  };
  const opac = (e) => { let p = e, op = 1; while (p && p !== document.documentElement) { const s = getComputedStyle(p); if (s.display === 'none' || s.visibility === 'hidden' || p.hidden) return 0; op *= Number(s.opacity); p = p.parentElement; } return op; };
  const paints = (e, cs) => cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none' || parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0 || cs.boxShadow !== 'none' || [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || ['svg', 'IMG', 'CANVAS', 'BUTTON', 'INPUT'].includes(e.tagName);
  const inC = (r, c) => r.width >= 1 && r.height >= 1 && r.left < c.r && r.top < c.b && r.right > 0 && r.bottom > 0;
  const nm = (e) => e.id || (typeof e.className === 'string' ? e.className : e.className?.baseVal) || e.tagName;
  const inter = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
  const gap = (a, b) => Math.max(a.l - b.r, b.l - a.r, a.t - b.b, b.t - a.b);
  const R = (r) => ({ l: r.left, t: r.top, r: r.right, b: r.bottom });
  const offV = (b) => b.l < -0.5 || b.t < -0.5 || b.r > innerWidth + 0.5 || b.b > innerHeight + 0.5;
  const visBox = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); if (r.width < 1 || opac(e) < 0.05) return null; return R(r); };
  const MK = ['.nav-diamond', '.nav-arrow', '.nav-distance', '.gate-tag-pill', '.gate-tag-arrow'];
  const POPS = ['#pop', '#event-pop', '#medal-pop', '#slip-pop'];
  let lastUploads = -1;
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
        if (e.id === 'game-canvas' || e.id === 'app' || e.classList.contains('screen') || e.tagName === 'SCRIPT' || e.tagName === 'STYLE') continue;
        const r = e.getBoundingClientRect(); if (!inC(r, c)) continue;
        if (r.width >= innerWidth * 0.98 && r.height >= innerHeight * 0.98 && !e.closest('.over-card')) continue; // full-screen effects only
        const cs = getComputedStyle(e); if (!paints(e, cs)) continue; if (opac(e) < 0.05) continue;
        hits.push({ k: 'html', n: nm(e), b: [r.left, r.top, r.right, r.bottom].map(Math.round) });
      }
    } else {
      for (const sel of [...MK, ...POPS, '.over-card']) {
        const e = document.querySelector(sel); if (!e) continue; const r = e.getBoundingClientRect(); if (!inC(r, c)) continue; if (opac(e) < 0.05) continue;
        hits.push({ k: 'html', n: sel, b: [r.left, r.top, r.right, r.bottom].map(Math.round) });
      }
    }
    const ch = G.canvasHud();
    const panels = ch && ch.on ? ch.panels.filter((p) => p.visible && p.box && p.opacity > 0.05) : [];
    for (const p of panels) { const b = p.box; if (b.x < c.r && b.y < c.b && b.x + b.w > 0 && b.y + b.h > 0) hits.push({ k: 'canvas', n: p.name, b: [b.x, b.y, b.x + b.w, b.y + b.h].map(Math.round) }); }
    if (st === 'over') {
      S.over++;
      if (panels.some((p) => p.name === 'over')) S.overCanvas++;
      if (hits.length) S.overCorner++;
      const oc = document.querySelector('.over-card'); if (oc && opac(oc) > 0.05) { const r = oc.getBoundingClientRect(); S.overCard.n++; S.overCard.minL = Math.min(S.overCard.minL, r.left); S.overCard.minT = Math.min(S.overCard.minT, r.top); S.overCard.rest = [r.left, r.top, r.right, r.bottom].map(Math.round); }
      if (ch && ch.on) { if (ch.uploads !== lastUploads) { S.overUploads.push({ f: S.frames, u: ch.uploads }); lastUploads = ch.uploads; } }
    }
    if (hits.length) { S.cornerFrames++; for (const h of hits) { const k = h.k + ':' + h.n; S.byName[k] = (S.byName[k] || 0) + 1; } if (S.corner.length < 30) S.corner.push({ f: S.frames, st, full, hits }); }
    if (st !== 'playing') return;
    // (2) markers on screen and off the touch controls
    const stick = document.getElementById('touch-stick'), btns = document.querySelector('.touch-buttons');
    const ctl = [];
    if (stick && opac(stick) > 0.05) { const r = stick.getBoundingClientRect(); if (r.width > 0) ctl.push({ l: r.left, t: r.top - 20, r: r.right, b: r.bottom, n: 'stick' }); }
    if (btns && opac(btns) > 0.05) { const r = btns.getBoundingClientRect(); if (r.width > 0) ctl.push({ ...R(r), n: 'buttons' }); }
    const singles = btns && opac(btns) > 0.05 ? [...btns.querySelectorAll('button')].filter((b) => opac(b) > 0.05).map((b) => ({ ...R(b.getBoundingClientRect()), n: b.id || b.className })) : [];
    let mkAny = false, mkOff = false, mkCtl = false, mkBtn = false;
    for (const sel of MK) {
      const e = document.querySelector(sel); if (!e) continue; if (opac(e) < 0.05) continue;
      const r = e.getBoundingClientRect(); if (r.width < 1) continue; const b = R(r); mkAny = true;
      const bp = S.mk.byPart[sel] = S.mk.byPart[sel] || { n: 0, off: 0, ctl: 0 }; bp.n++;
      if (offV(b)) { mkOff = true; bp.off++; if (S.mk.offEx.length < 8) S.mk.offEx.push({ f: S.frames, sel, b: Object.values(b).map(Math.round) }); }
      for (const q of ctl) if (inter(b, q) > 0) { mkCtl = true; bp.ctl++; if (S.mk.ctlEx.length < 8) S.mk.ctlEx.push({ f: S.frames, sel, q: q.n, area: Math.round(inter(b, q)), b: Object.values(b).map(Math.round), qb: [q.l, q.t, q.r, q.b].map(Math.round) }); }
      for (const q of singles) if (inter(b, q) > 0) { mkBtn = true; if (S.mk.btnEx.length < 8) S.mk.btnEx.push({ f: S.frames, sel, q: q.n, area: Math.round(inter(b, q)) }); }
    }
    if (mkAny) S.mk.n++; if (mkOff) S.mk.off++; if (mkCtl) S.mk.ctl++; if (mkBtn) S.mk.btn++;
    // (3) event labels on screen
    const labs = [];
    if (ch && ch.on) { for (const p of panels) if (p.name === 'event') labs.push(['canvas:event', { l: p.box.x, t: p.box.y, r: p.box.x + p.box.w, b: p.box.y + p.box.h }]); }
    else for (const sel of POPS) { const b = visBox(sel); if (b) labs.push([sel, b]); }
    if (labs.length) { S.lab.n++; const off = labs.filter(([, b]) => offV(b)); if (off.length) { S.lab.off++; if (S.lab.offEx.length < 8) S.lab.offEx.push({ f: S.frames, ex: off.map(([k, b]) => [k, ...Object.values(b).map(Math.round)]) }); } }
    // (4) overlaps: event labels vs objective vs score
    const boxes = {};
    if (ch && ch.on) {
      for (const p of panels) if (['event', 'objective', 'score'].includes(p.name)) boxes[p.name] = { l: p.box.x, t: p.box.y, r: p.box.x + p.box.w, b: p.box.y + p.box.h };
    } else {
      for (const [k, s] of [['score', '.hud-score'], ['objective', '#objective'], ['pop', '#pop'], ['event', '#event-pop'], ['medal', '#medal-pop'], ['slip', '#slip-pop']]) { const b = visBox(s); if (b) boxes[k] = b; }
    }
    const ks = Object.keys(boxes); let any = false;
    const isLabel = (k) => !['score', 'objective'].includes(k);
    for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
      const a = boxes[ks[i]], b = boxes[ks[j]]; const pr = [ks[i], ks[j]].sort().join('+');
      const g = inter(a, b);
      if (g > 0) { any = true; const o = S.ov[pr] = S.ov[pr] || { n: 0, max: 0, ex: null }; o.n++; if (g > o.max) { o.max = Math.round(g); o.ex = { f: S.frames, a: Object.values(a).map(Math.round), b: Object.values(b).map(Math.round) }; } }
      else if (gap(a, b) < 2 && (isLabel(ks[i]) || isLabel(ks[j]))) S.touchN++;
    }
    if (any) S.ovFrames++;
    // (5) canvas centre-message scale during the fade-in (times the fit factor)
    if (ch && ch.on && ch.event) {
      const e = ch.event; const fit = e.fit ?? 1;
      if (e.age < 400 && e.alloc[0] > 0) {
        const rx = e.meshScale[0] / e.alloc[0] / fit, ry = e.meshScale[1] / e.alloc[1] / fit;
        const want = e.age < 160 ? 0.9 + 0.1 * (e.age / 160) : 1;
        S.scale.n++; S.scale.minRatio = Math.min(S.scale.minRatio, rx); S.scale.maxRatio = Math.max(S.scale.maxRatio, rx);
        if (fit < 1) S.scale.fitN = (S.scale.fitN || 0) + 1;
        if (Math.abs(rx - want) > 0.02 || Math.abs(ry - rx) > 0.001 || rx < 0.89 || rx > 1.001) { S.scale.bad++; if (S.scale.ex.length < 5) S.scale.ex.push({ age: Math.round(e.age), rx, ry, want, fit }); }
      }
    }
  };
  S.start = () => { S.on = true; };
  requestAnimationFrame(tick);
})();
