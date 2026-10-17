# Drone Dash: round 31 critic report

**Verdict:** Pass. The new water beats the old flat plane in 10 of 10 blind pairs. The boats never touch each other, the docks or the shore. The alley camera fix holds (0 hidden frames). One water gap is left. At play height the fine chop is as busy as it is 2 m above the sea. In golden hour and dusk the bay then looks like crumpled foil.

Build tested: the uncommitted round 31 work on top of commit b003276. My dev server ran on port 5191. A copy of b003276 (round 30) ran from a scratch worktree on port 5192 for before and after views. Both are stopped and the worktree is removed. The owner's server on 5188 was left alone. Every browser ran alone, one job at a time, from `critic-scripts/queue31.sh` and `jobs31.txt`. I did not read the round 31 builder notes. I read `src/world/Water.ts`, `src/world/Boats.ts` and the hooks in `Game.ts` only to learn what to test.

New scripts this round (in `progress/round-31/critic-scripts/`):

- `water31.mjs`: water views on both builds, desktop and iPhone 13, game camera and free camera. Moods: seed 130 golden hour, 22 morning, 33 dusk, 58 hazy noon.
- `water31b.mjs`: a flat-frame check (pixel reads in the same task as the render) and wake contrast per mood. It also does a motion sweep for the grid snap and a frame cost test with the water on and off.
- `boats31.mjs`: 120 s fixed-step boat probe on seeds 22, 58 and the fresh seed 4711, plus a drone fly-through of a sailboat.
- `trisweep31.mjs`: trisweep29 plus 1,920 water and marina spots.
- `ab31.py` (blind pairs), `contrast31.py` (fine chop metric), `spells31.py` (hidden spells from cam-clip rows).

## Machine load (read first)

BTLEServer used 98 to 100% of one core all session (`cpu-*.txt`). XProtect also used about 90% of a core at the start. The headless browser still ran at the 120 Hz vsync (median 8.3 ms). All wall-clock numbers below are marked contaminated. The camera and boat verdicts come from fixed-step probes. The GPU timer query (EXT_disjoint_timer_query_webgl2) gave noisy and sometimes negative water costs. So I used a throughput test instead (30 renders, one sync, best of 3).

## Water

**Blind A/B against round 30: new water picked 10 of 10** (`critic/ab/pair-01..10.jpg`, picks written in `ab/picks.txt` before the key was opened). Three pairs show a boat, so those three were not fully blind.

What works:

- **Motion and scale.** Four swell waves (5 to 21 m, peak 0.28 m) plus two scrolling detail layers. Low over the water it reads as real chop with soft rolling shapes (`water31-r31-*-g-low.jpg`). Boats ride the same swell: heave stayed within ±0.27 m on all seeds.
- **Shore.** A clean foam line laps along the whole seawall, with a shallow teal band and a darker wall foot. It matches the wall on every view I took, including top-down (`water31-r31-58-tiling.jpg`, `water31-r31-22-shoreline.jpg`, `water31-r31-m-22-g-shore.jpg`). Foam rings sit round the dock legs.
- **Sun glint and Fresnel.** The glint path sits under the real sun in all four moods. Grazing views go to sky colour, steep views show water colour. No blown-out blob with bloom on.
- **Colour per mood.** Turquoise in morning and noon, deep blue in golden hour, violet in dusk. None of them clash with the city.
- **Horizon.** The swell fades out from 150 to 380 m and the fog takes over. I found no hard seam on any of the 4 moods. The old backdrop skyline boxes still float on the far horizon, as in round 30.
- **No visible tiling** in the top-down shot from 70 m or at cruise height.
- **No blank frames.** 960 frames over 8 water views and 4 moods with bloom on, plus 960 on round 30 and 240 on the phone: 0 flat, 0 black pixels, at least 33 distinct colours of 49 samples.

What still looks fake:

