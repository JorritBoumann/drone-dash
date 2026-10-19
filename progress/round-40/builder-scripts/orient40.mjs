// Round 40 builder: minimap orientation (same rotation sign for layer and markers, no left-right mirror).
// Seed 22. The drone on the northmost east-west road (z = -154, the seawall at z = -164 is north of it), 10 m up,
// facing each way. Facing east: the road ahead must run up the map (12 o'clock street colour), the sea (north) on the
// LEFT, the island (south) on the RIGHT, the N badge at 9 o'clock. Facing west: mirrored. Facing north: the sea ahead.
// Pixels are read from the minimap canvas itself. Also the marker bearing check for a target placed by teleporting.
import { chromium } from '@playwright/test';
const PORT = process.env.PORT || '5190';
const OUT = process.env.OUTDIR || new URL('../builder-shots/', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 })).newPage();
await page.goto(`http://127.0.0.1:${PORT}/?seed=22`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1000);
await page.evaluate(() => { localStorage.removeItem('drone-dash-minimap-v1'); const G = window.__GAME__; G.start(); G.manualRender(true); });
for (const [name, yaw] of [['east', -Math.PI / 2], ['west', Math.PI / 2], ['north', 0]]) {
  const r = await page.evaluate(([yaw]) => {
    const G = window.__GAME__; G.place(-60, 10, -154, yaw, 0); G.advance(0.2, true);
    const c = document.getElementById('minimap'), ctx = c.getContext('2d'), W = c.width, R = W / 2;
    const cls = (x, y) => { const p = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data; return p[2] > p[0] + 20 ? 'water' : p[0] > 200 && p[1] > 200 ? 'street' : 'land'; };
    const col = (dx, dy) => cls(R + dx * R, R + dy * R);
    const ahead = [0.25, 0.4, 0.55, 0.7].map((t) => col(0, -t));
    return { yaw, ahead, left: col(-0.8, 0), right: col(0.8, 0), behind: col(0, 0.55), mm: G.minimap.last };
  }, [yaw]);
  console.log(name, JSON.stringify({ ahead: r.ahead, left: r.left, right: r.right, behind: r.behind }));
  const b = await page.evaluate(() => window.__GAME__.minimap.box); await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}orient-${name}.jpg`, type: 'jpeg', quality: 88, clip: { x: b.l - 6, y: b.t - 6, width: b.r - b.l + 12, height: b.b - b.t + 12 } });
}
await browser.close();
