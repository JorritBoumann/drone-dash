// Round 27 builder: copy of the round 25 critic's pad-people23 (port 5190).
// Round 23 critic: people on the active pad. Deterministic (manualRender + advance). Per leg: hover 40 m away for 8 s while
// sampling (game's onActivePad count, and my own count of people within 2.5 m of the pad centre), then drop onto the pad.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const LEGS = Number(process.env.LEGS || 12); let T = { legs: 0, samples: 0, gameOn: 0, mineOn: 0, legsAny: 0, atTrigger: 0 };
for (const seed of (process.env.SEEDS || '22,58,130,44').split(',')) {
  const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
  await page.goto('http://127.0.0.1:5190/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(400);
  const r = await page.evaluate((LEGS) => {
    const G = window.__GAME__; G.tune({ RUN: { startTime: 999 } }); G.start(); G.manualRender(true); let d = G.advance(1, false);
    const out = { legs: 0, samples: 0, gameOn: 0, mineOn: 0, legsAny: 0, atTrigger: 0, list: [] };
    for (let leg = 0; leg < LEGS && d.state === 'playing'; leg++) {
      const o = d.objective.position, ph = d.objective.phase, name = d.objective.name; let any = 0;
      G.place(o.x + 40, Math.max(o.y + 12, 30), o.z, 0, 0);
      for (let t = 0; t < 8; t += 0.25) {
        d = G.advance(0.25, false); out.samples++;
        const g = d.street.onActivePad, m = G.people().filter((p) => Math.hypot(p.x - o.x, p.z - o.z) < 2.5 && Math.abs((p.y || 0) - o.y) < 2).length;
        out.near6 = (out.near6 || 0) + G.people().filter((p) => Math.hypot(p.x - o.x, p.z - o.z) < 6).length; if (!out.ex) out.ex = G.people()[0]; if (g) out.gameOn++; if (m) out.mineOn++; if (g || m) any++;
      }
      const pre = G.people().filter((p) => Math.hypot(p.x - o.x, p.z - o.z) < 2.5 && Math.abs((p.y || 0) - o.y) < 2).length + d.street.onActivePad;
      if (pre) out.atTrigger++;
      G.place(o.x, o.y + 1.2, o.z, 0, 0); d = G.advance(0.1, false);
      for (let k = 0; k < 20 && d.objective.name === name && d.objective.phase === ph; k++) d = G.advance(0.1, false);
      out.legs++; if (any) { out.legsAny++; out.list.push({ ph, name, y: +o.y.toFixed(1), samplesWithPeople: any }); }
    }
    out.deliveries = d.deliveries; return out;
  }, LEGS);
  console.log('SEED', seed, JSON.stringify(r));
  for (const k of Object.keys(T)) T[k] += r[k];
  await page.context().close();
}
console.log('TOTAL', JSON.stringify(T));
await browser.close();
