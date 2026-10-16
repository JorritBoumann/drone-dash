// Round 23 builder: people on the live pad over 30+ pickups and drops. Deterministic (manualRender + advance). Per seed:
// fly the drone straight onto each live pad (place), sample every 0.1 s from the moment a pad lights up until it is done.
// A person counts when drawn (not hidden) within the pad radius.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
let total = { pads: 0, samples: 0, onPad: 0, hiddenFrames: 0, near: 0 };
for (const seed of (process.env.SEEDS || '130,22,58').split(',')) {
  const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
  await page.goto('http://127.0.0.1:5190/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const G = window.__GAME__; G.tune({ RUN: { startTime: 999 } }); G.start(); G.manualRender(true); let d = G.advance(0.5, false);
    const out = { pads: 0, samples: 0, onPad: 0, near: 0, hid: 0, worst: null };
    let lastName = '';
    for (let leg = 0; leg < 12 && out.pads < 12; leg++) {
      d = G.advance(0.1, false);
      const o = d.objective; if (!o || !o.position) break;
      const name = o.phase + ':' + o.name;
      if (name === lastName) { G.advance(0.5, false); continue; }
      lastName = name; out.pads++;
      const P = o.position; const R = o.name.includes('Depot') ? 2.6 : o.name.includes('Fountain') ? 2.4 : o.name.includes('Rooftop') ? 3 : 1.7; // the game's pad radii (CityGenerator addSite)
      // watch the pad for 4 s from a hover 25 m away (people near the camera are simulated), then land on it
      G.place(P.x + 18, P.y + 8, P.z + 18, 0.78, 0);
      for (let t = 0; t < 6; t += 0.1) {
        d = G.advance(0.1, false);
        if (t > 4) G.place(P.x, P.y + 0.9, P.z, 0, 0);
        const cur = d.objective; if (!cur || cur.phase + ':' + cur.name !== name) break;
        out.samples++;
        for (const p of G.people()) { const dd = Math.hypot(p.x - P.x, p.z - P.z); if (Math.abs(p.y - P.y) > 2) continue; if (dd < R + 1) out.near++; out.hid += p.hidden && dd < R + 0.2 ? 1 : 0; if (!p.hidden && dd < R) { out.onPad++; out.worst = { name, x: p.x, z: p.z, dd }; } }
      }
    }
    out.hiddenFrames = d.street ? undefined : undefined;
    return out;
  });
  const hid = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__ && window.__THREE_GAME_DIAGNOSTICS__.street);
  console.log('PAD', seed, JSON.stringify(r), 'street', JSON.stringify(hid && { onActivePad: hid.onActivePad }));
  for (const k of ['pads', 'samples', 'onPad', 'near']) total[k] += r[k];
  await page.context().close();
}
console.log('TOTAL', JSON.stringify(total));
await browser.close();
