// Round 40 builder (Codex A): during slow motion and hit-stop the run clock, the leg clock and the delivery timer run at
// real time. Head-on hits into block faces at 14 to 24 m/s, fixed step 60 Hz; per frame logs the time scale and the
// clock advances against the real step (1/60).
import { chromium } from '@playwright/test';
const PORT = process.env.PORT || '5190', SEED = process.env.SEED || '22';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
await page.goto(`http://127.0.0.1:${PORT}/?seed=${SEED}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
const r = await page.evaluate(() => {
  const G = window.__GAME__; G.start(); G.manualRender(true);
  const out = [];
  const tries = [[0, 22, 0], [-44, 22, 0], [44, -22, Math.PI], [0, -22, Math.PI], [-22, 0, -Math.PI / 2], [22, 44, Math.PI / 2]];
  for (const [x, z, yaw] of tries) for (const v of [14, 24]) {
    G.place(x, 6, z, yaw, 0); G.advance(0.6, false);
    G.place(x, 6, z, yaw, v);
    let slowFrames = 0, runSlow = 0, legSlow = 0, timerSlow = 0, minScale = 1, impacts0 = window.__THREE_GAME_DIAGNOSTICS__.feel.impacts;
    let prev = window.__THREE_GAME_DIAGNOSTICS__;
    for (let i = 0; i < 90; i++) {
      G.key('KeyW', true);
      const d = G.advance(1 / 60, false);
      const s = d.feel.timeScale;
      if (s < 0.99) {
        slowFrames++; minScale = Math.min(minScale, s);
        runSlow += d.feel.runTime - prev.feel.runTime; legSlow += d.feel.legClock - prev.feel.legClock;
        timerSlow += prev.timeLeft - d.timeLeft;
      }
      prev = { feel: { ...d.feel }, timeLeft: d.timeLeft };
    }
    G.key('KeyW', false);
    const d = window.__THREE_GAME_DIAGNOSTICS__;
    out.push({ x, z, v, impacts: d.feel.impacts - impacts0, slowFrames, minScale: +minScale.toFixed(2), realSlow: +(slowFrames / 60).toFixed(4), runSlow: +runSlow.toFixed(4), legSlow: +legSlow.toFixed(4), timerSlow: +timerSlow.toFixed(4) });
  }
  return out;
});
for (const row of r) console.log(JSON.stringify(row));
await browser.close();
