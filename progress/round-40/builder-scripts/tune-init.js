// Round 40 builder: A/B helper. Applies window.__TUNE (set by the probe via TUNE env) as soon as the game hooks exist.
(() => { const t = setInterval(() => { const G = window.__GAME__; if (G && G.tune && window.__TUNE) { G.tune(window.__TUNE); clearInterval(t); } }, 20); })();
