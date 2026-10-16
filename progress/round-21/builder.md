# Drone Dash: round 21 builder report (player camera control)

Concern: let the player move the chase camera with the mouse, the trackpad or a finger. Owner feedback from his own playtest.

Build: f52e1b9 plus the uncommitted round 20 and 21 changes. My own dev server ran on port 5190 and is now stopped. The owner's server on 5188 was not touched. Every browser ran alone, one at a time.

## Controls chosen, and why

| Device | Orbit | Zoom |
|---|---|---|
| Mouse | **Right-drag** (middle-drag works too) | Mouse wheel, 3 notches = full range |
| Mac trackpad | Two-finger swipe: sideways turns the view, up and down tilts it | Pinch (ctrl + wheel). Safari pinch gesture events too |
| Touch | One finger dragged on empty screen | (none) |

- **Left button stays boost.** I did not use "left-drag past a threshold". With that, boost starts on the press and stops once the drag is seen. That wastes boost and blips the FOV. Right-drag has no conflict. A left press during a right-drag still boosts, and releasing it stops boost. The browser menu is blocked on the canvas.
- **Telling a trackpad from a wheel.** Ctrl+wheel always means pinch. Line or page deltas (deltaMode 1 or 2) mean a mouse. Any sideways delta means a trackpad. Chrome and Safari give a trackpad away with wheelDeltaY = -3 x deltaY. A whole 120-step notch means a mouse. After that, fractional deltas mean trackpad, and small whole numbers under 40 px mean trackpad. Once a gesture reads as a trackpad, it stays on that path for 250 ms, so its inertia tail does not switch to zoom halfway.
- **Directions.** Drag right looks right. Drag up looks up. A trackpad swipe acts like scrolling the view: scrolling right looks right, and scrolling down looks down from higher up. To flip it, change one line in `InputController.ts`.
- **Release.** The view holds still for 0.4 s, then eases back behind the drone. It is within 2 degrees about 1.2 s after release. The view stays where it is for as long as the right button or the finger is down. This is true also with no pointer movement.
- **Flight stays relative to the drone.** It was drone-relative before. A/D and the stick turn the drone's own heading, and the camera never feeds the steering. So looking around never changes what the keys do. The orbit is an offset on top of the chase yaw, so it turns with the drone.
- **Limits.** Camera elevation over the drone stays between 3 and 69 degrees. So the camera never goes under the drone or over the top. Zoom runs from x0.64 to x1.73 of the chase distance (about 4 to 11 m). It is saved in localStorage (`drone-dash-cam-zoom`, try/catch) after 0.6 s of no zoom input. Each new run resets the orbit and keeps the zoom.
- **Free look toggle: not added.** C is already "descend". A sticky view also needs a HUD badge to explain it. Holding the right button or a finger already keeps the view.
- **Arrival framing.** With no view input, the round 3 pitch-down near low targets is unchanged. With no input, every camera formula is the same as before. While the player orbits, that framing blends out, then comes back as the orbit eases home.
- **Collision.** The existing pull-in (spherecast from the drone to the camera) now runs on the orbited position. The follow is tighter while orbiting (lag 6.5 to 16.5 per second), so the camera swings round the drone instead of cutting across it. New last step: `CollisionWorld.pushOutPoint` moves the camera out of any solid box grown by 0.3 m. This covers orbiting toward the wall the drone is hugging, near-plane grazes, and impact shake. The 0.8 m street floor clamp is still there.

## Hints (kept small)

- Title, desktop: one new chip, "Right-drag or swipe look · scroll zoom" (`d-00-title.jpg`). Touch title line: "... · drag the screen to look".
- First-run hint: on the first two runs on a device, a small pill above the right end of the bottom bar. Desktop: "Right-drag or two-finger swipe to look around". Touch: "Drag the screen to look around". It shows from 1.5 s to 7.5 s and hides the moment the player orbits or zooms. When the slipstream meter comes on, the pill moves up above the meter and its own hint, so they never overlap. Measured gap: 13 px on desktop and on iPhone (`d-08-…`, `m-08-…`). Nothing else was added to the HUD.

