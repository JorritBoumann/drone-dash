1. **High — [Game.ts](/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/src/game/Game.ts:2136)**  
   `cornerPush` runs after the marker has been clamped to the screen and checked against touch controls. Near the top-left edge it can push the marker beyond the right or bottom edge, or onto a control; the gate-tag path has the same issue at lines 1653–1656. For example, a marker near the top-left corner on a narrow touch screen can be pushed right into the button cluster. Re-run bounds and obstacle placement after the push, or include the corner in the placement search so the chosen position satisfies every constraint.

2. **Medium — [CanvasHud.ts](/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/src/ui/CanvasHud.ts:523)**  
   When an event label overlaps a panel, the loop moves it below that panel, but never clamps it back to the viewport. On a short screen, or with several stacked panels, the label can end up partly or entirely off-screen. After resolving overlaps, clamp the final `x` and `y` to the viewport, and handle cases where the label cannot fit.

3. **Medium — [CanvasHud.ts](/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/src/ui/CanvasHud.ts:556)**  
   `updateOver` rebuilds panel arrays, queries the DOM, creates a row array and strings, and maps the rows on every render frame while the game-over screen is open. This allocates continuously for a static card. Read and draw the card once per changed key; cache the rows and reuse panel iteration state.

4. **Medium — [CanvasHud.ts](/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/src/ui/CanvasHud.ts:408)**  
   Objective truncation uses `slice` on UTF-16 code units. A name containing a supplementary Unicode character can be cut between its surrogate halves, producing a replacement character. Truncate by grapheme cluster (for example, `Intl.Segmenter`) while measuring the result.

5. **Low — [CanvasHud.ts](/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/src/ui/CanvasHud.ts:382), [Hud.ts](/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/src/ui/Hud.ts:358)**  
   Both width calculations enforce a 120 px minimum even when the available slot is narrower. On a narrow viewport or when the score and right chips leave less than 120 px, the objective pill can still overlap them. Cap the result at the actual available width, and handle a slot too small for the fixed pill contents.

The seed change preserves the sign for safe integers as the README specifies, and the session-complete call remains in `endRun`. I found no game-over-card restart or HUD-off persistence regression in the render path.