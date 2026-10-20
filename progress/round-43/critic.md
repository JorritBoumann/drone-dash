# Drone Dash: round 43 critic report

**Verdict:** Yes for the Vercel link and yes for the platform upload. The round 42 blocker is fixed and every check passes. One visible flaw is left: on iPhone the music button covers the last digit of the first score row on the game-over card. I recommend a one-line fix before the upload, but it breaks no platform rule.

## Setup

- My servers were on 5191, 5193, 5194 and 5195. 5191 is dev, with its own Vite cache and no HMR. 5193 serves `dist/` at the root, as Vercel does. 5194 serves `dist/` under `/nested/game/`. 5195 is the outer page on `localhost`, a different origin. I stopped all four. The owner's server on 5188 is still running.
- Every browser job ran alone, one after the other (`queue43c.sh`, `jobs43c.txt`). GPU: Apple M5 (`gpu43c.log`).
- I did not read `builder.md`.

## Results 1 to 6

### 1. The 64 px corner: pass

Method: `play43c.mjs` with my new sampler `sampler43c.js`. The video pilot plays a full real-time run to its natural end. The corner box is 64 px plus the safe-area inset, read from `env()`. Every frame checks the nav marker, the gate tag, the pops, the HTML game-over card and every canvas panel. Every third frame scans every painted element. I fixed the round 42 sampler gap: now only boxes that cover 98% of the screen both ways are skipped, and the game-over card is always checked.

| Run (full run to game over) | Frames | In the corner | Card left edge at rest |
|---|---|---|---|
| iPhone 13 + safe area (corner 111 x 64), seed 22, HTML / canvas | 14,878 / 16,093 | 0 / 0 | x 123 / 123 |
| iPhone 13 + safe area, seed 130, HTML / canvas | 13,364 / 13,250 | 0 / 0 | x 123 / 123 |
| Pixel 7, seed 22, HTML / canvas | 14,993 / 16,157 | 0 / 0 | x 166 / 99 |
| Pixel 7, seed 130, HTML / canvas | 13,363 / 13,250 | 0 / 0 | x 166 / 166 |
| 915x412, seed 22, HTML / canvas | 14,881 / 16,094 | 0 / 0 | x 192 / 125 |
| 915x412, seed 130, HTML / canvas | 13,369 / 13,222 | 0 / 0 | x 192 / 192 |

- Total: 172,914 frames, 3,994 of them on the game-over screen. **0 frames in the corner.**
- Long high-scoring run: iPhone seed 22 canvas scored 6,574 with 5 deliveries. That is the round 42 failing case. The card now starts at x 123, clear of the 111 px box.
- Safe area: the score panel moved with the inset. It is no longer in the 111 px box on any frame.
- Forced long card (`overcard43c.mjs`): I made the card longer than any real result: 8 rows with long labels, a 7-digit score and a very long time line. I used 6 screens: iPhone with and without the safe area, iPhone upright with the safe area, Pixel 7, 915x412 and desktop. Each ran with the HTML and the canvas HUD, on every frame of the entry animation. **0 frames in the corner and 0 frames off screen** in all 12 cases (`overcard43c-*.jpg`).
  - Side note: a 7-digit score is wider than its column and runs into the rows. Real scores are 4 digits, so a player never sees this.
  - On a phone held upright, the forced card also scrolls sideways a little. Players hold the phone sideways for this game.
- Canvas card: the game uploads it once at game over. In the next second there were 0 more uploads, in all 6 canvas runs. My content change caused exactly one redraw, then 0. The per-frame rebuild is gone.

### 2. Markers and event labels: pass

- Markers (nav diamond, arrow, distance pill, gate tag pill and arrow): 168,904 frames with a marker, 24,795 of them with a gate tag. **0 frames off screen. 0 frames touching the stick (with its "Fly" label) or the button cluster. 0 frames touching any single button.**
- Event labels (HTML pops and the canvas event panel): 66,663 frames with a label. **0 frames off screen.**
- Overlaps between labels, the objective pill and the score panel: 0 frames. 2 frames had a gap under 2 px (HTML, iPhone). That is not an overlap.
- Canvas centre-message scale during fade-in: 9,570 samples, 0 wrong.
- Emoji names (`emoji43c.mjs`, from the dev server): 1,574 cut widths over 8 names with emoji, ZWJ families, flags, skin tones and accents. 0 bad cuts, both with `Intl.Segmenter` and with the fallback. No lone surrogates, every cut on a grapheme boundary, every result fits.

### 3. Phone hull probe: the builder is right, it was a probe error

- The cause: `G.waterShown()` returns the swell relative to `WATER_Y` (-0.7 m, `src/world/Water.ts:16`). `boat.water` is absolute (`Boats.ts:490`). The round 35 probe compared the two directly. So every ray "hit the water" 0.7 m too high, and the hit points landed short of the real sea.
- Old flagged frames: I reran the old probe on 5 sail views of seed 130 and looked at the marked pixels. Two views had a leak: `hw43c-raw-m-golden-sail-very-close-M.jpg` (4,371 px) and `hw43c-raw-m-golden-sail-side-M.jpg` (494 px). In both, the green "leak" is open sea behind the boat. The mast, the boom and the far gunwale frame it. It is not water inside the hull. The normal frame (`hw43c-raw-m-golden-sail-very-close.jpg`) shows a clean dry deck.
- Corrected probe (`hull43c.mjs`): phone, seeds 130 and 22, all boat kinds, 24 sweep steps for sails. **Sea showed in a hull in 0 of 122 views and 0 of 432 sweep frames.** One sweep frame had 6 stray pixels in the core zone, with no enclosed patch.
- Positive control (lids off): 46 of 122 views and 242 of 432 sweep frames show sea in a hull (`hw43c-fix-m-golden-sail-into-hull-M0.jpg`). This proves the corrected probe still finds real leaks.

