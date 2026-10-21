import { storeGet, storeSet } from '../core/storage';
import { ARP_ORDER, BPM, FINAL_PROG, midi, OVER_PROG_MEDAL, OVER_PROG_NONE, RUN_ARP_ORDERS, RUN_BASS_VARIANTS, RUN_FORM, RUN_LEAD, RUN_LEAD_ORDER, STEP, TITLE_PLUCK, TITLE_PROG, type Chord } from './music';
import { SPRITE, SPRITE_SYNC } from './sfxSprite';
import { BB_BPM, BB_STEP, bbChord, Breakbeat, type BeatScene } from './breakbeat';

export type MusicScene = 'off' | 'title' | 'run' | 'final' | 'over';
type Layer = 'pad' | 'bass' | 'drums' | 'arp' | 'lead' | 'urg';
const LAYERS: Layer[] = ['pad', 'bass', 'drums', 'arp', 'lead', 'urg'];

const MUSIC_KEY = 'drone-dash-music-v1';
// Round 46: which soundtrack plays (Classic, the original; Breakbeat, the alternative) and the effects switch
const TRACK_KEY = 'drone-dash-track-v1';
const SFX_KEY = 'drone-dash-sfx-v1';
export type Soundtrack = 'classic' | 'breakbeat';
export const SOUNDTRACKS: Soundtrack[] = ['classic', 'breakbeat'];
/**
 * Round 46 (critic: menus 1.4 LU over the run): scene levels per soundtrack. Classic's title and game-over loops come
 * down 1.4 dB; Breakbeat's levels are matched the same way (run near -16 LUFS, menus within 1 LU of it).
 */
const SCENE_GAIN: Record<Soundtrack, Record<'title' | 'run' | 'over', number>> = {
  classic: { title: 0.85, run: 1, over: 0.85 },
  breakbeat: { title: 1.78, run: 1, over: 1.64 },
};
/** Round 46: the music tone filter's resting cutoff (Breakbeat's hats and ride need the air above 6.5 kHz). */
const TONE_OPEN: Record<Soundtrack, number> = { classic: 6500, breakbeat: 12000 };
/** Rotor detune per motor (codex low: a constant, not a new array every frame). */
const ROTOR_DET = [-0.011, -0.004, 0.005, 0.013] as const;
/** Round 46: the crash's level against round 45 (-4 dB). */
const CRASH_TRIM = 0.63;
// Round 45: the music bus sits 2 dB higher (the rotor no longer covers it); the over loop gets its own lift below.
const MUSIC_VOL = 0.63;
// Master level into the glue compressor and the limiter. Round 45: the mix is built from four sub-buses (music, drone,
// ambience, effects) plus one effects return (reverb, slapback, ping-pong); the run sits near -16 LUFS and the trim after
// the limiter keeps every true peak under -1 dBTP (the limiter's automatic make-up gain lifts its ceiling).
const MASTER_VOL = 2.0;
const OUT_TRIM = 0.62;
const LOOKAHEAD = 0.2; // s of notes scheduled ahead on the audio clock
const TICK_MS = 25; // scheduler wake-up (a main-thread stall up to ~175 ms still lands every note on time)
const FINAL_IN = 10; // s left on the clock: the tension section starts
const FINAL_OUT = 12; // s left: a time bonus has to lift the clock this far before the run section comes back
/** Round 45: the game-over loop is quiet pad and bells; it is lifted this much (and its sub cut) to sit near the run. */
const OVER_LIFT = 1.95;
/** Round 46: Breakbeat's level into the music chain (matched to Classic's run loudness). */
const BB_LEVEL = 0.7;
/** Round 45: rotor and air bed level (drone bus), a little under the music in cruise. */
const DRONE_VOL = 0.21;
const AMB_VOL = 0.55;
const SFX_VOL = 0.9;

function readMusicPref(): boolean {
  try {
    return storeGet(MUSIC_KEY) !== '0';
  } catch {
    return true;
  }
}
function writeMusicPref(on: boolean): void {
  try {
    storeSet(MUSIC_KEY, on ? '1' : '0');
  } catch {
    /* storage unavailable */
  }
}
/**
 * Soundtrack: `?music=breakbeat` or `?music=classic` wins for this page (not saved), then the saved choice.
 * Round 47 (the owner's choice): Breakbeat is the default. Only an explicit 'classic' (URL or saved) gives Classic; no
 * choice or an unknown value gives Breakbeat.
 */
function readTrackPref(): Soundtrack {
  try {
    const q = new URLSearchParams(window.location.search).get('music');
    if (q === 'classic' || q === 'breakbeat') return q;
    return storeGet(TRACK_KEY) === 'classic' ? 'classic' : 'breakbeat';
  } catch {
    return 'breakbeat';
  }
}
function readSfxPref(): boolean {
  try {
    return storeGet(SFX_KEY) !== '0';
  } catch {
    return true;
  }
}
function writePref(key: string, v: string): void {
  try {
    storeSet(key, v);
  } catch {
    /* storage unavailable */
  }
}

/** A planned duck of the music bus: hold `depth` from `at` to `end`, then glide back to 1 over `release`. */
interface DuckSeg { from: number; start: number; at: number; depth: number; end: number; release: number }

/** Options for one sample voice. */
interface SampOpts { gain?: number; rate?: number; pan?: number; dest?: AudioNode; verb?: number; slap?: number; lp?: number; hp?: number; att?: number; iverb?: number }
/** Options for one FM bell. */
interface BellOpts { pan?: number; verb?: number; ping?: number; bright?: number }

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Web Audio for Drone Dash. Round 45 rebuilt the effects side and the mix:
 * - Mix: music, drone (rotor, air, slipstream, boost burner), ambience and effects buses into a master with a glue
 *   compressor, a limiter and a trim. One effects return carries a shared reverb (a generated 1.1 s stereo impulse),
 *   a slapback echo that opens in narrow streets and alleys, and a ping-pong delay for the chimes. Priority cues duck
 *   the music, the drone and the ambience, then let them recover.
 * - Rotor: four slightly detuned rotors (a blade-harmonic wave each, spread in stereo), a body resonance, gentle
 *   saturation, a mid cut that leaves room for chimes, and blade-chop air (noise gated at the blade rate by two beating
 *   LFOs). Pitch, filter and chop follow thrust, speed, boost and banking; a parcel makes it a little heavier.
 * - Samples: a small CC0 Kenney sound sprite (public/assets/audio/sfx.mp3, see ASSETS.md), fetched and decoded after
 *   the first frame. Every sampled cue keeps a procedural fallback until the sprite is ready.
 * - Chimes: slipstream payouts and deliveries play FM bells on the notes of the chord the music is on.
 * - Ambience: city hum and distant traffic, harbour water and wind, high-altitude wind, crossfaded by position; passing
 *   cars and boats get a short Doppler pass-by.
 * The context is created lazily (prewarmed suspended after the first frame; resumed on the first user gesture).
 *
 * Music never uses the 'square' oscillator type (the medal fanfare's brass is the only square below 1 kHz,
 * which test scripts count).
 */
