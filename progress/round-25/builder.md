# Drone Dash: round 25 builder notes

Main concern: delivery is not yet the main reward, and the systems are not taught in layers. Leftovers: the camera squeezed against a wall after a delivery (A) and the phone route tag on the "Fly" label (B).

Bots played a production build of the working tree. My own `vite preview` served it on 127.0.0.1:5190. I rebuilt it between jobs (`builder-scripts/rebuild25.sh`), so code edits never reached a running page. The owner's server on 5188 was left alone. Every browser ran alone, one job at a time, from one queue (`builder-scripts/queue25.sh`, `jobs25.txt`). Scripts are the round 24 critic's, with only the output folder (`../builder-shots/`) and the port changed. New scripts: `teach-probe25.mjs` (hud-probe plus `teach-init25.js`) and `share25.py`.

## Design

### 1. Score shape: the delivery is the headline
- **Bigger drop payout.** Base 100 -> 200 points, 1.2 -> 2.4 points per metre of leg (`RUN.baseScore`, `RUN.perMetre`).
- **Fast-drop time bonus.** A fast drop paid a flat 75. It now pays 100 plus 15 per second under par, counted up to 8 s (`RUN.fastBonus`, `fastPerSec`, `fastSecCap`): 100 to 220 before the combo. A lazy flier scrapes in 0 to 3 s under par. A street pilot comes in 4 to 9 s under. I tried 80 + 25/s up to 12 s first: the roof line beats the street-route par by 6 to 11 s, so it overtook the street line (low/high 0.95). The cap of 8 s fixes that.
- **Rush order** 150 -> 200 (a delivery reward, paid with the drop).
- **Street bonus** banks a little less: `bankCarry` 1.15 -> 1.0, `bankPickup` 0.86 -> 0.74, `bankPerMetre` 5 -> 4.25, `bankLegMin` 150 -> 130 (about 14% less). Drafting still fills the meter, chains, refills boost, slows the clock and banks points exactly as before.
- **The delivery moment.** The pop now reads "+N delivered" with the time bonus and the street bonus as add-ons in the line under it: "+813 delivered / Fast drop +164 · +477 street bonus". The big number is only what the delivery itself pays. The pickup pop promises the drop: "Parcel secured! / Deliver for +543". The game-over breakdown keeps its rows (Deliveries, Fast drops, Rush orders, Combo bonus, Street bonus), so the two views stay separate.

### 2. Layered teaching (new player's first run)
- A **new player** has no saved progress. That means no `drone-dash-played-v1` flag, no best score and no medal. The flag is set when any run ends. Everyone else is **returning**: full HUD from the start, no hints.
- On the first run the HUD starts with the score, the clock, the objective pill and the pad marker. The fixed boost meter, telemetry, parcel count and pause button also show. CSS hides everything else until the game introduces it (`#app.teach:not(.l-<key>)` in `styles.css`). Their normal show/hide logic keeps running underneath, so nothing changes for returning players.
- `Game.updateTeach` notes the first time each system happens. It then queues the introduction. Nothing is introduced before 30 s. After 30 s, one system comes at a time, at least 4 s apart. When several wait, a fixed order applies (street bonus first). Each comes with one short hint in the event banner slot, which on a phone is the round 24 pop slot:

| Layer | Happens when | Shows | Hint |
|---|---|---|---|
| slip | first draft near a wall, or the first delivery | slipstream meter, banked bonus in the pill and by the score, payout pops | "Slipstream: Fly low by walls: bonus paid on delivery" |
| combo | first fast drop | combo chip | "Combo: Fast drops in a row raise the multiplier" |
| medal | first medal line crossed | medal goal chip, medal banners | the medal banner itself: "Bronze! First medal · next: Silver 2,800" |
| clock | first slow clock, after slip | slow clock badge | "Slow clock: Drafting toward the marker slows the clock" |
| route | second delivery | route arches in the world, the route hint pill, the gate tag | "Shortcuts: Arches mark alleys and tunnels" |
| view | first delivery | the camera hint (it used to show at 1.5 s) | its own line |
| wind | first high wind | wind chip | "High wind: Up high the wind slows you" |
| rush | rush hour (60 s) | rush tag in the pill | the Rush hour banner (no extra hint) |
| overtime | overtime starts | (timer look) | the Overtime banner |

- Before the slip layer is introduced, payouts bank quietly (no pop). Scoring is identical for new and returning players. Teaching only changes what is shown. The arches are hidden through a parent group (`gateRoot`), so the bots' route-mark hooks are unchanged.
- The old in-meter slipstream hint is off (the layer hint replaces it). `__THREE_GAME_DIAGNOSTICS__.teach` logs the introductions.

