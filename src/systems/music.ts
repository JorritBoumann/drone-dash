/**
 * Score data for the procedural soundtrack (played by AudioSystem's step sequencer).
 *
 * Key C major, 125 BPM, 16th-note grid (one step = 0.12 s), the same grid the medal fanfare and start sting use
 * (their notes fall 0.12 s and 0.06 s apart). Every chord is built from notes the SFX already use: the pickup and
 * delivery chimes are C major, the slipstream ticks climb D-F-Ab-B and the game-over sting falls through Ab.
 */
export const BPM = 125;
export const STEP = 60 / BPM / 4; // 0.12 s
export const STEPS_PER_BAR = 16;

export interface Chord {
  /** bass root (midi), kept in octave 2-3 so laptop and phone speakers still reproduce it */
  bass: number;
  /** pad voicing around middle C */
  pad: number[];
  /** arpeggio / bell tones in octave 4-5 */
  arp: number[];
}

const C: Chord = { bass: 48, pad: [60, 64, 67], arp: [72, 76, 79, 84] };
const Am: Chord = { bass: 45, pad: [60, 64, 69], arp: [69, 72, 76, 81] };
const F: Chord = { bass: 41, pad: [60, 65, 69], arp: [69, 72, 77, 81] };
const G: Chord = { bass: 43, pad: [59, 62, 67], arp: [67, 71, 74, 79] };
// last-10-seconds borrowed chords (C minor colour, as in the game-over sting) and a dominant that never resolves
const Ab: Chord = { bass: 44, pad: [60, 63, 68], arp: [68, 72, 75, 80] };
const Bb: Chord = { bass: 46, pad: [62, 65, 70], arp: [70, 74, 77, 82] };
const G7: Chord = { bass: 43, pad: [59, 62, 65], arp: [67, 71, 74, 77] };
// title: a slow, open loop
const Fmaj7: Chord = { bass: 41, pad: [57, 60, 64], arp: [65, 69, 72, 76] };
const Em7: Chord = { bass: 40, pad: [55, 59, 62], arp: [64, 67, 71, 74] };
const Dm7: Chord = { bass: 38, pad: [57, 60, 65], arp: [62, 65, 69, 72] };
const Gsus: Chord = { bass: 43, pad: [55, 60, 62], arp: [67, 72, 74, 79] };
// game over without a medal opens on F minor, the chord the falling sting (C Ab F C) spells
const Fm: Chord = { bass: 41, pad: [56, 60, 65], arp: [65, 68, 72, 77] };

/** one chord a bar */
export const RUN_PROG: Chord[] = [C, Am, F, G];
/** one chord a bar: Ab Bb Ab G, the clock is running out */
export const FINAL_PROG: Chord[] = [Ab, Bb, Ab, G7];
/** one chord every two bars */
export const TITLE_PROG: Chord[] = [Fmaj7, Em7, Dm7, Gsus];
/** game over, one chord every two bars: warm when a medal was won, wistful when not */
export const OVER_PROG_MEDAL: Chord[] = [C, Fmaj7, Am, G];
export const OVER_PROG_NONE: Chord[] = [Fm, C, Am, Gsus];

/** run lead melody (chain 3+), one 16-step bar per chord of RUN_PROG; 0 = rest */
export const RUN_LEAD: number[][] = [
  [76, 0, 0, 79, 0, 0, 76, 0, 74, 0, 72, 0, 74, 0, 0, 0],
  [72, 0, 0, 76, 0, 0, 72, 0, 71, 0, 69, 0, 71, 0, 0, 0],
  [69, 0, 0, 72, 0, 0, 77, 0, 76, 0, 74, 0, 72, 0, 0, 0],
  [71, 0, 0, 74, 0, 0, 79, 0, 77, 0, 76, 0, 74, 0, 71, 0],
];

/** arpeggio order over the four arp tones */
export const ARP_ORDER = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 3, 1, 2];
/** title pluck: eighth notes over two bars (index into the arp tones, -1 = rest) */
export const TITLE_PLUCK = [0, 2, 1, 3, -1, 2, 1, -1, 0, 2, 3, 1, -1, 2, -1, -1];

/** run bass: syncopated pattern (steps of the bar) */
export const RUN_BASS_STEPS = [0, 3, 6, 8, 11, 14];

export const midi = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
