import * as THREE from 'three';
import { InputController, type FlightIntent } from '../core/InputController';
import { Loop } from '../core/Loop';
import { createRenderer, RenderPipeline } from '../core/Renderer';
import { createSeededRandom, type Rng } from '../core/random';
import { Drone, type FlightEvents } from '../entities/Drone';
import { MARKER_COLORS, ObjectiveMarker } from '../entities/ObjectiveMarker';
import { AudioSystem } from '../systems/AudioSystem';
import { CameraRig } from '../systems/CameraRig';
import { CollisionWorld } from '../systems/CollisionWorld';
import { DebugTools } from '../systems/DebugTools';
import { DeliverySystem } from '../systems/DeliverySystem';
import { Slipstream } from '../systems/Slipstream';
import { VfxSystem } from '../systems/VfxSystem';
import { Hud } from '../ui/Hud';
import { createCityMaterial, type CityMaterial } from '../world/CityMaterial';
import { generateCity, type CityLayout } from '../world/CityGenerator';
import { createSky, Environment, LightingRig, PALETTE } from '../world/Environment';
import { radialTexture } from '../world/Textures';
import { CRASH, FLIGHT, GOALS, QUALITY, RUN, SLIPSTREAM } from './config';
import { nextGoal, readBestTier, tierFor, tierName, writeBestTier } from './goals';

export type GameState = 'title' | 'playing' | 'paused' | 'over';

