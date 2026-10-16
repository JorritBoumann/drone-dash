// Round 22 critic: per-frame camera sampler (init script). window.__cs.on = true starts logging.
window.__cs = { on: false, rows: [], last: null };
(function loop() {
  const f = (t) => {
    const cs = window.__cs, d = window.__THREE_GAME_DIAGNOSTICS__, G = window.__GAME__;
    if (cs.on && d && d.camera && d.player && G && G.insideSolid) {
      const c = d.camera, p = d.player.position;
      const in0 = G.insideSolid(c.x, c.y, c.z, 0), in1 = G.insideSolid(c.x, c.y, c.z, 0.1);
      // occlusion: sample the segment camera -> drone (stop 0.8 m short of the drone)
      const dx = p.x - c.x, dy = p.y + 0.4 - c.y, dz = p.z - c.z, L = Math.hypot(dx, dy, dz); let occ = 0;
      for (let i = 1; i < 64; i++) { const s = i / 64; if (s * L > L - 0.8) break; if (G.insideSolid(c.x + dx * s, c.y + dy * s, c.z + dz * s, 0)) { occ = 1; break; } }
      cs.rows.push({ t: t / 1000, cx: c.x, cy: c.y, cz: c.z, px: p.x, py: p.y, pz: p.z, yaw: c.view.yaw, pitch: c.view.pitch, zoom: c.view.zoom, free: c.view.free, by: c.behind.yaw, be: c.behind.elev, dist: L, in0, in1, occ, boosting: d.player.boosting, speed: d.player.speed, crashes: d.crashes, under: c.y < 0.5 ? 1 : 0, ph: d.objective && d.objective.phase, st: d.state, pyaw: d.player.yaw, fov: c.fov, asp: c.aspect });
    }
    requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
})();
