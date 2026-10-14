# Drone Dash, round 8 critic report

**Verdict:** The lazy pilot no longer wins: speed and wall distance now pay, and nothing broke. Two acceptance lines miss (mobile first payout, strict slipstream share). The scoring loop is good enough now. The biggest gap is no longer balance: the game never tells a player what a good run is, so there is little to come back for.

## Round 7 gap (the meter paid for time near walls): closed in substance, two lines missed

Scripts are copied to `critic-scripts/`. Output folders are relative (`../critic/`), so no path edits were needed. For the share, I ran `route-play-rt-x-h.mjs` and `balance-probe-h.mjs`. They are the same scripts with one log-only addition: `slipstream.hotPoints` in the result line. Control logic is identical. Real-time scripts ran one at a time.

| Test | Needed | Round 7 | Round 8 | Result |
|---|---|---|---|---|
| 1. Lazy / standard low score a minute | at most 0.8 | 1.01 | **0.39** (847 / 2,174) | Pass |
| 2a. Centre 16.3 m/s / centre 8.9 m/s slip points (each road) | at least 1.3 | 1.0 | **4.2** (550 / 130) | Pass |
| 2b. Hug 2.5 m at 16.3 m/s / centre 8.9 m/s | at least 2 | 1.9 | **10.8** (1,400 / 130), same on all 3 roads | Pass |
| 3a. Low / high score a minute | at least 0.9 | 1.22 | **1.05** (2,174 / 2,072) | Pass |
| 3b. High deliveries a minute | at least 2.3 | 2.71 | **2.50** | Pass |
| 3c. Low crashes a minute | at most 1.5 | 0 | **0** | Pass |
| 3d. Desktop: first payout after first draft / chain x2 | 10 s / 50 s | 2.1 s / 8.0 s | **1.1 s** / 20.5 s | Pass |
| 3e. Mobile: first payout after first draft / chain x2 | 10 s / 50 s | 3.5 s / 14.8 s | **11.0 s** / 19.1 s (rerun: **11.3 s** / 20.1 s) | **Fail** |
| 4. Slipstream share of low score | at most 50% | 68% | 41% direct, **62% strict** | **Fail (strict)** |

Route pilots, seeds 22, 58, 130, SIMT 150:

| Pilot | Time | Deliveries/min | Score/min | Score per run | Crashes | Slip pts | Street bonus on drops |
|---|---|---|---|---|---|---|---|
| Lazy: centre, 10 m/s, no boost | 203 s | 0.89 | 847 | 955 | 0 | 1,260 | 428 |
| Standard low | 285 s | 1.47 | 2,174 | 3,442 | 0 | 4,230 | 2,183 |
| Wall offset 5.5 m | 252 s | 1.19 | 2,119 | 2,967 | 1 | 4,930 | 1,555 |
| High line, 40 m | 408 s | 2.50 | 2,072 | 4,697 | 4 | 480 | 0 |

Mobile miss, in detail. The touch pilot first drafts at 4.5 to 4.7 s at 5.8 to 5.9 m/s. The speed factor is then about 0.2 (no draft below 4 m/s, full at 13). So the short intro meter takes 11 s to fill. On desktop the same pilot fills it in 1.1 s. A new touch player who has not yet pushed the stick to the rim sees the meter crawl for 11 s. That is exactly the player the intro meter was for.

## Slipstream share, both ways

- **Direct:** slipstream payouts are 4,230 of 10,325 standard low points = **41%**.
- **Strict:** add the street multiplier on deliveries (x1 + 0.15 per chain step held at the drop). It paid 2,183 points that exist only because of drafting. Total 6,413 = **62%**. Fail.
- The street bonus is 36% of all low-line delivery points (2,183 of 6,095).
- A third part is not counted: drafting at quality 0.55 or more stops the fast-drop par clock. Some fast-drop bonuses (+75 and the combo step) exist only because of this. So the true strict share is 62% or more.
- Wall-offset pilot: 55% direct, 73% strict.

## Overcorrection check

