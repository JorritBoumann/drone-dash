import * as THREE from 'three';

/**
 * Surface styles understood by the city material shader (see CityMaterial.ts).
 * Facade styles (>= 0) draw procedural windows on vertical faces and a roof
 * treatment on upward faces.
 */
export const Style = {
  punched: 0, // grid of punched windows
  ribbon: 1, // office ribbon windows
  tall: 2, // tall narrow residential windows
  curtain: 3, // glass curtain wall
  plain: -1,
  paving: -2,
  grass: -3,
  roof: -4,
  emissive: -5,
  solar: -6,
  tiles: -7,
  water: -8,
} as const;

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _c = new THREE.Color();

/** Accumulates non-indexed triangles with color / facade-uv / style / seed attributes into one merged geometry. */
export class GeometryBuilder {
  private pos: number[] = [];
  private nor: number[] = [];
  private col: number[] = [];
  private uv: number[] = [];
  private sty: number[] = [];
  private seed: number[] = [];

  get vertexCount(): number {
    return this.pos.length / 3;
  }

  private vert(x: number, y: number, z: number, n: THREE.Vector3, c: THREE.Color, u: number, v: number, s: number, sd: number) {
    this.pos.push(x, y, z);
    this.nor.push(n.x, n.y, n.z);
    this.col.push(c.r, c.g, c.b);
    this.uv.push(u, v);
    this.sty.push(s);
    this.seed.push(sd);
  }

