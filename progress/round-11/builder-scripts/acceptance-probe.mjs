// Round 11 builder: copied from progress/round-10/critic-scripts; only the output paths changed (screenshots and raw audio go to the session scratchpad).
// Round 1 acceptance test: default URL, bloom on, W+Space, W+E, W+A 3 s each, 9 pixels per frame.
import { chromium } from '@playwright/test';
const URL_ = process.env.URL_ || 'http://127.0.0.1:5188/';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.addInitScript(() => {
  const orig = window.requestAnimationFrame.bind(window);
  window.__px = [];
  window.requestAnimationFrame = (cb) => orig((t) => { cb(t); try { const c = document.getElementById('game-canvas'); const gl = c.getContext('webgl2'); const buf = new Uint8Array(4 * 16); const out = new Set(); for (let i = 0; i < 9; i++) { gl.readPixels(Math.floor(c.width * (0.1 + 0.1 * i)), Math.floor(c.height * (0.2 + 0.07 * i)), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf); out.add(buf.slice(0, 3).join(',')); } window.__px.push(out.size); } catch (e) { window.__px.push('E' + e.message); } });
});
await page.goto(URL_, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.keyboard.press('Enter'); await page.waitForTimeout(500);
const post = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.renderer.post);
console.log('post', post);
let total = 0, flat = 0;
for (const [a, b] of [['KeyW', 'Space'], ['KeyW', 'KeyE'], ['KeyW', 'KeyA']]) {
  await page.evaluate(() => (window.__px.length = 0));
  await page.keyboard.down(a); await page.keyboard.down(b);
  await page.waitForTimeout(3000);
  await page.keyboard.up(a); await page.keyboard.up(b);
  const px = await page.evaluate(() => window.__px.slice());
  const d = await page.evaluate(() => ({ p: window.__THREE_GAME_DIAGNOSTICS__.player.position, s: window.__THREE_GAME_DIAGNOSTICS__.state }));
  const f = px.filter((v) => v === 1).length, e = px.filter((v) => typeof v === 'string').length;
  total += px.length; flat += f;
  console.log(a + '+' + b, 'frames', px.length, 'flat', f, 'errors', e, 'minDistinct', Math.min(...px.filter(v=>typeof v==='number')), JSON.stringify(d));
}
console.log('TOTAL frames', total, 'flat', flat);
await browser.close();
