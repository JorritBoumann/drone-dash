/**
 * Round 46: "Breakbeat", the alternative procedural soundtrack (the owner compares it with "Classic", see music.ts).
 *
 * A bright liquid drum and bass / arcade breakbeat at 168 BPM in F Dorian: ninth and thirteenth chords on a Rhodes-style
 * FM electric piano with a stereo tremolo, a sine sub plus a filtered soft-saw bass (kept low and filtered so the rotor
 * keeps its band), a crisp breakbeat kit (punchy kick, snappy snare with a noise tail, shuffled 16th hats, ghost snares,
 * ride, crash), soft-saw plucks, a pentatonic lead and brass-like stabs.
 *
 * Form (run): 32 bars = four 8-bar sections (one chord per 2 bars). The drum, bass and keys variants cycle every 3
 * sections, so the run only repeats exactly after 12 sections = 96 bars = 137 s.
 * Layers follow the game (latched on the bar, so every change lands on a downbeat):
 * - chain x0: drums (kick, snare, 8th hats), sub, keys (filter closed), a quiet saw bass
 * - chain x1: shuffled 16th hats and shaker, keys filter open, fuller saw bass
 * - chain x2: ghost snares, pluck arpeggio, crash on each section
 * - chain x3: lead and ride
 * - rush hour: brass stabs and extra fills
 * - last 10 s: the bass filter closes, the sub thins, a snare roll builds (8ths, 16ths, 32nds) with a noise riser
 * - overtime: the drop (crash, full groove with the lead on the home vamp)
 * - title: a gentle half-time loop; game over: a warm half-time loop whose colour follows the medal
 *
 * Everything is scheduled by AudioSystem's lookahead scheduler. Per note only the sources and their envelope gains are
 * new; filters, tremolo, panners and buses are shared and built once. Every one-shot graph is disconnected on `ended`.
 */
import { midi } from './music';

export const BB_BPM = 168;
export const BB_STEP = 60 / BB_BPM / 4; // 0.0893 s

export interface BChord {
  name: string;
  /** bass root (midi, octave 2: 65 to 123 Hz) */
  bass: number;
  /** Rhodes voicing (rootless ninth / thirteenth voicings around middle C) */
  keys: number[];
  /** four chord tones, ascending inside one octave, no semitone between neighbours or across the octave (chimes and plucks) */
  arp: number[];
}

const Fm9: BChord = { name: 'Fm9', bass: 41, keys: [56, 60, 63, 67], arp: [65, 68, 72, 75] };
const Bb13: BChord = { name: 'Bb13', bass: 46, keys: [56, 60, 62, 67], arp: [65, 68, 72, 74] };
const Eb9: BChord = { name: 'Ebmaj9', bass: 39, keys: [55, 58, 62, 65], arp: [67, 70, 74, 77] };
const Ab9: BChord = { name: 'Abmaj9', bass: 44, keys: [55, 58, 60, 63], arp: [67, 70, 72, 75] };
const Db9: BChord = { name: 'Dbmaj9', bass: 37, keys: [53, 56, 60, 63], arp: [65, 68, 72, 75] };
const C9sus: BChord = { name: 'C9sus', bass: 36, keys: [53, 58, 62, 67], arp: [65, 67, 70, 72] };

/** Run: four 8-bar sections, one chord per 2 bars. */
export const BB_RUN: BChord[][] = [
  [Fm9, Bb13, Fm9, Bb13],
  [Db9, Eb9, Fm9, Ab9],
  [Fm9, Bb13, Ab9, Db9],
  [Ab9, Eb9, Db9, Eb9],
];
/** Last 10 s: one chord a bar, climbing to a suspended dominant that never resolves until the drop. */
export const BB_FINAL: BChord[] = [Db9, Eb9, Fm9, C9sus];
/** Overtime drop: the home vamp, one chord per 2 bars. */
export const BB_DROP: BChord[] = [Fm9, Bb13];
/** Title: one chord per 2 bars. */
export const BB_TITLE: BChord[] = [Ab9, Db9, Fm9, Bb13];
/** Game over: warm with a medal (Ab major colour), wistful but bright without. One chord per 2 bars. */
export const BB_OVER_MEDAL: BChord[] = [Ab9, Db9, Bb13, Eb9];
export const BB_OVER_NONE: BChord[] = [Fm9, Db9, Ab9, Eb9];

