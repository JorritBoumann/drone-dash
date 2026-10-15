# Drone Dash, round 15 builder: run variety

Concern from the round 14 critic: every run is the same run. With no seed, every load built seed 7 with the same first pickup, and nothing new happened after the first minute.

## Design

### 1. City variety

- **A fresh load builds a new city.** With no `?seed`, the game picks a random 5-digit seed (10000 to 99999). The title and game-over cards show "City 48213".
- **Daily city.** The title has two buttons: "New city" and "Daily city". The daily city is `?daily`. It has one seed per local calendar day (FNV hash of the date). Each daily attempt also reseeds the parcel order, so every attempt on that day gets the same city and the same parcels. The daily city keeps its own best score and medal in localStorage (`drone-dash-daily-v1`, try/catch). The overall best still counts every run. `?daily=YYYY-MM-DD` opens a given day.
- **Labels.** Title: "Daily city · Thu 15 Oct" plus "Daily best 515". On short phone screens the daily best moves into the label. Game over: the city line under "Time's up", "Daily best N" with a "New daily best!" tag.
- **Game over.** "Fly again" is now "Replay this city" (same id, `again-button`). A new "New city" button loads a random city.
- **`?seed=N` is unchanged.** The 8 test seeds give the same sites, colliders, trees and first pickup as before. I checked this by fingerprint against the unmodified generator. Seed 7 still gives fingerprint 4e56fcf3 and "Juniper Lofts Rooftop".
- **Fair pads on any seed.** New `src/world/padAudit.ts` checks every pad:
  - Buried: the drone's landing sphere overlaps a box.
  - Overhang: any collider within 1.2 m of the pad centre in the column above it (drone radius 0.95 m plus margin).
  - Awning: a drawn-only awning within 0.95 m. It has no collider, but the drone then flies through it.
  - Outside: the pad is outside the city.
  - Streets are open at every height, so a pad with a clear column is reachable. The `__GAME__.padAudit(seeds)` hook builds cities without rendering them.
- **Two generator fixes, both RNG-neutral.** Every random number is still drawn in the same order, so other cities do not change.
  - A park tree whose canopy would come within 1.2 m of the park pad is still rolled, but not planted. This affected 4 of 60 random seeds, and none of the 8 test seeds.
  - Awnings reach 0.5 m from the facade (was 1.1 m), so none hangs over a doorstep pad. Before this, 2,788 doorstep and awning overlaps were found across 68 seeds. This change is only visual.

### 2. Escalation: rush hour

