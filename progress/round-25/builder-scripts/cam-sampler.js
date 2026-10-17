// Round 22 critic: per-frame camera sampler (init script). window.__cs.on = true starts logging.
// Round 23 critic addition: grab the real render camera (patch Object3D.lookAt from the same Vite three module) and record
// the drone's true screen position (nx, ny in NDC; inF = inside 95% of the frame and in front).
window.__cs = { on: false, rows: [], last: null, cam: null, V: null };
(async function hook() {
  for (let i = 0; i < 200 && !window.__cs.V; i++) {
    const e = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /\.vite\/deps\/three\.js/.test(n));
    if (e) {
      try {
        const T = await import(e); const orig = T.Object3D.prototype.lookAt;
        T.Object3D.prototype.lookAt = function (...a) { if (this.isPerspectiveCamera) window.__cs.cam = this; return orig.apply(this, a); };
        window.__cs.V = new T.Vector3();
      } catch (err) { window.__cs.hookErr = String(err); }
      break;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
})();
(function loop() {
  const f = (t) => {
    const cs = window.__cs, d = window.__THREE_GAME_DIAGNOSTICS__, G = window.__GAME__;
    if (cs.on && d && d.camera && d.player && G && G.insideSolid) {
      const c = d.camera, p = d.player.position;
      const in0 = G.insideSolid(c.x, c.y, c.z, 0), in1 = G.insideSolid(c.x, c.y, c.z, 0.1);
      // occlusion: sample the segment camera -> drone (stop 0.8 m short of the drone)
      const dx = p.x - c.x, dy = p.y + 0.4 - c.y, dz = p.z - c.z, L = Math.hypot(dx, dy, dz); let occ = 0;
      for (let i = 1; i < 64; i++) { const s = i / 64; if (s * L > L - 0.8) break; if (G.insideSolid(c.x + dx * s, c.y + dy * s, c.z + dz * s, 0)) { occ = 1; break; } }
      let nx = null, ny = null, nz = null, inF = null;
      if (cs.cam && cs.V) { cs.V.set(p.x, p.y, p.z).project(cs.cam); nx = cs.V.x; ny = cs.V.y; nz = cs.V.z; inF = nz > -1 && nz < 1 && Math.abs(nx) < 0.95 && Math.abs(ny) < 0.95 ? 1 : 0; }
      cs.rows.push({ t: t / 1000, cx: c.x, cy: c.y, cz: c.z, px: p.x, py: p.y, pz: p.z, yaw: c.view.yaw, pitch: c.view.pitch, zoom: c.view.zoom, free: c.view.free, by: c.behind.yaw, be: c.behind.elev, dist: L, in0, in1, occ, boosting: d.player.boosting, speed: d.player.speed, crashes: d.crashes, under: c.y < 0.5 ? 1 : 0, ph: d.objective && d.objective.phase, st: d.state, pyaw: d.player.yaw, fov: c.fov, asp: c.aspect, nx, ny, nz, inF, corW: c.corridor && c.corridor.w });
    }
    requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
})();
