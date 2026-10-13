import * as THREE from 'three';
import type { Box } from '../world/CityGenerator';

export type Contact = { normal: THREE.Vector3; depth: number };

/** Uniform-grid broadphase over static AABBs with sphere resolution and segment casts. */
export class CollisionWorld {
  private readonly cell = 12;
  private readonly grid = new Map<number, number[]>();
  private readonly stamp: Int32Array;
  private query = 0;
  private readonly candidates: number[] = [];
  /** True when the deepest contact of the last resolveSphere call was a soft prop (tree, lamp post). */
  deepestSoft = false;

  constructor(readonly boxes: Box[], readonly floorY = 0) {
    this.stamp = new Int32Array(boxes.length);
    boxes.forEach((b, i) => {
      const x0 = Math.floor(b.minX / this.cell), x1 = Math.floor(b.maxX / this.cell);
      const z0 = Math.floor(b.minZ / this.cell), z1 = Math.floor(b.maxZ / this.cell);
      for (let x = x0; x <= x1; x++) {
        for (let z = z0; z <= z1; z++) {
          const k = this.key(x, z);
          let list = this.grid.get(k);
          if (!list) this.grid.set(k, (list = []));
          list.push(i);
        }
      }
    });
  }

  private key(x: number, z: number): number {
    return (x + 1024) * 4096 + (z + 1024);
  }

  /** Collect box indices overlapping the XZ rectangle (deduplicated). */
  gather(minX: number, minZ: number, maxX: number, maxZ: number): number[] {
    this.query++;
    const out = this.candidates;
    out.length = 0;
    const x0 = Math.floor(minX / this.cell), x1 = Math.floor(maxX / this.cell);
    const z0 = Math.floor(minZ / this.cell), z1 = Math.floor(maxZ / this.cell);
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const list = this.grid.get(this.key(x, z));
        if (!list) continue;
        for (const i of list) {
          if (this.stamp[i] === this.query) continue;
          this.stamp[i] = this.query;
          out.push(i);
        }
      }
    }
    return out;
  }

  /**
   * Push a sphere out of all overlapping boxes. Returns the deepest contact
   * (normal points away from the obstacle) or null.
   */
  resolveSphere(p: THREE.Vector3, r: number, outNormal: THREE.Vector3): number {
    let deepest = 0;
    outNormal.set(0, 0, 0);
    this.deepestSoft = false;
    // a few iterations so corners between boxes settle
    for (let iter = 0; iter < 3; iter++) {
      let any = false;
      const ids = this.gather(p.x - r, p.z - r, p.x + r, p.z + r);
      for (const i of ids) {
        const b = this.boxes[i];
        const cx = Math.max(b.minX, Math.min(p.x, b.maxX));
        const cy = Math.max(b.minY, Math.min(p.y, b.maxY));
        const cz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
        let dx = p.x - cx, dy = p.y - cy, dz = p.z - cz;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= r * r) continue;
        let depth: number;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          depth = r - d;
          dx /= d; dy /= d; dz /= d;
        } else {
          // centre inside the box: exit along the shallowest axis
          const ex = [p.x - b.minX, b.maxX - p.x, p.y - b.minY, b.maxY - p.y, p.z - b.minZ, b.maxZ - p.z];
          let m = 0;
          for (let k = 1; k < 6; k++) if (ex[k] < ex[m]) m = k;
          dx = m === 0 ? -1 : m === 1 ? 1 : 0;
          dy = m === 2 ? -1 : m === 3 ? 1 : 0;
          dz = m === 4 ? -1 : m === 5 ? 1 : 0;
          depth = ex[m] + r;
        }
        p.x += dx * depth;
        p.y += dy * depth;
        p.z += dz * depth;
        if (depth > deepest) {
          deepest = depth;
          outNormal.set(dx, dy, dz);
          this.deepestSoft = !!b.soft;
        }
        any = true;
      }
      if (!any) break;
    }
    return deepest;
  }

  /** Highest surface directly below a point (for contact shadow + landing reads). */
  surfaceBelow(x: number, y: number, z: number): number {
    let best = this.floorY;
    const ids = this.gather(x, z, x, z);
    for (const i of ids) {
      const b = this.boxes[i];
      if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue;
      if (b.maxY <= y + 0.01 && b.maxY > best) best = b.maxY;
    }
    return best;
  }

  /**
   * Fraction [0..1] along segment a->b where it first enters any box (slab test),
   * used to keep the chase camera out of buildings.
   */
  segmentFraction(a: THREE.Vector3, b: THREE.Vector3, pad = 0.4, includeSoft = true): number {
    const minX = Math.min(a.x, b.x) - pad, maxX = Math.max(a.x, b.x) + pad;
    const minZ = Math.min(a.z, b.z) - pad, maxZ = Math.max(a.z, b.z) + pad;
    const ids = this.gather(minX, minZ, maxX, maxZ);
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    let best = 1;
    for (const i of ids) {
      const box = this.boxes[i];
      if (!includeSoft && box.soft) continue;
      let t0 = 0, t1 = 1;
      const axes: Array<[number, number, number, number]> = [
        [a.x, dx, box.minX - pad, box.maxX + pad],
        [a.y, dy, box.minY - pad, box.maxY + pad],
        [a.z, dz, box.minZ - pad, box.maxZ + pad],
      ];
      let hit = true;
      for (const [o, d, mn, mx] of axes) {
        if (Math.abs(d) < 1e-9) {
          if (o < mn || o > mx) { hit = false; break; }
          continue;
        }
        let ta = (mn - o) / d, tb = (mx - o) / d;
        if (ta > tb) { const t = ta; ta = tb; tb = t; }
        t0 = Math.max(t0, ta);
        t1 = Math.min(t1, tb);
        if (t0 > t1) { hit = false; break; }
      }
      if (hit && t0 < best) best = t0;
    }
    return best;
  }
}
