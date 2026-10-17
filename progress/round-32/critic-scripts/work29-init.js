// Round 29 critic (new): main-thread work per frame. The headless browser is held at 30 fps on this machine (a system
// process uses a full core), so rAF intervals only show the cap. This wraps requestAnimationFrame and times every callback
// (the game's frame: simulation plus render submission). Sums the callbacks of one frame. window.__wk = per-frame ms.
window.__wk = []; window.__wkOn = false;
(function () {
  const raf = window.requestAnimationFrame.bind(window); let frameT = -1, acc = 0;
  window.requestAnimationFrame = (cb) => raf((t) => { if (t !== frameT) { if (frameT >= 0 && window.__wkOn) window.__wk.push(acc); frameT = t; acc = 0; } const a = performance.now(); try { cb(t); } finally { acc += performance.now() - a; } });
})();
