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

export function resolveCity(params: URLSearchParams): CityPick {
  const today = localDateKey();
  const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
  if (Number.isFinite(seedParam)) return { mode: 'seed', seed: seedParam, date: today };
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
    const raw = JSON.parse(window.localStorage.getItem(DAILY_KEY) ?? 'null') as DailyBest | null;
    if (raw && raw.date === date) return { date, best: Number(raw.best) || 0, tier: Number(raw.tier) || 0 };
  } catch {
    /* storage unavailable or bad data */
  }
  return { date, best: 0, tier: 0 };
}

export function writeDaily(v: DailyBest): void {
  try {
    window.localStorage.setItem(DAILY_KEY, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}
