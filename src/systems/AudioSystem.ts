import { ARP_ORDER, BPM, FINAL_PROG, midi, OVER_PROG_MEDAL, OVER_PROG_NONE, RUN_ARP_ORDERS, RUN_BASS_VARIANTS, RUN_FORM, RUN_LEAD, RUN_LEAD_ORDER, STEP, TITLE_PLUCK, TITLE_PROG } from './music';

export type MusicScene = 'off' | 'title' | 'run' | 'final' | 'over';
type Layer = 'pad' | 'bass' | 'drums' | 'arp' | 'lead' | 'urg';
const LAYERS: Layer[] = ['pad', 'bass', 'drums', 'arp', 'lead', 'urg'];

const MUSIC_KEY = 'drone-dash-music-v1';
const MUSIC_VOL = 0.5; // music bus level under the master: modest, the SFX stay on top
// Master level into the glue compressor and the limiter. Round 11: up from 0.8 (+11.8 dB) so the run sits near -17 LUFS;
// the trim after the limiter keeps every peak under -1 dBFS (the limiter's automatic make-up gain lifts its ceiling).
const MASTER_VOL = 3.1;
const OUT_TRIM = 0.8;
const LOOKAHEAD = 0.2; // s of notes scheduled ahead on the audio clock
const TICK_MS = 25; // scheduler wake-up (a main-thread stall up to ~175 ms still lands every note on time)
const FINAL_IN = 10; // s left on the clock: the tension section starts
const FINAL_OUT = 12; // s left: a time bonus has to lift the clock this far before the run section comes back

function readMusicPref(): boolean {
  try {
    return window.localStorage.getItem(MUSIC_KEY) !== '0';
  } catch {
    return true;
  }
}
function writeMusicPref(on: boolean): void {
  try {
    window.localStorage.setItem(MUSIC_KEY, on ? '1' : '0');
  } catch {
    /* storage unavailable */
  }
}

/** A planned duck of the music bus: hold `depth` from `at` to `end`, then glide back to 1 over `release`. */
interface DuckSeg { from: number; start: number; at: number; depth: number; end: number; release: number }

/**
 * Fully procedural Web Audio: rotor hum (pitch follows speed/effort), pickup
 * and delivery chimes, bump thud, boost whoosh, low-time ticks, UI clicks,
 * and an adaptive soundtrack (title loop, a run track whose layers build with the
 * slipstream chain and tighten in the last 10 s, and a game-over loop that fits the medal).
 * The context is created lazily on the first user gesture.
 *
 * Music never uses the 'square' oscillator type (the medal fanfare's brass is the only square below 1 kHz,
 * which test scripts count).
 */
