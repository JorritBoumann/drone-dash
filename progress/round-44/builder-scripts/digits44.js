// Round 44 builder: on the game-over screen, the music toggle vs the card, and every score digit (breakdown values and
// the big score): not under the toggle (box overlap and elementFromPoint) and inside the card's visible area.
window.__digits44 = () => {
  const card = document.querySelector('.over-card'); const cr = card.getBoundingClientRect();
  const vis = { l: cr.left + card.clientLeft, t: cr.top + card.clientTop, r: cr.left + card.clientLeft + card.clientWidth, b: cr.top + card.clientTop + card.clientHeight };
  const mt = document.getElementById('music-toggle'); const ms = getComputedStyle(mt); const mr = mt.getBoundingClientRect();
  const mOn = ms.display !== 'none' && ms.visibility !== 'hidden' && mr.width > 0;
  const ovA = mOn ? Math.max(0, Math.min(cr.right, mr.right) - Math.max(cr.left, mr.left)) * Math.max(0, Math.min(cr.bottom, mr.bottom) - Math.max(cr.top, mr.top)) : 0;
  const els = [...document.querySelectorAll('#over-breakdown dd'), document.getElementById('over-score')];
  let n = 0, covered = 0, underToggle = 0, outside = 0; const ex = [];
  for (const e of els) {
    const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); let tn;
    while ((tn = w.nextNode())) for (let i = 0; i < tn.length; i++) {
      if (!/[0-9]/.test(tn.data[i])) continue;
      const rg = document.createRange(); rg.setStart(tn, i); rg.setEnd(tn, i + 1); const b = rg.getBoundingClientRect();
      n++;
      const cx = (b.left + b.right) / 2, cy = (b.top + b.bottom) / 2;
      const hitT = mOn && b.left < mr.right && mr.left < b.right && b.top < mr.bottom && mr.top < b.bottom;
      const top = document.elementFromPoint(cx, cy);
      const cov = !top || !(top === e || e.contains(top));
      const out = b.left < vis.l - 0.5 || b.right > vis.r + 0.5 || b.top < vis.t - 0.5 || b.bottom > vis.b + 0.5 || b.right > innerWidth || b.left < 0;
      if (hitT) underToggle++; if (cov) covered++; if (out) outside++;
      if ((hitT || cov || out) && ex.length < 4) ex.push({ ch: tn.data[i], text: e.textContent, b: [b.left, b.top, b.right, b.bottom].map(Math.round), top: top ? (top.id || top.className) : null });
    }
  }
  return { vp: [innerWidth, innerHeight], card: [cr.left, cr.top, cr.right, cr.bottom].map(Math.round), music: mOn ? [mr.left, mr.top, mr.right, mr.bottom].map(Math.round) : null, musicText: mt.textContent.trim(), overlapPx: Math.round(ovA), digits: n, underToggle, covered, outside, scrollsV: card.scrollHeight > card.clientHeight + 1, ex };
};
