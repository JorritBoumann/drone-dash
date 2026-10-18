// Round 22 critic (offline): from cam-clip rows, is the drone inside the camera frame? Camera aim approximated as the rig's
// look point (drone + 4 m along its heading, +0.7 m). Settled playing frames only (skip 90 after each teleport).
import fs from 'fs';
const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let m = '', k = 0; const out = { frames: 0, offFrame: 0, offFrameFar: 0, close15: 0, pops1: 0, in0: 0, occ: 0 }; let prev = null;
for (const r of rows) {
  if (r.mark) { m = r.mark; k = 0; prev = null; continue; }
  if (r.st !== 'playing' || k++ < 90 || r.pyaw === undefined) { prev = null; continue; }
  out.frames++;
  const fx = -Math.sin(r.pyaw), fz = -Math.cos(r.pyaw);
  const L = [r.px + fx * 4 - r.cx, r.py + 0.7 - r.cy, r.pz + fz * 4 - r.cz]; const ln = Math.hypot(...L); const dir = L.map((v) => v / ln);
  let right = [dir[2] * 1 - 0, 0, -dir[0]]; // dir x up(0,1,0) = (dir.z*... ) -> (-dz? ) use cross(dir, up)
  right = [-dir[2], 0, dir[0]]; const rl = Math.hypot(...right) || 1; right = right.map((v) => v / rl);
  const up = [right[1] * dir[2] - right[2] * dir[1], right[2] * dir[0] - right[0] * dir[2], right[0] * dir[1] - right[1] * dir[0]];
  const v = [r.px - r.cx, r.py - r.cy, r.pz - r.cz];
  const z = v[0] * dir[0] + v[1] * dir[1] + v[2] * dir[2], x = v[0] * right[0] + v[1] * right[1] + v[2] * right[2], y = v[0] * up[0] + v[1] * up[1] + v[2] * up[2];
  const tv = Math.tan((r.fov * Math.PI / 180) / 2);
  const inF = z > 0.2 && Math.abs(y / z) < tv * 0.95 && Math.abs(x / z) < tv * r.asp * 0.95;
  if (!inF) out.offFrame++;
  if (r.dist < 1.5) out.close15++;
  if (r.in0) out.in0++; if (r.occ) out.occ++;
  if (prev) { const j = Math.hypot((r.cx - prev.cx) - (r.px - prev.px), (r.cy - prev.cy) - (r.py - prev.py), (r.cz - prev.cz) - (r.pz - prev.pz)); if (j > 1) out.pops1++; }
  prev = r;
}
console.log('FRAME', process.argv[2].split('/').pop(), JSON.stringify(out));
