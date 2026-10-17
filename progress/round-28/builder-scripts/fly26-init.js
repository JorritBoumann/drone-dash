// Round 26 builder: phone leftover sampler (init script, log-only). Every 100 ms while playing: the drone's screen box
// height as a share of the screen height, flagged when within 3 s after a pickup or a drop; and every visible centre pop
// against the stick's "Fly" label (20 px above the stick).
window.__fly = { n: 0, near: 0, nearOver40: 0, maxNear: 0, popVis: 0, popOnFly: 0, ex: [], lastPh: null, lastDel: 0, evAt: -99, t0: null };
setInterval(() => {
  const d = window.__THREE_GAME_DIAGNOSTICS__; const G = window.__GAME__; if (!d || d.state !== 'playing' || !G || !G.droneBox) return;
  const F = window.__fly; const now = performance.now() / 1000; if (F.t0 === null) F.t0 = now; const t = now - F.t0;
  const ph = d.player && d.player.carrying; const del = d.deliveries ?? 0;
  if ((F.lastPh !== null && ph !== F.lastPh) || del !== F.lastDel) F.evAt = t;
  F.lastPh = ph; F.lastDel = del; F.n++;
  const b = G.droneBox(); const H = innerHeight;
  if (t - F.evAt <= 3 && !b.behind) { F.near++; const f = b.h / H; F.maxNear = Math.max(F.maxNear, f); if (f >= 0.4) { F.nearOver40++; if (F.ex.length < 10) F.ex.push({ t: +t.toFixed(1), f: +f.toFixed(2) }); } }
  const st = document.querySelector('#touch-stick'); if (!st) return; const sr = st.getBoundingClientRect(); if (sr.width < 2) return;
  const fly = { left: sr.left, right: sr.right, top: sr.top - 20, bottom: sr.top };
  const vis = (e) => { if (!e) return false; let p = e; while (p && p !== document.body) { const c = getComputedStyle(p); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.15) return false; p = p.parentElement; } return true; };
  for (const s of ['#pop', '#slip-pop', '#medal-pop', '#event-pop']) { const e = document.querySelector(s); if (!vis(e)) continue; F.popVis++;
    for (const c of e.children) { if (!vis(c)) continue; const r = c.getBoundingClientRect(); if (r.width < 2) continue; if (r.left < fly.right && r.right > fly.left && r.top < fly.bottom && r.bottom > fly.top) { F.popOnFly++; if (F.ex.length < 20) F.ex.push({ t: +t.toFixed(1), s, txt: e.textContent.trim().slice(0, 40) }); break; } } }
}, 100);