## Acceptance (scripts in `builder-scripts/`, logs next to them)

| Test | Result | Pass |
|---|---|---|
| Desktop right-drag 200 px (`orbit-desktop.mjs`) | Camera swung 63 degrees round the drone. It held there for 1.2 s while the button stayed down | Yes |
| Release back behind | Within 2 degrees at 1.30 s (0.5 degrees by 1.5 s) | Yes |
| Left click without movement | Boosts (meter 1.00 to 0.83), view yaw 0, boost ends on release | Yes |
| Left press during a right-drag | Boosts. Releasing left stops boost, and the orbit carries on | Yes |
| Context menu | 0 menus got through | Yes |
| Pitch limits | Drag up: 3.4 degrees (minimum). Drag down: 68.8. A huge drag clamps at 68.6, no flip | Yes |
| Mouse wheel (real CDP wheel, 100 px notches) | Read as zoom, not orbit. 3 notches out: 10.0 m. 6 in: 4.1 m | Yes |
| Trackpad sideways swipe, fractional deltaX (`orbit-trackpad.mjs`) | 51 degrees of yaw, zoom unchanged | Yes |
| Trackpad vertical swipe, fractional, with and without deltaX | Pitch +27 and -14 degrees, zoom unchanged | Yes |
| Pinch (ctrl wheel) | In to 4.1 m, out to 11.1 m, yaw unchanged | Yes |
| Zoom saved across reload | Saved 0.550, after reload 0.550 (11.1 m). Blocked storage: still zooms, no error | Yes |
| Touch, iPhone 13 sideways (`orbit-touch.mjs`) | 150 px one-finger drag: 64 degrees. Back behind 1.6 s after lift-off | Yes |
| Stick drag alone | No orbit, drone flies | Yes |
| Stick plus Boost held plus a third finger orbiting | Drone turned 50 degrees and sped up from 1.3 to 20.7 m/s, boost on, view swung 81 degrees. All back behind after release | Yes |
| Camera in geometry, worst-case sweep (`orbit-geom-sweep.mjs`, deterministic) | Seeds 22, 58, 130. 137 spots: every alley (low and 7 m), every tunnel, 30 wall hugs at 0.97 m from a facade. Full held turn with the pitch rocking into both limits, at max and min zoom, then release. Checked every frame, including the moves between spots. **153,440 frames: 0 inside, 0 within 0.15 m (near plane), 0 below street** | Yes |
| Camera in geometry, 60 s real-time flight with random orbit (`orbit-fly.mjs`) | Desktop: random right-drags, wheel notches, trackpad swipes and pinches. 7,206 frames, 52% of them orbited, up to 131 degrees: **0 inside, 0 near, 0 below**. iPhone: a second finger orbiting while the stick and buttons fly. 7,209 frames, 66% orbited, up to 176 degrees: **0, 0, 0** | Yes |

## Regressions (round 20 critic scripts, only the port and output folder changed; `regress21.sh`)

