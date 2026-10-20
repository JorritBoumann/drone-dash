1. **High — one shot audio graphs are never disconnected.** [AudioSystem.ts](/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/src/systems/AudioSystem.ts:418), [AudioSystem.ts](/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/src/systems/AudioSystem.ts:882), [AudioSystem.ts](/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/src/systems/AudioSystem.ts:947)  
   Samples, tones, noise, bells, horns, and pass-bys create nodes connected to persistent buses, then stop their sources without disconnecting the graph. Repeated scrapes, ticks, deliveries, or rush horns can leave many ended nodes attached during a long session. Add cleanup on each source’s `ended` event that disconnects its source and temporary filters, gains, panners, and sends.

2. **Low — per-frame allocation in rotor update.** [AudioSystem.ts](/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/src/systems/AudioSystem.ts:634)  
   `updateRotor()` constructs the `det` array every frame while flying. On a 60 fps phone session, that creates needless short-lived garbage. Move the fixed detune values to a class-level constant.

3. **Low — sprite playback can truncate sample tails.** [AudioSystem.ts](/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/src/systems/AudioSystem.ts:467)  
   `spriteDelay` shifts the source offset, but playback duration stays at `s.d`. A positive decoder correction therefore advances into the sample and still plays only the original duration, cutting off the tail by up to 80 ms. Adjust the duration to account for the offset correction, and bound it to the available buffer.

I found no concrete gameplay timing change or stuck-down duck in this diff.