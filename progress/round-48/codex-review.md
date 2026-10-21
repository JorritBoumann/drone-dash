# Round 48: Codex review (read-only, ChatGPT plan, codex-cli 0.163.0)

Scope: the uncommitted round 48 diff (5-parcel shift, tailwind rings, boost regen and nudge). Status: input for the lead and the critic, not a pass or fail.

## Findings

- **Medium — [Game.ts](src/game/Game.ts:2844): Tailwind ring GPU resources leak when the game is disposed.** `TailwindRings` owns an instanced mesh, geometry, and material, and provides `dispose()`, but `Game.dispose()` never calls it. If the game is created and disposed repeatedly in the same page, those GPU resources remain allocated. Call `this.rings.dispose()` during game disposal.

- **Low — [Hud.ts](src/ui/Hud.ts:1210): the results card can overstate flight time on a win.** `payClockLeft()` awards points for `Math.floor(timeLeft)` but leaves the fractional remainder on the clock. The “Flew” calculation subtracts only that floored value, so a win with, for example, 4.8 seconds remaining reports almost one extra second flown. Preserve the exact remaining time in the tally and subtract it from `flown`, or report the duration at consistent whole-second precision.
