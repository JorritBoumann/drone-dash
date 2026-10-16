// Round 18 builder: load seeds, print features, pad audit and a few route lengths; screenshot over each feature.
import { chromium } from '@playwright/test';
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const seeds = process.env.FRESH ? Array.from({ length: Number(process.env.FRESH) }, (_, i) => 'fresh' + i) : (process.env.SEEDS || '22').split(',');
const browser = await chromium.launch({ channel: 'chromium' });
for (let seed of seeds) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('http://127.0.0.1:5188/' + (process.env.FRESH ? '' : '?seed=' + seed), { waitUntil: 'networkidle' }); await page.waitForTimeout(900);
  if (process.env.FRESH) { seed = await page.evaluate(() => window.__GAME__.city().seed); await page.screenshot({ path: OUT + `F-fresh${process.env.FRESH}-seed${seed}-title.jpg`, type: 'jpeg', quality: 80 }); }
  const f = await page.evaluate(() => window.__GAME__.features());
  console.log('FEAT', seed, JSON.stringify(f.map((x) => [x.kind, x.name, Math.round(x.x), Math.round(x.z)])));
  const kc = {}; for (const x of f) kc[x.kind] = (kc[x.kind] || 0) + 1; console.log('KINDS', seed, Object.keys(kc).length, JSON.stringify(kc));
  await page.evaluate(() => { window.__GAME__.externalClock(true); window.__GAME__.start(); window.__GAME__.manualRender(true); });
  await page.waitForTimeout(1200);
  if (process.env.SHOTS) {
    for (const k of ['diagonal', 'alley', 'tunnel']) {
      const ft = f.find((x) => x.kind === k); if (!ft) continue;
      // hover 30 m south-east of the feature looking at it
      // diagonal: stand on the boulevard looking along it; alley / tunnel: at the alley mouth looking in
      const pos = await page.evaluate(([k, name]) => {
        const f = window.__GAME__.features().find((q) => q.name === name);
        if (k === 'diagonal') { const r = window.__GAME__.streetRoute({ x: f.x - 40, z: f.z - 40 }, { x: f.x + 40, z: f.z + 40 }, true); return { x: f.x, z: f.z, y: 9, yaw: 0 }; }
        return { x: f.x, z: f.z + 30, y: k === 'tunnel' ? 4 : 8, yaw: 0 };
      }, [k, ft.name]);
      const yaw = k === 'diagonal' ? Number(process.env.DYAW || 0.785) : 0;
      await page.evaluate(([p, yaw]) => window.__GAME__.place(p.x - Math.sin(yaw) * 0, p.y, p.z, yaw, 0), [pos, yaw]);
      await page.evaluate(() => window.__GAME__.advance(1.0, true)); await page.waitForTimeout(200);
      await page.screenshot({ path: OUT + `F-${process.env.FRESH ? 'fresh-' : ''}seed${seed}-${k}.jpg`, type: 'jpeg', quality: 80 });
    }
  }
  console.log('ERR', errs.length, errs.slice(0, 2));
  await page.close();
}
await browser.close();
