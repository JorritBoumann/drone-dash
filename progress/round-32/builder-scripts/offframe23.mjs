// Round 23 critic (offline): off-frame runs in cam-clip rows, with where the drone sat on screen and the camera elevation.
import fs from 'fs';
for (const f of process.argv.slice(2)) {
  const rows = JSON.parse(fs.readFileSync(f, 'utf8')); let m = '', k = 0, run = []; const runs = []; let bottom = 0, other = 0, n = 0, steep = 0;
  for (const r of rows) { if (r.mark) { m = r.mark; k = 0; continue; } if (r.st !== 'playing' || k++ < 90) continue; n++;
    if (r.inF === 0) { run.push(r); if (r.ny < -0.9) bottom++; else other++; if (r.be > 0.9) steep++; } else if (run.length) { runs.push([m, run]); run = []; } }
  if (run.length) runs.push([m, run]);
  console.log('OFF', f, JSON.stringify({ frames: n, off: bottom + other, offBottom: bottom, offOther: other, offWithElevOver0_9rad: steep, runs: runs.length, longest: Math.max(0, ...runs.map((r) => r[1].length)) }));
  for (const [mm, rr] of runs.filter((r) => r[1].length > 20)) { const a = rr[0]; console.log('  ', mm, rr.length, 'frames, ny', a.ny.toFixed(2), 'nx', a.nx.toFixed(2), 'elev', a.be.toFixed(2), 'dist', a.dist.toFixed(1), 'corW', (a.corW || 0).toFixed(2)); }
}
