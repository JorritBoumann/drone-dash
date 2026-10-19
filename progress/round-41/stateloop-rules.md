# Stateloop platform rules for round 41

Source: `stateloop/games` docs/decisions.md (sections "How games are sourced", "Playing a game", "Gameplay capture") and the `stateloop/canvas-recorder` README at the pinned commit fa76272d219e3385c08c0a42cd4d7426d61d709c. Read on 2026-10-19 by the lead.

## Delivery

- Studios upload a browser-ready ZIP, or grant repository access. One validator handles both.
- The Play Worker serves the entrypoint from a private bucket on another origin, inside a full-screen iframe. Use relative URLs only (Vite `base: './'`).
- The Play Worker injects the capture bridge before the game's own scripts. The entrypoint must have a `<head>`.
- The Worker adds configuration strings and a generated `seed` to the entrypoint query. The game must read `?seed=` and must not break on other query keys.

## Playing

- The game owns the whole screen. The portal shows no HUD.
- The only portal control is an arrow in a 64 px top-left corner. It shows for 3 s at game start. After that it stays faint. If the pointer reaches that corner, it appears again. Keep the game HUD out of that corner.
- A double Escape within 700 ms leaves the game. A single Escape belongs to the game (menus, pointer-lock release). The game must not block or cancel Escape.

## Capture

- The recorder captures the game canvas, the player inputs and optional audio, in rolling 60 s clips. The production minimum clip length is 15 s.
- HTML overlays are not in the video. HUD that matters for the recording must be drawn on the canvas.
- At a natural end, call `window.StateloopSession.complete(detail)` or dispatch a `stateloop:session-complete` custom event. Guard the call, because the object does not exist outside the platform.
- If the game exits instead, the portal completes the session itself.
