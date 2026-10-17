import * as THREE from 'three';
import type { Box } from '../world/CityGenerator';

export type Contact = { normal: THREE.Vector3; depth: number };

/**
 * Round 32: a box that turns about y and can move every frame (boat hulls, masts, the marina docks). Centre (x, z),
 * yaw as sin / cos (local z is the bow), half sizes along the beam (hx) and the length (hz), and its height range.
 * The sphere never leaves one of these downwards, so a boat can only push the drone sideways or up, never into the sea.
 */
export type DynBox = { x: number; z: number; s: number; c: number; hx: number; hz: number; y0: number; y1: number; soft: boolean; on: boolean; vx: number; vz: number };

/** Uniform-grid broadphase over static AABBs with sphere resolution and segment casts. */
export class CollisionWorld {
  private readonly cell = 12;
  private readonly grid = new Map<number, number[]>();
  private readonly stamp: Int32Array;
  private query = 0;
  private readonly candidates: number[] = [];
  /** True when the deepest contact of the last resolveSphere call was a soft prop (tree, lamp post). */
  deepestSoft = false;
  /** Round 32: turning / moving boxes (boats), checked every query (there are only a few dozen). */
  readonly dynamic: DynBox[] = [];
  /** True when the deepest contact of the last resolveSphere call was a moving box (a boat). */
  deepestDynamic = false;
  /** That box (valid while deepestDynamic is true): its velocity and heading. */
  deepestBox: DynBox | null = null;
  /** The moving box face that pushes hardest into the sphere in the last resolveSphere call (face speed > 0), its
   * outward normal and that face speed; null when no boat face is closing in. */
  pushBox: DynBox | null = null;
  readonly pushNormal = new THREE.Vector3();
  pushSpeed = 0;

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
    this.deepestDynamic = false;
    this.pushBox = null;
    this.pushSpeed = 0;
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
          this.deepestDynamic = false;
        }
        any = true;
      }
      for (const b of this.dynamic) {
        if (!b.on) continue;
        const ox = p.x - b.x, oz = p.z - b.z, reach = b.hx + b.hz + r;
        if (ox > reach || ox < -reach || oz > reach || oz < -reach || p.y > b.y1 + r || p.y < b.y0 - r) continue;
        // into the box frame: lx along the beam, lz along the bow
        const lx = ox * b.c - oz * b.s, lz = ox * b.s + oz * b.c;
        const cx = Math.max(-b.hx, Math.min(lx, b.hx)), cy = Math.max(b.y0, Math.min(p.y, b.y1)), cz = Math.max(-b.hz, Math.min(lz, b.hz));
        let nx = lx - cx, ny = p.y - cy, nz = lz - cz;
        const d2 = nx * nx + ny * ny + nz * nz;
        if (d2 >= r * r) continue;
        let depth: number;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          depth = r - d;
          nx /= d; ny /= d; nz /= d;
        } else {
          // centre inside: leave by the nearest side or the top, never downwards
          const ex = [lx + b.hx, b.hx - lx, b.y1 - p.y, lz + b.hz, b.hz - lz];
          let m = 0;
          for (let k = 1; k < 5; k++) if (ex[k] < ex[m]) m = k;
          nx = m === 0 ? -1 : m === 1 ? 1 : 0;
          ny = m === 2 ? 1 : 0;
          nz = m === 3 ? -1 : m === 4 ? 1 : 0;
          depth = ex[m] + r;
        }
        if (ny < 0) { // under a hull's bottom (below the sea): slide out sideways instead
          const hl = Math.hypot(nx, nz) || 1;
          nx /= hl; nz /= hl; ny = 0;
        }
        // back to world: local x is the beam (c, -s), local z the bow (s, c)
        const wx = nx * b.c + nz * b.s, wz = -nx * b.s + nz * b.c;
        p.x += wx * depth;
        p.y += ny * depth;
        p.z += wz * depth;
        const fv = b.vx * wx + b.vz * wz;
        if (fv > this.pushSpeed) { this.pushSpeed = fv; this.pushBox = b; this.pushNormal.set(wx, ny, wz); }
        if (depth > deepest) {
          deepest = depth;
          outNormal.set(wx, ny, wz);
          this.deepestSoft = b.soft;
          this.deepestDynamic = true;
          this.deepestBox = b;
        }
        any = true;
      }
      if (!any) break;
    }
    return deepest;
  }

  /** Round 32: the moving box (boat part) whose footprint holds (x, z) and whose top is the highest at or below y. */
  private dynamicTop(x: number, y: number, z: number, best: number): number {
    for (const b of this.dynamic) {
      if (!b.on || b.y1 > y + 0.01 || b.y1 <= best) continue;
      const ox = x - b.x, oz = z - b.z;
      const lx = ox * b.c - oz * b.s, lz = ox * b.s + oz * b.c;
      if (lx < -b.hx || lx > b.hx || lz < -b.hz || lz > b.hz) continue;
      best = b.y1;
    }
    return best;
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
    return this.dynamic.length ? this.dynamicTop(x, y, z, best) : best;
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

  /**
   * Round 21: move a point out of any solid box grown by `pad` (shallowest exit), so the camera never sits inside a
   * wall or close enough for the near plane to cut into it. Soft props (trees, lamps) are skipped. Returns true if moved.
   */
  pushOutPoint(p: THREE.Vector3, pad: number): boolean {
    let moved = false;
    for (let iter = 0; iter < 3; iter++) {
      let any = false;
      const ids = this.gather(p.x - pad, p.z - pad, p.x + pad, p.z + pad);
      for (const i of ids) {
        const b = this.boxes[i];
        if (b.soft) continue;
        const x0 = b.minX - pad, x1 = b.maxX + pad, y0 = b.minY - pad, y1 = b.maxY + pad, z0 = b.minZ - pad, z1 = b.maxZ + pad;
        if (p.x <= x0 || p.x >= x1 || p.y <= y0 || p.y >= y1 || p.z <= z0 || p.z >= z1) continue;
        const ex = [p.x - x0, x1 - p.x, p.y - y0, y1 - p.y, p.z - z0, z1 - p.z];
        // never push down through the street (boxes resting on the ground)
        if (b.minY <= this.floorY + 0.01) ex[2] = Infinity;
        let m = 0;
        for (let k = 1; k < 6; k++) if (ex[k] < ex[m]) m = k;
        const e = ex[m] + 0.01;
        if (m === 0) p.x -= e; else if (m === 1) p.x += e; else if (m === 2) p.y -= e; else if (m === 3) p.y += e; else if (m === 4) p.z -= e; else p.z += e;
        any = moved = true;
      }
      if (!any) break;
    }
    return moved;
  }
}
