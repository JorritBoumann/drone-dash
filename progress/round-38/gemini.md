# Round 38: Gemini review

Model: Gemini 4 Argon, thinking level High, in the Gemini app on Jorrit's Pro account, 2026-10-19.

Input: the 7 stills and 2 gameplay videos in `gemini-media/`, and a prompt that asked for a blunt critique at publisher level. The videos were re-encoded to H.264 MP4 at about 1.2 Mbps to fit the 10 MB upload limit.

Status: a second opinion. The builder and critic use it as input, not as a verdict. Some claims conflict with what earlier critics measured. The lead's notes at the end list them.

## 1. Verdict (Gemini)

The game feels like a polished technical prototype, not an arcade game that people replay. The loop on paper is sound: drafting near walls banks a bonus, par times reward speed, and seeded daily cities give variety. But the flight feels disconnected. The drone stays level. The camera is stiff. Crashes feel soft. Every pickup and drop forces a full stop. Gemini says: make 30 seconds of raw flight exciting first, and do not add more rules.

## 2. Game feel (Gemini, with video timestamps)

- Speed: at 0:13 in video 08 the HUD shows 31 m/s at 5 m, but the flight looks slow. The field of view (FOV) does not change, and the camera has no spring lag. Boost only adds cyan dots.
- Flight physics: the drone stays almost flat while it moves (0:02 to 0:07, 0:18 to 0:22). It does not pitch to speed up or roll into turns.
- Pickup and drop: the drone stops in a cylinder for about 1.5 s while a ring fills (0:07, 0:23, and 0:20 in video 09). This stops the flow every 15 s.
- Crash at 0:40.7: the drone stays level, slides back about 1 m, and the screen flashes red. Gemini saw no tumble, no camera shake and no sparks.
- Feedback: slipstream pops appear in the left HUD, away from the drone. A delivery gives a small puff and a text toast.
- Readability: dark cars and trees blend into the asphalt in shadow (0:11 to 0:15). On the phone the large cyan target arrow covers the drone and the road ahead (video 09, 0:10 to 0:20).

## 3. Visual and art direction (Gemini)

What works:
- Golden-hour light, warm haze and long street shadows (01, 03, 06).
- Warm window light at dusk (03).
- The island scale and varied heights from the air (01, 03).
- The harbour, which breaks the grid (01, 04).
- The drone silhouette, and the clean title and game-over cards.

What looks cheap or inconsistent:
- Flat street shadows with no contact shadows where objects meet the ground (02, 03).
- A style clash at street level. Noisy brick and shutter textures stand next to flat low-poly trees and faceless people (02, 05).
- Water with repeating fine detail and harsh glints at low angles (04, video 08 0:28 to 0:35). The drone casts a dark blob shadow on it, and the dock foam is square.
- Rotors that look like still discs.
- A small parcel cube that never swings.
- Callouts such as SLIPSTREAM and COMBO with heavy shadows and red boxes that clash with the cream HUD pills.

## 4. UX and HUD (Gemini)

- The title screen shows too much: a pitch line, 5 controls, 3 city buttons and 4 medal lines. The first pickup itself is clear, with its beam, distance diamond and label change.
- Text banners teach rules during flight (SLIPSTREAM, COMBO, RUSH HOUR, SLOW CLOCK). A player who dodges traffic cannot read them.
- On desktop the gauges for slipstream, boost, speed and altitude are small and sit far in the bottom-left corner.
- On the phone about 40% of the screen is UI. At the title change the touch controls overlap the medal lines (video 09, 0:01). The waypoint marker covers the drone in flight (07).

## 5. Top 7 improvements (Gemini, ranked)

1. Fly-through pickups and drops. If the drone enters an arch, the pickup or drop happens at once, with no stop. Fast passes earn a bonus. Test: mean speed in the 3 s around a pickup rises from under 3 m/s to over 14 m/s, and 80% of players keep their chain.
2. Flight physics and a speed camera. The drone pitches with acceleration and rolls with turns. The camera lags on a spring. The FOV widens from about 55 to 78 under boost. Speed lines show above 20 m/s. Test: players rate the speed at 4.2 of 5 or higher.
3. Crashes by impact angle. A shallow hit, under about 25 degrees, becomes a scrape. It gives sparks and some speed loss but keeps the combo. A head-on hit gives a tumble, camera shake and a rotor sound. Phones vibrate. Test: 40% fewer crashes that wipe the combo while drafting.
4. HUD on the drone. Boost and slipstream show as light arcs on the drone. The bottom bars and the text banners go. The target beacon rises so it never covers the drone. Chevrons on the street show the route. Test: phone HUD coverage drops from about 38% to under 12%.
5. One art style. Replace the noisy brick with clean colour blocks, painted gradients and fake ground shadow. Use stylized two-tone water. If the drone is low over water, show a ripple ring from the rotors, not a blob shadow.
6. A physical parcel. The parcel is larger, hangs on a line and swings. Parcel types differ, for example a pizza stack, a heavy battery or a VIP canister. On delivery it arcs onto the pad with a bounce and confetti.
7. Easy onboarding. The title shows only the logo, PLAY and DAILY CITY. The first run shows no rule banners. The game teaches rules with sound and light cues, not text.

## 6. Biggest risk (Gemini)

The cities all feel the same. Every city plays like one grid of straight streets, so random and daily cities add little replay value. Gemini wants set pieces: bridges, cranes to fly through, raised roads, canals, crooked alleys, and towers with skybridges.

## 7. Bold ideas (Gemini)

- Moving targets: drop a parcel on a speedboat, into a taxi sunroof, or onto a window-washer platform.
- Parcel chains: carry up to 5 parcels on a swinging cable. A hit snaps the tail. A clean drop multiplies the pay.
- A daily-city ghost swarm of other players' paths, and a short replay clip of the best near miss on the game-over card for sharing.

## Lead's notes (Claude)

- Check some claims before acting. Round 4 added a crash tumble, camera shake and sparks, and round 5 made slow scrapes free. Gemini saw none of that at 0:40.7. The effect is either too weak at that impact speed, or Gemini missed it. The 1.5 s stop at pads, the flat drone, the fixed FOV and the rotor look also need a new measurement.
- Item 5 (simpler colour blocks) goes against the owner's request for more detail and realism in round 27. The owner decides.
- Items 1 to 4 and 7 are clear and testable, and they match the open questions of the critics about feel. Item 6 and the bold ideas are content choices for the owner.
