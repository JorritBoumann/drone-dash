/**
 * Round 41: Stateloop platform glue (see progress/round-41/stateloop-rules.md).
 * - The Play Worker serves the game inside a full-screen iframe on another origin, injects a capture bridge before the
 *   game's scripts and adds `seed` plus its own configuration keys to the query.
 * - At a natural end the game calls `window.StateloopSession.complete(detail)` and dispatches a
 *   `stateloop:session-complete` CustomEvent. Both are guarded: outside the platform neither exists or matters.
 */
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

let completedRun = -1;
/** Reports the end of run `run` once (a second call for the same run is ignored). Never throws. */
export function completeSession(detail: SessionDetail): boolean {
  if (detail.run === completedRun) return false;
  completedRun = detail.run;
  try {
    bridge()?.complete?.(detail);
  } catch (err) {
    console.warn('StateloopSession.complete failed', err);
  }
  try {
    window.dispatchEvent(new CustomEvent('stateloop:session-complete', { detail }));
  } catch {
    /* no CustomEvent: nothing to tell */
  }
  return true;
}