| Check | Round 20 | Round 21 | Pass |
|---|---|---|---|
| Hand-fly first payout, desktop | 5.7 s | 5.7 s | Yes |
| Hand-fly first payout, mobile | 6.7 s | 6.4 s | Yes |
| Flat-frame probe | 991 frames, 0 flat | 1,012 frames, 0 flat, 0 errors | Yes |
| Crash-classify 12 m, seeds 22 / 58 / 130 | 5 / 10 / 9 charged | 7 / 7 / 8 (22 in 226 s, 5.8 a minute). 6 near the target, closest face 3.3 m below the wall top, 0 hop-like: **0 pad lips** | Yes |
| Low bot (music-run-esc) 22 / 58 / 130 | 3,867 / 2,798 / 4,104 = 10,769 | 5,148 Gold (5 drops) / 2,795 Silver / 3,821 Silver = 11,764. Breakdown and card exact on all 3 | Yes, normal spread (one extra drop on 22) |
| High bot (route-play-rt-x-m-esc17) 22 / 58 / 130 | 2,063 / 1,519 / 2,384 = 5,966 | 2,418 / 1,734 / 2,760 = 6,912 (one extra drop each) | Yes, normal spread |
| Low over high | 1.81 | 1.70 | |
| perf18, desktop | p95 9.2 ms | median 8.3, p95 9.2, max 16.8, 0 over 20 ms | Yes |
| perf18, iPhone | p95 9.4 ms | median 8.3, p95 9.9, max 16.6, 0 over 20 ms | Yes |
| Hand-fly 80 s frame time | | Desktop p95 9.7, max 16.4. Mobile p95 9.5, max 25.1 (1 frame over 20 ms) | Yes |
| Orbit flights frame time | | Desktop p95 9.6 (1 frame at 25 ms). Mobile p95 9.4, max 16.9 | Yes |
| `npm run build` | | Passes. JS 785 KB (216 KB gzipped), +7 KB | Yes |

Headless Chromium caps at 120 Hz, so the median sits at 8.3 ms. `ObjectiveMarker.ts` was not touched, so the bloom clamps are unchanged. All bot debug hooks are unchanged. New hooks were only added.

At low speed, the bots steer from the camera direction (`atan2(p - camera)`). With no orbit input the camera is unchanged, so this still works. Any future bot that orbits must steer from the new `player.yaw` instead (`orbit-fly.mjs` does).

## Files changed

- `src/core/InputController.ts`: `ViewIntent` and right/middle-drag orbit with pointer capture. Chorded-button boost and the context menu block. Wheel sorting (trackpad orbit, wheel zoom, pinch zoom) and Safari gesture pinch. Touch orbit on empty screen. `readView()`, `onView` and the test hook `injectView()`.
- `src/systems/CameraRig.ts`: smoothed orbit yaw and pitch offsets, the 0.4 s hold, then the ease home. Pitch clamp, and zoom with localStorage. Approach framing blended by `free`. Tighter follow while orbiting. The final push-out, `resetView()` and the `view` getter.
- `src/systems/CollisionWorld.ts`: `pushOutPoint()`.
- `src/game/Game.ts`: wires the view input into the camera, resets the orbit and arms the hint each run. Diagnostics: `camera.view`, `camera.behind` (yaw and elevation relative to straight behind), `player.yaw`, `player.boosting`. Hooks: `__GAME__.view()`, `insideSolid()`, `solidAt()`.
- `src/ui/Hud.ts`: `armViewHint()`, `viewUsed()`.
- `index.html`, `src/styles.css`: title chip, touch title line, `#view-hint` pill.
- `src/vite-env.d.ts`: types for the new diagnostics and hooks.

## Screenshots (`builder-shots/`)

- Orbited views: `d-02-right-drag-200px.jpg`, `d-04-drag-up-low-view.jpg`, `d-05-drag-down-left-high-view.jpg`, `t-01-trackpad-swipe-x.jpg`, `t-02-trackpad-swipe-y.jpg`, `m-02-one-finger-orbit.jpg`, `m-03-stick-boost-and-orbit.jpg`. The flight runs: `d-orbit-orbit1..4.jpg`, `m-orbit-orbit1..4.jpg`.
- Zoom: `d-06/07`, `t-03/04`.
- Hints: `d-00-title.jpg`, `d-01-behind.jpg`, `m-01-hint.jpg`, `d-08-…` and `m-08-view-hint-with-slip-hint.jpg`.
- Regression shots are in `builder-regress/`.

## Open points for the critic

- Sensitivities are guesses tuned on synthetic input: mouse 0.0055 rad/px, touch 0.0075, trackpad 0.0045, pinch 0.008 per px. Please try a real Mac trackpad by hand. Swipe direction and pinch speed are the likeliest to feel off.
- Max zoom-out (11 m) makes the drone small in narrow streets. It is the player's choice, but it could be capped lower.
