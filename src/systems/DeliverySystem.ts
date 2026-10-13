import * as THREE from 'three';
import type { Rng } from '../core/random';
import { RUN } from '../game/config';
import type { Site } from '../world/CityGenerator';

export type DeliveryPhase = 'pickup' | 'deliver';
export type DeliveryEvent =
  | { type: 'picked'; site: Site }
  | { type: 'delivered'; site: Site; points: number; timeBonus: number; fast: boolean; combo: number }
  | null;

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
  legPar = 0;
  legDistance = 0;
  private lastSiteId = -1;
  private isClear?: (from: THREE.Vector3, to: THREE.Vector3) => boolean;
  private readonly glideFrom = new THREE.Vector3();

  constructor(private readonly sites: Site[]) {}

  reset(rng: Rng, from: THREE.Vector3, isClear?: (from: THREE.Vector3, to: THREE.Vector3) => boolean): void {
    this.timeLeft = RUN.startTime;
    this.score = 0;
    this.combo = 0;
    this.deliveries = 0;
    this.lastSiteId = -1;
    this.isClear = isClear;
    this.phase = 'pickup';
    // first objective: prefer one reachable in a straight, unobstructed line from the spawn
    this.target = this.choose(rng, from, 35, 110, ['depot', 'park', 'rooftop'], isClear ? (s) => isClear(from, s.pos) : undefined);
    this.pickupSite = this.target;
    this.legTime = 0;
  }

  /** Crash cost: take seconds off the clock (never below `floor`) and break any running combo. */
  penalize(seconds: number, floor: number, breakCombo: boolean): { seconds: number; comboLost: number } {
    const taken = Math.max(0, Math.min(seconds, this.timeLeft - floor));
    this.timeLeft -= taken;
    const comboLost = breakCombo && this.combo > 0 ? this.multiplier : 0;
    if (breakCombo) this.combo = 0;
    return { seconds: taken, comboLost };
  }

  get multiplier(): number {
    return 1 + Math.min(this.combo, RUN.maxCombo) * 0.5;
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

  private choose(rng: Rng, from: THREE.Vector3, minD: number, maxD: number, kinds?: Site['kind'][], ok?: (s: Site) => boolean): Site {
    const base = this.sites.filter((s) => {
      if (s.id === this.lastSiteId) return false;
      if (kinds && !kinds.includes(s.kind)) return false;
      const d = Math.hypot(s.pos.x - from.x, s.pos.z - from.z);
      return d >= minD && d <= maxD;
    });
    const preferred = ok ? base.filter(ok) : base;
    const pool = preferred.length ? preferred : base;
    const list = pool.length ? pool : this.sites.filter((s) => s.id !== this.lastSiteId);
    const s = list[Math.floor(rng() * list.length) % list.length];
    this.lastSiteId = s.id;
    return s;
  }

  /** Check arrival at the active objective. */
  update(dt: number, rng: Rng, drone: THREE.Vector3, droneRadius: number): DeliveryEvent {
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
      const minD = Math.min(70 + n * 6, 150);
      const maxD = Math.min(150 + n * 10, 260);
      const picked = t;
      this.pickupSite = t;
      const kinds: Site['kind'][] = rng() < 0.45 ? ['doorstep'] : ['rooftop', 'doorstep', 'park', 'depot'];
      this.target = this.choose(rng, t.pos, minD, maxD, kinds, this.approachable(t.pos));
      this.legDistance = Math.hypot(this.target.pos.x - t.pos.x, this.target.pos.z - t.pos.z) + Math.abs(this.target.pos.y - t.pos.y);
      this.legPar = this.legDistance / 12.5 + 5;
      this.legTime = 0;
      return { type: 'picked', site: picked };
    }

    // delivered
    const fast = this.legTime <= this.legPar;
    this.combo = fast ? this.combo + 1 : 0;
    const decay = Math.max(0.55, 1 - this.deliveries * 0.035);
    const timeBonus = Math.round(Math.max(RUN.minTimeBonus, Math.min(20, 5 + this.legDistance / 11)) * decay);
    const points = Math.round((RUN.baseScore + this.legDistance * 1.2 + (fast ? 75 : 0)) * this.multiplier);
    this.score += points;
    this.deliveries += 1;
    this.timeLeft += timeBonus;
    const site = t;
    this.phase = 'pickup';
    // next pickup reasonably close so the loop keeps moving
    this.target = this.choose(rng, t.pos, 30, 95 + Math.min(this.deliveries * 5, 60), undefined, this.approachable(t.pos));
    this.legTime = 0;
    return { type: 'delivered', site, points, timeBonus, fast, combo: this.combo };
  }
}
