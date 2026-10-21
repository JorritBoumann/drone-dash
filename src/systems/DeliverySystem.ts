import * as THREE from 'three';
import type { Rng } from '../core/random';
import { RUN, SHIFT } from '../game/config';
import type { Site } from '../world/CityGenerator';

/**
 * Round 16 job sequence. The same street pilot scored 1,178 to 7,208 on nine cities because the city roll set the
 * legs: tower-heavy cities sent the first parcels up 30 to 42 m roofs, and some cities opened with 300 m of street before
 * the first drop. Legs now follow one spec on every city (street distance = grid distance from the last stop):
 * - first pickup: 45 to 95 m of street, a pad at most 12 m up;
 * - pickups: 45 to 105 m, at most 16 m up;
 * - drops: 105 to 165 m, growing 6 m per delivery up to 150 to 225 m; street level, except every third drop is a
 *   rooftop between 9 and 24 m up (+4 m per delivery, at most 40 m).
 */
export const JOBS = {
  first: { kinds: ['depot', 'park', 'rooftop', 'doorstep'], minY: -1, maxY: 12, streetMin: 45, streetMax: 95 } as LegSpec,
  pickupMin: 45,
  pickupMax: 105,
  pickupMaxY: 16,
  dropMin: 105,
  dropMax: 165,
  dropGrow: 6,
  dropMinCap: 150,
  dropMaxCap: 225,
  roofEvery: 3,
  roofMinY: 9,
  roofMaxY: 24,
  roofGrow: 4,
  roofMaxCap: 40,
  doorstepShare: 0.7, // street-level drops: this share goes to a shop doorstep, the rest to a park or depot pad
  // Round 18: route choice. With this chance a leg's pad is picked among those (inside the same spec, the distance band
  // widened one step at most) that have a shortcut: an alley, tunnel or boulevard route at least 15% shorter than the
  // plain grid route. Not on the first hop. If no pad qualifies, the leg is picked as before.
  shortcutBias: 0.85,
  // Round 19: within that, with this chance the picker first looks for a pad whose shortest route takes an alley or a
  // tunnel and no boulevard and is at least 15% shorter (pads beside alley mouths, on an alley line).
  narrowBias: 0.5,
};
export type LegSpec = { kinds: Site['kind'][]; minY: number; maxY: number; streetMin: number; streetMax: number };

export function jobSpec(phase: 'pickup' | 'drop', n: number, roofSlot: boolean, roll: number): LegSpec {
  const J = JOBS;
  if (phase === 'pickup') return { kinds: ['rooftop', 'doorstep', 'park', 'depot'], minY: -1, maxY: J.pickupMaxY, streetMin: J.pickupMin, streetMax: J.pickupMax };
  const streetMin = Math.min(J.dropMin + n * J.dropGrow, J.dropMinCap);
  const streetMax = Math.min(J.dropMax + n * J.dropGrow * 1.5, J.dropMaxCap);
  if (roofSlot) return { kinds: ['rooftop'], minY: J.roofMinY, maxY: Math.min(J.roofMaxY + n * J.roofGrow, J.roofMaxCap), streetMin, streetMax };
  return { kinds: roll < J.doorstepShare ? ['doorstep'] : ['park', 'depot', 'doorstep'], minY: -1, maxY: 3, streetMin, streetMax };
}

export type DeliveryPhase = 'pickup' | 'deliver';
export type DeliveryEvent =
  | { type: 'picked'; site: Site }
  | { type: 'delivered'; site: Site; points: number; timeBonus: number; fast: boolean; combo: number; legTime: number; par: number; final: boolean; plain: number; fastPts: number; clockTime: number; under: number; sharp: boolean; win: boolean }
  | null;

