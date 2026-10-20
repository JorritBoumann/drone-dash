// Round 48: a finished run must not report a session end to the Stateloop portal (the portal closes the game on it).
// Serves dist/ with `vite preview` on 5196, mocks window.StateloopSession, ends two runs, counts calls and events.
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.addInitScript(() => {
  window.__slCalls = []; window.__slEvents = [];
  window.StateloopSession = { complete: (d) => window.__slCalls.push(d) };
  addEventListener('stateloop:session-complete', (e) => window.__slEvents.push(e.detail));
});
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://127.0.0.1:5196/?seed=22&slLaunch=x', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__GAME__);
const runs = [];
for (let run = 1; run <= 2; run++) {
  await page.evaluate(() => window.__GAME__.start());
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__GAME__.end());
  await page.waitForTimeout(500);
  runs.push(await page.evaluate(() => ({
    calls: window.__slCalls.length, events: window.__slEvents.length,
    last: window.__GAME__.session().last, state: window.__GAME__.getState?.() ?? null,
  })));
}
console.log(JSON.stringify({ runs, errors }, null, 1));
await browser.close();
if (errors.length || runs.some((r) => r.calls || r.events || !r.last)) process.exit(1);
