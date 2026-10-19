// Round 28 critic (new): payout chimes against their pop. Every frame read diagnostics.slipstream.chimes (counted where the
// chime is actually played). On each new chime: is #slip-pop shown (class show, opacity > 0.05) within 0.3 s, and is the
// pop's centre covered by another element (elementFromPoint not inside #slip-pop)?
window.__ch = { n: 0, ev: [] };
(function loop() {
  requestAnimationFrame(loop);
  const d = window.__THREE_GAME_DIAGNOSTICS__; if (!d || !d.slipstream) return;
  const C = window.__ch, now = performance.now() / 1000, el = document.getElementById('slip-pop');
  const vis = () => { if (!el || !el.classList.contains('show')) return false; const cs = getComputedStyle(el); if (+cs.opacity < 0.05 || cs.visibility === 'hidden') return false; const r = el.getBoundingClientRect(); if (r.width < 2) return false;
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return top && (el === top || el.contains(top)) ? 'clear' : 'covered:' + (top ? (top.id || top.className || top.tagName) : 'none'); };
  const c = d.slipstream.chimes ?? 0;
  if (c > C.n) { for (let i = C.n; i < c; i++) C.ev.push({ t: +now.toFixed(2), rt: +(d.elapsed ?? 0).toFixed(1), seen: null }); C.n = c; }
  for (const e of C.ev) if (e.seen === null) { const v = vis(); if (v) e.seen = v; else if (now - e.t > 0.3) e.seen = 'no'; }
})();