interface DrumVar { kick: number[]; ghost: number[]; bass: number[][]; keys: number[][][] }
/** Three groove variants (one per section, cycling every 3 sections). bass: [step, length, interval]; keys: two bars of [step, length, velocity]. */
const VARS: DrumVar[] = [
  {
    kick: [0, 10],
    ghost: [7, 15],
    bass: [[0, 3, 0], [3, 3, 0], [6, 2, 12], [10, 4, 0], [14, 2, 7]],
    keys: [[[0, 7, 1], [7, 3, 0.6], [10, 6, 0.85]], [[2, 4, 0.7], [6, 4, 0.8], [10, 6, 0.75]]],
  },
  {
    kick: [0, 6, 10],
    ghost: [2, 9, 15],
    bass: [[0, 6, 0], [6, 2, 0], [8, 2, 12], [10, 6, 0]],
    keys: [[[0, 10, 1], [10, 3, 0.7], [14, 2, 0.55]], [[0, 6, 0.8], [6, 4, 0.75], [12, 4, 0.7]]],
  },
  {
    kick: [0, 10, 13],
    ghost: [7, 11, 14],
    bass: [[0, 2, 0], [3, 3, 0], [7, 3, 0], [10, 3, 12], [13, 3, 7]],
    keys: [[[0, 6, 1], [6, 6, 0.75], [14, 2, 0.6]], [[2, 6, 0.8], [10, 6, 0.85]]],
  },
];
/** 16th hat velocities (accents on the off-8ths, the liquid "tss"). */
const HAT16 = [0.45, 0.22, 1, 0.3, 0.45, 0.22, 1, 0.35, 0.45, 0.22, 1, 0.3, 0.45, 0.3, 1, 0.4];
/** Pluck arpeggio orders (index into the chord's arp tones), one per section. */
const ARPS = [
  [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 3, 1, 2],
  [0, 2, 1, 3, 0, 2, 1, 3, 2, 3, 1, 2, 0, 1, 2, 3],
  [3, 2, 1, 0, 1, 2, 3, 2, 0, 1, 3, 1, 2, 1, 0, 1],
];
/** F minor pentatonic (F Ab Bb C Eb); lead degree d -> PENTA[d % 5] + 12 * floor(d / 5). */
const PENTA = [65, 68, 70, 72, 75];
/** Four 2-bar lead motifs: [step (0..31), degree, length in steps]. */
const MOTIFS: number[][][] = [
  [[0, 5, 3], [3, 6, 3], [6, 7, 4], [10, 6, 2], [12, 5, 4], [18, 4, 2], [20, 5, 6], [28, 3, 4]],
  [[0, 7, 2], [2, 8, 2], [4, 7, 4], [8, 6, 2], [10, 5, 6], [16, 6, 3], [19, 5, 3], [22, 4, 10]],
  [[2, 5, 2], [4, 5, 2], [6, 6, 2], [8, 7, 6], [14, 8, 2], [16, 9, 6], [24, 8, 2], [26, 7, 6]],
  [[0, 8, 6], [6, 7, 2], [8, 6, 2], [10, 5, 4], [14, 4, 2], [16, 5, 10], [28, 3, 4]],
];

export type BeatScene = 'title' | 'run' | 'final' | 'over';

/** What the game is doing, read on every step and latched on the bar. */
export interface BeatState { chain: number; chase: boolean; rush: boolean; overtime: boolean; tier: number }

/** What the soundtrack needs from AudioSystem. */
export interface BeatHost {
  ctx: AudioContext;
  /** the music chain input (after it: low cut, tone, scene fade, lift, duck, on/off, music bus) */
  input: AudioNode;
  noise: AudioBuffer;
  softSaw: PeriodicWave | null;
  /** disconnect `nodes` when `src` ends (one-shot clean-up) */
  reap(src: AudioScheduledSourceNode, nodes: AudioNode[]): void;
  /** count one scheduled note (diagnostics) */
  note(): void;
}

