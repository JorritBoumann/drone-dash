// Round 39 builder: close views of the drone (rotor smear, attitude, parcel) through renderFrom. TAG, PORT
import { chromium } from '@playwright/test';
const PORT = process.env.PORT || '5190', TAG = process.env.TAG || 'r39';
const OUT = process.env.OUT || new URL('../builder-shots/', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
await page.goto(`http://127.0.0.1:${PORT}/?seed=22`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1000);
await page.evaluate(() => { const G = window.__GAME__; G.start(); G.manualRender(true); G.tune({ RUN: { startTime: 999 } }); G.place(-150, 12, 22, -Math.PI / 2, 0); G.advance(1, false); });
const views = [['hover-side', [], 0.8, [0, 0.9, 3.4]], ['hover-top', [], 0.5, [1.5, 3.2, 1.6]], ['accel-side', ['KeyW'], 0.45, [0, 0.6, 3.6]], ['boost-side', ['KeyW', 'KeyE'], 0.5, [0, 0.6, 3.6]], ['brake-side', ['KeyS'], 0.3, [0, 0.6, 3.6]], ['turn-rear', ['KeyW', 'KeyD'], 0.6, [3.6, 0.8, 0]]];
for (const [name, keys, t, off] of views) {
  await page.evaluate(([keys, t, off, name]) => {
    const G = window.__GAME__;
    if (name === 'brake-side') { G.place(-150, 12, 22, -Math.PI / 2, 16); }
    else if (!name.startsWith('accel') && !name.startsWith('turn')) G.place(-150, 12, 22, -Math.PI / 2, name.startsWith('boost') ? 14 : 0);
    else G.place(-150, 12, 22, -Math.PI / 2, name.startsWith('turn') ? 16 : 0);
    if (name.endsWith('top')) window.__GAME__.diagnostics();
    for (const k of keys) G.key(k, true);
    G.advance(t, false);
    const p = G.diagnostics().player.position;
    // camera beside the drone (offset in world axes; the drone heads +x)
    G.renderFrom(p.x + off[2] * 0 + (off[0] ? off[0] : 0), p.y + off[1], p.z + (off[0] ? 0 : off[2]), p.x, p.y, p.z);
    for (const k of keys) G.key(k, false);
  }, [keys, t, off, name]);
  await page.screenshot({ path: `${OUT}${TAG}-close-${name}.jpg`, type: 'jpeg', quality: 85 });
  const f = await page.evaluate(() => window.__GAME__.diagnostics().feel);
  console.log(name, 'pitch', f.pitch.toFixed(1), 'roll', f.roll.toFixed(1), 'rotor', f.rotor.toFixed(0), 'smear', f.smear.toFixed(2));
}
await browser.close();
