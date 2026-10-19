import { storeGet, storeSet } from '../core/storage';
/**
 * Round 15: which city a page load builds.
 * - `?seed=N`: exactly that city (bot scripts and shared links; unchanged).
 * - `?daily` (or `?daily=YYYY-MM-DD`): the daily city, one seed per local calendar day, with its own best and medal.
 * - nothing: a new random city on every load.
 */
export type CityMode = 'seed' | 'random' | 'daily';
export type CityPick = { mode: CityMode; seed: number; date: string };

const DAILY_KEY = 'drone-dash-daily-v1';

/** Local calendar date as YYYY-MM-DD. */
export function localDateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "Thu 15 Oct" for a YYYY-MM-DD key. */
export function dateLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[dt.getDay()]} ${dt.getDate()} ${months[dt.getMonth()]}`;
}

/** Five-digit seed from a date key (FNV-1a), so every player gets the same daily city. */
export function dailySeed(key: string): number {
  let h = 0x811c9dc5;
  for (const c of `drone-dash/${key}`) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  return 10000 + (h % 90000);
}

export function randomSeed(): number {
  let r = Math.random();
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    r = a[0] / 4294967296;
  } catch {
    /* Math.random fallback */
  }
  return 10000 + Math.floor(r * 90000);
}

/**
 * Round 41: `?seed=` as the Stateloop Play Worker may send it. A whole number is used as it is (22 stays 22; a huge one
 * is folded into 32 bits, which is all the generators use). Anything else that is not empty (a hex string, a uuid) is
 * hashed to a five-digit seed, so the same string always builds the same city. Empty or missing: null.
 */
export function parseSeed(raw: string | null): number | null {
  const v = (raw ?? '').trim();
  if (!v) return null;
  if (/^-?\d+$/.test(v)) {
    const n = Number(v);
    if (Number.isSafeInteger(n)) return Math.abs(n) % 4294967296;
    let h = 0;
    for (const c of v) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
    return h;
  }
  let h = 0x811c9dc5;
  for (const c of `drone-dash/seed/${v}`) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  return 10000 + (h % 90000);
}

export function resolveCity(params: URLSearchParams): CityPick {
  const today = localDateKey();
  const seed = parseSeed(params.get('seed'));
  if (seed !== null) return { mode: 'seed', seed, date: today };
  if (params.has('daily')) {
    const v = params.get('daily') ?? '';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : today;
    return { mode: 'daily', seed: dailySeed(date), date };
  }
  return { mode: 'random', seed: randomSeed(), date: today };
}

/** URL for another city mode, keeping unrelated params (post, debug). */
export function cityUrl(mode: 'random' | 'daily'): string {
  const p = new URLSearchParams(window.location.search);
  p.delete('seed');
  p.delete('daily');
  if (mode === 'daily') p.set('daily', '1');
  const q = p.toString().replace(/daily=1/, 'daily');
  return `${window.location.pathname}${q ? `?${q}` : ''}`;
}

export type DailyBest = { date: string; best: number; tier: number };

export function readDaily(date: string): DailyBest {
  try {
    const raw = JSON.parse(storeGet(DAILY_KEY) ?? 'null') as DailyBest | null;
    if (raw && raw.date === date) return { date, best: Number(raw.best) || 0, tier: Number(raw.tier) || 0 };
  } catch {
    /* storage unavailable or bad data */
  }
  return { date, best: 0, tier: 0 };
}

export function writeDaily(v: DailyBest): void {
  try {
    storeSet(DAILY_KEY, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}

/**
 * Round 16: a city's look, from its seed (a separate hash, so it never touches the layout or parcel random numbers):
 * the light mood (index into Environment.MOODS) and how many parks it has (2 to 4; 3 was every city before).
 */
export type CityLook = { mood: number; parks: number };
export function cityLook(seed: number): CityLook {
  let h = Math.imul((seed ^ 0x9e3779b9) >>> 0, 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return { mood: h % 4, parks: 2 + ((h >>> 8) % 3) };
}