export type Tally = {
  drops: number; // delivery base points (100 + 1.2 per metre of leg)
  fast: number; // fast-drop bonus points before the combo multiplier
  combo: number; // extra points from the delivery combo multiplier
  slip: number; // slipstream payouts
  fastCount: number;
  rush: number; // round 15: rush order bonuses (a part of `fast`, shown as its own game-over row)
  dropSeconds: number; // clock seconds earned by deliveries
  slipSeconds: number; // clock seconds earned by slipstream payouts
  crashSeconds: number; // clock seconds lost to crashes
  partial: number; // round 17: street bonus paid at time-up by the share of the leg flown (a part of `slip`, its own game-over row)
  overtimeSeconds: number; // round 17: seconds flown in overtime
  overtimeDrop: number; // round 17: 1 if the run ended on a delivery made in overtime
  ringSeconds: number; // round 48: clock seconds from tailwind rings
  rings: number; // round 48: tailwind rings flown through
  clock: number; // round 48: points for the seconds left when the shift was done (its own game-over row)
  clockLeft: number; // round 48: those seconds
  clockExact: number; // round 48 fix pass: the exact seconds left at the finish (the run's flown time uses it)
};
export const newTally = (): Tally => ({ drops: 0, fast: 0, combo: 0, slip: 0, fastCount: 0, rush: 0, dropSeconds: 0, slipSeconds: 0, crashSeconds: 0, partial: 0, overtimeSeconds: 0, overtimeDrop: 0, ringSeconds: 0, rings: 0, clock: 0, clockLeft: 0, clockExact: 0 });

/** Objective loop: pick a parcel up, drop it off before the clock runs out; fast drops chain combos. */
export class DeliverySystem {
  phase: DeliveryPhase = 'pickup';
  target!: Site;
  pickupSite!: Site;
  timeLeft: number = RUN.startTime;
  score = 0;
  combo = 0;
  deliveries = 0;
  legTime = 0;
  /** Round 26: clock seconds the slow clock gave back on this leg (the leg's clock time is legTime minus this). */
  legClockGain = 0;
  legPar = 0;
  legDistance = 0;
  legRoute = 0;
  /** Round 18: does this pad have a shortcut from `from` (feature route at least 15% under the grid route)? Set by Game. */
  shortcut: ((from: THREE.Vector3, s: Site) => 0 | 1 | 2) | null = null;
  /** Round 19: the last few pads picked; a shortcut leg does not go back to them (no ping-pong along one alley). */
  private recent: number[] = []; // round 19: 2 = alley or tunnel shortcut, 1 = any other
  /** Round 17: overtime is running (the clock hit 0 with a parcel aboard). Once a run. */
  overtime = false;
  /** Round 17: the overtime delivery is made; the run is over (no new job, the clock stops). Round 48: also the shift's last parcel. */
  finished = false;
  /** Round 48: the shift's last parcel is delivered (the run is won). */
  won = false;
  /** Round 17: the current drop was assigned on last call (short, street level). */
  lastCall = false;
  /** Where every point and second of the run came from (game-over breakdown). The point lines sum exactly to `score`. */
  readonly tally = newTally();
  private lastSiteId = -1;
  private isClear?: (from: THREE.Vector3, to: THREE.Vector3) => boolean;
  private readonly glideFrom = new THREE.Vector3();

  constructor(private readonly sites: Site[]) {}

  reset(rng: Rng, from: THREE.Vector3, isClear?: (from: THREE.Vector3, to: THREE.Vector3) => boolean): void {
    this.timeLeft = RUN.startTime;
    this.score = 0;
    this.combo = 0;
    this.deliveries = 0;
    this.overtime = false;
    this.overtimeGiven = 0;
    this.finished = false;
    this.won = false;
    this.lastCall = false;
    this.lastSiteId = -1;
    this.recent = [];
    Object.assign(this.tally, newTally());
    this.isClear = isClear;
    this.phase = 'pickup';
    // Round 16: the first pickup is a short, low hop on every city (no tower roof), preferably in a clear straight line.
    this.target = this.pickLeg(rng, from, JOBS.first, isClear ? (s) => isClear(from, s.pos) : undefined, false);
    this.pickupSite = this.target;
    this.legTime = 0;
    this.legClockGain = 0;
  }

  /** Crash cost: take seconds off the clock (never below `floor`) and break any running combo. */
  penalize(seconds: number, floor: number, breakCombo: boolean): { seconds: number; comboLost: number } {
    const taken = Math.max(0, Math.min(seconds, this.timeLeft - floor));
    this.timeLeft -= taken;
    const comboLost = breakCombo && this.combo > 0 ? this.multiplier : 0;
    if (breakCombo) this.combo = 0;
    this.tally.crashSeconds += taken;
    return { seconds: taken, comboLost };
  }

