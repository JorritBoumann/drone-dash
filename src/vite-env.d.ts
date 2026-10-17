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
  leg?: { time: number; par: number };
  breakdown?: { drops: number; fast: number; combo: number; slip: number; fastCount: number; rush?: number; dropSeconds: number; slipSeconds: number; crashSeconds: number; total: number };
  /** Round 15: which city this load built, and the daily city's own best. */
  city?: { mode: string; seed: number; date: string; dailyBest: number; dailyTier: number; mood?: string; parks?: number; features?: Record<string, number>; rushLanes?: number };
  /** Round 17: the run's ending: overtime running / done, last-call drop, overtime seconds, time-up share of the bank. */
  ending?: { overtime: boolean; finished: boolean; lastCall: boolean; overtimeSeconds: number; partial: number; partialShare: number; legRoute: number };
  /** Round 15: mid-run escalation (rush hour): stage 0 before RUSH.startAt, 1 every second parcel, 2 every parcel. */
  escalation?: { kind: string; on: boolean; startedAt: number; stage: number; orders: number; made: number; missed: number; points: number; active: boolean; left: number; window: number };
  goals?: { tier: number; tierName: string; next: number; passes: number; passList: { tier: number; name: string; score: number; t: number }[]; best: number; bestTier: number; thresholds: number[] };
  slipstream?: { chimes?: number; level: number; intensity: number; quality: number; wall: number; speedFactor: number; rate: number; hotPoints: number; hug: number; firstPayoutAt: number; drafting: boolean; chain: number; payouts: number; points: number; seconds: number; clockK: number; clockGain: number; budget: number; toward: number; bank: number; bankTotal: number; bankPaid: number; bankLost: number; legBanked: number; legCap: number };
  scoreLog?: { t: number; k: string; v: number; c?: number; m?: number; lt?: number; par?: number }[];
  /** Round 25: layered teaching on a new player's first run: introductions so far (run seconds) and the queue. */
  teach?: { on: boolean; log: { k: string; t: number }[]; queue: string[] };
  /** Round 19: this leg's route hint, the alley or tunnel the drone is in, and the centre messages shown. */
  routeHint?: { kind: string; names: string[]; save: number; grid: number; route: number; kinds: string[]; at: number; shownAt: number } | null;
  routeMark?: {
    kind: string; name: string; names: string[]; stage: string; gate: { x: number; y: number; z: number }; inward: { x: number; z: number };
    exit: { x: number; y: number; z: number }; outward: { x: number; z: number }; width: number; legAt: number; shownAt: number;
    seenAt: number; seenDist: number; tagAt: number; tagOn: boolean; gateIn: boolean; board: string; n: number;
  } | null;
  progress?: { best: number; stall: number; stale: boolean; staleLost: number; staleCount: number };
  narrow?: { kind: string; name: string; roof: boolean } | null;
  vanDraft?: boolean;
  /** Round 22: street life counts (vehicles, people drawn, reactions to the drone, people on the live pad). */
  detail?: { chunks: number; triangles: number; counts: Record<string, number> };
  street?: { cars: number; target: number; vans: number; held: number; braking: number; turning: number; people: number; peopleDrawn: number; reactions: number; reacting: number; onActivePad: number; droppedLoops: number; msTraffic: number; msPeople: number };
  centreLog?: Array<{ kind: string; text: string; t: number }>;
  /** Debug: the last charged crash (speed lost, top of the wall hit, its normal y, drone height). */
  /** Debug: this frame's contacts (wall impact speed, ledge hop impact, crash-relevant speed loss). */
  contact?: { bump: number; ledge: number; wallLoss: number };
  /** Audio: context state and the adaptive music (track, section, layer, intensity, ducking, scheduler health). */
  audio?: { state: string; music: Record<string, unknown> };
  lastCrash?: { loss: number; wallTop: number; normalY: number; y: number } | null;
  objective: { phase: string; name: string; position: { x: number; y: number; z: number } | null } | null;
  fps: number;
  camera: { x: number; y: number; z: number; fov: number; aspect: number; view?: { yaw: number; pitch: number; zoom: number; free: number; idle: number; distance: number }; behind?: { yaw: number; elev: number }; corridor?: { w: number; axis: string; roof: boolean } };
  drawCalls: number;
  player: {
    position: { x: number; y: number; z: number };
    speed: number;
    boost: number;
    headwind?: number;
    carrying: boolean;
    yaw?: number;
    boosting?: boolean;
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
  /** Round 21: orbit / zoom the camera as a drag or wheel would (radians, log zoom); `held` keeps a virtual drag down. */
  view(yaw: number, pitch?: number, zoom?: number, held?: boolean): void;
  /** Round 21: is this point inside a solid collider grown by `pad` (camera probes)? */
  insideSolid(x: number, y: number, z: number, pad?: number): boolean;
  solidAt(x: number, y: number, z: number, pad?: number): Array<Record<string, number | boolean>>;
  /** Run the simulation for `seconds` of fixed 60 Hz steps, then render once. */
  advance(seconds: number, render?: boolean): ThreeGameDiagnostics | undefined;
  /** When true the rAF loop keeps simulating but stops rendering (tests render via advance). */
  manualRender(on: boolean): void;
  externalClock?(on: boolean): void;
  tune?(patch: Record<string, Record<string, unknown>>): void;
  readonly state: string;
  diagnostics(): ThreeGameDiagnostics | undefined;
  /** Debug: move the drone (yaw 0 faces -z) and set its horizontal speed along the heading. */
  camCorridors(): Array<{ axis: "x" | "z"; c: number; hw: number; a0: number; a1: number; roofY: number }>;
  place(x: number, y: number, z: number, yaw: number, speed?: number): void;
  /** Debug: every delivery site in the city. */
  /** Test: read music/SFX bus levels every frame (fills audio.music.meter and lastFanfare). */
  audioMeter?(on: boolean): void;
  musicForce?(chain: number | null, final?: boolean): void;
  /** Test: music on/off (same as the music chip, remembered). */
  music?(on: boolean): void;
  sites(): Array<{ name: string; kind: string; x: number; y: number; z: number }>;
  /** Round 15: build these seeds' cities and audit every pad (buried, overhang, outside, ceiling). */
  padAudit?(seeds: number[]): Array<{ seed: number; sites: number; issues: Array<{ site: string; kind: string; problem: string; detail: string }> }>;
  city?(): { mode: string; seed: number; date: string };
  /** Round 18: shortest street route (features: roads + alleys + tunnels + diagonal; false: plain grid). */
  streetRoute?(from: { x: number; z: number }, to: { x: number; z: number }, features?: boolean, narrowPenalty?: number): { length: number; points: Array<{ x: number; z: number; kind: string; name: string }>; kinds: string[]; names: string[] };
  features?(): Array<{ kind: string; name: string; x: number; z: number; length: number }>;
  rushLanes?(): Array<{ axis: number; at: number }>;
  vans?(): Array<{ x: number; y: number; z: number; dx: number; dz: number }>;
  rush?(on: boolean): void;
  streetLife?(traffic: boolean, people: boolean): void;
  detailOn?(on: boolean): void;
  archetypesInView?(range?: number): { arch: Record<string, number>; shopFronts: number };
  detailAudit?(): { padHits: number; alleyHits: number; roadHits: number; vertices: number; samples: number[][] };
  traffic?(): Array<{ kind: 'car' | 'van'; type: number; x: number; y: number; z: number; fx: number; fz: number; len: number; wid: number; y0: number; y1: number; mode: string; lat: number; axis: number }>;
  people?(): Array<{ x: number; z: number; y: number; walking: boolean; react: number; path: number }>;
  /** Round 24: the drone's screen box in CSS px (visible vertices through the render camera) and the touch framing shift. */
  droneBox?(): { x: number; y: number; w: number; h: number; behind: boolean; shift: number };
  /** Round 28: CC0 street assets loaded and in use; street furniture within r of a point (default the drone); shop-front audit. */
  assetsReady?(): { on: boolean; ms: number; propsVisible: number; treesNear: number[]; carModels: boolean };
  streetPropAudit?(r?: number, x?: number, z?: number): { count: number; kinds: Record<string, number>; kindCount: number; pavementM: number; perTenM: number };
  shopAudit?(): { bays: number; pairs: number; sameSign: number; sameDoor: number; sameAwning: number; sameAll: number; awningPairs: number };
  assetsOn?(on: boolean): void;
  assetParts?(o: { props?: boolean; trees?: boolean; propShadows?: boolean; detail?: boolean }): void;
  propPlacementAudit?(): { props: number; padHits: number; alleyHits: number; diagHits: number; roadHits: number; poleHits: number; kinds: Record<string, number> };
  renderFrom?(px: number, py: number, pz: number, tx: number, ty: number, tz: number): void;
}

interface Window {
  __THREE_GAME_DIAGNOSTICS__?: ThreeGameDiagnostics;
  __THREE_GAME_TEST_HOOKS__?: ThreeGameTestHooks;
  __GAME__?: DroneDashApi;
}
