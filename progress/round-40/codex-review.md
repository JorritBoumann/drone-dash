## Findings

**P2 — Slow motion still changes slipstream score and clock rewards.** [Game.ts](/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/src/game/Game.ts:830), [Game.ts](/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/src/game/Game.ts:1738)

During hit-stop or slow motion, `updateSlipstream(dt)` passes the scaled delta to `Slipstream.update`, which uses it to fill the payout meter and advance chain timers. The slow-clock reward at line 1747 also uses that scaled delta. A player drafting through a hit therefore earns score and clock time more slowly in real seconds, even though the change says the scale should affect motion and effects only.

Separate elapsed-time economy updates from movement-based progress: use `realDt` for payout and clock timing, while keeping distance or route progress based on the scaled movement. This needs care so slow motion cannot award progress for distance the drone hasn’t flown.

I found no minimap rotation or mirroring error: the mapping sends the drone’s forward vector to screen-up and world-right to screen-right. I also found no concrete canvas state leak, per-frame layout read, duplicate minimap, or M/N binding conflict.