1. **Fine chop does not calm with height.** The `contrast31.py` metric is the same at 24 m and at 2 m. Cruise: 31 to 35. Low: 29 to 39. Ratio: 0.90 to 1.09. Round 30 was 12 to 14 at cruise. In morning and noon the busy surface looks like a bright Mediterranean bay and is fine (`water31-r31-22-g-cruise.jpg`). In golden hour and dusk the same pattern turns into orange or pink flecks on dark troughs. It fills the screen and looks like crumpled foil (`water31-r31-130-g-cruise.jpg`, `water31-r31-33-g-cruise.jpg`). The detail only starts to fade at 60 m, and cruise views look at 30 to 300 m of water.
2. **Wakes vanish toward a low sun.** In morning and noon the rib and ferry wakes are bright and read well. In golden hour, looking toward the sun, the rib and ferry wakes are gone (`water31-r31-130-boat-rib.jpg`, `water31-r31-130-boat-ferry.jpg`). Measured as trail brightness over open-water brightness from 4 camera angles: rib and ferry views under 1.2 were 5 of 16 in golden hour and dusk, and 1 of 16 in morning and noon.
3. **The reflection is sky only.** The seawall, the docks and the buildings never show in the water. So the island edge looks a little pasted on at the shoreline. This is polish.
4. **Grid snap.** The water grid jumps 2.5 m (3.2 m on phones) with the camera. A 2 cm camera move across a snap line changes 14 to 18% of pixels by more than 24 levels. The same move elsewhere changes 0.1 to 1.7%. In flight at 15 m/s the snap frames change only 13% more than other frames, so it hides in motion. A drone that hovers right on a line can make it flicker. Polish.

Phone: the same look at lower detail. The shore foam and the marina read well at 844 px wide (`water31-r31-m-22-g-shore.jpg`, `water31-r31-m-58-g-marina.jpg`).

## Boats

- **Routes: pass.** Seeds 22, 58 and fresh 4711, 120 s each at 30 Hz (3,600 steps): 0 hull overlaps between boats (0.3 m margin), 0 hulls on a dock, 0 hull corners inside a solid. Moving hulls stay at least 28.6 m off the seawall. Moored hulls stay 3.5 m off. Every lane keeps one speed and one direction, so boats cannot meet.
- **Marina and pads: pass.** All pads sit at least 17.5 m inside the seawall (furthest pad 146.5 m from centre). The docks and moored boats start at the wall (164 m). On seed 4711 two doorstep pads sit 19 m inland of the docks and are clear. Boats have no colliders, so they cannot block a route or an arch.
- **Style: good match.** Flat-shaded low poly, the same family as the CC0 cars. The rib (5.2 m) and the rowing boats (4.6 m, about one car) look right beside the cars on the promenade. The docks look good, with foam at the legs (`water31-r31-130-marina.jpg`).
- **Weak spots.** The 20 m "ferry" is a scaled cruise ship and reads as a toy liner. The sailboat is a rustic wooden boat with a brown sail, a bit old-fashioned for the modern city. The boats sail fixed rounded squares at constant speed in every city. Nothing docks or leaves. After a minute it feels like a carousel. **Needs a human eye.**
- **Bobbing and roll: believable.** Pitch and roll follow the swell under bow, stern and both sides. Sailboats heel and sway. A moving rib lifts its bow.
- **The drone flies through boats.** I flew the drone at 4 m straight through a moving sailboat: no crash, no bump, 0 frames in a solid. The screenshot shows the mast through the drone (`boats31-22-drone-in-sail.jpg`). The marina's moored sailboat sits 8.5 m off the promenade, well inside the flight bounds.

## Alley camera (round 30 gap): fixed

| Run | Frames | Hidden frames | Longest spell | In solid | Jumps over 1 m |
|---|---|---|---|---|---|
| cam-clip30, desktop 22, no orbit | 6,925 | **0** | none | 0 | 0 |
| cam-clip24, desktop 22, random orbit | 6,918 | **0** | none | 0 | 0 |
| cam-clip24, desktop 58, random orbit | 6,927 | **0** | none | 0 | 0 |
| cam-clip24, iPhone 22, no orbit | 6,938 | **0** | none | 0 | 0 |

