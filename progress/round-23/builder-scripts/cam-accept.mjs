// Round 23 builder (offline): acceptance numbers from cam-clip rows. Same settled-frame rule as frame-check.mjs (skip 90
// frames after each teleport, playing frames only) and the same in-frame test. Per kind (tunnel / alley): share of frames
// with the camera at least 2.5 m from the drone, share with the drone in frame, largest frame-to-frame camera jump relative
// to the drone, camera inside a solid / under ground / drone hidden.
import fs from 'fs';
const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let m = '', k = 0, prev = null; const K = {};
for (const r of rows) {
  if (r.mark) { m = r.mark; k = 0; prev = null; continue; }
  if (r.st !== 'playing' || k++ < 90 || r.pyaw === undefined) { prev = null; continue; }
  const kind = m.split('-')[1]; const s = (K[kind] ??= { frames: 0, far25: 0, inFrame: 0, maxJump: 0, jumps2: 0, in0: 0, under: 0, occ: 0, close15: 0 });
  s.frames++; if (r.dist >= 2.5) s.far25++; if (r.dist < 1.5) s.close15++; s.in0 += r.in0 ? 1 : 0; s.under += r.under; s.occ += r.occ;
  const fx = -Math.sin(r.pyaw), fz = -Math.cos(r.pyaw);
  const L = [r.px + fx * 4 - r.cx, r.py + 0.7 - r.cy, r.pz + fz * 4 - r.cz]; const ln = Math.hypot(...L); const dir = L.map((v) => v / ln);
  let right = [-dir[2], 0, dir[0]]; const rl = Math.hypot(...right) || 1; right = right.map((v) => v / rl);
  const up = [right[1] * dir[2] - right[2] * dir[1], right[2] * dir[0] - right[0] * dir[2], right[0] * dir[1] - right[1] * dir[0]];
  const v = [r.px - r.cx, r.py - r.cy, r.pz - r.cz];
  const z = v[0] * dir[0] + v[1] * dir[1] + v[2] * dir[2], x = v[0] * right[0] + v[1] * right[1] + v[2] * right[2], y = v[0] * up[0] + v[1] * up[1] + v[2] * up[2];
  const tv = Math.tan((r.fov * Math.PI / 180) / 2);
  if (z > 0.2 && Math.abs(y / z) < tv * 0.95 && Math.abs(x / z) < tv * r.asp * 0.95) s.inFrame++;
  if (prev) { const j = Math.hypot((r.cx - prev.cx) - (r.px - prev.px), (r.cy - prev.cy) - (r.py - prev.py), (r.cz - prev.cz) - (r.pz - prev.pz)); s.maxJump = Math.max(s.maxJump, j); if (j > 2) s.jumps2++; }
  prev = r;
}
for (const [kind, s] of Object.entries(K)) console.log('ACCEPT', process.argv[2].split('/').pop(), kind, JSON.stringify({ frames: s.frames, camAtLeast2p5m: +(100 * s.far25 / s.frames).toFixed(1), within1p5m: s.close15, droneInFrame: +(100 * s.inFrame / s.frames).toFixed(1), maxJump: +s.maxJump.toFixed(2), jumpsOver2m: s.jumps2, insideSolid: s.in0, underGround: s.under, droneHidden: s.occ }));
