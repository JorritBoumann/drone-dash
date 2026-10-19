# Round 39: Gemini Argon review of the flight feel

Model: Gemini 4 Argon, thinking level High, in the Gemini app on Jorrit's Pro account, 2026-10-19. The full answer is in his Gemini history as "Drone Dash Flight Feel Review".

Input: the two 30 s round 39 videos in `critic/` and a prompt that listed the flight-feel changes.

Status: a second opinion. The next builder uses it as input, not as a verdict.

## Verdict (Gemini)

Flight feel went from 3 out of 10 to 6.5 out of 10. The lean, the hanging parcel and the boost surge give the drone weight. Four things keep it from 8. The game feels fast only during boost. The camera pull-back plus the wide view shrink the drone to a speck. Scrapes are almost invisible. Head-on crashes feel like a mid-air hiccup.

## What works (Gemini)

- Bank and pitch with spring overshoot, for example the 32 degree bank out of the pad at desktop 0:20.
- The swinging parcel, the strongest new cue for mass (desktop 0:07 to 0:09 and 0:12).
- The boost surge: wider view, wake particles and edge streaks together (desktop 0:12 and 0:21).
- The rotor smear in hover (desktop 0:05).

## What is still weak (Gemini)

- Speed sense drops at the end of boost. Cruise at 13 to 15 m/s feels slow, and the edge streaks only start at 17 m/s.
- The camera pulls back while the view widens, so the drone becomes very small at speed. In steep descents the camera looks almost straight down. The 3 degree camera roll is not visible.
- The drone banks without any change in height, so it looks like it pivots on a rod.
- Scrapes are nearly invisible: a few sparks, no push away from the wall.
- Head-on crashes do not bounce back or drop. The drone wobbles in place in slow motion and flies on.
- Wake particles sit between the camera and the drone. On the phone the cyan target diamond covers the drone.

## Phone problems (Gemini)

- The drone is about 5% of the screen width at boost and hides behind the target diamond.
- In golden hour a dark drone over dark shadowed streets loses contrast.
- About 40% of the screen is UI.
- The phone shows no speed or height numbers.

## Top 5 next changes (Gemini, ranked)

1. Dolly zoom under boost: move the camera closer and lower as the view widens, not further back. Suggested offsets: (0, 1.8, 5.0) at rest and (0, 0.95, 3.4) at 31 m/s. Limit the camera's downward look to 28 degrees. Raise camera roll to about 9 degrees. Test: the drone keeps its screen width within 10% across all speeds, and stays at 11% of the width or more on phones.
2. Crash punch. Freeze for 60 ms (hit-stop) with camera shake. Rebound off the wall at about 45% of the speed. Drop the drone and stall the rotors briefly, then recover. Test: after a head-on crash at 20 m/s or more, the drone rebounds at least 3.5 m and drops at least 2 m within 0.45 s.
3. Visible scrapes. Push the drone away from the wall at about 3.5 m/s and roll it 18 degrees away. Add a small camera jolt. Add a bright spark ribbon at the contact point. Test: 5 of 5 viewers spot the contact frame in a muted clip with the UI off.
4. A clear centre. If the target diamond sits near the drone on screen, fade it or float it higher. Move the wake particles below the drone. Add a light rim on the rotor guards. Test: no UI icon covers the drone during a slipstream run. The rotor guards keep a contrast of at least 3.5 to 1 against shadowed asphalt.
5. Speed at cruise. Add faint air streaks around the camera from 8 m/s, stretching with speed. In hard banks, dip the drone slightly, and catch it again as it levels out. Test: a 2 point rise in perceived speed at 14 m/s, and a visible 0.4 to 0.8 m dip in hard turns.
