// Round 47 builder: the default soundtrack (the owner's choice: Breakbeat). Fresh browser contexts on the dev server:
// no choice, a saved 'classic', a saved 'breakbeat', a saved unknown value, ?music=classic, ?music=breakbeat and an
// unknown ?music value. Reports audio.music.soundtrack and which title button is pressed.
import { chromium } from '@playwright/test';
const PORT = Number(process.env.PORT || 5199); if (PORT === 5188) throw new Error('owner');
const browser = await chromium.launch({ channel: 'chromium' });
const cases = [['no choice', null, ''], ['saved classic', 'classic', ''], ['saved breakbeat', 'breakbeat', ''], ['saved unknown', 'xyz', ''], ['?music=classic', null, '&music=classic'], ['?music=classic over saved breakbeat', 'breakbeat', '&music=classic'], ['?music=breakbeat', 'classic', '&music=breakbeat'], ['?music=foo', null, '&music=foo']];
let bad = 0;
for (const [label, saved, q] of cases) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  if (saved !== null) await ctx.addInitScript((v) => { try { localStorage.setItem('drone-dash-track-v1', v); } catch {} }, saved);
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/?seed=22${q}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  const r = await page.evaluate(() => ({ track: window.__THREE_GAME_DIAGNOSTICS__.audio.music.soundtrack, pressed: [...document.querySelectorAll('#title-screen .track-button[aria-pressed="true"], .sound-pick .track-button[aria-pressed="true"]')].map((b) => b.dataset.track) }));
  const want = q.includes('music=classic') || (saved === 'classic' && !q.includes('music=breakbeat')) ? 'classic' : 'breakbeat';
  const ok = r.track === want && r.pressed.every((p) => p === want) && errs.length === 0;
  if (!ok) bad++;
  console.log(ok ? 'OK ' : 'BAD', label.padEnd(36), 'track', r.track, 'pressed', JSON.stringify(r.pressed), 'want', want, 'errors', errs.length);
  await ctx.close();
}
console.log('SUMMARY bad', bad);
await browser.close();