/** Chord for a scene at a bar (also the chime source while Breakbeat plays). */
export function bbChord(scene: BeatScene, bar: number, tier: number, overtime: boolean, dropBar: number): BChord {
  const b = Math.max(0, bar);
  if (scene === 'run') return BB_RUN[Math.floor(b / 8) % 4][Math.floor((b % 8) / 2)];
  if (scene === 'final') return overtime && dropBar >= 0 && b >= dropBar ? BB_DROP[Math.floor((b - dropBar) / 2) % 2] : BB_FINAL[b % 4];
  if (scene === 'title') return BB_TITLE[Math.floor(b / 2) % 4];
  return (tier > 0 ? BB_OVER_MEDAL : BB_OVER_NONE)[Math.floor(b / 2) % 4];
}

export class Breakbeat {
  private readonly h: BeatHost;
  readonly out: GainNode;
  private readonly drums: GainNode;
  private readonly hatHp: BiquadFilterNode;
  private readonly shakerBp: BiquadFilterNode;
  private readonly rideBp: BiquadFilterNode;
  private readonly crashHp: BiquadFilterNode;
  private readonly snareBp: BiquadFilterNode;
  private readonly sub: GainNode;
  private readonly bassLp: BiquadFilterNode;
  private readonly keysLp: BiquadFilterNode;
  private readonly keysIn: GainNode;
  private readonly arpLp: BiquadFilterNode;
  private readonly lead: GainNode;
  private readonly stabs: GainNode;
  private readonly echoIn: GainNode;
  private readonly lfos: OscillatorNode[] = [];
  // latched on the bar
  private lv = 0;
  private chase = false;
  private rush = false;
  private overtime = false;
  /** the bar the overtime drop started on (-1: none yet in this scene) */
  dropBar = -1;
  /** latched layer state for diagnostics */
  latched = { lv: 0, rush: false, overtime: false };

  constructor(h: BeatHost) {
    this.h = h;
    const ctx = h.ctx;
    const gain = (v: number, to: AudioNode | AudioParam): GainNode => {
      const g = ctx.createGain();
      g.gain.value = v;
      if (to instanceof AudioNode) g.connect(to);
      else g.connect(to);
      return g;
    };
    const filt = (type: BiquadFilterType, f: number, q: number, to: AudioNode): BiquadFilterNode => {
      const b = ctx.createBiquadFilter();
      b.type = type;
      b.frequency.value = f;
      b.Q.value = q;
      b.connect(to);
      return b;
    };
    this.out = gain(1, h.input);
    // drums
    this.drums = gain(1, this.out);
    this.hatHp = filt('highpass', 7600, 0.7, this.drums);
    this.shakerBp = filt('bandpass', 6200, 1.4, this.drums);
    this.rideBp = filt('bandpass', 5400, 1.1, this.drums);
    this.crashHp = filt('highpass', 3800, 0.6, this.drums);
    this.snareBp = filt('bandpass', 3000, 0.55, this.drums);
    // bass: a sine sub and a soft saw through a lowpass that follows the chain (and closes in the last 10 s)
    this.sub = gain(1, this.out);
    this.bassLp = filt('lowpass', 420, 2.2, gain(1, this.out));
    // keys: FM Rhodes -> lowpass (opens with the chain) -> stereo tremolo (gain LFO + pan LFO)
    const keysPan = ctx.createStereoPanner();
    keysPan.connect(this.out);
    const trem = ctx.createGain();
    trem.gain.value = 0.82;
    trem.connect(keysPan);
    const tl = ctx.createOscillator();
    tl.frequency.value = 4.6;
    const tlg = gain(0.16, trem.gain);
    tl.connect(tlg);
    const pl = ctx.createOscillator();
    pl.frequency.value = 2.3;
    const plg = gain(0.32, keysPan.pan);
    pl.connect(plg);
    this.keysLp = filt('lowpass', 1500, 0.6, trem);
    this.keysIn = gain(1, this.keysLp);
    // dotted-eighth echo for plucks and lead, darker each repeat, slightly wide
    this.echoIn = ctx.createGain();
    this.echoIn.gain.value = 0.3;
    const dl = ctx.createDelay(1);
    dl.delayTime.value = BB_STEP * 3;
    const elp = ctx.createBiquadFilter();
    elp.type = 'lowpass';
    elp.frequency.value = 2600;
    elp.Q.value = 0.5;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const ePan = ctx.createStereoPanner();
    ePan.pan.value = 0.35;
    this.echoIn.connect(dl).connect(elp);
    elp.connect(fb).connect(dl);
    elp.connect(ePan).connect(this.out);
    // plucks, lead, stabs
    const arpBus = gain(1, this.out);
    arpBus.connect(this.echoIn);
    this.arpLp = filt('lowpass', 2600, 2.5, arpBus);
    this.lead = gain(1, this.out);
    this.lead.connect(this.echoIn);
    const leadPan = ctx.createStereoPanner();
    this.stabs = gain(1, leadPan);
    leadPan.pan.value = -0.12;
    leadPan.connect(this.out);
    for (const o of [tl, pl]) {
      o.start();
      this.lfos.push(o);
    }
  }

