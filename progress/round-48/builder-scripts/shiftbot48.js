// Round 48 builder: a deterministic in-page pilot for the shift balance (externalClock + advance, keys through the
// __GAME__.key hook, a 20 Hz control loop). Same city + same profile = the same run, so before / after numbers compare.
// Profiles:
//   slow    : plain street grid (no alleys or diagonals), 8 m up, cruise 12 m/s, slow corners, never presses boost,
//             a 2 s look-around pause about every 18 s, sloppier steering. Ignores rings.
//   casual  : the suggested street route, 8 m up, cruise 13 m/s, corners at 8 m/s, never presses boost, a 2 s pause
//             every 20 s, a slow last 8 m onto the pad, flies through rings on its line.
//   good    : shortest street route (alleys, tunnels, diagonals), 7 m up, cruise 16, boost on straights over 55 m when
//             the meter has 30%, flies through rings on its line.
//   perfect : as good, corners at 9 m/s, boosts on any straight over 30 m, aims at rings (small detours up to 6 m).
// window.__SB.begin(profile) then __SB.step(seconds) until it returns { done }.
(() => {
  const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const P = {
    // slow: the round 48 first-draft casual line (kept as the low reference): plain grid, 12 m/s, pauses, ignores rings
    slow: { cruise: 12, corner: 6, lowY: 8, boostD: Infinity, steer: 0.16, features: false, pauseEvery: 18, pauseLen: 2, rings: false },
    // casual: follows the suggested street route at a modest pace, never presses boost, takes the corners a bit hot (some
    // crashes), a short look-around pause now and then, and flies through rings that sit on its line (no detours)
    casual: { cruise: 13, corner: 8, lowY: 8, boostD: Infinity, steer: 0.14, features: true, pauseEvery: 20, pauseLen: 2, rings: true, padSlow: 3 },
    good: { cruise: 16, corner: 7, lowY: 7, boostD: 55, steer: 0.1, features: true, pauseEvery: 0, pauseLen: 0, rings: true },
    perfect: { cruise: 17, corner: 9, lowY: 6.5, boostD: 30, steer: 0.08, features: true, pauseEvery: 0, pauseLen: 0, rings: true, aim: true },
  };
  const SB = {};
  window.__SB = SB;
  let legY = 0;
  let G, cfg, keys, legKey, wps, leaving, posHist, unstick, simT, prevPos, nextPause, pauseLeft, delTimes, lastDel, crashes0, boostT, ringT, log;
  const setKey = (k, on) => { if (on && !keys.has(k)) { keys.add(k); G.key(k, true); } if (!on && keys.has(k)) { keys.delete(k); G.key(k, false); } };
  SB.begin = (profile, tune) => {
    G = window.__GAME__;
    cfg = { ...P[profile], name: profile };
    keys = new Set(); legKey = ''; wps = []; leaving = true; posHist = []; unstick = 0; simT = 0; prevPos = null;
    nextPause = cfg.pauseEvery || Infinity; pauseLeft = 0; delTimes = []; lastDel = 0; boostT = 0; ringT = 0; log = [];
    G.manualRender(true);
    G.externalClock(true);
    if (tune) G.tune(tune);
    G.start();
    G.advance(0.05, false);
    crashes0 = 0;
    return true;
  };
  const route = (p, o) => {
    const r = G.streetRoute({ x: p.x, z: p.z }, { x: o.x, z: o.z }, cfg.features);
    const out = [];
    for (const q of r.points) { const l = out[out.length - 1] || p; if (Math.hypot(q.x - l.x, q.z - l.z) > 3) out.push({ x: q.x, z: q.z, kind: q.kind }); }
    // merge straight runs (the graph splits a street at every crossing): drop a point that lies on the line on to the next
    for (let i = out.length - 2; i >= 1; i--) {
      const a = out[i - 1], b = out[i], c = out[i + 1];
      const d1 = Math.atan2(b.x - a.x, b.z - a.z), d2 = Math.atan2(c.x - b.x, c.z - b.z);
      if (Math.abs(wrap(d2 - d1)) < 0.05 && b.kind === c.kind) out.splice(i, 1);
    }
    out.push({ x: o.x, z: o.z, final: true });
    return out;
  };
  SB.step = (seconds) => {
    const until = simT + seconds;
    let d = window.__THREE_GAME_DIAGNOSTICS__;
    while (simT < until && d.state === 'playing') {
      const p = d.player.position, o = d.objective.position;
      const k = d.objective.phase + d.objective.name + d.deliveries;
      if (k !== legKey) { legKey = k; leaving = true; posHist.length = 0; wps = route(p, o); legY = p.y; }
      const hd = Math.hypot(o.x - p.x, o.z - p.z);
      let w = wps[0], wd = Math.hypot(w.x - p.x, w.z - p.z);
      // pass a waypoint when close, or when it is behind us and the next one is nearer the line
      while (!w.final && (wd < 4 || hd < 14)) { leaving = false; wps.shift(); w = wps[0]; wd = Math.hypot(w.x - p.x, w.z - p.z); }
      // ring aim: a ring within 45 m ahead along the current waypoint direction, close to the line
      let aimY = null, aim = null;
      if (cfg.rings && d.rings) {
        for (const r of d.rings) {
          if (!r.on) continue;
          const rd = Math.hypot(r.x - p.x, r.z - p.z);
          if (rd > 45) continue;
          const toW = Math.atan2(w.x - p.x, w.z - p.z), toR = Math.atan2(r.x - p.x, r.z - p.z);
          const off = Math.abs(Math.sin(wrap(toR - toW))) * rd;
          if (Math.abs(wrap(toR - toW)) < 0.6 && off < (cfg.aim ? 6 : 2.5)) { aimY = r.y; if (cfg.aim && rd > 3) aim = r; break; }
        }
      }
      const vx = prevPos ? (p.x - prevPos.x) / 0.05 : 0, vz = prevPos ? (p.z - prevPos.z) / 0.05 : 0;
      const head = Math.hypot(vx, vz) > 4 ? Math.atan2(vx, vz) : Math.atan2(-Math.sin(d.player.yaw), -Math.cos(d.player.yaw));
      const tx = aim ? aim.x : w.x, tz = aim ? aim.z : w.z;
      const err = wrap(Math.atan2(tx - p.x, tz - p.z) - head);
      posHist.push([simT, p.x, p.z]); while (posHist.length && posHist[0][0] < simT - 3) posHist.shift();
      if (unstick <= 0 && posHist.length > 50 && simT - posHist[0][0] > 2.7 && Math.hypot(posHist[0][1] - p.x, posHist[0][2] - p.z) < 1.5 && hd > 3) { unstick = 1.2; posHist.length = 0; log.push(['unstick', +simT.toFixed(1), Math.round(p.x), Math.round(p.y), Math.round(p.z), d.objective.phase, Math.round(o.x), Math.round(o.y), Math.round(o.z), wps.map((q) => [Math.round(q.x), Math.round(q.z), q.kind || 'end'])]); }
      const raised = o.y > 2;
      let wantY = hd < 30 ? (raised ? o.y + 1.5 : o.y + 1.2) : (raised && hd < 45 ? o.y + 2 : (aimY ?? cfg.lowY));
      // leave a roof pad: climb 8 m clear of it first (parapets, taller neighbours), then out to the street at that height
      const climbOut = leaving && legY > 10 && hd >= 30;
      if (climbOut) wantY = legY + 8;
      // a tunnel is 7 m clear: fly it (and the approach to it) at 3.5 m
      const inTunnel = w.kind === 'tunnel' || (wps[1] && wps[1].kind === 'tunnel' && wd < 28);
      if (inTunnel && hd >= 30) wantY = 3.5;
      const next = wps[1];
      const turn = next && !w.final ? Math.abs(wrap(Math.atan2(next.x - w.x, next.z - w.z) - Math.atan2(w.x - p.x, w.z - p.z))) : 0;
      const corner = !w.final && wd < 14 && turn > 0.5;
      let tgtSpeed = hd < 8 ? (cfg.padSlow ?? 4) : corner ? cfg.corner : w.final && hd < 25 ? 8 : cfg.cruise;
      const straight = !corner && !w.final && wd > cfg.boostD && Math.abs(err) < 0.12;
      let boost = straight && d.player.boost > 0.3;
      if (raised && hd < 30 && p.y < o.y - 0.5) tgtSpeed = 1;
      if (climbOut && p.y < legY + 6) tgtSpeed = Math.min(tgtSpeed, 2);
      if (Math.abs(err) > 0.5) tgtSpeed = Math.min(tgtSpeed, 8);
      // casual: a look-around pause now and then
      if (simT >= nextPause) { pauseLeft = cfg.pauseLen; nextPause += cfg.pauseEvery; }
      if (pauseLeft > 0) { pauseLeft -= 0.05; tgtSpeed = 0; boost = false; }
      if (unstick > 0) {
        unstick -= 0.05;
        for (const kk of ['KeyW', 'KeyA', 'KeyD', 'ShiftLeft', 'KeyE']) setKey(kk, false);
        setKey('KeyS', true); setKey('Space', true);
      } else {
        setKey('KeyD', Math.abs(err) > cfg.steer && err < 0); setKey('KeyA', Math.abs(err) > cfg.steer && err > 0);
        setKey('KeyW', Math.abs(err) < 0.8 && d.player.speed < tgtSpeed);
        setKey('KeyS', d.player.speed > tgtSpeed + 3 || (Math.abs(err) > 1.2 && d.player.speed > 4));
        setKey('KeyE', boost);
        setKey('Space', p.y < wantY - 1.2); setKey('ShiftLeft', p.y > wantY + 1.2);
      }
      prevPos = { x: p.x, z: p.z };
      d = G.advance(0.05, false);
      simT += 0.05;
      if (d.player.boosting) boostT += 0.05;
      if (d.deliveries > lastDel) { lastDel = d.deliveries; delTimes.push(+simT.toFixed(1)); }
    }
    if (d.state !== 'playing') {
      for (const kk of [...keys]) setKey(kk, false);
      return { done: true, ...SB.result(d) };
    }
    return { done: false, t: +simT.toFixed(1), deliveries: d.deliveries, timeLeft: +d.timeLeft.toFixed(1) };
  };
  SB.result = (d) => {
    d = d || window.__THREE_GAME_DIAGNOSTICS__;
    const s = window.__GAME__.session();
    return {
      profile: cfg.name, simT: +simT.toFixed(1), deliveries: d.deliveries, score: d.score, delTimes, crashes: d.crashes,
      timeLeftEnd: +d.timeLeft.toFixed(1), shift: d.shift ?? null, tier: d.goals.tierName, ending: d.ending,
      breakdown: d.breakdown, boostT: +boostT.toFixed(1), rings: d.ringStats ?? null, unsticks: log.length, log, win: s.last?.win ?? null,
      over: (document.querySelector('.over-kicker')?.textContent || '').trim(),
    };
  };
})();