  /** Bonus points (and clock time) outside a delivery. `useCombo` multiplies the points by the delivery combo. */
  addBonus(points: number, seconds: number, useCombo = true): number {
    const pts = Math.round(points * (useCombo ? this.multiplier : 1));
    this.score += pts;
    this.timeLeft += seconds;
    this.tally.slip += pts;
    this.tally.slipSeconds += seconds;
    return pts;
  }

  /** Rush order bonus (round 15): flat points, no combo. Counted in `fast` (and in `rush`), so the lines still sum to `score`. */
  addRush(points: number): number {
    const pts = Math.round(points);
    this.score += pts;
    this.tally.fast += pts;
    this.tally.rush += pts;
    return pts;
  }

  /** Slow clock: drafting adds clock time (no points). Returns the seconds added; they count as slipstream seconds. */
  addClock(seconds: number): number {
    if (seconds <= 0 || this.timeLeft <= 0 || this.overtime) return 0;
    this.timeLeft += seconds;
    this.tally.slipSeconds += seconds;
    this.legClockGain += seconds;
    return seconds;
  }

  /** Round 48: a tailwind ring adds clock time (counted as saved on the leg's par, like the slow clock). */
  addRing(seconds: number): number {
    this.tally.rings += 1;
    if (seconds <= 0 || this.timeLeft <= 0 || this.overtime || this.finished) return 0;
    this.timeLeft += seconds;
    this.tally.ringSeconds += seconds;
    this.legClockGain += seconds;
    return seconds;
  }

  /** Round 48: the shift is done: the seconds left on the clock pay points (no combo). Returns the points. */
  payClockLeft(): number {
    const sec = Math.max(0, Math.floor(this.timeLeft));
    const pts = sec * SHIFT.pointsPerSecond;
    this.score += pts;
    this.tally.clock += pts;
    this.tally.clockLeft = sec;
    this.tally.clockExact = Math.max(0, this.timeLeft);
    return pts;
  }

  /** Round 17: the clock hit 0 with a parcel aboard: start overtime (once a run). Returns false if it cannot start. */
  startOvertime(drone: THREE.Vector3): boolean {
    if (this.overtime || this.finished || this.phase !== 'deliver') return false;
    const t = this.target.pos;
    const left = Math.abs(t.x - drone.x) + Math.abs(t.z - drone.z) + Math.abs(t.y - drone.y);
    this.overtime = true;
    this.timeLeft = Math.round(Math.max(RUN.overtimeMin, Math.min(RUN.overtime, left / RUN.overtimeSpeed + RUN.overtimeSlack)));
    this.overtimeGiven = this.timeLeft;
    return true;
  }
  /** Round 17: the overtime seconds given (shown in the banner). */
  overtimeGiven = 0;

  /** Round 17: time-up share of the banked street bonus (a part of the street bonus line). */
  addPartial(points: number): number {
    const pts = Math.max(0, Math.round(points));
    this.score += pts;
    this.tally.slip += pts;
    this.tally.partial += pts;
    return pts;
  }

  /** Clock bonuses shrink as the run goes on: drop time and the slipstream's slow clock scale by this. */
  get clockDecay(): number {
    return Math.max(0.55, 1 - this.deliveries * RUN.clockDecayStep);
  }

  get multiplier(): number {
    return 1 + Math.min(this.combo, RUN.maxCombo) * RUN.comboStep;
  }

  /**
   * Prefer pads you can see coming: the glide line from 25 m out (on the side you arrive from) down to the pad must
   * clear solid buildings. Pads tucked behind a tower from the arrival side still exist, they are just not picked
   * when a readable one is available.
   */
  private approachable(from: THREE.Vector3): ((s: Site) => boolean) | undefined {
    const clear = this.isClear;
    if (!clear) return undefined;
    return (s) => {
      const dx = from.x - s.pos.x, dz = from.z - s.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      const back = Math.min(25, d);
      this.glideFrom.set(s.pos.x + (dx / d) * back, Math.max(s.pos.y + 25, 40), s.pos.z + (dz / d) * back);
      return clear(this.glideFrom, s.pos);
    };
  }

