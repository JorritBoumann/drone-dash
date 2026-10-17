// Round 31: hidden spells (consecutive occ frames, seconds) and >1 m relative jumps per pass from a cam-clip rows file.
const rows = JSON.parse(require('fs').readFileSync(process.argv[2]));
let m = '', kk = 0, run = null, spells = [], jumps = [], prev = null;
for (const r of rows) {
  if (r.mark) { m = r.mark; kk = 0; prev = null; if (run) { spells.push(run); run = null; } continue; }
  if (!m || r.st !== 'playing' || kk++ < 90) continue;
  if (r.occ) { if (!run) run = { m, t0: r.t, t1: r.t, n: 0 }; run.t1 = r.t; run.n++; } else if (run) { run.t1 = r.t; spells.push(run); run = null; }
  if (prev) { const j = Math.hypot((r.cx - prev.cx) - (r.px - prev.px), (r.cy - prev.cy) - (r.py - prev.py), (r.cz - prev.cz) - (r.pz - prev.pz)); if (j > 1) jumps.push({ m, t: r.t, j: +j.toFixed(2) }); }
  prev = r;
}
if (run) spells.push(run);
console.log(JSON.stringify({ spells: spells.map((s) => ({ m: s.m, frames: s.n, secs: +(s.t1 - s.t0).toFixed(3) })), maxSpell: Math.max(0, ...spells.map((s) => +(s.t1 - s.t0).toFixed(3))), hiddenFrames: spells.reduce((a, s) => a + s.n, 0), jumps }));
