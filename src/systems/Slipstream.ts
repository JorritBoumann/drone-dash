import type * as THREE from 'three';
import { SLIPSTREAM } from '../game/config';
import type { CollisionWorld } from './CollisionWorld';

export type SlipEvent = { type: 'payout'; points: number; chain: number; pace: number } | { type: 'tick'; step: number } | null;

/**
 * Slipstream: flying low and fast along building faces builds a draft meter. The meter fills by distance flown in the
 * draft, times draft quality = wall factor (how close the nearest facade is, plus a little for a facade across the
 * street) x speed factor. So speed counts twice (more metres per second, and a stronger draft), a crawl barely fills,
 * the street centre is partial strength and hugging a facade (`hug`) fills fastest. Each full meter pays out points,
 * a slice of boost and half a second on the clock; payouts that follow each other quickly chain up.
 * Above `maxAlt` or well above the roofs there is no draft.
 */
export class Slipstream {
  level = 0; // 0..1 meter
  intensity = 0; // smoothed draft quality 0..1 (drives VFX, audio, HUD glow)
  quality = 0; // raw draft quality this frame (wall factor x speed factor)
  wall = 0; // 0..1 wall factor this frame (HUD: how close the facade is)
  speedFactor = 0; // 0..1 speed factor this frame (HUD: fast enough?)
  rate = 0; // draft metres per second this frame (meter fill speed, HUD rate pips)
  private sincePayout = 0;
  hug = 0; // 0..1: how tight the drone hugs the nearest facade (fills the meter faster)
  firstPayoutAt = -1; // s since the first draft of the run when the first payout came (debug / bots)
  private draftClock = -1;
  chain = 0;
  payouts = 0;
  private paceMetres = 0; // draft metres filled since the last payout
  private paceTime = 0; // s spent drafting since the last payout
  points = 0;
  hotPoints = 0; // always 0 since round 9 (the street multiplier on deliveries was removed); kept for older scripts
  seconds = 0;
  drafting = false;
  private since = 99;
  private lastStep = 0;
  private readonly dir = { x: 0, z: 0 };

  reset(): void {
    this.level = 0;
    this.intensity = 0;
    this.quality = 0;
    this.wall = 0;
    this.speedFactor = 0;
    this.rate = 0;
    this.sincePayout = 0;
    this.hug = 0;
    this.firstPayoutAt = -1;
    this.draftClock = -1;
    this.chain = 0;
    this.payouts = 0;
    this.paceMetres = 0;
    this.paceTime = 0;
    this.points = 0;
    this.hotPoints = 0;
    this.seconds = 0;
    this.drafting = false;
    this.since = 99;
    this.lastStep = 0;
  }

  /** A charged crash knocks the drone out of the draft: meter and chain are lost. */
  lose(): void {
    this.level = 0;
    this.chain = 0;
    this.lastStep = 0;
    this.since = 99;
  }