  /** Called at a scene start (the scheduler's step restarts at 0). */
  reset(): void {
    this.dropBar = -1;
  }

  /** One 16th step. `bar` counts from the scene start; `t` is the step's audio-clock time. */
  step(scene: BeatScene, bar: number, s: number, t: number, st: BeatState): void {
    if (s === 0) {
      this.lv = Math.max(0, Math.min(3, st.chain));
      this.chase = st.chase;
      this.rush = st.rush;
      if (st.overtime && !this.overtime && scene === 'final') this.dropBar = bar;
      this.overtime = st.overtime;
      this.latched = { lv: this.lv, rush: this.rush, overtime: this.overtime };
      this.barStart(scene, bar, t, st);
    }
    if (scene === 'run') this.groove(bar, s, t, this.lv, this.rush, this.chase, bbChord('run', bar, 0, false, -1), Math.floor(bar / 8));
    else if (scene === 'final') {
      if (this.overtime && this.dropBar >= 0) this.groove(bar - this.dropBar, s, t, 3, true, false, bbChord('final', bar, 0, true, this.dropBar), 0, true);
      else this.finalStep(bar, s, t);
    } else if (scene === 'title') this.titleStep(bar, s, t);
    else this.overStep(bar, s, t, st.tier);
  }

  /** Filter moves on the downbeat (keys open with the chain, the bass closes in the last 10 s). */
  private barStart(scene: BeatScene, bar: number, t: number, st: BeatState): void {
    const k = this.keysLp.frequency, b = this.bassLp.frequency, sg = this.sub.gain;
    let keys = 1500, bass = 420, sub = 1;
    if (scene === 'run') {
      keys = [1500, 3200, 3600, 4200][this.lv];
      bass = [300, 480, 620, 700][this.lv];
    } else if (scene === 'final') {
      if (this.overtime && this.dropBar >= 0) {
        keys = 4200;
        bass = 760;
      } else {
        // the bass filter closes bar by bar and the sub thins: the floor drops out before the drop
        const p = Math.min(1, bar / 6);
        keys = 3000;
        bass = 620 * Math.pow(0.25, p);
        sub = 1 - 0.6 * p;
      }
    } else if (scene === 'title') {
      keys = 2200;
      bass = 260;
    } else {
      keys = st.tier > 0 ? 2600 : 2000;
      bass = 260;
    }
    k.setTargetAtTime(keys, t, 0.35);
    b.setTargetAtTime(bass, t, scene === 'final' ? 0.6 : 0.25);
    sg.setTargetAtTime(sub, t, 0.4);
  }

