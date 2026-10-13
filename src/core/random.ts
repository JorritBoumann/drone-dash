/**
 * Deterministic seeded RNG (mulberry32). Route ALL gameplay randomness through
 * a seeded generator instead of Math.random so `?seed=N` and the test hooks
 * keep city generation and objective order reproducible.
 */
export type Rng = () => number;

export function createSeededRandom(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const range = (rng: Rng, min: number, max: number): number => min + (max - min) * rng();
export const randInt = (rng: Rng, min: number, maxInclusive: number): number =>
  Math.floor(min + (maxInclusive - min + 1) * rng());
export const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length) % items.length];
export const chance = (rng: Rng, p: number): boolean => rng() < p;