Round 30 on the same cam-clip30 run: 69 hidden frames, one 0.575 s spell on Quill Row. Now the drone sits in the middle of Quill Row (`cam-clip30-22-r31-noorbit-6-alley.jpg`).

`climb30.mjs` still passes: 0 jumps over 1.0 m on desktop (max 0.91 m) and iPhone (max 0.89 m), 0 frames in solid, closest camera 5.39 m. One desktop frame reached a 40.3% drone height share (round 30: 0, max 39.4%). That is one frame at the line, not a snap.

## Budgets

| Check | Result |
|---|---|
| Triangles, 3,256 spots per run (1,336 city spots plus 1,920 water and marina spots) | Desktop 22: 571k. Desktop 130: **585k**. iPhone 130: 518k. Water spots max 452k. **0 spots over 600k.** |
| Draw calls | Max 143 desktop, 126 iPhone. 0 over 150. Street run max 144. |
| Water cost, desktop (throughput, contaminated) | +0.5 to 0.9 ms a frame in water views. About 0 in a city view. Against round 30's water: +0.4 to 0.5 ms. |
| Water cost, iPhone 13 (throughput, contaminated) | +0.0 to 0.5 ms a frame. |
| Street frame time (12 s, 120 Hz vsync, contaminated) | Desktop p95 9.0 / 8.8 ms (normal / rush), max 10.4. iPhone p95 9.4 / 9.6 ms, max 10.4. |
| First flight | 0 long tasks and 0 shader compiles after Play in 3 runs (2 desktop, 1 iPhone). |
| First load | Production build 3.0 MB in total, all lazy assets included (JS 935 KB, boats.glb 240 KB). Type check clean. |

## Regressions

- **Flat-frame probe: pass.** Round 1 probe: 894 frames, 0 flat, 0 errors. Water and glint views: 0 flat (see above).
- **Crash-classify, 8 seeds, 0 pad lips: pass.** 12 m: 41 crashes in 523 s (4.7 a minute), 8 near the target, closest 3.0 m below a top. 20 m: 36 in 639 s (3.4 a minute), 15 near the target.
- **People probe: pass.** 0 people on active pads (48 legs, 1,536 samples).
- **Traffic per-frame overlap: pass.** 0 in all 6 runs at 120 Hz.
- **Phone HUD probe: pass.** iPhone 22, 58, 130: marker on controls 0, drone under pills 0, pops on the drone 0%.
- **Chimes with pops: pass.** 41 of 41 chimes had the pop shown within 0.3 s.
- **Medal gate, breakdown exact on all 6 runs: pass.** Street: 5,695 / 3,779 / 5,965, all Silver, total 15,439 (round 30: 13,230), strict delivery share 64%. Lazy: 1,256 Bronze / 927 none / 1,048 Bronze, total 3,231.
- **Exploits: pass.** No-delivery farm 0 on 22, 58, 130. Carry farm 0.24, 0.25 and 0 of honest points a minute. Honest 4,559 / 4,892 / 6,859 (Gold). One delivery: best 1,149 Bronze.
- Only frames over 20 ms in the 80 s HUD runs: the probe ending at 80.5 s.

## Biggest remaining gap in the water and boats

**At play height the water is too busy.** It is as busy as at 2 m above the sea. The fine chop keeps full strength out to 60 m and fades slowly after. So from 15 to 30 m up the whole bay is one even field of fine flecks. In golden hour and dusk it reads as crumpled foil, not as sea. Good stylized water gets calmer and broader with distance: big soft colour shapes, with sparkle mostly in the glint path.

**Acceptance test:**

