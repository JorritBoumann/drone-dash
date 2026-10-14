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
// run form colours
const Dm: Chord = { bass: 38, pad: [57, 62, 65], arp: [62, 65, 69, 74] };
const Em: Chord = { bass: 40, pad: [59, 64, 67], arp: [64, 67, 71, 76] };

/**
 * Run form: 32 bars, one chord a bar, eight 4-bar phrases (A A' B A'' then a second pass with new chord orders and a
 * second B). Each phrase has different chords from the phrase 16 bars later, and the bass and arpeggio variants below
 * cycle every 3 phrases, so the run music only repeats exactly every 96 bars (3 min 4 s).
 */
export const RUN_FORM: Chord[] = [
  C, Am, F, G, C, Am, Dm, G, F, G, Em, Am, F, G, C, G,
  Am, F, C, G, C, Em, F, G, Dm, Em, F, G, Am, Dm, G, G,
];
/** which RUN_LEAD bar the lead plays over each bar of RUN_FORM (the second pass reuses bars written for the same chord) */
export const RUN_LEAD_ORDER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 1, 2, 14, 3, 4, 10, 12, 13, 6, 10, 8, 9, 5, 6, 7, 15];
/** one chord a bar: Ab Bb Ab G, the clock is running out */
export const FINAL_PROG: Chord[] = [Ab, Bb, Ab, G7];
/** one chord every two bars */
export const TITLE_PROG: Chord[] = [Fmaj7, Em7, Dm7, Gsus];
/** game over, one chord every two bars: warm when a medal was won, wistful when not */
export const OVER_PROG_MEDAL: Chord[] = [C, Fmaj7, Am, G];
export const OVER_PROG_NONE: Chord[] = [Fm, C, Am, Gsus];

/** run lead melody (chain 3+), 16 bars of 16 steps, picked per bar by RUN_LEAD_ORDER; 0 = rest */
export const RUN_LEAD: number[][] = [
  // A
  [76, 0, 0, 79, 0, 0, 76, 0, 74, 0, 72, 0, 74, 0, 0, 0],
  [72, 0, 0, 76, 0, 0, 72, 0, 71, 0, 69, 0, 71, 0, 0, 0],
  [69, 0, 0, 72, 0, 0, 77, 0, 76, 0, 74, 0, 72, 0, 0, 0],
  [71, 0, 0, 74, 0, 0, 79, 0, 77, 0, 76, 0, 74, 0, 71, 0],
  // A': the answer
  [79, 0, 0, 76, 0, 0, 72, 0, 74, 0, 76, 0, 79, 0, 0, 0],
  [81, 0, 0, 79, 0, 0, 76, 0, 72, 0, 74, 0, 76, 0, 0, 0],
  [77, 0, 0, 74, 0, 0, 69, 0, 72, 0, 74, 0, 77, 0, 0, 0],
  [79, 0, 0, 0, 0, 0, 74, 0, 71, 0, 74, 0, 67, 0, 0, 0],
  // B: longer, higher notes
  [81, 0, 0, 0, 0, 0, 79, 0, 77, 0, 0, 0, 76, 0, 0, 0],
  [74, 0, 0, 0, 0, 0, 79, 0, 0, 0, 0, 0, 83, 0, 0, 0],
  [83, 0, 0, 0, 0, 0, 79, 0, 76, 0, 0, 0, 79, 0, 0, 0],
  [81, 0, 0, 0, 0, 0, 76, 0, 72, 0, 0, 0, 76, 0, 0, 0],
  // A'': turnaround back to the top
  [77, 0, 0, 76, 0, 0, 74, 0, 72, 0, 0, 0, 69, 0, 72, 0],
  [74, 0, 0, 71, 0, 0, 67, 0, 71, 0, 74, 0, 79, 0, 0, 0],
  [76, 0, 0, 0, 0, 0, 72, 0, 79, 0, 0, 0, 76, 0, 0, 0],
  [74, 0, 0, 76, 0, 0, 77, 0, 79, 0, 77, 0, 74, 0, 71, 0],
];

/** arpeggio order over the four arp tones (the last-10-s section) */
export const ARP_ORDER = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 3, 1, 2];
/** run arpeggio orders, one per phrase, cycling every 3 phrases */
export const RUN_ARP_ORDERS: number[][] = [
  ARP_ORDER,
  [0, 2, 1, 3, 0, 2, 1, 3, 2, 3, 1, 2, 0, 1, 2, 3],
  [3, 2, 1, 0, 1, 2, 3, 2, 0, 1, 3, 1, 2, 1, 0, 1],
];
/** title pluck: eighth notes over two bars (index into the arp tones, -1 = rest) */
export const TITLE_PLUCK = [0, 2, 1, 3, -1, 2, 1, -1, 0, 2, 3, 1, -1, 2, -1, -1];

/** run bass: syncopated patterns (steps of the bar), one per phrase, cycling every 3 phrases */
export const RUN_BASS_VARIANTS: number[][] = [
  [0, 3, 6, 8, 11, 14],
  [0, 6, 8, 10, 14],
  [0, 3, 8, 11, 12, 14],
];

export const midi = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
