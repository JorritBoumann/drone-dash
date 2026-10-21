# Drone Dash

Drone Dash is a 3D delivery game for the browser. You fly a courier drone through a small island city against the clock. You pick up parcels and drop them at their pads. A run is a shift of five parcels: deliver the fifth before the clock runs out and the shift is complete, and every second left on the clock adds points. Glowing tailwind rings hang over the streets on the way to each pad. Fly through one for a free boost and a few extra seconds. A low, fast flight close to the walls builds a slipstream bonus, which the game pays out on delivery. Every load builds a new city, and the daily city is the same for everyone on a given day.

The game runs on desktop and on phones held sideways. It uses Three.js, TypeScript and Vite.

## Controls

| Action | Desktop | Phone |
| --- | --- | --- |
| Fly and turn | W A S D or the arrow keys | Left stick |
| Climb | Space | Up button |
| Descend | Shift or C | Down button |
| Boost (refills on its own; the tailwind rings give a free one) | E or left click | Boost button |
| Look around | Right-drag, or a two-finger trackpad swipe | Drag with one finger on an empty part of the screen |
| Zoom | Mouse wheel or trackpad pinch | Not available |
| Map on or off | M | Always on |
| Music on or off | N | Music chip on the title and pause screens |
| Pause | Escape or P | Pause button |

## Play locally

You need Node.js 20 or later.

1. Install the dependencies:

   ```bash
   npm install
   ```

2. Start the development server:

   ```bash
   npm run dev
   ```

3. Open http://127.0.0.1:5188 in a browser.

To play a specific city, add a seed to the address, for example http://127.0.0.1:5188/?seed=22.

Seed format (`?seed=`):

- A whole number from 0 to 4294967295 is that city. `22`, `022` and ` 22 ` are all city 22.
- A negative whole number keeps its sign as a 32-bit value: `-N` is city 4294967296 − N. So `-22` is city 4294967274, a different city from `22`.
- A larger whole number wraps around 4294967296 (`4294967318` is city 22). A number past 2^53 is hashed to a fixed city (the same number always gives the same city).
- Any other text (for example a hex string or a uuid) is turned into a fixed city from 10000 to 99999. The same text always gives the same city.
- An empty seed gives a random city. The game-over card shows the city number, so you can share it.

## Build

```bash
npm run build
```

The build writes a static site to `dist/`. The site uses relative paths, so it works from any folder and inside an iframe.

## Clone without the progress media

The `progress/` folder holds screenshots, videos and audio from the development rounds. These files are in Git LFS and total several hundred megabytes. The game does not need them. To clone without them, run:

```bash
GIT_LFS_SKIP_SMUDGE=1 git clone git@github.com:JorritBoumann/drone-dash.git
```

## Assets

The city, the drone, the people and the audio are made in code. Some street props, cars, trees, boats and textures come from Poly Pizza and Poly Haven under CC0 (public domain). `ASSETS.md` lists each asset with its source and author.

## How it was built

Claude Code built the game in rounds. In each round, a builder agent made one change, and a separate critic agent tested the real build in a headless browser. Codex and Gemini gave second opinions. The reports for each round are in `progress/round-N/`, and `progress.html` shows them with screenshots.
