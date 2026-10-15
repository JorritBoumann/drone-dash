# Drone Dash, round 14 builder: the street bonus

Concern from the round 13 critic: the score did not need parcels. Slipstream payouts scored on their own, so a no-delivery wall farm made about 3,400 points a minute and reached Silver every time.

## Design

Slipstream points now come in only through the parcel.

- **Banked, not scored.** Each slip payout banks points into a "street bonus" for the current parcel run. The score does not move. The pop near the drone says "+37" with "Banked · chain x2".
- **Paid on delivery.** On a drop the whole bank is paid at once. The centre pop shows the total, for example "+812" over "Fast drop · x2.0 combo · street bonus +412". A teal "+412 Street bonus paid" pop shows at the drone.
- **Lost if not delivered.** At time-up, the bank is lost. A hard crash or a wreck (crash tier 1 and up) halves the bank, and the crash pop says "bonus -N". The crash clock and combo rules are unchanged.
- **Rates.**
  - With a parcel aboard, a payout banks its full points. On the way to a pickup it banks 0.75 of them, and that bank rides on the parcel you pick up.
  - New: a pace weight. Each payout is multiplied by the meter's mean fill rate while it filled (draft metres a second, the same measure as the HUD chevrons). The weight is 0.2 at 2.5 m/s or less, 1 at 6, and at most 2.5. A slow centred crawl banks a fifth. A fast line along the facades banks 1.5 to 2.5 times.
  - Balance bots: the lazy flier's payouts average a pace of about 3. The routed street bot's run from 4 to 14.
- **Leg cap.** Each leg banks at most 7 points per metre of its street route (grid distance), and at least 150. Honest street legs reached at most 6 per metre on the bots. The cap stops "carry a parcel and circle a wall" from paying without limit.
- **Unchanged.** The meter, chain, chain audio and adaptive music stay. Each payout still refills boost. The round 12 to 13 slow clock rules stay: only toward the objective, 8 s budget per leg.
- **HUD.**
  - A small "BONUS +208" chip at the end of the objective pill. On phones it shows only "+208". At 0 it is hidden. It bumps when it grows. Before pickup it is dimmer.
  - New title tagline: it now says the slipstream banks a street bonus that a delivery pays.
- **One seconds number.** The timer is now the only seconds figure on screen.
  - The badge says "SLOW CLOCK", "CLOCK FROZEN", "SLOW CLOCK SPENT" or "SLOW CLOCK: WRONG WAY". The leg's budget shows as a small bar that empties, with no "7S".
  - The payout pop no longer shows "clock +Ns".
  - Badge text is 12.5 px on desktop (was 9.9) and 10.6 px on a sideways phone. The centre column gap grew from 8 to 14 px so the badge sits clear between the timer and the pill.
- **Breakdown.** The "Slipstream" row is now "Street bonus" (paid points), with detail such as "paid on 5 drops · 177 lost". The lost amount is shown but not added in. The rows still sum exactly. The clock line is unchanged.

## Acceptance results (dev server 5188, scripts in `builder-scripts/`)

**1. Zero-delivery runs score under 1,000.** Pass. All score **0**.
- farm-probe, all 8 rows: 0. They are still 58 s long with 8 s of slow clock, as before.
- farm-loop seed 22: 0.
- smart-farm on seeds 22, 58 and 130: `near` 0/0/0 and `line` 0/0/0. `pickupline` and `spendpickup` (roads 66 and -22): 0 in all 12 runs.

**2. Farm points a minute are at most 0.5 times the street bot's.** Pass. The farms make 0 a minute. The street bot makes 2,124 (pass A) and 2,113 (pass B).

**3. Round 10 test, two passes (SIMT 600):**

| Run | Seed 22 | Seed 58 | Seed 130 | Total |
|---|---|---|---|---|
| Low A | 6,882 Gold | 2,046 Silver | 4,594 Gold | 13,522 |
| Low B (music-run) | 6,927 Gold | 2,088 Silver | 4,476 Silver | 13,491 |
| High A | 5,428 Gold | 4,074 Silver | 4,859 Gold | 14,361 |
| High B | 6,732 Gold | 4,069 Silver | 3,945 Silver | 14,746 |
| Lazy A | 1,249 Bronze | 516 none | 626 none | 2,391 |
| Lazy B | 1,220 Bronze | 520 none | 0 none | 1,740 |

- Low / high totals: worst pairing 13,491 / 14,746 = **0.91**, so all pairings are at least 0.91. Pass.
- Low: Silver 3 of 3 and Gold at least 1 in both passes. Pass.
- High: Silver 3 of 3 in both passes. Pass.
- No route bot at Ace: the best is 6,927, and Ace is now 8,500. Pass.
- Breakdown exact: diagnostics and game-over DOM add up in 18 of 18 runs. Pass.
- Lazy at Bronze or below in both passes. Pass.
- The high bot ran stronger this round (seed 22 base 5,389 to 6,609, against 3,618 to 3,962 in round 13). This is bot variance. Its street bonus is small: 36 to 487.
- Lazy B seed 130 scored 0: 0 deliveries in that real-time pass.
- Points a minute, lazy / low: 0.31 (pass A) and 0.25 (pass B).