  /** The run groove (and the overtime drop). `sec` picks the variant (cycles every 3 sections). */
  private groove(bar: number, s: number, t: number, lv: number, rush: boolean, chase: boolean, ch: BChord, sec: number, drop = false): void {
    const v = VARS[sec % 3];
    const inSec = bar % 8;
    const fill = inSec === 7;
    const half = inSec === 3;
    const slotBar = bar % 2;
    // drums
    if (v.kick.includes(s) && !(fill && s >= 12)) this.kick(t, s === 0 ? 0.31 : 0.26);
    if (s === 4 || (s === 12 && !fill)) this.snare(t, 0.3, 0.2);
    if (fill && s >= 12) this.snare(t, 0.12 + (s - 12) * 0.05, 0.12);
    if (fill && s === 14 && lv >= 1) this.kick(t, 0.27);
    if ((half || (rush && inSec === 5)) && (s === 14 || s === 15)) this.snare(t, 0.09 + (s - 14) * 0.04, 0.1);
    if (lv >= 2 && v.ghost.includes(s) && !(fill && s >= 12)) this.snare(t, 0.055, 0.07);
    if (lv >= 1) {
      this.hat(t + (s % 2 ? BB_STEP * 0.14 : 0), 0.11 * HAT16[s], 0.045);
      if (s % 2 === 1) this.shaker(t + BB_STEP * 0.1, 0.04);
    } else if (s % 2 === 0) this.hat(t, s % 4 === 2 ? 0.085 : 0.035, 0.04);
    if (chase && (s === 6 || s === 14)) this.hat(t, 0.06, 0.16);
    if (lv >= 3 && s % 4 === 0) this.ride(t, s === 0 ? 0.075 : 0.055);
    if (inSec === 0 && s === 0 && (lv >= 2 || drop) && (bar > 0 || drop)) this.crash(t, drop && bar === 0 ? 0.09 : 0.055);
    // sub: one long note per kick (follows the kick, never overlapping)
    const ks = v.kick;
    const ki = ks.indexOf(s);
    if (ki >= 0) {
      const next = ki + 1 < ks.length ? ks[ki + 1] : 16;
      this.subNote(t, midi(ch.bass), (next - s) * BB_STEP, 0.052);
    }
    // saw bass riff
    for (const [bs, len, iv] of v.bass) {
      if (bs === s) this.bassNote(t, midi(ch.bass + 12 + iv), len * BB_STEP * 0.9, lv >= 1 ? 0.06 : 0.045);
    }
    // keys
    for (const [ks2, len, vel] of v.keys[slotBar]) {
      if (ks2 === s) this.chord(ch.keys, t, len * BB_STEP, 0.105 * vel);
    }
    // plucks (x2): 8ths plus a syncopated 16th, 16ths in the drop
    if (lv >= 2) {
      const order = ARPS[sec % 3];
      if (s % 2 === 0 || s % 4 === 3 || drop) this.pluck(t, midi(ch.arp[order[s]] + (s >= 8 && slotBar === 1 ? 12 : 0)), lv >= 3 ? 0.05 : 0.065);
    }
    // lead (x3)
    if (lv >= 3) {
      const m = MOTIFS[((sec % 4) + Math.floor((bar % 8) / 2)) % 4];
      const s32 = slotBar * 16 + s;
      for (const [ms, deg, len] of m) {
        if (ms === s32) this.leadNote(t, midi(this.fit(PENTA[deg % 5] + 12 * Math.floor(deg / 5), ch)), len * BB_STEP * 0.92, 0.065);
      }
    }
    // rush hour: brass stabs on the push beats
    if (rush && (s === 3 || s === 10) && (bar % 2 === 0 || s === 10)) this.stab(ch, t, 0.03);
  }

  /** Last 10 s: kick on the quarters, a snare roll that doubles every two bars, a riser, the bass filter closing. */
  private finalStep(bar: number, s: number, t: number): void {
    const ch = BB_FINAL[bar % 4];
    if (s === 0) this.chord(ch.keys, t, 15 * BB_STEP, 0.095);
    if (s === 10) this.stab(ch, t, 0.026);
    if (s % 4 === 0 && bar < 6) this.kick(t, 0.32);
    if (s === 0) this.subNote(t, midi(ch.bass), 16 * BB_STEP, 0.06);
    if (s % 4 === 0 || s % 4 === 3) this.bassNote(t, midi(ch.bass + 12 + (s % 8 === 4 ? 12 : 0)), BB_STEP * 2, 0.055);
    this.hat(t + (s % 2 ? BB_STEP * 0.14 : 0), 0.08 * HAT16[s], 0.03);
    const stage = Math.min(3, Math.floor(bar / 2));
    const g = Math.min(0.32, 0.08 + bar * 0.035 + (s / 16) * 0.035);
    if (stage === 0 ? s % 2 === 0 : true) this.snare(t, g, 0.09);
    if (stage >= 2) this.snare(t + BB_STEP / 2, g * 0.8, 0.07);
    if (s === 0 && bar % 4 === 0) this.riser(t, 4 * 16 * BB_STEP, 0.045);
    this.pluck(t, midi(ch.arp[ARPS[0][s]] + 12), 0.03);
  }

