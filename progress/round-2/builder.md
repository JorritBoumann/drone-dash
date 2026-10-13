# Round 2 builder note: blank desktop render with bloom on

## Root cause
The objective sky beam (and its ring wall) shader computed `pow(1.0 - vUv.y, ...)`. The composer renders into a 4x MSAA HalfFloat target, and on partly covered edge pixels MSAA evaluates varyings at the pixel centre, so `vUv.y` lands just above 1.0 on the beam's top rim and `pow()` of a negative base returns NaN (about 15 to 18 pixels near the top of the screen). The clamp pass lets NaN through (NaN fails every comparison), and UnrealBloomPass blurs it across every mip, so the composite becomes NaN everywhere and the output shows one flat colour.

How it was proven: per-pass readback on a blank frame showed NaN first appearing in the RenderPass output (18 values), the high-pass target at 9 values, and the bloom output at 100% NaN. Hiding each visible object in turn on that frame showed that only hiding the beam mesh brought the NaN count to 0. The same frame rendered to non-MSAA Half or Float targets had no NaN, which matches the MSAA extrapolation explanation.

## Fix
`src/entities/ObjectiveMarker.ts`: clamp `vUv.y` (wall and beam) and `vFacing` (beam) to [0,1] before `pow()`. No change to the post chain, bloom settings or quality. The look is unchanged.

## Files changed
- src/entities/ObjectiveMarker.ts

## Acceptance test (1280x720, default URL, Playwright chromium, `renderer.post === true`)
- W+Space 3 s: 329 frames, 0 blank
- W+E 3 s: 296 frames, 0 blank
- W+A 3 s: 309 frames, 0 blank
- Total: 934 frames, 0 blank (was 184 of 323 for W+Space before the fix)
- play-desktop.mjs (copy that writes to a scratch folder so progress/round-1 stays untouched): all 10 screenshots saved on the first try, smallest 365 KB
- Frame time (play-desktop, 8,265 frames): median 8.30 ms, p95 9.00 ms, p99 9.30 ms, max 9.4 ms, 0 over 20 ms (round 1: median 8.3, p95 9.1)
- `npm run build`: passes
