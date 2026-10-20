// Round 45 critic: control for the autoplay flag. A bare page (no game) makes an AudioContext with no gesture: what state?
// Then the game page: is the context running and is sound rendered before any gesture (title music)?
import { chromium } from '@playwright/test';
for (const args of [[], ['--autoplay-policy=user-gesture-required'], ['--autoplay-policy=document-user-activation-required']]) {
  const b = await chromium.launch({ channel: 'chromium', args });
  const p = await (await b.newContext()).newPage();
  await p.setContent('<html><body>x</body></html>');
  const bare = await p.evaluate(async () => { const c = new AudioContext(); await new Promise((r) => setTimeout(r, 300)); return c.state; });
  const ua = await p.evaluate(() => navigator.userActivation ? navigator.userActivation.hasBeenActive : null);
  await p.goto('http://127.0.0.1:5197/?seed=22', { waitUntil: 'load' }); await p.waitForTimeout(2500);
  const g = await p.evaluate(() => { const d = window.__THREE_GAME_DIAGNOSTICS__; return { actx: d.audio.state, playing: d.audio.music.playing, ua: navigator.userActivation.hasBeenActive }; });
  console.log(JSON.stringify({ args, bareContextState: bare, bareUserActivation: ua, game: g }));
  await b.close();
}