- **Why rush hour.** I chose a rush order over a gust front or a closed street. It fits a street courier and the warm art style (coral is the game's existing alert colour). It does not change flight, so crash and bot behaviour stay the same.
- **When.** At 60 s of run time a "RUSH HOUR" banner shows once, with a two-note courier horn and a small camera kick. From then on, every second parcel is a rush order. From 120 s, every parcel is.
- **Rush window.** It is the leg's street route / 11 m/s + 5 s. The fast-drop par is route / 9 + 7. If a parcel is already aboard when rush hour starts, it becomes the first rush order.
- **Payout.** A rush order delivered in time pays a flat +150 (no combo). A missed window shows "Rush missed / Still deliver it", and the parcel pays as normal. Rush hour adds no clock time and never touches the objective RNG.
- **HUD.**
  - A coral "RUSH 15" tag in the objective pill, with a bar that empties and pulses in the last 5 s.
  - A coral dot, verb and nav diamond, and a coral drop beacon (`RUSH_COLOR` in ObjectiveMarker, with the same intensities, so the bloom clamps hold).
  - A "Rush order!" pop and a rising double beep on pickup.
- **Breakdown.** New "Rush orders · N of M in time" row. Rush points are inside `breakdown.fast` (and also in `breakdown.rush`), so drops + fast + combo + slip still equals the score exactly. The DOM rows still sum too: the "Fast drops" row shows fast minus rush.
- **Diagnostics.**
  - `escalation`: kind, on, startedAt, stage (0, 1 or 2), orders, made, missed, points, active, left, window.
  - `city`: mode, seed, date, dailyBest, dailyTier.
  - New scoreLog kinds: rushhour, rushorder, rush, rushmiss.

### 3. Early drafting feels paid in the moment

- The run's first payout banks at least 25 (`SLIPSTREAM.bankFirstMin`). It was about 7. It is still banked, so a run with no delivery still scores 0.
- The banked amount counts up in the pill instead of jumping.
- From the first payout, a "+60" chip sits next to the score. It is dimmer before pickup. The score no longer reads a bare 0 while you draft.
- The tagline is now one sentence.

## Acceptance results (dev server 5188, scripts in `builder-scripts/`)

`*-e.mjs` are log-only copies that add the escalation fields to the MEDAL line. Their control logic is identical to the copied scripts.

**City variety (`variety-probe.mjs`, `variety15.mjs`):** pass.
- 3 of 3 fresh loads give a different city and first pickup:
  - 528c9c2c / Fountain Park
  - dde7fc4f / Union Lofts
  - a8f4e943 / Harbor Lofts
- Daily: seed 45900 on 15 Oct in 3 of 3 loads, same fingerprint. A mocked 16 Oct gives seed 68757, a different city.
- Daily best: saved separately as `{"date":"2026-10-15","best":515}`. The title shows "Daily best 515". On the mocked next day it shows 0. A random city shows no daily line.

**Generator sweep (`pad-sweep.mjs`):** pass.
- 8 test seeds plus 40 random seeds: 4,417 pads, **0 issues**. An earlier run of 60 random seeds also had 0.
- Same seeds with both fixes switched off (`pad-sweep-before-fix.log`): 4 park-tree overhangs and 2,788 awning overlaps. This shows the audit catches problems.

**Escalation in low-bot runs:** pass.
- In all 6 low runs on 22, 58 and 130 (two passes), rush hour started at t = 60 s and shows in diagnostics.
- Rush orders per run: 1 to 3. Made: 1 to 2. Rush hour also showed in all high runs and in every lazy run that lived past 60 s.

**Round 10 test (SIMT 600):**

| Run | Seed 22 | Seed 58 | Seed 130 | Total |
|---|---|---|---|---|
| Low A | 7,151 Gold | 2,276 Silver | 4,659 Gold | 14,086 |
| Low B (music-run) | 7,244 Gold | 2,254 Silver | 4,370 Silver | 13,868 |
| High A | 4,287 Silver | 4,308 Silver | 6,082 Gold | 14,677 |
| High B | 5,737 Gold | 4,244 Silver | 3,280 Silver | 13,261 |
| Lazy A | 1,426 Bronze | 594 none | 0 none | |
| Lazy B | 1,385 Bronze | 583 none | 639 none | |

- Low / high: the worst pairing is 13,868 / 14,677 = **0.94**. Pass.
- Low: Silver 3 of 3 and Gold at least 1 in both passes. High: Silver 3 of 3 in both passes. No Ace (best 7,244). Pass.
- Breakdown exact (bdOk and domOk) in 18 of 18 runs. Lazy at Bronze or below. Pass.
- Note: the lazy bot made its rush order on seed 22 (+150), so its best rose from 1,249 to 1,426.

**Margins:** pass.
- Best lazy 1,426. Worst street 2,254 (low seed 58). Gap **828**.
- Bronze 1,000: 426 below the lazy best.
- Silver 1,650: **224** above the lazy best and **604** below the worst street.

**Untuned random seeds 51334, 19465, 79373, 85299:**

| Bot | 51334 | 19465 | 79373 | 85299 |
|---|---|---|---|---|
| Low | 2,008 Silver | 2,505 Silver | 6,328 Gold | 7,877 Gold |
| High | 3,621 Silver | 2,612 Silver | 3,200 Silver | 4,360 Silver |
| Lazy | 382 none | 483 none | 558 none | 0 none |

The medal lines hold off the test seeds: street at least Silver 8 of 8, lazy at most 558, no Ace (best 7,877, 623 short).

**No-delivery farms:** pass. 30 of 30 farms (farm-probe 8, farm-loop, smart-farm 21) score **0**.

**Capfarm, which delivers:**
- honest: 7,198 / 2,238 / 4,809
- carry: 2,733 / 1,108 / 0
- both: 1,483 / 1,655 / 0
- Points a minute: carry 953 and both 844, against honest 2,180, so **0.44** and **0.39**. The real-time low bot made 2,190 to 2,207 a minute.

## Regressions

- **Crash-classify-v, 8 seeds.** Vite reloaded the page after an edit and the first try died. I re-ran it.
  - 12 m: 733 s, 23 deliveries, 44 charged crashes, **0 hop-like**, 7 near the target, **0 on a pad lip**. Every near-target wall top was 5 to 20 m above the pad.
  - 20 m: 781 s, 30 deliveries, 35 charged crashes, **1 hop-like**, 3 near the target, **0 on a pad lip**. The hop-like case is seed 33 at 75.8 s, 98 m from the target. The drone was at 18.8 m and hit a face with a 23.4 m top (4.6 m under it). It lost 7.1 m/s and rose 1.0 m. It is the same kind as the single case the round 14 critic judged fair. Flight and crash code were not touched.
  - The bot is not fully repeatable: round 14 runs ranged from 819 to 847 s.
- **Flat-frame probe:** 1,039 frames, 0 flat, 0 errors.
- **Music:** music-run (low B) ran clean with adaptive music, same as round 14.
- **Hand-fly:**
  - Desktop: first draft 3.9 s, first payout 7.3 s with **+25 banked**. 9,571 frames, median 8.3 ms, **p95 9.7**, max 16.8, 0 over 20 ms.
  - Mobile: first payout 8.6 s (+25). p95 9.6, max 10.4.
- **Build:** `npm run build` passes. First load about 0.78 MB: JS 740 KB (201 KB gzip), CSS 34 KB, HTML 10 KB. lil-gui is a separate chunk.
- **Debug hooks:** kept. The bloom clamps in ObjectiveMarker are unchanged. Only the colour can switch.

## Changes made after the bot queue (HUD only)

- The "Rush order!" pop is skipped for 3.2 s after the rush hour banner, so they no longer stack (seen in `R-rush-sim-seed22-1.jpg`). If a parcel is aboard, the banner says "This parcel is a rush order".
- Short phone screens: the daily best moves into the city label. The kicker hides and the gap shrinks. The medal row and best line now fit (`V-m-title-daily.jpg`).

I checked these by rush-sim, the variety probes and the mobile shots, not by a full bot pass.

## Not done or open

- Bots rarely miss a rush window. They missed 1 in about 45 orders. It is a bonus for good routing, not yet a real squeeze for strong pilots. A tighter window (for example route / 12 + 3) needs a new balance pass.
- Medal journey and the hug probe were not re-run (not in this round's list).

## Files changed

- `src/game/cities.ts` (new): seed mode, daily seed, daily best storage, city URLs.
- `src/world/padAudit.ts` (new): pad fairness audit.
- `src/world/CityGenerator.ts`: park pad tree clearance (RNG-neutral), awning depth 0.5 m, `awnings` in the layout.
- `src/game/Game.ts`: city choice, daily reseed and best, rush hour, first payout floor, diagnostics, `padAudit` and `city` hooks.
- `src/game/config.ts`: `RUSH`, `SLIPSTREAM.bankFirstMin`.
- `src/systems/DeliverySystem.ts`: `tally.rush`, `addRush`.
- `src/entities/ObjectiveMarker.ts`: `RUSH_COLOR`, rush tint in `set`.
- `src/systems/AudioSystem.ts`: `rushHour`, `rushOrder`.
- `src/ui/Hud.ts`: city lines, rush tag, event banner, bank count-up, score pending chip, rush breakdown row.
- `index.html`, `src/styles.css`: city row, daily lines, game-over actions, rush tag, event banner, pending chip, shorter tagline.
- `src/vite-env.d.ts`: new diagnostics and hooks.

New scripts in `builder-scripts/`: `pad-sweep.mjs`, `city-fingerprint.mjs`, `variety15.mjs`, `rush-sim.mjs`, `title-mobile.mjs`, `medals.py`, `queue15.sh`, plus the `*-e.mjs` log-only copies. Screenshots are in `builder-shots/`: V-*, R-*, M-*, Q-*, d-h*, m-h*.
