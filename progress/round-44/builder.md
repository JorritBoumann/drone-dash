# Drone Dash: round 44 builder report

Three small fixes from round 43 (critic item 4, Codex medium, Codex low). Nothing else changed. The bloom clamps in `ObjectiveMarker.ts`, the `#app` visibility rule (index.html + styles.css) and the debug hooks are untouched.

## Fixes

1. **Music toggle on the game-over card** (`src/styles.css`). On the game-over screen the toggle is now a round icon-only chip, 34 x 34 px (`#app[data-state='over']`). The label is still in the button for screen readers (clipped off screen, not removed). Why this works on every screen: the card already keeps 76 px plus the safe-area inset free on both sides (wide screens) or above and below (tall screens). The chip sits 16 px (or the inset) from the edge. It is 34 px wide. So it ends at least 26 px before the card. The card layout itself is not changed, so the corner-box results from round 43 still hold.
2. **Objective pill on very narrow layouts.**
   - Canvas HUD (`src/ui/CanvasHud.ts`, `drawObjective`): if the slot is too narrow for the fixed parts, they drop in steps. First the distance goes (as before). Then the verb goes; the dot colour still shows pick up or drop. Then the rush chip shrinks to the number. Then the rush chip goes. The drawn width is capped at the slot. If the slot cannot fit even the dot, nothing is drawn (`objW` = 0).
   - HTML HUD (`src/ui/Hud.ts` `fitObjective` + `src/styles.css`): the same steps, set by a `data-fit` level from 0 to 5. Level 1 drops the verb. Level 2 drops the bonus chip and keeps only the rush number. Level 3 drops the rush chip. Level 4 shows the dot alone with tighter padding. Level 5 hides the pill (`visibility: hidden`, so the canvas HUD still gets its box). The code stops at the first level where the pill fits its limit with at least a short name. `.objective` now has `overflow: hidden`, so no child can paint outside the pill. `setObjective`, the rush on/off change and the bonus chip on/off change refit the pill on the next frame, not 300 ms later.
3. **Placement fallback** (`src/game/Game.ts`, `placeSearch`). The `last` fallback is gone. That fallback only checked the screen and the corner. Now the search returns the start spot or an edge spot that is on screen and clear of the corner and the touch controls. If no spot passes, it returns `null`. Then `updateNav` hides the nav marker for that frame (`setNav(..., false)`), and the gate tag code hides the tag (`ok = false`).

## Numbers

All browser jobs ran one at a time (`jobs44.sh`, `queue44.log`). My servers: 5191 (dev, own Vite cache, no HMR), 5193 (dist at the root), 5194 (dist under `/nested/game/`), 5195 (cross-origin outer page). I stopped all four at the end. The owner's server on 5188 was never touched.

| Check | Result |
|---|---|
| Game over after a full real run, iPhone 13 + safe area, seed 22, HTML / canvas (`play44.mjs` + `digits44.js`) | Score 5,671, 4 deliveries. Toggle 669..703, card 123..627: **0 px² overlap**. 24 of 24 digits visible: 0 under the toggle, 0 covered (elementFromPoint), 0 outside the card. Round 43: 971 px². |
| Game over after a full real run, 915x412, seed 130, HTML | Score 4,712. 0 px² overlap, 27 of 27 digits visible. |
| Game over, natural card (`over44.mjs`): iPhone ± safe area, Pixel 7, 915x412, iPhone upright + safe area, desktop 1280x720, desktop 900x560, iPhone SE 568x320, HTML and canvas | **0 px² overlap in all 16 cases**, also with the toggle forced to "Tap for sound" (locked) and "Music off". Every natural-card digit visible on all of these except iPhone SE (see the note below). |
| Forced long card (critic's 7-digit, 8-row card), same screens | 0 px² overlap with the toggle in every case. 0 frames in the corner and 0 off screen (16 of 16). Some digits are not in view. They sit below the fold of the scrolling card, or they are in the 7-digit score, which is wider than its column. The critic already called the 7-digit case unrealistic. |
| Narrow pill (`pill44.mjs`), 3 s per frame, natural and stressed (long name + rush chip + bonus chip) | 568x320: HTML pill is the dot only (fit 4, 26-28 px wide), canvas pill 99-103 px wide. **0 frames outside the slot, 0 frames with a child poking out**, both modes. 667x375: fit 1-2, 0 out. 480x320: fit 5, hidden in both modes (0 out). Desktop: fit 0, unchanged. Before the fix, at 568x320 the verb poked out of the HTML pill on every frame. At 480x320 the HTML pill sat over the score panel on every frame. |
| Markers over 3 full phone runs (iPhone safe HTML, iPhone safe canvas, 915x412) | 42,096 frames with a marker, 7,109 with a gate tag. **0 off screen, 0 on the stick or the button cluster, 0 on any button.** |
| Corner box over those runs | 43,101 frames, **0 in the corner**, 0 game-over frames in the corner. |
| Flat-frame probe | 760 frames, 0 flat, 0 errors |
| Release smoke test (`?seed=22&slLaunch=x`, nested path in a cross-origin iframe) | 0 failed requests, 0 errors, 0 console lines, 3 requests per load. Mock: 1 call after run 1, 2 after run 2, still 2 after the abandoned run. Phone: a real tap, then a full run gave 1 call (5,290, Silver, 4 deliveries). Without the mock: 0 errors, and the event fired once per run. Seed parity with dev: same. |
| p95, no frame cap, normal / rush | Desktop 8.3 / 7.7 ms. iPhone HTML HUD 5.4 / 4.9 ms. iPhone canvas HUD 3.5 / 3.5 ms. All under 12 ms. |
| `npm run build` | tsc clean, built in 0.32 s, no chunk warning. three.js 588 kB is the largest chunk. |

## Note, not fixed (out of scope)

On an iPhone SE held sideways (568x320), the game-over card itself is too narrow for its two columns. The short-screen layout has a minimum of 160 + 250 px plus gap and padding, and the card has 416 px. So the breakdown values run past the card's right edge, and the card scrolls sideways. This is not the toggle: it is 0 px² from the card, and the digits are cut by the card's own edge. It also happened before this round. A small fix: drop the `min-width` of `.over-head` and `.over-body` (and narrow the gap) at `max-width: 640px` in the short-screen block. I left it alone because the brief was these three fixes only.

## Files changed

- `src/styles.css`: the icon-only music chip on game over, the `data-fit` levels and `overflow: hidden` for `.objective`
- `src/ui/Hud.ts`: the `fitObjective` step-down, and a refit on objective, rush and bonus changes
- `src/ui/CanvasHud.ts`: the `drawObjective` compaction, and the width capped at the slot
- `src/game/Game.ts`: `placeSearch` returns `null` instead of an unsafe spot, and `updateNav` and the gate tag hide on `null`

Scripts and logs are in `progress/round-44/builder-scripts/`. New: `pill44.mjs`, `over44.mjs`, `play44.mjs`, `digits44.js`, `jobs44.sh`. The rest are copied from round 43, and the only change is the Vite cache path in `dev43c.mjs`. Screenshots are in the scratchpad `b44/shots/`.
