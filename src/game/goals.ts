import { storeGet, storeSet } from '../core/storage';
import { GOALS } from './config';

export type Tier = { name: string; score: number };

/** Medal reached by a score: 0 = none yet, 1 = first tier ... GOALS.tiers.length = top tier. */
export function tierFor(score: number): number {
  let t = 0;
  GOALS.tiers.forEach((tier, i) => {
    if (score >= tier.score) t = i + 1;
  });
  return t;
}

export function tierName(tier: number): string {
  return tier > 0 ? GOALS.tiers[tier - 1].name : '';
}

/** The next medal to chase (null once the top tier is reached), and progress 0..1 from the last medal to it. */
export function nextGoal(score: number): { tier: number; name: string; score: number; progress: number } | null {
  const t = tierFor(score);
  if (t >= GOALS.tiers.length) return null;
  const from = t > 0 ? GOALS.tiers[t - 1].score : 0;
  const to = GOALS.tiers[t].score;
  return { tier: t + 1, name: GOALS.tiers[t].name, score: to, progress: Math.max(0, Math.min(1, (score - from) / (to - from))) };
}

const BEST_TIER_KEY = 'drone-dash-best-tier-v2'; // round 48: the shift's medals are a new table

export function readBestTier(): number {
  try {
    return Math.max(0, Math.min(GOALS.tiers.length, Number(storeGet(BEST_TIER_KEY)) || 0));
  } catch {
    return 0;
  }
}

export function writeBestTier(tier: number): void {
  try {
    storeSet(BEST_TIER_KEY, String(tier));
  } catch {
    /* storage unavailable */
  }
}
