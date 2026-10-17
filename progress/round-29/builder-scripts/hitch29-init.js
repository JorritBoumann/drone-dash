// Round 29 builder: where the first-flight hitch goes. Wraps the WebGL2 calls that can block (shader compile / link /
// status queries, texture and buffer uploads) and AudioContext creation; sums their time per animation frame.
(function () {
  const H = window.__h29 = { frames: [], cur: { gl: {}, n: {} }, t0: performance.now(), marks: [] };
  const wrap = (proto, name) => { const f = proto[name]; if (!f) return; proto[name] = function (...a) { const t = performance.now(); try { return f.apply(this, a); } finally { const d = performance.now() - t; H.cur.gl[name] = (H.cur.gl[name] || 0) + d; H.cur.n[name] = (H.cur.n[name] || 0) + 1; } }; };
  for (const P of [window.WebGL2RenderingContext && WebGL2RenderingContext.prototype].filter(Boolean))
    for (const n of ['compileShader', 'linkProgram', 'getProgramParameter', 'getShaderParameter', 'getProgramInfoLog', 'getShaderInfoLog', 'texImage2D', 'texSubImage2D', 'texStorage2D', 'compressedTexImage2D', 'bufferData', 'bufferSubData', 'generateMipmap', 'readPixels', 'drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'useProgram']) wrap(P, n);
  const AC = window.AudioContext; if (AC) { window.AudioContext = function (...a) { const t = performance.now(); const c = new AC(...a); H.marks.push({ k: 'AudioContext', ms: +(performance.now() - t).toFixed(1), at: +(t - H.t0).toFixed(0) }); return c; }; window.AudioContext.prototype = AC.prototype; }
  let last = performance.now();
  const loop = (t) => { const d = window.__THREE_GAME_DIAGNOSTICS__; const dt = t - last; last = t;
    const gl = {}; for (const [k, v] of Object.entries(H.cur.gl)) if (v > 0.5) gl[k] = +v.toFixed(1);
    H.frames.push({ at: +(t - H.t0).toFixed(0), dt: +dt.toFixed(1), st: d && d.state, gl, n: H.cur.n.linkProgram || 0, tex: (H.cur.n.texImage2D || 0) + (H.cur.n.texStorage2D || 0) });
    H.cur = { gl: {}, n: {} }; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
})();
