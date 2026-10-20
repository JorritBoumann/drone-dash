/**
 * Round 46: "Breakbeat", the second procedural soundtrack. Round 47: the owner chose it as the default; "Classic" (see
 * music.ts) stays selectable on the title and pause cards and with `?music=classic`.
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
 * Round 47 (Gemini listening review): a hybrid kit with character (a pitched snare body, saturated noise, a 280 Hz boost and a
 * short room; darker ghosts; hats that vary in level, decay and brightness; a kick with a click and a short pitch drop),
 * humanised timing and velocity (a small, consistent swing, so no two bars are identical), a one-beat gap before the
 * overtime drop (high-passed, no drums or bass) with a sub-drop on the drop's downbeat, new brass stabs (three detuned saws,
 * a pitch blip, saturation, a two-stage filter), a melodic low-pass in the last 10 s (room for the clock ticks), a dip
 * near 1.2 kHz in the keys while drafting, a lead with delayed vibrato and a filter that follows the note, and a Rhodes
 * whose brightness follows a small random velocity per voice.
 *
 * Everything is scheduled by AudioSystem's lookahead scheduler. Per note only the sources and their envelope gains are
 * new; filters, tremolo, panners and buses are shared and built once. Every one-shot graph is disconnected on `ended`.
 */
import { midi } from './music';

export const BB_BPM = 168;
export const BB_STEP = 60 / BB_BPM / 4; // 0.0893 s
/** Round 47: the drum bus level (the saturated kit with its room peaks about 3.5 dB over round 46's). */
const DRUMS_LVL = 0.72;

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
export interface BeatState {
  chain: number;
  chase: boolean;
  rush: boolean;
  overtime: boolean;
  tier: number;
  /** round 47: the clock will run out before the next downbeat with a parcel aboard (overtime is about to start) */
  otSoon?: boolean;
}