const BEST_KEY = 'drone-dash-best-v1';
const MEDAL_COLORS = [new THREE.Color('#e0955a'), new THREE.Color('#eef2f7'), new THREE.Color('#ffd166'), new THREE.Color('#5ff5d4')];
const DEFAULT_SEED = 7;

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
  private readonly slip = new Slipstream();
  private readonly slipColor = new THREE.Color('#ffe7b0');
  private readonly slipHot = new THREE.Color('#fff6e8');
  private readonly windColor = new THREE.Color('#e6f2ff');
  private readonly layout: CityLayout;
  private readonly world: CollisionWorld;
  private readonly env: Environment;
  private readonly lighting: LightingRig;
  private readonly cityMaterial: CityMaterial;
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
  private rng: Rng;
  private readonly fxRng: Rng;
  private readonly intent: FlightIntent = { turn: 0, thrust: 0, lift: 0, boost: false };
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
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();

  constructor(private readonly canvas: HTMLCanvasElement) {
    const params = new URLSearchParams(window.location.search);
    const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
    this.seed = Number.isFinite(seedParam) ? seedParam : DEFAULT_SEED;
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
    this.layout = generateCity(createSeededRandom(this.seed));
    this.world = new CollisionWorld(this.layout.colliders, 0);
    this.cityMaterial = createCityMaterial();
    const city = new THREE.Mesh(this.layout.geometry, this.cityMaterial);
    city.castShadow = true;
    city.receiveShadow = true;
    city.name = 'city';
    this.scene.add(city);

    this.sky = createSky();
    this.scene.add(this.sky);
    this.scene.fog = new THREE.FogExp2(PALETTE.fog.clone(), 0.0017);
    this.scene.background = PALETTE.horizon.clone();
    this.bakeEnvironment();

    this.lighting = new LightingRig(this.scene, touch ? 1024 : QUALITY.shadowMapSize, QUALITY.shadowExtent);
    this.env = new Environment(this.layout, this.seed);
    this.scene.add(this.env.group);

    this.scene.add(this.drone.group);
    this.scene.add(this.marker.group);
    this.scene.add(this.vfx.group);

    this.blob = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: radialTexture('rgba(20,10,5,0.7)', 'rgba(20,10,5,0)'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }),
    );
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.renderOrder = 1;
    this.scene.add(this.blob);

    this.delivery = new DeliverySystem(this.layout.sites);

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
    this.lastTick = -1;
    this.wasBoosting = false;
    this.hud.resetCache();
    this.hud.armSlipHint();
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

  private endRun(): void {
    this.state = 'over';
    this.input.enabled = false;
    this.hud.setSpeedLines(0);
    this.audio.setRotor(false);
    const score = this.delivery.score;
    this.audio.gameOver(tierFor(score));
    this.audio.setMusicScene('over', tierFor(score));
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
      startTime: RUN.startTime,
      dropSeconds: T.dropSeconds,
      slipSeconds: T.slipSeconds,
      crashSeconds: T.crashSeconds,
      crashes: this.crashes,
    });
    this.hud.showScreen('over');
    this.marker.hide();
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

  private setMarkerFromDelivery(): void {
    const kind = this.delivery.phase === 'pickup' ? 'pickup' : 'drop';
    const t = this.delivery.target;
    this.marker.set(kind, t.pos, t.radius);
    this.drone.guide.copy(t.pos);
    this.drone.hasGuide = true;
    this.hud.setObjective(kind, t.name);
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
    this.hitStop = Math.max(0, this.hitStop - realDt);
    this.input.read(this.intent);
    const d = this.drone;
    d.update(dt, this.intent, this.world, this.layout.half + 30, this.events);
    this.checkCrash(realDt);
    this.updateSlipstream(dt);
    const dp = d.group.position;
    const groundBelow = this.world.surfaceBelow(dp.x, dp.y, dp.z);
    const altAboveGround = Math.max(0, dp.y - groundBelow - 0.85);
    this.cameraRig.update(realDt, d, this.world, altAboveGround, this.marker.position);
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
    if (ev?.type === 'picked') {
      d.setCarrying(true);
      this.audio.pickup();
      this.vfx.burst(this.tmp.copy(ev.site.pos).setY(ev.site.pos.y + 1.8), MARKER_COLORS.pickup, 36, 9, 0.2, this.fxRng);
      this.vfx.ring(this.tmp.copy(ev.site.pos).setY(ev.site.pos.y + 0.3), MARKER_COLORS.pickup, 5.5);
      this.hud.popText('Parcel secured!', 'Now deliver it', 'pickup');
      this.setMarkerFromDelivery();
    } else if (ev?.type === 'delivered') {
      d.setCarrying(false);
      this.audio.deliver(ev.combo);
      this.topCombo = Math.max(this.topCombo, ev.combo);
      this.vfx.burst(this.tmp.copy(ev.site.pos).setY(ev.site.pos.y + 1), MARKER_COLORS.drop, 56, 12, 0.22, this.fxRng);
      this.vfx.ring(this.tmp.copy(ev.site.pos).setY(ev.site.pos.y + 0.3), MARKER_COLORS.drop, 9);
      this.cameraRig.addShake(0.2);
      const sub = ev.fast ? (ev.combo > 1 ? `Fast drop · x${this.delivery.multiplier.toFixed(1)} combo` : 'Fast drop!') : 'Delivered';
      this.hud.popText(`+${ev.points}`, sub, 'drop');
      this.hud.flashTimeBonus(ev.timeBonus);
      this.setMarkerFromDelivery();
    }

    // low-time ticks
    const tl = this.delivery.timeLeft;
    const whole = Math.ceil(tl);
    if (tl <= 10 && whole !== this.lastTick && tl > 0) {
      this.lastTick = whole;
      this.audio.tick(tl <= 5);
    }
    // music follows the chain, the clock and a close medal (within the last 15% of the way to it)
    const goal = nextGoal(this.delivery.score);
    this.audio.setRunState(this.slip.chain, tl, !!goal && goal.progress >= 0.85);

    this.audio.updateRotor(Math.min(1, d.speed / FLIGHT.boostSpeed), Math.min(1, Math.abs(this.intent.thrust) * 0.6 + Math.abs(this.intent.lift) * 0.4), d.boosting, Math.min(1, d.group.position.y / 80), d.headwind);

    this.hud.setScore(this.delivery.score);
    this.checkMedal();
    this.hud.setCombo(this.delivery.multiplier, this.delivery.combo);
    this.hud.setDeliveries(this.delivery.deliveries);
    this.hud.setTime(tl, RUN.startTime);
    this.hud.setBoost(d.boost, d.boosting);
    // true altitude above street level (consistent everywhere, rooftops included)
    this.hud.setTelemetry(d.speed, Math.max(0, dp.y - 0.85));
    this.hud.setSpeedLines(Math.max(d.boosting ? Math.min(1, d.speed / 24) : 0, this.slip.intensity * 0.5));
    // the wind chip only matters while the drone is actually trying to go somewhere up high (not while it hovers at a rooftop pad)
    const windy = d.headwind > 0.35 && d.speed > 7;
    this.hud.setSlip(this.slip.level, this.slip.drafting, this.slip.chain, windy, this.slip.hug > 0.4, dt, this.slipRateTier(), this.slipCue());
    this.hud.setWind(windy);
    this.updateNav();

    if (tl <= 0) this.endRun();
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
    const fresh = this.crashWindow <= 0;
    this.crashCharged = tier.seconds;
    this.crashWindow = CRASH.window;
    if (fresh) this.crashes++;
    this.lastCrash = { loss: this.hitLoss, wallTop: this.hitTop, normalY: this.hitNormalY, y: this.drone.group.position.y };
    this.crashFeedback(tier.label, tier.seconds, res.comboLost, Math.min(1, this.hitLoss / 30), fresh);
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

  private crashFeedback(label: string, seconds: number, comboLost: number, s: number, fresh: boolean): void {
    const d = this.drone;
    this.hud.flashTimePenalty(seconds);
    const lost = comboLost > 0 ? `-${seconds} sec · x${comboLost.toFixed(1)} combo lost` : `-${seconds} sec`;
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

  /** Medals: crossing a tier's score is a moment (banner, fanfare, sparkle) and is counted for scripts. */
  private checkMedal(): void {
    const score = this.delivery.score;
    this.hud.setGoal(score);
    const t = tierFor(score);
    if (t <= this.tier) return;
    for (let k = this.tier + 1; k <= t; k++) this.tierPasses.push({ tier: k, name: tierName(k), score, t: Math.round(this.runTime * 10) / 10 });
    this.tier = t;
    this.audio.medal(t, this.hud.medalPop(t));
    const c = MEDAL_COLORS[Math.min(t, MEDAL_COLORS.length) - 1];
    this.vfx.burst(this.drone.group.position, c, 26 + t * 6, 8 + t, 0.16, this.fxRng);
    this.cameraRig.addShake(0.12);
  }

  /** HUD chevrons: how fast the slipstream meter is filling right now (0 none, 1 slow, 2 good, 3 fast and tight). */
  private slipRateTier(): number {
    const r = this.slip.rate;
    return r <= 0 ? 0 : r < SLIPSTREAM.rateGood ? 1 : r < SLIPSTREAM.rateTop ? 2 : 3;
  }

  /** HUD cue naming the one thing that would fill the meter faster, or praising a wall hug. */
  private slipCue(): string {
    const s = this.slip, d = this.drone;
    const t = this.delivery.target;
    const nearPad = t ? Math.hypot(t.pos.x - d.group.position.x, t.pos.z - d.group.position.z) < 25 : false;
    if (nearPad) return '';
    if (s.wall > 0.3 && d.speed > 3 && s.speedFactor < 0.6) return 'faster';
    if (!s.drafting) return '';
    if (s.hug > 0.4) return 'hug';
    if (s.wall < 0.75 && s.speedFactor > 0.8) return 'closer';
    return '';
  }

  /** Low street line reward: draft meter, payouts, wind streaks and the rising whistle. */
  private updateSlipstream(dt: number): void {
    const d = this.drone;
    const ev = this.slip.update(dt, d.group.position, d.speed, this.world);
    this.audio.setDraft(this.slip.intensity, this.slip.level);
    if (ev?.type === 'tick') this.audio.slipTick(ev.step);
    else if (ev?.type === 'payout') {
      const pts = this.delivery.addBonus(ev.points, SLIPSTREAM.seconds, false);
      this.slip.points += pts;
      this.slip.seconds += SLIPSTREAM.seconds;
      d.boost = Math.min(1, d.boost + SLIPSTREAM.boost);
      this.audio.slipPayout(ev.chain);
      this.hud.slipPop(`+${pts}`, ev.chain);
      this.hud.flashTimeBonus(SLIPSTREAM.seconds);
      this.cameraRig.addShake(0.06 + 0.03 * ev.chain);
      this.vfx.burst(d.group.position, this.slipColor, 12 + ev.chain * 6, 6 + ev.chain, 0.12, this.fxRng);
      if (ev.chain >= 3) this.vfx.burst(d.group.position, this.slipHot, 6 + ev.chain * 3, 9 + ev.chain, 0.1, this.fxRng);
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
    const mx = 40;
    const top = 120;
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
      const sy = dy !== 0 ? (dy > 0 ? (bottom - cy) / dy : (top - cy) / dy) : Infinity;
      const s = Math.min(sx, sy);
      dx *= s;
      dy *= s;
      x = cx + dx;
      y = cy + dy;
      angle = Math.atan2(dy, dx) + Math.PI / 2;
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) off = false;
    this.hud.setNav(x, y, off, angle, dist, Number.isFinite(x) && Number.isFinite(y));
  }

  private renderFromLoop(): void {
    if (!this.manualRender) this.render();
  }

  private render(): void {
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
      combo: this.delivery.combo,
      crashes: this.crashes,
      leg: { time: this.delivery.legTime, par: this.delivery.legPar },
      slipstream: { level: this.slip.level, intensity: this.slip.intensity, quality: this.slip.quality, wall: this.slip.wall, speedFactor: this.slip.speedFactor, rate: this.slip.rate, hotPoints: this.slip.hotPoints, hug: this.slip.hug, firstPayoutAt: this.slip.firstPayoutAt, drafting: this.slip.drafting, chain: this.slip.chain, payouts: this.slip.payouts, points: this.slip.points, seconds: this.slip.seconds },
      breakdown: { ...this.delivery.tally, total: this.delivery.score },
      goals: { tier: this.tier, tierName: tierName(this.tier), next: nextGoal(this.delivery.score)?.score ?? 0, passes: this.tierPasses.length, passList: this.tierPasses, best: this.best, bestTier: this.bestTier, thresholds: GOALS.tiers.map((g) => g.score) },
      lastCrash: this.lastCrash,
      audio: { state: this.audio.contextState, music: this.audio.musicInfo() },
      contact: { bump: this.events.bump, ledge: this.events.ledge, wallLoss: this.events.wallLoss },
      objective: this.state === 'title' ? null : { phase: this.delivery.phase, name: this.delivery.target?.name ?? '', position: this.delivery.target ? { x: this.delivery.target.pos.x, y: this.delivery.target.pos.y, z: this.delivery.target.pos.z } : null },
      fps: Math.round(this.fps * 10) / 10,
      camera: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z, fov: this.camera.fov, aspect: this.camera.aspect },
      drawCalls: this.drawCalls,
      player: {
        position: { x: p.x, y: p.y, z: p.z },
        speed: this.drone.speed,
        boost: this.drone.boost,
        headwind: this.drone.headwind,
        carrying: this.drone.carrying,
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
      manualRender: (on: boolean) => {
        this.manualRender = on;
      },
      // test hook: patch tunables, e.g. tune({ SLIPSTREAM: { points: 40 } }) (builder balance sims)
      tune: (patch: Record<string, Record<string, unknown>>) => {
        const all: Record<string, object> = { CRASH, FLIGHT, GOALS, RUN, SLIPSTREAM };
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
      place: (x: number, y: number, z: number, yaw: number, speed = 0) => this.drone.place(new THREE.Vector3(x, y, z), yaw, speed),
      // audio test hooks: per-frame bus meters (fanfare vs music) and the music toggle
      audioMeter: (on: boolean) => this.audio.setMeter(on),
      // audio test hook: hold the music at a chain level (null releases it), optionally in the last-10-s section
      musicForce: (chain: number | null, final = false) => this.audio.forceRunState(chain, final),
      music: (on: boolean) => this.audio.setMusicEnabled(on),
      sites: () => this.layout.sites.map((s) => ({ name: s.name, kind: s.kind, x: s.pos.x, y: s.pos.y, z: s.pos.z })),
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
