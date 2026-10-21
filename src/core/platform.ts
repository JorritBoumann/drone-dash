/**
 * Round 41: Stateloop platform glue (see progress/round-41/stateloop-rules.md).
 * - The Play Worker serves the game inside a full-screen iframe on another origin, injects a capture bridge before the
 *   game's scripts and adds `seed` plus its own configuration keys to the query.
 * - The game never calls `window.StateloopSession.complete`. The portal treats it as "leave the game" and closes
 *   the frame at once. A run ends (round 48: a shift is won or the clock runs out), then the player starts the next
 *   one from the results card. The player leaves through the portal (its back button, or Escape twice).
 */
/** What a finished run reports to the test hook `__GAME__.session()`. */
export type SessionDetail = {
  game: 'drone-dash';
  score: number;
  medal: string;
  medalTier: number;
  deliveries: number;
  seed: number;
  cityMode: string;
  runSeconds: number;
  run: number;
  /** Round 48: the shift was completed (the last parcel delivered before the clock ran out, or in overtime). */
  win: boolean;
  parcels: number;
  /** Whole seconds left on the clock at the finish (0 on a loss). */
  timeLeft: number;
};

type Bridge = { complete?: (detail: SessionDetail) => unknown };

function bridge(): Bridge | null {
  try {
    const b = (window as unknown as { StateloopSession?: Bridge }).StateloopSession;
    return b && typeof b === 'object' ? b : null;
  } catch {
    return null;
  }
}

/**
 * Inside the platform: the injected bridge, or the launch flag the Worker adds. `?hud=canvas` forces the platform
 * look (canvas HUD) anywhere, `?hud=html` turns it off.
 */
export function onPlatform(params: URLSearchParams): boolean {
  const hud = params.get('hud');
  if (hud === 'canvas') return true;
  if (hud === 'html') return false;
  return !!bridge() || params.has('slLaunch');
}