  /** Quad from 4 corners in CCW order (seen from the normal side). */
  quad(
    p: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3],
    n: THREE.Vector3,
    c: THREE.Color,
    uvs: [number, number][],
    style: number,
    seed: number,
  ): void {
    const order = [0, 1, 2, 0, 2, 3];
    for (const i of order) this.vert(p[i].x, p[i].y, p[i].z, n, c, uvs[i][0], uvs[i][1], style, seed);
  }

  tri(a: THREE.Vector3, b: THREE.Vector3, c3: THREE.Vector3, c: THREE.Color, style: number, seed: number, uvs?: [number, number][]): void {
    _n.subVectors(b, a).cross(_v.subVectors(c3, a)).normalize();
    const n = _n.clone();
    const u = uvs ?? [[0, 0], [0, 0], [0, 0]];
    this.vert(a.x, a.y, a.z, n, c, u[0][0], u[0][1], style, seed);
    this.vert(b.x, b.y, b.z, n, c, u[1][0], u[1][1], style, seed);
    this.vert(c3.x, c3.y, c3.z, n, c, u[2][0], u[2][1], style, seed);
  }

  /**
   * Axis-aligned box. Side faces get facade UVs measured in window columns (u)
   * and floors (v) so the shader can draw windows that line up with edges.
   */
  box(
    minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number,
    color: THREE.Color, style: number, seed = 0,
    opts: { floorH?: number; colW?: number; vOffset?: number; bottom?: boolean; sideColor?: THREE.Color } = {},
  ): void {
    const floorH = opts.floorH ?? 3.2;
    const colW = opts.colW ?? 2.7;
    const vOff = opts.vOffset ?? 0;
    const sideColor = opts.sideColor ?? color;
    const v0 = vOff;
    const v1 = vOff + (maxY - minY) / floorH;
    const sides: Array<{ n: [number, number, number]; pts: number[][]; w: number }> = [
      { n: [1, 0, 0], pts: [[maxX, minY, maxZ], [maxX, minY, minZ], [maxX, maxY, minZ], [maxX, maxY, maxZ]], w: maxZ - minZ },
      { n: [-1, 0, 0], pts: [[minX, minY, minZ], [minX, minY, maxZ], [minX, maxY, maxZ], [minX, maxY, minZ]], w: maxZ - minZ },
      { n: [0, 0, 1], pts: [[minX, minY, maxZ], [maxX, minY, maxZ], [maxX, maxY, maxZ], [minX, maxY, maxZ]], w: maxX - minX },
      { n: [0, 0, -1], pts: [[maxX, minY, minZ], [minX, minY, minZ], [minX, maxY, minZ], [maxX, maxY, minZ]], w: maxX - minX },
    ];
    for (const s of sides) {
      const cols = Math.max(1, Math.round(s.w / colW));
      const p = s.pts.map((q) => new THREE.Vector3(q[0], q[1], q[2])) as [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3];
      this.quad(p, new THREE.Vector3(...s.n), sideColor, [[0, v0], [cols, v0], [cols, v1], [0, v1]], style, seed);
    }
    // top
    this.quad(
      [new THREE.Vector3(minX, maxY, maxZ), new THREE.Vector3(maxX, maxY, maxZ), new THREE.Vector3(maxX, maxY, minZ), new THREE.Vector3(minX, maxY, minZ)],
      new THREE.Vector3(0, 1, 0), color,
      [[minX, maxZ], [maxX, maxZ], [maxX, minZ], [minX, minZ]], style, seed,
    );
    if (opts.bottom) {
      this.quad(
        [new THREE.Vector3(minX, minY, minZ), new THREE.Vector3(maxX, minY, minZ), new THREE.Vector3(maxX, minY, maxZ), new THREE.Vector3(minX, minY, maxZ)],
        new THREE.Vector3(0, -1, 0), color,
        [[0, 0], [0, 0], [0, 0], [0, 0]], style, seed,
      );
    }
  }

  /** Gabled roof over a footprint; ridge runs along the longer axis. */
  gable(minX: number, minZ: number, maxX: number, maxZ: number, y0: number, rise: number, overhang: number, roofColor: THREE.Color, wallColor: THREE.Color, seed: number): void {
    const alongX = maxX - minX >= maxZ - minZ;
    const o = overhang;
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    if (alongX) {
      const zc = (minZ + maxZ) / 2;
      const ry = y0 + rise;
      const a = V(minX - o, y0 - o * 0.5, minZ - o), b = V(maxX + o, y0 - o * 0.5, minZ - o);
      const c = V(maxX + o, ry, zc), d = V(minX - o, ry, zc);
      const e = V(minX - o, y0 - o * 0.5, maxZ + o), f = V(maxX + o, y0 - o * 0.5, maxZ + o);
      const slope = Math.hypot(zc - minZ + o, rise + o * 0.5);
      const len = maxX - minX + 2 * o;
      this.tri(a, c, b, roofColor, Style.tiles, seed, [[0, 0], [len, slope], [len, 0]]);
      this.tri(a, d, c, roofColor, Style.tiles, seed, [[0, 0], [0, slope], [len, slope]]);
      this.tri(e, f, c, roofColor, Style.tiles, seed, [[0, 0], [len, 0], [len, slope]]);
      this.tri(e, c, d, roofColor, Style.tiles, seed, [[0, 0], [len, slope], [0, slope]]);
      // gable ends
      this.tri(V(minX, y0, minZ), V(minX, y0, maxZ), V(minX, ry - o * 0.3, zc), wallColor, Style.plain, seed);
      this.tri(V(maxX, y0, maxZ), V(maxX, y0, minZ), V(maxX, ry - o * 0.3, zc), wallColor, Style.plain, seed);
    } else {
      const xc = (minX + maxX) / 2;
      const ry = y0 + rise;
      const a = V(minX - o, y0 - o * 0.5, maxZ + o), b = V(minX - o, y0 - o * 0.5, minZ - o);
      const c = V(xc, ry, minZ - o), d = V(xc, ry, maxZ + o);
      const e = V(maxX + o, y0 - o * 0.5, maxZ + o), f = V(maxX + o, y0 - o * 0.5, minZ - o);
      const slope = Math.hypot(xc - minX + o, rise + o * 0.5);
      const len = maxZ - minZ + 2 * o;
      this.tri(a, c, b, roofColor, Style.tiles, seed, [[0, 0], [len, slope], [len, 0]]);
      this.tri(a, d, c, roofColor, Style.tiles, seed, [[0, 0], [0, slope], [len, slope]]);
      this.tri(e, f, c, roofColor, Style.tiles, seed, [[0, 0], [len, 0], [len, slope]]);
      this.tri(e, c, d, roofColor, Style.tiles, seed, [[0, 0], [len, slope], [0, slope]]);
      this.tri(V(maxX, y0, minZ), V(minX, y0, minZ), V(xc, ry - o * 0.3, minZ), wallColor, Style.plain, seed);
      this.tri(V(minX, y0, maxZ), V(maxX, y0, maxZ), V(xc, ry - o * 0.3, maxZ), wallColor, Style.plain, seed);
    }
  }

  /** Append an arbitrary three.js geometry (transformed) with a flat color/style. */
  append(geo: THREE.BufferGeometry, matrix: THREE.Matrix4, color: THREE.Color, style: number, seed = 0): void {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(matrix);
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const uv = g.getAttribute('uv');
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i);
      _n.fromBufferAttribute(n, i);
      const u = uv ? uv.getX(i) : 0;
      const w = uv ? uv.getY(i) : 0;
      this.vert(_v.x, _v.y, _v.z, _n, color, u, w, style, seed);
    }
    g.dispose();
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aStyle', new THREE.Float32BufferAttribute(this.sty, 1));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(this.seed, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

export function color(hex: string, jitter = 0, rng?: () => number): THREE.Color {
  const c = new THREE.Color(hex);
  if (jitter > 0 && rng) {
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    c.setHSL(hsl.h + (rng() - 0.5) * jitter * 0.08, Math.min(1, Math.max(0, hsl.s + (rng() - 0.5) * jitter * 0.2)), Math.min(1, Math.max(0, hsl.l + (rng() - 0.5) * jitter * 0.12)));
  }
  return c;
}

export { _c as scratchColor };
