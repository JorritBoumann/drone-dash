// Round 10 builder: music on each screen. Title (before / after the first press), run, game over; 10 s on each,
// sampling audio.music every 0.5 s. Also checks the music toggle survives a reload. MOBILE=1 for iPhone 13 landscape.
import { chromium, devices } from '@playwright/test';
const OUT = new URL('../builder-shots/', import.meta.url).pathname;
const MOBILE = !!process.env.MOBILE; const P = MOBILE ? 'm' : 'd'; const HOLD = Number(process.env.HOLD || 10);
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://127.0.0.1:5188/?seed=22', { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
const mus = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__THREE_GAME_DIAGNOSTICS__.audio)));
const chip = () => page.evaluate(() => { const b = document.getElementById('music-toggle'); const r = b.getBoundingClientRect(); return { state: b.dataset.state, text: b.innerText.trim(), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), vis: getComputedStyle(b).display !== 'none' }; });
const shot = (n) => page.screenshot({ path: OUT + `${P}-${n}.jpg`, type: 'jpeg', quality: 80 });
console.log('BEFORE ' + JSON.stringify({ audio: await mus(), chip: await chip() }));
await shot('01-title-before-press');
// first press: a tap / click on empty sky (not the Play button)
if (MOBILE) await page.touchscreen.tap(60, 200); else await page.mouse.click(60, 400);
const sample = async (label) => { const out = []; for (let i = 0; i < HOLD * 2; i++) { await page.waitForTimeout(500); const a = await mus(); out.push(a); } const m = out.map((a) => a.music); const ok = m.every((x) => x.playing && x.gain > 0); console.log(label + ' ' + JSON.stringify({ state: out[out.length - 1].state, allPlaying: m.filter((x) => x.playing).length + '/' + m.length, minGain: Math.min(...m.map((x) => x.gain)), track: [...new Set(m.map((x) => x.track))], section: [...new Set(m.map((x) => x.section))], layer: [...new Set(m.map((x) => x.layer))], intensity: m[m.length - 1].intensity, late: m[m.length - 1].late, resyncs: m[m.length - 1].resyncs, notes: m[m.length - 1].notes, ok })); return ok; };
const t1 = await sample('TITLE'); console.log('CHIP ' + JSON.stringify(await chip())); await shot('02-title-music-on');
await page.keyboard.press('Enter'); await page.waitForTimeout(300);
const t2 = await sample('RUN'); await shot('03-run');
await page.evaluate(() => window.__GAME__.end()); await page.waitForTimeout(200);
const t3 = await sample('OVER'); console.log('CHIP-OVER ' + JSON.stringify(await chip())); await shot('04-over');
// toggle: click the chip -> off, reload -> still off, M key -> on, reload -> on
await page.click('#music-toggle'); await page.waitForTimeout(300);
const off1 = await mus(); console.log('TOGGLED ' + JSON.stringify({ enabled: off1.music.enabled, playing: off1.music.playing, gain: off1.music.gain, chip: await chip(), stored: await page.evaluate(() => localStorage.getItem('drone-dash-music-v1')) }));
await shot('05-over-music-off');
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1000);
if (MOBILE) await page.touchscreen.tap(60, 200); else await page.mouse.click(60, 400);
await page.waitForTimeout(800);
const off2 = await mus(); console.log('RELOAD-OFF ' + JSON.stringify({ enabled: off2.music.enabled, playing: off2.music.playing, chip: await chip() }));
await shot('06-title-after-reload-off');
await page.keyboard.press('KeyM'); await page.waitForTimeout(800);
const on3 = await mus(); console.log('M-KEY ' + JSON.stringify({ enabled: on3.music.enabled, playing: on3.music.playing, chip: await chip() }));
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1000);
const on4 = await page.evaluate(() => localStorage.getItem('drone-dash-music-v1'));
console.log('RELOAD-ON ' + JSON.stringify({ stored: on4, chip: await chip() }));
// pause screen chip position
if (MOBILE) await page.touchscreen.tap(60, 200); else await page.mouse.click(60, 400);
await page.keyboard.press('Enter'); await page.waitForTimeout(600); await page.evaluate(() => window.__GAME__.pause()); await page.waitForTimeout(400);
console.log('PAUSE-CHIP ' + JSON.stringify(await chip())); await shot('07-paused');
console.log('RESULT ' + JSON.stringify({ title: t1, run: t2, over: t3, toggleRemembered: !off2.music.enabled && on4 === '1', errors }));
await browser.close();
