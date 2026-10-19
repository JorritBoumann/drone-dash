# Drone Dash: round 42 critic report

**Verdict:** Yes for the Vercel link. No for the platform upload yet: after a long run on an iPhone, the HTML game-over card goes into the 64 px top-left corner.

## Setup

- My servers were 5191 (dev, my own Vite cache, no HMR), 5193 (`dist/` at the root, as Vercel serves it), 5194 (`dist/` under `/nested/game/`) and 5195 (the outer page on `localhost`, a different origin, with a device-width viewport). I stopped all four. I did not touch the owner's server on 5188.
- `npm run build`: tsc was clean, the build took 0.3 s, and there was no chunk warning (`critic-scripts/build42c.log`). The largest chunk is three.js at 588 kB.
- Every browser job ran alone, one after the other (`queue42c.sh`, `jobs42c.txt`). The GPU was the real Apple M5 (`gpu42c.log`).
- I did not read `builder.md`.

## Results 1 to 5

### 1. The 64 px corner

Method: `play42.mjs` with `sampler42.js`. The video pilot plays a full real-time run to its natural end. On every frame the sampler checks the nav marker, the gate tag, the pops and the canvas HUD panels against the corner. Every third frame it checks every painted element on the page. The corner box is 64 px plus the safe-area inset, read from `env()`.

| Run (full run to game over) | Frames in play and on game over | Frames in the corner |
|---|---|---|
| iPhone 13, seed 22, HTML HUD | 14,878 | 0 |
| iPhone 13, seed 22, canvas HUD | 16,153 | 2 (game-over card, see below) |
| iPhone 13, seed 130, HTML / canvas | 13,365 / 13,369 | 0 / 0 |
| 915x412, seed 22, HTML / canvas | 14,866 / 14,843 | 0 / 0 |
| 915x412, seed 130, HTML / canvas | 13,323 / 13,306 | 0 / 0 |
| Pixel 7 (863x360), seed 22, HTML / canvas | 14,878 / 14,885 | 0 / 0 |

- During play: **pass**. 0 frames in all 10 runs, in both HUD modes. The round 41 marker problem is fixed.
- On the game-over screen: **fail**. The iPhone seed 22 run had 5 deliveries and a long time line ("56 s start +46 s drops ... −3 s 1 crash"). That made the HTML game-over card 670 px wide. At rest its top-left corner is at x 40, y 32 (`blocker-overcard-corner-iphone-s22.jpg`, `over-iphone-s22-canvas.jpg`). It stays there for the whole game-over screen. Only blank card shows in the corner, but it is in the corner.
  - My sampler counted only 2 frames. Its filter for full-screen effects also skipped this wide card. So I measured the card in the final screenshots of all runs. Only this run had it in the corner. The other runs had cards starting at x 107 (iPhone) and x 163 to 189 (Pixel, 915x412).
  - The card CSS did not change in round 42. This is old and was missed before, because earlier corner checks ended runs with a score of 0 (a short card).
  - The canvas copy of the card is fine. It is drawn at x 72 or more.
- Safe area (extra check, `SAFE=1`, CDP inset emulation of iPhone landscape: 47 left, 47 right, 21 bottom). The corner box grows to 111 x 64. The score panel stays at x 76, so it is in that box on every frame, in both HUD modes (`safe-area-score-corner-iphone.jpg`). The game's own `Hud.cornerBox()` adds the inset, but the score panel position does not. This matters only if the portal moves its arrow by the safe area. On Vercel there is no arrow.

### 2. Canvas centre messages keep their size

**Pass.**
- Per frame, in all 5 canvas runs: 7,370 samples in the first 400 ms of a message. The mesh scale always matched the planned value (0.90 growing to 1.00). The lowest value was 0.900 and there were 0 wrong samples.
- In the canvas-only recordings, the frame strips show the label growing slightly and then holding its size. It never shrinks (`rec42-desk1-s22-fadein-strip.jpg`, `rec42-phone-s130-fadein-strip.jpg`).

