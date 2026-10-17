import * as THREE from 'three';
import { InputController, type FlightIntent, type ViewIntent } from '../core/InputController';
import { Loop } from '../core/Loop';
import { createRenderer, RenderPipeline } from '../core/Renderer';
import { createSeededRandom, type Rng } from '../core/random';
import { Drone, type FlightEvents } from '../entities/Drone';
import { MARKER_COLORS, ObjectiveMarker } from '../entities/ObjectiveMarker';
import { RouteGate } from '../entities/RouteGate';
import { AudioSystem } from '../systems/AudioSystem';
import { CameraRig, type CamCorridor } from '../systems/CameraRig';
import { CollisionWorld } from '../systems/CollisionWorld';
import { DebugTools } from '../systems/DebugTools';
import { DeliverySystem, JOBS } from '../systems/DeliverySystem';
import { Slipstream } from '../systems/Slipstream';
import { VfxSystem } from '../systems/VfxSystem';
import { Hud, fmtX, type Box, type TouchLayout } from '../ui/Hud';
import { createCityMaterial, type CityMaterial } from '../world/CityMaterial';
import { BuildingDetail } from '../world/BuildingDetail';
import { generateCity, type CityLayout } from '../world/CityGenerator';
import { applyMood, createSky, Environment, LightingRig, MOODS, PALETTE } from '../world/Environment';
import { radialTexture } from '../world/Textures';
import { CRASH, FLIGHT, GOALS, QUALITY, RUN, RUSH, SLIPSTREAM } from './config';
import { cityLook, cityUrl, dateLabel, readDaily, resolveCity, writeDaily, type CityLook, type CityPick } from './cities';
import { auditPads } from '../world/padAudit';
import { buildStreetGraph, routeOnGraph } from '../world/CityFeatures';

/** Round 20: the alley mouth faces stand this far in from the block edge (sidewalk 3 m + the 1.5 m mouth setback). */
const GATE_FACE = 4.5;
/** Round 20: an alley or tunnel run is marked (and named) only when it saves this many metres and this share of the best route without one. */
const GATE_SAVE_M = 10;
/** Round 24: route mark hysteresis. Seconds of steady disagreement, or metres turned away from the entrance, before it moves. */
const MARK_COMMIT = 2;
const MARK_AWAY = 20;
const GATE_SAVE_SHARE = 0.08;
import { nextGoal, readBestTier, tierFor, tierName, writeBestTier } from './goals';

export type GameState = 'title' | 'playing' | 'paused' | 'over';

const BEST_KEY = 'drone-dash-best-v1';
/** Round 25: set when a run ends. With it (or a saved best) the player is returning: full HUD from the start, no hints. */
const PLAYED_KEY = 'drone-dash-played-v1';
/**
 * Round 25: layered teaching on a new player's first run. Round 26: paced. One introduction at a time, at least `gap` s
 * apart, never within `popClear` s of a pickup or delivery pop (before or after: an arrival due inside that time waits),
 * and each hint only while its system is running. The slipstream comes first, on the first draft from `slipFrom` s (so
 * the flight to the first pickup has something to watch, and its payouts are never heard before they are seen); everything
 * else from `from` s.
 * Rush hour keeps its start time (scoring is the same for every player) but on a first run its banner waits for a clear
 * moment, and the `gap` s before it are kept free.
 */
const TEACH = { from: 30, gap: 8, popClear: 3.5, slipFrom: 8, windAlt: 30 };
const TEACH_HINTS: Record<string, [string, string]> = {
  slip: ['Slipstream', 'Fly low by walls: bonus paid on delivery'],
  clock: ['Slow clock', 'Drafting toward the marker slows the clock'],
  combo: ['Combo', 'Drops 3 s under par build it'],
  route: ['Shortcuts', 'Arches mark alleys and tunnels'],
  wind: ['High wind', 'Up high the wind slows you'],
};
/** Round 25: when several systems wait for their introduction, this order wins (the street bonus first). */
const TEACH_ORDER = ['slip', 'combo', 'medal', 'clock', 'route', 'view', 'wind'];
const MEDAL_COLORS = [new THREE.Color('#e0955a'), new THREE.Color('#eef2f7'), new THREE.Color('#ffd166'), new THREE.Color('#5ff5d4')];

