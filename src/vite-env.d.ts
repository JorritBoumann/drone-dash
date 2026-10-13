/// <reference types="vite/client" />

interface ThreeGameDiagnostics {
  frame: number;
  elapsed: number;
  state: 'title' | 'playing' | 'paused' | 'over';
  seed: number;
  score: number;
  targetScore: number;
  complete: boolean;
  timeLeft: number;
  deliveries: number;
  combo: number;
  crashes?: number;
  objective: { phase: string; name: string; position: { x: number; y: number; z: number } | null } | null;
  fps: number;
  camera: { x: number; y: number; z: number; fov: number; aspect: number };
  drawCalls: number;
  player: {
    position: { x: number; y: number; z: number };
    speed: number;
    boost: number;
    carrying: boolean;
  };
  renderer: {
    calls: number;
    triangles: number;
    geometries: number;
    textures: number;
    post: boolean;
  };
  world: { buildings: number; colliders: number; sites: number; trees: number; hiddenProps: number };
  canvas: {
    clientWidth: number;
    clientHeight: number;
    width: number;
    height: number;
    dpr: number;
  };
}

interface ThreeGameTestHooks {
  /** Re-seed the objective RNG; all gameplay randomness flows through seeded generators. */
  seed(value: number): void | Promise<void>;
  /** Acknowledge after setup/assets are ready; throw for unknown states. */
  setState(name: string): { state: string } | Promise<{ state: string }>;
  /** Stop simulation/state transitions immediately; keep rendering. */
  setPausedForScreenshot(paused: boolean): void | Promise<void>;
  /** Stabilize ambient/idle visuals. */
  setReducedMotion(enabled: boolean): void | Promise<void>;
  /** Hide debug UI (lil-gui) before capturing. */
  hideDebugUi(hidden: boolean): void | Promise<void>;
}

interface DroneDashApi {
  start(): void;
  restart(): void;
  pause(): void;
  resume(): void;
  end(): void;
  /** Hold / release a key code (e.g. 'KeyW') for automated tests. */
  key(code: string, down: boolean): void;
  /** Run the simulation for `seconds` of fixed 60 Hz steps, then render once. */
  advance(seconds: number, render?: boolean): ThreeGameDiagnostics | undefined;
  /** When true the rAF loop keeps simulating but stops rendering (tests render via advance). */
  manualRender(on: boolean): void;
  readonly state: string;
  diagnostics(): ThreeGameDiagnostics | undefined;
}

interface Window {
  __THREE_GAME_DIAGNOSTICS__?: ThreeGameDiagnostics;
  __THREE_GAME_TEST_HOOKS__?: ThreeGameTestHooks;
  __GAME__?: DroneDashApi;
}