/** Round 47: a soft-clip curve (tanh, normalised) for the kit and the stabs. */
function satCurve(drive: number): Float32Array<ArrayBuffer> {
  const c = new Float32Array(1024);
  for (let i = 0; i < c.length; i++) {
    const x = (i / (c.length - 1)) * 2 - 1;
    c[i] = Math.tanh(drive * x) / Math.tanh(drive);
  }
  return c;
}

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
  /** round 47: three hat colours (dark band, mid, bright), picked per hit */
  private readonly hatF: BiquadFilterNode[];
  private readonly shakerBp: BiquadFilterNode;
  private readonly rideBp: BiquadFilterNode;
  private readonly crashHp: BiquadFilterNode;
  /** round 47: kick (click + body) into a soft clip; snare noise into its own band and a harder clip; ghosts darker */
  private readonly kickIn: GainNode;
  private readonly clickHp: BiquadFilterNode;
  private readonly snareBus: GainNode;
  /** round 47: the snare's top shelf (darker in the last 10 s, so the roll leaves 2 to 5 kHz to the clock ticks) */
  private readonly snTop: BiquadFilterNode;
  private readonly snareNoiseBp: BiquadFilterNode;
  private readonly ghostLp: BiquadFilterNode;
  private readonly sub: GainNode;
  private readonly bassBus: GainNode;
  private readonly bassLp: BiquadFilterNode;
  private readonly keysLp: BiquadFilterNode;
  /** round 47: a dip near 1.2 kHz while the drone drafts (room for the slipstream) */
  private readonly keysDip: BiquadFilterNode;
  /** round 47: every melodic part (keys, plucks, echo, lead, stabs) through one low-pass (2.4 kHz in the last 10 s) */
  private readonly melLp: BiquadFilterNode;
  /** round 47: the gap before the overtime drop high-passes the whole soundtrack */
  private readonly gapHp: BiquadFilterNode;
  private readonly direct: GainNode;
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
  /** round 47: the bar whose last beat was the pre-drop gap (-1: none) */
  private gapBar = -1;
  /** round 47: when the last gap and drop happened (audio clock), for tests */
  gapInfo = { gapAt: -1, dropAt: -1, gaps: 0, drops: 0, deferred: 0 };
  /** round 47: a seeded generator for the humanised timing and velocity (each bar differs, every run the same) */
  private seed = 0x2f6b1d;

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
    this.out = ctx.createGain();
    this.out.gain.value = 1;
    // round 47: the soundtrack -> gap high-pass (resting at 10 Hz, opened in the beat before the overtime drop) -> chain
    this.gapHp = filt('highpass', 10, 0.7, h.input);
    this.out.connect(this.gapHp);
    // drums
    this.drums = gain(DRUMS_LVL, this.out);
    this.hatF = [filt('bandpass', 6800, 1.3, this.drums), filt('highpass', 7600, 0.7, this.drums), filt('highpass', 9800, 0.7, this.drums)];
    this.shakerBp = filt('bandpass', 6200, 1.4, this.drums);
    this.rideBp = filt('bandpass', 5400, 1.1, this.drums);
    this.crashHp = filt('highpass', 3800, 0.6, this.drums);
    // kick: body and click -> a gentle soft clip -> drums
    const kickSat = ctx.createWaveShaper();
    kickSat.curve = satCurve(1.6);
    kickSat.connect(this.drums);
    this.kickIn = gain(1, kickSat);
    // the click: a band around 3.2 kHz (a high-pass let a raw step through, which the click detector caught)
    this.clickHp = filt('bandpass', 3200, 0.8, this.kickIn);
    // snare: body + saturated noise -> a 280 Hz boost and a softer top -> drums, plus a short room
    const snEq = filt('peaking', 280, 1.1, this.drums);
    snEq.gain.value = 5;
    const snTop = (this.snTop = ctx.createBiquadFilter());
    snTop.type = 'highshelf';
    snTop.frequency.value = 5200;
    snTop.gain.value = -3;
    snTop.connect(snEq);
    this.snareBus = gain(1, snTop);
    const snSat = ctx.createWaveShaper();
    snSat.curve = satCurve(2.4);
    snSat.oversample = '2x';
    snSat.connect(this.snareBus);
    const snPre = gain(1.4, snSat);
    this.snareNoiseBp = filt('bandpass', 2000, 0.6, snPre);
    this.ghostLp = filt('lowpass', 1500, 0.6, this.snareBus);
    // the short room: a generated 0.3 s stereo burst, darkened, only on the snare
    const sr = ctx.sampleRate;
    const rl = Math.floor(sr * 0.3);
    const ir = ctx.createBuffer(2, rl, sr);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      let lp = 0;
      let x = c ? 77 : 31;
      for (let i = 0; i < rl; i++) {
        x = (x * 16807) % 2147483647;
        lp += 0.45 * ((x / 2147483647) * 2 - 1 - lp);
        d[i] = lp * Math.exp((-i / sr) * 14) * (i < sr * 0.004 ? 0 : 1);
      }
    }
    const room = ctx.createConvolver();
    room.normalize = true;
    room.buffer = ir;
    const roomOut = gain(0.55, this.drums);
    this.snareBus.connect(gain(1, room));
    room.connect(roomOut);
    // bass: a sine sub and a soft saw through a lowpass that follows the chain (and closes in the last 10 s)
    this.sub = gain(1, this.out);
    this.bassBus = gain(1, this.out);
    this.bassLp = filt('lowpass', 420, 2.2, this.bassBus);
    // a direct path for the riser and the sub-drop (outside the drum and bass gates, still through the gap high-pass)
    this.direct = gain(1, this.out);
    // melodic parts: one low-pass for keys, plucks, echo, lead and stabs
    const mel = ctx.createGain();
    this.melLp = filt('lowpass', 16000, 0.5, this.out);
    mel.connect(this.melLp);
    // keys: FM Rhodes -> lowpass (opens with the chain) -> draft dip -> stereo tremolo (gain LFO + pan LFO)
    const keysPan = ctx.createStereoPanner();
    keysPan.connect(mel);
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
    this.keysDip = filt('peaking', 1200, 1.1, trem);
    this.keysDip.gain.value = 0;
    this.keysLp = filt('lowpass', 1500, 0.6, this.keysDip);
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
    elp.connect(ePan).connect(mel);
    // plucks, lead, stabs
    const arpBus = gain(1, mel);
    arpBus.connect(this.echoIn);
    this.arpLp = filt('lowpass', 2600, 2.5, arpBus);
    this.lead = gain(1, mel);
    this.lead.connect(this.echoIn);
    // round 47: stabs -> a soft clip (brass edge) -> a gentle dip at 3 kHz -> slightly left
    const leadPan = ctx.createStereoPanner();
    leadPan.pan.value = -0.12;
    leadPan.connect(mel);
    const stEq = filt('peaking', 3000, 0.9, leadPan);
    stEq.gain.value = -3;
    const stSat = ctx.createWaveShaper();
    stSat.curve = satCurve(2.2);
    stSat.oversample = '2x';
    stSat.connect(stEq);
    this.stabs = gain(1, stSat);
    for (const o of [tl, pl]) {
      o.start();
      this.lfos.push(o);
    }
  }

  /** Round 47: a seeded uniform 0..1 (mulberry32). */
  private rnd(): number {
    let z = (this.seed = (this.seed + 0x6d2b79f5) | 0);
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  }

  /** Round 47: a velocity factor 1 +- amt. */
  private vel(amt: number): number {
    return 1 + (this.rnd() * 2 - 1) * amt;
  }

  /** Round 47: a small timing nudge (s), +- ms/1000. */
  private jit(ms: number): number {
    return (this.rnd() * 2 - 1) * ms * 0.001;
  }

  /** Round 47: the keys dip near 1.2 kHz while drafting (0..1 -> 0..-4.5 dB). */
  setDraftDip(amount: number, t: number): void {
    this.keysDip.gain.setTargetAtTime(-4.5 * Math.max(0, Math.min(1, amount)), t, 0.15);
  }

  /** Called at a scene start (the scheduler's step restarts at 0). */
  reset(): void {
    this.dropBar = -1;
    this.gapBar = -1;
  }

  /** One 16th step. `bar` counts from the scene start; `t` is the step's audio-clock time. */
  step(scene: BeatScene, bar: number, s: number, t: number, st: BeatState): void {
    if (s === 0) {
      this.lv = Math.max(0, Math.min(3, st.chain));
      this.chase = st.chase;
      this.rush = st.rush;
      // round 47: the drop lands on the first downbeat after a gap beat; overtime without a gap waits one bar for it
      const gapped = this.gapBar === bar - 1 && bar > 0;
      if (st.overtime && this.dropBar < 0 && scene === 'final') {
        if (gapped) {
          this.dropBar = bar;
          this.gapInfo.dropAt = t;
          this.gapInfo.drops++;
          this.subDrop(t);
        } else this.gapInfo.deferred++;
      }
      if (gapped) this.gapEnd(t);
      this.overtime = st.overtime;
      this.latched = { lv: this.lv, rush: this.rush, overtime: this.overtime };
      this.barStart(scene, bar, t, st);
    }
    // round 47: the last beat before the overtime drop is a gap (high-passed, no drums or bass)
    // (overtime that starts later in that beat still gets the rest of it as a shorter gap)
    if (s >= 12 && scene === 'final' && this.dropBar < 0 && (st.overtime || st.otSoon) && this.gapBar !== bar) {
      this.gapBar = bar;
      this.gapStart(t, (16 - s) * BB_STEP);
    }
    if (scene === 'run') this.groove(bar, s, t, this.lv, this.rush, this.chase, bbChord('run', bar, 0, false, -1), Math.floor(bar / 8));
    else if (scene === 'final') {
      if (this.overtime && this.dropBar >= 0) this.groove(bar - this.dropBar, s, t, 3, true, false, bbChord('final', bar, 0, true, this.dropBar), 0, true);
      else this.finalStep(bar, s, t);
    } else if (scene === 'title') this.titleStep(bar, s, t);
    else this.overStep(bar, s, t, st.tier);
  }

  /** Round 47: the gap beat: drums, sub and bass out, the soundtrack high-passed up to 700 Hz over the beat. */
  private gapStart(t: number, beat: number): void {
    for (const g of [this.drums.gain, this.sub.gain, this.bassBus.gain]) {
      g.cancelScheduledValues(t);
      g.setTargetAtTime(0, t, 0.006);
    }
    const f = this.gapHp.frequency;
    f.cancelScheduledValues(t);
    f.setValueAtTime(10, t);
    f.exponentialRampToValueAtTime(240, t + Math.min(0.03, beat * 0.3));
    f.exponentialRampToValueAtTime(700, t + beat - 0.01);
    this.gapInfo.gapAt = t;
    this.gapInfo.gaps++;
  }

  /** Round 47: the downbeat after the gap: everything back at once. */
  private gapEnd(t: number): void {
    for (const g of [this.drums.gain, this.sub.gain, this.bassBus.gain]) {
      g.cancelScheduledValues(t);
      g.setValueAtTime(0, t);
      g.linearRampToValueAtTime(g === this.drums.gain ? DRUMS_LVL : 1, t + 0.004);
    }
    const f = this.gapHp.frequency;
    f.cancelScheduledValues(t);
    f.setValueAtTime(700, t);
    f.exponentialRampToValueAtTime(10, t + 0.012);
  }

  /** Round 47: the sub-drop under the overtime downbeat (a sine falling 110 to 32 Hz). */
  private subDrop(t: number): void {
    const ctx = this.h.ctx;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(32, t + 0.75);
    const g = this.env();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.005);
    g.gain.setValueAtTime(0.16, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0006, t + 0.95);
    o.connect(g).connect(this.direct);
    o.start(t);
    o.stop(t + 0.97);
    this.h.reap(o, [o, g]);
    this.h.note();
  }

  /** Filter moves on the downbeat (keys open with the chain, the bass closes in the last 10 s). */
  private barStart(scene: BeatScene, bar: number, t: number, st: BeatState): void {
    const k = this.keysLp.frequency, b = this.bassLp.frequency, sg = this.sub.gain;
    let keys = 1500, bass = 420, sub = 1, mel = 16000;
    if (scene === 'run') {
      keys = [1500, 3200, 3600, 4200][this.lv];
      bass = [300, 480, 620, 700][this.lv];
    } else if (scene === 'final') {
      if (this.overtime && this.dropBar >= 0) {
        keys = 4200;
        bass = 760;
        mel = 3400;
      } else {
        // round 47: the melodic parts close to 2.4 kHz so the clock ticks have room
        mel = 2400;
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
    sg.setTargetAtTime(sub, t + 0.01, 0.4);
    this.melLp.frequency.setTargetAtTime(mel, t, scene === 'final' ? 0.25 : 0.4);
    // the snare's top: dark under the clock ticks (last 10 s), a little open in the drop, normal elsewhere
    const roll = scene === 'final' && !(this.overtime && this.dropBar >= 0);
    const drop = scene === 'final' && !roll;
    this.snTop.frequency.setTargetAtTime(roll ? 1900 : drop ? 3200 : 5200, t, 0.1);
    this.snTop.gain.setTargetAtTime(roll ? -9 : drop ? -5 : -3, t, 0.1);
  }

  /** The run groove (and the overtime drop). `sec` picks the variant (cycles every 3 sections). */
  private groove(bar: number, s: number, t: number, lv: number, rush: boolean, chase: boolean, ch: BChord, sec: number, drop = false): void {
    const v = VARS[sec % 3];
    const inSec = bar % 8;
    const fill = inSec === 7;
    const half = inSec === 3;
    const slotBar = bar % 2;
    // drums. Round 47: humanised. The off-16ths swing a little late (consistently), every hit gets a small timing nudge
    // and a velocity change, the backbeat sits 4 ms behind the grid.
    const sw = s % 2 ? BB_STEP * 0.12 : 0;
    if (v.kick.includes(s) && !(fill && s >= 12)) this.kick(t + this.jit(1.2), (s === 0 ? 0.31 : 0.26) * this.vel(0.07));
    if (s === 4 || (s === 12 && !fill)) this.snare(t + 0.004 + this.jit(2), 0.3 * this.vel(0.06), 0.2);
    if (fill && s >= 12) this.snare(t + sw + this.jit(3), (0.12 + (s - 12) * 0.05) * this.vel(0.12), 0.12);
    if (fill && s === 14 && lv >= 1) this.kick(t + this.jit(1.2), 0.27);
    if ((half || (rush && inSec === 5)) && (s === 14 || s === 15)) this.snare(t + sw + this.jit(3), (0.09 + (s - 14) * 0.04) * this.vel(0.12), 0.1);
    if (lv >= 2 && v.ghost.includes(s) && !(fill && s >= 12)) this.snare(t + sw + this.jit(4), 0.07 * this.vel(0.25), 0.06, true);
    if (lv >= 1) {
      this.hat(t + (s % 2 ? BB_STEP * 0.14 : 0) + this.jit(3), 0.11 * HAT16[s], 0.045, HAT16[s] >= 1);
      if (s % 2 === 1) this.shaker(t + BB_STEP * 0.1 + this.jit(4), 0.04 * this.vel(0.25));
    } else if (s % 2 === 0) this.hat(t + this.jit(3), s % 4 === 2 ? 0.085 : 0.035, 0.04, s % 4 === 2);
    if (chase && (s === 6 || s === 14)) this.hat(t + this.jit(2), 0.06, 0.16, true);
    if (lv >= 3 && s % 4 === 0) this.ride(t + this.jit(2), (s === 0 ? 0.075 : 0.055) * this.vel(0.1));
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
    // round 47: in the gap beat (the last beat before the overtime drop) only keys, plucks and the riser play
    const gap = this.gapBar === bar && s >= 12;
    if (s % 4 === 0 && bar < 6 && !gap) this.kick(t + this.jit(1.2), 0.32 * this.vel(0.05));
    if (s === 0) this.subNote(t, midi(ch.bass), 16 * BB_STEP, 0.06);
    if (gap) {
      this.pluck(t, midi(ch.arp[ARPS[0][s]] + 12), 0.03);
      return;
    }
    if (s % 4 === 0 || s % 4 === 3) this.bassNote(t, midi(ch.bass + 12 + (s % 8 === 4 ? 12 : 0)), BB_STEP * 2, 0.055);
    this.hat(t + (s % 2 ? BB_STEP * 0.14 : 0) + this.jit(3), 0.08 * HAT16[s], 0.03, HAT16[s] >= 1);
    const stage = Math.min(3, Math.floor(bar / 2));
    const g = Math.min(0.32, 0.08 + bar * 0.035 + (s / 16) * 0.035);
    if (stage === 0 ? s % 2 === 0 : true) this.snare(t + this.jit(2), g * this.vel(0.08), 0.09);
    if (stage >= 2) this.snare(t + BB_STEP / 2 + this.jit(2), g * 0.8 * this.vel(0.1), 0.07);
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
    if (s === 0 || (s === 10 && bar % 2 === 1)) this.kick(t + this.jit(1.5), 0.2 * this.vel(0.06));
    if (s === 8) this.snare(t + 0.005 + this.jit(2.5), 0.11 * this.vel(0.08), 0.14);
    if (s === 14 && bar % 2 === 1) this.snare(t + this.jit(4), 0.05 * this.vel(0.3), 0.05, true);
    if (s % 2 === 0) this.shaker(t + (s % 4 === 2 ? BB_STEP * 0.12 : 0) + this.jit(4), (s % 4 === 2 ? 0.045 : 0.024) * this.vel(0.25));
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
    if (s === 0 || (s === 10 && bar % 2 === 0)) this.kick(t + this.jit(1.5), 0.24 * this.vel(0.06));
    if (s === 8) this.snare(t + 0.005 + this.jit(2.5), 0.16 * this.vel(0.08), 0.2);
    if (s % 4 === 2) this.hat(t + this.jit(3), 0.05, 0.05, s === 10);
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

  /** Round 47: a kick with a click and a short pitch drop (230 -> 95 Hz in 12 ms, -> 48 Hz by 70 ms), soft-clipped. */
  private kick(t: number, gain: number): void {
    const ctx = this.h.ctx;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(230, t);
    o.frequency.exponentialRampToValueAtTime(95, t + 0.012);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.07);
    const g = this.env();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain * 0.85, t + 0.0025);
    g.gain.setValueAtTime(gain * 0.85, t + 0.022);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.26);
    o.connect(g).connect(this.kickIn);
    o.start(t);
    o.stop(t + 0.32);
    this.h.reap(o, [o, g]);
    // the beater click: 8 ms of band-passed noise
    const n = this.noiseSrc(t, 0.01);
    const ng = this.env();
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(gain * 0.4, t + 0.002);
    ng.gain.exponentialRampToValueAtTime(0.0005, t + 0.009);
    n.connect(ng).connect(this.clickHp);
    this.h.reap(n, [n, ng]);
    this.h.note();
  }

  /**
   * Round 47: a hybrid snare. A triangle body falling 220 to 110 Hz in 45 ms, noise through a 2 kHz band and a soft clip,
   * a 280 Hz boost and a short room on the bus. Ghost notes: quieter, a lower body and darker noise (1.5 kHz low-pass).
   */
  private snare(t: number, gain: number, tail: number, ghost = false): void {
    const ctx = this.h.ctx;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(ghost ? 190 : 220, t);
    o.frequency.exponentialRampToValueAtTime(ghost ? 120 : 110, t + 0.045);
    const g = this.env();
    const bodyEnd = ghost ? 0.06 : 0.11;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain * (ghost ? 0.45 : 0.75), t + 0.0025);
    g.gain.exponentialRampToValueAtTime(0.0005, t + bodyEnd);
    o.connect(g).connect(this.snareBus);
    o.start(t);
    o.stop(t + bodyEnd + 0.01);
    this.h.reap(o, [o, g]);
    const len = ghost ? Math.min(tail, 0.07) : tail * (0.9 + this.rnd() * 0.2);
    const n = this.noiseSrc(t, len);
    const ng = this.env();
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(gain, t + 0.0025);
    ng.gain.exponentialRampToValueAtTime(gain * 0.3, t + 0.026);
    ng.gain.exponentialRampToValueAtTime(0.0005, t + len);
    n.connect(ng).connect(ghost ? this.ghostLp : this.snareNoiseBp);
    this.h.reap(n, [n, ng]);
    this.h.note();
  }

  private noiseHit(dest: AudioNode, t: number, gain: number, dur: number, att = 0.002): void {
    const n = this.noiseSrc(t, dur);
    const g = this.env();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + att);
    g.gain.exponentialRampToValueAtTime(0.0004, t + dur);
    n.connect(g).connect(dest);
    this.h.reap(n, [n, g]);
    this.h.note();
  }

  /** Round 47: each hat varies in level (+-25%), decay (+-30%) and colour (dark, mid, bright; accents lean bright). */
  private hat(t: number, gain: number, dur: number, accent = false): void {
    const r = this.rnd();
    const col = accent ? (r < 0.15 ? 0 : r < 0.55 ? 1 : 2) : r < 0.4 ? 0 : r < 0.85 ? 1 : 2;
    this.noiseHit(this.hatF[col], t, gain * this.vel(0.25) * (col === 0 ? 1.15 : 1), dur * this.vel(0.3));
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
    n.connect(f).connect(g).connect(this.direct);
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
    // round 47: a slightly uneven strum (3 to 7 ms per voice)
    let at = t;
    for (let i = 0; i < notes.length; i++) {
      this.rhodes(midi(notes[i]), at, dur, gain);
      at += 0.003 + this.rnd() * 0.004;
    }
  }

  private rhodes(f: number, t: number, dur: number, gain: number): void {
    const ctx = this.h.ctx;
    const car = ctx.createOscillator();
    car.frequency.value = f;
    const mod = ctx.createOscillator();
    mod.frequency.value = f;
    // round 47: a random velocity per voice (+-18%); the strike's brightness (FM index) follows it
    const v = this.vel(0.18);
    gain *= v;
    const bright = 0.55 + (v - 0.82) * 1.6; // 0.55 .. 1.13
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(f * 1.25 * bright, t);
    mg.gain.exponentialRampToValueAtTime(f * 0.1 * bright, t + 0.3 + 0.1 * bright);
    mod.connect(mg).connect(car.frequency);
    const g = this.env();
    const end = t + dur + 0.12;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.006);
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

  /**
   * Round 47: the lead. A sine plus a quiet detuned soft saw with a small scoop; the vibrato fades in after 0.16 s, the
   * saw's low-pass follows the note's height and softens over a sustained note.
   */
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
    const nodes: AudioNode[] = [a, b];
    if (dur > 0.22) {
      // delayed vibrato: 5.4 Hz, fading in from 0.16 s to 0.45 s, up to +-0.7% (about 12 cents)
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.2 + this.rnd() * 0.5;
      const dg = ctx.createGain();
      dg.gain.setValueAtTime(0, t);
      dg.gain.setValueAtTime(0, t + 0.16);
      dg.gain.linearRampToValueAtTime(f * 0.007, t + Math.min(dur, 0.45));
      lfo.connect(dg);
      dg.connect(a.frequency);
      dg.connect(b.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.02);
      nodes.push(lfo, dg);
    }
    const bg = ctx.createGain();
    bg.gain.value = 0.28;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.7;
    // the filter follows the note (about 4.2x the pitch, 1.6 to 3.6 kHz) and closes to 60% over a long note
    const fc = Math.max(1600, Math.min(3600, f * 4.2));
    lp.frequency.setValueAtTime(fc, t);
    if (dur > 0.25) lp.frequency.setTargetAtTime(fc * 0.6, t + 0.12, dur * 0.5);
    const g = this.env();
    const r = Math.min(0.08, dur * 0.3);
    const v = gain * this.vel(0.08);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + 0.012);
    g.gain.setValueAtTime(v * 0.85, t + dur - r);
    g.gain.linearRampToValueAtTime(0, t + dur);
    a.connect(g);
    b.connect(bg).connect(lp).connect(g);
    g.connect(this.lead);
    for (const o of [a, b]) {
      o.start(t);
      o.stop(t + dur + 0.02);
    }
    nodes.push(bg, lp, g);
    this.h.reap(a, nodes);
    this.h.note();
  }

  /**
   * Round 47: a brass stab. The chord's top three keys an octave up, three detuned saws each with a fast pitch blip (from
   * 60 cents flat, slightly over, then on pitch in 40 ms), a two-stage filter (open to 3 kHz in 8 ms, down to 1.4 kHz by
   * 60 ms, then to 650 Hz), into a soft clip with a dip at 3 kHz.
   */
  private stab(ch: BChord, t: number, gain: number): void {
    const ctx = this.h.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 1.6;
    f.frequency.setValueAtTime(420, t);
    f.frequency.exponentialRampToValueAtTime(3000, t + 0.008);
    f.frequency.exponentialRampToValueAtTime(1400, t + 0.06);
    f.frequency.exponentialRampToValueAtTime(650, t + 0.24);
    const g = this.env();
    const v = gain * 0.62 * this.vel(0.08);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + 0.006);
    g.gain.setValueAtTime(v * 0.85, t + 0.07);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.26);
    f.connect(g).connect(this.stabs);
    const oscs: OscillatorNode[] = [];
    for (const n of ch.keys.slice(1)) {
      const fr = midi(n + 12);
      for (const d of [-11, 0, 9]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(fr * 0.966, t);
        o.frequency.exponentialRampToValueAtTime(fr * 1.004, t + 0.018);
        o.frequency.exponentialRampToValueAtTime(fr, t + 0.04);
        o.detune.value = d;
        o.connect(f);
        o.start(t);
        o.stop(t + 0.28);
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
