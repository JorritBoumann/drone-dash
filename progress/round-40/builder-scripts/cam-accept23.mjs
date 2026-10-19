// Round 23 critic (offline): the round 22 acceptance test on cam-clip rows. Settled playing frames (skip 90 after each teleport).
// Per kind: camera >= 2.5 m from drone, drone in frame (true projection from the render camera, plus the round 22 approximation),
// camera in solid / under ground / drone hidden, frame-to-frame camera jump relative to the drone.
import fs from 'fs';
for (const file of process.argv.slice(2)) {
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  const S = {}; let m = '', kind = '', k = 0, prev = null; const worst = [];
  const get = (kd) => (S[kd] ??= { frames: 0, far25: 0, inF: 0, inFn: 0, approxIn: 0, in0: 0, in1: 0, occ: 0, under: 0, j1: 0, j2: 0, maxJ: 0, minD: 99, d: [] });
  for (const r of rows) {
    if (r.mark) { m = r.mark; kind = m.split('-')[1]; k = 0; prev = null; continue; }
    if (r.st !== 'playing' || k++ < 90) { prev = null; continue; }
    for (const s of [get(kind), get('all')]) {
      s.frames++; if (r.dist >= 2.5) s.far25++; s.minD = Math.min(s.minD, r.dist); s.d.push(r.dist);
      if (r.inF !== null && r.inF !== undefined) { s.inFn++; s.inF += r.inF; }
      s.in0 += r.in0 ? 1 : 0; s.in1 += r.in1 ? 1 : 0; s.occ += r.occ; s.under += r.under;
      // round 22 approximation (look point = drone + 4 m ahead)
      const fx = -Math.sin(r.pyaw), fz = -Math.cos(r.pyaw); const L = [r.px + fx * 4 - r.cx, r.py + 0.7 - r.cy, r.pz + fz * 4 - r.cz]; const ln = Math.hypot(...L); const dir = L.map((v) => v / ln);
      let right = [-dir[2], 0, dir[0]]; const rl = Math.hypot(...right) || 1; right = right.map((v) => v / rl);
      const up = [right[1] * dir[2] - right[2] * dir[1], right[2] * dir[0] - right[0] * dir[2], right[0] * dir[1] - right[1] * dir[0]];
      const v = [r.px - r.cx, r.py - r.cy, r.pz - r.cz]; const z = v[0] * dir[0] + v[1] * dir[1] + v[2] * dir[2], x = v[0] * right[0] + v[1] * right[1] + v[2] * right[2], y = v[0] * up[0] + v[1] * up[1] + v[2] * up[2];
      const tv = Math.tan((r.fov * Math.PI / 180) / 2); if (z > 0.2 && Math.abs(y / z) < tv * 0.95 && Math.abs(x / z) < tv * r.asp * 0.95) s.approxIn++;
      if (prev) { const j = Math.hypot((r.cx - prev.cx) - (r.px - prev.px), (r.cy - prev.cy) - (r.py - prev.py), (r.cz - prev.cz) - (r.pz - prev.pz)); if (j > 1) s.j1++; if (j > 2) s.j2++; s.maxJ = Math.max(s.maxJ, j); if (s === S.all && j > 1.5) worst.push({ m, j: +j.toFixed(2), crashes: r.crashes, dist: +r.dist.toFixed(2) }); }
    }
    prev = r;
  }
  const out = {};
  for (const [kd, s] of Object.entries(S)) { const ds = s.d.sort((a, b) => a - b); out[kd] = { frames: s.frames, far25: +(s.far25 / s.frames * 100).toFixed(1), inFrame: s.inFn ? +(s.inF / s.inFn * 100).toFixed(1) : null, inFrameApprox: +(s.approxIn / s.frames * 100).toFixed(1), in0: s.in0, in1: s.in1, occ: s.occ, under: s.under, jumps1m: s.j1, jumps2m: s.j2, maxJump: +s.maxJ.toFixed(2), minDist: +s.minD.toFixed(2), p5Dist: +ds[Math.floor(ds.length * 0.05)].toFixed(2), medDist: +ds[Math.floor(ds.length / 2)].toFixed(2) }; }
  console.log('ACCEPT', file.split('/').pop(), JSON.stringify(out));
  if (worst.length) console.log('  JUMPS>1.5', JSON.stringify(worst.slice(0, 12)));
}