export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private reverbSend!: GainNode;
  private rotorGain!: GainNode;
  private rotorOsc1!: OscillatorNode;
  private rotorOsc2!: OscillatorNode;
  private rotorFilter!: BiquadFilterNode;
  private rotorAm!: GainNode;
  private rotorLfo!: OscillatorNode;
  private windGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private draftGain!: GainNode;
  private draftFilter!: BiquadFilterNode;
  private noiseBuffer!: AudioBuffer;
  private softSaw: PeriodicWave | null = null;
  private rotorOn = false;
  private comp: DynamicsCompressorNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  muted = false;

  // ----- music -----
  musicEnabled = readMusicPref();
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
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    // brick-wall limiter after the glue compressor, then a fixed trim: nothing on the master bus can clip
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    const trim = ctx.createGain();
    trim.gain.value = OUT_TRIM;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : MASTER_VOL;
    this.master.connect(comp).connect(limiter).connect(trim).connect(ctx.destination);
    this.comp = comp;
    this.limiter = limiter;
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);

    // generated impulse response for a small, bright reverb on chimes
    const len = Math.floor(ctx.sampleRate * 1.6);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    const conv = ctx.createConvolver();
    conv.buffer = ir;
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.32;
    this.reverbSend.connect(conv).connect(this.master);

    // Round 11: a soft saw (12 harmonics with a Lanczos taper, so no edge ringing) for the boost whine. The plain
    // 'sawtooth' it used has a one-sample edge every period; at the new master level those edges (220 to 440 a second)
    // were the only clicks left on the master output.
    const nH = 12;
    const im = new Float32Array(nH + 1);
    for (let n = 1; n <= nH; n++) {
      const x = (Math.PI * n) / (nH + 1);
      im[n] = ((Math.sin(x) / x) * 2) / (Math.PI * n);
    }
    this.softSaw = ctx.createPeriodicWave(new Float32Array(nH + 1), im, { disableNormalization: true });

    this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    // Rotor: two detuned saws -> lowpass, amplitude-modulated at blade-pass rate
    this.rotorGain = ctx.createGain();
    this.rotorGain.gain.value = 0;
    this.rotorFilter = ctx.createBiquadFilter();
    this.rotorFilter.type = 'lowpass';
    this.rotorFilter.frequency.value = 900;
    this.rotorFilter.Q.value = 2.5;
    this.rotorAm = ctx.createGain();
    this.rotorAm.gain.value = 0.7;
    this.rotorOsc1 = ctx.createOscillator();
    this.rotorOsc1.type = 'sawtooth';
    this.rotorOsc1.frequency.value = 110;
    this.rotorOsc2 = ctx.createOscillator();
    this.rotorOsc2.type = 'sawtooth';
    this.rotorOsc2.frequency.value = 111.5;
    this.rotorLfo = ctx.createOscillator();
    this.rotorLfo.frequency.value = 44;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.3;
    this.rotorLfo.connect(lfoDepth).connect(this.rotorAm.gain);
    this.rotorOsc1.connect(this.rotorFilter);
    this.rotorOsc2.connect(this.rotorFilter);
    this.rotorFilter.connect(this.rotorAm).connect(this.rotorGain).connect(this.master);

    // wind / air rush layer that grows with speed
    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuffer;
    wind.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 600;
    this.windFilter.Q.value = 0.7;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    wind.connect(this.windFilter).connect(this.windGain).connect(this.master);
    // slipstream: a narrow whistling air band whose pitch rises as the draft meter fills
    this.draftFilter = ctx.createBiquadFilter();
    this.draftFilter.type = 'bandpass';
    this.draftFilter.frequency.value = 700;
    this.draftFilter.Q.value = 6;
    this.draftGain = ctx.createGain();
    this.draftGain.gain.value = 0;
    wind.connect(this.draftFilter).connect(this.draftGain).connect(this.master);

    this.rotorOsc1.start();
    this.rotorOsc2.start();
    this.rotorLfo.start();
    wind.start();

    this.buildMusic();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : MASTER_VOL, this.ctx.currentTime, 0.05);
  }

  setRotor(on: boolean): void {
    this.rotorOn = on;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.rotorGain.gain.setTargetAtTime(on ? 0.085 : 0, t, 0.25);
    if (!on) {
      this.windGain.gain.setTargetAtTime(0, t, 0.2);
      this.draftGain.gain.setTargetAtTime(0, t, 0.1);
    }
  }

  /** speed01: 0..1 of top speed, effort: 0..1 throttle, boosting adds whine. */
  updateRotor(speed01: number, effort: number, boosting: boolean, altitude01: number, headwind = 0): void {
    if (!this.ctx || !this.rotorOn) return;
    const t = this.ctx.currentTime;
    const base = 88 + speed01 * 60 + effort * 26 + (boosting ? 40 : 0) + altitude01 * 6;
    this.rotorOsc1.frequency.setTargetAtTime(base, t, 0.08);
    this.rotorOsc2.frequency.setTargetAtTime(base * 1.013 + 1.5, t, 0.08);
    this.rotorLfo.frequency.setTargetAtTime(base * 0.42, t, 0.08);
    this.rotorFilter.frequency.setTargetAtTime(600 + speed01 * 1300 + (boosting ? 900 : 0), t, 0.1);
    this.rotorGain.gain.setTargetAtTime(0.07 + effort * 0.03 + (boosting ? 0.03 : 0), t, 0.15);
    // high wind above the roofs: a louder, lower, gusting rush
    const gust = headwind * (0.06 + 0.03 * Math.sin(t * 2.3) * Math.sin(t * 0.9));
    this.windGain.gain.setTargetAtTime(Math.pow(speed01, 1.6) * 0.16 + gust, t, 0.2);
    this.windFilter.frequency.setTargetAtTime(400 + speed01 * 1400 - headwind * 200, t, 0.2);
  }

  /** Slipstream layer: intensity 0..1 sets loudness, meter level 0..1 sets the rising pitch. */
  setDraft(intensity: number, level: number): void {
    if (!this.ctx || !this.rotorOn) return;
    const t = this.ctx.currentTime;
    this.draftGain.gain.setTargetAtTime(intensity * 0.22, t, 0.12);
    this.draftFilter.frequency.setTargetAtTime(700 + level * 1500 + intensity * 300, t, 0.1);
  }

  /** Meter quarter reached: a short rising blip (higher each step). */
  slipTick(step: number): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    const f = 587.33 * Math.pow(2, (step * 3) / 12);
    this.tone(f, t, 0.12, 'triangle', 0.05, 0.2, f * 1.06);
  }

  /**
   * Meter full: a bright upward whoosh and a chime that climbs a whole tone per chain step, gets louder and adds one
   * more arpeggio note per step (x1 two notes, x5 six).
   */
  slipPayout(chain: number): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.duck(0.45, t, 0.35, 0.4, 'slip');
    const c = Math.min(chain, 5);
    const lift = Math.pow(2, ((c - 1) * 2) / 12);
    // Round 11: +2.3 dB (x1.3); the round 10 critic measured the chime only 4.6 dB over the music
    const g = (1 + (c - 1) * 0.12) * 1.3;
    this.noise(t, 0.4 + c * 0.05, 0.09 * g, 'bandpass', 900, 4200 + c * 500, 2);
    this.tone(880 * lift, t + 0.02, 0.3, 'triangle', 0.1 * g, 0.4);
    this.tone(1318.5 * lift, t + 0.1, 0.45, 'sine', 0.12 * g, 0.5);
    const arp = [1760, 2217.5, 2637, 3520];
    for (let i = 0; i < c - 1; i++) this.tone(arp[i] * lift * 0.5, t + 0.17 + i * 0.06, 0.3, 'sine', 0.07 * g, 0.5);
  }

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

  private tone(freq: number, start: number, dur: number, type: OscillatorType | 'softsaw', gain: number, reverb = 0.6, glideTo?: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    if (type === 'softsaw') {
      if (this.softSaw) o.setPeriodicWave(this.softSaw);
      else o.type = 'sawtooth';
    } else o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
    const g = this.envGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g);
    g.connect(this.sfx);
    if (reverb > 0) {
      const s = ctx.createGain();
      s.gain.value = reverb;
      g.connect(s).connect(this.reverbSend);
    }
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  private noise(start: number, dur: number, gain: number, type: BiquadFilterType, f0: number, f1: number, q = 1): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, start);
    f.frequency.exponentialRampToValueAtTime(f1, start + dur);
    const g = this.envGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.03, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(start, Math.random() * 1.5);
    src.stop(start + dur + 0.05);
  }

  pickup(): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.duck(0.6, t, 0.35, 0.4, 'pickup');
    const notes = [659.25, 783.99, 1046.5];
    notes.forEach((n, i) => {
      this.tone(n, t + i * 0.07, 0.5, 'sine', 0.22);
      this.tone(n * 2, t + i * 0.07, 0.25, 'triangle', 0.05);
    });
    this.noise(t, 0.25, 0.05, 'highpass', 4000, 9000);
  }

  deliver(combo: number): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.duck(0.45, t, 0.7, 0.6, 'delivery');
    const lift = Math.pow(2, Math.min(combo, 5) / 12);
    const chord = [523.25, 659.25, 783.99, 1046.5, 1318.5].map((n) => n * lift);
    chord.forEach((n, i) => {
      this.tone(n, t + i * 0.055, 0.9, 'sine', 0.2);
      this.tone(n * 1.5, t + i * 0.055 + 0.02, 0.4, 'triangle', 0.04);
    });
    this.tone(130.8 * lift, t, 0.5, 'sine', 0.25, 0.2);
    this.noise(t + 0.05, 0.6, 0.06, 'highpass', 6000, 12000);
  }

  bump(strength: number): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    const s = Math.min(1, strength / 14);
    this.tone(140, t, 0.28, 'sine', 0.25 + s * 0.4, 0, 45);
    this.noise(t, 0.18 + s * 0.12, 0.12 + s * 0.25, 'lowpass', 1600, 200, 0.8);
    this.tone(2400 + Math.random() * 600, t, 0.05, 'square', 0.02 * s, 0);
  }

  /** Hard crash: a heavy crunch plus a falling two-note "lost it" cue (lower still when a combo breaks). */
  crash(strength: number, comboBroken: boolean): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    const s = Math.min(1, strength);
    this.duck(0.35, t, 0.55, 0.6, 'crash');
    this.tone(95, t, 0.45, 'sine', 0.55 + s * 0.3, 0.1, 38);
    this.noise(t, 0.32 + s * 0.2, 0.35 + s * 0.25, 'lowpass', 2400, 160, 0.9);
    this.noise(t + 0.02, 0.12, 0.08 + s * 0.06, 'bandpass', 3800, 1800, 3);
    const base = comboBroken ? 392 : 466.16;
    this.tone(base, t + 0.12, 0.22, 'triangle', 0.1, 0.3);
    this.tone(base * 0.749, t + 0.26, 0.4, 'triangle', 0.11, 0.4, base * 0.7);
  }

  boost(): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.noise(t, 0.55, 0.16, 'bandpass', 400, 2600, 1.2);
    this.tone(220, t, 0.4, 'softsaw', 0.03, 0, 440);
  }

  /** Round 15: rush hour starts. A two-note courier horn, played twice, over a short duck. */
  rushHour(): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.duck(0.4, t, 0.9, 0.6, 'rush');
    [0, 0.34].forEach((o) => {
      this.tone(587.33, t + o, 0.14, 'square', 0.05, 0.3);
      this.tone(587.33, t + o, 0.14, 'sine', 0.14, 0.3);
      this.tone(880, t + o + 0.15, 0.16, 'square', 0.05, 0.3);
      this.tone(880, t + o + 0.15, 0.16, 'sine', 0.14, 0.3);
    });
    this.tone(146.83, t, 0.7, 'sine', 0.16, 0.2);
    this.noise(t + 0.1, 0.5, 0.04, 'highpass', 5000, 9000);
  }

  /** Round 17: overtime starts. A rising three-note horn over a duck, then a snare roll into the top layer. */
  overtimeHorn(): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.duck(0.4, t, 0.8, 0.5, 'rush');
    [587.33, 739.99, 987.77].forEach((f, i) => {
      this.tone(f, t + i * 0.13, 0.12, 'square', 0.05, 0.25);
      this.tone(f, t + i * 0.13, 0.12, 'sine', 0.13, 0.25);
    });
    this.tone(987.77 * 1.5, t + 0.42, 0.35, 'square', 0.04, 0.3);
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
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.tone(987.77, t + 0.05, 0.08, 'square', 0.04, 0.2);
    this.tone(1318.5, t + 0.15, 0.12, 'square', 0.045, 0.3);
  }

  tick(urgent: boolean): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.tone(urgent ? 1480 : 1175, t, 0.07, 'square', urgent ? 0.06 : 0.045, 0.1);
  }

  click(): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.tone(880, t, 0.06, 'triangle', 0.08, 0.1);
  }

  /**
   * Medal won: a short three-note fanfare (a soft brass-like square plus a sine body) that ends on a held chord with
   * a bell shimmer. Each higher medal starts a whole tone higher and adds one bell. `delay` lines it up with the banner.
   */
  medal(tier: number, delay = 0): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime + delay;
    // the music drops ~11 dB under the fanfare and its bells, then comes back
    this.duck(0.28, t - 0.03, 1.25, 0.7, 'medal');
    this.fanWin = { from: t, to: t + 1.2, sfxPeak: 0, sfxSum: 0, musSum: 0, n: 0, preDb: this.meter.musicOpenDb };
    const lift = Math.pow(2, ((Math.min(tier, 4) - 1) * 2) / 12);
    const motif = [392, 523.25, 659.25];
    motif.forEach((n, i) => {
      const dur = i === 2 ? 1.1 : 0.16;
      this.tone(n * lift, t + i * 0.12, dur, 'square', 0.035, 0.4);
      this.tone(n * lift, t + i * 0.12, dur, 'sine', 0.16, 0.5);
    });
    this.tone(783.99 * lift, t + 0.24, 1.1, 'sine', 0.1, 0.6);
    this.tone(196 * lift, t + 0.24, 0.9, 'sine', 0.18, 0.2);
    const bells = [2093, 2637, 3136, 4186];
    for (let i = 0; i < Math.min(tier, 4); i++) this.tone(bells[i] * lift * 0.5, t + 0.32 + i * 0.07, 0.6, 'sine', 0.05, 0.7);
    this.noise(t + 0.24, 0.7, 0.04, 'highpass', 6000, 11000);
  }

  /** Time's up: a falling sting with no medal; with a medal a rising C major cadence with one bell per tier. */
  gameOver(tier = 0): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.duck(0.35, t, 1.0, 0.8, 'gameover');
    // Round 11: the sting is 2.3 dB louder (x1.3) so it stays well clear of the louder music
    if (tier <= 0) {
      [523.25, 415.3, 349.23, 261.63].forEach((n, i) => this.tone(n, t + i * 0.16, 0.7, 'triangle', 0.18));
      return;
    }
    [392, 523.25, 659.25].forEach((n, i) => this.tone(n, t + i * 0.12, 0.3, 'triangle', 0.17));
    [523.25, 659.25, 783.99].forEach((n) => this.tone(n, t + 0.36, 1.3, 'sine', 0.12, 0.5));
    this.tone(130.81, t + 0.36, 1.1, 'sine', 0.2, 0.2);
    const bells = [2093, 2637, 3136, 4186];
    for (let i = 0; i < Math.min(tier, 4); i++) this.tone(bells[i] * 0.5, t + 0.44 + i * 0.09, 0.7, 'sine', 0.045, 0.7);
  }

  start(): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    [392, 523.25, 659.25, 783.99].forEach((n, i) => this.tone(n, t + i * 0.06, 0.4, 'triangle', 0.1));
  }

  // =====================================================================================================
  // Music: a step sequencer on the audio clock (lookahead scheduler), one gain bus per layer, ducking.
  // =====================================================================================================

  private buildMusic(): void {
    const ctx = this.ctx!;
    // layers -> highpass 55 Hz -> lowpass 6.5 kHz -> scene fade -> duck -> on/off & level -> master
    this.musicOut = ctx.createGain();
    this.musicOut.gain.value = this.musicEnabled ? MUSIC_VOL : 0;
    this.musicOut.connect(this.master);
    this.duckGain = ctx.createGain();
    this.duckGain.connect(this.musicOut);
    this.musicFade = ctx.createGain();
    this.musicFade.gain.value = 0;
    this.musicFade.connect(this.duckGain);
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 6500;
    tone.Q.value = 0.5;
    tone.connect(this.musicFade);
    const lowCut = ctx.createBiquadFilter();
    lowCut.type = 'highpass';
    lowCut.frequency.value = 55;
    lowCut.connect(tone);

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
    this.padFilter.connect(this.bus.pad);
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

    this.timer = window.setInterval(this.musicTick, TICK_MS);
    if (this.scene !== 'off') this.startScene('off');
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

  private startScene(prev: MusicScene): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    if (this.scene === 'final' && prev === 'run') {
      // same groove, new harmony: the change lands on the next beat
      this.step = -((4 - (this.step % 4)) % 4);
    } else {
      const fade = this.musicFade.gain;
      fade.cancelScheduledValues(now);
      fade.setValueAtTime(fade.value, now);
      // a straight ramp to exactly 0 (no exponential tail that a later setValueAtTime would cut off with a step)
      const gap = prev === 'off' ? 0.06 : this.scene === 'run' ? 0.24 : 0.14;
      fade.linearRampToValueAtTime(0, now + 0.04);
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
  setRunState(chain: number, timeLeft: number, chase: boolean): void {
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
      const skip = Math.ceil((now + 0.05 - this.nextStep) / STEP);
      this.nextStep += skip * STEP;
      this.step += skip;
    }
  }

  private readonly musicTick = (): void => {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.musicEnabled || this.scene === 'off') return;
    const now = ctx.currentTime;
    if (this.nextStep < now - 0.25) {
      // the timer was starved (hidden tab, long stall): skip ahead on the grid instead of firing a burst of notes
      const skip = Math.ceil((now + 0.03 - this.nextStep) / STEP);
      this.nextStep += skip * STEP;
      this.step += skip;
      this.resyncs++;
    }
    const horizon = now + LOOKAHEAD;
    while (this.nextStep < horizon) {
      if (this.nextStep < now) this.late++;
      if (this.step >= 0) this.playStep(this.step, Math.max(this.nextStep, now));
      this.nextStep += STEP;
      this.step++;
    }
  };

  private playStep(step: number, t: number): void {
    const s = step % 16;
    const bar = Math.floor(step / 16);
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
    const lv = this.chainLv;
    const layer = sc === 'title' || sc === 'over' ? 1 : sc === 'run' ? 1 + lv : sc === 'final' ? 5 : 0;
    const section =
      sc === 'title' ? 'loop'
      : sc === 'run' ? ['base', 'drums', 'arp', 'lead'][lv]
      : sc === 'final' ? 'final'
      : sc === 'over' ? ['calm', 'bronze', 'silver', 'gold', 'ace'][Math.min(4, this.overTier)]
      : 'off';
    const r = (v: number) => Math.round(v * 1000) / 1000;
    return {
      enabled: this.musicEnabled,
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
      bpm: BPM,
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
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }
}
