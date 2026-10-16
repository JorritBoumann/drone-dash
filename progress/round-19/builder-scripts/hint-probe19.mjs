// Round 19 builder (new): route hint check. Deterministic (external clock). For each city: every leg start (up to LEGS
// legs, finished by placing the drone on the pad), the shortest street route from the drone to the objective (the
// streetRoute hook, as the critic's bot logs it) and what the HUD shows: #route-hint visible, its text, and the seconds
// from the leg start to the hint. Also: feature names unique within the city. Desktop or MOBILE=1 (iPhone 13 landscape).
import { chromium, devices } from '@playwright/test';
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const seeds = (process.env.SEEDS || '22').split(','); const LEGS = Number(process.env.LEGS || 12); const MOBILE = !!process.env.MOBILE;
const browser = await chromium.launch({ channel: 'chromium' });
let legsAll = 0, featLegs = 0, named = 0, late = 0, dupCities = 0, shots = 0;
for (const seed of seeds) {
  const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:5188/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
  await page.evaluate(() => { window.__GAME__.externalClock(true); window.__GAME__.start(); window.__GAME__.manualRender(true); });
  const names = await page.evaluate(() => window.__GAME__.features().map((f) => f.name));
  const dups = names.filter((n, i) => names.indexOf(n) !== i);
  if (dups.length) dupCities++;
  let lastKey = '';
  const legs = [];
  for (let k = 0; k < LEGS * 2 + 4 && legs.length < LEGS; k++) {
    const d = await page.evaluate(() => JSON.parse(JSON.stringify(window.__GAME__.advance(0.05, true))));
    if (d.state !== 'playing') break;
    const key = d.objective.phase + d.objective.name;
    if (key === lastKey) continue;
    lastKey = key;
    // the leg just started: wait up to 1 s of game time in 0.1 s steps for the hint
    const p = d.player.position, o = d.objective.position;
    const rr = await page.evaluate(([p, o]) => { const g = window.__GAME__; const gr = g.streetRoute(p, o, false); const fr = g.streetRoute(p, o, true); return { g: gr.length, f: fr.length, kinds: fr.kinds, names: fr.names }; }, [{ x: p.x, z: p.z }, { x: o.x, z: o.z }]);
    let seen = null;
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const h = await page.evaluate(() => { const el = document.getElementById('route-hint'); const cs = getComputedStyle(el); return { show: el.classList.contains('show'), text: el.textContent, op: +cs.opacity }; });
      if (h.show && rr.names.length && rr.names.some((n) => h.text.includes(n))) { seen = { t: +t.toFixed(1), text: h.text }; break; }
      await page.evaluate(() => window.__GAME__.advance(0.1, true));
    }
    const diag = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.routeHint);
    const feat = rr.kinds.length > 0;
    legs.push({ to: key.slice(0, 44), g: Math.round(rr.g), f: Math.round(rr.f), kinds: rr.kinds, names: rr.names, hint: seen, hintKind: diag?.kind });
    legsAll++; if (feat) { featLegs++; if (seen) named++; else late++; }
    if (feat && seen && shots < 3 && legs.length > 1) { shots++; await page.screenshot({ path: OUT + `H-${MOBILE ? 'm' : 'd'}-seed${seed}-hint${shots}.jpg`, type: 'jpeg', quality: 80 }); }
    // finish the leg: put the drone on the pad
    await page.evaluate((o) => { const g = window.__GAME__; g.place(o.x, o.y + 1.3, o.z, 0, 0); g.advance(0.4, false); }, o);
  }
  console.log(JSON.stringify({ seed, features: names.length, dups, legs }));
  await ctx.close();
}
console.log(`HINT legs ${legsAll}, legs whose shortest route has a feature ${featLegs}, named within 1 s ${named}, missing ${late}, cities with a repeated name ${dupCities}`);
await browser.close();