  /** Title: a gentle half-time loop (Rhodes, sub, brushed kit, a slow pluck line). */
  private titleStep(bar: number, s: number, t: number): void {
    const ch = BB_TITLE[Math.floor(bar / 2) % 4];
    const two = (bar % 2) * 16 + s;
    if (two === 0) this.chord(ch.keys, t, 13 * BB_STEP, 0.11);
    if (two === 14) this.chord(ch.keys, t, 4 * BB_STEP, 0.065);
    if (two === 16) this.chord(ch.keys, t, 10 * BB_STEP, 0.09);
    if (two === 26) this.chord(ch.keys, t, 6 * BB_STEP, 0.075);
    if (s === 0) this.subNote(t, midi(ch.bass), 15 * BB_STEP, 0.04);
    if (s === 0 || (s === 10 && bar % 2 === 1)) this.kick(t, 0.2);
    if (s === 8) this.snare(t, 0.11, 0.14);
    if (s % 2 === 0) this.shaker(t + (s % 4 === 2 ? BB_STEP * 0.12 : 0), s % 4 === 2 ? 0.045 : 0.024);
    const line = [0, -1, 2, -1, 1, -1, 3, 2, -1, -1, 1, -1, 2, -1, -1, -1];
    if (s % 2 === 0) {
      const i = line[(two / 2) | 0];
      if (i >= 0) this.pluck(t, midi(ch.arp[i] + 12), 0.05);
    }
  }

  /** Game over: a warm half-time loop; a better medal adds climbing bells and a slow lead. */
  private overStep(bar: number, s: number, t: number, tier: number): void {
    const ch = (tier > 0 ? BB_OVER_MEDAL : BB_OVER_NONE)[Math.floor(bar / 2) % 4];
    const two = (bar % 2) * 16 + s;
    if (two === 0) this.chord(ch.keys, t, 15 * BB_STEP, 0.11);
    if (two === 16) this.chord(ch.keys, t, 10 * BB_STEP, 0.09);
    if (two === 26) this.chord(ch.keys, t, 6 * BB_STEP, 0.075);
    if (s === 0) this.subNote(t, midi(ch.bass), 15 * BB_STEP, 0.045);
    if (s === 0 || (s === 10 && bar % 2 === 0)) this.kick(t, 0.24);
    if (s === 8) this.snare(t, 0.16, 0.2);
    if (s % 4 === 2) this.hat(t, 0.05, 0.05);
    if (tier >= 1 && two < 16 && two % 4 === 0) this.pluck(t, midi(ch.arp[two / 4] + 12), 0.032);
    if (tier >= 2 && two >= 16 && two % 4 === 0) this.pluck(t, midi(ch.arp[3 - (two - 16) / 4] + 12), 0.027);
    if (tier >= 3 && bar % 2 === 1 && s === 4) this.leadNote(t, midi(this.fit(PENTA[(bar >> 1) % 5] + 12, ch)), 8 * BB_STEP, 0.04);
  }

  /** Move a lead note a semitone down onto the chord when it would sit a minor ninth over a chord tone. */
  private fit(m: number, ch: BChord): number {
    const pcs = new Set([ch.bass, ...ch.keys].map((n) => ((n % 12) + 12) % 12));
    const pc = ((m % 12) + 12) % 12;
    return !pcs.has(pc) && pcs.has((pc + 11) % 12) ? m - 1 : m;
  }

  // ------------------------------------------------------------------ voices

  private env(): GainNode {
    const g = this.h.ctx.createGain();
    g.gain.value = 0;
    return g;
  }

  private noiseSrc(t: number, dur: number): AudioBufferSourceNode {
    const src = this.h.ctx.createBufferSource();
    src.buffer = this.h.noise;
    src.start(t, ((t * 7.31) % 1.5 + 1.5) % 1.5);
    src.stop(t + dur + 0.02);
    return src;
  }

