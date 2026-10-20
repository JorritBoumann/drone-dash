// Round 43 critic (new): grapheme-safe truncation (CanvasHud fitText / graphemes), loaded from the dev server (5191).
// For names with emoji, ZWJ families, flags, skin tones and combining accents, every max width from 4 to the full width:
// the result is the full text, or a prefix ending on a grapheme boundary plus "…", it never has a lone surrogate, and it
// fits the width. Both Intl.Segmenter and the fallback path (Segmenter hidden) are run.
import { chromium } from '@playwright/test';
const NAMES = ['Café 🚁 Delivery Plaza', '👨‍👩‍👧‍👦 Family Bakery on the corner', 'Flags 🇳🇱🇯🇵🇺🇸 Harbour Market', 'Wave 👋🏽👋🏿 hello street', 'Ñandú Crème brûlée Straße', 'Zalgo e\u0301\u0302\u0303 tower block', '🏳️‍🌈 Pride Pier and Ferry Dock', 'Plain ASCII name with no emoji at all'];
// reference grapheme boundaries from Node's own Intl.Segmenter (independent of the page)
const SEG = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const BOUNDS = NAMES.map((n) => { const b = [0]; let o = 0; for (const g of SEG.segment(n)) { o += g.segment.length; b.push(o); } return b; });
const browser = await chromium.launch({ channel: 'chromium' });
for (const fallback of [false, true]) {
  const page = await (await browser.newContext({ viewport: { width: 800, height: 500 } })).newPage();
  if (fallback) await page.addInitScript(() => { try { delete Intl.Segmenter; } catch {} Intl.Segmenter = undefined; });
  await page.goto('http://127.0.0.1:5191/?seed=22', { waitUntil: 'networkidle' });
  const r = await page.evaluate(async ([names, BOUNDS]) => {
    const m = await import('/src/ui/CanvasHud.ts');
    const c = document.createElement('canvas').getContext('2d'); c.font = m.font(800, 14);
    const seg = typeof Intl.Segmenter === 'function';
    let tests = 0, bad = 0; const ex = [];
    const lone = (s) => /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(s);
    for (const [ni, n] of names.entries()) {
      const bounds = new Set(BOUNDS[ni]);
      const full = c.measureText(n).width;
      for (let w = 4; w <= full + 2; w += 1) {
        tests++;
        const out = m.fitText(c, n, w);
        let ok = true, why = '';
        if (lone(out)) { ok = false; why = 'lone surrogate'; }
        if (out !== n) {
          if (!out.endsWith('…')) { ok = false; why = 'no ellipsis'; }
          const head = out.slice(0, -1);
          if (!n.startsWith(head)) { ok = false; why = 'not a prefix'; }
          else if (![...bounds].some((b) => n.slice(0, b).trimEnd() === head)) { ok = false; why = 'mid-grapheme cut'; }
          if (out !== '…' && c.measureText(out).width > w + 0.01) { ok = false; why = 'too wide'; }
        }
        if (!ok) { bad++; if (ex.length < 6) ex.push({ n, w, out, why }); }
      }
    }
    return { segmenter: seg, tests, bad, ex, sample: names.map((n) => m.fitText(c, n, 90)) };
  }, [NAMES, BOUNDS]);
  console.log('EMOJI43C', fallback ? 'fallback' : 'segmenter', JSON.stringify(r));
  await page.close();
}
await browser.close();
