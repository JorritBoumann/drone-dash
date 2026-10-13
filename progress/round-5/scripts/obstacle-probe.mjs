// Round 5 builder probe: place the drone in front of a known obstacle and fly straight into it (deterministic steps).
// Logs height, speed, crash count per frame. OBST=fountain|kerb, Y (start height), V (start speed), BOOST=1.
import { chromium } from '@playwright/test';
const seed = process.env.SEED || '22', Y = Number(process.env.Y || 2.5), V = Number(process.env.V || 19), OB = process.env.OBST || 'fountain';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
await page.goto('http://127.0.0.1:5188/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
await page.evaluate(() => { window.__GAME__.start(); window.__GAME__.manualRender(true); });
const sites = await page.evaluate(() => window.__GAME__.sites());
const park = sites.find((s) => s.kind === 'park');
const cx = park.x - 7.5, cz = park.z;
const dist = Number(process.env.D || 20);
await page.evaluate(([x, y, z, v]) => { window.__GAME__.place(x, y, z, 0, v); window.__GAME__.key('KeyW', true); }, [cx + Number(process.env.OX || 0), Y, cz + dist, V]);
if (process.env.BOOST) await page.evaluate(() => window.__GAME__.key('KeyE', true));
let prev = null;
for (let i = 0; i < 120; i++) {
  const d = await page.evaluate(() => JSON.parse(JSON.stringify(window.__GAME__.advance(1 / 60, false))));
  const p = d.player.position;
  if (i % 3 === 0 || (prev && d.crashes > prev.crashes)) console.log(i, 'x', (p.x - cx).toFixed(2), JSON.stringify(d.contact), 'z', (p.z - cz).toFixed(2), 'y', p.y.toFixed(2), 'v', d.player.speed.toFixed(1), 'crashes', d.crashes, d.state, d.timeLeft.toFixed(2), d.crashes > (prev?.crashes ?? 0) ? JSON.stringify(d.lastCrash) : '');
  prev = d;
}
await browser.close();