**4. Margins.** Pass.
- The best lazy run is 1,249 and the worst street run is 2,046. They are **797** apart.
- Bronze 1,000 is 249 below the lazy best and 1,046 below the street worst.
- Silver 1,650 (was 1,600) is **401** above the lazy best and **396** below the street worst.
- Gold 4,500 and Ace 8,500 are far from both.
- Not required, but note: low seed 130 straddles Gold (4,476 and 4,594), and two high runs sit near Gold (4,069 to 4,074).

**5. Wall hug and first payout.** Pass.
- Wall hug. The plain hug-probe passes, but its numbers are flattened by the leg cap: the probe never picks up, so the 38 m pickup leg caps the bank at 266. Road 66: centre at cruise / centre at 9 m/s = 266 / 21 = 12.7. Hug at cruise / centre at 9 m/s = 669 / 21 = 32.
- With the cap off (`hug-probe-uncap.mjs`): centre at cruise 735 to 752, hug at cruise 2,224 to 2,226, centre at 9 m/s 21. That gives 35x and 106x.
- First payout. Desktop: 1.5 s after the first draft (5.5 s into the run). Mobile: 3.2 s after (7.2 s). Both show a visible "+7 / Banked · street bonus" pop, and the objective pill chip shows "BONUS +7" (see `d-h04-low-payout-pop.jpg`, `m-h05-low-payout-chain.jpg`). The first banked amount is small because the intro payout is slow (pace weight 0.2).

## Regressions

- **Crash-classify, 8 seeds.**
  - 12 m: 819 s, 27 deliveries, 51 charged crashes, **0 hop-like**. 6 were within 30 m of the target. One needs a look: seed 7 at 71.45 s, Bay Lofts Rooftop (pad 32.5 m). The drone was climbing (climb held) at y 28.4, skids about 5.5 m under the 33 m roof edge, and hit the facade. The pad-edge rule exempts only hits within 4 m of the edge, so this was charged as a real face hit. The other 5 hit faces with tops 7.4 to 39.4 m over street pads.
  - 20 m: 792 s, 30 deliveries, 32 charged, **0 hop-like**, 3 near the target, **0 on a pad lip**.
  - Crash and flight code were not touched this round.
- **Flat-frame probe:** 979 frames, 0 flat, 0 errors.
- **Music:** adaptive. Chain 0 to 3 goes from intensity 0.33 to 0.65 or more, and from 1 to 3 or more layers. At most 6 steps had no music, at time-up.
- **Medal journey:** desktop 6,903 Gold and mobile 2,919 Silver. Both are below Ace.
- **Performance:**
  - Desktop journey: median 8.3 ms, **p95 9.8**, max 18.0, 0 over 20 ms.
  - Mobile journey: p95 9.8, max 10.4.
  - Hand-fly: desktop p95 9.7, mobile p95 9.9.
- **Build:** `npm run build` is OK. JS is 730 KB (198 KB gzipped).
- Bloom clamps in ObjectiveMarker.ts are untouched. The debug hooks are kept, and the diagnostics gained `slipstream.bank/bankTotal/bankPaid/bankLost/legBanked/legCap` and `scoreLog`.

## Not done / open

- A one-delivery farm (carry a parcel, hug a wall, then deliver) was not probed. The leg cap limits it to 7 points per metre of the leg's street route, plus the drop. On a 100 to 250 m leg that is about 700 to 1,800.
- Medals now often arrive in lumps on delivery. Bronze and Silver were passed on the same drop in several runs, and the HUD shows both.
- Silver was changed from 1,600 to 1,650 after the bot passes. Medal lines do not affect flight, and no run scored between 1,600 and 1,650, so the logged medals stand.

## Files changed

- `src/game/config.ts`: SLIPSTREAM bank settings, Silver 1,650, Ace 8,500, comments.
- `src/game/Game.ts`: bank, pace weight, leg cap, paid on delivery, crash cut, pops, game-over fields, diagnostics, scoreLog.
- `src/systems/Slipstream.ts`: payout event carries `pace`.
- `src/systems/DeliverySystem.ts`: delivered event carries `legTime` and `par` (log only).
- `src/ui/Hud.ts`: `setBank`, new `slipPop` signature, badge words and budget bar, "Street bonus" breakdown row.
- `index.html`: bonus chip, badge text and bar spans, tagline.
- `src/styles.css`: chip, badge size and bar, centre gap, paid pop.
- `src/vite-env.d.ts`: diagnostics types.

## Scripts

All in `progress/round-14/builder-scripts/`. They are copies of the round 13 critic scripts, with output going to `../builder-shots/`.

- New: `tune-play.mjs`, a deterministic route bot. It uses `externalClock`, takes CRUISE, NOBOOST and UNCAP, and dumps the scoreLog.
- New: `rescore.mjs` and `grid.py` for offline rescoring.
- New: `farms14.sh`, `queue14.sh`, `summarize.py`, `hug-probe-uncap.mjs`.
- Tuning logs: `tune3/`.
- Note: earlier tune runs in `tune/` and `tune2/` were not deterministic, because the page also ran in real time. Ignore them.
