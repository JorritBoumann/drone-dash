import type * as THREE from 'three';
import { SLIPSTREAM } from '../game/config';
import type { CollisionWorld } from './CollisionWorld';

export type SlipEvent = { type: 'payout'; points: number; chain: number } | { type: 'tick'; step: number } | null;

/**
 * Slipstream: flying low and fast along building faces builds a draft meter. Each full meter pays out
 * points, a slice of boost and a second on the clock, and consecutive payouts without leaving the street chain up.
 * Quality of the draft = how close the nearest taller facade is (a second facade across the street adds a canyon
 * bonus) times how fast the drone is moving. Above `maxAlt` or above the roofs there is no draft.
 */
export class Slipstream {
  level = 0; // 0..1 meter
  intensity = 0; // smoothed draft quality 0..1 (drives VFX, audio, HUD glow)
  quality = 0; // raw draft quality this frame
  chain = 0;
  payouts = 0;
  points = 0;
  seconds = 0;
  drafting = false;
  private since = 99;
  private lastStep = 0;
  private readonly dir = { x: 0, z: 0 };

  reset(): void {
    this.level = 0;
    this.intensity = 0;
    this.quality = 0;
    this.chain = 0;
    this.payouts = 0;
    this.points = 0;
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
    if (p.y - 0.85 <= S.maxAlt && speed > S.minSpeed) {
      const sf = Math.min(1, (speed - S.minSpeed) / (S.fullSpeed - S.minSpeed));
      q = this.proximity(p, world) * sf;
    }
    this.quality = q;
    this.intensity += (q - this.intensity) * (1 - Math.exp(-6 * dt));
    this.drafting = q > S.minQuality;
    let ev: SlipEvent = null;
    if (this.drafting) {
      this.since = 0;
      this.level += S.fill * q * dt;
    } else {
      this.since += dt;
      if (this.since > S.grace) this.level = Math.max(0, this.level - S.drain * dt);
      if (this.since > S.chainReset) this.chain = 0;
    }
    if (this.level >= 1) {
      this.level = 0;
      this.lastStep = 0;
      this.chain = Math.min(this.chain + 1, S.maxChain);
      const points = S.points + S.chainStep * (this.chain - 1);
      this.payouts++;
      return { type: 'payout', points, chain: this.chain };
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
      if (b.soft || b.maxY < p.y + 0.5 || b.minY > p.y + 0.5 || b.maxX - b.minX < 4 || b.maxZ - b.minZ < 4) continue;
      const cx = Math.max(b.minX, Math.min(p.x, b.maxX)), cz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
      const dx = cx - p.x, dz = cz - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.01 || d >= best) continue;
      best = d;
      bx = dx / d;
      bz = dz / d;
    }
    if (best >= r) return 0;
    this.dir.x = bx;
    this.dir.z = bz;
    // second pass: nearest face on the far side of the street
    let across = r;
    for (const i of ids) {
      const b = world.boxes[i];
      if (b.soft || b.maxY < p.y + 0.5 || b.minY > p.y + 0.5 || b.maxX - b.minX < 4 || b.maxZ - b.minZ < 4) continue;
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
