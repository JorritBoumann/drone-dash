# Round 40: Gemini Argon review of the Codex minimap

Model: Gemini 4 Argon, thinking level High, in the Gemini app on Jorrit's Pro account, 2026-10-19. The full answer is in his Gemini history.

Input: `src/ui/Minimap.ts` and the integration diff from the branch `codex/minimap` (folder `games/drone-dash-codex-minimap`).

Status: a second opinion on the competing minimap. The lead sent the pitfalls to the Claude builder of round 40. The critic uses this file to compare both minimaps.

## Bugs found (Gemini)

1. Critical. The city layer and the markers rotate in opposite directions, and left and right are mirrored. With the drone facing east, a target dead ahead shows at 12 o'clock, but the street ahead shows at 6 o'clock.
2. Critical. A new city or restart creates a second minimap. The old canvas stays on screen, frozen, and its resize listener and its 4 MB static bitmap leak.
3. High. On desktop the code uses the touch layout during play. In some layouts the chosen spot is below the bottom of the screen, so the minimap is invisible.
4. High. Alleys are drawn on the middle of the main streets, not through the blocks.
5. High. Every frame runs about 10 `querySelector` and 10 `getBoundingClientRect` calls. This also happens with the map hidden. This forces layout work and breaks the 0.5 ms budget.
6. Medium to high. High-DPI scaling fights between two functions. Text and icons draw at half their CSS size.
7. Medium. Edge clamp: the marker stops at 135 m, but the edge arrow starts at 150 m. A dot draws under the arrow, and the distance label jumps 32 px.
8. Low to medium. The static bitmap has no water margin, so views near the shore sample outside it.

## Requirement check (Gemini)

Pass: 150 m radius, drone arrow at the centre, M toggle saved in localStorage, no gameplay change.
Partial: static layer, objective marker and edge clamp.
Fail: heading-up rotation, shortcut mark, the 30 Hz and 0.5 ms budget, high-DPI, placement.

## Improvement ideas (Gemini)

- Draw the shortcut as a dashed line from entrance to exit, with a chevron at the entrance.
- A faint forward view cone, and a faint dashed line from the drone to the target.
- Speed-adaptive look-ahead: put the drone at about 62% of the map height, so the map shows more ahead than behind.
- Keep the map in one fixed place per device. Do not let short pops move it.
- A small N badge on the rim. It keeps the player oriented during fast turns.