export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private outTrim!: GainNode;
  private sfx!: GainNode;
  private musicBus!: GainNode;
  private droneBus!: GainNode;
  private droneOut!: GainNode;
  private ambBus!: GainNode;
  private ambOut!: GainNode;
  private ambGate!: GainNode;
  private fxReturn!: GainNode;
  private reverbSend!: GainNode;
  private slapSend!: GainNode;
  private slapOut!: GainNode;
  private pingSend!: GainNode;
  private musicTone!: BiquadFilterNode;
  private musicLowCut!: BiquadFilterNode;
  private sceneLift!: GainNode;
  private lastScrape = 0;
  private lastGrain = 0;
  // rotor
  private rotors: OscillatorNode[] = [];
  private rotorGain!: GainNode;
  private rotorSputter!: GainNode;
  private rotorBody!: BiquadFilterNode;
  private rotorLp!: BiquadFilterNode;
  private rotorAm!: GainNode;
  private rotorPan!: StereoPannerNode;
  private lfoA!: OscillatorNode;
  private lfoB!: OscillatorNode;
  private chopGain!: GainNode;
  private subOsc!: OscillatorNode;
  private subGain!: GainNode;
  private chopFilter!: BiquadFilterNode;
  /** round 47: blade-chop depth (amplitude modulation of the rotor and its air), scaled by speed */
  private chopDepth: GainNode[] = [];
  /** round 47: the slipstream's two offset bands (left, right) */
  private draftL!: BiquadFilterNode;
  private draftR!: BiquadFilterNode;
  /** round 47: Classic's pad dips near 1.2 kHz while drafting; its melodic layers close to 2.4 kHz in the last 10 s */
  private padDip!: BiquadFilterNode;
  private melLpC!: BiquadFilterNode;
  /** round 47: impact samples into the shared room through a 250 Hz high-pass */
  private impactVerb!: GainNode;
  /** round 47: the brass horns' soft clip */
  private hornSat!: WaveShaperNode;
  /** round 47: audio-clock time the run clock reaches 0 (for the gap before Breakbeat's overtime drop) */
  private clockZeroAt = Infinity;
  private clockRate = 1;
  private clockT = 0;
  private clockTL = 0;
  private tickN = 0;
  private rotorHz = 0;
  // air
  private windGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private airGain!: GainNode;
  private draftGain!: GainNode;
  private draftFilter!: BiquadFilterNode;
  private draftPan!: StereoPannerNode;
  private gust = 0;
  private gustV = 0;
  // ambience
  private ambCityGain!: GainNode;
  private ambTrafficGain!: GainNode;
  private ambTrafficFilter!: BiquadFilterNode;
  private ambWaterGain!: GainNode;
  private ambWaterFilter!: BiquadFilterNode;
  private ambWindGain!: GainNode;
  private ambHighGain!: GainNode;
  private ambCityLow: GainNode | null = null;
  private amb = { city: 0, harbour: 0, alt: 0, narrow: 0, lap: 0, lapV: 0, lapT: 0, traffic: 0, trafficV: 0 };
  private ambOn = false;
  private boostSrc: AudioBufferSourceNode | null = null;
  private boostGain: GainNode | null = null;
  private passes = 0;
  private lastPass = 0;
  private passLive: number[] = [];
  private lastPassNear = 0;
  private carrying = false;
  private noiseBuffer!: AudioBuffer;
  private noiseStereo!: AudioBuffer;
  private softSaw: PeriodicWave | null = null;
  private bladeWave: PeriodicWave | null = null;
  private rotorOn = false;
  private comp: DynamicsCompressorNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private sprite: AudioBuffer | null = null;
  private spriteDelay = 0;
  private spriteState: 'none' | 'loading' | 'ready' | 'failed' = 'none';
  private spriteMs = 0;
  private sampled = 0;
  muted = false;
  /** Round 46: sound effects on/off (rotor, air, ambience, cues, UI clicks), remembered. Separate from the music. */
  sfxEnabled = readSfxPref();
  /** Round 46: one-shot sources started and not yet ended (their graphs are disconnected on `ended`). */
  private live = 0;
  private reaped = 0;
  private pingL!: DelayNode;
  private pingR!: DelayNode;

  // ----- music -----
  musicEnabled = readMusicPref();
  /** Round 46: the active soundtrack. Round 47: Breakbeat by default (the owner's choice); Classic on request. */
  track: Soundtrack = readTrackPref();
  /** step length of the active soundtrack (Classic 0.12 s at 125 BPM, Breakbeat 0.089 s at 168 BPM) */
  private stepLen = this.track === 'breakbeat' ? BB_STEP : STEP;
  private bb: Breakbeat | null = null;
  private rush = false;
  private scene: MusicScene = 'off';
  private overTier = 0;
  private musicOut!: GainNode;
  private duckGain!: GainNode;
  private musicFade!: GainNode;
  private padFilter!: BiquadFilterNode;
  private hatFilter!: BiquadFilterNode;
  private clapFilter!: BiquadFilterNode;
  private echoSend!: GainNode;
  private readonly bus = {} as Record<Layer, GainNode>;
  private readonly on: Record<Layer, boolean> = { pad: false, bass: false, drums: false, arp: false, lead: false, urg: false };
  private musicAn: AnalyserNode | null = null;
  private sfxAn: AnalyserNode | null = null;
  private timer = 0;
  private nextStep = 0;
  private step = 0;
  private sceneStartAt = 0;
  private chainLv = 0;
  private chase = false;
  private intensity = 0;
  private target = 0;
  private padCutoffI = -1;
  private late = 0;
  private resyncs = 0;
  private notes = 0;
  private duckSeg: DuckSeg | null = null;
  private forced: { chain: number; final: boolean } | null = null;
  private ducks = 0;
  private lastDuck: { reason: string; depth: number; at: number } | null = null;
  private meterOn = false;
  private meterBuf: Float32Array<ArrayBuffer> | null = null;
  private meter = { musicDb: -120, sfxDb: -120, musicOpenDb: -120 };
  private musicOpenMs = 0;
  private fanWin: { from: number; to: number; sfxPeak: number; sfxSum: number; musSum: number; n: number; preDb: number } | null = null;
  private lastFanfare: { sfxRmsDb: number; sfxPeakDb: number; musicRmsDb: number; musicBeforeDb: number; marginDb: number; samples: number } | null = null;

  get contextState(): string {
    return this.ctx ? this.ctx.state : 'none';
  }

  /** True once the context has run at least once (the player has pressed something); stays true while paused. */
  get started(): boolean {
    if (!this.everRan && this.ctx?.state === 'running') this.everRan = true;
    return this.everRan;
  }
  private everRan = false;

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Round 46: effects play only while the context runs and the effects switch is on. */
  private get fxOk(): boolean {
    return this.sfxEnabled && !!this.ctx && this.ctx.state === 'running';
  }

  /**
   * Round 28: make the audio context early (on the title screen). Creating it cost about 200 ms, and it was made inside
   * start(), so it was the first-flight hitch. A context made before any gesture starts suspended; unlock() resumes it.
   */
  prewarm(): void {
    if (this.ctx) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
    } catch {
      return;
    }
    this.build();
  }

  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      try {
        this.ctx = new Ctor();
      } catch {
        return;
      }
      this.build();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
  }

  private build(): void {
    const ctx = this.ctx!;
    // ---- master: glue compressor -> limiter -> trim
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 8;
    comp.ratio.value = 2.5;
    comp.attack.value = 0.012;
    comp.release.value = 0.2;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -4;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.1;
    const trim = ctx.createGain();
    trim.gain.value = OUT_TRIM;
    this.outTrim = trim;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : MASTER_VOL;
    this.master.connect(comp).connect(limiter).connect(trim).connect(ctx.destination);
    this.comp = comp;
    this.limiter = limiter;

    // ---- shared buffers and waves
    this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    // a decorrelated stereo noise (ambience and air are wide)
    this.noiseStereo = ctx.createBuffer(2, ctx.sampleRate * 3, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = this.noiseStereo.getChannelData(ch);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    // Round 11: a soft saw (12 harmonics with a Lanczos taper, so no edge ringing)
    const nH = 12;
    const im = new Float32Array(nH + 1);
    for (let n = 1; n <= nH; n++) {
      const x = (Math.PI * n) / (nH + 1);
      im[n] = ((Math.sin(x) / x) * 2) / (Math.PI * n);
    }
    this.softSaw = ctx.createPeriodicWave(new Float32Array(nH + 1), im, { disableNormalization: true });
    // Round 45: one rotor's blade-pass tone: falling harmonics with a lift around the 3rd to 6th (the "buzz" of a
    // small prop) and fixed random phases, band-limited (no edges, no clicks)
    const nB = 18;
    const bre = new Float32Array(nB + 1), bim = new Float32Array(nB + 1);
    let seed = 7;
    for (let n = 1; n <= nB; n++) {
      seed = (seed * 16807) % 2147483647;
      const ph = (seed / 2147483647) * Math.PI * 2;
      const a = (1 / Math.pow(n, 1.15)) * (n >= 3 && n <= 6 ? 1.6 : 1) * (1 - n / (nB + 2));
      bre[n] = a * Math.cos(ph);
      bim[n] = a * Math.sin(ph);
    }
    this.bladeWave = ctx.createPeriodicWave(bre, bim);

    // ---- buses
    this.sfx = ctx.createGain();
    this.sfx.gain.value = this.sfxEnabled ? SFX_VOL : 0;
    this.sfx.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.droneBus = ctx.createGain();
    this.droneBus.gain.value = this.sfxEnabled ? DRONE_VOL : 0;
    this.droneOut = ctx.createGain(); // the priority duck of the drone
    // round 47: a notch near 2.2 kHz on the whole drone bus (the rotor's shrill zone, where Gemini heard a drill)
    const droneNotch = ctx.createBiquadFilter();
    droneNotch.type = 'notch';
    droneNotch.frequency.value = 2200;
    droneNotch.Q.value = 1.2;
    this.droneBus.connect(droneNotch).connect(this.droneOut).connect(this.master);
    this.ambBus = ctx.createGain();
    this.ambBus.gain.value = 0;
    this.ambOut = ctx.createGain(); // the priority duck of the ambience
    this.ambGate = ctx.createGain(); // round 46: the effects switch
    this.ambGate.gain.value = this.sfxEnabled ? 1 : 0;
    this.ambBus.connect(this.ambOut).connect(this.ambGate).connect(this.master);
    this.fxReturn = ctx.createGain();
    this.fxReturn.connect(this.master);

    // ---- shared reverb: a generated 1.1 s stereo room (early reflections plus a darkening noise tail)
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * 1.1);
    const ir = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        // one-pole lowpass whose cutoff falls along the tail (the air takes the highs first)
        const k = 0.75 - 0.6 * (i / len);
        lp += k * ((Math.random() * 2 - 1) - lp);
        d[i] = lp * Math.exp(-t * 5.2) * (t < 0.012 ? t / 0.012 : 1);
      }
      // early reflections (different per side)
      const er = ch === 0 ? [0.013, 0.021, 0.034, 0.047, 0.061] : [0.017, 0.026, 0.039, 0.053, 0.07];
      er.forEach((e, j) => { d[Math.floor(e * sr)] += (j % 2 ? -0.5 : 0.6) * (1 - j * 0.12); });
    }
    const conv = ctx.createConvolver();
    conv.normalize = true;
    conv.buffer = ir;
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 1;
    const verbHp = ctx.createBiquadFilter();
    verbHp.type = 'highpass';
    verbHp.frequency.value = 220;
    const verbOut = ctx.createGain();
    verbOut.gain.value = 1.6; // the normalised convolver is quiet: the return is lifted to ~-14 dB under the dry cues
    this.reverbSend.connect(verbHp).connect(conv).connect(verbOut).connect(this.fxReturn);
    // round 47: impact samples (crashes, knocks) reach the same room as the music, high-passed at 250 Hz
    this.impactVerb = ctx.createGain();
    const ivHp = ctx.createBiquadFilter();
    ivHp.type = 'highpass';
    ivHp.frequency.value = 250;
    ivHp.Q.value = 0.7;
    this.impactVerb.connect(ivHp).connect(this.reverbSend);
    // round 47: the horns' soft clip (built once)
    this.hornSat = ctx.createWaveShaper();
    const hc = new Float32Array(1024);
    for (let i = 0; i < hc.length; i++) {
      const x = (i / (hc.length - 1)) * 2 - 1;
      hc[i] = Math.tanh(2.2 * x) / Math.tanh(2.2);
    }
    this.hornSat.curve = hc;
    this.hornSat.oversample = '2x';
    const hornEq = ctx.createBiquadFilter();
    hornEq.type = 'peaking';
    hornEq.frequency.value = 3000;
    hornEq.Q.value = 0.9;
    hornEq.gain.value = -3;
    this.hornSat.connect(hornEq).connect(this.sfx);
    // per-bus sends into the shared room (effects send per cue; music from buildMusic)
    const dVerb = ctx.createGain();
    dVerb.gain.value = 0.06;
    this.droneOut.connect(dVerb).connect(this.reverbSend);
    const aVerb = ctx.createGain();
    aVerb.gain.value = 0.12;
    this.ambGate.connect(aVerb).connect(this.reverbSend);

    // ---- slapback: a short stereo echo off the walls, opened in narrow streets, alleys and tunnels
    this.slapSend = ctx.createGain();
    const slapLp = ctx.createBiquadFilter();
    slapLp.type = 'lowpass';
    slapLp.frequency.value = 3200;
    const dl = ctx.createDelay(0.3), dr = ctx.createDelay(0.3);
    dl.delayTime.value = 0.068;
    dr.delayTime.value = 0.094;
    const merge = ctx.createChannelMerger(2);
    this.slapSend.connect(slapLp);
    slapLp.connect(dl).connect(merge, 0, 0);
    slapLp.connect(dr).connect(merge, 0, 1);
    this.slapOut = ctx.createGain();
    this.slapOut.gain.value = 0;
    merge.connect(this.slapOut).connect(this.fxReturn);

    // ---- ping-pong delay for the chimes (a dotted eighth, 0.36 s, left then right, darker each bounce)
    this.pingSend = ctx.createGain();
    const pl = ctx.createDelay(1), pr = ctx.createDelay(1);
    // round 46: a dotted eighth of the active soundtrack (Classic 0.36 s, Breakbeat 0.27 s)
    pl.delayTime.value = this.stepLen * 3;
    pr.delayTime.value = this.stepLen * 3;
    this.pingL = pl;
    this.pingR = pr;
    const pfb = ctx.createGain();
    pfb.gain.value = 0.38;
    const pLp = ctx.createBiquadFilter();
    pLp.type = 'lowpass';
    pLp.frequency.value = 4200;
    const pMerge = ctx.createChannelMerger(2);
    const pOut = ctx.createGain();
    pOut.gain.value = 0.55;
    this.pingSend.connect(pLp).connect(pl);
    pl.connect(pMerge, 0, 0);
    pl.connect(pr);
    pr.connect(pMerge, 0, 1);
    pr.connect(pfb).connect(pl);
    pMerge.connect(pOut).connect(this.fxReturn);

    this.buildRotor();
    this.buildAmbience();
    this.buildMusic();
    // the sample sprite: fetched and decoded off the main thread, after the context exists (first frame or first press)
    window.setTimeout(() => this.loadSprite(), 0);
  }

  // =====================================================================================================
  // Samples
  // =====================================================================================================

  private loadSprite(): void {
    if (!this.ctx || this.spriteState !== 'none') return;
    this.spriteState = 'loading';
    const t0 = performance.now();
    const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
    fetch(`${base}assets/audio/sfx.mp3`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.arrayBuffer();
      })
      .then((b) => new Promise<AudioBuffer>((res, rej) => this.ctx!.decodeAudioData(b, res, rej)))
      .then((buf) => {
        // the decoder's start delay: find the sync click
        const d = buf.getChannelData(0);
        const lim = Math.min(d.length, Math.floor(buf.sampleRate * 0.3));
        let at = -1;
        for (let i = 0; i < lim; i++) if (Math.abs(d[i]) > 0.1) { at = i; break; }
        this.spriteDelay = at >= 0 ? Math.max(-0.04, Math.min(0.08, at / buf.sampleRate - SPRITE_SYNC)) : 0;
        this.sprite = buf;
        this.spriteState = 'ready';
        this.spriteMs = Math.round(performance.now() - t0);
        if (this.ambOn) this.startCityLow();
      })
      .catch(() => {
        this.spriteState = 'failed';
      });
  }

  /** One sprite sample at `t`. Returns false while the sprite is not ready (the caller plays its synth fallback). */
  private samp(name: string, t: number, o: SampOpts = {}): boolean {
    const s = SPRITE[name];
    if (!this.sprite || !s || !this.ctx) return false;
    const ctx = this.ctx;
    // round 45 click fix: a buffer source started at (or just behind) currentTime reaches the audio thread a render
    // quantum late and Chromium skips that far into the sample, past its 2 ms fade-in: a step. A 15 ms lead keeps it whole.
    t = Math.max(t, ctx.currentTime + 0.015);
    const src = ctx.createBufferSource();
    src.buffer = this.sprite;
    const rate = o.rate ?? 1;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = o.gain ?? 1;
    if (o.att) {
      // a softer onset for very sharp transients (ticks, knocks): a few ms ramp instead of the raw edge
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(o.gain ?? 1, t + o.att);
    }
    const nodes: AudioNode[] = [src, g];
    let node: AudioNode = src;
    if (o.lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lp;
      node = node.connect(f);
      nodes.push(f);
    }
    if (o.hp) {
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = o.hp;
      node = node.connect(f);
      nodes.push(f);
    }
    node.connect(g);
    let out: AudioNode = g;
    if (o.pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      out = g.connect(p);
      nodes.push(p);
    }
    out.connect(o.dest ?? this.sfx);
    if (o.verb) {
      const v = ctx.createGain();
      v.gain.value = o.verb;
      out.connect(v).connect(this.reverbSend);
      nodes.push(v);
    }
    if (o.slap) {
      const v = ctx.createGain();
      v.gain.value = o.slap;
      out.connect(v).connect(this.slapSend);
      nodes.push(v);
    }
    if (o.iverb) {
      // round 47: impacts into the shared room through its 250 Hz high-pass
      const v = ctx.createGain();
      v.gain.value = o.iverb;
      out.connect(v).connect(this.impactVerb);
      nodes.push(v);
    }
    // round 46 (codex low): the decoder correction moves the window into the buffer. The length now follows the clamped
    // start (a negative correction clamped at 0 keeps the sample's real end) and is bounded by the end of the buffer.
    const want = s.o + this.spriteDelay;
    const off = Math.max(0, want);
    const dur = Math.max(0.005, Math.min(this.sprite.duration - off, want + s.d - off));
    src.start(t, off, dur);
    src.stop(t + dur / rate + 0.02);
    this.sampled++;
    this.reap(src, nodes);
    return true;
  }

  /** Round 46 (codex high): disconnect a one-shot graph (its source and temporary nodes) when its source ends. */
  private reap(src: AudioScheduledSourceNode, nodes: AudioNode[]): void {
    this.live++;
    src.onended = () => {
      this.live--;
      this.reaped++;
      for (const n of nodes) n.disconnect();
    };
  }

  // =====================================================================================================
  // Rotor, air, slipstream
  // =====================================================================================================

  private buildRotor(): void {
    const ctx = this.ctx!;
    this.rotorBody = ctx.createBiquadFilter();
    this.rotorBody.type = 'peaking';
    this.rotorBody.frequency.value = 620;
    this.rotorBody.Q.value = 1.1;
    this.rotorBody.gain.value = 4;
    this.rotorLp = ctx.createBiquadFilter();
    this.rotorLp.type = 'lowpass';
    this.rotorLp.frequency.value = 1400;
    this.rotorLp.Q.value = 0.6;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(1.8 * x) / Math.tanh(1.8);
    }
    shaper.curve = curve;
    const pre = ctx.createGain();
    pre.gain.value = 0.55;
    const midCut = ctx.createBiquadFilter();
    midCut.type = 'peaking';
    midCut.frequency.value = 1150;
    midCut.Q.value = 0.8;
    midCut.gain.value = -7;
    const lowCut = ctx.createBiquadFilter();
    lowCut.type = 'highpass';
    lowCut.frequency.value = 150;
    lowCut.Q.value = 0.6;
    this.rotorAm = ctx.createGain();
    this.rotorAm.gain.value = 0.72;
    this.rotorGain = ctx.createGain();
    this.rotorGain.gain.value = 0;
    this.rotorSputter = ctx.createGain();
    this.rotorSputter.gain.value = 1;
    this.rotorPan = ctx.createStereoPanner();
    const sum = ctx.createGain();
    sum.gain.value = 0.3;
    const spread = [-0.45, -0.15, 0.15, 0.45];
    for (let i = 0; i < 4; i++) {
      const o = ctx.createOscillator();
      if (this.bladeWave) o.setPeriodicWave(this.bladeWave);
      else o.type = 'triangle';
      o.frequency.value = 110;
      const p = ctx.createStereoPanner();
      p.pan.value = spread[i];
      o.connect(p).connect(sum);
      o.start();
      this.rotors.push(o);
    }
    sum.connect(lowCut).connect(this.rotorBody).connect(this.rotorLp).connect(pre).connect(shaper).connect(midCut).connect(this.rotorAm);
    this.rotorAm.connect(this.rotorGain).connect(this.rotorSputter).connect(this.rotorPan).connect(this.droneBus);
    // a quiet sub an octave under the motors: weight under the mix, well below the music's bass line
    this.subOsc = ctx.createOscillator();
    this.subOsc.frequency.value = 50;
    this.subGain = ctx.createGain();
    this.subGain.gain.value = 0;
    this.subOsc.connect(this.subGain).connect(this.rotorSputter);
    this.subOsc.start();
    // two beating blade-rate LFOs: an uneven flutter instead of one steady tremolo
    this.lfoA = ctx.createOscillator();
    this.lfoB = ctx.createOscillator();
    this.lfoA.frequency.value = 46;
    this.lfoB.frequency.value = 47;
    const la = ctx.createGain(), lb = ctx.createGain();
    la.gain.value = 0.14;
    lb.gain.value = 0.1;
    this.lfoA.connect(la).connect(this.rotorAm.gain);
    this.lfoB.connect(lb).connect(this.rotorAm.gain);
    this.chopDepth = [la, lb];
    // blade-chop air: stereo noise through a band, gated at the blade rate
    const chopSrc = ctx.createBufferSource();
    chopSrc.buffer = this.noiseStereo;
    chopSrc.loop = true;
    this.chopFilter = ctx.createBiquadFilter();
    this.chopFilter.type = 'bandpass';
    this.chopFilter.frequency.value = 900;
    this.chopFilter.Q.value = 0.7;
    const chopAm = ctx.createGain();
    chopAm.gain.value = 0.5;
    const ca = ctx.createGain(), cb = ctx.createGain();
    ca.gain.value = 0.32;
    cb.gain.value = 0.22;
    this.lfoA.connect(ca).connect(chopAm.gain);
    this.lfoB.connect(cb).connect(chopAm.gain);
    this.chopDepth.push(ca, cb);
    this.chopGain = ctx.createGain();
    this.chopGain.gain.value = 0;
    chopSrc.connect(this.chopFilter).connect(chopAm).connect(this.chopGain).connect(this.rotorSputter);
    // speed wind: a body band and an air band (gusts are a smoothed random walk, set per frame)
    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseStereo;
    wind.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 600;
    this.windFilter.Q.value = 0.8;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    wind.connect(this.windFilter).connect(this.windGain).connect(this.droneBus);
    const airHp = ctx.createBiquadFilter();
    airHp.type = 'highpass';
    airHp.frequency.value = 3200;
    const airLp = ctx.createBiquadFilter();
    airLp.type = 'lowpass';
    airLp.frequency.value = 7500;
    this.airGain = ctx.createGain();
    this.airGain.gain.value = 0;
    wind.connect(airHp).connect(airLp).connect(this.airGain).connect(this.droneBus);
    // slipstream: a whistling band on the wall side, its pitch rising as the meter fills, a light 6 Hz flutter
    // round 47 (Gemini: it sounded like a synth riser): two wider bands a fifth-ish apart, one per side, from the
    // decorrelated stereo noise, then a cut near 1.5 kHz on the slipstream's own bus (room for the chimes and keys)
    const dSplit = ctx.createChannelSplitter(2);
    const dMerge = ctx.createChannelMerger(2);
    this.draftL = ctx.createBiquadFilter();
    this.draftL.type = 'bandpass';
    this.draftL.frequency.value = 600;
    this.draftL.Q.value = 1.6;
    this.draftR = ctx.createBiquadFilter();
    this.draftR.type = 'bandpass';
    this.draftR.frequency.value = 900;
    this.draftR.Q.value = 2.0;
    dSplit.connect(this.draftL, 0);
    dSplit.connect(this.draftR, 1);
    // each band mostly on its own side, a little on the other (pan about -0.6 / +0.6)
    const xl = ctx.createGain(), xr = ctx.createGain();
    xl.gain.value = 0.25;
    xr.gain.value = 0.25;
    this.draftL.connect(dMerge, 0, 0);
    this.draftL.connect(xl).connect(dMerge, 0, 1);
    this.draftR.connect(dMerge, 0, 1);
    this.draftR.connect(xr).connect(dMerge, 0, 0);
    this.draftFilter = ctx.createBiquadFilter();
    this.draftFilter.type = 'peaking';
    this.draftFilter.frequency.value = 1500;
    this.draftFilter.Q.value = 1.0;
    this.draftFilter.gain.value = -7;
    dMerge.connect(this.draftFilter);
    this.draftGain = ctx.createGain();
    this.draftGain.gain.value = 0;
    const trem = ctx.createGain();
    trem.gain.value = 0.8;
    const tl = ctx.createOscillator();
    tl.frequency.value = 6.2;
    const tg = ctx.createGain();
    tg.gain.value = 0.2;
    tl.connect(tg).connect(trem.gain);
    this.draftPan = ctx.createStereoPanner();
    wind.connect(dSplit);
    this.draftFilter.connect(trem).connect(this.draftGain).connect(this.draftPan).connect(this.droneBus);
    this.lfoA.start();
    this.lfoB.start();
    tl.start();
    chopSrc.start();
    wind.start(0, 1.1);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : MASTER_VOL, this.ctx.currentTime, 0.05);
  }

  setRotor(on: boolean): void {
    this.rotorOn = on;
    if (!this.ctx) return;
    if (on) this.ensureDroneSlap();
    const t = this.ctx.currentTime;
    this.rotorGain.gain.setTargetAtTime(on ? 0.75 : 0, t, 0.25);
    this.chopGain.gain.setTargetAtTime(on ? 0.16 : 0, t, 0.25);
    this.subGain.gain.setTargetAtTime(on ? 0.05 : 0, t, 0.25);
    if (!on) {
      this.windGain.gain.setTargetAtTime(0, t, 0.2);
      this.airGain.gain.setTargetAtTime(0, t, 0.2);
      this.draftGain.gain.setTargetAtTime(0, t, 0.1);
      this.boostEnd();
    }
    this.setAmbience(on);
  }

  /**
   * speed01: 0..1 of top speed, effort: 0..1 throttle, boosting adds whine, altitude01 0..1, headwind 0..1,
   * turn -1..1 (banking: the outer rotors spin up), carrying: a parcel hangs below (a little heavier).
   */
  updateRotor(speed01: number, effort: number, boosting: boolean, altitude01: number, headwind = 0, turn = 0, carrying = false): void {
    if (!this.ctx || !this.rotorOn) return;
    const t = this.ctx.currentTime;
    this.carrying = carrying;
    const load = carrying ? 0.955 : 1;
    // round 47 (Gemini: a dentist's drill at speed): the pitch rises at most about a third from hover to top speed with
    // the boost (96 -> 128 Hz); speed shows in the blade chop and the air instead
    const base = (96 + speed01 * 18 + effort * 8 + (boosting ? 4 : 0) + altitude01 * 2) * load;
    this.rotorHz = base;
    const bank = Math.max(-1, Math.min(1, turn));
    for (let i = 0; i < 4; i++) {
      // outer rotors spin up on the outside of the turn (left pair i 0,1; right pair i 2,3)
      const side = i < 2 ? -1 : 1;
      this.rotors[i].frequency.setTargetAtTime(base * (1 + ROTOR_DET[i] + side * bank * 0.025 * (0.4 + effort)), t, 0.09 + i * 0.012);
    }
    const blade = base * 0.5;
    this.subOsc.frequency.setTargetAtTime(blade, t, 0.1);
    this.subGain.gain.setTargetAtTime((0.05 + effort * 0.03 + (boosting ? 0.025 : 0)) * (carrying ? 1.25 : 1), t, 0.2);
    // round 47: blade chop as amplitude modulation at 35 to 55 Hz, deeper with speed; the tonal rotor stays under 1.4 kHz
    const chop = 35 + speed01 * 17 + (boosting ? 3 : 0);
    this.lfoA.frequency.setTargetAtTime(chop, t, 0.1);
    this.lfoB.frequency.setTargetAtTime(chop * 1.021 + 0.7, t, 0.1);
    const depth = 0.35 + 0.65 * speed01 + (boosting ? 0.15 : 0);
    const [da, db, dca, dcb] = this.chopDepth;
    da.gain.setTargetAtTime(0.1 + 0.12 * depth, t, 0.15);
    db.gain.setTargetAtTime(0.07 + 0.09 * depth, t, 0.15);
    dca.gain.setTargetAtTime(0.32 * depth, t, 0.15);
    dcb.gain.setTargetAtTime(0.22 * depth, t, 0.15);
    this.rotorLp.frequency.setTargetAtTime((1050 + speed01 * 250 + effort * 100) * (carrying ? 0.9 : 1), t, 0.12);
    this.rotorBody.frequency.setTargetAtTime(carrying ? 540 : 620, t, 0.3);
    this.rotorGain.gain.setTargetAtTime((0.66 + effort * 0.14 + (boosting ? 0.08 : 0)) * (carrying ? 1.1 : 1), t, 0.15);
    // the chop's air: a low band (700 to 1.1 kHz) that grows with speed
    this.chopFilter.frequency.setTargetAtTime(700 + speed01 * 350 + effort * 100, t, 0.15);
    this.chopGain.gain.setTargetAtTime(0.14 + effort * 0.1 + speed01 * 0.22 + (boosting ? 0.1 : 0), t, 0.15);
    this.rotorPan.pan.setTargetAtTime(bank * 0.12, t, 0.2);
    // gusts: a smoothed random walk (cheap, no extra nodes)
    this.gustV += (Math.random() - 0.5) * 0.08 - this.gustV * 0.04;
    this.gust = Math.max(-1, Math.min(1, this.gust + this.gustV * 0.1));
    const g01 = 0.5 + 0.5 * this.gust;
    const sp = Math.pow(speed01, 1.5);
    this.windGain.gain.setTargetAtTime(sp * 0.13 * (0.75 + 0.5 * g01) + headwind * (0.04 + 0.05 * g01), t, 0.2);
    this.windFilter.frequency.setTargetAtTime(380 + speed01 * 900 - headwind * 120 + g01 * 120, t, 0.25);
    this.airGain.gain.setTargetAtTime(sp * 0.24 * (0.7 + 0.6 * g01) + (boosting ? 0.06 : 0), t, 0.2);
  }

  /** Slipstream layer: intensity 0..1 sets loudness, meter level 0..1 the rising pitch, pan -1..1 the wall side. */
  setDraft(intensity: number, level: number, pan = 0): void {
    if (!this.ctx || !this.rotorOn) return;
    const t = this.ctx.currentTime;
    // round 47: two offset bands that rise only a little with the meter (wind, not a riser), louder for the loss of Q
    this.draftGain.gain.setTargetAtTime(intensity * 0.34, t, 0.12);
    const f0 = 520 + level * 380 + intensity * 120 + this.chainLv * 40 + this.gust * 40;
    this.draftL.frequency.setTargetAtTime(f0, t, 0.12);
    this.draftR.frequency.setTargetAtTime(f0 * 1.47, t, 0.14);
    this.draftPan.pan.setTargetAtTime(Math.max(-0.6, Math.min(0.6, pan * 0.5)), t, 0.15);
    // the keys (Breakbeat) or the pad (Classic) dip near 1.2 kHz while drafting, up to 4.5 dB
    const dip = Math.max(0, Math.min(1, intensity * 1.4));
    this.padDip.gain.setTargetAtTime(-4.5 * dip, t, 0.15);
    this.bb?.setDraftDip(dip, t);
  }

  // =====================================================================================================
  // Ambience
  // =====================================================================================================

  private buildAmbience(): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseStereo;
    src.loop = true;
    // city: a low hum (the distant engine bed joins when the sprite is ready)
    const hum = ctx.createBiquadFilter();
    hum.type = 'lowpass';
    hum.frequency.value = 160;
    hum.Q.value = 0.5;
    this.ambCityGain = ctx.createGain();
    this.ambCityGain.gain.value = 0;
    src.connect(hum).connect(this.ambCityGain).connect(this.ambBus);
    // distant traffic: a broad band that swells and fades like cars far off (random walk per frame)
    this.ambTrafficFilter = ctx.createBiquadFilter();
    this.ambTrafficFilter.type = 'bandpass';
    this.ambTrafficFilter.frequency.value = 700;
    this.ambTrafficFilter.Q.value = 0.6;
    this.ambTrafficGain = ctx.createGain();
    this.ambTrafficGain.gain.value = 0;
    src.connect(this.ambTrafficFilter).connect(this.ambTrafficGain).connect(this.ambBus);
    // harbour water: noise through a moving lowpass with an irregular lapping swell
    this.ambWaterFilter = ctx.createBiquadFilter();
    this.ambWaterFilter.type = 'lowpass';
    this.ambWaterFilter.frequency.value = 500;
    this.ambWaterFilter.Q.value = 2.5;
    const waterHp = ctx.createBiquadFilter();
    waterHp.type = 'highpass';
    waterHp.frequency.value = 140;
    this.ambWaterGain = ctx.createGain();
    this.ambWaterGain.gain.value = 0;
    src.connect(waterHp).connect(this.ambWaterFilter).connect(this.ambWaterGain).connect(this.ambBus);
    // open-air wind (harbour and altitude): a low band plus a little high air
    const wb = ctx.createBiquadFilter();
    wb.type = 'bandpass';
    wb.frequency.value = 420;
    wb.Q.value = 0.9;
    this.ambWindGain = ctx.createGain();
    this.ambWindGain.gain.value = 0;
    src.connect(wb).connect(this.ambWindGain).connect(this.ambBus);
    const wh = ctx.createBiquadFilter();
    wh.type = 'bandpass';
    wh.frequency.value = 4200;
    wh.Q.value = 0.7;
    this.ambHighGain = ctx.createGain();
    this.ambHighGain.gain.value = 0;
    src.connect(wh).connect(this.ambHighGain).connect(this.ambBus);
    src.start(0, 0.4);
  }

  private startCityLow(): void {
    if (!this.ctx || !this.sprite || this.ambCityLow) return;
    const s = SPRITE.cityLow;
    if (!s) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.sprite;
    src.loop = true;
    const off = Math.max(0, s.o + this.spriteDelay);
    src.loopStart = off;
    src.loopEnd = off + s.d;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(lp).connect(g).connect(this.ambBus);
    src.start(ctx.currentTime + 0.05, off);
    this.ambCityLow = g;
  }

  /** Ambience on (in flight) or a quiet city bed (title, pause, game over). */
  private setAmbience(flying: boolean): void {
    if (!this.ctx) return;
    this.ambOn = true;
    this.ambBus.gain.setTargetAtTime(flying ? AMB_VOL : AMB_VOL * 0.45, this.ctx.currentTime, 0.6);
    if (this.sprite) this.startCityLow();
  }

  /**
   * Per frame in flight: where the drone is. shore: metres from the seawall (positive over the water), alt: metres above
   * the ground, narrow 0..1: how closed-in the street is (both facades near, an alley or a tunnel).
   */
  setWorld(shore: number, alt: number, narrow: number, dt: number): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const a = this.amb;
    const k = 1 - Math.exp(-dt / 0.8);
    a.harbour += (smooth(-30, 6, shore) - a.harbour) * k;
    a.alt += (smooth(18, 70, alt) - a.alt) * k;
    a.city += (Math.max(0, 1 - a.harbour * 0.85) * (1 - a.alt * 0.6) - a.city) * k;
    a.narrow += (narrow - a.narrow) * (1 - Math.exp(-dt / 0.25));
    // random walks: distant traffic swells, water laps
    a.trafficV += (Math.random() - 0.5) * 0.06 - a.trafficV * 0.05;
    a.traffic = Math.max(0, Math.min(1, a.traffic + a.trafficV * dt * 3));
    a.lapT -= dt;
    if (a.lapT <= 0) {
      a.lapT = 0.7 + Math.random() * 1.6;
      a.lapV = 0.6 + Math.random() * 0.4;
    }
    a.lap += (a.lapV - a.lap) * (1 - Math.exp(-dt / 0.18));
    a.lapV *= Math.exp(-dt / 0.45);
    this.ambCityGain.gain.setTargetAtTime(0.07 * a.city, t, 0.3);
    this.ambTrafficGain.gain.setTargetAtTime(a.city * (0.05 + 0.08 * a.traffic) * (1 - a.alt * 0.5), t, 0.3);
    this.ambTrafficFilter.frequency.setTargetAtTime(500 + 500 * a.traffic, t, 0.4);
    this.ambWaterGain.gain.setTargetAtTime(a.harbour * (0.08 + 0.3 * a.lap) * (1 - a.alt * 0.7), t, 0.08);
    this.ambWaterFilter.frequency.setTargetAtTime(380 + 700 * a.lap, t, 0.08);
    const open = Math.max(a.harbour * 0.6, a.alt);
    this.ambWindGain.gain.setTargetAtTime(open * (0.07 + 0.06 * (0.5 + 0.5 * this.gust)), t, 0.3);
    this.ambHighGain.gain.setTargetAtTime(open * 0.012 + a.alt * 0.012, t, 0.3);
    if (this.ambCityLow) this.ambCityLow.gain.setTargetAtTime(0.06 * a.city, t, 0.4);
    // slapback opens between close walls (and only near street level)
    this.slapOut.gain.setTargetAtTime(0.42 * a.narrow, t, 0.15);
  }

  /** Send the drone into the slapback while flying (called once per frame through setWorld's narrow factor). */
  private droneSlap: GainNode | null = null;
  private ensureDroneSlap(): void {
    if (this.droneSlap || !this.ctx) return;
    this.droneSlap = this.ctx.createGain();
    this.droneSlap.gain.value = 0.5;
    this.droneOut.connect(this.droneSlap).connect(this.slapSend);
  }

  /**
   * A vehicle or boat passing close: a Doppler whoosh. pan0 -> pan1 is its path across the stereo field, `speed` the
   * closing speed (m/s), `miss` the closest distance (m), `dur` the time to the closest point (s).
   */
  passBy(kind: 'car' | 'boat', pan0: number, pan1: number, speed: number, miss: number, dur: number): void {
    if (!this.fxOk) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    this.passLive = this.passLive.filter((e) => e > t);
    if (this.passLive.length >= 3 || t - this.lastPass < 0.25) return;
    this.lastPass = t;
    const lead = Math.max(0.12, Math.min(0.6, dur));
    const tail = 0.5;
    const end = t + lead + tail;
    this.passLive.push(end);
    this.passes++;
    const near = Math.max(0, Math.min(1, (14 - miss) / 11));
    this.lastPassNear = Math.round(near * 100) / 100;
    const v = Math.max(0, Math.min(1, (speed - 3) / 20));
    const boat = kind === 'boat';
    // round 46 (critic: pass-bys sat 4.5 dB under the music): about +11 dB, weighted harder to the close ones, so a car
    // brushing past is clearly heard (+3 to +6 dB over the music for its half second) and a far one stays a background swish
    // Breakbeat's music sits about 2 dB hotter on the bus than Classic's, so its pass-bys get the same lift
    const amp = (boat ? 0.33 : 0.4) * (0.2 + 0.8 * near * near) * (0.5 + 0.5 * v) * (this.track === 'breakbeat' ? 1.26 : 1);
    const shift = 1 + 0.18 * v; // exaggerated Doppler ratio before / after the closest point
    const pan = ctx.createStereoPanner();
    pan.pan.setValueAtTime(Math.max(-1, Math.min(1, pan0)), t);
    pan.pan.linearRampToValueAtTime(Math.max(-1, Math.min(1, pan1)), end);
    pan.connect(this.ambBus);
    const tc = t + lead;
    // air / water wash
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = boat ? 0.8 : 1.1;
    const fc = boat ? 650 : 1100;
    f.frequency.setValueAtTime(fc * shift, t);
    f.frequency.setTargetAtTime(fc / shift, tc - 0.05, 0.08);
    const g = this.envGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(amp, tc);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    src.connect(f).connect(g).connect(pan);
    src.start(t, Math.random() * 1.5);
    src.stop(end + 0.05);
    this.reap(src, [src, f, g]);
    // engine tone: a soft saw (car) or a low thrum (boat), pitch falling through the pass
    const o = ctx.createOscillator();
    if (this.softSaw) o.setPeriodicWave(this.softSaw);
    const f0 = boat ? 58 : 86 + Math.random() * 20;
    o.frequency.setValueAtTime(f0 * shift, t);
    o.frequency.setTargetAtTime(f0 / shift, tc - 0.05, 0.1);
    // round 46: a real engine: the saw through a lowpass that opens as it closes in, plus a growl an octave up (AM at
    // the firing rate), so it reads as a motor over the rotor and the music
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(boat ? 260 : 600, t);
    lp.frequency.linearRampToValueAtTime(boat ? 420 : 1300, tc);
    lp.frequency.linearRampToValueAtTime(boat ? 240 : 500, end);
    const og = this.envGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(amp * (boat ? 1.4 : 1.1), tc);
    og.gain.exponentialRampToValueAtTime(0.0001, end);
    const am = ctx.createGain();
    am.gain.value = 0.75;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = boat ? 9 : 23 + Math.random() * 8;
    const lg = ctx.createGain();
    lg.gain.value = 0.25;
    lfo.connect(lg).connect(am.gain);
    o.connect(lp).connect(am).connect(og).connect(pan);
    o.start(t);
    o.stop(end + 0.05);
    lfo.start(t);
    lfo.stop(end + 0.05);
    this.reap(o, [o, lp, am, og, lfo, lg, pan]);
  }

  // =====================================================================================================
  // One-shot building blocks
  // =====================================================================================================

  /**
   * A gain node for one note's envelope, silent until its first automation event.
   * Round 11 click fix: a GainNode starts at gain 1. When a note's start time lands a hair after a sample frame (the
   * step grid accumulates float error), Chromium starts the source on that frame but applies the envelope's first
   * setValueAtTime one frame later, so one sample of the source passed at full level. On a noise hat that is a
   * full-scale impulse, which the 7.2 kHz hat filter rings into the 0.07 to 0.1 clicks the critic measured.
   */
  private envGain(): GainNode {
    const g = this.ctx!.createGain();
    g.gain.value = 0;
    return g;
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType | 'softsaw', gain: number, reverb = 0.6, glideTo?: number, pan = 0): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    if (type === 'softsaw') {
      if (this.softSaw) o.setPeriodicWave(this.softSaw);
      else o.type = 'sawtooth';
    } else o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
    // round 45 click fix: a linear 8 ms attack (an exponential attack ends in a near-step in its last millisecond)
    const g = this.envGain();
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g);
    const nodes: AudioNode[] = [o, g];
    let out: AudioNode = g;
    if (pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      out = g.connect(p);
      nodes.push(p);
    }
    out.connect(this.sfx);
    if (reverb > 0) {
      const s = ctx.createGain();
      s.gain.value = reverb * 0.5;
      out.connect(s).connect(this.reverbSend);
      nodes.push(s);
    }
    o.start(start);
    o.stop(start + dur + 0.05);
    this.reap(o, nodes);
  }

  private noise(start: number, dur: number, gain: number, type: BiquadFilterType, f0: number, f1: number, q = 1, pan = 0, verb = 0): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, start);
    f.frequency.exponentialRampToValueAtTime(f1, start + dur);
    const g = this.envGain();
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + Math.min(0.03, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f).connect(g);
    const nodes: AudioNode[] = [src, f, g];
    let out: AudioNode = g;
    if (pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      out = g.connect(p);
      nodes.push(p);
    }
    out.connect(this.sfx);
    if (verb > 0) {
      const s = ctx.createGain();
      s.gain.value = verb;
      out.connect(s).connect(this.reverbSend);
      nodes.push(s);
    }
    src.start(start, Math.random() * 1.5);
    src.stop(start + dur + 0.05);
    this.reap(src, nodes);
  }

  /**
   * Round 45: an FM bell. A sine carrier with a 3.5x modulator whose index falls fast (a bright strike that settles into
   * a pure tone), a soft octave partial, and sends to the reverb and the ping-pong delay.
   */
  private bell(freq: number, start: number, dur: number, gain: number, o: BellOpts = {}): void {
    const ctx = this.ctx!;
    const car = ctx.createOscillator();
    car.frequency.value = freq;
    const mod = ctx.createOscillator();
    mod.frequency.value = freq * 3.5;
    const mg = ctx.createGain();
    const idx = freq * (o.bright ?? 1.6);
    mg.gain.setValueAtTime(idx, start);
    mg.gain.exponentialRampToValueAtTime(idx * 0.04, start + Math.min(0.35, dur * 0.5));
    mod.connect(mg).connect(car.frequency);
    const oct = ctx.createOscillator();
    oct.frequency.value = freq * 2.003;
    const og = this.envGain();
    og.gain.setValueAtTime(0, start);
    og.gain.linearRampToValueAtTime(gain * 0.22, start + 0.005);
    og.gain.exponentialRampToValueAtTime(0.0001, start + dur * 0.45);
    const g = this.envGain();
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    car.connect(g);
    oct.connect(og);
    const p = ctx.createStereoPanner();
    p.pan.value = o.pan ?? 0;
    g.connect(p);
    og.connect(p);
    p.connect(this.sfx);
    const v = ctx.createGain();
    v.gain.value = o.verb ?? 0.35;
    p.connect(v).connect(this.reverbSend);
    const nodes: AudioNode[] = [car, mod, mg, oct, og, g, p, v];
    if (o.ping) {
      const s = ctx.createGain();
      s.gain.value = o.ping;
      p.connect(s).connect(this.pingSend);
      nodes.push(s);
    }
    for (const x of [car, mod, oct]) {
      x.start(start);
      x.stop(start + dur + 0.05);
    }
    this.reap(car, nodes);
  }

  /** A short sine sub-drop (the weight under an impact or the boost ignition). */
  private subDrop(t: number, f0: number, f1: number, dur: number, gain: number): void {
    this.tone(f0, t, dur, 'sine', gain, 0, f1);
  }

  /** A short servo whir (pickup and delivery mechanics): a soft saw gliding through a narrow band. */
  private servo(t: number, f0: number, f1: number, dur: number, gain: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    if (this.softSaw) o.setPeriodicWave(this.softSaw);
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(f0 * 4, t);
    f.frequency.exponentialRampToValueAtTime(f1 * 4, t + dur);
    f.Q.value = 2.5;
    const g = this.envGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.setValueAtTime(gain, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
    this.reap(o, [o, f, g]);
  }

  /** The notes (midi) of the chord the music is on right now: four arp tones (C major when the music is off). */
  private chordNow(): number[] {
    const fallback = [72, 76, 79, 84];
    if (!this.ctx || this.scene === 'off') return fallback;
    const now = this.ctx.currentTime;
    const stepNow = this.step - (this.nextStep - now) / this.stepLen;
    const bar = Math.max(0, Math.floor(stepNow / 16));
    // round 46: the chord comes from the soundtrack that is playing
    if (this.track === 'breakbeat' && this.bb) return [...bbChord(this.scene as BeatScene, bar, this.overTier, this.overtime, this.bb.dropBar).arp].sort((a, b) => a - b);
    let ch: Chord | undefined;
    if (this.scene === 'run') ch = RUN_FORM[bar % RUN_FORM.length];
    else if (this.scene === 'final') ch = FINAL_PROG[bar % 4];
    else if (this.scene === 'title') ch = TITLE_PROG[Math.floor(bar / 2) % TITLE_PROG.length];
    else if (this.scene === 'over') { const p = this.overTier > 0 ? OVER_PROG_MEDAL : OVER_PROG_NONE; ch = p[Math.floor(bar / 2) % p.length]; }
    return ch ? [...ch.arp].sort((a, b) => a - b) : fallback;
  }

  /** Round 46: pitch classes of the whole chord that plays now (bass, voicing and arp tones), for tests. */
  private chordPcs(): number[] {
    if (!this.ctx) return [];
    const bar = Math.max(0, Math.floor((this.step - (this.nextStep - this.ctx.currentTime) / this.stepLen) / 16));
    let notes: number[];
    if (this.track === 'breakbeat' && this.bb) {
      const c = bbChord(this.scene as BeatScene, bar, this.overTier, this.overtime, this.bb.dropBar);
      notes = [c.bass, ...c.keys, ...c.arp];
    } else {
      const c = this.scene === 'run' ? RUN_FORM[bar % RUN_FORM.length] : this.scene === 'final' ? FINAL_PROG[bar % 4] : this.scene === 'title' ? TITLE_PROG[Math.floor(bar / 2) % 4] : (this.overTier > 0 ? OVER_PROG_MEDAL : OVER_PROG_NONE)[Math.floor(bar / 2) % 4];
      notes = [c.bass, ...c.pad, ...c.arp];
    }
    return [...new Set(notes.map((n) => n % 12))].sort((a, b) => a - b);
  }

  /** Round 46: the chord's distinct tones inside one octave (Classic's arps repeat the root an octave up). */
  private chordTones(): number[] {
    const arp = this.chordNow();
    return arp.filter((n, i) => n - arp[0] < 12 && arp.indexOf(n) === i);
  }

  /** Ladder over distinct chord tones: index k = u[k % n] up an octave every n steps. */
  private ladderU(u: number[], k: number): number {
    const n = u.length;
    return u[((k % n) + n) % n] + 12 * Math.floor(k / n);
  }

  /** Chord-tone ladder: index k = arp[k % 4] up an octave every 4 steps. */
  private ladder(arp: number[], k: number): number {
    return arp[((k % 4) + 4) % 4] + 12 * Math.floor(k / 4);
  }

  /** Priority duck: the music dips by `depth`, the drone and the ambience by less, then all recover. */
  private priority(depth: number, at: number, hold: number, release: number, reason: string): void {
    this.duck(depth, at, hold, release, reason);
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const [g, d] of [[this.droneOut.gain, Math.pow(depth, 0.6)], [this.ambOut.gain, Math.pow(depth, 0.5)]] as const) {
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(d, Math.max(now, at) + 0.04);
      g.setValueAtTime(d, Math.max(now, at) + 0.04 + hold);
      g.linearRampToValueAtTime(1, Math.max(now, at) + 0.04 + hold + release);
    }
  }

  // =====================================================================================================
  // Cues
  // =====================================================================================================

  /** Meter quarter reached: a short rising blip on the chord (higher each step). */
  slipTick(step: number): void {
    if (!this.fxOk) return;
    const t = this.ctx!.currentTime;
    const arp = this.chordNow();
    const f = midi(this.ladder(arp, 3 + step));
    this.tone(f, t, 0.1, 'triangle', 0.045, 0.2, f * 1.03);
  }

  /**
   * Meter full: an upward whoosh and FM bells on the notes of the current chord, climbing with the chain: x1 two notes,
   * x5 six, each chain step starting one chord tone higher. A ping-pong delay carries them across.
   */
  slipPayout(chain: number): void {
    if (!this.fxOk) return;
    const t = this.ctx!.currentTime;
    // a shallow, quick duck: at chain x3+ the chimes come every 1 to 2 s and a deep duck pumped the music
    this.priority(0.62, t, 0.22, 0.35, 'slip');
    const c = Math.min(chain, 5);
    const g = (1 + (c - 1) * 0.1) * 1.55;
    this.noise(t, 0.35 + c * 0.04, 0.06 * g, 'bandpass', 900, 5200 + c * 500, 1.6, 0, 0.2);
    const arp = this.chordNow();
    const n = c + 1;
    for (let i = 0; i < n; i++) {
      const m = this.ladder(arp, c + 3 + i);
      const pan = (i % 2 ? 0.25 : -0.25) * (i === 0 ? 0 : 1);
      this.bell(midi(m), t + 0.02 + i * 0.06, i === n - 1 ? 0.9 : 0.45, (i === 0 ? 0.13 : 0.085) * g, { pan, verb: 0.4, ping: i === n - 1 ? 0.6 : 0.25 });
    }
    // the glass edge under the first note (a little louder each step)
    if (!this.samp('select', t + 0.02, { gain: 0.25 + c * 0.04, rate: Math.pow(2, (arp[0] - 72) / 12) * 1.5 })) this.tone(midi(this.ladder(arp, c + 3)) * 2, t + 0.02, 0.08, 'triangle', 0.03, 0.2);
  }

  pickup(): void {
    if (!this.fxOk) return;
    const t = this.ctx!.currentTime;
    // round 46 (critic: the pickup reward shrank to +8 dB over the music, it was +14.8): a slightly deeper duck and the
    // chord bells come in earlier and about 5 dB louder, so the pickup has a clear tonal top again
    this.priority(0.5, t, 0.4, 0.4, 'pickup');
    // the claw latches (click + tin clunk), a short servo whir, then the chime on the chord
    if (!this.samp('latch', t, { gain: 0.6, rate: 0.95 + Math.random() * 0.1, att: 0.006, lp: 5000 })) this.noise(t, 0.04, 0.05, 'highpass', 4000, 6000);
    this.samp('clunk', t + 0.012, { gain: 0.3, rate: 1 + Math.random() * 0.08, verb: 0.15, att: 0.005, lp: 3000 });
    this.servo(t + 0.03, 260, 520, 0.13, 0.035);
    const arp = this.chordNow();
    const at = t + 0.09;
    [4, 5, 6].forEach((k, i) => this.bell(midi(this.ladder(arp, k)), at + i * 0.065, i === 2 ? 0.7 : 0.55, i === 2 ? 0.36 : 0.29, { pan: (i - 1) * 0.2, verb: 0.35, ping: i === 2 ? 0.4 : 0, bright: 1.9 }));
    this.noise(at, 0.25, 0.045, 'highpass', 5000, 10000);
  }

  deliver(combo: number): void {
    if (!this.fxOk) return;
    const t = this.ctx!.currentTime;
    this.priority(0.45, t, 0.7, 0.6, 'delivery');
    // unlatch, servo, the parcel lands (soft thud + cardboard), then the chord chime, lifted a tone per combo step
    if (!this.samp('unlatch', t, { gain: 0.5, att: 0.006, lp: 6000 })) this.noise(t, 0.03, 0.04, 'highpass', 5000, 7000);
    this.servo(t + 0.01, 520, 300, 0.1, 0.03);
    if (!this.samp('thud', t + 0.08, { gain: 0.8, rate: 0.95 + Math.random() * 0.1, att: 0.004 })) this.subDrop(t + 0.08, 120, 60, 0.18, 0.2);
    this.samp('box', t + 0.085, { gain: 0.3, rate: 0.9 + Math.random() * 0.1, verb: 0.2, att: 0.004, lp: 3000 });
    const arp = this.chordNow();
    const lift = Math.min(combo, 4);
    const at = t + 0.13;
    for (let i = 0; i < 5; i++) {
      this.bell(midi(this.ladder(arp, 3 + lift + i)), at + i * 0.055, i === 4 ? 1.2 : 0.8, i === 4 ? 0.13 : 0.1, { pan: (i - 2) * 0.15, verb: 0.45, ping: i === 4 ? 0.5 : 0.15 });
    }
    this.tone(midi(arp[0] - 24), at, 0.5, 'sine', 0.2, 0.2);
    this.noise(at + 0.05, 0.6, 0.045, 'highpass', 6000, 12000);
  }

  /** A hard knock on a wall (not a crash). pan -1..1: the wall side. */
  bump(strength: number, pan = 0): void {
    if (!this.fxOk) return;
    const t = this.ctx!.currentTime;
    const s = Math.min(1, strength / 14);
    const k = 'knock' + Math.floor(Math.random() * 3);
    // round 47: a 4.5 kHz low-pass takes the knock samples' sharpest edge (the click detector caught it at light hits)
    if (this.samp(k, t, { gain: 0.35 + s * 0.45, rate: 0.88 + Math.random() * 0.2, pan: pan * 0.6, iverb: 0.5, slap: 0.4, att: 0.004, lp: 4500 })) {
      this.tone(120, t, 0.22, 'sine', 0.15 + s * 0.25, 0, 45);
      return;
    }
    this.tone(140, t, 0.28, 'sine', 0.25 + s * 0.4, 0, 45);
    this.noise(t, 0.18 + s * 0.12, 0.12 + s * 0.25, 'lowpass', 1600, 200, 0.8, pan * 0.6);
  }

  /** Hard crash: a heavy crunch plus a falling two-note "lost it" cue (lower still when a combo breaks). */
  crash(strength: number, comboBroken: boolean): void {
    this.impact(strength);
    this.crashCue(comboBroken);
  }

  /**
   * The moment of a head-on hit: a layered crunch and metal plate (random pitch), a sub-drop, and the rotors sputter
   * (round 45: the stutter glides over 8 ms ramps, no hard steps) and sag in pitch for about 0.7 s, then catch.
   * The music's top end dips through the slow-motion beat.
   */
  impact(strength: number, pan = 0): void {
    if (!this.fxOk) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const s = Math.min(1, strength);
    this.priority(0.35, t, 0.55, 0.6, 'crash');
    const r = () => 0.9 + Math.random() * 0.2;
    // round 46 (critic: the crash was 3 to 4 dB too hot next to every other cue): every layer x0.63 (-4 dB)
    const k = CRASH_TRIM;
    // round 47 (Gemini: the impacts sounded dry next to the music): each layer sends into the shared room through a 250 Hz
    // high-pass, so the crash sits in the same space as the music
    const a = this.samp('crunch', t, { gain: (0.6 + s * 0.3) * k, rate: r(), pan: pan * 0.4, iverb: 0.7, slap: 0.4, lp: 3800 });
    this.samp('plate', t + 0.006, { gain: (0.5 + s * 0.3) * k, rate: r(), pan: pan * 0.4, iverb: 0.6 });
    this.samp('knock' + Math.floor(Math.random() * 3), t + 0.01, { gain: 0.3 * k, rate: 0.75 + Math.random() * 0.1, pan: pan * 0.5, iverb: 0.5, lp: 4500, att: 0.003 });
    this.subDrop(t, 72, 26, 0.55, (0.4 + s * 0.25) * k);
    if (!a) {
      this.noise(t, 0.32 + s * 0.2, (0.3 + s * 0.2) * k, 'lowpass', 2400, 160, 0.9);
      this.noise(t + 0.02, 0.12, (0.07 + s * 0.05) * k, 'bandpass', 3800, 1800, 3);
    }
    // the music's top closes for the slow-motion beat, then opens
    const mt = this.musicTone.frequency;
    mt.cancelScheduledValues(t);
    mt.setValueAtTime(mt.value, t);
    mt.exponentialRampToValueAtTime(900, t + 0.05);
    mt.setTargetAtTime(TONE_OPEN[this.track], t + 0.35, 0.18);
    if (!this.rotorOn) return;
    const g = this.rotorSputter.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(1, t);
    // round 45 click fix: every step of the stutter is an 8 ms ramp from the level before it (was setValueAtTime steps)
    const cuts = [0.04, 0.13, 0.21, 0.3, 0.37, 0.46, 0.55];
    let lv = 1;
    cuts.forEach((c, i) => {
      const nv = i % 2 === 0 ? 0.12 + i * 0.04 : 1.12;
      g.setValueAtTime(lv, t + c);
      g.linearRampToValueAtTime(nv, t + c + 0.008);
      lv = nv;
    });
    g.setValueAtTime(lv, t + 0.6);
    g.setTargetAtTime(1, t + 0.6, 0.12);
    for (const o of this.rotors) {
      o.detune.cancelScheduledValues(t);
      o.detune.setValueAtTime(0, t);
      o.detune.linearRampToValueAtTime(-900, t + 0.12);
      o.detune.setTargetAtTime(0, t + 0.35, 0.18);
    }
    // the motors whine as they catch again (a soft saw, not a square)
    this.tone(320, t + 0.1, 0.35, 'softsaw', 0.03, 0.2, 180);
  }

  /** A glancing wall hit: metal scrape grains and a grind, on the wall side. Rate-limited for long slides. */
  scrape(strength: number, pan = 0): void {
    if (!this.fxOk) return;
    const t = this.ctx!.currentTime;
    if (t - this.lastScrape < 0.09) return;
    this.lastScrape = t;
    const s = Math.min(1, strength / 10);
    const p = Math.max(-0.85, Math.min(0.85, pan * 0.8));
    if (t - this.lastGrain > 0.16 || s > 0.6) {
      this.lastGrain = t;
      this.samp('scrape' + Math.floor(Math.random() * 3), t, { gain: 0.4 + s * 0.5, rate: 0.85 + Math.random() * 0.3, pan: p, iverb: 0.3, slap: 0.4 });
      if (s > 0.3) this.samp('grit' + (Math.random() < 0.6 ? 0 : 1), t + 0.01, { gain: 0.5 + s * 0.4, rate: 0.9 + Math.random() * 0.2, pan: p });
    }
    this.noise(t, 0.12 + s * 0.1, 0.06 + s * 0.12, 'bandpass', 5200, 2600, 3, p);
    this.noise(t, 0.08, 0.04 + s * 0.05, 'highpass', 6500, 8000, 1, p);
  }

  /** The charge after a crash: the falling two-note "lost it" cue (lower still, with an error blip, when a combo breaks). */
  crashCue(comboBroken: boolean): void {
    if (!this.fxOk) return;
    const t = this.ctx!.currentTime - 0.12;
    const base = comboBroken ? 392 : 466.16;
    this.tone(base, t + 0.12, 0.22, 'triangle', 0.1, 0.3);
    this.tone(base * 0.749, t + 0.26, 0.4, 'triangle', 0.11, 0.4, base * 0.7);
    if (comboBroken) this.samp('error', t + 0.16, { gain: 0.35 });
  }

  /** Boost starts: an ignition burst and a sub-drop, then the burner loop holds until boostEnd(). */
  boost(): void {
    if (!this.fxOk) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    this.subDrop(t, 95, 38, 0.35, 0.3);
    if (!this.samp('ignite', t, { gain: 0.6, rate: 0.95 + Math.random() * 0.1, dest: this.droneBus, verb: 0.15 })) {
      this.noise(t, 0.55, 0.16, 'bandpass', 400, 2600, 1.2);
    }
    this.noise(t, 0.4, 0.07, 'bandpass', 300, 4800, 1.2);
    this.tone(220, t, 0.4, 'softsaw', 0.025, 0, 440);
    const s = SPRITE.thrust;
    if (!this.sprite || !s || this.boostSrc) return;
    const src = ctx.createBufferSource();
    src.buffer = this.sprite;
    src.loop = true;
    const off = Math.max(0, s.o + this.spriteDelay);
    src.loopStart = off;
    src.loopEnd = off + s.d;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 180;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.42, t + 0.15);
    src.connect(hp).connect(g).connect(this.droneBus);
    src.start(t + 0.015, off + Math.random() * s.d * 0.5);
    this.reap(src, [src, hp, g]);
    this.boostSrc = src;
    this.boostGain = g;
  }

  /** Round 48: through a tailwind ring: a quick rising air rush and two bright bells on the chord (the boost cue follows). */
  ring(): void {
    if (!this.fxOk) return;
    const t = this.ctx!.currentTime;
    this.noise(t, 0.3, 0.05, 'bandpass', 1200, 6400, 1.4);
    const arp = this.chordNow();
    this.bell(midi(this.ladder(arp, 6)), t + 0.01, 0.5, 0.08, { pan: -0.2, verb: 0.35, ping: 0.2, bright: 1.6 });
    this.bell(midi(this.ladder(arp, 8)), t + 0.07, 0.7, 0.07, { pan: 0.2, verb: 0.4, ping: 0.4, bright: 1.6 });
  }

  /** Boost released (or the run stopped): the burner fades out over 0.6 s. */
  boostEnd(): void {
    if (!this.ctx || !this.boostSrc || !this.boostGain) return;
    const t = this.ctx.currentTime;
    const g = this.boostGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + 0.6);
    this.boostSrc.stop(t + 0.65);
    // a short air release as the burner dies
    if (this.ctx.state === 'running') this.noise(t, 0.45, 0.04, 'bandpass', 2400, 600, 1.2);
    this.boostSrc = null;
    this.boostGain = null;
  }

  /**
   * A brass horn from detuned soft saws: three voices per note through a lowpass that swells open (no square waves).
   */
  private horn(f: number, t: number, dur: number, gain: number): void {
    // round 47 (Gemini: cheap 1990s sound-card brass): three detuned saws with a fast pitch blip (60 cents flat, a hair
    // over, then on pitch in 40 ms), a two-stage filter (open in 10 ms, settle by 70 ms, then close over the note) and a
    // shared soft clip with a dip at 3 kHz
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 1.5;
    const top = Math.min(3200, f * 5);
    lp.frequency.setValueAtTime(400, t);
    lp.frequency.exponentialRampToValueAtTime(top, t + 0.01);
    lp.frequency.exponentialRampToValueAtTime(top * 0.55, t + 0.07);
    lp.frequency.exponentialRampToValueAtTime(Math.max(500, top * 0.35), t + dur);
    const g = this.envGain();
    const v = gain * 0.6;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.012);
    g.gain.setValueAtTime(v * 0.85, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lp.connect(g).connect(this.hornSat);
    const r = ctx.createGain();
    r.gain.value = 0.35;
    g.connect(r).connect(this.reverbSend);
    const nodes: AudioNode[] = [lp, g, r];
    let first: OscillatorNode | null = null;
    for (const c of [-11, 0, 9]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 0.966, t);
      o.frequency.exponentialRampToValueAtTime(f * 1.004, t + 0.018);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
      o.detune.value = c;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
      nodes.push(o);
      first ??= o;
    }
    if (first) this.reap(first, nodes);
  }

  /** Round 15: rush hour starts. A two-note courier horn (detuned brass chord), played twice, over a duck. */
  rushHour(): void {
    if (!this.fxOk) return;
    const t = this.ctx!.currentTime;
    this.priority(0.4, t, 0.9, 0.6, 'rush');
    // Classic: D/A then A/E (in C major). Round 46, Breakbeat: the same shape on the chord that is playing.
    const bb = this.track === 'breakbeat';
    const arp = bb ? this.chordNow() : [];
    const [a1, a0, b1, b0, sub] = bb ? [arp[2], arp[0], arp[0] + 12, arp[2], arp[0] - 24].map(midi) : [587.33, 440, 880, 659.25, 146.83];
    [0, 0.34].forEach((o) => {
      this.horn(a1, t + o, 0.16, 0.09);
      this.horn(a0, t + o, 0.16, 0.06);
      this.horn(b1, t + o + 0.15, 0.2, 0.09);
      this.horn(b0, t + o + 0.15, 0.2, 0.06);
    });
    this.tone(sub, t, 0.7, 'sine', 0.16, 0.2);
    this.noise(t + 0.1, 0.5, 0.04, 'highpass', 5000, 9000);
  }

  /** Round 17: overtime starts. A rising three-note brass horn over a duck, then a snare roll into the top layer. */
  overtimeHorn(): void {
    if (!this.fxOk) return;
    const t = this.ctx!.currentTime;
    // round 47: Breakbeat's drop follows within about a beat, so its duck lets go sooner
    if (this.track === 'breakbeat') this.priority(0.45, t, 0.35, 0.3, 'rush');
    else this.priority(0.4, t, 0.8, 0.5, 'rush');
    if (this.track === 'breakbeat') {
      // round 46: a rising call on the chord that is playing (the suspended dominant before the drop, usually)
      const arp = this.chordNow();
      [4, 5, 6].forEach((k, i) => {
        this.horn(midi(this.ladder(arp, k)), t + i * 0.13, 0.14, 0.09);
        this.horn(midi(this.ladder(arp, k - 2)), t + i * 0.13, 0.14, 0.05);
      });
      this.horn(midi(this.ladder(arp, 8)), t + 0.42, 0.4, 0.07);
      this.horn(midi(this.ladder(arp, 6)), t + 0.42, 0.4, 0.06);
    } else {
      [587.33, 739.99, 987.77].forEach((f, i) => {
        this.horn(f, t + i * 0.13, 0.14, 0.09);
        this.horn(f * 0.75, t + i * 0.13, 0.14, 0.05);
      });
      this.horn(987.77 * 1.5, t + 0.42, 0.4, 0.07);
      this.horn(987.77, t + 0.42, 0.4, 0.06);
    }
    for (let i = 0; i < 8; i++) this.noise(t + 0.4 + i * 0.05, 0.04, 0.03 + i * 0.006, 'highpass', 2500, 7000);
  }

  /** Round 17: overtime holds the last-10-s section at full intensity with the lead on top. */
  setOvertime(on: boolean): void {
    if (this.overtime === on) return;
    this.overtime = on;
    this.applyLayers();
  }
  private overtime = false;

  /** Round 15: a rush order is aboard: a quick rising double beep. */
  rushOrder(): void {
    if (!this.fxOk) return;
    const t = this.ctx!.currentTime;
    this.tone(987.77, t + 0.05, 0.08, 'square', 0.04, 0.2);
    this.tone(1318.5, t + 0.15, 0.12, 'square', 0.045, 0.3);
  }

  /**
   * The clock in the last 10 s (`secs` = whole seconds left) or a missed rush order (no secs): a sampled tick whose pitch
   * rises a semitone each second, a pitched pip under it, and a heartbeat in the last 3 s.
   */
  tick(urgent: boolean, secs = 0): void {
    if (!this.fxOk) return;
    const t = this.ctx!.currentTime + 0.012;
    // round 47 (Gemini: the last ticks were shrill): a soft FM woodblock / marimba tick on the chord's tones, climbing one
    // chord tone a second (around 500 to 1,100 Hz), panned left and right on alternate ticks, with a short knock under it
    const up = secs > 0 ? Math.max(0, 10 - secs) : 0;
    const u = this.chordTones();
    let k = 0;
    while (this.ladderU(u, k) < 72) k++;
    while (this.ladderU(u, k) >= 84) k--;
    const f = midi(this.ladderU(u, k + Math.min(up, 7)));
    const pan = (this.tickN++ % 2 ? 0.28 : -0.28);
    this.fmTick(f, t, urgent ? 0.2 : 0.16, pan);
    this.samp(urgent ? 'tick1' : 'tick0', t, { gain: urgent ? 0.35 : 0.28, rate: 0.7, verb: 0.08, att: 0.004, lp: 2400, pan });
    if (secs > 0 && secs <= 3) {
      // lub-dub
      for (const [d, a] of [[0.0, 0.45], [0.16, 0.32]]) {
        this.tone(62, t + d, 0.16, 'sine', a, 0, 40);
        this.samp('thud', t + d, { gain: a * 0.6, rate: 0.8, lp: 400 });
      }
    }
  }

  /** Round 47: one FM mallet tick: a sine carrier, a ratio-3.5 modulator whose index dies in 25 ms, a 0.12 s decay. */
  private fmTick(f: number, t: number, gain: number, pan: number): void {
    const ctx = this.ctx!;
    const car = ctx.createOscillator();
    car.frequency.value = f;
    const mod = ctx.createOscillator();
    mod.frequency.value = f * 3.5;
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(f * 1.2, t);
    mg.gain.exponentialRampToValueAtTime(f * 0.02, t + 0.025);
    mod.connect(mg).connect(car.frequency);
    const g = this.envGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.002);
    g.gain.exponentialRampToValueAtTime(gain * 0.3, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0003, t + 0.14);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    car.connect(g).connect(lp).connect(p).connect(this.sfx);
    const v = ctx.createGain();
    v.gain.value = 0.12;
    p.connect(v).connect(this.reverbSend);
    for (const o of [car, mod]) {
      o.start(t);
      o.stop(t + 0.16);
    }
    this.reap(car, [car, mod, mg, g, lp, p, v]);
  }

  /** UI: a crisp select click (title buttons, play, resume). */
  click(): void {
    if (!this.fxOk) return;
    const t = this.ctx!.currentTime;
    if (!this.samp('select', t, { gain: 0.55 })) this.tone(880, t, 0.06, 'triangle', 0.08, 0.1);
  }

  /** UI: back / pause. */
  uiBack(): void {
    if (!this.fxOk) return;
    const t = this.ctx!.currentTime;
    if (!this.samp('back', t, { gain: 0.6 })) this.tone(660, t, 0.06, 'triangle', 0.07, 0.1);
  }

  /** UI: a toggle (music on/off, minimap). */
  uiToggle(): void {
    if (!this.fxOk) return;
    const t = this.ctx!.currentTime;
    if (!this.samp('toggle', t, { gain: 0.5 })) this.tone(990, t, 0.05, 'triangle', 0.06, 0.1);
  }

  /**
   * Medal won: a short three-note fanfare (a soft brass-like square plus a sine body) that ends on a held chord with
   * a bell shimmer. Each higher medal starts a whole tone higher and adds one bell. `delay` lines it up with the banner.
   */
  medal(tier: number, delay = 0): void {
    if (!this.fxOk) return;
    const t = this.ctx!.currentTime + delay;
    // the music drops ~11 dB under the fanfare and its bells, then comes back (the drone and the ambience dip too)
    this.priority(0.28, t - 0.03, 1.25, 0.7, 'medal');
    this.fanWin = { from: t, to: t + 1.2, sfxPeak: 0, sfxSum: 0, musSum: 0, n: 0, preDb: this.meter.musicOpenDb };
    // Round 46: the motif climbs the chord the music is on (both soundtracks), starting on the first chord tone at or
    // above G4 and one chord tone higher per tier (it used to rise a whole tone per tier and leave the key).
    const u = this.chordTones();
    let k0 = -12;
    while (this.ladderU(u, k0) < 67) k0++;
    k0 += Math.min(tier, 4) - 1;
    const motif = [0, 1, 2].map((i) => midi(this.ladderU(u, k0 + i)));
    const top = midi(this.ladderU(u, k0 + 3));
    const sub = midi(this.ladderU(u, k0) - 12);
    const bells = [0, 1, 2, 3].map((i) => midi(this.ladderU(u, k0 + 3 + i)) * 2);
    // Breakbeat's brass is a triangle: a square's 3rd and 5th harmonics land off its ninth chords (Classic keeps its square)
    const bbBrass = this.track === 'breakbeat';
    motif.forEach((n, i) => {
      const dur = i === 2 ? 1.1 : 0.16;
      this.tone(n, t + i * 0.12, dur, bbBrass ? 'triangle' : 'square', bbBrass ? 0.06 : 0.035, 0.4);
      this.tone(n, t + i * 0.12, dur, 'sine', 0.16, 0.5);
    });
    this.tone(top, t + 0.24, 1.1, 'sine', 0.1, 0.6);
    this.tone(sub, t + 0.24, 0.9, 'sine', 0.18, 0.2);
    for (let i = 0; i < Math.min(tier, 4); i++) this.bell(bells[i] * 0.5, t + 0.32 + i * 0.07, 0.7, 0.05, { pan: (i % 2 ? 0.3 : -0.3), verb: 0.5, ping: 0.3 });
    this.noise(t + 0.24, 0.7, 0.04, 'highpass', 6000, 11000);
  }

  /** Time's up: a falling sting with no medal; with a medal a rising C major cadence with one bell per tier. */
  gameOver(tier = 0, win = false): void {
    if (!this.fxOk) return;
    const t = this.ctx!.currentTime;
    this.duck(0.35, t, 1.0, 0.8, 'gameover');
    this.boostEnd();
    // round 48: a completed shift always gets the rising cadence (with no medal bells)
    if (tier <= 0 && !win) {
      [523.25, 415.3, 349.23, 261.63].forEach((n, i) => this.tone(n, t + i * 0.16, 0.7, 'triangle', 0.18));
      return;
    }
    // Classic: a rising C major cadence. Round 46, Breakbeat: the same shape in A flat major, the chord its medal
    // game-over loop opens on (Abmaj9); without a medal both fall C Ab F C, which is F minor, home for both tracks.
    const bb = this.track === 'breakbeat';
    (bb ? [311.13, 415.3, 523.25] : [392, 523.25, 659.25]).forEach((n, i) => this.tone(n, t + i * 0.12, 0.3, 'triangle', 0.17));
    (bb ? [415.3, 523.25, 622.25] : [523.25, 659.25, 783.99]).forEach((n) => this.tone(n, t + 0.36, 1.3, 'sine', 0.12, 0.5));
    if (bb) this.tone(783.99, t + 0.44, 1.1, 'sine', 0.05, 0.6);
    this.tone(bb ? 103.83 : 130.81, t + 0.36, 1.1, 'sine', 0.2, 0.2);
    const bells = bb ? [1661.22, 2093, 2489.02, 3135.96] : [2093, 2637, 3136, 4186];
    for (let i = 0; i < Math.min(tier, 4); i++) this.bell(bells[i] * 0.5, t + 0.44 + i * 0.09, 0.8, 0.045, { pan: (i % 2 ? 0.3 : -0.3), verb: 0.5, ping: 0.3 });
  }

  start(): void {
    if (!this.fxOk) return;
    const t = this.ctx!.currentTime;
    // round 46: the take-off arpeggio is on the run's first chord (Classic C major, Breakbeat F minor ninth)
    (this.track === 'breakbeat' ? [349.23, 415.3, 523.25, 622.25] : [392, 523.25, 659.25, 783.99]).forEach((n, i) => this.tone(n, t + i * 0.06, 0.4, 'triangle', 0.1));
    this.ensureDroneSlap();
  }

  /** Test hook: the mix's tap points (master output and the buses), for the recording scripts. */
  taps(): Record<string, AudioNode> | null {
    if (!this.ctx) return null;
    // round 46: amb is after the effects switch's gate (the same signal as ambOut while effects are on)
    return { out: this.outTrim, music: this.musicBus, sfx: this.sfx, bed: this.droneOut, amb: this.ambGate, rev: this.fxReturn };
  }

  /** Test / debug: sample sprite and mix state. */
  sfxInfo(): Record<string, unknown> {
    const a = this.amb;
    const r = (v: number) => Math.round(v * 100) / 100;
    return {
      liveOneShots: this.live, reapedOneShots: this.reaped, lastPassNear: this.lastPassNear, rotorHz: Math.round(this.rotorHz * 10) / 10,
      sprite: this.spriteState, spriteMs: this.spriteMs, spriteDelayMs: Math.round(this.spriteDelay * 1000), sampled: this.sampled, passes: this.passes,
      amb: { city: r(a.city), harbour: r(a.harbour), alt: r(a.alt), narrow: r(a.narrow) }, boosting: !!this.boostSrc, carrying: this.carrying,
    };
  }

  // =====================================================================================================
  // Music: a step sequencer on the audio clock (lookahead scheduler), one gain bus per layer, ducking.
  // =====================================================================================================

  private buildMusic(): void {
    const ctx = this.ctx!;
    // layers -> highpass 55 Hz -> lowpass 6.5 kHz -> scene fade -> duck -> on/off & level -> master
    // round 45: -> scene lift (the game-over loop) -> the music bus; a light send into the shared reverb
    this.musicOut = ctx.createGain();
    this.musicOut.gain.value = this.musicEnabled ? MUSIC_VOL : 0;
    this.musicOut.connect(this.musicBus);
    const mVerb = ctx.createGain();
    mVerb.gain.value = 0.12;
    this.musicOut.connect(mVerb).connect(this.reverbSend);
    this.duckGain = ctx.createGain();
    this.duckGain.connect(this.musicOut);
    this.sceneLift = ctx.createGain();
    this.sceneLift.connect(this.duckGain);
    this.musicFade = ctx.createGain();
    this.musicFade.gain.value = 0;
    this.musicFade.connect(this.sceneLift);
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = TONE_OPEN[this.track];
    tone.Q.value = 0.5;
    tone.connect(this.musicFade);
    this.musicTone = tone;
    const lowCut = ctx.createBiquadFilter();
    lowCut.type = 'highpass';
    lowCut.frequency.value = 55;
    lowCut.connect(tone);
    this.musicLowCut = lowCut;

    // a dotted-eighth echo (three steps) for the plucks and the lead, darker on every repeat
    this.echoSend = ctx.createGain();
    this.echoSend.gain.value = 0.32;
    const delay = ctx.createDelay(1);
    delay.delayTime.value = STEP * 3;
    const echoLp = ctx.createBiquadFilter();
    echoLp.type = 'lowpass';
    echoLp.frequency.value = 2200;
    const fb = ctx.createGain();
    fb.gain.value = 0.3;
    this.echoSend.connect(delay).connect(echoLp);
    echoLp.connect(fb).connect(delay);
    echoLp.connect(lowCut);

    for (const l of LAYERS) {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(lowCut);
      this.bus[l] = g;
    }
    this.bus.arp.connect(this.echoSend);
    this.bus.lead.connect(this.echoSend);
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 700;
    this.padFilter.Q.value = 0.7;
    // round 47: the pad dips near 1.2 kHz while drafting (set in setDraft)
    this.padDip = ctx.createBiquadFilter();
    this.padDip.type = 'peaking';
    this.padDip.frequency.value = 1200;
    this.padDip.Q.value = 1.1;
    this.padDip.gain.value = 0;
    this.padFilter.connect(this.padDip).connect(this.bus.pad);
    // round 47: Classic's melodic layers (pad, arp, lead, the ticking urgency) close to 2.4 kHz in the last 10 s
    this.melLpC = ctx.createBiquadFilter();
    this.melLpC.type = 'lowpass';
    this.melLpC.frequency.value = 16000;
    this.melLpC.Q.value = 0.5;
    this.melLpC.connect(lowCut);
    for (const l of ['pad', 'arp', 'lead', 'urg'] as Layer[]) {
      this.bus[l].disconnect();
      this.bus[l].connect(this.melLpC);
    }
    this.bus.arp.connect(this.echoSend);
    this.bus.lead.connect(this.echoSend);
    this.hatFilter = ctx.createBiquadFilter();
    this.hatFilter.type = 'bandpass';
    this.hatFilter.frequency.value = 7200;
    this.hatFilter.Q.value = 0.9;
    this.hatFilter.connect(this.bus.drums);
    this.clapFilter = ctx.createBiquadFilter();
    this.clapFilter.type = 'bandpass';
    this.clapFilter.frequency.value = 1500;
    this.clapFilter.Q.value = 0.8;
    this.clapFilter.connect(this.bus.drums);

    // meters (read only while a test turns them on)
    this.musicAn = ctx.createAnalyser();
    this.musicAn.fftSize = 1024;
    this.musicOut.connect(this.musicAn);
    this.sfxAn = ctx.createAnalyser();
    this.sfxAn.fftSize = 1024;
    this.sfx.connect(this.sfxAn);

    // round 46: the Breakbeat soundtrack (its shared filters, tremolo and buses are built once, here)
    this.bb = new Breakbeat({
      ctx,
      input: lowCut,
      noise: this.noiseBuffer,
      softSaw: this.softSaw,
      reap: (src, nodes) => this.reap(src, nodes),
      note: () => this.notes++,
    });
    this.bb.out.gain.value = BB_LEVEL;

    this.timer = window.setInterval(this.musicTick, TICK_MS);
    if (this.scene !== 'off') this.startScene('off');
  }

  /**
   * Round 46: switch the soundtrack (title or pause control, `?music=`). The music fades out over 0.25 s and the scene
   * that is playing starts again on the new soundtrack's grid. Chimes, horns and fanfares follow the new chords.
   */
  setSoundtrack(track: Soundtrack, save = true): void {
    if (track !== 'classic' && track !== 'breakbeat') return;
    if (save) writePref(TRACK_KEY, track);
    if (track === this.track) return;
    this.track = track;
    this.stepLen = track === 'breakbeat' ? BB_STEP : STEP;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.pingL.delayTime.setValueAtTime(this.stepLen * 3, now);
    this.pingR.delayTime.setValueAtTime(this.stepLen * 3, now);
    this.musicTone.frequency.setTargetAtTime(TONE_OPEN[track], now, 0.1);
    if (this.scene !== 'off') this.startScene(this.scene, true);
    else this.applyLayers();
  }

  /** Round 46 (critic): effects on/off, separate from the music: rotor, air, ambience, cues and UI clicks. */
  setSfxEnabled(on: boolean): void {
    this.sfxEnabled = on;
    writePref(SFX_KEY, on ? '1' : '0');
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.sfx.gain.setTargetAtTime(on ? SFX_VOL : 0, now, 0.05);
    this.droneBus.gain.setTargetAtTime(on ? DRONE_VOL : 0, now, 0.05);
    this.ambGate.gain.setTargetAtTime(on ? 1 : 0, now, 0.05);
    if (!on) this.boostEnd();
  }

  /** Round 46: rush hour is on (Breakbeat adds brass stabs and fills; latched on the bar). */
  setRush(on: boolean): void {
    this.rush = on;
  }

  /** Which piece plays: title loop, run track, last-10-s section, game-over loop (by medal tier). */
  setMusicScene(scene: MusicScene, tier = 0): void {
    if (scene === this.scene && (scene !== 'over' || tier === this.overTier)) return;
    const prev = this.scene;
    this.scene = scene;
    this.overTier = tier;
    if (scene === 'run') this.chainLv = 0;
    if (!this.ctx) {
      this.applyLayers();
      return;
    }
    this.startScene(prev);
  }

  private startScene(prev: MusicScene, switching = false): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    if (this.scene === 'final' && prev === 'run' && !switching) {
      // same groove, new harmony: Classic changes on the next beat, Breakbeat on the next bar (its sections are bars)
      const unit = this.track === 'breakbeat' ? 16 : 4;
      this.step = -((unit - (this.step % unit)) % unit);
      this.bb?.reset();
    } else {
      const fade = this.musicFade.gain;
      fade.cancelScheduledValues(now);
      fade.setValueAtTime(fade.value, now);
      // a straight ramp to exactly 0 (no exponential tail that a later setValueAtTime would cut off with a step)
      // round 45 click fix: the run music fades over 150 ms into game over (it was cut in 40 ms under the sting)
      // round 46: a soundtrack switch fades over 0.25 s and the new one starts after it
      const out = switching ? 0.25 : this.scene === 'over' ? 0.15 : 0.04;
      const gap = switching ? 0.32 : prev === 'off' ? 0.06 : this.scene === 'run' ? 0.24 : this.scene === 'over' ? 0.2 : 0.14;
      fade.linearRampToValueAtTime(0, now + out);
      // round 45: the game-over loop is lifted (with its sub-bass cut) to sit near the run's loudness
      // round 46: per-soundtrack scene levels (the menus no longer sit 1.4 LU over the run)
      const over = this.scene === 'over';
      const lvl = SCENE_GAIN[this.track];
      const lift = over ? (this.track === 'classic' ? OVER_LIFT : 1) * lvl.over : this.scene === 'title' ? lvl.title : lvl.run;
      this.sceneLift.gain.setValueAtTime(this.sceneLift.gain.value, now + out);
      this.sceneLift.gain.linearRampToValueAtTime(lift, now + out + 0.01);
      this.musicLowCut.frequency.setValueAtTime(over && this.track === 'classic' ? 120 : 55, now + out + 0.01);
      this.bb?.reset();
      if (this.scene !== 'off') {
        // a short gap lets the old notes die; game over swells in slowly under the sting
        this.nextStep = now + gap;
        this.step = 0;
        this.sceneStartAt = now + gap;
        fade.setValueAtTime(0, now + gap - 0.01);
        fade.linearRampToValueAtTime(1, now + gap + (this.scene === 'title' ? 1.2 : this.scene === 'over' ? 1.8 : 0.05));
      }
    }
    this.applyLayers();
  }

  /** In-run state, every frame: chain level, clock (last-10-s section) and whether the next medal is close. */
  setRunState(chain: number, timeLeft: number, chase: boolean, rush = this.rush): void {
    this.rush = rush;
    // round 47: when the clock will reach 0 (audio clock), for the gap before Breakbeat's overtime drop
    // The game clock can run slower than the audio clock (slow motion, a low frame rate), so its rate is measured.
    if (this.ctx && !this.overtime) {
      const now = this.ctx.currentTime;
      if (this.clockT > 0 && now - this.clockT >= 0.1) {
        const r = (this.clockTL - timeLeft) / (now - this.clockT);
        if (r > 0.2 && r < 2) this.clockRate += (r - this.clockRate) * 0.3;
        this.clockT = now;
        this.clockTL = timeLeft;
      } else if (this.clockT <= 0 || timeLeft > this.clockTL) {
        this.clockT = now;
        this.clockTL = timeLeft;
      }
      this.clockZeroAt = timeLeft > 0 ? now + timeLeft / this.clockRate : Infinity;
    }
    if (this.forced) {
      chain = this.forced.chain;
      timeLeft = this.forced.final ? 5 : 60;
      chase = false;
    }
    if (this.scene === 'run' && timeLeft <= FINAL_IN && timeLeft > 0) this.setMusicScene('final');
    else if (this.scene === 'final' && timeLeft > FINAL_OUT) this.setMusicScene('run');
    const lv = Math.min(3, Math.max(0, chain));
    if (lv !== this.chainLv || chase !== this.chase) {
      this.chainLv = lv;
      this.chase = chase;
      this.applyLayers();
    }
  }

  private applyLayers(): void {
    const sc = this.scene, lv = this.chainLv;
    const o = this.on;
    o.pad = sc !== 'off';
    o.bass = sc !== 'off';
    o.drums = sc === 'final' || (sc === 'run' && lv >= 1);
    o.arp = sc === 'title' || sc === 'final' || sc === 'over' || (sc === 'run' && lv >= 2);
    o.lead = sc === 'title' || sc === 'over' || (sc === 'run' && lv >= 3) || (sc === 'final' && this.overtime);
    o.urg = sc === 'final';
    // intensity: title 0.15, run 0.30 / 0.50 / 0.68 / 0.85 by chain (+0.05 chasing a medal), final 0.92+, over by medal
    this.target =
      sc === 'title' ? 0.15
      : sc === 'run' ? [0.3, 0.5, 0.68, 0.85][lv] + (this.chase ? 0.05 : 0)
      : sc === 'final' ? (this.overtime ? 1 : 0.92 + 0.02 * lv)
      : sc === 'over' ? 0.1 + 0.05 * this.overTier
      : 0;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const l of LAYERS) this.bus[l].gain.setTargetAtTime(o[l] ? 1 : 0, now, o[l] ? 0.12 : 0.3);
    this.melLpC.frequency.setTargetAtTime(sc === 'final' ? 2400 : 16000, now, 0.25);
    // round 46: Breakbeat gates its own layers on the bar (see breakbeat.ts); its output is on while it is the track
    this.bb?.out.gain.setTargetAtTime(this.track === 'breakbeat' ? BB_LEVEL : 0, now, 0.05);
  }

  /** Called every frame: keeps the scheduler fed (backs up the interval timer), smooths intensity, reads meters. */
  musicFrame(dt: number): void {
    if (!this.ctx) return;
    this.musicTick();
    this.intensity += (this.target - this.intensity) * (1 - Math.exp(-dt / 0.6));
    if (this.ctx.state === 'running' && Math.abs(this.intensity - this.padCutoffI) > 0.01) {
      this.padCutoffI = this.intensity;
      this.padFilter.frequency.setTargetAtTime(450 + 1700 * this.intensity, this.ctx.currentTime, 0.3);
    }
    if (this.meterOn) this.sampleMeter();
  }

  setMusicEnabled(on: boolean): void {
    this.musicEnabled = on;
    writeMusicPref(on);
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.musicOut.gain.setTargetAtTime(on ? MUSIC_VOL : 0, now, 0.08);
    // nothing was scheduled while off: move the grid forward to now without counting it as a stall
    if (on && this.nextStep < now + 0.05) {
      const skip = Math.ceil((now + 0.05 - this.nextStep) / this.stepLen);
      this.nextStep += skip * this.stepLen;
      this.step += skip;
    }
  }

  private readonly musicTick = (): void => {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.musicEnabled || this.scene === 'off') return;
    const now = ctx.currentTime;
    if (this.nextStep < now - 0.25) {
      // the timer was starved (hidden tab, long stall): skip ahead on the grid instead of firing a burst of notes
      const skip = Math.ceil((now + 0.03 - this.nextStep) / this.stepLen);
      this.nextStep += skip * this.stepLen;
      this.step += skip;
      this.resyncs++;
    }
    const horizon = now + LOOKAHEAD;
    while (this.nextStep < horizon) {
      if (this.nextStep < now) this.late++;
      if (this.step >= 0) this.playStep(this.step, Math.max(this.nextStep, now));
      this.nextStep += this.stepLen;
      this.step++;
    }
  };

  private playStep(step: number, t: number): void {
    const s = step % 16;
    const bar = Math.floor(step / 16);
    if (this.track === 'breakbeat' && this.bb) {
      // round 47: overtime is about to start when the clock reaches 0 inside this bar's last beat, with a parcel aboard,
      // early enough for the scheduler (0.3 s) to see it before the next downbeat
      const down = t + (16 - s) * BB_STEP;
      const otSoon = this.scene === 'final' && !this.overtime && this.carrying && this.clockZeroAt > t - 0.05 && this.clockZeroAt <= down - 0.3;
      if (this.scene !== 'off') this.bb.step(this.scene, bar, s, t, { chain: this.chainLv, chase: this.chase, rush: this.rush, overtime: this.overtime, tier: this.overTier, otSoon });
      return;
    }
    switch (this.scene) {
      case 'title':
        this.stepSlow(TITLE_PROG, bar, s, t, false);
        break;
      case 'over':
        this.stepSlow(this.overTier > 0 ? OVER_PROG_MEDAL : OVER_PROG_NONE, bar, s, t, true);
        break;
      case 'run':
        this.stepRun(bar, s, t);
        break;
      case 'final':
        this.stepFinal(bar, s, t);
        break;
      default:
        break;
    }
  }

  /** Title and game over: one chord every two bars, pad + soft bass + plucks or bells. */
  private stepSlow(prog: typeof TITLE_PROG, bar: number, s: number, t: number, over: boolean): void {
    const ch = prog[Math.floor(bar / 2) % prog.length];
    const two = (bar % 2) * 16 + s; // 0..31 inside the chord
    const o = this.on;
    if (two === 0 && o.pad) for (const n of ch.pad) this.mNote(this.padFilter, midi(n), t, STEP * 32 + 0.4, 'triangle', over ? 0.03 : 0.075, 0.9);
    // Round 11: the title was 73% sub-bass. Pad harmonics an octave up (300 to 700 Hz, past the pad filter), a softer
    // bass and louder plucks with a sine an octave above put most of the title in the band a phone speaker plays.
    if (two === 0 && o.pad) for (const n of ch.pad) this.mNote(this.bus.pad, midi(n + 12), t, STEP * 32 + 0.4, 'sine', over ? 0.008 : 0.03, 0.9);
    if (s === 0 && o.bass) this.mNote(this.bus.bass, midi(ch.bass), t, 1.8, 'triangle', over ? 0.075 : 0.092, 0.04);
    if (!over) {
      if (s % 2 === 0 && o.arp) {
        const idx = TITLE_PLUCK[two / 2];
        if (idx >= 0) {
          this.mNote(this.bus.arp, midi(ch.arp[idx]), t, 0.55, 'triangle', 0.092);
          this.mNote(this.bus.arp, midi(ch.arp[idx] + 12), t, 0.35, 'sine', 0.025);
        }
      }
      if (two === 20 && o.lead) this.mNote(this.bus.lead, midi(ch.arp[3] + 12), t, 1.4, 'sine', 0.058);
      if (two === 28 && o.lead) this.mNote(this.bus.lead, midi(ch.arp[2] + 12), t, 1.0, 'sine', 0.037);
      return;
    }
    const tier = this.overTier;
    if (tier === 0) {
      // no medal: a single falling sigh per chord
      if (two === 8 && o.lead) this.mNote(this.bus.lead, midi(ch.arp[2]), t, 1.6, 'sine', 0.02);
      if (two === 20 && o.lead) this.mNote(this.bus.lead, midi(ch.arp[1]), t, 1.8, 'sine', 0.016);
      return;
    }
    // a medal: bells climb the chord (more of them for a better medal)
    if (o.arp && two < 16 && two % 4 === 0) this.mNote(this.bus.arp, midi(ch.arp[two / 4]), t, 1.0, 'sine', 0.022);
    if (o.arp && tier >= 2 && two >= 16 && two % 4 === 0) this.mNote(this.bus.arp, midi(ch.arp[3 - (two - 16) / 4]), t, 1.0, 'sine', 0.018);
    if (o.lead && tier >= 3 && two % 4 === 2 && two < 16) this.mNote(this.bus.lead, midi(ch.arp[(two - 2) / 4] + 12), t, 0.7, 'sine', 0.009);
  }

  /**
   * Run: a 32-bar form (eight 4-bar phrases, one chord a bar). The bass rhythm and arpeggio order change every phrase
   * and cycle every 3 phrases, and the last bar of every other phrase gets a drum fill, so the music only repeats
   * exactly every 96 bars (184 s). Layers join with the slipstream chain.
   */
  private stepRun(bar: number, s: number, t: number): void {
    const fb = bar % RUN_FORM.length;
    const phrase = Math.floor(bar / 4);
    const ch = RUN_FORM[fb];
    const lv = this.chainLv;
    const o = this.on;
    const fill = bar % 4 === 3 && phrase % 2 === 1;
    if (s === 0 && o.pad) for (const n of ch.pad) this.mNote(this.padFilter, midi(n), t, STEP * 16 + 0.15, 'triangle', 0.03, 0.12);
    // pad colour above the pad filter: the chord's top note an octave up, so the run still reads on a phone speaker
    if (s === 0 && o.pad) this.mNote(this.bus.pad, midi(ch.pad[2] + 12), t, STEP * 16 + 0.15, 'sine', 0.012, 0.15);
    const bassSteps = RUN_BASS_VARIANTS[phrase % RUN_BASS_VARIANTS.length];
    if (o.bass && bassSteps.includes(s)) this.mNote(this.bus.bass, midi(ch.bass + (s === 14 && lv >= 1 ? 12 : 0)), t, 0.3, 'triangle', 0.12);
    if (o.drums) {
      if (lv >= 2 ? s % 4 === 0 : s === 0 || s === 8) this.kick(t, 0.24);
      if (fill && (s === 13 || s === 14 || s === 15) && lv >= 2) this.kick(t, s === 15 ? 0.2 : 0.14);
      if (s % 4 === 2) this.hat(t, 0.022, 0.05);
      if (lv >= 3 && (s === 4 || s === 12)) this.clap(t, 0.05);
      if (fill && lv >= 3 && s === 14) this.clap(t, 0.035);
      if ((lv >= 3 || this.chase || fill) && s % 2 === 1) this.hat(t, 0.009, 0.03);
    }
    const order = RUN_ARP_ORDERS[phrase % RUN_ARP_ORDERS.length];
    if (o.arp && (lv >= 3 || s % 2 === 0)) this.mNote(this.bus.arp, midi(ch.arp[order[s]]), t, 0.2, 'triangle', lv >= 3 ? 0.022 : 0.028);
    if (o.lead) {
      const line = RUN_LEAD[RUN_LEAD_ORDER[fb]];
      const n = line[s];
      if (n) {
        let len = 1;
        while (s + len < 16 && !line[s + len]) len++;
        const dur = Math.min(0.6, len * STEP * 0.95);
        this.mNote(this.bus.lead, midi(n), t, dur, 'sine', 0.05, 0.01);
        this.mNote(this.bus.lead, midi(n), t, dur, 'triangle', 0.012, 0.01);
      }
    }
  }

  /** Last 10 s: Ab Bb Ab G7, driving octave bass, four-on-the-floor, 16th hats and a ticking high C. */
  private stepFinal(bar: number, s: number, t: number): void {
    const ch = FINAL_PROG[bar % 4];
    const o = this.on;
    if (s === 0 && o.pad) for (const n of ch.pad) this.mNote(this.padFilter, midi(n), t, STEP * 16 + 0.1, 'triangle', 0.032, 0.08);
    if (o.bass && s % 2 === 0) this.mNote(this.bus.bass, midi(ch.bass + (s % 4 === 2 ? 12 : 0)), t, 0.18, 'triangle', 0.11);
    if (o.drums) {
      if (s % 4 === 0) this.kick(t, 0.26);
      if (s === 4 || s === 12) this.clap(t, 0.055);
      this.hat(t, s % 4 === 2 ? 0.022 : 0.01, 0.035);
    }
    if (o.arp) this.mNote(this.bus.arp, midi(ch.arp[ARP_ORDER[s]]), t, 0.16, 'triangle', 0.022);
    if (o.urg && s % 2 === 0) this.mNote(this.bus.urg, midi(84), t, 0.08, 'triangle', s % 4 === 0 ? 0.022 : 0.014);
  }

  /** One music note: a pluck (swell 0) or a pad-like swell with linear attack and release. */
  private mNote(dest: AudioNode, f: number, t: number, dur: number, type: OscillatorType, gain: number, swell = 0): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const g = this.envGain();
    if (swell > 0) {
      const sw = Math.min(swell, dur * 0.45);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + sw);
      g.gain.setValueAtTime(gain, t + dur - sw);
      g.gain.linearRampToValueAtTime(0, t + dur);
    } else {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
    this.reap(o, [o, g]);
    this.notes++;
  }

  private kick(t: number, gain: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.12);
    const g = this.envGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(this.bus.drums);
    o.start(t);
    o.stop(t + 0.32);
    this.reap(o, [o, g]);
    this.notes++;
  }

  private hit(t: number, gain: number, dur: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const g = this.envGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(g).connect(dest);
    src.start(t, (this.notes % 37) * 0.04);
    src.stop(t + dur + 0.02);
    this.reap(src, [src, g]);
    this.notes++;
  }

  private hat(t: number, gain: number, dur: number): void {
    this.hit(t, gain, dur, this.hatFilter);
  }

  private clap(t: number, gain: number): void {
    this.hit(t, gain, 0.16, this.clapFilter);
  }

  /** Pull the music down under a cue: reach `depth` at `at`, hold `hold` s, glide back over `release` s. */
  private duck(depth: number, at: number, hold: number, release: number, reason: string): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    at = Math.max(now, at);
    const prev = this.duckSeg;
    let end = at + 0.04 + hold;
    // a duck still holding keeps the deeper level and the later end
    if (prev && prev.end + prev.release > at) {
      if (prev.end > at) depth = Math.min(depth, prev.depth);
      end = Math.max(end, prev.end);
    }
    const cur = this.duckValue(now);
    const g = this.duckGain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(cur, now);
    if (at > now) g.setValueAtTime(cur, at);
    g.linearRampToValueAtTime(depth, at + 0.04);
    g.setValueAtTime(depth, end);
    g.linearRampToValueAtTime(1, end + release);
    this.duckSeg = { from: now, start: cur, at, depth, end, release };
    this.ducks++;
    this.lastDuck = { reason, depth: Math.round(depth * 100) / 100, at: Math.round(at * 100) / 100 };
  }

  /** The duck gain at time t, from the planned segment (AudioParam.value is not reliable mid-automation everywhere). */
  private duckValue(t: number): number {
    const d = this.duckSeg;
    if (!d || t >= d.end + d.release) return 1;
    if (t < d.at) return d.start;
    if (t < d.at + 0.04) return d.start + (d.depth - d.start) * ((t - d.at) / 0.04);
    if (t < d.end) return d.depth;
    return d.depth + (1 - d.depth) * ((t - d.end) / d.release);
  }

  /** Test hook: hold the music at a chain level (and optionally in the last-10-s section) whatever the run does. */
  forceRunState(chain: number | null, final = false): void {
    this.forced = chain === null ? null : { chain, final };
  }

  /** Test hook: read the music and SFX bus levels every frame and measure the fanfare against the music. */
  setMeter(on: boolean): void {
    this.meterOn = on;
  }

  private rmsOf(an: AnalyserNode): number {
    if (!this.meterBuf) this.meterBuf = new Float32Array(an.fftSize);
    an.getFloatTimeDomainData(this.meterBuf);
    let sum = 0;
    for (let i = 0; i < this.meterBuf.length; i++) sum += this.meterBuf[i] * this.meterBuf[i];
    return Math.sqrt(sum / this.meterBuf.length);
  }

  private sampleMeter(): void {
    if (!this.ctx || !this.musicAn || !this.sfxAn || this.ctx.state !== 'running') return;
    const db = (v: number) => Math.round(20 * Math.log10(Math.max(1e-6, v)) * 10) / 10;
    const m = this.rmsOf(this.musicAn);
    const x = this.rmsOf(this.sfxAn);
    this.meter.musicDb = db(m);
    this.meter.sfxDb = db(x);
    const now = this.ctx.currentTime;
    // music level with no duck active: a slow running RMS
    if (this.duckValue(now) > 0.99) {
      this.musicOpenMs = this.musicOpenMs * 0.97 + m * m * 0.03;
      this.meter.musicOpenDb = db(Math.sqrt(this.musicOpenMs));
    }
    const w = this.fanWin;
    if (w && now >= w.from) {
      if (now <= w.to) {
        w.sfxPeak = Math.max(w.sfxPeak, x);
        w.sfxSum += x * x;
        w.musSum += m * m;
        w.n++;
      } else {
        if (w.n > 0) {
          const sfxRms = Math.sqrt(w.sfxSum / w.n);
          const musRms = Math.sqrt(w.musSum / w.n);
          this.lastFanfare = { sfxRmsDb: db(sfxRms), sfxPeakDb: db(w.sfxPeak), musicRmsDb: db(musRms), musicBeforeDb: w.preDb, marginDb: Math.round((db(sfxRms) - db(musRms)) * 10) / 10, samples: w.n };
        }
        this.fanWin = null;
      }
    }
  }

  musicInfo(): Record<string, unknown> {
    const ctx = this.ctx;
    const running = !!ctx && ctx.state === 'running';
    const now = ctx ? ctx.currentTime : 0;
    const duck = this.duckValue(now);
    const fade = this.musicFade ? this.musicFade.gain.value : 0;
    const sc = this.scene;
    const playing = running && this.musicEnabled && sc !== 'off' && now >= this.sceneStartAt;
    // round 46: Breakbeat reports the layers it actually plays (latched on the bar)
    const bbL = this.track === 'breakbeat' && this.bb ? this.bb.latched : null;
    const lv = bbL && (sc === 'run' || sc === 'final') ? bbL.lv : this.chainLv;
    const layer = sc === 'title' || sc === 'over' ? 1 : sc === 'run' ? 1 + lv : sc === 'final' ? 5 : 0;
    const section =
      sc === 'title' ? 'loop'
      : sc === 'run' ? (bbL ? ['base', 'hats', 'ghosts-arp', 'lead-ride'][lv] + (bbL.rush ? '+stabs' : '') : ['base', 'drums', 'arp', 'lead'][lv])
      : sc === 'final' ? (bbL?.overtime && this.bb!.dropBar >= 0 ? 'drop' : 'final')
      : sc === 'over' ? ['calm', 'bronze', 'silver', 'gold', 'ace'][Math.min(4, this.overTier)]
      : 'off';
    const r = (v: number) => Math.round(v * 1000) / 1000;
    return {
      enabled: this.musicEnabled,
      soundtrack: this.track,
      sfxEnabled: this.sfxEnabled,
      // round 47: Breakbeat's pre-drop gap and drop (audio-clock times and counts)
      gap: this.bb ? { ...this.bb.gapInfo } : null,
      unlocked: running,
      playing,
      track: sc,
      section,
      overtime: this.overtime,
      layer,
      layers: LAYERS.filter((l) => this.on[l]),
      intensity: r(this.intensity),
      target: r(this.target),
      chain: lv,
      chase: this.chase,
      bpm: this.track === 'breakbeat' ? BB_BPM : BPM,
      gain: r((this.musicEnabled ? MUSIC_VOL : 0) * Math.min(1, fade) * duck),
      duck: r(duck),
      ducks: this.ducks,
      lastDuck: this.lastDuck,
      late: this.late,
      resyncs: this.resyncs,
      notes: this.notes,
      meter: this.meterOn ? { ...this.meter } : null,
      compDb: this.comp ? r(this.comp.reduction) : 0,
      limiterDb: this.limiter ? r(this.limiter.reduction) : 0,
      lastFanfare: this.lastFanfare,
      // round 46: the chord tones that play now (pitch classes), for the chimes-in-key check
      chordPcs: sc === 'off' ? [] : this.chordPcs(),
    };
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend().catch(() => undefined);
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
  }

  dispose(): void {
    window.clearInterval(this.timer);
    this.bb?.dispose();
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }
}
