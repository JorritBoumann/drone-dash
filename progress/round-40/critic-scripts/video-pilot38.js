// Round 38 critic (new): an in-page autopilot for the gemini gameplay videos. Runs every animation frame, so the inputs
// are smooth: on desktop the keys are pulse-width modulated per frame (the drone's yaw and speed response filter them);
// on touch it drags the real virtual stick (synthetic pointer events, the knob moves) and holds the up/down buttons.
// Plan: take off, fly the street grid low (slipstream), pick up, deliver, a detour low over the harbour next to a
// moving boat, one deliberate wall crash, then the next pickup and delivery (medal pop when the score passes a tier).
// window.__AP.start({ touch, crashAfter }) ; window.__AP.log has the events with run times.
(() => {
  const ROADS = [-154, -110, -66, -22, 22, 66, 110, 154];
  const nr = (v) => ROADS.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
  const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function route(p, o) {
    const onX = Math.abs(p.x - nr(p.x)) < Math.abs(p.z - nr(p.z));
    const Xc = nr(p.x), Zc = nr(p.z), Xt = nr(o.x), Zt = nr(o.z);
    const finalOnX = Math.abs(o.x - Xt) < Math.abs(o.z - Zt);
    const last = finalOnX ? { x: Xt, z: o.z } : { x: o.x, z: Zt };
    let pts;
    if (onX) pts = finalOnX && Xc === Xt ? [{ x: Xc, z: p.z }, last] : [{ x: Xc, z: p.z }, { x: Xc, z: Zt }, { x: Xt, z: Zt }, last];
    else pts = !finalOnX && Zc === Zt ? [{ x: p.x, z: Zc }, last] : [{ x: p.x, z: Zc }, { x: Xt, z: Zc }, { x: Xt, z: Zt }, last];
    pts.push({ x: o.x, z: o.z, final: true });
    const out = []; for (const q of pts) { const l = out[out.length - 1] || p; if (Math.hypot(q.x - l.x, q.z - l.z) > 3 || q.final) out.push(q); }
    return out;
  }
  const AP = { log: [], on: false };
  window.__AP = AP;
  AP.start = (cfg) => {
    const G = window.__GAME__; const touch = !!cfg.touch;
    const t0 = performance.now(); const T = () => (performance.now() - t0) / 1000;
    const ev = (k, x) => AP.log.push({ t: +T().toFixed(2), k, ...(x || {}) });
    let legKey = '', wps = [], mode = 'leg', extra = null, prevCrashes = 0, prevDel = 0, harbourDone = false, crashDone = false, legT = 0;
    let unstick = 0; const hist = []; let lastYaw = null, lastTier = '';
    const sd = { turn: 0, thr: 0 }; let liftState = 0; const keys = new Set();
    const setKey = (k, on) => { if (on && !keys.has(k)) { keys.add(k); G.key(k, true); } if (!on && keys.has(k)) { keys.delete(k); G.key(k, false); } };
    // touch: the real stick and buttons
    const stickEl = document.getElementById('touch-stick');
    let stickDown = false; const PID = 77;
    const pe = (el, type, x, y, id) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: id === PID, clientX: x, clientY: y }));
    const btn = {}; const hold = (id, on) => { const el = document.getElementById(id); if (!el || !!btn[id] === on) return; btn[id] = on; const r = el.getBoundingClientRect(); pe(el, on ? 'pointerdown' : 'pointerup', r.left + r.width / 2, r.top + r.height / 2, 90 + id.length); };
    const stick = (tx, ty) => {
      const r = stickEl.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2, rad = r.width * 0.4;
      // invert the game's response curves (turn |x|^1.4, thrust |y|^1.2)
      let x = Math.sign(tx) * Math.pow(Math.abs(tx), 1 / 1.4), y = -Math.sign(ty) * Math.pow(Math.abs(ty), 1 / 1.2);
      const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
      if (!stickDown) { stickDown = true; pe(stickEl, 'pointerdown', cx + x * rad, cy + y * rad, PID); } else pe(stickEl, 'pointermove', cx + x * rad, cy + y * rad, PID);
    };
    const out = (turn, thrust, lift, boost) => {
      if (touch) {
        stick(turn, thrust);
        hold('up-button', lift > 0); hold('down-button', lift < 0); hold('boost-button', boost);
      } else {
        sd.turn += turn; const ot = sd.turn >= 0.5 ? 1 : sd.turn <= -0.5 ? -1 : 0; sd.turn -= ot;
        sd.thr += thrust; const oh = sd.thr >= 0.5 ? 1 : sd.thr <= -0.5 ? -1 : 0; sd.thr -= oh;
        setKey('KeyD', ot > 0); setKey('KeyA', ot < 0); setKey('KeyW', oh > 0); setKey('KeyS', oh < 0);
        setKey('Space', lift > 0); setKey('ShiftLeft', lift < 0); setKey('KeyE', boost);
      }
    };
    AP.stop = () => { AP.on = false; out(0, 0, 0, false); if (touch && stickDown) { const r = stickEl.getBoundingClientRect(); pe(stickEl, 'pointerup', r.left + r.width / 2, r.top + r.height / 2, PID); stickDown = false; } for (const k of [...keys]) setKey(k, false); };
    AP.on = true; ev('start');
    const tick = () => {
      if (!AP.on) return;
      const d = window.__THREE_GAME_DIAGNOSTICS__;
      if (!d || d.state !== 'playing') { if (d && d.state === 'over') { ev('over', { score: d.score }); AP.stop(); return; } requestAnimationFrame(tick); return; }
      const t = T(); const p = d.player.position, o = d.objective.position, yaw = d.player.yaw, spd = d.player.speed;
      // events
      if (d.deliveries > prevDel) { prevDel = d.deliveries; ev('deliver', { n: d.deliveries, score: d.score }); }
      if (d.crashes > prevCrashes) { prevCrashes = d.crashes; ev('crash', { n: d.crashes, x: +p.x.toFixed(0), z: +p.z.toFixed(0) }); if (mode === 'crash') { mode = 'backoff'; extra = { until: t + 0.9 }; } }
      const tier = d.goals && d.goals.tierName || ''; if (tier !== lastTier) { lastTier = tier; if (tier) ev('medal', { tier, score: d.score }); }
      const k = d.objective.phase + d.objective.name;
      if (k !== legKey) {
        if (legKey) ev(d.objective.phase === 'deliver' ? 'pickup' : 'leg', { score: d.score });
        legKey = k; legT = t; hist.length = 0;
        if (d.deliveries === 1 && !harbourDone && cfg.harbour !== false) {
          // harbour detour: out over the south sea wall next to a moving boat, then back to the street grid
          mode = 'harbour';
          const boats = G.boats().filter((b) => b.moving && b.kind !== 'ferry' && Math.abs(b.z) > 170).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
          const b = boats[0]; const sz = Math.sign(b ? b.z : -1) || -1;
          const ex = nr(p.x);
          wps = [{ x: ex, z: sz * 154, y: 7 }, { x: ex + (b ? Math.sign(b.x - ex) * 6 : 10), z: sz * 168, y: 6 }];
          extra = { boat: b ? b : null, sz }; ev('harbour', { boat: b ? [b.kind, Math.round(b.x), Math.round(b.z)] : null });
        } else { mode = 'leg'; wps = route(p, o); if (!AP.firstDone) { AP.firstDone = true; const hd0 = Math.hypot(o.x - p.x, o.z - p.z); if (hd0 < 75) { wps = [{ x: o.x, z: o.z, final: true }]; AP.direct = true; } } }
      }
      // harbour: after the wall, track a point beside the boat for a few seconds, then head back in
      if (mode === 'harbour' && (wps.length === 0 || (extra && extra.trackUntil))) {
        if (!extra.trackUntil) { extra.trackUntil = t + 7; ev('harbour-low'); }
        if (t < extra.trackUntil) {
          const b = extra.boat ? G.boats().find((q) => q.kind === extra.boat.kind && q.moving && Math.hypot(q.x - extra.boat.x, q.z - extra.boat.z) < 60) : null;
          if (b) extra.boat = b;
          const tx = b ? b.x + Math.cos(b.yaw) * 13 : p.x + 20, tz = b ? b.z - Math.sin(b.yaw) * 13 : extra.sz * 195;
          wps = [{ x: tx, z: clamp(tz, -230, 230), y: Math.abs(p.z) > 182 ? 3.2 : 7, soft: true }];
        } else { harbourDone = true; mode = 'leg'; wps = [{ x: nr(p.x), z: extra.sz * 154, y: 7 }, ...route({ x: nr(p.x), z: extra.sz * 154 }, o)]; ev('harbour-back'); }
      }
      // one deliberate wall crash on the second pickup leg, on a straight, a few seconds in
      if (mode === 'leg' && !crashDone && cfg.crash !== false && harbourDone && d.objective.phase === 'pickup' && t - legT > 3 && spd > 9 && wps.length > 1) {
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
        for (const s of [1, -1]) {
          let hit = null; for (let r = 6; r < 22; r += 1) { const x = p.x + fz * s * r + fx * 14, z = p.z - fx * s * r + fz * 14; if (G.insideSolid(x, 5, z)) { hit = { x, z }; break; } }
          if (hit) { mode = 'crash'; crashDone = true; extra = { aim: hit, until: t + 4 }; ev('crash-aim', { x: Math.round(hit.x), z: Math.round(hit.z) }); break; }
        }
      }
      let w, wantY, tgt, boost = false;
      const hd = Math.hypot(o.x - p.x, o.z - p.z);
      if (mode === 'crash') {
        w = { x: extra.aim.x, z: extra.aim.z }; wantY = 5; tgt = 15; if (t > extra.until) { mode = 'leg'; wps = route(p, o); }
      } else if (mode === 'backoff') {
        if (t > extra.until) { mode = 'leg'; wps = route(p, o); ev('recover'); }
      }
      if (mode === 'leg' || mode === 'harbour') {
        // advance waypoints early so corners are flown as arcs
        while (wps.length > 1) { const q = wps[0]; const qd = Math.hypot(q.x - p.x, q.z - p.z); if (qd < Math.max(5, spd * 0.75) || (mode === 'leg' && hd < 14 && !q.final)) wps.shift(); else break; }
        if (mode === 'harbour' && wps.length === 1 && !wps[0].soft && Math.hypot(wps[0].x - p.x, wps[0].z - p.z) < 5) wps.shift();
        w = wps[0] || { x: o.x, z: o.z, final: true };
        const wd = Math.hypot(w.x - p.x, w.z - p.z);
        if (mode === 'harbour') { wantY = w.y || 4; tgt = w.soft ? clamp(wd * 0.6, 4, 12) : 11; }
        else {
          const raised = o.y > 2;
          wantY = hd < 30 ? (raised ? o.y + 1.5 : o.y + 1.2) : (raised && hd < 45 ? o.y + 2 : (cfg.lowY || 6));
          if (AP.direct && d.objective.phase === 'pickup' && d.deliveries === 0) wantY = hd > 18 ? 22 : o.y + 1.2;
          const corner = !w.final && wd < 16 && wps.length > 1;
          tgt = hd < 8 ? 3.5 : corner ? 9 : w.final && hd < 25 ? 8 : 16;
          if (raised && hd < 30 && p.y < o.y - 0.5) tgt = 1;
          boost = !corner && !w.final && wd > 50 && d.player.boost > 0.3;
        }
      }
      if (mode === 'backoff') { out(0, -1, 0.6, false); requestAnimationFrame(tick); return; }
      // stuck guard
      hist.push([t, p.x, p.z]); while (hist.length && hist[0][0] < t - 3) hist.shift();
      if (unstick <= 0 && hist.length > 60 && t - hist[0][0] > 2.7 && Math.hypot(hist[0][1] - p.x, hist[0][2] - p.z) < 1.5 && hd > 3) { unstick = 1.0; hist.length = 0; ev('unstick'); }
      if (unstick > 0) { unstick -= 1 / 60; out(0, -1, 1, false); requestAnimationFrame(tick); return; }
      const yawT = Math.atan2(-(w.x - p.x), -(w.z - p.z)); const err = wrap(yawT - yaw);
      const turn = clamp(-err * 1.5, -1, 1);
      if (Math.abs(err) > 0.5 && mode !== 'crash') tgt = Math.min(tgt, 7); if (Math.abs(err) > 0.25) boost = false;
      const thrust = clamp((tgt - spd) * 0.35, -1, 1) * (Math.abs(err) > 1.3 ? 0.2 : 1);
      // lift with a small dead band (and hysteresis on touch, where the buttons are on/off)
      const dy = wantY - p.y; let lift;
      if (touch) { if (liftState === 0) liftState = dy > 0.9 ? 1 : dy < -0.9 ? -1 : 0; else if ((liftState > 0 && dy < 0.25) || (liftState < 0 && dy > -0.25)) liftState = 0; lift = liftState; }
      else lift = clamp(dy * 0.8, -1, 1);
      if (!touch) { // pulse the lift keys too
        sd.lift = (sd.lift || 0) + lift; const ol = sd.lift >= 0.5 ? 1 : sd.lift <= -0.5 ? -1 : 0; sd.lift -= ol; lift = ol;
      }
      out(turn, thrust, lift, boost);
      lastYaw = yaw;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
})();