### 3A. Camera never squeezed onto the drone in open streets
`CameraRig`: two parts, both only outside alleys and tunnels (corridor weight under 0.05).
- **Swing** (`updateSwing`): this is for a slow drone (under 6 m/s, at or near a pad). The view straight behind it can have less than 2.6 m of clear room. Then the camera swings round the drone, at most 0.6 rad. It goes to the nearest angle with the full chase room, or else at least 3.2 m. It eases back after 0.9 s of a clear view. The sweep runs at most 10 times a second. A first version allowed up to 3.2 rad at any speed: it pulled the view off the heading and the roof-line bot (which steers by the camera) crashed more. Hence the speed and angle limits.
- **Floor** (`keepRoom`): after all other moves the camera is never closer than 2.4 m to the drone. With a clear line it keeps its direction from the drone. Without one, it rises over the drone, a little behind it.

### 3B. Phone route tag
`Game.gateTagPlace`: the tag's pill is kept fully on screen (its measured width, `Hud.gateTagSize`). On a touch screen the game tests its footprint (pill plus edge arrow) against the stick with its "Fly" label, the buttons, the top panels and a showing pop. On a hit, it walks the screen edge to the nearest free spot, as the pad marker does. The phone pop slot's right edge also moved from 72 to 100 px left of centre (hint and delivery pops reached a close drone's rotors).

## Numbers

### Score shape (final build, real time, seeds 22, 58, 130)
"Delivery" counts only what the delivery itself pays: drop base, fast-drop time bonus (rush included), combo. The second view also counts the banked street bonus that is paid with a delivery. `share25.py` prints both.

| Run | 22 | 58 | 130 | Total |
|---|---|---|---|---|
| Street line (low, `music-run-esc`) | 5,628 Silver | 4,861 Silver | 5,252 Silver | **15,741** |
| Delivery share | 65.7% | 76.0% | 57.0% | **66.0%** |
| Delivery share without rush | 62.2% | 67.8% | 53.2% | |
| Street bonus share | 34.3% | 24.0% | 43.0% | 34.0% |
| Roof line (high, `route-play-rt-x-m-esc17`) | 5,309 Silver | 3,472 Silver | 4,908 Silver | **13,689** |
| Delivery share | 98.7% | 94.9% | 99.0% | 97.8% |
| Lazy (`balance-probe-m-esc17`, bank rates 5% higher build) | 1,713 Bronze | 1,440 Bronze | 1,249 Bronze | 4,402 |

- Delivery at least 55% of total: **pass** on all 6 runs, view 1. Seed 130 low is the thin one (57.0%). Counting the street bonus paid with each drop as part of the delivery (view 2), every run is 99 to 100% (only a time-up share is not paid with a drop). View 2 is relabelling. View 1 is the honest test.
- Street line over roof line: **1.15** in total (pass, line 0.85). The street line wins on each seed too (22: 5,628 v 5,309, 58: 4,861 v 3,472, 130: 5,252 v 4,908). Round 24 was 1.45.
- No Ace (15,000): best run 6,366. Breakdown exact (`bdOk`, `domOk`) on every bot run: **pass**.
- Round 24 for comparison: low 10,470 with the street bonus at 56%. The low bot now banks 1,167 to 2,258 street bonus a run, so drafting still pays a third of a street run.
- The run to get here: v1 (flat time bonus 120 + 12/s): low 62% delivery. v2 (80 + 25/s up to 12 s): low 69%, but the roof line won (low/high 0.95). v3/v4 = final.

### Medal lines (6 fresh cities, final build)
Lines moved: Bronze 1,000 -> 1,200, Silver 2,000 -> **2,800**, Gold 4,500 -> 6,000, Ace 10,000 -> 15,000.

| City | Street (low) | Lazy |
|---|---|---|
| 34871 | 6,366 Gold | 1,402 Bronze |
| 52417 | **1,959 Bronze** (rerun 2,096 Bronze, 2 drops both times) | 874 none |
| 69023 | 3,592 Silver | 1,825 Bronze |
| 15736 | 5,367 Silver | 2,313 Bronze |
| 88104 | 3,754 Silver | 2,449 Bronze |
| 43390 | 5,261 Silver | 1,738 Bronze |

- Street Silver or better: **5 of 6, fail**. City 52417 gives the street bot two drops in both runs (a weak city, like 20323 in round 20). Its lazy run there is 874.
- Lazy Bronze or below: **6 of 6, pass**, with 351 to spare under Silver. I first set Silver at 2,500. The lazy flier's three-drop runs reach 2,313 to 2,449, so that was too thin and I raised it to 2,800.
- Best lazy 300 below worst street: **fail** (2,449 against 1,959). Without 52417 the worst street is 3,592 (gap 1,143). This is the cost of the shape: a slow, centred flier that delivers three parcels now earns most of what delivering pays. Per city the street bot is always well ahead (1,085 to 4,964).

### Layered teaching (`teach-probe25.mjs`, fresh profile unless noted)
First time each HUD part is visible, seconds into the run:

| Part | Desktop 22 | iPhone 22 | iPhone 130 | Android 317 |
|---|---|---|---|---|
| Score, clock, objective pill, marker | 0 | 0 | 0 | 0 |
| Pickup pop ("Parcel secured! Deliver for +443") | 15.0 | 16.1 | 22.1 | 16.2 |
| Slipstream meter + its hint | 30.0 | 30.1 | 30.0 | 30.0 |
| Combo chip | 34 | 67.9 | (run ended) | 34 |
| Medal chip + banner | 38 | 72.1 | (run ended) | 38 |
| Slow clock badge | 44 | 34.1 | 34 | 43.4 |
| Camera hint | 46 | 43.7 | 49.7 | 46 |
| Route hint, arches, tag | 58.4 | (after 2nd drop) | (run ended) | 66.8 |
| Rush tag | 70 | 60.2 | 65.1 | 60 |
| Wind chip | 95.6 | 52.1 | 73.7 | 72.2 |

- Nothing new before 30 s except the first pickup pop and the marker: **pass** on all runs.
- Each hint showed once (centre log): Slipstream, Slow clock, Combo, Shortcuts, High wind, plus the medal, Rush hour and Overtime banners. **Pass.**
- Returning player (`RETURNING=1`): goal chip and route hint at 0 s, slipstream meter at 4.6 s, payout pop at 5.9 s, slow clock at 9.9 s, no hints. **Pass.**

### Exploits (final build)
- No-delivery farm (`farm-probe`, 22, 58, 130): **0, 0, 0**. Smart farm near, seed 22: **0**.
- Carry farm (`capfarm` carry against honest, same controller): seed 22 661 / 2,556 a minute = **0.26**, seed 58 0 / 2,622 = **0** (no drop), seed 130 731 / 2,746 = **0.27**. Line 0.5: **pass**.
- One-delivery runs: carry farms 1,019 (no medal) and 1,259 (Bronze), stuck roof-bot runs 787 and 838 (no medal). **Pass** (at most Bronze).
- Van farm 12 s (`capfarm-narrow` van, 22): 3,946 Silver, 3 drops, 1,682 a minute (0.66 of honest). Alley farm 12 s: 3,555 Silver, 3 drops, 2,039 a minute (0.80). Both deliver three parcels like an honest run. Round 20 measured the alley 12 s farm at 0.87.

### Camera
Open-street samples (corridor weight under 0.05, drone under 30 m), every frame, runs with drops beside walls:

| Run | Open samples | Under 2 m | Under 2.5 m | Closest |
|---|---|---|---|---|
| Before the floor, desktop 22 | 13,240 | **50** | 99 | 1.26 m |
| Final, iPhone 130 (70 s low, 20 s high) | 9,417 | **0** | 109 | 2.27 m |
| Floor build, desktop 22 (110 s low) | 13,242 | **0** | 85 | 2.24 m |
| Floor build, iPhone 22 | 8,456 | **0** | 120 | 2.24 m |
| Floor build, Android 317 | 10,273 | **0** | 45 | 2.24 m |

- **Pass.** The samples between 2.0 and 2.5 m are the floor (2.4 m) plus the follow lag.
- Round 23 tunnel test (`cam-clip24`, seed 22, orbit): 10 of 10 passes PASS, 6,931 frames, in solid 0, hidden 0, under 0, close 0. Seed 130, no orbit: 7 of 7 PASS, 4,846 frames, all zero. **Pass.**
- Roof-line bot crashes: 8 in 332 s (1.4 a minute, round 24: 1.9).

### Phone HUD (`teach-probe25.mjs` = round 24 hud-probe plus the new checks)

| Run | Samples | Marker on controls | Drone under pills (all / above 30 m) | Pop on drone | Route tag on stick, Fly, buttons, top / off screen |
|---|---|---|---|---|---|
| iPhone 22 | 797 | 0 | 0% / 0 of 83 | 3.8% | 0 / 0 (tag not shown) |
| iPhone 130 (final) | 842 | 0 | 0.12% / 0 of 68 | 0.86% | 0 / 0 (tag not shown) |
| Android 317 | 893 | 0 | 0.11% / 0 of 34 | 1.86% | **0 / 0 in 112 tag samples** |
| Desktop 22 | 1,104 | | 0% | (desktop pops are centred, as before) | 0 / 0 in 55 |

- All four lines: **pass**. Before the slot and floor fixes, the first iPhone 130 and Android 317 runs had pop on drone at 12% and 15%. The new hint banners and a camera at 1.3 to 2.5 m caused that.

### Regressions
- Hand-fly first payout: desktop 5.7 s, iPhone 6.6 s. That payout is a street bonus banked **silently** on a new player's first run, so it shows no pop. The first thing a new player sees is the pickup pop with the drop's value: 15.0 s desktop and 16.1 s iPhone on the same seed (teach probe). **Fail on the 10 s line for a new player.** Pass for a returning player (payout pop at 5.9 s). See open points.
- Flat-frame probe: 1,032 frames, **0 flat**, 0 errors.
- Crash-classify, seeds 22, 58, 130: 12 m: 15 crashes in 192 s, 3 near target, closest face 3.9 m below the top, **0 pad lips**. 20 m: 14 in 283 s, 4 near, 2.9 m, **0 pad lips**.
- Van slipstream (`van-draft`): 280 and 132 draft points on 58 and 130 (round 24: 325 and 153. The bank rates are 14% lower).
- Traffic probe (`street-probe`, 4 seeds, normal and rush): 0 overlaps, 0 cars in solids, 0 people in solids, 0 people hit, 0 on pads.
- Frame time: p95 9.4 to 9.8 ms on every probe run (desktop and phones), max 17.5 ms. Street perf probe: p95 9.5 / 9.6 ms desktop normal / rush, 9.6 / 9.7 ms iPhone, 0 frames over 20 ms. **Pass.**
- `npm run build`: pass. Type check clean. JS 831 KB (233 KB gzip), CSS 39 KB.
- Bloom clamps in `ObjectiveMarker.ts` untouched. Bot hooks untouched. `teach` added to diagnostics.

## Open points
- **New player's first visible reward is at 15 to 22 s**, not under 10 s. Banked payouts are quiet before the slipstream layer. A fix to try: a shorter first pickup leg (`JOBS.first` 45 to 95 m of street), or let the first banked payout pop once with "+25 for your delivery".
- **City 52417**: the street bot makes two drops there. The best lazy run on another city (2,449) is above it. More fresh cities would show whether this is one city or the shape.
- Everything in the brief ran. Each bot set ran once on the final scoring (low, high, guards), so per-run noise of about one delivery is not averaged out.

## Screenshots (`builder-shots/`)
- New player, phone: `t25b-m-130-*` and `t25c-m-130-*` (pickup pop, then layers after 30 s), Android `t25b-a-317-*`.
- New player, desktop: `t25b-d-22-*`. Returning: `t25ret-d-22-*`.
- Before the slot and floor fixes: `t25-m-130-ov1.jpg` (pickup pop over a close drone), `t25-a-317-ov2.jpg` (first-medal banner on a big drone).

## Files changed
- `src/game/config.ts`: delivery score (`baseScore`, `perMetre`, `fastBonus`, `fastPerSec`, `fastSecCap`), rush bonus, street bonus bank rates, medal lines.
- `src/systems/DeliverySystem.ts`: drop points use `perMetre` and the time bonus. The delivered event carries `plain` and `fastPts`.
- `src/game/Game.ts`: teaching layer (`returning`, `shown`, `teach`, `teachNow`, `reveal`, `updateTeach`, `TEACH`, `TEACH_HINTS`, `TEACH_ORDER`, `PLAYED_KEY`, `gateRoot`), quiet payouts before the slip layer, deferred first medal banner, delivery and pickup pop text, gate tag placement (`gateFoot`, `gateTagPlace`), `teach` in diagnostics.
- `src/ui/Hud.ts`: `setTeach`, `learn`, `hintPop`, `showViewHint`, `gateTagSize`. `armSlipHint` and `armViewHint` take an on/off switch. First-medal banner text. Pop slot 100 px left of centre.
- `src/systems/CameraRig.ts`: `SWING`, `updateSwing`, `keepRoom`.
- `src/styles.css`: teaching CSS gates.
- `src/vite-env.d.ts`: `teach` in the diagnostics type.
- Bloom clamps in `ObjectiveMarker.ts` and the bot hooks are untouched.