- **Centred street flight is not worthless at speed.** At 16.3 m/s the centre earns 550 slip points in 12 s. That is 39% of the wall hug (1,400). It is a fair middle tier.
- **Centred slow flight is nearly worthless.** At 8.9 m/s: 130 points in 12 s, 2 payouts. The lazy pilot fell from 2,783 to 847 a minute. That is intended. But a slow beginner is that pilot, and the mobile result above shows the cost.
- **The wall hug does not dominate.** On a straight it pays 2.5 times the centre at cruise. In route play it does not convert: the 5.5 m offset pilot scored 2,119 a minute against 2,174 centred. It made fewer deliveries (1.19 against 1.47 a minute) and crashed once. The skill reward lives on straights only. Corners and kerbs eat it. This is fine, not overcorrected.
- **HUD.** One-word cues ("FASTER!", "WALL HUG!") read well on both screens. The three chevrons are about 10 px on desktop. You must look for them to read them. On desktop the whole meter sits in the bottom-left corner, 18 px from the edge, far from where the eye is (the drone, centre). On mobile the area below the drone still holds up to five rows: the first-run hint, the cue, the label and chevrons, the meter and the boost bar. The payout pop sits on the drone itself (`m-h03-low-meter-half.jpg`, `m-h04-low-payout-pop.jpg`). It is readable, but it is noise over the street you are flying down.

## Whole game, as a player

- **First 10 seconds.** A strong first look: golden-hour city, a chunky readable drone, a diamond marker with distance, a clear title card with controls. The clock starts the moment you press Play. Hovering 10 s costs 10 of 50 s, with no countdown (`J-01-idle-01s.jpg`, `J-01-idle-10s.jpg`). That is acceptable for an arcade game.
- **Onboarding.** The title gives the rule in one line, and a first-time hint sits under the meter. Pickup, carry and drop are clear. The first payout comes fast on desktop, slow on touch.
- **Core loop.** Pick up, deliver, draft along streets. It now pays for speed and line. It works.
- **Game feel.** Flight is the best part. Momentum, bank and drop guide feel good. Crashes are fair (0 hop-like charges, 0 on a pad lip).
- **Art.** Warm, coherent, low-poly. Moving traffic. It looks finished.
- **Audio.** Rotor hum, wind, a draft whistle, chimes and ticks. **There is no music at all**, on the title, in the run or on game over.
- **UI.** Clean and legible. The game-over card is the weakest screen: score, best, deliveries, top combo, one button (`J-03-gameover.jpg`).
- **Difficulty and run length.** Runs last 52 to 150 s. Legs get longer (70 + 6 m per delivery) and clock bonuses shrink to 55%. Nothing in the run shows this. Nothing new appears. The fifth delivery plays like the first.
- **Game over and restart.** Restart is instant (32 ms from "Fly again" to control).
- **Replay pull.** Weak. The only thing to chase is one number. The player is never told whether 3,653 is good.

## Single biggest remaining gap: nothing to play for beyond one unexplained number

The best score-attack arcade games give every run a target and a verdict. You know what "good" looks like before you start. You see the next goal while you fly. You learn on the results screen why you got what you got. Drone Dash has none of this. The title says "Best 0". The HUD shows score, clock and deliveries. Game over shows four numbers and "Fly again".

Evidence:
- Skill now separates runs clearly: per run, lazy 955, standard low 3,442, high 4,697, my default-city run 3,653. That is a 5x range. The screen turns all of it into bare digits, with no tier, target or rank.
- Score has three sources (drops and combo, slipstream, the street bonus) and two routes with a real trade. The street pays more a minute, and the roof pays more a run (4,697 against 3,442). None of this is shown, so a player cannot learn it.
- Every fresh load is the same city (seed 7) with the same first pickup (Juniper Lofts Rooftop). Only the best score is saved. There is no other memory between runs.
- Seven rounds of balance work made the score mean something. The game does not yet use that meaning.

**Acceptance test** (dev server on 5188, seeds 22, 58, 130, SIMT 150, one browser at a time):
1. **Targets exist and are visible.** The game shows score targets in tiers (for example three medals). The title shows them. The HUD shows the next target and the distance to it during the run. Game over shows the tier reached and the points to the next one. Check in the DOM on desktop and iPhone 13 held sideways.
2. **Targets are calibrated to skill.** Use per-run score. Lazy pilot (`OFF=0 CRUISE=10 NOBOOST=1 balance-probe.mjs`): tier 1 or none in 3 of 3 runs. Standard low and high route pilots (`route-play-rt-x.mjs`): tier 2 or better in at least 2 of 3 runs each. No bot reaches the top tier.
3. **Game over explains the score.** It shows at least: deliveries (with fast drops and combo), slipstream, and street bonus. The lines sum exactly to the final score in 3 of 3 runs, checked against diagnostics.
4. **Crossing a tier is a moment.** Each time the player passes a target, the game gives a visible and audible beat and counts it in diagnostics. It fires at least once in at least 2 of 3 standard low runs.
5. No regressions: route ratios in the table above stay within 10%. Frame time p95 stays under 12 ms.