function readBest(): number {
  try {
    return Number(window.localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}
function writeBest(v: number): void {
  try {
    window.localStorage.setItem(BEST_KEY, String(v));
  } catch {
    /* storage unavailable */
  }
}

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(60, 1, 0.2, 2000);
  private readonly pipeline: RenderPipeline;
  private readonly input: InputController;
  private readonly hud = new Hud();
  private readonly audio = new AudioSystem();
  private readonly vfx = new VfxSystem();
  private readonly cameraRig = new CameraRig(this.camera);
  private readonly drone = new Drone();
  private readonly marker = new ObjectiveMarker();
  private readonly gate = new RouteGate(); // round 20: the suggested route's entrance arch and exit arch
  private readonly gateRoot = new THREE.Group(); // round 25: hides the arches until the teaching layer introduces routes
  // round 25: layered teaching (see TEACH)
  private teachOn = false;
  private readonly learned = new Set<string>();
  private teachQueue: string[] = [];
  private teachLast = -99;
  private objPopAt = -99; // round 26: run time of the last pickup or delivery pop
  private rushBannerDue = false; // round 26: rush hour has started on a first run and its banner waits for a clear moment
  /** Round 25: first appearance (run seconds) of each taught system, for probes. */
  private teachLog: Array<{ k: string; t: number }> = [];
  private readonly slip = new Slipstream();
  private slipClockK = 0; // 0..1 draft pace this frame for the slow clock (see SLIPSTREAM.clockRate)
  private slipClockGain = 0; // clock seconds gained per second this frame (the clock runs at 1 - this speed)
  private slipBudget: number = SLIPSTREAM.clockBudget; // slow clock seconds left on this leg (refilled on pickup and drop)
  private slipToward = 1; // 0..1 heading toward the current objective this frame (the slow clock only helps on the way)
  // round 14 street bonus: slip payouts bank here and are paid on delivery (see SLIPSTREAM.bankCarry)
  private bank = 0; // points banked on the current parcel run, unpaid
  private legBanked = 0; // points banked on the current leg (capped at legCap)
  private legCap = 0;
  private bankTotal = 0; // every point banked this run
  private bankPaid = 0; // deliveries that paid a street bonus
  private bankLost = 0; // points cut from the bank by hard crashes
  private bankShownPay = false; // the run's first payout has been banked (it banks at least SLIPSTREAM.bankFirstMin)
  // round 17: the run's ending (overtime, last call, time-up share of the bank)
  private readonly legFrom = new THREE.Vector3(); // where the current leg started
  private legRoute3 = 0; // its street route plus height change (the partial share is measured on this)
  private finishHold = 0; // s: after the overtime delivery the run ends after this short beat
  private partialShare = 0; // share of the leg flown at time-up (0..1), for the game-over row
  private legClock = 0; // s since the current leg started
  private otShare = 1; // share of the leg flown when overtime started: the overtime delivery pays this share of the bank
  // round 15 escalation: rush hour. From RUSH.startAt s some parcels are rush orders: deliver inside a short window for a flat bonus
  private rushOn = false;
  private rushAt = -1;
  private rushActive = false;
  private rushLeft = 0;
  private rushWindow = 0;
  private rushOrders = 0;
  private rushMade = 0;
  private rushMissed = 0;
  private rushPoints = 0;
  private lastWasRush = false;
  private scoreLog: { t: number; k: string; v: number; c?: number; m?: number; lt?: number; lc?: number; par?: number }[] = []; // test/tuning log
  private readonly slipColor = new THREE.Color('#ffe7b0');
  private readonly slipHot = new THREE.Color('#fff6e8');
  private readonly windColor = new THREE.Color('#e6f2ff');
  private readonly layout: CityLayout;
  private readonly world: CollisionWorld;
  private readonly env: Environment;
  private readonly lighting: LightingRig;
  private readonly cityMaterial: CityMaterial;
  /** Round 27: facade and rooftop detail near the camera (balconies, fire escapes, sills, signs, vents). */
  private readonly detail: BuildingDetail;
  private readonly sky: THREE.Mesh;
  private readonly delivery: DeliverySystem;
  private readonly blob: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private readonly debug: DebugTools;
  private readonly loop = new Loop((dt) => {
    if (!this.externalClock) this.update(dt);
  }, () => this.renderFromLoop());
  private externalClock = false; // test hook: only `advance` moves the game (fully deterministic sims)

  private state: GameState = 'title';
  private readonly seed: number;
  private readonly city: CityPick; // round 15: which city this load built (seed, random or daily)
  private daily = { date: '', best: 0, tier: 0 };
  private readonly look: CityLook;
  private rng: Rng;
  private readonly fxRng: Rng;
  private readonly intent: FlightIntent = { turn: 0, thrust: 0, lift: 0, boost: false };
  private readonly viewIntent: ViewIntent = { yaw: 0, pitch: 0, zoom: 0, held: false };
  private readonly idle: FlightIntent = { turn: 0, thrust: 0, lift: 0, boost: false };
  private readonly events: FlightEvents = { bump: 0, ledge: 0, landed: false, wallLoss: 0, wallTop: -1e9, wallNormalY: 0 };
  private readonly startPos = new THREE.Vector3();
  private readonly titleFocus = new THREE.Vector3(0, 8, 0);
  private startYaw = 0;
  private best = readBest();
  private bestTier = Math.max(readBestTier(), tierFor(readBest()));
  // medals this run: the tier reached so far and every crossing (diagnostics count them for scripts)
  private tier = 0;
  private tierPasses: { tier: number; name: string; score: number; t: number }[] = [];
  private runTime = 0;
  private topCombo = 0;
  private lastTick = -1;
  private wasBoosting = false;
  private bumpCooldown = 0;
  // crash stakes: speed lost in the current hit, time since the last wall contact, and the charged crash window
  private hitLoss = 0;
  private hitAge = 0;
  private hitPending = false;
  private sinceContact = 99;
  private hitSkim = false;
  private hitTop = 0;
  private hitNormalY = 0;
  private crashWindow = 0;
  private crashCharged = 0;
  private lastCrash: { loss: number; wallTop: number; normalY: number; y: number } | null = null;
  private crashes = 0;
  private hitStop = 0;
  private frame = 0;
  private time = 0;
  private fps = 0;
  private drawCalls = 0;
  private triangles = 0;
  private frozen = false;
  private manualRender = false;
  private reducedMotion = false;
  private runCount = 0;
  /** Round 24: touch framing, px the view is shifted down so the drone stays clear of the top pills (0 on desktop). */
  private touchShift = 0;
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();

  constructor(private readonly canvas: HTMLCanvasElement) {
    const params = new URLSearchParams(window.location.search);
    // round 15: ?seed=N builds exactly that city (unchanged); ?daily the day's city; otherwise a new random city
    this.city = resolveCity(params);
    this.seed = this.city.seed;
    this.daily = readDaily(this.city.date);
    this.rng = createSeededRandom(this.seed * 977 + 13);
    this.fxRng = createSeededRandom(this.seed + 4242);

    const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    this.hud.setTouch(touch);
    window.addEventListener('touchstart', () => this.hud.setTouch(true), { once: true, passive: true });

    this.renderer = createRenderer(canvas);
    this.renderer.info.autoReset = false;
    this.renderer.toneMappingExposure = QUALITY.exposure;
    const usePost = params.get('post') !== '0' && (params.get('post') === '1' || !touch) && QUALITY.bloom;
    this.pipeline = new RenderPipeline(this.renderer, this.scene, this.camera, usePost);

    // ----- World -----
    // round 16: the city's look (light mood, park count) comes from its seed
    this.look = cityLook(this.seed);
    applyMood(MOODS[this.look.mood]);
    this.layout = generateCity(createSeededRandom(this.seed), 7, this.look.parks, this.seed);
    this.buildNarrowRects();
    this.openGraph = buildStreetGraph(this.layout.roadCenters, this.layout.blockSize, this.layout.roadWidth, [], this.layout.boulevards, true);
    this.world = new CollisionWorld(this.layout.colliders, 0);
    this.cameraRig.setCorridors(this.cameraCorridors());
    this.cityMaterial = createCityMaterial();
    const city = new THREE.Mesh(this.layout.geometry, this.cityMaterial);
    city.castShadow = true;
    city.receiveShadow = true;
    city.name = 'city';
    this.scene.add(city);
    // round 27: lit windows follow the light mood (golden hour, morning, dusk, noon)
    const lit = [[0.22, 0.95], [0.07, 0.8], [0.36, 1.05], [0.05, 0.8]][this.look.mood] ?? [0.16, 0.95];
    this.cityMaterial.userData.uniforms!.uLitAmount.value = lit[0];
    this.cityMaterial.userData.uniforms!.uLitIntensity.value = lit[1];
    this.detail = new BuildingDetail(this.layout, this.cityMaterial, this.seed, touch ? 75 : 95);
    this.scene.add(this.detail.group);

    this.sky = createSky();
    this.scene.add(this.sky);
    this.scene.fog = new THREE.FogExp2(PALETTE.fog.clone(), 0.0017);
    this.scene.background = PALETTE.horizon.clone();
    this.bakeEnvironment();

    this.lighting = new LightingRig(this.scene, touch ? 1024 : QUALITY.shadowMapSize, QUALITY.shadowExtent, MOODS[this.look.mood]);
    this.env = new Environment(this.layout, this.seed, this.look.mood, touch); // round 22: street life follows the mood
    this.scene.add(this.env.group);

    this.scene.add(this.drone.group);
    this.scene.add(this.marker.group);
    this.gateRoot.add(this.gate.group);
    this.scene.add(this.gateRoot);
    this.scene.add(this.vfx.group);

    this.blob = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: radialTexture('rgba(20,10,5,0.7)', 'rgba(20,10,5,0)'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }),
    );
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.renderOrder = 1;
    this.scene.add(this.blob);

    this.delivery = new DeliverySystem(this.layout.sites);
    // round 18: legs prefer pads with a shortcut (see JOBS.shortcutBias)
    // round 19: 2 when the shortest route takes an alley or tunnel and no boulevard, 1 for any other shortcut
    this.delivery.shortcut = (from, s) => {
      const g = routeOnGraph(this.layout.gridGraph, from.x, from.z, s.pos.x, s.pos.z).length;
      const r = routeOnGraph(this.layout.graph, from.x, from.z, s.pos.x, s.pos.z);
      if (r.length > g * 0.85) return 0;
      // a raised pad is not offered for a tunnel route (the climb out to the roof would start under the bridge)
      if (s.pos.y > 6 && r.kinds.includes('tunnel')) return 0;
      return r.kinds.includes('diagonal') || !(r.kinds.includes('alley') || r.kinds.includes('tunnel')) ? 1 : 2;
    };

    // Start hovering above a low rooftop / park pad near downtown so every direction shows city.
    const byCentre = (a: { pos: THREE.Vector3 }, b: { pos: THREE.Vector3 }) => a.pos.lengthSq() - b.pos.lengthSq();
    const parks = this.layout.sites.filter((s) => s.kind === 'park').sort(byCentre);
    const roofs = this.layout.sites.filter((s) => s.kind === 'rooftop' && s.pos.y < 26).sort(byCentre);
    const central = parks[0] ?? roofs[0] ?? this.layout.sites[0];
    this.startPos.copy(central.pos).add(new THREE.Vector3(0, 14, 0)); // above park canopies (tallest pines ~11m)
    this.startYaw = Math.atan2(this.startPos.x, this.startPos.z); // face the city centre
    this.drone.reset(this.startPos, this.startYaw);
    this.cameraRig.setOrbitAngle(0.6);
    this.camera.position.set(Math.cos(0.6) * 175, 95, Math.sin(0.6) * 175);
    this.camera.lookAt(this.titleFocus);
    this.marker.hide();

    // ----- Input & UI -----
    const el = (id: string) => document.getElementById(id) as HTMLElement;
    this.input = new InputController(canvas, el('touch-stick'), el('touch-knob'), el('up-button'), el('down-button'), el('boost-button'));
    this.input.onGesture = () => this.audio.unlock();
    this.input.onView = () => this.hud.viewUsed();
    // any press anywhere (title card included) starts the sound; the title loop plays from the first one
    for (const type of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(type, this.onAnyGesture, true);
    this.hud.musicButton.addEventListener('click', this.onMusicButton);
    this.audio.setMusicScene('title');
    this.input.onPauseKey = () => {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    };
    this.hud.playButton.addEventListener('click', () => this.start());
    this.hud.againButton.addEventListener('click', () => this.start());
    this.hud.resumeButton.addEventListener('click', () => this.resume());
    this.hud.restartButton.addEventListener('click', () => this.start());
    this.hud.pauseButton.addEventListener('click', () => this.pause());
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('keydown', this.onMenuKey);
    this.hud.setMusic(false, this.audio.musicEnabled);

    this.hud.setBest(this.best, this.bestTier);
    this.hud.setCity(this.cityInfo());
    // round 15: a new random city or the daily city is a fresh page load (the whole world is built from the seed)
    const go = (mode: 'random' | 'daily') => (e: Event) => {
      e.stopPropagation();
      this.audio.click();
      window.location.href = cityUrl(mode);
    };
    this.hud.cityNewButton.addEventListener('click', go('random'));
    this.hud.cityDailyButton.addEventListener('click', go('daily'));
    this.hud.overNewCityButton.addEventListener('click', go('random'));
    this.hud.showScreen('title');
    this.debug = new DebugTools(() => {
      this.renderer.toneMappingExposure = QUALITY.exposure;
      this.pipeline.setPost(QUALITY.bloom);
    });

    this.installHooks();
    this.render();
    this.publishDiagnostics();
  }

  /** Sky-derived image-based lighting so metals/glass pick up the golden-hour sky. */
  private bakeEnvironment(): void {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    const skyCopy = new THREE.Mesh(this.sky.geometry, this.sky.material);
    envScene.add(skyCopy);
    // warm ground bounce so undersides aren't blue
    const ground = new THREE.Mesh(new THREE.CircleGeometry(800, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#8a6a52' }));
    ground.position.y = -20;
    envScene.add(ground);
    const rt = pmrem.fromScene(envScene, 0.02, 0.5, 2000);
    this.scene.environment = rt.texture;
    this.scene.environmentIntensity = 0.38;
    pmrem.dispose();
  }

  boot(): void {
    this.loop.start();
  }

  // ---------------- state transitions ----------------
  start(): void {
    this.audio.unlock();
    this.audio.click();
    this.runCount++;
    // the daily city also gives every attempt the same parcels, so a daily best is a fair race
    if (this.city.mode === 'daily') this.rng = createSeededRandom(this.seed * 977 + 13);
    this.drone.reset(this.startPos, this.startYaw);
    this.delivery.reset(this.rng, this.startPos, (from, to) => {
      // a straight descending line to the target must clear every solid building
      const end = this.tmp2.copy(to).setY(to.y + 3);
      return this.world.segmentFraction(from, end, 1.4, false) >= 0.999;
    });
    // face the first pickup
    const tgt = this.delivery.target.pos;
    this.drone.reset(this.startPos, Math.atan2(-(tgt.x - this.startPos.x), -(tgt.z - this.startPos.z)));
    this.topCombo = 0;
    this.tier = 0;
    this.tierPasses = [];
    this.runTime = 0;
    this.hitLoss = 0;
    this.hitPending = false;
    this.sinceContact = 99;
    this.crashWindow = 0;
    this.crashCharged = 0;
    this.lastCrash = null;
    this.crashes = 0;
    this.slip.reset();
    this.slipClockK = 0;
    this.slipClockGain = 0;
    this.slipBudget = SLIPSTREAM.clockBudget;
    this.slipToward = 1;
    this.bank = 0;
    this.bankTotal = 0;
    this.bankPaid = 0;
    this.bankLost = 0;
    this.bankShownPay = false;
    this.staleCarry = 0;
    this.staleLost = 0;
    this.staleCount = 0;
    this.stale = false;
    this.stallT = 0;
    this.finishHold = 0;
    this.partialShare = 0;
    this.otShare = 1;
    this.legClock = 0;
    this.hud.setOvertime(false);
    this.audio.setOvertime(false);
    this.rushOn = false;
    this.rushAt = -1;
    this.rushActive = false;
    this.rushLeft = 0;
    this.rushWindow = 0;
    this.rushOrders = 0;
    this.rushMade = 0;
    this.rushMissed = 0;
    this.rushPoints = 0;
    this.lastWasRush = false;
    this.env.setRush(false);
    this.hud.setRush(0, 0);
    this.scoreLog = [];
    this.newLeg(this.startPos);
    this.hud.setBank(0, false);
    this.hud.slowBudgetMax = SLIPSTREAM.clockBudget;
    this.lastTick = -1;
    this.wasBoosting = false;
    this.hud.resetCache();
    // round 25: a new player's first run teaches in layers; returning players get the full HUD and no hints
    this.teachOn = !this.returning();
    this.learned.clear();
    this.teachQueue = [];
    this.teachLast = -99;
    this.objPopAt = -99;
    this.rushBannerDue = false;
    this.teachLog = [];
    this.hud.setTeach(this.teachOn);
    this.gateRoot.visible = true;
    this.hud.armSlipHint(false); // round 25: the teaching layer's slipstream hint replaces the in-meter one
    this.hud.armViewHint(false); // round 25: the camera hint is one of the taught layers now
    this.cameraRig.resetView();
    this.setMarkerFromDelivery();
    this.hud.setDeliveries(0);
    this.hud.setScore(0);
    this.hud.setGoal(0);
    this.hud.setCombo(1, 0);
    this.input.clear();
    this.input.enabled = true;
    this.state = 'playing';
    this.hud.showScreen('playing');
    this.audio.resume();
    this.audio.setMusicScene('run');
    this.audio.setRotor(true);
    this.audio.start();
    this.canvas.focus({ preventScroll: true });
  }

  pause(): void {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.clear();
    this.hud.setSpeedLines(0);
    this.hud.showScreen('paused');
    this.audio.setRotor(false);
    window.setTimeout(() => {
      if (this.state === 'paused') this.audio.suspend();
    }, 250);
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.audio.resume();
    this.audio.click();
    this.state = 'playing';
    this.input.clear();
    this.hud.showScreen('playing');
    this.audio.setRotor(true);
    this.canvas.focus({ preventScroll: true });
  }

  /**
   * Round 17: the clock is out for good. The street bonus banked on the current leg is not all lost: it pays by the share
   * of the leg already flown (street route plus height), so ending 18 m short of a 150 m drop keeps nearly all of it.
   * Only on a run that has delivered at least once, so a no-delivery farm still scores 0.
   */
  private timeUp(): void {
    const D = this.delivery;
    if (this.bank > 0 && D.deliveries >= RUN.partialMinDrops && this.legRoute3 > 1 && this.onSchedule()) {
      const share = this.legShare();
      // Round 18: capped at the street bonus the run has paid per delivery so far, so a farmed bank on a run with few
      // drops cannot pay more at time-up than an honest drop would have.
      const perDrop = (D.tally.slip - D.tally.partial) / Math.max(1, D.deliveries);
      const pts = D.addPartial(Math.min(this.bank * share, perDrop));
      this.partialShare = share;
      this.scoreLog.push({ t: this.rt(), k: 'partial', v: pts, c: Math.round(share * 100) });
      this.bank -= pts;
    }
    this.endRun();
  }

  /**
   * Round 17: is the current leg on schedule (flown in at most RUN.scheduleSlack x its par)? Overtime and the time-up
   * share of the bank are for a parcel in flight, not for one that sat aboard while its bank was farmed.
   */
  private onSchedule(): boolean {
    return this.legClock <= RUN.scheduleSlack * (this.legRoute3 / RUN.parSpeed + RUN.parSlack);
  }

  /** Round 17: share of the current leg flown (street route left, plus any climb still needed), 0..1. */
  private legShare(): number {
    const p = this.drone.group.position, t = this.delivery.target.pos;
    const left = Math.abs(t.x - p.x) + Math.abs(t.z - p.z) + Math.max(0, t.y - (p.y - FLIGHT.radius));
    return this.legRoute3 > 1 ? Math.max(0, Math.min(1, 1 - left / this.legRoute3)) : 0;
  }

  private endRun(): void {
    this.state = 'over';
    try {
      window.localStorage.setItem(PLAYED_KEY, '1');
    } catch {
      /* storage unavailable */
    }
    this.hud.setOvertime(false);
    this.audio.setOvertime(false);
    this.input.enabled = false;
    this.hud.setSpeedLines(0);
    this.audio.setRotor(false);
    const score = this.delivery.score;
    this.scoreLog.push({ t: this.rt(), k: 'end', v: this.bank });
    this.audio.gameOver(tierFor(score));
    this.audio.setMusicScene('over', tierFor(score));
    // Round 18: points paid at time-up (the last-leg share) can cross a medal line after the last checkMedal, so the
    // run's medal is settled here from the final score (no fanfare: the game-over card shows it).
    const finalTier = tierFor(score);
    if (finalTier > this.tier) {
      for (let k = this.tier + 1; k <= finalTier; k++) this.tierPasses.push({ tier: k, name: tierName(k), score, t: this.rt() });
      this.tier = finalTier;
    }
    const newBest = score > this.best;
    if (newBest) {
      this.best = score;
      writeBest(score);
    }
    if (this.tier > this.bestTier) {
      this.bestTier = this.tier;
      writeBestTier(this.tier);
    }
    this.hud.setBest(this.best, this.bestTier);
    let dailyNew = false;
    if (this.city.mode === 'daily') {
      dailyNew = score > this.daily.best;
      this.daily = { date: this.city.date, best: Math.max(this.daily.best, score), tier: Math.max(this.daily.tier, tierFor(score)) };
      writeDaily(this.daily);
    }
    this.hud.setCity(this.cityInfo());
    const T = this.delivery.tally;
    this.hud.showOver({
      score,
      best: this.best,
      bestTier: this.bestTier,
      newBest: newBest && score > 0,
      tier: tierFor(score),
      deliveries: this.delivery.deliveries,
      fastCount: T.fastCount,
      topCombo: 1 + Math.min(this.topCombo, RUN.maxCombo) * RUN.comboStep,
      drops: T.drops,
      fast: T.fast,
      combo: T.combo,
      slip: T.slip,
      slipPayouts: this.slip.payouts,
      bankPaid: this.bankPaid,
      bankUnpaid: this.bank,
      bankLost: this.bankLost,
      startTime: RUN.startTime,
      dropSeconds: T.dropSeconds,
      slipSeconds: T.slipSeconds,
      crashSeconds: T.crashSeconds,
      crashes: this.crashes,
      rush: T.rush,
      rushMade: this.rushMade,
      rushOrders: this.rushOrders,
      partial: T.partial,
      partialShare: this.partialShare,
      overtimeSeconds: T.overtimeSeconds,
      overtimeDrop: T.overtimeDrop > 0,
      dailyNew: dailyNew && score > 0,
    });
    this.hud.showScreen('over');
    this.marker.hide();
    this.clearMark();
    this.drone.hasGuide = false;
    this.cameraRig.setOrbitAngle(this.drone.yaw + Math.PI / 2);
  }

  private readonly onBlur = () => this.pause();
  private readonly onVisibility = () => {
    if (document.hidden) {
      this.pause();
      // title and game over keep no timers alive in a hidden tab: the music waits for the player to come back
      if (this.state === 'title' || this.state === 'over') this.audio.suspend();
    } else if (this.state !== 'paused') this.audio.resume();
  };
  private readonly onAnyGesture = () => this.audio.unlock();
  /** Music chip: the first press only starts the sound (music on); after that it toggles music, separate from SFX. */
  private readonly onMusicButton = (e: Event) => {
    e.stopPropagation();
    const wasLocked = this.hud.musicLocked;
    this.audio.unlock();
    this.audio.setMusicEnabled(wasLocked ? true : !this.audio.musicEnabled);
    this.hud.setMusic(true, this.audio.musicEnabled);
    if (this.state === 'playing') this.canvas.focus({ preventScroll: true });
  };
  private readonly onMenuKey = (e: KeyboardEvent) => {
    if (e.code === 'KeyM' && !e.repeat) {
      this.audio.unlock();
      this.audio.setMusicEnabled(!this.audio.musicEnabled);
      return;
    }
    if ((this.state === 'title' || this.state === 'over') && (e.code === 'Enter' || (e.code === 'Space' && document.activeElement === document.body))) {
      e.preventDefault();
      this.start();
    }
  };

  /** Title and game-over city line: the seed, or the daily city with its own best. */
  private cityInfo(): { mode: CityPick['mode']; label: string; best: number; tier: number } {
    const c = this.city;
    return { mode: c.mode, label: c.mode === 'daily' ? `Daily city · ${dateLabel(c.date)}` : `City ${c.seed}`, best: this.daily.best, tier: this.daily.tier };
  }

  private setMarkerFromDelivery(): void {
    const kind = this.delivery.phase === 'pickup' ? 'pickup' : 'drop';
    const t = this.delivery.target;
    this.marker.set(kind, t.pos, t.radius, kind === 'drop' && this.rushActive);
    this.drone.guide.copy(t.pos);
    this.drone.hasGuide = true;
    this.hud.setObjective(kind, t.name);
    if (this.hintPending && this.routeHint) {
      this.hintPending = false;
      const h = this.routeHint;
      this.hud.setRouteHint(h.kind ? { kind: h.kind, names: h.names, save: h.save } : null);
      if (h.kind) h.shownAt = this.rt();
      if (this.mark && this.mark.shownAt < 0) this.mark.shownAt = this.rt();
    }
  }

  // ---------------- frame ----------------
  private update(dt: number): void {
    this.frame++;
    this.loop.sampleFps();
    this.fps = this.loop.fps;
    this.pipeline.resize(QUALITY.maxDpr);
    this.vfx.setViewportHeight(this.renderer.domElement.height, this.camera.fov);

    if (this.frozen) {
      this.publishDiagnostics();
      return;
    }
    const animDt = this.reducedMotion ? 0 : dt;
    if (this.state !== 'paused') this.time += animDt;
    const time = this.time;

    if (this.state !== 'paused') {
      // round 22: people near the camera are drawn and react to the drone; nobody stays on the live pickup / drop pad
      const tgt = this.state === 'playing' ? this.delivery.target : null;
      if (tgt && tgt.pos.y < 2) this.env.people.setActivePad(tgt.pos.x, tgt.pos.z, tgt.radius);
      else this.env.people.setActivePad(0, 0, 0);
      this.env.setFocus(this.camera.position, this.drone.group.position, this.drone.velocity.x, this.drone.velocity.z);
      this.env.update(animDt, time);
      const sh = this.cityMaterial.userData.shader;
      if (sh) sh.uniforms.uTime.value = time;
      (this.sky.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
    }

    switch (this.state) {
      case 'title':
        this.drone.update(dt, this.idle, this.world, this.layout.half + 30, this.events);
        this.cameraRig.orbitAround(dt, this.titleFocus, 175, 95, 0.045);
        break;
      case 'playing':
        this.updatePlaying(dt);
        break;
      case 'over':
        this.drone.update(dt, this.idle, this.world, this.layout.half + 30, this.events);
        this.cameraRig.orbitAround(dt, this.drone.group.position, 11, 4, 0.12);
        this.env.updateOcclusion(this.camera.position, this.drone.group.position);
        break;
      case 'paused':
        break;
    }

    if (this.state !== 'paused') {
      this.marker.update(animDt, time, this.camera.position);
      this.gate.update(animDt);
      this.vfx.update(animDt);
    }
    this.lighting.follow(this.drone.group.position);
    this.updateBlob();
    this.audio.musicFrame(dt);
    this.hud.setMusic(this.audio.started, this.audio.musicEnabled);
    this.publishDiagnostics();
  }

  private updatePlaying(realDt: number): void {
    // brief hit-stop after hard impacts sells the collision
    const dt = this.hitStop > 0 ? realDt * 0.08 : realDt;
    this.runTime += dt;
    this.legClock += dt;
    this.hitStop = Math.max(0, this.hitStop - realDt);
    this.input.read(this.intent);
    this.input.readView(this.viewIntent);
    const d = this.drone;
    d.update(dt, this.intent, this.world, this.layout.half + 30, this.events);
    this.checkCrash(realDt);
    this.updateMark(dt);
    this.updateSlipstream(dt);
    const dp = d.group.position;
    const groundBelow = this.world.surfaceBelow(dp.x, dp.y, dp.z);
    const altAboveGround = Math.max(0, dp.y - groundBelow - 0.85);
    this.cameraRig.update(realDt, d, this.world, altAboveGround, this.marker.position, this.viewIntent);
    this.updateTouchFraming(realDt);
    this.env.updateOcclusion(this.camera.position, dp);

    // feedback: bumps
    this.bumpCooldown = Math.max(0, this.bumpCooldown - realDt);
    if (this.events.bump > 2 && this.bumpCooldown <= 0) {
      const s = Math.min(1, this.events.bump / 16);
      this.bumpCooldown = 0.18;
      this.audio.bump(this.events.bump);
      this.cameraRig.addShake(0.25 + s * 0.7);
      this.hud.hitFlash(0.35 + s * 0.65);
      if (this.events.bump > 4) this.hitStop = 0.06;
      this.vfx.burst(d.group.position, new THREE.Color('#ffe2b8'), 10 + Math.round(s * 14), 4 + s * 4, 0.12, this.fxRng);
    }
    // boost start
    if (d.boosting && !this.wasBoosting) {
      this.audio.boost();
      this.cameraRig.addShake(0.15);
    }
    this.wasBoosting = d.boosting;
    if (d.boosting) this.emitBoostTrail();
    this.emitRotorWash();
    this.emitWindStreaks();

    // objectives (drafting never changes delivery points or the fast-drop clock: the slipstream pays its own payouts)
    const ev = this.delivery.update(dt, this.rng, d.group.position, FLIGHT.radius);
    if (ev) this.slipBudget = SLIPSTREAM.clockBudget; // a new leg: the slow clock budget refills (to the cap, no stacking)
    if (ev?.type === 'picked') {
      this.newLeg(ev.site.pos);
      this.objPopAt = this.runTime;
      this.scoreLog.push({ t: this.rt(), k: 'pick', v: this.bank });
      this.cameraRig.holdRoom(3.2); // round 26: room around the drone while it leaves the pad
      this.hud.setBank(this.bank, true);
      d.setCarrying(true);
      this.audio.pickup();
      this.vfx.burst(this.tmp.copy(ev.site.pos).setY(ev.site.pos.y + 1.8), MARKER_COLORS.pickup, 36, 9, 0.2, this.fxRng);
      this.vfx.ring(this.tmp.copy(ev.site.pos).setY(ev.site.pos.y + 0.3), MARKER_COLORS.pickup, 5.5);
      if (this.rushOn && (this.runTime >= RUSH.everyAt || !this.lastWasRush)) this.makeRush(this.delivery.legRoute);
      else this.lastWasRush = false;
      // the rush hour banner already speaks for the first seconds: no second pop on top of it
      const bannerUp = this.rushAt >= 0 && this.runTime - this.rushAt < 3.2;
      if (this.rushActive && bannerUp) { /* tag in the pill shows the window */ }
      else if (this.rushActive) this.hud.popText('Rush order!', `Deliver in ${Math.ceil(this.rushWindow)} s for +${RUSH.bonus}`, 'rush');
      else if (this.delivery.lastCall) this.hud.popText('Last call!', 'Short job · no time bonus', 'pickup');
      else this.hud.popText('Parcel secured!', `Deliver for +${Math.round(RUN.baseScore + this.delivery.legDistance * RUN.perMetre)}`, 'pickup');
      this.setMarkerFromDelivery();
    } else if (ev?.type === 'delivered') {
      d.setCarrying(false);
      this.objPopAt = this.runTime;
      this.audio.deliver(ev.combo);
      this.cameraRig.holdRoom(3.2);
      this.topCombo = Math.max(this.topCombo, ev.combo);
      this.vfx.burst(this.tmp.copy(ev.site.pos).setY(ev.site.pos.y + 1), MARKER_COLORS.drop, 56, 12, 0.22, this.fxRng);
      this.vfx.ring(this.tmp.copy(ev.site.pos).setY(ev.site.pos.y + 0.3), MARKER_COLORS.drop, 9);
      this.cameraRig.addShake(0.2);
      // round 25: the fast drop names its time bonus (more the further under par)
      // round 26: it names the seconds under par (on the clock), the measure of a good leg
      const u = Math.round(ev.under);
      const sub = ev.fast ? (ev.combo > 1 && ev.sharp ? `Fast +${ev.fastPts} · ${u} s under par · ${fmtX(this.delivery.multiplier)}` : `Fast +${ev.fastPts} · ${u} s under par`) : 'Late · no fast bonus';
      // round 17: an overtime delivery pays the bank by the share of the leg flown when the clock ran out (so overtime
      // finishes a parcel that was nearly there; it does not cash in a bank farmed far from the drop)
      let otCut = 0;
      if (ev.final && this.bank > 0) {
        otCut = this.bank - Math.round(this.bank * this.otShare);
        this.bank -= otCut;
        this.bankLost += otCut;
        if (otCut > 0) this.scoreLog.push({ t: this.rt(), k: 'otcut', v: otCut, c: Math.round(this.otShare * 100) });
      }
      // the street bonus banked on this parcel run is paid now (the breakdown's "Street bonus" line is exactly these)
      const paid = this.bank > 0 ? this.delivery.addBonus(this.bank, 0, false) : 0;
      // round 15: a rush order delivered inside its window adds a flat bonus (no combo; counted in the fast drops line)
      const rush = this.rushActive && this.rushLeft > 0 ? this.delivery.addRush(RUSH.bonus) : 0;
      if (this.rushActive) {
        this.rushActive = false;
        this.hud.setRush(0, 0);
      }
      if (rush > 0) {
        this.rushMade++;
        this.rushPoints += rush;
        this.scoreLog.push({ t: this.rt(), k: 'rush', v: rush });
      }
      this.scoreLog.push({ t: this.rt(), k: 'drop', v: ev.points, c: paid, m: this.delivery.multiplier, lt: Math.round(ev.legTime * 10) / 10, lc: Math.round(ev.clockTime * 10) / 10, par: Math.round(ev.par * 10) / 10 });
      if (paid > 0) this.bankPaid++;
      this.bank = 0;
      this.newLeg(ev.site.pos);
      this.hud.setBank(0, false);
      // round 25: the delivery is the headline: "+N delivered", the street bonus rides along as an add-on
      const subs = [rush > 0 ? `Rush +${rush}` : sub];
      if (paid > 0) subs.push(otCut > 0 ? `+${paid} street bonus (${Math.round(this.otShare * 100)}%)` : `+${paid} street bonus`);
      this.hud.popText(`+${ev.points + rush} delivered`, subs.join(' · '), 'drop');
      // round 19: the paid street bonus is named in the delivery pop's line (no second pop on top of it)
      if (ev.final) {
        // round 17: the overtime delivery ends the run on a high: no new job, a short beat, then the game-over card
        this.finishHold = 1.6;
        this.scoreLog.push({ t: this.rt(), k: 'otdrop', v: ev.points + paid + rush });
        this.hud.popText(`+${ev.points + rush} delivered`, paid > 0 ? `Made it! · +${paid} street bonus` : 'Made it! · overtime delivery', 'drop');
        this.hud.setObjective('drop', 'Run complete');
        this.hud.setRouteHint(null);
        this.hud.setOvertime(false, true);
        this.audio.setOvertime(false);
        this.marker.hide();
        this.clearMark();
        d.hasGuide = false;
      } else {
        this.hud.flashTimeBonus(ev.timeBonus);
        this.setMarkerFromDelivery();
      }
    }

    this.updateRush(dt);
    this.hud.tickBank(realDt);
    this.hud.tickCentre();

    // low-time ticks
    const tl = this.delivery.timeLeft;
    const whole = Math.ceil(tl);
    if (tl <= 10 && whole !== this.lastTick && tl > 0) {
      this.lastTick = whole;
      this.audio.tick(tl <= 5);
    }
    // music follows the chain, the clock and a close medal (within the last 15% of the way to it)
    const goal = nextGoal(this.delivery.score);
    // round 17: overtime stays in the last-10-s section (an overtime clock can start above it)
    this.audio.setRunState(this.slip.chain, this.delivery.overtime ? Math.min(tl, 5) : tl, !!goal && goal.progress >= 0.85);

    this.audio.updateRotor(Math.min(1, d.speed / FLIGHT.boostSpeed), Math.min(1, Math.abs(this.intent.thrust) * 0.6 + Math.abs(this.intent.lift) * 0.4), d.boosting, Math.min(1, d.group.position.y / 80), d.headwind);

    this.hud.setScore(this.delivery.score);
    this.checkMedal();
    this.hud.setCombo(this.delivery.multiplier, this.delivery.combo);
    this.hud.setDeliveries(this.delivery.deliveries);
    this.hud.setTime(tl, this.delivery.overtime ? this.delivery.overtimeGiven : RUN.startTime);
    this.hud.setBoost(d.boost, d.boosting);
    // true altitude above street level (consistent everywhere, rooftops included)
    this.hud.setTelemetry(d.speed, Math.max(0, dp.y - 0.85));
    this.hud.setSpeedLines(Math.max(d.boosting ? Math.min(1, d.speed / 24) : 0, this.slip.intensity * 0.5));
    // the wind chip only matters while the drone is actually trying to go somewhere up high (not while it hovers at a rooftop pad)
    const windy = d.headwind > 0.35 && d.speed > 7;
    this.hud.setSlip(this.slip.level, this.slip.drafting, this.slip.chain, windy, this.slip.hug > 0.4, dt, this.slipRateTier(), this.slipCue());
    this.hud.setWind(windy);
    this.updateTeach(windy);
    this.updateNav();
    this.updateGateTag();

    // round 17: the clock hitting 0 with a parcel aboard starts overtime (once); otherwise the run is over
    if (this.finishHold > 0) {
      this.finishHold -= realDt;
      if (this.finishHold <= 0) this.endRun();
    } else if (tl <= 0) {
      if (this.onSchedule() && this.delivery.startOvertime(d.group.position)) this.beginOvertime();
      else this.timeUp();
    }
  }

  /** Round 17: overtime starts. Banner, horn, the timer turns to an overtime count, the music goes to its top layer. */
  private beginOvertime(): void {
    this.otShare = this.legShare();
    this.scoreLog.push({ t: this.rt(), k: 'overtime', v: this.delivery.overtimeGiven, c: Math.round(Math.hypot(this.delivery.target.pos.x - this.drone.group.position.x, this.delivery.target.pos.z - this.drone.group.position.z)) });
    this.teachNow('overtime');
    this.hud.eventPop('Overtime', `${this.delivery.overtimeGiven} s to finish this delivery · no new jobs`);
    this.scoreLog.push({ t: this.rt(), k: 'otshare', v: Math.round(this.otShare * 100), c: this.bank });
    this.hud.setOvertime(true);
    this.audio.setOvertime(true);
    this.audio.overtimeHorn();
    this.cameraRig.addShake(0.15);
    this.lastTick = -1;
  }

  /**
   * Crash stakes. A hit is measured by the horizontal speed the wall contact itself takes off the drone (collision
   * response only: drag, braking and the drop guide do not count; contacts a few frames apart count as one hit).
   * Never charged: ledge hops and other low obstacles the drone can skim (Drone reports them as `ledge` or leaves
   * them out of `wallLoss`), and clipping the upper edge of the target pad's own block while dropping onto it.
   * Scrapes under CRASH.threshold are free. Harder hits break the combo and cost clock time by tier, once per collision.
   */
  private checkCrash(realDt: number): void {
    this.crashWindow = Math.max(0, this.crashWindow - realDt);
    const ev = this.events;
    const wall = ev.wallLoss > 0 && !this.isTargetEdge(ev.wallTop);
    this.sinceContact += realDt;
    if (wall) {
      // contacts closer together than chainGap are one collision: being pinned against a wall is charged at most once
      const fresh = this.sinceContact > CRASH.chainGap;
      this.sinceContact = 0;
      if (!this.hitPending && fresh) {
        this.hitPending = true;
        this.hitAge = 0;
        this.hitLoss = 0;
        this.hitSkim = false;
      }
      // only the first moments of a collision count, so a long slide along a wall never adds up to a crash
      if (this.hitPending && this.hitAge <= CRASH.hitSpan) {
        this.hitLoss += ev.wallLoss;
        this.hitTop = ev.wallTop;
        this.hitNormalY = ev.wallNormalY;
      }
    }
    if (!this.hitPending) return;
    // the game's own ledge hop fired during this collision: the drone is skimming over, not crashing
    if (ev.ledge > 0) this.hitSkim = true;
    this.hitAge += realDt;
    // decide once the collision has had a moment to play out (a hop shows within this span)
    if (this.hitAge < CRASH.hitSpan) return;
    this.hitPending = false;
    if (this.hitSkim || this.hitLoss < CRASH.threshold) return;
    let tier = CRASH.tiers[0];
    for (const t of CRASH.tiers) if (this.hitLoss >= t.severity) tier = t;
    const charged = this.crashWindow > 0 ? this.crashCharged : 0;
    if (tier.seconds <= charged) return;
    const res = this.delivery.penalize(tier.seconds - charged, CRASH.floor, true);
    // a hard crash (or worse) shakes the parcel: the street bonus banked on it is cut (once per collision)
    const cutAt = CRASH.tiers[Math.min(SLIPSTREAM.bankCrashTier, CRASH.tiers.length - 1)].seconds;
    let bankCut = 0;
    if (tier.seconds >= cutAt && charged < cutAt && this.bank > 0) {
      bankCut = this.bank - Math.round(this.bank * SLIPSTREAM.bankCrashKeep);
      this.bank -= bankCut;
      this.bankLost += bankCut;
      this.scoreLog.push({ t: this.rt(), k: 'cut', v: bankCut });
      this.hud.setBank(this.bank, this.drone.carrying);
    }
    const fresh = this.crashWindow <= 0;
    this.crashCharged = tier.seconds;
    this.crashWindow = CRASH.window;
    if (fresh) this.crashes++;
    this.lastCrash = { loss: this.hitLoss, wallTop: this.hitTop, normalY: this.hitNormalY, y: this.drone.group.position.y };
    this.crashFeedback(tier.label, tier.seconds, res.comboLost, Math.min(1, this.hitLoss / 30), fresh, bankCut);
  }

  /** The wall just hit is the upper edge of the block the current pad sits on (roof lip, kerb, lawn edge), near the pad. */
  private isTargetEdge(wallTop: number): boolean {
    const t = this.delivery.target;
    if (!t) return false;
    const p = this.drone.group.position;
    if (Math.hypot(t.pos.x - p.x, t.pos.z - p.z) > CRASH.padEdgeRange) return false;
    if (Math.abs(wallTop - t.pos.y) > 1.5) return false;
    return p.y - FLIGHT.radius > wallTop - CRASH.padEdgeDepth;
  }

  private crashFeedback(label: string, seconds: number, comboLost: number, s: number, fresh: boolean, bankCut = 0): void {
    const d = this.drone;
    this.hud.flashTimePenalty(seconds);
    let lost = comboLost > 0 ? `-${seconds} sec · ${fmtX(comboLost)} combo lost` : `-${seconds} sec`;
    if (bankCut > 0) lost += ` · bonus -${bankCut}`;
    this.hud.popText(`${label}!`, lost, 'crash');
    if (comboLost > 0) this.hud.breakCombo(comboLost);
    this.slip.lose();
    if (!fresh) return; // upgraded tier of the same hit: numbers update, effects already played
    this.audio.crash(s, comboLost > 0);
    this.cameraRig.addShake(0.6 + s * 0.4);
    this.hud.hitFlash(1, true);
    this.hitStop = 0.1 + s * 0.06;
    d.crash(s);
    const p = d.group.position;
    this.vfx.burst(p, new THREE.Color('#ff8a3d'), 22 + Math.round(s * 18), 6 + s * 6, 0.16, this.fxRng);
    this.vfx.burst(p, new THREE.Color('#fff1c9'), 10, 9 + s * 4, 0.1, this.fxRng);
  }

  /** Round 25: saved progress exists (a finished run, a best score or a medal). */
  private returning(): boolean {
    try {
      if (window.localStorage.getItem(PLAYED_KEY)) return true;
    } catch {
      /* storage unavailable: teach */
    }
    return this.best > 0 || this.bestTier > 0;
  }

  /** Round 25: is this system's HUD shown (always, unless a first run has not introduced it yet)? */
  private shown(key: string): boolean {
    return !this.teachOn || this.learned.has(key);
  }

  /** Round 25: a system happened for the first time: queue its introduction. */
  private teach(key: string): void {
    if (!this.teachOn || this.learned.has(key) || this.teachQueue.includes(key)) return;
    this.teachQueue.push(key);
  }

  /** Round 25: introduce now (rush hour and overtime bring their own banner, which is their hint). */
  private teachNow(key: string): void {
    if (!this.teachOn || this.learned.has(key)) return;
    this.teachQueue = this.teachQueue.filter((k) => k !== key);
    this.reveal(key);
  }

  private reveal(key: string): void {
    this.learned.add(key);
    this.hud.learn(key);
    this.teachLast = this.runTime;
    this.teachLog.push({ k: key, t: Math.round(this.runTime * 10) / 10 });
    const h = TEACH_HINTS[key];
    if (h) this.hud.hintPop(h[0], h[1]);
    else if (key === 'view') this.hud.showViewHint();
    else if (key === 'medal' && this.tier > 0) this.audio.medal(this.tier, this.hud.medalPop(this.tier, true));
  }

  /**
   * Round 25: what has happened so far, and the next introduction. Round 26: paced (see TEACH): at most one every
   * `gap` s, none within `popClear` s of a pickup or delivery pop, and each one only while its system is running.
   */
  private updateTeach(windy: boolean): void {
    this.gateRoot.visible = this.shown('route');
    if (!this.teachOn) return;
    const D = this.delivery;
    const t = this.runTime;
    if (this.slip.drafting || D.deliveries >= 1) this.teach('slip');
    if (this.learned.has('slip') && this.slipClockGain > 0.05) this.teach('clock');
    if (D.combo >= 1) this.teach('combo');
    if (D.deliveries >= 2) this.teach('route');
    if (D.deliveries >= 1) this.teach('view');
    if (windy) this.teach('wind');
    if (t - this.teachLast < TEACH.gap || t - this.objPopAt < TEACH.popClear || this.arrivalDue()) return;
    if (this.rushBannerDue) {
      this.rushBannerDue = false;
      this.reveal('rush');
      this.rushBanner();
      return;
    }
    if (!this.teachQueue.length) return;
    // the gap before rush hour stays free, so its banner can come on time
    if (!this.rushOn && t >= RUSH.startAt - TEACH.gap) return;
    const early = t < TEACH.from;
    if (early && t < TEACH.slipFrom) return;
    this.teachQueue.sort((a, b) => TEACH_ORDER.indexOf(a) - TEACH_ORDER.indexOf(b));
    const key = this.teachQueue.find((k) => (!early || k === 'slip') && this.teachActive(k));
    if (!key) return;
    this.teachQueue = this.teachQueue.filter((k) => k !== key);
    this.reveal(key);
  }

  /** Round 26: is this system running right now (its hint only shows while it is)? */
  private teachActive(key: string): boolean {
    const d = this.drone;
    if (key === 'slip') return this.slip.drafting || this.slip.level > 0.05;
    if (key === 'clock') return this.slipClockGain > 0.05;
    if (key === 'wind') return d.headwind > 0.35 && d.speed > 7 && d.group.position.y > TEACH.windAlt;
    if (key === 'route') return this.gate.visible; // only while an arch marks a shortcut on this leg
    return true;
  }

  /** Round 26: a pickup or delivery is due within the pop clearance (an introduction now would sit on its pop). */
  private arrivalDue(): boolean {
    const p = this.drone.group.position, g = this.delivery.target.pos;
    const dist = Math.hypot(p.x - g.x, p.z - g.z) + Math.abs(p.y - g.y) * 0.5;
    return Math.max(0, dist - 4) / Math.max(3, this.drone.speed) < TEACH.popClear + 0.5;
  }

  /** Rush hour's banner and horn (round 26: on a first run it waits for a clear moment; the rush itself starts on time). */
  private rushBanner(): void {
    this.hud.eventPop('Rush hour', this.rushActive && this.delivery.phase === 'deliver' ? `This parcel is a rush order: +${RUSH.bonus} if you beat the tag` : `Rush parcels pay +${RUSH.bonus} if you beat the tag`);
    this.audio.rushHour();
    this.cameraRig.addShake(0.12);
  }

  /** Medals: crossing a tier's score is a moment (banner, fanfare, sparkle) and is counted for scripts. */
  private checkMedal(): void {
    const score = this.delivery.score;
    this.hud.setGoal(score);
    const t = tierFor(score);
    if (t <= this.tier) return;
    for (let k = this.tier + 1; k <= t; k++) this.tierPasses.push({ tier: k, name: tierName(k), score, t: Math.round(this.runTime * 10) / 10 });
    this.tier = t;
    // round 26: on a new player's first run the medal layer is introduced right here, at its cause (the banner follows
    // the delivery pop that crossed the line, as for a returning player)
    if (this.shown('medal')) this.audio.medal(t, this.hud.medalPop(t));
    else this.teachNow('medal');
    const c = MEDAL_COLORS[Math.min(t, MEDAL_COLORS.length) - 1];
    this.vfx.burst(this.drone.group.position, c, 26 + t * 6, 8 + t, 0.16, this.fxRng);
    this.cameraRig.addShake(0.12);
  }

  private rt(): number {
    return Math.round(this.runTime * 10) / 10;
  }

  /** A new leg starts at `from` toward the current target: its street bonus share is sized by its street route. */
  private newLeg(from: THREE.Vector3): void {
    const t = this.delivery.target.pos;
    const route = Math.abs(t.x - from.x) + Math.abs(t.z - from.z);
    this.legFrom.copy(from);
    this.legRoute3 = route + Math.max(0, t.y - from.y);
    this.legClock = 0;
    this.legCap = Math.max(SLIPSTREAM.bankLegMin, Math.round(route * SLIPSTREAM.bankPerMetre));
    this.legBanked = 0;
    this.scoreLog.push({ t: this.rt(), k: 'leg', v: Math.round(route), c: this.legCap });
    // round 19: name the shortcut on this leg's shortest street route (shown under the objective pill)
    const g = routeOnGraph(this.layout.gridGraph, from.x, from.z, t.x, t.z).length;
    const r = routeOnGraph(this.layout.graph, from.x, from.z, t.x, t.z);
    const narrow = r.kinds.includes('tunnel') ? 'tunnel' : r.kinds.includes('alley') ? 'alley' : r.kinds.includes('diagonal') ? 'diagonal' : '';
    const save = Math.max(0, g - r.length);
    // names in route order, alleys and tunnels first, at most two
    const kindOf = (n: string) => this.layout.features.find((f) => f.name === n)?.kind ?? 'road';
    let names = [...r.names.filter((n) => kindOf(n) !== 'diagonal'), ...r.names.filter((n) => kindOf(n) === 'diagonal')].slice(0, 2);
    // round 20: the alley or tunnel the route enters first gets an arch with its name; the hint names exactly that
    this.legBestLeft = r.length + Math.max(0, t.y - from.y);
    this.legBestGrid = g + Math.max(0, t.y - from.y);
    this.payFrom = this.legBestLeft;
    this.payFromGrid = this.legBestGrid;
    this.payFlown = 0;
    this.stallT = 0;
    this.progClock = 0;
    this.marksThisLeg = 0;
    this.setMark(this.planMark(r, from.x, from.z, t.x, t.z, 1));
    // the hint names the marked alley or tunnel only (exactly the board's text); with no mark, the boulevard if the route
    // takes one; an alley that saves next to nothing is neither marked nor named
    if (this.mark) names = [this.mark.name];
    else names = r.names.filter((n) => kindOf(n) === 'diagonal').slice(0, 2);
    const narrowKind = this.mark ? this.mark.kind : narrow === 'diagonal' || r.kinds.includes('diagonal') ? 'diagonal' : '';
    this.routeHint = narrowKind ? { kind: narrowKind, names, save: Math.round(save), grid: Math.round(g), route: Math.round(r.length), kinds: r.kinds.slice(), at: this.rt(), shownAt: -1 } : { kind: '', names: [], save: 0, grid: Math.round(g), route: Math.round(r.length), kinds: r.kinds.slice(), at: this.rt(), shownAt: -1 };
    this.hintPending = true;
  }
  /** Round 19: this leg's route hint (diagnostics and HUD). */
  private routeHint: { kind: string; names: string[]; save: number; grid: number; route: number; kinds: string[]; at: number; shownAt: number } | null = null;
  private hintPending = false;
  /** Round 19: alley and tunnel strips (x/z rectangles) and tunnel roofs, for the alley draft and the tunnel clock. */
  private narrowRects: Array<{ x0: number; z0: number; x1: number; z1: number; kind: 'alley' | 'tunnel'; name: string; rx0: number; rz0: number; rx1: number; rz1: number }> = [];
  private narrowAt(p: THREE.Vector3): { kind: 'alley' | 'tunnel'; name: string; roof: boolean } | null {
    if (p.y > 9) return null;
    for (const r of this.narrowRects) {
      if (p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1) return { kind: r.kind, name: r.name, roof: r.kind === 'tunnel' && p.x > r.rx0 && p.x < r.rx1 && p.z > r.rz0 && p.z < r.rz1 && p.y < 7.3 };
    }
    return null;
  }
  /** Round 23: straight alleys and tunnels as camera corridors (walls and bridge underside from the colliders). */
  private cameraCorridors(): CamCorridor[] {
    return this.narrowRects.map((r) => {
      const X = r.x1 - r.x0 > r.z1 - r.z0; // runs along x
      let roofY = Infinity;
      if (r.kind === 'tunnel') {
        for (const b of this.world.boxes) {
          if (b.soft || b.minY < 2 || b.maxX <= r.rx0 || b.minX >= r.rx1 || b.maxZ <= r.rz0 || b.minZ >= r.rz1) continue;
          roofY = Math.min(roofY, b.minY);
        }
      }
      return X
        ? { axis: 'x' as const, c: (r.z0 + r.z1) / 2, hw: (r.z1 - r.z0) / 2, a0: r.x0, a1: r.x1, roofY }
        : { axis: 'z' as const, c: (r.x0 + r.x1) / 2, hw: (r.x1 - r.x0) / 2, a0: r.z0, a1: r.z1, roofY };
    });
  }
  private buildNarrowRects(): void {
    const L = this.layout, B = L.blockSize, R = L.roadWidth;
    this.narrowRects = L.alleys.filter((a) => a.axis === 'x' || a.axis === 'z').map((a) => {
      const x0 = L.roadCenters[a.bi] + R / 2, z0 = L.roadCenters[a.bj] + R / 2;
      const cx = x0 + B / 2, cz = z0 + B / 2, w = a.width / 2;
      const along = a.axis === 'z';
      return {
        x0: along ? cx - w : x0, x1: along ? cx + w : x0 + B, z0: along ? z0 : cz - w, z1: along ? z0 + B : cz + w,
        rx0: along ? cx - w : cx - 8, rx1: along ? cx + w : cx + 8, rz0: along ? cz - 8 : cz - w, rz1: along ? cz + 8 : cz + w,
        kind: a.covered ? 'tunnel' as const : 'alley' as const, name: a.name,
      };
    });
  }

  // ---------------- round 20: the suggested route, marked in the world ----------------
  /** The marked narrow run of the current leg: entrance arch (named) and exit arch. Null when the route has none. */
  private mark: {
    kind: 'alley' | 'tunnel'; name: string; names: string[]; stage: 'entrance' | 'through';
    gate: THREE.Vector3; inward: { x: number; z: number }; exit: THREE.Vector3; outward: { x: number; z: number }; width: number;
    legAt: number; shownAt: number; seenAt: number; seenDist: number; tagAt: number; tagOn: boolean; gateIn: boolean;
  } | null = null;
  private marksThisLeg = 0;
  /** Round 24: seconds the planner has disagreed with the mark in a row, and the closest the drone got to its entrance. */
  private markDisagree = 0;
  private markMinGate = Infinity;
  /** Round 20: the street graph without alleys and tunnels (roads and boulevards): the best route that keeps out of them. */
  private openGraph!: ReturnType<typeof buildStreetGraph>;
  // progress on the leg: best street route left so far and seconds since it last improved (a parcel off its route goes stale)
  private legBestLeft = 0;
  private payFrom = 0; // legBestLeft at the last payout (or the leg start)
  // the same on the plain grid: a pilot who flies the streets corner to corner (not the shortcut) makes progress on this one
  private legBestGrid = 0;
  private payFromGrid = 0;
  private payFlown = 0; // m flown since the last payout
  private stallT = 0;
  private progClock = 0;
  private stale = false;

  /** The two mouths of an alley block (on the mouth face line, centred), each with its unit direction into the alley. */
  private mouths(name: string): Array<{ x: number; z: number; ix: number; iz: number; w: number }> {
    const L = this.layout, B = L.blockSize, R = L.roadWidth;
    const a = L.alleys.find((q) => q.name === name);
    if (!a || (a.axis !== 'x' && a.axis !== 'z')) return [];
    const cx = L.roadCenters[a.bi] + R / 2 + B / 2, cz = L.roadCenters[a.bj] + R / 2 + B / 2;
    const off = B / 2 - GATE_FACE;
    return a.axis === 'z'
      ? [{ x: cx, z: cz - off, ix: 0, iz: 1, w: a.width }, { x: cx, z: cz + off, ix: 0, iz: -1, w: a.width }]
      : [{ x: cx - off, z: cz, ix: 1, iz: 0, w: a.width }, { x: cx + off, z: cz, ix: -1, iz: 0, w: a.width }];
  }

  /** The first run of alley or tunnel edges on a route: the mouth it enters and the mouth it leaves by. */
  private planMark(r: ReturnType<typeof routeOnGraph>, fx: number, fz: number, tx: number, tz: number, need: number): Game['mark'] {
    const pts = r.points;
    if (!r.kinds.includes('alley') && !r.kinds.includes('tunnel')) return null;
    // only a run that really saves: against the best route that keeps out of alleys and tunnels (boulevards allowed)
    const avoid = routeOnGraph(this.openGraph, fx, fz, tx, tz).length;
    if (avoid - r.length < GATE_SAVE_M * need || avoid - r.length < GATE_SAVE_SHARE * need * avoid) return null;
    const isN = (k: string) => k === 'alley' || k === 'tunnel';
    let k = pts.findIndex((q) => isN(q.kind));
    if (k < 0) return null;
    let m = k;
    while (m + 1 < pts.length && isN(pts[m + 1].kind)) m++;
    const names: string[] = [];
    for (let i = k; i <= m; i++) if (!names.includes(pts[i].name)) names.push(pts[i].name);
    const before = k > 0 ? pts[k - 1] : { x: fx, z: fz };
    const first = this.mouths(pts[k].name), last = this.mouths(pts[m].name);
    if (!first.length || !last.length) return null;
    const near = (ms: typeof first, x: number, z: number) => ms.reduce((a, b) => (Math.hypot(a.x - x, a.z - z) <= Math.hypot(b.x - x, b.z - z) ? a : b));
    const en = near(first, before.x, before.z);
    // the exit: of the last alley's mouths, the one the run ends at (not the entrance itself on a one-block run)
    const ex = last.length > 1 && pts[k].name === pts[m].name ? last.find((q) => q !== near(last, before.x, before.z))! : near(last, pts[m].x, pts[m].z);
    const kind = this.layout.alleys.find((q) => q.name === pts[k].name)?.covered ? 'tunnel' : 'alley';
    return {
      kind, name: pts[k].name, names, stage: 'entrance',
      gate: new THREE.Vector3(en.x, 0.25, en.z), inward: { x: en.ix, z: en.iz }, exit: new THREE.Vector3(ex.x, 0.25, ex.z), outward: { x: -ex.ix, z: -ex.iz }, width: en.w,
      legAt: this.rt(), shownAt: -1, seenAt: -1, seenDist: -1, tagAt: -1, tagOn: false, gateIn: false,
    };
  }

  private setMark(m: Game['mark']): void {
    this.mark = m;
    this.markDisagree = 0;
    this.markMinGate = m ? Math.hypot(this.drone.group.position.x - m.gate.x, this.drone.group.position.z - m.gate.z) : Infinity;
    if (!m) {
      this.gate.hide();
      return;
    }
    this.marksThisLeg++;
    const color = this.delivery.phase === 'pickup' ? MARKER_COLORS.pickup : MARKER_COLORS.drop;
    this.gate.show(color, m.name, m.gate, m.inward, m.exit, m.outward, m.width);
    // the drone may already be inside the run (a leg that starts at a mouth)
    const n = this.narrowAt(this.drone.group.position);
    if (n && m.names.includes(n.name)) this.markStage('through');
  }

  private clearMark(): void {
    this.mark = null;
    this.gate.hide();
    this.hud.setGate(0, 0, false, 0, '', '', false);
  }

  private markStage(stage: 'entrance' | 'through'): void {
    if (!this.mark) return;
    this.mark.stage = stage;
    this.gate.setStage(stage);
  }

  /**
   * Every frame while playing: advance the mark (through the entrance, out of the exit), and four times a second
   * re-plan from where the drone is. If the best route no longer starts with the marked run (the pilot went another
   * way), the mark moves to the new route's alley or tunnel, or goes away. The same re-plan measures progress.
   */
  private updateMark(dt: number): void {
    const p = this.drone.group.position, t = this.delivery.target.pos;
    const m = this.mark;
    if (m) {
      if (m.stage === 'entrance') {
        const along = (p.x - m.gate.x) * m.inward.x + (p.z - m.gate.z) * m.inward.z;
        const across = Math.abs((p.x - m.gate.x) * m.inward.z - (p.z - m.gate.z) * m.inward.x);
        if (along > 0.3 && across < m.width / 2 + 1.5 && p.y < 10) this.markStage('through');
      } else {
        const out = (p.x - m.exit.x) * m.outward.x + (p.z - m.exit.z) * m.outward.z;
        const across = Math.abs((p.x - m.exit.x) * m.outward.z - (p.z - m.exit.z) * m.outward.x);
        if (out > 0.5 && across < m.width / 2 + 3) {
          // out of the run: the pad marker leads from here (or the next alley if the route takes another)
          this.mark = null;
          this.gate.hide();
          this.hud.setRouteHint(null); // the hint named this run; it is done
          this.progClock = 1;
        }
      }
    }
    this.progClock += dt;
    if (this.progClock < 0.25) return;
    this.progClock = 0;
    const r = routeOnGraph(this.layout.graph, p.x, p.z, t.x, t.z);
    const left = r.length + Math.max(0, t.y - (p.y - FLIGHT.radius));
    const leftG = routeOnGraph(this.layout.gridGraph, p.x, p.z, t.x, t.z).length + Math.max(0, t.y - (p.y - FLIGHT.radius));
    let improved = false;
    if (left < this.legBestLeft - SLIPSTREAM.staleStep) {
      this.legBestLeft = left;
      improved = true;
    }
    if (leftG < this.legBestGrid - SLIPSTREAM.staleStep) {
      this.legBestGrid = leftG;
      improved = true;
    }
    // the final approach (inside staleNear m of the pad: slowing down, lining up, climbing to a roof) never goes stale
    const nearPad = Math.hypot(t.x - p.x, t.z - p.z) < SLIPSTREAM.staleNear;
    if (improved || nearPad) this.stallT = 0;
    else this.stallT += 0.25;
    const wasStale = this.stale;
    this.stale = this.stallT > SLIPSTREAM.staleAfter;
    if (this.stale && !wasStale) {
      this.staleCount++;
      this.scoreLog.push({ t: this.rt(), k: 'stale', v: this.bank });
    }
    // a mark already up stays while its run still saves half the bar (no flicker at the threshold)
    const next = this.planMark(r, p.x, p.z, t.x, t.z, this.mark ? 0.5 : 1);
    const cur = this.mark;
    if (cur) this.markMinGate = Math.min(this.markMinGate, Math.hypot(p.x - cur.gate.x, p.z - cur.gate.z));
    if (cur && next && cur.names.includes(next.name)) {
      this.markDisagree = 0; // still on the marked run
      return;
    }
    if (!cur && !next) return;
    if (cur && cur.stage === 'through') {
      // round 24: inside the run (or at its way out) the mark never moves or drops, whatever the route from here says
      // (round 20 kept it only when the new plan had no run at all; a neighbouring alley could still take it over)
      const inRun = this.narrow && cur.names.includes(this.narrow.name);
      if (inRun || Math.hypot(p.x - cur.exit.x, p.z - cur.exit.z) < 10) return;
    }
    if (cur) {
      // round 24 hysteresis: the mark moves or drops only once the pilot has clearly gone another way: the planner has
      // disagreed for MARK_COMMIT s in a row, or the drone has turned away from the marked entrance (MARK_AWAY m further
      // than its closest). A route that flips between two neighbouring alleys for a moment no longer moves it.
      this.markDisagree += 0.25;
      const away = Math.hypot(p.x - cur.gate.x, p.z - cur.gate.z) - this.markMinGate > MARK_AWAY;
      if (this.markDisagree < MARK_COMMIT && !away) return;
    }
    if (next) {
      next.legAt = this.routeHint?.at ?? this.rt();
      next.shownAt = this.rt();
    }
    this.setMark(next);
    if (next) this.hud.renameRouteHint(next.kind, next.name);
    else this.hud.setRouteHint(null);
  }

  /** HUD tag over the marked arch (clamped to the screen edge with an arrow when it is off screen), like the pad marker. */
  private updateGateTag(): void {
    const m = this.mark;
    if (!m || this.state !== 'playing') {
      this.hud.setGate(0, 0, false, 0, '', '', false);
      return;
    }
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const g = m.stage === 'entrance' ? m.gate : m.exit;
    const v = this.tmp2.set(g.x, g.y + (m.stage === 'entrance' ? 10.5 : 8), g.z).project(this.camera);
    const behind = v.z > 1;
    let x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
    // is the arch itself in the view (in front of the camera and inside the frame)?
    const a = this.tmp.set(g.x, g.y + 5, g.z).project(this.camera);
    const archIn = a.z < 1 && Math.abs(a.x) < 1 && Math.abs(a.y) < 1;
    if (behind) { x = w - x; y = h - y; }
    const mx = 40, top = h < 460 ? 140 : 150, bottom = h - 90; // below the objective pill and the route hint
    let off = behind || x < mx || x > w - mx || y < top || y > bottom;
    let angle = 0;
    if (off) {
      const cx = w / 2, cy = h / 2;
      let dx = x - cx, dy = y - cy;
      if (behind && Math.abs(dy) < 1) dy = 1;
      const sx = dx !== 0 ? (dx > 0 ? (w - mx - cx) / dx : (mx - cx) / dx) : Infinity;
      const sy = dy !== 0 ? (dy > 0 ? (bottom - cy) / dy : (top + 42 - cy) / dy) : Infinity;
      const s = Math.min(sx, sy);
      dx *= s; dy *= s;
      x = cx + dx; y = cy + dy;
      angle = Math.atan2(dy, dx) + Math.PI / 2;
    }
    let ok = Number.isFinite(x) && Number.isFinite(y);
    if (!ok) off = false;
    const dist = Math.hypot(g.x - this.drone.group.position.x, g.z - this.drone.group.position.z);
    // round 25: the pill stays fully on screen and, on a touch screen, off the stick, its "Fly" label, the buttons, the
    // top panels and a showing centre pop (it walks the screen edge to the nearest free spot, as the pad marker does)
    if (ok) {
      const name = m.stage === 'entrance' ? m.name : 'Way out';
      const r = this.gateTagPlace(w, h, x, y, off, angle, behind, v.x, v.y, this.hud.gateTagSize(name, Math.round(dist)));
      x = r.x;
      y = r.y;
      off = r.off;
      angle = r.angle;
      ok = Number.isFinite(x) && Number.isFinite(y);
    }
    this.hud.setGate(x, y, off, angle, m.stage === 'entrance' ? m.name : 'Way out', m.kind, ok, Math.round(dist));
    if (m.tagAt < 0 && ok) m.tagAt = this.rt();
    m.tagOn = ok && !off;
    m.gateIn = archIn;
    if (archIn && m.seenAt < 0 && m.stage === 'entrance') {
      m.seenAt = this.rt();
      m.seenDist = Math.round(dist);
    }
  }

  /**
   * Round 15 escalation: rush hour. At RUSH.startAt s of run time a banner and a horn announce it once. From then on
   * every second parcel is a rush order (every parcel from RUSH.everyAt s): it must reach its drop inside a short window
   * sized by the street route, for a flat bonus. A parcel already aboard when rush hour starts becomes the first one.
   * A missed window only loses the bonus: the parcel still pays as normal. The objective RNG is never touched.
   */
  private updateRush(dt: number): void {
    if (!this.rushOn && this.runTime >= RUSH.startAt && this.delivery.timeLeft > 0) {
      this.rushOn = true;
      this.rushAt = this.rt();
      this.env.setRush(true);
      this.scoreLog.push({ t: this.rt(), k: 'rushhour', v: 0 });
      if (this.delivery.phase === 'deliver') {
        const p = this.drone.group.position, t = this.delivery.target.pos;
        this.makeRush(Math.abs(t.x - p.x) + Math.abs(t.z - p.z) + Math.abs(t.y - p.y));
        this.setMarkerFromDelivery();
      }
      // round 26: on a first run the banner (and the rush tag with it) waits for a clear moment (see updateTeach)
      if (this.shown('rush')) this.rushBanner();
      else this.rushBannerDue = true;
    }
    if (!this.rushActive) return;
    this.rushLeft -= dt;
    if (this.rushLeft <= 0) {
      this.rushActive = false;
      this.rushMissed++;
      this.scoreLog.push({ t: this.rt(), k: 'rushmiss', v: 0 });
      this.hud.setRush(0, 0);
      this.hud.slipPop('Rush missed', 1, 'Still deliver it');
      this.audio.tick(false);
      this.setMarkerFromDelivery();
      return;
    }
    this.hud.setRush(this.rushLeft, this.rushWindow);
  }

  private makeRush(route: number): void {
    this.rushWindow = route / RUSH.speed + RUSH.slack;
    this.rushLeft = this.rushWindow;
    this.rushActive = true;
    this.rushOrders++;
    this.lastWasRush = true;
    this.scoreLog.push({ t: this.rt(), k: 'rushorder', v: Math.round(this.rushWindow * 10) / 10, c: Math.round(route) });
    this.audio.rushOrder();
    this.hud.setRush(this.rushLeft, this.rushWindow);
  }

  /** HUD chevrons: how fast the slipstream meter is filling right now (0 none, 1 slow, 2 good, 3 fast and tight). */
  private slipRateTier(): number {
    const r = this.slip.rate;
    return r <= 0 ? 0 : r < SLIPSTREAM.rateGood ? 1 : r < SLIPSTREAM.rateTop ? 2 : 3;
  }

  /** HUD cue naming the one thing that would fill the meter faster, or praising a wall hug. */
  private narrow: { kind: 'alley' | 'tunnel'; name: string; roof: boolean } | null = null;
  private staleCarry = 0;
  private staleLost = 0; // round 20: bank points faded off-route this run (a part of bankLost)
  private staleCount = 0;
  private vanDraft = false;
  private slipCue(): string {
    const s = this.slip, d = this.drone;
    if (this.stale && (s.drafting || this.bank > 0)) return 'stale';
    if (this.narrow && s.drafting) return this.narrow.roof ? 'tunnel' : 'alley';
    if (this.vanDraft && s.drafting) return 'van';
    const t = this.delivery.target;
    const nearPad = t ? Math.hypot(t.pos.x - d.group.position.x, t.pos.z - d.group.position.z) < 25 : false;
    if (nearPad) return '';
    if (s.wall > 0.3 && d.speed > 3 && s.speedFactor < 0.6) return 'faster';
    if (!s.drafting) return '';
    if (s.hug > 0.4) return 'hug';
    if (s.wall < 0.75 && s.speedFactor > 0.8) return 'closer';
    return '';
  }

  /** 0..1 draft pace for the slow clock: the meter's fill rate, nothing for a slow centred crawl, all of it fast and tight. */
  private slipClockPace(): number {
    const S = SLIPSTREAM;
    if (!this.slip.drafting) return 0;
    return Math.max(0, Math.min(1, (this.slip.rate - S.clockLow) / (S.clockFull - S.clockLow)));
  }

  /** 0..1: is the drone flying toward its current objective? The slow clock only helps on the way to a pickup or drop. */
  private slipTowardTarget(): number {
    const S = SLIPSTREAM;
    const v = this.drone.velocity;
    const sp = Math.hypot(v.x, v.z);
    const p = this.drone.group.position, t = this.delivery.target.pos;
    const dx = t.x - p.x, dz = t.z - p.z;
    const dist = Math.hypot(dx, dz);
    if (sp < 0.5 || dist < 1) return 1;
    const cos = (v.x * dx + v.z * dz) / (sp * dist);
    return Math.max(0, Math.min(1, (cos - S.towardLow) / (S.towardFull - S.towardLow)));
  }

  /** Low street line reward: draft meter, payouts, wind streaks and the rising whistle. */
  private updateSlipstream(dt: number): void {
    const d = this.drone;
    this.payFlown += Math.hypot(d.velocity.x, d.velocity.z) * dt;
    // round 19: in an alley the walls give the full draft; under a tunnel roof the slow clock runs at full strength
    this.narrow = this.narrowAt(d.group.position);
    this.vanDraft = this.env.vanDraft(d.group.position, d.velocity.x, d.velocity.z);
    const ev = this.slip.update(dt, d.group.position, d.speed, this.world, !!this.narrow, this.vanDraft);
    this.audio.setDraft(this.slip.intensity, this.slip.level);
    // slow clock: good drafting earns clock time smoothly, every frame, instead of in lumps per payout
    // (round 13: only on the way to the objective, and at most `clockBudget` seconds per leg, so it pays delivering)
    this.slipClockK = this.narrow?.roof && d.speed > SLIPSTREAM.minSpeed ? 1 : this.slipClockPace();
    // round 20: no slow clock while the parcel is off its route (circling, shuttling in a tunnel, tailing a van away)
    if (this.stale) this.slipClockK = 0;
    this.slipToward = this.slipClockK > 0 ? this.slipTowardTarget() : 1;
    // round 17: no slow clock in overtime (overtime is a fixed window)
    const want = this.delivery.overtime ? 0 : SLIPSTREAM.clockRate * this.slipClockK * this.slipToward * this.delivery.clockDecay * dt;
    const give = Math.min(want, this.slipBudget);
    const added = give > 0 ? this.delivery.addClock(give) : 0;
    this.slipBudget = Math.max(0, this.slipBudget - added);
    this.slip.seconds += added;
    this.slipClockGain = dt > 0 ? added / dt : 0;
    const idle = this.delivery.overtime || this.slipClockK < 0.3 || this.slipClockGain >= 0.03 ? '' : this.slipBudget <= 0 ? 'spent' : this.slipToward < 0.05 ? 'away' : '';
    this.hud.setSlowClock(this.slipClockGain, dt, this.slipBudget, idle);
    if (ev?.type === 'tick') { if (this.shown('slip')) this.audio.slipTick(ev.step); }
    else if (ev?.type === 'payout') {
      // round 14: the payout is banked on the parcel run (paid on delivery), not scored now
      const S = SLIPSTREAM;
      const pace = Math.max(S.bankPaceMin, Math.min(S.bankPaceMax, (ev.pace - S.bankPaceLow) / (S.bankPaceFull - S.bankPaceLow)));
      let want = Math.round(ev.points * pace * (d.carrying ? S.bankCarry : S.bankPickup));
      // round 15: the run's first payout banks at least bankFirstMin, so the first draft visibly counts
      if (!this.bankShownPay) want = Math.max(want, S.bankFirstMin);
      // round 20: a payout banks by the progress the leg made while it filled: route metres gained over distance flown,
      // full from S.bankProgress (a street line toward the objective, corners and detours included, is well above it;
      // shuttling in a tunnel, circling a block or tailing a van the wrong way is near 0)
      const prog = Math.max(0, this.payFrom - this.legBestLeft, this.payFromGrid - this.legBestGrid);
      const fac = this.payFlown > 2 ? Math.min(1, prog / (S.bankProgress * this.payFlown)) : 1;
      want = Math.round(want * fac);
      this.payFrom = this.legBestLeft;
      this.payFromGrid = this.legBestGrid;
      this.payFlown = 0;
      this.bankShownPay = true;
      // round 20: a payout made while the leg makes no progress banks nothing (the street bonus is for delivering)
      const pts = this.stale ? 0 : Math.max(0, Math.min(want, this.legCap - this.legBanked));
      this.bank += pts;
      this.legBanked += pts;
      this.bankTotal += pts;
      this.slip.points += pts;
      this.scoreLog.push({ t: this.rt(), k: 'pay', v: pts, c: d.carrying ? 1 : 0, m: ev.points, par: Math.round(ev.pace * 10) / 10 });
      this.hud.setBank(this.bank, d.carrying);
      d.boost = Math.min(1, d.boost + SLIPSTREAM.boost);
      // round 25: before the slipstream layer is introduced, payouts bank quietly. Round 26: really quietly (no chime,
      // shake or sparks either: nothing on screen would explain them; the bank is shown with the slipstream's introduction)
      if (!this.shown('slip')) { /* banked, shown with the delivery or the slipstream's introduction */ }
      else {
      this.audio.slipPayout(ev.chain);
      if (pts > 0) this.hud.slipPop(`+${pts}`, ev.chain, ev.chain > 1 ? `Banked · chain x${ev.chain}` : 'Banked · street bonus');
      else if (this.stale) this.hud.slipPop('Off route', ev.chain, 'No bonus · head for the marker');
      else this.hud.slipPop('Bonus full', ev.chain, d.carrying ? 'Deliver to cash in' : 'Grab the parcel');
      this.cameraRig.addShake(0.06 + 0.03 * ev.chain);
      this.vfx.burst(d.group.position, this.slipColor, 12 + ev.chain * 6, 6 + ev.chain, 0.12, this.fxRng);
      if (ev.chain >= 3) this.vfx.burst(d.group.position, this.slipHot, 6 + ev.chain * 3, 9 + ev.chain, 0.1, this.fxRng);
      }
    }
    // round 20: a parcel off its route goes stale: the banked street bonus fades while the leg makes no progress
    if (this.stale && this.bank > 0 && !this.delivery.overtime) {
      const cut = Math.min(this.bank, this.bank * SLIPSTREAM.staleDrain * dt + this.staleCarry);
      const whole = Math.floor(cut);
      this.staleCarry = cut - whole;
      if (whole > 0) {
        this.bank -= whole;
        this.bankLost += whole;
        this.staleLost += whole;
        this.hud.setBank(this.bank, d.carrying);
      }
    }
    // wind streaks peeling off the drone while it drafts
    if (this.slip.intensity > 0.15 && this.fxRng() < this.slip.intensity) {
      const p = this.tmp2.copy(d.group.position);
      const side = this.fxRng() < 0.5 ? -1 : 1;
      p.x += d.forward.x * 1.2 - d.forward.z * side * (0.9 + this.fxRng() * 0.6);
      p.z += d.forward.z * 1.2 + d.forward.x * side * (0.9 + this.fxRng() * 0.6);
      p.y += (this.fxRng() - 0.4) * 0.8;
      const v = this.tmp.set(-d.forward.x * d.speed * 0.6, 0, -d.forward.z * d.speed * 0.6).addScaledVector(d.velocity, 0.5);
      this.vfx.emit(p, v, this.slipColor, 0.1 + this.slip.intensity * 0.1, 0.3, 0);
    }
  }

  /** High wind: pale streaks blowing past the drone from ahead while it flies above the roofline. */
  private emitWindStreaks(): void {
    const d = this.drone;
    if (d.headwind < 0.3 || this.fxRng() > d.headwind * 0.7) return;
    const p = this.tmp2.copy(d.group.position);
    const side = (this.fxRng() - 0.5) * 7;
    p.x += d.forward.x * 7 - d.forward.z * side;
    p.z += d.forward.z * 7 + d.forward.x * side;
    p.y += (this.fxRng() - 0.3) * 3;
    const v = this.tmp.set(-d.forward.x * 22, -0.5, -d.forward.z * 22);
    this.vfx.emit(p, v, this.windColor, 0.12, 0.45, 0);
  }

  private emitBoostTrail(): void {
    const d = this.drone;
    const back = this.tmp.copy(d.forward).multiplyScalar(-0.7);
    for (let i = 0; i < 2; i++) {
      const p = this.tmp2.copy(d.group.position).add(back);
      p.x += (this.fxRng() - 0.5) * 0.8;
      p.y += (this.fxRng() - 0.5) * 0.3;
      p.z += (this.fxRng() - 0.5) * 0.8;
      const v = new THREE.Vector3(d.velocity.x * 0.2, 0.3, d.velocity.z * 0.2);
      this.vfx.emit(p, v, new THREE.Color('#7ff6ff'), 0.2, 0.35, 0);
    }
  }

  private emitRotorWash(): void {
    const p = this.drone.group.position;
    const surface = this.world.surfaceBelow(p.x, p.y, p.z);
    const h = p.y - surface;
    if (h > 3.2 || this.fxRng() > 0.6) return;
    const a = this.fxRng() * Math.PI * 2;
    const r = 0.6 + this.fxRng() * 0.6;
    const pos = this.tmp2.set(p.x + Math.cos(a) * r, surface + 0.15, p.z + Math.sin(a) * r);
    const v = new THREE.Vector3(Math.cos(a) * 4, 0.6, Math.sin(a) * 4);
    this.vfx.emit(pos, v, new THREE.Color('#8a7460'), 0.5 * (1 - h / 4), 0.6, 0);
  }

  private updateBlob(): void {
    const p = this.drone.group.position;
    const surface = this.world.surfaceBelow(p.x, p.y, p.z);
    const h = Math.max(0, p.y - surface);
    const lim = this.layout.half + 4;
    const overWater = Math.abs(p.x) > lim || Math.abs(p.z) > lim;
    this.blob.position.set(p.x, overWater ? -0.64 : surface + 0.06, p.z);
    const s = 1.6 + h * 0.04;
    this.blob.scale.set(s, s, 1);
    this.blob.material.opacity = THREE.MathUtils.clamp(1 - h / 30, 0, 1) * 0.75;
  }

  /**
   * Round 24: touch framing. On a phone held sideways the chase view puts the drone high on the screen once it climbs
   * (at 30 to 40 m it rode up under the timer, objective and route pills). The view is shifted down on screen (a
   * projection offset: the camera itself, its collision and the desktop view are unchanged) just enough to keep the
   * drone's top below the centre column, never pushing it into the bottom meters. Fast to engage, slow to let go.
   */
  private updateTouchFraming(dt: number): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const geo = this.state === 'playing' ? this.hud.touchLayout(w, h) : null;
    let need = 0;
    if (geo) {
      const cam = this.camera;
      cam.updateMatrixWorld();
      const p = this.drone.group.position;
      const v = this.tmp2.copy(p).project(cam);
      if (v.z < 1) {
        const yc = (-v.y * 0.5 + 0.5) * h - this.touchShift; // where the drone would sit without the shift
        const dist = Math.max(1, cam.position.distanceTo(p));
        const f = h / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
        const elev = Math.asin(THREE.MathUtils.clamp((cam.position.y - p.y) / dist, -1, 1));
        // the drone is about 3 m across and 0.6 m tall: its half-height on screen from this distance and elevation
        const half = (f / dist) * (1.55 * Math.abs(Math.sin(elev)) + 0.35 * Math.cos(elev)) + 4;
        need = geo.pillBottom + 12 - (yc - half);
        // never past the bottom meters (and at most a third of the screen)
        need = Math.min(need, geo.bottomTop - 10 - (yc + half), h * 0.33);
        need = Math.max(0, need);
      }
    }
    const k = need > this.touchShift ? 12 : 2.2;
    this.touchShift += (need - this.touchShift) * (1 - Math.exp(-k * dt));
    if (this.touchShift < 0.5 && need === 0) this.touchShift = 0;
    if (this.touchShift > 0) this.camera.setViewOffset(w, h, 0, -this.touchShift, w, h);
    else if (this.camera.view) this.camera.clearViewOffset();
  }

  /**
   * Round 24: on a touch screen the edge marker never lands on the stick or the buttons (nor on the top panels or a
   * showing centre pop). Its real footprint (diamond, distance label and, when clamped, the arrow at its angle) is
   * tested against those boxes; if it hits one, the marker slides along the screen edge to the nearest free spot.
   */
  private navFootprint(x: number, y: number, angle: number, arrow: boolean, dist: number): Box {
    const lw = 10 + 8 * String(Math.round(dist)).length + 14; // "123 m" pill
    let l = Math.min(x - 17, x - lw / 2), r = Math.max(x + 17, x + lw / 2), t = y - 17, b = y + 38;
    if (arrow) {
      const c = Math.cos(angle), sn = Math.sin(angle);
      // the arrow's whole box (36 x 24 px, 22 to 46 px out from the centre), turned to its angle
      for (const [px, py] of [[-18, -22], [18, -22], [-18, -46], [18, -46]]) {
        const ax = x + px * c - py * sn, ay = y + px * sn + py * c;
        l = Math.min(l, ax - 4); r = Math.max(r, ax + 4); t = Math.min(t, ay - 4); b = Math.max(b, ay + 4);
      }
    }
    return { l: l - 6, t: t - 6, r: r + 6, b: b + 6 };
  }

  /** Round 25: gate tag footprint (pill centred on the point, plus the edge arrow turned to its angle) and placement. */
  private gateFoot(x: number, y: number, angle: number, arrow: boolean, pw: number, ph: number): Box {
    let l = x - pw / 2, r = x + pw / 2, t = y - ph / 2, b = y + ph / 2;
    if (arrow) {
      const c = Math.cos(angle), sn = Math.sin(angle);
      for (const [px, py] of [[-12, -42], [12, -42], [-12, -26], [12, -26]]) {
        const ax = px * c - py * sn + x, ay = px * sn + py * c + y;
        l = Math.min(l, ax); r = Math.max(r, ax); t = Math.min(t, ay); b = Math.max(b, ay);
      }
    }
    return { l: l - 6, t: t - 6, r: r + 6, b: b + 6 };
  }

  private gateTagPlace(w: number, h: number, x: number, y: number, off: boolean, angle: number, behind: boolean, nx: number, ny: number, size: { w: number; h: number }): { x: number; y: number; off: boolean; angle: number } {
    const gut = 10;
    const hw = size.w / 2 + gut, hh = size.h / 2 + 4;
    // where the arch really is (screen px; mirrored and pushed far out when behind), for the arrow
    let tx = (nx * 0.5 + 0.5) * w, ty = (-ny * 0.5 + 0.5) * h;
    if (behind) { tx = w / 2 + (w / 2 - tx) * 50; ty = h / 2 + ((h / 2 - ty) || 1) * 50; }
    const ang = (px: number, py: number) => Math.atan2(ty - py, tx - px) + Math.PI / 2;
    // fully on screen
    const cx = THREE.MathUtils.clamp(x, hw, w - hw), cy = THREE.MathUtils.clamp(y, hh + 46, h - hh);
    if (cx !== x || cy !== y) { x = cx; y = cy; off = true; angle = ang(x, y); }
    const geo = this.hud.touchLayout(w, h);
    if (!geo) return { x, y, off, angle };
    const hit = (a: Box, list: Box[]) => list.some((q) => a.l < q.r && q.l < a.r && a.t < q.b && q.t < a.b);
    const blocks = [...geo.controls, ...geo.top];
    if (this.hud.popShowing) blocks.push(geo.slot);
    if (!hit(this.gateFoot(x, y, angle, off, size.w, size.h), blocks)) return { x, y, off, angle };
    // walk the edge rectangle both ways; the first free spot wins
    const mx = hw, y0 = 30 + hh, y1 = h - hh - 8;
    const W = Math.max(1, w - 2 * mx), H = Math.max(1, y1 - y0), P = 2 * (W + H);
    const at = (s: number): [number, number] => {
      s = ((s % P) + P) % P;
      if (s < W) return [mx + s, y0];
      if (s < W + H) return [w - mx, y0 + s - W];
      if (s < 2 * W + H) return [w - mx - (s - W - H), y1];
      return [mx, y1 - (s - 2 * W - H)];
    };
    const ex = THREE.MathUtils.clamp(x, mx, w - mx), ey = THREE.MathUtils.clamp(y, y0, y1);
    const dl = ex - mx, dr = w - mx - ex, dtp = ey - y0, db = y1 - ey;
    const mm = Math.min(dl, dr, dtp, db);
    const s0 = mm === dtp ? ex - mx : mm === dr ? W + ey - y0 : mm === db ? W + H + (w - mx - ex) : 2 * W + H + (y1 - ey);
    for (let step = 4; step < P / 2; step += 4) {
      for (const sgn of [1, -1]) {
        const [px, py] = at(s0 + sgn * step);
        const a = ang(px, py);
        if (!hit(this.gateFoot(px, py, a, true, size.w, size.h), blocks)) return { x: px, y: py, off: true, angle: a };
      }
    }
    return { x, y, off, angle };
  }

  private navTouch(geo: TouchLayout, w: number, h: number, x: number, y: number, tx: number, ty: number, off: boolean, dist: number): { x: number; y: number; off: boolean; angle: number } {
    const hit = (a: Box, list: Box[]) => list.some((q) => a.l < q.r && q.l < a.r && a.t < q.b && q.t < a.b);
    const blocks = [...geo.controls, ...geo.top];
    if (this.hud.popShowing) blocks.push(geo.slot);
    const ang = (px: number, py: number) => Math.atan2(ty - py, tx - px) + Math.PI / 2;
    const a0 = off ? ang(x, y) : 0;
    if (!hit(this.navFootprint(x, y, a0, off, dist), blocks)) return { x, y, off, angle: a0 };
    // walk the edge rectangle both ways from the clamped point; the first free spot wins
    const mx = 40, y0 = 30, y1 = h - 80;
    const W = w - 2 * mx, H = y1 - y0, P = 2 * (W + H);
    const at = (s: number): [number, number] => {
      s = ((s % P) + P) % P;
      if (s < W) return [mx + s, y0];
      if (s < W + H) return [w - mx, y0 + s - W];
      if (s < 2 * W + H) return [w - mx - (s - W - H), y1];
      return [mx, y1 - (s - 2 * W - H)];
    };
    // the clamped point's place along the edge
    const cx = THREE.MathUtils.clamp(x, mx, w - mx), cy = THREE.MathUtils.clamp(y, y0, y1);
    const dl = cx - mx, dr = w - mx - cx, dt = cy - y0, db = y1 - cy;
    const m = Math.min(dl, dr, dt, db);
    const s0 = m === dt ? cx - mx : m === dr ? W + cy - y0 : m === db ? W + H + (w - mx - cx) : 2 * W + H + (y1 - cy);
    for (let step = 4; step < P / 2; step += 4) {
      for (const sgn of [1, -1]) {
        const [px, py] = at(s0 + sgn * step);
        const a = ang(px, py);
        if (!hit(this.navFootprint(px, py, a, true, dist), blocks)) return { x: px, y: py, off: true, angle: a };
      }
    }
    return { x, y, off, angle: a0 };
  }

  private updateNav(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const target = this.tmp.copy(this.marker.position);
    target.y += 2.4;
    const dist = target.distanceTo(this.drone.group.position);
    const v = this.tmp2.copy(target).project(this.camera);
    const behind = v.z > 1;
    let x = (v.x * 0.5 + 0.5) * w;
    let y = (-v.y * 0.5 + 0.5) * h;
    if (behind) {
      x = w - x;
      y = h - y;
    }
    // round 24: where the target really is (behind: mirrored), for the touch arrow
    let tx = x, ty = y;
    if (behind) {
      tx = w / 2 + (x - w / 2) * 50;
      ty = h / 2 + (y - h / 2 || 1) * 50;
    }
    const mx = 40;
    const top = h < 460 ? 140 : 150; // round 20: below the objective pill and the route hint (was 120: it covered the hint on a phone)
    const bottom = h - 80;
    let off = behind || x < mx || x > w - mx || y < top || y > bottom;
    let angle = 0;
    if (off) {
      const cx = w / 2;
      const cy = h / 2;
      let dx = x - cx;
      let dy = y - cy;
      if (behind && Math.abs(dy) < 1) dy = 1;
      const sx = dx !== 0 ? (dx > 0 ? (w - mx - cx) / dx : (mx - cx) / dx) : Infinity;
      // the edge arrow sticks out 46 px above the diamond: keep it below the hint pill too
      const sy = dy !== 0 ? (dy > 0 ? (bottom - cy) / dy : (top + 46 - cy) / dy) : Infinity;
      const s = Math.min(sx, sy);
      dx *= s;
      dy *= s;
      x = cx + dx;
      y = cy + dy;
      angle = Math.atan2(dy, dx) + Math.PI / 2;
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) off = false;
    const geo = this.hud.touchLayout(w, h);
    if (geo && Number.isFinite(x) && Number.isFinite(y)) {
      const r = this.navTouch(geo, w, h, x, y, tx, ty, off, dist);
      x = r.x;
      y = r.y;
      off = r.off;
      angle = r.angle;
    }
    this.hud.setNav(x, y, off, angle, dist, Number.isFinite(x) && Number.isFinite(y));
  }

  private renderFromLoop(): void {
    if (!this.manualRender) this.render();
  }

  private render(): void {
    this.detail.update(this.camera.position);
    this.renderer.info.reset();
    this.pipeline.render();
    this.drawCalls = this.renderer.info.render.calls;
    this.triangles = this.renderer.info.render.triangles;
  }

  // ---------------- diagnostics & hooks ----------------
  private publishDiagnostics(): void {
    const p = this.drone.group.position;
    const info = this.renderer.info;
    window.__THREE_GAME_DIAGNOSTICS__ = {
      frame: this.frame,
      elapsed: this.time,
      state: this.state,
      seed: this.seed,
      score: this.delivery.score,
      targetScore: 0,
      complete: this.state === 'over',
      timeLeft: this.delivery.timeLeft,
      deliveries: this.delivery.deliveries,
      ending: { overtime: this.delivery.overtime, finished: this.delivery.finished, lastCall: this.delivery.lastCall, overtimeSeconds: this.delivery.tally.overtimeSeconds, partial: this.delivery.tally.partial, partialShare: this.partialShare, legRoute: this.legRoute3 },
      combo: this.delivery.combo,
      crashes: this.crashes,
      leg: { time: this.delivery.legTime, par: this.delivery.legPar },
      slipstream: { level: this.slip.level, intensity: this.slip.intensity, quality: this.slip.quality, wall: this.slip.wall, speedFactor: this.slip.speedFactor, rate: this.slip.rate, hotPoints: this.slip.hotPoints, hug: this.slip.hug, firstPayoutAt: this.slip.firstPayoutAt, drafting: this.slip.drafting, chain: this.slip.chain, payouts: this.slip.payouts, points: this.slip.points, seconds: this.slip.seconds, clockK: this.slipClockK, clockGain: this.slipClockGain, budget: this.slipBudget, toward: this.slipToward, bank: this.bank, bankTotal: this.bankTotal, bankPaid: this.bankPaid, bankLost: this.bankLost, legBanked: this.legBanked, legCap: this.legCap },
      scoreLog: this.scoreLog,
      teach: { on: this.teachOn, log: this.teachLog, queue: this.teachQueue.slice() },
      routeHint: this.routeHint ? { ...this.routeHint } : null,
      narrow: this.narrow ? { ...this.narrow } : null,
      routeMark: this.mark ? { kind: this.mark.kind, name: this.mark.name, names: this.mark.names.slice(), stage: this.mark.stage, gate: { x: this.mark.gate.x, y: this.mark.gate.y, z: this.mark.gate.z }, inward: { ...this.mark.inward }, exit: { x: this.mark.exit.x, y: this.mark.exit.y, z: this.mark.exit.z }, outward: { ...this.mark.outward }, width: this.mark.width, legAt: this.mark.legAt, shownAt: this.mark.shownAt, seenAt: this.mark.seenAt, seenDist: this.mark.seenDist, tagAt: this.mark.tagAt, tagOn: this.mark.tagOn, gateIn: this.mark.gateIn, board: this.gate.text, n: this.marksThisLeg } : null,
      progress: { best: Math.round(this.legBestLeft), stall: this.stallT, stale: this.stale, staleLost: this.staleLost, staleCount: this.staleCount },
      vanDraft: this.vanDraft,
      detail: { chunks: this.detail.drawnChunks, triangles: this.detail.triangles, counts: this.detail.counts },
      street: { ...this.env.traffic.stats(), people: this.env.people.total, peopleDrawn: this.env.people.drawn, reactions: this.env.people.reactions, reacting: this.env.people.reacting, onActivePad: this.env.people.onPad, droppedLoops: this.env.people.droppedLoops, msTraffic: +this.env.streetMs.traffic.toFixed(3), msPeople: +this.env.streetMs.people.toFixed(3) },
      centreLog: this.hud.centreLog.slice(-30),
      city: { mode: this.city.mode, seed: this.seed, date: this.city.date, dailyBest: this.daily.best, dailyTier: this.daily.tier, mood: MOODS[this.look.mood].name, parks: this.look.parks, features: this.featureCounts, rushLanes: this.env.rushLevel },
      escalation: { kind: 'rush', on: this.rushOn, startedAt: this.rushAt, stage: !this.rushOn ? 0 : this.runTime >= RUSH.everyAt ? 2 : 1, orders: this.rushOrders, made: this.rushMade, missed: this.rushMissed, points: this.rushPoints, active: this.rushActive, left: Math.max(0, this.rushLeft), window: this.rushWindow },
      breakdown: { ...this.delivery.tally, total: this.delivery.score },
      goals: { tier: this.tier, tierName: tierName(this.tier), next: nextGoal(this.delivery.score)?.score ?? 0, passes: this.tierPasses.length, passList: this.tierPasses, best: this.best, bestTier: this.bestTier, thresholds: GOALS.tiers.map((g) => g.score) },
      lastCrash: this.lastCrash,
      audio: { state: this.audio.contextState, music: this.audio.musicInfo() },
      contact: { bump: this.events.bump, ledge: this.events.ledge, wallLoss: this.events.wallLoss },
      objective: this.state === 'title' ? null : { phase: this.delivery.phase, name: this.delivery.target?.name ?? '', position: this.delivery.target ? { x: this.delivery.target.pos.x, y: this.delivery.target.pos.y, z: this.delivery.target.pos.z } : null },
      fps: Math.round(this.fps * 10) / 10,
      camera: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z, fov: this.camera.fov, aspect: this.camera.aspect, view: this.cameraRig.view, behind: this.cameraBehind(), corridor: this.cameraRig.corridor },
      drawCalls: this.drawCalls,
      player: {
        position: { x: p.x, y: p.y, z: p.z },
        speed: this.drone.speed,
        boost: this.drone.boost,
        headwind: this.drone.headwind,
        carrying: this.drone.carrying,
        yaw: this.drone.yaw,
        boosting: this.drone.boosting,
      },
      renderer: {
        calls: this.drawCalls,
        triangles: this.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        post: this.pipeline.postEnabled,
      },
      world: {
        buildings: this.layout.buildingCount,
        colliders: this.layout.colliders.length,
        sites: this.layout.sites.length,
        trees: this.layout.trees.length,
        hiddenProps: this.env.hiddenProps,
      },
      canvas: {
        clientWidth: this.canvas.clientWidth,
        clientHeight: this.canvas.clientHeight,
        width: this.canvas.width,
        height: this.canvas.height,
        dpr: Math.min(window.devicePixelRatio || 1, QUALITY.maxDpr),
      },
    };
  }

  /**
   * Round 21: the camera's heading around the drone relative to straight behind it (radians, + = swung to the drone's
   * right side) and its elevation, for probes.
   */
  private cameraBehind(): { yaw: number; elev: number } {
    const c = this.camera.position, p = this.drone.group.position;
    const dx = c.x - p.x, dz = c.z - p.z;
    // straight behind is the drone's -forward: forward = (-sin yaw, -cos yaw)
    const a = Math.atan2(dx, dz) - this.drone.yaw;
    return { yaw: Math.atan2(Math.sin(a), Math.cos(a)), elev: Math.atan2(c.y - p.y, Math.hypot(dx, dz)) };
  }

  /** Round 18: how many of each route-choice feature this city has (diagnostics). */
  private get featureCounts(): Record<string, number> {
    const c: Record<string, number> = { diagonal: 0, alley: 0, tunnel: 0 };
    for (const f of this.layout.features) c[f.kind] = (c[f.kind] ?? 0) + 1;
    return c;
  }

  private installHooks(): void {
    window.__GAME__ = {
      start: () => this.start(),
      restart: () => this.start(),
      pause: () => this.pause(),
      resume: () => this.resume(),
      end: () => {
        if (this.state === 'playing' || this.state === 'paused') this.endRun();
      },
      key: (code: string, down: boolean) => this.input.setKey(code, down),
      // round 21 test hook: orbit / zoom the camera as a drag or wheel would (radians, log zoom); held keeps a drag down
      view: (yaw: number, pitch = 0, zoom = 0, held?: boolean) => this.input.injectView(yaw, pitch, zoom, held),
      insideSolid: (x: number, y: number, z: number, pad = 0) =>
        this.layout.colliders.some((b) => !b.soft && x > b.minX - pad && x < b.maxX + pad && y > b.minY - pad && y < b.maxY + pad && z > b.minZ - pad && z < b.maxZ + pad),
      solidAt: (x: number, y: number, z: number, pad = 0) =>
        this.layout.colliders.filter((b) => !b.soft && x > b.minX - pad && x < b.maxX + pad && y > b.minY - pad && y < b.maxY + pad && z > b.minZ - pad && z < b.maxZ + pad).map((b) => ({ ...b })),
      manualRender: (on: boolean) => {
        this.manualRender = on;
      },
      // test hook: patch tunables, e.g. tune({ SLIPSTREAM: { points: 40 } }) (builder balance sims)
      tune: (patch: Record<string, Record<string, unknown>>) => {
        const all: Record<string, object> = { CRASH, FLIGHT, GOALS, RUN, RUSH, SLIPSTREAM, JOBS };
        for (const [k, v] of Object.entries(patch)) if (all[k]) Object.assign(all[k], v);
      },
      externalClock: (on: boolean) => {
        this.externalClock = on;
      },
      advance: (seconds: number, render = true) => {
        // deterministic fixed-step simulation for slow (software GL) test runs
        const steps = Math.max(1, Math.round(seconds * 60));
        for (let i = 0; i < steps; i++) this.update(1 / 60);
        if (render) this.render();
        return window.__THREE_GAME_DIAGNOSTICS__;
      },
      get state() {
        return window.__THREE_GAME_DIAGNOSTICS__?.state ?? 'title';
      },
      diagnostics: () => window.__THREE_GAME_DIAGNOSTICS__,
      // round 23 test hook: the camera's alley and tunnel corridors
      camCorridors: () => this.cameraCorridors(),
      place: (x: number, y: number, z: number, yaw: number, speed = 0) => this.drone.place(new THREE.Vector3(x, y, z), yaw, speed),
      // audio test hooks: per-frame bus meters (fanfare vs music) and the music toggle
      audioMeter: (on: boolean) => this.audio.setMeter(on),
      // audio test hook: hold the music at a chain level (null releases it), optionally in the last-10-s section
      musicForce: (chain: number | null, final = false) => this.audio.forceRunState(chain, final),
      music: (on: boolean) => this.audio.setMusicEnabled(on),
      sites: () => this.layout.sites.map((s) => ({ name: s.name, kind: s.kind, x: s.pos.x, y: s.pos.y, z: s.pos.z })),
      // round 15 test hook: build cities for these seeds (no rendering) and audit every pad (see world/padAudit.ts)
      padAudit: (seeds: number[]) =>
        seeds.map((seed) => {
          const layout = generateCity(createSeededRandom(seed), 7, cityLook(seed).parks, seed);
          const issues = auditPads(layout, FLIGHT.maxAltitude, 1.2, FLIGHT.radius);
          layout.geometry.dispose();
          return { seed, sites: layout.sites.length, issues };
        }),
      city: () => ({ ...this.city }),
      // round 18 test hook: shortest street route between two points, on the full street graph (roads, alleys, tunnels,
      // the diagonal) or on the plain grid (features = false). Bots and the route-choice probe use it.
      streetRoute: (from: { x: number; z: number }, to: { x: number; z: number }, features = true, narrowPenalty = 0) =>
        routeOnGraph(features ? this.layout.graph : this.layout.gridGraph, from.x, from.z, to.x, to.z, narrowPenalty),
      features: () => this.layout.features.map((f) => ({ ...f })),
      // round 18: the two rush lanes (axis 0 runs along x at z = at; axis 1 runs along z at x = at)
      vans: () => this.env.vanPositions(),
      // round 22 test hooks: street life. rush(on) forces rush hour on or off (lanes, vans, busier traffic) without the
      // run's rush orders; traffic() lists every live vehicle as a box; people() every person (x, z, reaction).
      rush: (on: boolean) => this.env.setRush(on),
      streetLife: (traffic: boolean, people: boolean) => this.env.setStreetLife(traffic, people),
      // round 27 test hook: facade / rooftop detail kit on or off (perf comparisons)
      detailOn: (on: boolean) => { this.detail.group.visible = on; },
      detailAudit: () => this.detail.audit(this.layout),
      archetypesInView: (range = 70) => this.detail.archetypesInView(this.layout, this.camera, range),
      traffic: () => this.env.traffic.snapshot(),
      people: () => this.env.people.snapshot(),
      rushLanes: () => this.layout.rushLanes.map((l) => ({ axis: l.axis, at: this.layout.roadCenters[l.index] })),
      // round 24 test hook: the drone's screen box (CSS px) through the real render camera
      droneBox: () => {
        // round 24: every visible vertex projected (a world-space box of the turned drone was far too big)
        const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, behind = false;
        const v = new THREE.Vector3();
        this.drone.group.updateWorldMatrix(true, true);
        this.drone.group.traverseVisible((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          const pos = m.geometry.getAttribute('position');
          const step = Math.max(1, Math.floor(pos.count / 600));
          for (let i = 0; i < pos.count; i += step) {
            v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).project(this.camera);
            if (v.z > 1) behind = true;
            const sx = (v.x * 0.5 + 0.5) * w, sy = (-v.y * 0.5 + 0.5) * h;
            if (sx < x0) x0 = sx;
            if (sx > x1) x1 = sx;
            if (sy < y0) y0 = sy;
            if (sy > y1) y1 = sy;
          }
        });
        return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, behind, shift: this.touchShift };
      },
    };
    window.__THREE_GAME_TEST_HOOKS__ = {
      seed: (value: number) => {
        this.rng = createSeededRandom(value);
      },
      setState: (name: string) => {
        if (name === 'title') {
          this.state = 'title';
          this.hud.showScreen('title');
          this.audio.setMusicScene('title');
        } else if (name === 'active-play' || name === 'playing') {
          this.start();
        } else if (name === 'complete' || name === 'over') {
          this.start();
          this.endRun();
        } else {
          throw new Error(`Unknown test state: ${name}`);
        }
        this.render();
        this.publishDiagnostics();
        return { state: name };
      },
      setPausedForScreenshot: (paused: boolean) => {
        this.frozen = paused;
      },
      setReducedMotion: (enabled: boolean) => {
        this.reducedMotion = enabled;
      },
      hideDebugUi: (hidden: boolean) => this.debug.setHidden(hidden),
    };
  }

  dispose(): void {
    this.loop.stop();
    this.input.dispose();
    this.audio.dispose();
    this.debug.dispose();
    this.pipeline.dispose();
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('keydown', this.onMenuKey);
    for (const type of ['pointerdown', 'touchend', 'click', 'keydown']) window.removeEventListener(type, this.onAnyGesture, true);
    this.renderer.dispose();
    window.__THREE_GAME_DIAGNOSTICS__ = undefined;
    window.__THREE_GAME_TEST_HOOKS__ = undefined;
    window.__GAME__ = undefined;
  }
}
