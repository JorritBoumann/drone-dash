// Round 43 builder, dev server (5191, readable function names):
// (a) grapheme truncation: fitText on a name with emoji (ZWJ family, flag, skin tone) and accents (precomposed and
//     combining), at every width from 10 to 400 px: no U+FFFD, no lone surrogate, every cut a whole-grapheme prefix.
//     Also the fallback path (Intl.Segmenter removed). Then the real canvas objective pill with that name (shot).
// (b) the canvas game-over card: allocation sample (CDP HeapProfiler sampling, 64-byte interval) over 3 s of the
//     game-over screen; bytes whose stack holds a CanvasHud over-card function. Draw count over those 3 s. Shot of the
//     canvas card alone (HTML hidden).
import { chromium, devices } from '@playwright/test';
const OUT = process.env.OUTDIR || '/tmp/', PORT = process.env.PORT || '5191', TAG = process.env.TAG || 'r43';
const browser = await chromium.launch({ channel: 'chromium' });
for (const [name, dev] of [['iphone', devices['iPhone 13 landscape']], ['desk', { viewport: { width: 1280, height: 720 } }]]) {
  const ctx = await browser.newContext({ ...dev }); const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('drone-dash-played-v1', '1'); } catch {} });
  await page.goto(`http://127.0.0.1:${PORT}/?seed=22&hud=canvas`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__GAME__ && window.__GAME__.assetsReady().on, null, { timeout: 60000 });
  const NAME = 'Café Zoë 👩‍👩‍👧 Bäckerei 🇳🇱 Ångström 👍🏽 Noël';
  const unit = await page.evaluate(async (NAME) => {
    const m = await import('/src/ui/CanvasHud.ts');
    if (!m.fitText) return { skipped: 'no fitText in this build' };
    const c = document.createElement('canvas').getContext('2d'); c.font = m.font(800, 14);
    const run = () => {
      const g = m.graphemes(NAME); const bad = []; const samples = [];
      for (let w = 10; w <= 400; w += 2) {
        const s = m.fitText(c, NAME, w); const body = s.endsWith('…') ? s.slice(0, -1) : s;
        const lone = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(s);
        const prefix = body === '' || g.some((_, i) => g.slice(0, i + 1).join('').trimEnd() === body) || body === NAME;
        const wide = c.measureText(s).width > w + 0.5 && s !== '…';
        if (s.includes('�') || lone || !prefix || wide) bad.push({ w, s, lone, prefix, wide });
        if (w % 40 === 0) samples.push(`${w}: ${s}`);
      }
      return { graphemes: g.length, codeUnits: NAME.length, bad: bad.slice(0, 5), badN: bad.length, samples };
    };
    const seg = run();
    const S = Intl.Segmenter; delete Intl.Segmenter;
    // the module caches its segmenter: re-import a fresh copy for the fallback
    const m2 = await import('/src/ui/CanvasHud.ts?fallback=' + Date.now());
    const g2 = m2.graphemes(NAME);
    Intl.Segmenter = S;
    return { seg, fallbackGraphemes: g2, fallbackSame: JSON.stringify(g2) === JSON.stringify(m.graphemes(NAME)) };
  }, NAME);
  console.log('UNIT43', TAG, name, 'truncation', JSON.stringify(unit));
  // real pill with that name
  if (dev.hasTouch) await page.tap('#play-button'); else await page.click('#play-button');
  await page.waitForTimeout(800);
  await page.evaluate((NAME) => { document.getElementById('objective-name').textContent = NAME + ' Long Street Market Hall'; }, NAME);
  await page.waitForTimeout(600);
  const ob = await page.evaluate(() => window.__GAME__.canvasHud().panels.find((p) => p.name === 'objective').box);
  await page.screenshot({ path: `${OUT}unit43-${TAG}-objective-${name}.png`, clip: { x: Math.max(0, ob.x - 20), y: Math.max(0, ob.y - 6), width: ob.w + 40, height: ob.h + 12 } });
  console.log('UNIT43', TAG, name, 'pill box', JSON.stringify(ob));
  // (b) game over, then allocation sampling
  for (let i = 0; i < 300; i++) { if ((await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.state)) === 'over') break; await page.evaluate(() => window.__GAME__.advance(1, false)); }
  await page.waitForTimeout(1000);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('HeapProfiler.enable');
  const d0 = await page.evaluate(() => window.__GAME__.canvasHud().panels.find((p) => p.name === 'over').draws);
  await cdp.send('HeapProfiler.startSampling', { samplingInterval: 64, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
  const f0 = await page.evaluate(() => window.__GAME__.canvasHud().frames);
  await page.waitForTimeout(3000);
  const { profile } = await cdp.send('HeapProfiler.stopSampling');
  const d1 = await page.evaluate(() => window.__GAME__.canvasHud().panels.find((p) => p.name === 'over').draws);
  const rafs = await page.evaluate(() => new Promise((r) => { let n = 0; const t = performance.now(); const f = () => { n++; if (performance.now() - t < 1000) requestAnimationFrame(f); else r(n); }; requestAnimationFrame(f); }));
  const OVERFN = /^(updateOver|drawOver|hideOver|fitText|graphemes)$/;
  let total = 0, over = 0; const byFn = {};
  const walk = (n, stack) => {
    const fn = n.callFrame.functionName || '(anon)'; const st = [...stack, fn];
    const self = n.selfSize; total += self;
    if (st.some((s) => OVERFN.test(s))) { over += self; const k = st.slice(-3).join('>'); byFn[k] = (byFn[k] || 0) + self; }
    for (const ch of n.children) walk(ch, st);
  };
  walk(profile.head, []);
  console.log('UNIT43', TAG, name, 'overcard alloc', JSON.stringify({ sampledBytesTotal: total, sampledBytesInOverCard: over, byFn, drawsBefore: d0, drawsAfter3s: d1, rafPerSec: rafs, errs }));
  await page.evaluate(() => { for (const id of ['hud', 'over-screen', 'music-toggle', 'touch-controls']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}unit43-${TAG}-canvas-over-${name}.jpg`, type: 'jpeg', quality: 80 });
  await ctx.close();
}
await browser.close();