- Rerun `water31.mjs` (desktop, seeds 130, 22, 33, 58), then `contrast31.py r31`.
- Pass marks: cruise to low ratio at most 0.6 on all 4 moods. Low view still at least 25 (keep the close-up chop). Cruise still at least 15 (do not go back to the flat plane).
- Blind A/B against round 30 (`ab31.py`) still picks the new water in at least 8 of 10 pairs.
- Flat-frame probe stays at 0. Water cost stays under +1.0 ms a frame on desktop.

## Other gaps, ranked

1. **The drone flies through boats.** No colliders on hulls or masts, and the marina is inside the flight bounds. Test: fly at 4 m into the moored marina sailboat's mast and into a lane-30 sailboat. The drone must bump or crash (contact or crash count over 0). There must be 0 frames with the drone centre within 0.4 m of the mast line.
2. **Wakes vanish toward a low sun.** Test (`water31b.mjs` wake block): trail over open-water brightness at least 1.3 in all 32 rib and ferry views over the 4 moods. Today 6 of 32 are under 1.2.
3. **Boat traffic feels like a carousel.** Fixed rounded squares, constant speed, the same pattern in every city, and no boat ever docks or leaves. Add a ferry run to a pier, or a boat that pulls in and out of the marina. **Needs a human eye.**
4. **Desktop pops cover the drone** in 26% of pop samples on seed 22 (round 30: 32 to 48%). The phone keeps them clear. Test: under 2% on desktop seeds 22, 58 and 130.
5. **Grid snap.** 14 to 18% of pixels change on a 2 cm camera move across a snap line (control under 2%). Test: across-line change at most 2 times the control in the `water31.mjs` pop block.

## Screenshots (progress/round-31/critic/), 83 files

- **Blind A/B pairs:** `ab/pair-01.jpg` to `ab/pair-10.jpg`, key in `ab/.key.json`, picks in `ab/picks.txt`.
- **Before and after (round 30 / round 31), same frame:** `water31-r30-{130,22,33,58}-{g-cruise,g-low}.jpg` against `water31-r31-{130,22,33,58}-{g-cruise,g-low}.jpg`, `water31-{r30,r31}-22-shoreline.jpg`, `water31-r30-22-glint.jpg` against `water31-r31-22-glint.jpg`, phone `water31-{r30,r31}-m-22-{g-cruise,g-low}.jpg`.
- **Water, all moods:** `water31-r31-{130,22,33,58}-{g-shore,g-marina,glint}.jpg`, `water31-r31-58-tiling.jpg`, `water31-r31-22-horizon.jpg`, `water31-r31-58-postcard.jpg`, `water31-r31-22-marina-high.jpg`, `water31-r31-130-marina.jpg`. The first free-camera shots per seed still show the title fading out.
- **Boats:** `water31-r31-{130,22,33,58}-boat-{rib,ferry,sail}.jpg` (golden hour 130 shows the missing wakes), `water31-r31-m-58-boat-rib.jpg`, `water31-r31-m-58-g-marina.jpg`, `water31-r31-m-22-g-shore.jpg`, `boats31-22-drone-in-sail.jpg`.
- **Alley camera:** `cam-clip30-22-r31-noorbit-6-alley.jpg` (Quill Row, drone in view), `cam-clip-22-6-alley.jpg`, `cam-clip-58-6-alley.jpg`, `cam-clip-58-10-alley.jpg`, `cam-clip-22-m-noorbit-6-alley.jpg`.
- **Camera extras:** `cam-clip30-22-r31-7-hidden.jpg` is from the settle frames after a teleport. The test skips those frames by design. `climb30-d-130-8-spike.jpg` is the 40.3% frame.
- **Other:** `tris31-{d-22,d-130,m-130}-worst.jpg`, `M-low-seed22-pass2.jpg`, `M-low-seed58-pass2.jpg`, `M-low-c10-seed130-pass1.jpg`, `N-alt12-seed22-t21.8-near.jpg`, `N-alt20-seed130-t58.1-near.jpg`, `raw/fr31-d-22-h04-low-payout-pop.jpg`, `raw/fr31-m-22-h04-low-payout-pop.jpg`.