## Other gaps (ranked)

1. **No music.** The game is silent apart from effects. A light procedural loop that lifts with a chain or a low clock can add more feel than any balance pass. Test: music plays on the title and in the run. Its intensity changes with the chain and when the clock is under 10 s. Diagnostics show this as a gain or layer value.
2. **Mobile first payout regressed to 11.0 s and 11.3 s** after the first draft (needed 10 s, round 7 was 3.5 s). The speed factor makes the intro meter crawl for a touch player at about 6 m/s. Test: under 10 s in two mobile hand-fly runs.
3. **Strict slipstream share is 62%** (needed 50%). The street multiplier on drops is the main cause (2,183 points, 36% of low-line delivery points).
4. **Slip HUD placement.** On mobile, up to five stacked rows below the drone, and the pop sits on the drone. On desktop, the meter and cue sit in the far bottom-left corner, out of the eye line, with 10 px chevrons.
5. **The street and roof trade is invisible.** The low line delivers 1.47 a minute (2.3 a run), and the high line 2.50 (5.7 a run). Low runs end 25 to 45 s sooner. A player who follows "fly low" has shorter runs and does not know why. The breakdown in the main test shows this.

## Regressions: none found

- **crash-classify, all 8 seeds, 12 m:** 735 s sim, 25 deliveries, 37 charged (3.0/min), **0 hop-like**. **20 m:** 765 s, 29 deliveries, 33 charged (2.6/min), **0 hop-like**. (Round 7: 3.8 and 2.1/min.)
- **Pad lip (verbose rerun, all 8 seeds, 12 m and 20 m):** 7 crashes within 30 m of the target. All hit building faces with tops of 10.6 to 35 m at 12 to 16.9 m/s. Street pads are 0.4 m high. The one rooftop target (22.9 m) was hit beside a 35 m wall. **0 on a pad lip.**
- **arrival-metrics, all 8 seeds:** 67 legs, 66 arrived, 1 timeout on seed 91 (the known straight-line bot case, not investigated again). Median final approach 3.3 s, 0 stalls in the final 30 m. Marker off screen 1.4%. Slow and high 0.0%.
- **Flat-frame probe:** 1,018 frames, **0 flat**.
- No page errors on desktop or mobile.

## Performance

Headless Chromium runs at a 120 Hz cap, so the 8.3 ms median is the cap.

- Desktop 1280x720, 80 s hand flight: 9,574 frames, **median 8.30 ms, p95 8.80 ms, max 9.4 ms, 0 over 20 ms** (round 7: 8.3 / 9.6 ms).
- Mobile (iPhone 13 held sideways, touch), 80 s: 9,578 frames, median 8.30 ms, p95 8.80 ms, max 9.4 ms, 0 over 20 ms. Rerun: p95 9.20 ms, max 16.7 ms, 0 over 20 ms.
- First load, production build: **about 0.73 MB** (JS 702 KB, CSS 21 KB, HTML 7 KB). lil-gui (31 KB) loads only with `?debug`. Budget 15 MB: pass.

## Screenshots (progress/round-8/critic/)

- Hand flight, desktop: d-h01-title, d-h02-low-drafting, d-h03-low-meter-half, d-h04-low-payout-pop, d-h05-low-payout-chain, d-h06-high-wind, d-h08-end
- Hand flight, mobile: m-h01-title, m-h02-low-drafting, m-h03-low-meter-half, m-h04-low-payout-pop, m-h05-low-payout-chain, m-h06-high-wind, m-h08-end (the second mobile run wrote over these)
- Player journey (default city): J-00-title, J-01-idle-01s, J-01-idle-04s, J-01-idle-10s, J-02-delivery-1, J-03-gameover, J-04-restart
- Crash classify: K-alt12-*, K-alt20-*. Near target: N-alt12-*, N-alt20-*
- Route pilots: Q-high-seed22/58/130-crash*, B-off5.5-seed130-crash1

Scripts (progress/round-8/critic-scripts/): copies of all round 7 scripts, plus `route-play-rt-x-h.mjs` and `balance-probe-h.mjs` (log-only hotPoints) and `journey.mjs` (new: title, 10 s idle, full run with per-delivery log, game over, restart time). Logs: hug.log, bp-lazy.log, rp-low.log, rp-high.log, bp-hug.log, hf-desktop.log, hf-mobile.log, hf-mobile-2.log, flat.log, journey.log, cc12.log, cc20.log, ccv12.log, ccv20.log, am-all.log.
