# Drone Dash: round 24 builder notes

Main concern: the phone HUD. Small leftovers: the promenade centre line (A) and route mark steadiness (B).

Own dev server on 127.0.0.1:5190, stopped at the end. The owner's server on 5188 was left alone. Every browser ran alone, one after the other.

Timing note: the Mac went to sleep during headless runs three times. Each time the clock jumped 30 to 90 minutes, and the run came back with few frames. Those runs were thrown away and run again. This used up a large part of the time box, so several regression checks were **not run** (see the end).

## Design

### 1. Drone clear of the top pills (touch only)
`Game.updateTouchFraming` runs after the camera rig each frame. On a touch screen it shifts the rendered view down with a projection offset (`camera.setViewOffset`). It moves just far enough to keep the drone's top edge 12 px below the centre column. The centre column holds the timer, objective and route pills. It never pushes the drone into the bottom meters, and it never moves more than a third of the screen. The offset engages fast and lets go slowly. The camera's position, its collision handling and the desktop view do not change. The pad marker, the gate tag and the probes all use the same projection matrix, so they stay consistent.

### 2. Pad marker never on the stick or buttons (touch only)
`Hud.touchLayout(w, h)` reads boxes from the DOM. It measures the stick with its "Fly" label, the buttons, the score panel, the centre column, the right chips and the meters. It measures every 300 ms, never every frame. `Game.navTouch` then tests the marker's real footprint against those boxes. The footprint covers the diamond and the distance pill. A clamped marker also adds the arrow's whole box, turned to its angle. While a centre pop shows, the pop slot is tested too. If the footprint hits a box, the marker walks the screen edge in both directions and takes the first free spot. The arrow then points from that spot to the target. On an iPhone 13 held sideways, a pad to the lower left now shows just right of the stick, not on it.

### 3. Centre pops off the drone (touch only)
On touch, all four centre pops (delivery/pickup/crash, payout, medal, event) share one slot. The slot sits left of the drone, between the score panel and the stick. Its right edge is 72 px left of the screen centre. Its left edge is the safe-area gutter. The HUD sets `--pop-x`, `--pop-y` and `--pop-w` from the measured layout. Long lines wrap inside the slot. Fonts are a little smaller on touch, and the payout pop rises less, so it never climbs into the score panel. Desktop CSS is unchanged.

### A. Promenade
The white-looking "lane line" came from emissive amber dashes (`#ffd27a`, `Style.emissive`), drawn where the diagonal crosses a road. They bloomed to near white. They are gone. Road crossings now get the same light stone bands as the block parts (`CityGenerator.ts`), so the diagonal has no centre line anywhere.

### B. Route mark hysteresis
In `Game.updateMark`:
- Inside the marked run (stage "through", in the run or within 10 m of its exit), the mark never moves or drops. Before, a neighbouring alley took over the mark at times.
- Otherwise the mark moves or drops only after one of two things. One: the planner disagrees with it for 2 s in a row (`MARK_COMMIT`). Two: the drone is 20 m further from the marked entrance than its closest point so far (`MARK_AWAY`). A single agreeing re-plan resets the count.

## Numbers

New probe: `builder-scripts/hud-probe.mjs` with `hud-probe-init.js`. It is hand-fly23 (low street line, then a straight line at 40 m), sampled at 10 Hz from the DOM. It reads the visible `.nav-arrow`, `.nav-diamond` and `#nav-distance` boxes, the stick and buttons, the timer, objective and route-hint pills, and the 4 pops. The drone box is new: `__GAME__.droneBox()` projects every visible drone vertex through the real render camera. The earlier world-AABB box was about 3x too big.

| Run | Samples | Marker on stick/buttons | Drone under pills (all / above 30 m) | Pop covers drone (of pop samples) | First payout | p95 |
|---|---|---|---|---|---|---|
| Before, iPhone 13, seed 22 | 791 | **119** (15%) | **34.1%** / **89.2%** (74 of 83) | **90.9%** (170 of 187) | 5.3 s | 9.3 ms |
| After, iPhone 13, seed 22 | 644 | **0** | **0%** / **0%** (48 high samples) | **0%** (0 of 131) | 6.7 s | 9.3 ms |
| After, iPhone 13, seed 130 (40 s at 40 m) | 739 | **0** | **0%** / **0%** (104 high) | **1.4%** (2 of 141, event banner) | 5.5 s | 9.7 ms |
| After, Android 915x412, seed 22 | 696 | **0** | **0%** / **0%** (93 high) | **0.7%** (1 of 137) | 6.8 s | 9.6 ms |
| After, desktop 1280x720, seed 22 | | (touch only) | | | 5.8 s | 9.4 ms |

Acceptance 1 to 3: pass on all three phone runs. Max frame 16.7 ms on iPhone, one 158 ms hitch on Android. Logs: `before-m-22.log`, `after-m-22.log`, `after-m-130.log`, `after-a-22.log`, `after-d-22.log`.

Promenade (acceptance 4): `promenade24.mjs` (critic's script, port changed). `builder-shots/prom-d-22-*` and `prom-d-4-*` show stone bands across the diagonal and no centre dashes. The short white marks still visible at crossings are the cross road's own markings.

`npm run build`: pass. Type check clean. JS 824 KB (231 KB gzip), CSS 38.8 KB.

## Not run (time box, lost to the sleeping Mac)
- Route mark before/after per 100 legs (acceptance 5). The hysteresis is in, but it is **not measured**. Next step: run the critic's `route-sign20.mjs` against it.
- Phone runs on seed 22 and 130 ran once each. Promenade screenshots for the phone (`prom-m-*`) did not finish. Only desktop shots were taken.
- Flat-frame probe, crash-classify on 22/58/130, low and high bots, cam-clip and frame-check, and a side-by-side desktop HUD diff. Desktop code paths are untouched by the HUD work, because `touchLayout` returns null and the shift stays 0 without the `touch` class. The route mark change does affect desktop and bots.

## Screenshots (`builder-shots/`)
- Before, phone: `before-m-22-h04-low-payout-pop.jpg`, `before-m-22-h06-high-wind.jpg`, `before-m-22-h08-end.jpg`, `before-m-22-ov*.jpg`.
- After, phone: `after-m-22-h04-low-payout-pop.jpg` (pop left of the drone, marker beside the stick), `after-m-22-*`, `after-m-130-*`, `after-a-22-*`, `after-iphone-22-b-high.jpg` (60 m, drone below the pills).
- After, desktop: `after-d-22-*`. Promenade: `prom-d-*`.

## Files changed
- `src/game/Game.ts`: touch framing (`updateTouchFraming`) and touch marker placement (`navFootprint`, `navTouch`, a touch branch in `updateNav`).
- `src/game/Game.ts`: route mark hysteresis (`MARK_COMMIT`, `MARK_AWAY`, `markDisagree`, `markMinGate`) and the `droneBox` test hook.
- `src/ui/Hud.ts`: `isTouch`, `touchLayout`, `popShowing`, and the `Box` and `TouchLayout` types.
- `src/styles.css`: touch pop slot and its sizes, `slip-rise-touch`.
- `src/world/CityGenerator.ts`: diagonal dashes replaced by stone bands.
- `src/vite-env.d.ts`: `droneBox` in the debug API type.
- Bloom clamps in `ObjectiveMarker.ts` and the existing bot hooks are untouched.