  private kick(t: number, gain: number): void {
    const ctx = this.h.ctx;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(170, t);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.09);
    const g = this.env();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.002);
    g.gain.setValueAtTime(gain, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.32);
    o.connect(g).connect(this.drums);
    o.start(t);
    o.stop(t + 0.34);
    this.h.reap(o, [o, g]);
    // the beater click
    const n = this.noiseSrc(t, 0.012);
    const ng = this.env();
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(gain * 0.35, t + 0.001);
    ng.gain.exponentialRampToValueAtTime(0.0005, t + 0.012);
    n.connect(ng).connect(this.snareBp);
    this.h.reap(n, [n, ng]);
    this.h.note();
  }

  /** Snare: a short pitched body plus a band of noise with a tail of `tail` s. */
  private snare(t: number, gain: number, tail: number): void {
    const ctx = this.h.ctx;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(200, t);
    o.frequency.exponentialRampToValueAtTime(165, t + 0.06);
    const g = this.env();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain * 0.55, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.09);
    o.connect(g).connect(this.drums);
    o.start(t);
    o.stop(t + 0.1);
    this.h.reap(o, [o, g]);
    const n = this.noiseSrc(t, tail);
    const ng = this.env();
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(gain, t + 0.0015);
    ng.gain.exponentialRampToValueAtTime(gain * 0.25, t + 0.03);
    ng.gain.exponentialRampToValueAtTime(0.0005, t + tail);
    n.connect(ng).connect(this.snareBp);
    this.h.reap(n, [n, ng]);
    this.h.note();
  }

  private noiseHit(dest: AudioNode, t: number, gain: number, dur: number, att = 0.0015): void {
    const n = this.noiseSrc(t, dur);
    const g = this.env();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + att);
    g.gain.exponentialRampToValueAtTime(0.0004, t + dur);
    n.connect(g).connect(dest);
    this.h.reap(n, [n, g]);
    this.h.note();
  }

  private hat(t: number, gain: number, dur: number): void {
    this.noiseHit(this.hatHp, t, gain, dur);
  }

  private shaker(t: number, gain: number): void {
    this.noiseHit(this.shakerBp, t, gain, 0.05, 0.008);
  }

  private ride(t: number, gain: number): void {
    this.noiseHit(this.rideBp, t, gain, 0.42, 0.002);
    // the bell's ping
    const ctx = this.h.ctx;
    const o = ctx.createOscillator();
    o.frequency.value = 2960;
    const g = this.env();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain * 0.12, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0003, t + 0.4);
    o.connect(g).connect(this.drums);
    o.start(t);
    o.stop(t + 0.42);
    this.h.reap(o, [o, g]);
  }

  private crash(t: number, gain: number): void {
    this.noiseHit(this.crashHp, t, gain, 1.6, 0.003);
  }

  /** Noise riser: a highpass sweeping up while it swells, cut on the downbeat it leads to. */
  private riser(t: number, dur: number, gain: number): void {
    const ctx = this.h.ctx;
    const n = this.noiseSrc(t, dur);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.4;
    f.frequency.setValueAtTime(500, t);
    f.frequency.exponentialRampToValueAtTime(7000, t + dur);
    const g = this.env();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + dur - 0.03);
    g.gain.linearRampToValueAtTime(0, t + dur);
    n.connect(f).connect(g).connect(this.drums);
    this.h.reap(n, [n, f, g]);
  }

  private subNote(t: number, f: number, dur: number, gain: number): void {
    const ctx = this.h.ctx;
    const o = ctx.createOscillator();
    o.frequency.value = f;
    const g = this.env();
    const a = Math.min(0.012, dur * 0.2), r = Math.min(0.04, dur * 0.3);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + a);
    g.gain.setValueAtTime(gain, t + dur - r);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(this.sub);
    o.start(t);
    o.stop(t + dur + 0.02);
    this.h.reap(o, [o, g]);
    this.h.note();
  }

  private bassNote(t: number, f: number, dur: number, gain: number): void {
    const ctx = this.h.ctx;
    const o = ctx.createOscillator();
    if (this.h.softSaw) o.setPeriodicWave(this.h.softSaw);
    else o.type = 'sawtooth';
    o.frequency.value = f;
    const g = this.env();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(gain * 0.55, t + Math.max(0.01, dur * 0.7));
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(this.bassLp);
    o.start(t);
    o.stop(t + dur + 0.02);
    this.h.reap(o, [o, g]);
    this.h.note();
  }

  /** Rhodes chord: one FM tine voice per note (carrier + ratio-1 modulator with a falling index). */
  private chord(notes: number[], t: number, dur: number, gain: number): void {
    for (let i = 0; i < notes.length; i++) this.rhodes(midi(notes[i]), t + i * 0.004, dur, gain);
  }

  private rhodes(f: number, t: number, dur: number, gain: number): void {
    const ctx = this.h.ctx;
    const car = ctx.createOscillator();
    car.frequency.value = f;
    const mod = ctx.createOscillator();
    mod.frequency.value = f;
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(f * 1.5, t);
    mg.gain.exponentialRampToValueAtTime(f * 0.12, t + 0.35);
    mod.connect(mg).connect(car.frequency);
    const g = this.env();
    const end = t + dur + 0.12;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(gain * 0.4, t + Math.max(0.02, Math.min(0.6, dur * 0.8)));
    g.gain.linearRampToValueAtTime(0, end);
    car.connect(g).connect(this.keysIn);
    for (const o of [car, mod]) {
      o.start(t);
      o.stop(end + 0.02);
    }
    this.h.reap(car, [car, mod, mg, g]);
    this.h.note();
  }

  private pluck(t: number, f: number, gain: number): void {
    const ctx = this.h.ctx;
    const o = ctx.createOscillator();
    if (this.h.softSaw) o.setPeriodicWave(this.h.softSaw);
    else o.type = 'triangle';
    o.frequency.value = f;
    const g = this.env();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0004, t + 0.2);
    o.connect(g).connect(this.arpLp);
    o.start(t);
    o.stop(t + 0.22);
    this.h.reap(o, [o, g]);
    this.h.note();
  }

  private leadNote(t: number, f: number, dur: number, gain: number): void {
    const ctx = this.h.ctx;
    const a = ctx.createOscillator();
    a.frequency.setValueAtTime(f * 0.985, t);
    a.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    const b = ctx.createOscillator();
    if (this.h.softSaw) b.setPeriodicWave(this.h.softSaw);
    else b.type = 'triangle';
    b.frequency.setValueAtTime(f * 0.985, t);
    b.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    b.detune.value = 6;
    const bg = ctx.createGain();
    bg.gain.value = 0.28;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    const g = this.env();
    const r = Math.min(0.08, dur * 0.3);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.setValueAtTime(gain * 0.85, t + dur - r);
    g.gain.linearRampToValueAtTime(0, t + dur);
    a.connect(g);
    b.connect(bg).connect(lp).connect(g);
    g.connect(this.lead);
    for (const o of [a, b]) {
      o.start(t);
      o.stop(t + dur + 0.02);
    }
    this.h.reap(a, [a, b, bg, lp, g]);
    this.h.note();
  }

  /** Brass-like stab: the chord's top three keys an octave up, two detuned soft saws each, a filter blip. */
  private stab(ch: BChord, t: number, gain: number): void {
    const ctx = this.h.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 1.1;
    f.frequency.setValueAtTime(600, t);
    f.frequency.exponentialRampToValueAtTime(3200, t + 0.03);
    f.frequency.exponentialRampToValueAtTime(900, t + 0.2);
    const g = this.env();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.24);
    f.connect(g).connect(this.stabs);
    const oscs: OscillatorNode[] = [];
    for (const n of ch.keys.slice(1)) {
      for (const d of [-8, 8]) {
        const o = ctx.createOscillator();
        if (this.h.softSaw) o.setPeriodicWave(this.h.softSaw);
        else o.type = 'sawtooth';
        o.frequency.value = midi(n + 12);
        o.detune.value = d;
        o.connect(f);
        o.start(t);
        o.stop(t + 0.26);
        oscs.push(o);
      }
    }
    this.h.reap(oscs[0], [...oscs, f, g]);
    this.h.note();
  }

  dispose(): void {
    for (const o of this.lfos) {
      try {
        o.stop();
      } catch {
        /* already stopped */
      }
    }
  }
}
