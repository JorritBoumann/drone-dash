## Findings

1. **P1 — Centre messages shrink on every frame**  
   [CanvasHud.ts](/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/src/ui/CanvasHud.ts:486)  
   While a message is in its first 160 ms, `multiplyScalar(s)` scales the mesh again on every frame. A message can rapidly become tiny or disappear before its fade-in completes. Set the scale from the panel’s base dimensions each frame instead of multiplying its current scale.

2. **P2 — Negative and positive numeric seeds collide**  
   [cities.ts](/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/src/game/cities.ts:56)  
   `?seed=-22` and `?seed=22` both resolve to seed `22`, so distinct query inputs produce the same city and run. Preserve the sign when normalizing numeric seeds, or define and document a canonical numeric seed format that rejects negatives.

I found no remaining time-scale path that changes run clocks, delivery timers, or rewards based on slowed elapsed time. The platform completion call is guarded against a missing bridge, and Escape is not prevented by the game.