  /**
   * Round 16: pick the next objective to a leg spec, so the city roll does not decide how long or how high the legs
   * are. Candidates must be of an allowed kind, inside the height range and inside the street-distance band (grid
   * distance, the route a street pilot flies). If none fits, the band widens step by step, then the height rule goes,
   * then any site will do. `ok` (clear approach) is a preference inside each step, as before.
   */
  private pickLeg(rng: Rng, from: THREE.Vector3, spec: LegSpec, ok?: (s: Site) => boolean, cuts = true): Site {
    const street = (s: Site) => Math.abs(s.pos.x - from.x) + Math.abs(s.pos.z - from.z);
    const cutRoll = rng();
    const pickFrom = (list: Site[]): Site => {
      const preferred = ok ? list.filter(ok) : list;
      const pool = preferred.length ? preferred : list;
      const s = pool[Math.floor(rng() * pool.length) % pool.length];
      this.lastSiteId = s.id;
      this.recent.push(s.id);
      if (this.recent.length > 4) this.recent.shift();
      return s;
    };
    const others = this.sites.filter((s) => s.id !== this.lastSiteId);
    // round 18: a shortcut job first, inside the spec (band widened one step at most), when the roll asks for one
    if (cuts && this.shortcut && cutRoll < JOBS.shortcutBias) {
      const sc = new Map<number, number>();
      const cut = (s: Site) => { let v = sc.get(s.id); if (v === undefined) { v = this.shortcut!(from, s); sc.set(s.id, v); } return v; };
      // round 19: an alley or tunnel shortcut first when the roll asks for one, then any shortcut
      for (const need of cutRoll < JOBS.narrowBias ? [2, 1] : [1]) {
        for (let widen = 0; widen <= 1; widen++) {
          const lo = spec.streetMin * (1 - widen * 0.15), hi = spec.streetMax * (1 + widen * 0.15);
          const list = others.filter((s) => {
            if (!spec.kinds.includes(s.kind) || s.pos.y < spec.minY || s.pos.y > spec.maxY) return false;
            const d = street(s);
            return d >= lo && d <= hi && !this.recent.includes(s.id) && cut(s) >= need;
          });
          if (list.length) return pickFrom(list);
        }
      }
    }
    for (const strict of [true, false]) {
      for (let widen = 0; widen <= 4; widen++) {
        const lo = spec.streetMin * (1 - widen * 0.15), hi = spec.streetMax * (1 + widen * 0.15);
        const list = others.filter((s) => {
          if (strict && (!spec.kinds.includes(s.kind) || s.pos.y < spec.minY || s.pos.y > spec.maxY)) return false;
          if (!strict && s.pos.y > spec.maxY + 15) return false;
          const d = street(s);
          return d >= lo && d <= hi;
        });
        if (list.length) return pickFrom(list);
      }
    }
    return pickFrom(others);
  }

