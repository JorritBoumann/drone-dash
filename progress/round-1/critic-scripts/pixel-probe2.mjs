import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.addInitScript(() => {
  const orig = window.requestAnimationFrame.bind(window);
  window.__px = [];
  window.requestAnimationFrame = (cb) => orig((t) => { cb(t); try { const c = document.getElementById('game-canvas'); const gl = c.getContext('webgl2'); const buf = new Uint8Array(4 * 16); const out = new Set(); for (let i = 0; i < 9; i++) { gl.readPixels(Math.floor(c.width * (0.1 + 0.1 * i)), Math.floor(c.height * (0.2 + 0.07 * i)), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf); out.add(buf.slice(0, 3).join(',')); } window.__px.push(out.size); } catch (e) { window.__px.push('E' + e.message); } });
});
await page.goto('http://127.0.0.1:5188/'+(process.argv[2]||''), { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.keyboard.press('Enter'); await page.waitForTimeout(500);
await page.evaluate(() => (window.__px.length = 0));
await page.keyboard.down('KeyW'); await page.keyboard.down('Space');
await page.waitForTimeout(3000);
const px = await page.evaluate(() => window.__px.slice());
const d = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__.player.position);
const gpu = await page.evaluate(() => { const gl = document.createElement('canvas').getContext('webgl2'); const e = gl.getExtension('WEBGL_debug_renderer_info'); return gl.getParameter(e.UNMASKED_RENDERER_WEBGL); }); console.log(gpu); console.log('frames', px.length, 'uniform-colour frames (1 distinct of 9 samples):', px.filter((v) => v === 1).length, 'pos', d);
console.log(px.join(''));
await browser.close();
