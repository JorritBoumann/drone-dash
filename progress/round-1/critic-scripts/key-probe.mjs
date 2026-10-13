import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';
const OUT = new URL('../critic/', import.meta.url).pathname;
function variety(buf){const p=PNG.sync.read(buf);const set=new Set();for(let y=120;y<640;y+=8)for(let x=0;x<p.width;x+=8){const i=(y*p.width+x)*4;set.add((p.data[i]>>3)+','+(p.data[i+1]>>3)+','+(p.data[i+2]>>3));}return set.size;}
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.keyboard.press('Enter'); await page.waitForTimeout(800);
const css = () => page.evaluate(() => { const g = (id) => { const e = document.getElementById(id); const s = getComputedStyle(e); return `${id}:op=${s.opacity},bg=${s.backgroundImage.slice(0,40)}|${s.backgroundColor}`; }; return [g('speed-lines'), g('hit-flash'), 'boosting=' + document.getElementById('boost-fill').className].join(' '); });
for (const [name, keys] of [['none', []], ['W', ['KeyW']], ['W+Space', ['KeyW', 'Space']], ['W+E', ['KeyW', 'KeyE']], ['none2', []]]) {
  for (const k of keys) await page.keyboard.down(k);
  const vs = [];
  for (let i = 0; i < 8; i++) { await page.waitForTimeout(150); vs.push(variety(await page.screenshot())); }
  console.log(name, vs.join(','), await css());
  if (name === 'W+E') await page.screenshot({ path: OUT + 'probe-boost-held.png' });
  for (const k of keys) await page.keyboard.up(k);
  await page.waitForTimeout(800);
}
await browser.close();
