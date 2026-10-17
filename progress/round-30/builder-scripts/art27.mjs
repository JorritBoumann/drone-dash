// Round 27 critic (new): art screenshots. For two light moods (seeds picked by mood), desktop 1280x720 and iPhone 13 landscape,
// HUD hidden. Deterministic (manualRender + advance). Views: street (3 m along an avenue), shop fronts (3 m, facing a facade),
// people close-up (2.2 m, 6 m from a person, 3 frames 0.15 s apart for gait), mid (16 m), cruise (38 m), and a cruise
// look-down. Logs archetypes in view, shop fronts, detail chunks, triangles and draw calls per view, people and cars near.
import { chromium, devices } from '@playwright/test';
const OUT = '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/r30out/';
const CANDS = (process.env.SEEDS || '22,58,130,11,33,44,7,91').split(',').map(Number);
const WANT = (process.env.MOODS || 'Golden hour,Bright morning').split(',');
const browser = await chromium.launch({ channel: 'chromium' });
const moods = {};
{ const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
  for (const s of CANDS) { await page.goto('http://127.0.0.1:5190/?seed=' + s, { waitUntil: 'networkidle' }); await page.waitForTimeout(600); await page.evaluate(() => window.__GAME__.start()); await page.waitForTimeout(200);
    const m = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.city.mood); console.log('MOOD', s, m); if (!moods[m]) moods[m] = s; if (WANT.every((w) => moods[w])) break; }
  await page.context().close(); }
for (const dev of ['d', 'm']) for (const mood of WANT) {
  const seed = moods[mood]; if (!seed) { console.log('NO SEED FOR', mood); continue; }
  const ctx = await browser.newContext(dev === 'm' ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:5190/?seed=' + seed, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  await page.evaluate(() => { window.__GAME__.start(); window.__GAME__.manualRender(true); window.__GAME__.externalClock && window.__GAME__.externalClock(true); });
  await page.addStyleTag({ content: '.hud, #hud, .hud-top, .hud-bottom, #touch-stick, #up-button, #down-button, #boost-button, #pause-button, .nav-arrow, .nav-diamond, #nav-distance, #gate-tag, #pop, #event-pop, #slip-pop, #medal-pop, #view-hint, #music-toggle { visibility: hidden !important; } .screen { display: none !important; }' });
  const tag = `art27-${dev}-${mood.split(' ')[1] || mood}-${seed}`.toLowerCase();
  const shoot = async (name, x, y, z, yaw, opts = {}) => {
    await page.evaluate(([x, y, z, yaw, o]) => { const G = window.__GAME__; G.place(x, y, z, yaw, 0); for (let i = 0; i < 40; i++) { G.place(x, y, z, yaw, 0); G.advance(1 / 20, false); } if (o.view) G.view(o.view[0], o.view[1], o.view[2]); for (let i = 0; i < 20; i++) { G.place(x, y, z, yaw, 0); G.advance(1 / 20, false); } G.advance(1 / 60, true); }, [x, y, z, yaw, opts]);
    const info = await page.evaluate(() => { const G = window.__GAME__, d = window.__THREE_GAME_DIAGNOSTICS__; const p = d.player.position; const near = (a) => a.filter((q) => Math.hypot(q.x - p.x, q.z - p.z) < 40).length;
      return { pos: [p.x, p.y, p.z].map((v) => +v.toFixed(1)), calls: d.renderer.calls, tris: d.renderer.triangles, chunks: d.detail.chunks, detailTris: d.detail.triangles, inView: G.archetypesInView(70), people40: near(G.people()), cars40: near(G.traffic()) }; });
    console.log('VIEW', tag, name, JSON.stringify(info));
    await page.screenshot({ path: OUT + `${tag}-${name}.jpg`, type: 'jpeg', quality: 80 });
  };
  // avenue x = 22 runs along z; facing -z is yaw 0; facing +x (the east facades) is yaw -PI/2
  await shoot('street', 22, 3, 40, 0);
  await shoot('shopfront', 22, 3, 0, -Math.PI / 2);
  await shoot('facade-mid', 22, 14, 0, -Math.PI / 2);
  await shoot('mid', 22, 16, 40, 0);
  await shoot('cruise', 22, 38, 60, 0);
  await shoot('cruise-down', 22, 38, 60, 0, { view: [0.6, 0.5, 0] });
  // people close-up: the nearest person to a street point, drone 6 m away facing them, 3 frames for gait
  const person = await page.evaluate(() => { const ps = window.__GAME__.people(); const c = { x: 22, z: 20 }; ps.sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z)); return ps[0]; });
  if (person) { const yaw = Math.atan2(-(person.x - (person.x + 6)), -(person.z - person.z)); // face -x toward the person from +6 m on x
    const px = person.x + 6, pz = person.z; const yw = Math.PI / 2; // forward (-sin yaw, -cos yaw) = (-1, 0)
    await page.evaluate(([x, z, yw]) => { const G = window.__GAME__; for (let i = 0; i < 40; i++) { G.place(x, 2.2, z, yw, 0); G.advance(1 / 20, false); } }, [px, pz, yw]);
    for (let f = 0; f < 3; f++) { await page.evaluate(([x, z, yw]) => { const G = window.__GAME__; for (let i = 0; i < 3; i++) { G.place(x, 2.2, z, yw, 0); G.advance(1 / 20, false); } G.advance(1 / 60, true); }, [px, pz, yw]);
      await page.screenshot({ path: OUT + `${tag}-people-f${f}.jpg`, type: 'jpeg', quality: 80 }); }
    console.log('PERSON', tag, JSON.stringify(person)); }
  await ctx.close();
}
await browser.close();
