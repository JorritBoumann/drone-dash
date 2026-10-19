// Round 36 copy: also writes each leak's pixel indices to <D>/<view>.leak.json for crops.
// Round 35 critic: labels the masks from seams35.py (see there). Prints per view: leak pixels, components, largest.
import fs from 'node:fs';
const D = process.argv[2]; const names = [...new Set(fs.readdirSync(D).map((f) => f.replace(/\.(M|M0)$/, '')))].sort();
const load = (p) => { const b = fs.readFileSync(p); const w = b.readInt32LE(0), h = b.readInt32LE(4); return { w, h, m: b.subarray(8) }; };
const label = ({ w, h, m }) => {
  const lab = new Int32Array(w * h), size = [0], border = [false]; let n = 0; const st = new Int32Array(w * h);
  for (let p0 = 0; p0 < w * h; p0++) { if (!m[p0] || lab[p0]) continue; n++; let sp = 0, cnt = 0, bd = false; st[sp++] = p0; lab[p0] = n;
    while (sp) { const p = st[--sp]; cnt++; const x = p % w, y = (p - x) / w; if (!x || !y || x === w - 1 || y === h - 1) bd = true;
      if (x > 0 && m[p - 1] && !lab[p - 1]) { lab[p - 1] = n; st[sp++] = p - 1; } if (x < w - 1 && m[p + 1] && !lab[p + 1]) { lab[p + 1] = n; st[sp++] = p + 1; }
      if (y > 0 && m[p - w] && !lab[p - w]) { lab[p - w] = n; st[sp++] = p - w; } if (y < h - 1 && m[p + w] && !lab[p + w]) { lab[p + w] = n; st[sp++] = p + w; } }
    size.push(cnt); border.push(bd); }
  return { lab, size, border };
};
const tot = {}; for (const nm of names) {
  if (!fs.existsSync(D + nm + '.M0')) continue;
  const A = load(D + nm + '.M'), B = load(D + nm + '.M0'); const la = label(A), lb = label(B);
  let leak = 0, comps = 0, big = 0; const seen = new Set(); const lp = [];
  for (let p = 0; p < A.w * A.h; p++) { const c = la.lab[p]; if (!c || la.border[c] || seen.has(c)) continue; seen.add(c); if (la.size[c] < 3) continue; const cb = lb.lab[p]; if (cb && lb.size[cb] >= 3 * la.size[c]) { leak += la.size[c]; comps++; big = Math.max(big, la.size[c]); for (let q = 0; q < A.w * A.h; q++) if (la.lab[q] === c) lp.push(q); } }
  const key = nm.replace(/^hw35-/, '').split('-').slice(0, 1).join('');
  console.log(JSON.stringify({ view: nm, leak, comps, big })); if (lp.length) fs.writeFileSync(D + nm + '.leak.json', JSON.stringify({ w: A.w, h: A.h, px: lp }));
  (tot[key] ||= { views: 0, leakViews: 0, leakPx: 0 }); tot[key].views++; if (leak) { tot[key].leakViews++; tot[key].leakPx += leak; }
}
console.log('TOTAL', JSON.stringify(tot));