### 3. Seeds

**Pass** (`seeds42c.log`, production build).
- `22` gives city 22 and `-22` gives city 4294967274. Their mood and sites differ: Bright morning against Hazy noon.
- `4294967274` gives the same city as `-22`. `4294967318`, `022` and `" 22 "` all give city 22. `-5` and `5` now differ.
- Past 2^53, the number is hashed to a fixed city. Text (`abc`, a uuid, `22.7`) gives a fixed city from 10000 to 99999. An empty seed gives a random city.
- Every value gave the same city twice and 0 errors. The README seed section matches what the game does. The game-over card shows "City 22".

### 4. Overlaps on phones

**Pass.**
- 0 overlap frames and 0 near-touches (gap under 2 px) between event labels, the objective pill and the score panel. That held in all 10 phone runs, in both HUD modes.
- Medal pops against the drone's screen box: 0 of 2,780 samples over 10 runs. I could not reproduce the builder's 12 of 281. Even if it happens now and then, a medal pop is up for about 1 s, so a player would hardly notice.

### 5. Canvas-only recording shows the game-over card

**Pass** (`rec42c.mjs`, `canvas.captureStream(30)` to WebM).
- Desktop 1280x720 at seed 22, and iPhone at seed 130. The last frame of each recording shows TIME'S UP, the medal, the score, the breakdown and "City seed N" (`rec42-desk1-s22-lastframe.jpg`, `rec42-phone-s130-lastframe.jpg`).
- The score on the canvas matches the HTML card (1,196 and 1,436).

## Items the builder did not run

| Check | Result |
|---|---|
| Phone hull probe, seeds 130 and 22 (`hull42-m.log`, sweep 24) | **Not zero.** Sea showed in a hull in 18 of 122 views and in 16 of 864 sweep frames (1.9%), up to 3,934 px. It is almost all sail boats. With the caps off, it is 49 views and 438 frames, so the caps still remove most of it. Round 40 (phone, sweep 2) had 6 views and 5 frames. The boat and water code did not change. This is the old residual, not a regression. I did not look at the frames themselves. |
| People on active pads, 4 seeds, 48 legs (`padpeople42.log`) | Pass. 0 of 1,536 samples, by the game's count and by my own. |
| Harbour perf, no frame cap (`perf-harbour42-*.log`) | Pass. Desktop p95 8.1 ms overall: marina 9.3, sail 7.2, rib 7.4, ferry 9.1. Ferry-follow had 3 frames over 20 ms, the worst 32 ms. Phone p95 4.0 ms overall, marina 3.9 ms. |

## Release smoke test

| Check | Result |
|---|---|
| Nested path in a cross-origin iframe, `?seed=22&slLaunch=x&foo=bar` | Pass. 0 failed requests and 0 HTTP errors. 3 resource requests per load. 0 page errors and 0 console errors. |
| Playable | Pass. A real click on Play, then W moved the drone 31.6 m on desktop. A real tap on the phone, then a full pilot run: 4 deliveries, Silver, 5,289. |
| Session complete with the mock | Pass. Exactly 1 call per run: 1, then 2 after run 2. An abandoned run added 0. The phone detail was sensible: `{score 5289, medal Silver, medalTier 2, deliveries 4, seed 22, cityMode "seed", runSeconds 119.3, run 1}`. |
| Without the mock | Pass. 0 errors. The `stateloop:session-complete` event still fired once per run. |
| Escape | Pass. A single Escape pauses and a second one resumes. A double Escape had 0 preventDefault or stopPropagation calls. |
| Cold-load flash (`fouc42.log`) | Pass. 0 bad frames, at the root and in the iframe, on desktop and iPhone. Styles were on from the first frame. |
| Seed parity, iframe build against dev | Pass. The same sites and the same first pickup. |
| Root path (5193, as Vercel serves `dist/`) | Pass. 0 failed requests and 0 page errors, desktop and iPhone. The only console lines are 4 Chrome autoplay warnings ("AudioContext was not allowed to start"). These are not errors. The HTML HUD shows: no `canvas-hud` class, and the score, timer, objective, minimap and boost meter are visible. |