### 4. Music button on the game-over card: a player would notice

- On iPhone the "Music on" button sits on the card's top-right corner. It covers the last digit of the first breakdown value: "+1,866" reads "+1,86" (`music-over-card-iphone-s22-html-safe.jpg`). It is the first thing on the right side of the results, so a player will see it.
- Overlap on a real card: 971 px² on iPhone with the safe area, 180 px² without it. 0 on Pixel 7, 915x412 and desktop. With a long card it also overlaps on Pixel 7 (1,814 px²) and 915x412 (733 px²).
- It is the same in canvas HUD mode, because the HTML card still shows on the page. The recording (canvas card) is not affected.
- Simple fixes: hide the music button on the game-over screen. Or give `#over-screen` a top padding of about 60 px on wide screens, so the card starts below the button.

### 5. Release smoke test: pass

| Check | Result |
|---|---|
| Nested path in a cross-origin iframe, `?seed=22&slLaunch=x` | 0 failed requests, 0 HTTP errors, 3 requests per load, 0 page errors, 0 console errors. Desktop and phone. |
| Playable | A real click on Play, then W moved the drone 31.6 m. On iPhone a real tap, then a full pilot run: 4 deliveries, Silver, 5,289. |
| Session complete with the mock | Exactly 1 call per run: 1 after run 1, 2 after run 2, still 2 after an abandoned run. Phone detail: score 5,289, Silver, tier 2, 4 deliveries, seed 22, 119.3 s. |
| Without the mock | 0 errors. The `stateloop:session-complete` event still fired once per run. |
| Escape | A single Escape pauses, a second resumes. 0 preventDefault or stopPropagation calls on Escape. |
| Seed parity, iframe build vs dev | Same sites and the same first pickup. |
| Cold-load flash (`fouc43c.log`) | 0 bad frames, at the root and in the iframe, desktop and iPhone. Styled from the first frame. |
| Root path (5193, as Vercel serves `dist/`) | 0 failed requests and 0 page errors, desktop and iPhone. The only console lines are 4 Chrome autoplay warnings, not errors. The HTML HUD shows. |

### 6. Quick regressions: pass

| Check | Result |
|---|---|
| Flat-frame probe, bloom on | 877 frames, 0 flat, 0 errors |
| Crash-classify, 12 m, seeds 22, 58, 130 | 19 charged crashes in 168 s, 0 hop-like. **0 pad lip**: the 3 crashes near a target hit walls 7.4 to 13.5 m tall. The pad is at 0.4 m. |
| Street medal gate, seed 22 | 6,012, Gold. The rows sum to 6,012. That matches the shown total, the big score and the game's score. |
| Perf, no frame cap, p95 normal / rush | Desktop 7.6 / 7.3 ms. iPhone HTML HUD 5.6 / 4.9 ms. iPhone canvas HUD 3.6 / 3.5 ms. All under 12 ms. |
| `npm run build` | tsc clean, built in 0.32 s, no chunk warning. The largest chunk is three.js at 588 kB, under the 900 kB limit set in `vite.config.ts`. |

## Release verdicts

- **(a) Vercel link: yes.** It loads clean at the root with no console errors, plays on desktop and phone, and perf is well inside budget.
- **(b) Platform upload: yes.** No blockers. The corner stays clear in every run, safe area included. Markers and labels stay on screen and off the controls. The session call fires once per run. The nested cross-origin build loads clean.
  - Recommended before upload (not a blocker): move or hide the music button on the game-over card (item 4).
  - As in round 42: leave the `.map` files out of the platform ZIP unless you want the source public.

## Files

- Scripts and logs in `progress/round-43/critic-scripts/`.
  - New: `play43c.mjs`, `sampler43c.js`, `sum43c.py`, `overcard43c.mjs`, `emoji43c.mjs`, `hull43c.mjs`, `medal-journey43c.mjs`, `dev43c.mjs`, `queue43c.sh`, `jobs43c.txt`.
  - Copied from round 42 and earlier, with only output folders changed: `platform41c*.mjs`, `root42.mjs`, `fouc42.mjs`, `acceptance-probe.mjs`, `crash-classify-v.mjs`, `perf-street41.mjs`, `gpu41c.mjs`, `serve42.mjs`, `video-pilot39c.js`.
- Screenshots in `progress/round-43/critic/` (16 JPEGs): `over-*.jpg` (end of full runs), `overcard43c-*.jpg` (forced long card), `music-over-card-iphone-s22-html-safe.jpg`, `hw43c-*.jpg` (hull probe), `plat-phone-*.jpg`, `root-*.jpg`.