  /** Check arrival at the active objective. */
  update(dt: number, rng: Rng, drone: THREE.Vector3, droneRadius: number): DeliveryEvent {
    if (this.finished) return null;
    if (this.overtime) this.tally.overtimeSeconds += Math.min(dt, this.timeLeft);
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    this.legTime += dt;
    const t = this.target;
    const dx = drone.x - t.pos.x, dz = drone.z - t.pos.z;
    const dy = drone.y - droneRadius - t.pos.y;
    const r = this.phase === 'pickup' ? RUN.pickupRadius : RUN.deliverRadius;
    const inside = dx * dx + dz * dz < (r + t.radius * 0.3) ** 2 && dy > -1.5 && dy < RUN.verticalTolerance;
    if (!inside || this.timeLeft <= 0) return null;

    if (this.phase === 'pickup') {
      this.phase = 'deliver';
      const n = this.deliveries;
      const picked = t;
      this.pickupSite = t;
      // Round 16: every city gets the same kind of drop sequence: street distance in a fixed band that grows slowly,
      // street-level drops except a rooftop on every third drop (height capped), whatever the city's pad mix.
      const roofSlot = n % JOBS.roofEvery === JOBS.roofEvery - 1;
      const roll = rng();
      // Round 17: last call. With little clock left the drop must fit the time left plus overtime, at street level, so a
      // late pickup never hands out a long rooftop job that cannot be finished. Same rng draws, so earlier legs are unchanged.
      this.lastCall = this.timeLeft < RUN.lastCallAt;
      let spec = jobSpec('drop', n, roofSlot && !this.lastCall, roll);
      if (this.lastCall) {
        const reach = Math.max(RUN.lastCallMin, (this.timeLeft + RUN.overtimeMin) * RUN.lastCallSpeed);
        const hi = Math.min(spec.streetMax, reach);
        spec = { ...spec, streetMax: hi, streetMin: Math.min(spec.streetMin, hi * 0.6) };
      }
      this.target = this.pickLeg(rng, t.pos, spec, this.approachable(t.pos));
      this.legDistance = Math.hypot(this.target.pos.x - t.pos.x, this.target.pos.z - t.pos.z) + Math.abs(this.target.pos.y - t.pos.y);
      // par is judged on the street route (grid distance) at a clean street pace with corners, so a pilot who follows the
      // streets makes it without needing the slipstream (drafting earns its own points, never delivery points)
      this.legRoute = Math.abs(this.target.pos.x - t.pos.x) + Math.abs(this.target.pos.z - t.pos.z) + Math.abs(this.target.pos.y - t.pos.y);
      this.legPar = this.legRoute / RUN.parSpeed + RUN.parSlack;
      this.legTime = 0;
      this.legClockGain = 0;
      return { type: 'picked', site: picked };
    }

    // delivered
    const legTime = this.legTime;
    // round 26: par is judged on the run clock (the timer the player sees): seconds the slow clock gave back on this leg
    // count as time saved, so a fast, low street line beats par by more than a slow, centred one
    const clockTime = Math.max(0, this.legTime - this.legClockGain);
    const fast = clockTime <= this.legPar;
    const underRaw = this.legPar - clockTime;
    // a sharp drop (at least `comboSharp` s under par) builds the combo; a drop that only scrapes in keeps it; a late one breaks it
    const sharp = underRaw >= RUN.comboSharp;
    this.combo = sharp ? this.combo + 1 : fast ? this.combo : 0;
    const decay = this.clockDecay;
    // Round 48: the shift's last parcel wins the run (also when it is made in overtime)
    const win = this.deliveries + 1 >= SHIFT.parcels;
    // Round 17: a delivery made in overtime adds no clock and ends the run (overtime cannot chain)
    const final = this.overtime || win;
    // Round 17: a last-call drop is short and adds no clock either, so short late legs cannot keep a run alive forever
    const timeBonus = final || this.lastCall ? 0 : Math.round(Math.max(RUN.minTimeBonus, Math.min(20, 5 + this.legDistance / 11)) * decay);
    const plain = Math.round(RUN.baseScore + this.legDistance * RUN.perMetre);
    // round 25: the fast drop pays a time bonus, more the further under par
    const under = Math.max(0, Math.min(RUN.fastSecCap, underRaw));
    const fastPts = fast ? Math.round(RUN.fastBonus + under * RUN.fastPerSec) : 0;
    const points = Math.round((plain + fastPts) * this.multiplier);
    this.score += points;
    const T = this.tally;
    T.drops += plain;
    T.fast += fastPts;
    T.combo += points - plain - fastPts;
    T.fastCount += fast ? 1 : 0;
    T.dropSeconds += timeBonus;
    this.deliveries += 1;
    this.timeLeft += timeBonus;
    const site = t;
    this.phase = 'pickup';
    this.lastCall = false;
    if (final) {
      this.finished = true;
      this.won = win;
      if (this.overtime) T.overtimeDrop = 1;
      return { type: 'delivered', site, points, timeBonus, fast, combo: this.combo, legTime, par: this.legPar, final, plain, fastPts, clockTime, under: Math.max(0, underRaw), sharp, win };
    }
    // next pickup reasonably close so the loop keeps moving (round 16: a street-distance band, low pads only).
    // Round 17: never further than the clock left can reach (at last-call pace), so the last pickup is a real chance.
    const pspec = jobSpec('pickup', this.deliveries, false, 0);
    const preach = Math.max(30, this.timeLeft * RUN.lastCallSpeed);
    if (preach < pspec.streetMax) Object.assign(pspec, { streetMax: preach, streetMin: Math.min(pspec.streetMin, preach * 0.6) });
    this.target = this.pickLeg(rng, t.pos, pspec, this.approachable(t.pos));
    this.legTime = 0;
    this.legClockGain = 0;
    return { type: 'delivered', site, points, timeBonus, fast, combo: this.combo, legTime, par: this.legPar, final, plain, fastPts, clockTime, under: Math.max(0, underRaw), sharp, win };
  }
}