README controls table against real input (`root42.log`, `root42-phone.log`):
- Desktop: every row works. W and the arrows fly and turn. Space climbs, and Shift and C descend. E and a left click boost. A right-drag orbits the camera. The mouse wheel zooms. M toggles the map, N the music, and Escape and P pause.
- Phone: the stick, the Up, Down and Boost buttons, and a one-finger look all work. Pinch does nothing ("Not available" is right). The pause button works.
- **Mismatch:** the README says "Map button" for phones. There is no map button, and tapping the minimap does nothing. So phones cannot turn the map off.
- **Note:** the phone music button exists only on the title and pause screens, not during play. It works there.

## Regressions

| Check | Result |
|---|---|
| Flat-frame probe, bloom on | 940 frames, 0 flat, 0 errors |
| Crash-classify, 12 m, seeds 22, 58 and 130 | 16 charged crashes in 176 s. **0 pad lip**: the 6 crashes near a target all hit walls 7 to 14 m tall, and the pad is at 0.4 m. 0 hop-like. |
| Round 41 fixes (platform calls, Escape, seed parity) | Still pass. |

I found no new regressions from round 42.

## Perf (no frame cap)

| | Desktop 1280x720 | iPhone 13 |
|---|---|---|
| Street, HTML HUD, p95 normal / rush | 7.4 / 7.8 ms | 5.7 / 5.1 ms |
| Street, canvas HUD, p95 normal / rush | not rerun (round 41: 5.0 / 5.9) | 3.5 / 3.6 ms |
| Harbour, p95 | 8.1 ms | 4.0 ms |
| Draw calls, max | 114 | 101 |
| Triangles, max | 401k | 369k |

Every p95 is under 12 ms.

## Release verdicts

- **(a) Vercel link for colleagues: yes.** It loads clean at the root and plays on desktop and phone. The HTML HUD shows, there are no console errors, perf is well inside budget and there is no unstyled flash. Before sharing, fix the README phone "Map button" row (docs only).
- **(b) Platform upload: no.** One blocker:
  1. **Game-over card in the 64 px corner on iPhone** (at x 40, y 32), when the result has 5 breakdown rows and a long time line. Keep `.over-card` clear of the corner. For example, cap its width at `calc(100vw - 2 * (64px + 12px))`, or wrap the time line so the card stays narrow. Then check a long-run card at 750x342.
- Also before upload (not blockers):
  2. Decide the safe-area case. If the portal draws its arrow inside the safe area on notched phones, move the score panel to `max(76px, env(safe-area-inset-left) + 76px)`. That matches `Hud.cornerBox()`.
  3. Sea in sail-boat hulls: about 2% of close harbour frames. It is unchanged since round 40.
  4. Leave the `.map` files out of the platform ZIP unless you want the source public.

## Files

- Scripts in `progress/round-42/critic-scripts/`:
  - New: `play42.mjs` with `sampler42.js`, `rec42c.mjs`, `fade42.py`, `seeds42c.mjs`, `root42.mjs`, `fouc42.mjs`, `overcard42.mjs`, `sa42.mjs` and `serve42.mjs`.
  - Copied from round 41 and earlier, with only the output folders changed.
  - Logs sit next to them.
- Screenshots in `progress/round-42/critic/` (19 JPEGs):
  - `blocker-overcard-corner-iphone-s22.jpg`, `safe-area-score-corner-iphone.jpg`
  - `over-*.jpg` (game-over at the end of the full runs)
  - `rec42-*-lastframe.jpg`, `rec42-*-fadein-strip.jpg`, `rec42-desk1-s22-over-page.jpg`
  - `plat-*.jpg`, `root-*.jpg`, `safe-*.jpg`