  update(dt: number, p: THREE.Vector3, speed: number, world: CollisionWorld): SlipEvent {
    const S = SLIPSTREAM;
    let q = 0;
    this.hug = 0;
    this.wall = 0;
    this.speedFactor = 0;
    if (p.y - 0.85 <= S.maxAlt) {
      this.speedFactor = Math.max(0, Math.min(1, (speed - S.minSpeed) / (S.fullSpeed - S.minSpeed)));
      this.wall = this.proximity(p, world);
      q = this.wall * this.speedFactor;
    }
    this.quality = q;
    // the first meter of a run counts speed once, not twice: a new (often touch) pilot drafting at 6 m/s still sees a
    // payout within a couple of seconds, while every later meter needs real speed
    const intro = this.payouts === 0 && speed > S.minSpeed;
    const qFill = intro ? Math.max(q, this.wall * S.introSpeedFloor) : q;
    this.rate = qFill > S.minQuality ? S.fill * qFill * speed * (1 + S.hugBonus * this.hug) : 0;
    this.intensity += (q - this.intensity) * (1 - Math.exp(-6 * dt));
    this.drafting = qFill > S.minQuality;
    let ev: SlipEvent = null;
    if (this.draftClock >= 0) this.draftClock += dt;
    this.sincePayout += dt;
    // a chain only climbs while payouts come quickly: a slow pass loses it
    if (this.chain > 0 && this.sincePayout > S.chainWindow) this.chain = 0;
    if (this.drafting) {
      if (this.draftClock < 0) this.draftClock = 0;
      this.since = 0;
      const size = this.payouts === 0 ? S.introMeter : S.firstMeter + S.meterPerChain * Math.min(this.chain, S.maxChain - 1);
      this.level += (this.rate * dt) / size;
      this.paceMetres += this.rate * dt;
      this.paceTime += dt;
    } else {
      this.since += dt;
      if (this.since > S.grace) this.level = Math.max(0, this.level - S.drain * dt);
      if (this.since > S.chainReset) this.chain = 0;
    }
    if (this.level >= 1) {
      this.level = 0;
      this.lastStep = 0;
      this.sincePayout = 0;
      this.chain = Math.min(this.chain + 1, S.maxChain);
      const points = S.points + S.chainStep * (this.chain - 1);
      this.payouts++;
      if (this.firstPayoutAt < 0) this.firstPayoutAt = this.draftClock;
      // pace: the meter's mean fill rate while drafting for this payout (draft metres a second, the HUD chevron measure)
      const pace = this.paceTime > 0 ? this.paceMetres / this.paceTime : 0;
      this.paceMetres = 0;
      this.paceTime = 0;
      return { type: 'payout', points, chain: this.chain, pace };
    }
    const step = Math.floor(this.level * 4);
    if (step > this.lastStep) ev = { type: 'tick', step };
    this.lastStep = step;
    return ev;
  }

  /**
   * 0..1: nearest facade taller than the drone within `reach` (1 at `full` metres or closer), plus a canyon bonus for
   * a facade on the opposite side. Only building-sized solid boxes count (no trees, lamps or roof clutter).
   */
  private proximity(p: THREE.Vector3, world: CollisionWorld): number {
    const S = SLIPSTREAM;
    const r = S.reach;
    const ids = world.gather(p.x - r, p.z - r, p.x + r, p.z + r);
    let best = r, bx = 0, bz = 0;
    // first pass: nearest face
    for (const i of ids) {
      const b = world.boxes[i];
      if (b.soft || b.maxY < p.y - S.roofSlack || b.minY > p.y + 0.5 || b.maxX - b.minX < 4 || b.maxZ - b.minZ < 4) continue;
      const cx = Math.max(b.minX, Math.min(p.x, b.maxX)), cz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
      const dx = cx - p.x, dz = cz - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.01 || d >= best) continue;
      best = d;
      bx = dx / d;
      bz = dz / d;
    }
    if (best >= r) return 0;
    this.hug = Math.max(0, Math.min(1, (S.hugDist - best) / (S.hugDist - S.hugFull)));
    this.dir.x = bx;
    this.dir.z = bz;
    // second pass: nearest face on the far side of the street
    let across = r;
    for (const i of ids) {
      const b = world.boxes[i];
      if (b.soft || b.maxY < p.y - S.roofSlack || b.minY > p.y + 0.5 || b.maxX - b.minX < 4 || b.maxZ - b.minZ < 4) continue;
      const cx = Math.max(b.minX, Math.min(p.x, b.maxX)), cz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
      const dx = cx - p.x, dz = cz - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.01 || d >= across) continue;
      if ((dx * bx + dz * bz) / d > -0.5) continue;
      across = d;
    }
    const w = (d: number) => Math.max(0, Math.min(1, (r - d) / (r - S.full)));
    return Math.min(1, w(best) + S.canyon * w(across));
  }
}
