// Round 33 builder: shadows with the city shadow slab on vs off (same frame), pixel difference; golden/dusk low sun.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
for (const seed of [130, 33, 22, 58]) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto('http://127.0.0.1:5190/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
  await page.evaluate(() => { const G = window.__GAME__; G.tune({ RUN: { startTime: 9999 } }); G.start(); G.manualRender(true); });
  await page.waitForFunction(() => window.__GAME__.assetsReady().on, null, { timeout: 30000 });
  for (const [x, y, z, yaw] of [[-90, 3, 0, 0], [0, 38, 120, 1.57], [60, 16, -60, 3.14], [-150, 8, 150, -1.57]]) {
    const shots = [];
    await page.evaluate(([x, y, z, yaw]) => { const G = window.__GAME__; for (let i = 0; i < 4; i++) { G.place(x, y, z, yaw, 0); G.advance(1 / 20, false); } }, [x, y, z, yaw]);
    for (const on of [true, true, false]) {
      await page.evaluate((on) => { const G = window.__GAME__; G.shadowSlab(on); G.advance(0, true); }, on);
      shots.push(await page.screenshot({ type: 'png' }));
    }
    const diff = (a, b) => page.evaluate(async ([a, b]) => {
      const load = (u) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + u; });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height; const x = c.getContext('2d');
      x.drawImage(ia, 0, 0); const da = x.getImageData(0, 0, c.width, c.height).data; x.drawImage(ib, 0, 0); const db = x.getImageData(0, 0, c.width, c.height).data;
      let n = 0; for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 12) n++;
      return n;
    }, [a.toString('base64'), b.toString('base64')]);
    const d = [await diff(shots[0], shots[1]), await diff(shots[1], shots[2])];
    const st = await page.evaluate(() => window.__GAME__.shadowSlab());
    console.log('SLAB', seed, x, y, z, yaw, 'control(on/on)', d[0], 'slab(on/off)', d[1], JSON.stringify(st));
  }
  await page.close();
}
await browser.close();
