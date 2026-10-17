import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PROP, PROP_NAMES, type CityLayout, type PropSpec } from './CityGenerator';
import type { ModelParts } from './StreetAssets';

/**
 * Round 28: street furniture. CC0 models (Kay Lousberg, Kenney, Quaternius, CreativeTrio, Isa Lousberg via Poly Pizza)
 * plus three small procedural pieces (bike rack, bus-stop pole, planter shrub). All kinds share one BatchedMesh, so the
 * whole set is one draw call (plus its shadow pass). Instances further than `range` from the camera are switched off.
 * Nothing here collides: every piece is small and sits in the curb strip with the lamps and trees.
 */
export class StreetProps {
  /** Round 28: one InstancedMesh per kind (a BatchedMesh was tried: without WEBGL_multi_draw it falls back to one draw per piece). */
  readonly mesh = new THREE.Group();
  private readonly kinds = new Map<number, { mesh: THREE.InstancedMesh; specs: number[] }>();
  private readonly specs: PropSpec[];
  private readonly matrices: THREE.Matrix4[] = [];
  private lastX = 1e9;
  private lastZ = 1e9;
  private lastY = 1e9;
  visible = 0;

  constructor(specs: PropSpec[], parts: ModelParts, private readonly range: number) {
    this.specs = specs;
    this.mesh.name = 'street-props';
    const geos = new Map<number, THREE.BufferGeometry>();
    const pick = (name: string) => parts.get(name)?.get('all');
    const add = (kind: number, g: THREE.BufferGeometry | undefined) => { if (g) geos.set(kind, prep(g)); };
    add(PROP.bench, pick('prop_bench'));
    add(PROP.bin, pick('prop_bin'));
    add(PROP.hydrant, pick('prop_hydrant'));
    add(PROP.bollard, pick('prop_bollard'));
    const pot = pick('prop_planter');
    if (pot) add(PROP.planter, mergeGeometries([prep(pot), shrub()])!);
    add(PROP.table, pick('prop_table'));
    add(PROP.chair, pick('prop_chair'));
    add(PROP.aboard, pick('prop_aboard'));
    add(PROP.bikerack, bikeRack());
    add(PROP.busstop, busStop());
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.08 });
    const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    specs.forEach((s, i) => {
      this.matrices.push(new THREE.Matrix4().compose(p.set(s.x, s.y, s.z), q.setFromAxisAngle(up, s.rot), one));
      const g = geos.get(s.kind);
      if (!g) return;
      let k = this.kinds.get(s.kind);
      if (!k) {
        const cap = specs.filter((o) => o.kind === s.kind).length;
        const m = new THREE.InstancedMesh(g, material, cap);
        m.name = `street-props-${PROP_NAMES[s.kind]}`;
        m.count = 0;
        m.frustumCulled = false;
        // small, thin pieces cast no shadow (fewer shadow draws)
        m.castShadow = s.kind !== PROP.bollard && s.kind !== PROP.hydrant && s.kind !== PROP.chair && s.kind !== PROP.busstop;
        m.receiveShadow = true;
        k = { mesh: m, specs: [] };
        this.kinds.set(s.kind, k);
        this.mesh.add(m);
      }
      k.specs.push(i);
    });
  }

  /** Draw only the pieces within `range` of the camera (re-checked when the camera has moved 3 m). */
  update(cam: THREE.Vector3): void {
    if (Math.hypot(cam.x - this.lastX, cam.z - this.lastZ) < 3 && Math.abs(cam.y - this.lastY) < 3) return;
    this.lastX = cam.x; this.lastZ = cam.z; this.lastY = cam.y;
    // from higher up the props are specks: the range shrinks from 18 m of camera height (to 0.35 of it at 63 m)
    const r = this.range * (cam.y > 18 ? Math.max(0.35, 1 - (cam.y - 18) / 70) : 1);
    const r2 = r * r;
    let n = 0;
    for (const k of this.kinds.values()) {
      let c = 0;
      for (const i of k.specs) {
        const s = this.specs[i];
        const dx = s.x - cam.x, dz = s.z - cam.z;
        if (dx * dx + dz * dz < r2) k.mesh.setMatrixAt(c++, this.matrices[i]);
      }
      k.mesh.count = c;
      k.mesh.instanceMatrix.needsUpdate = true;
      n += c;
    }
    this.visible = n;
  }

  set castShadow(on: boolean) { for (const k of this.kinds.values()) k.mesh.castShadow = on; }
}

/** Kind counts within `r` of a point (test hook), and the curb length inside that circle, per 10 m. */
export function propAudit(specs: PropSpec[], layout: { roadCenters: number[]; blockSize: number; roadWidth: number; half: number }, x: number, z: number, r: number) {
  const kinds: Record<string, number> = {};
  let count = 0;
  for (const s of specs) {
    if (Math.hypot(s.x - x, s.z - z) > r) continue;
    // a cafe set (table + chairs) counts as one piece; chairs are listed but not counted twice
    kinds[PROP_NAMES[s.kind]] = (kinds[PROP_NAMES[s.kind]] ?? 0) + 1;
    if (s.kind !== PROP.chair) count++;
  }
  // sidewalk length: each block edge is one pavement; clip it to the circle (sampled every 0.5 m)
  const { blockSize: B, roadWidth: R, half } = layout;
  const blocks = layout.roadCenters.length - 1;
  let len = 0;
  for (let bi = 0; bi < blocks; bi++) for (let bj = 0; bj < blocks; bj++) {
    const x0 = -half + R + bi * (B + R), z0 = -half + R + bj * (B + R), x1 = x0 + B, z1 = z0 + B;
    for (const [ax, az, bx, bz] of [[x0, z0, x1, z0], [x0, z1, x1, z1], [x0, z0, x0, z1], [x1, z0, x1, z1]]) {
      for (let t = 0.25; t < B; t += 0.5) {
        const px = ax + (bx - ax) * (t / B), pz = az + (bz - az) * (t / B);
        if (Math.hypot(px - x, pz - z) <= r) len += 0.5;
      }
    }
  }
  const kindCount = Object.keys(kinds).filter((k) => k !== 'chair').length;
  return { count, kinds, kindCount, pavementM: Math.round(len), perTenM: len > 0 ? +(count / (len / 10)).toFixed(2) : 0 };
}

// ------------------------------------------------------------------------------------------------------------------

/** Non-indexed copy with only position / normal / colour, then a plain index (BatchedMesh wants every geometry alike). */
function prep(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') n.deleteAttribute(k);
  if (!n.getAttribute('normal')) n.computeVertexNormals();
  if (!n.getAttribute('color')) {
    const c = new Float32Array(n.getAttribute('position').count * 3).fill(1);
    n.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  const cnt = n.getAttribute('position').count;
  n.setIndex(Array.from({ length: cnt }, (_, i) => i));
  return n;
}

function tint(g: THREE.BufferGeometry, hex: string): THREE.BufferGeometry {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
  n.computeVertexNormals();
  const c = new THREE.Color(hex);
  const cnt = n.getAttribute('position').count;
  const a = new Float32Array(cnt * 3);
  for (let i = 0; i < cnt; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  n.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return n;
}

/** A clipped box shrub sitting in the planter pot (pot rim at about 0.56 m). */
function shrub(): THREE.BufferGeometry {
  const parts = [
    tint(new THREE.IcosahedronGeometry(0.34, 1).scale(1, 0.75, 1).translate(0, 0.72, 0), '#4f7a3a'),
    tint(new THREE.IcosahedronGeometry(0.22, 0).translate(0.12, 0.9, 0.05), '#5f8c42'),
    tint(new THREE.IcosahedronGeometry(0.18, 0).translate(-0.14, 0.86, -0.08), '#46703a'),
  ];
  return prep(mergeGeometries(parts)!);
}

/** Three steel hoops in a row along the curb (x), 0.8 m tall. */
function bikeRack(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const x of [-0.75, 0, 0.75]) {
    const hoop = new THREE.TorusGeometry(0.32, 0.03, 4, 10, Math.PI).translate(0, 0.48, 0).rotateY(Math.PI / 2);
    parts.push(tint(hoop.translate(x, 0, 0), '#3b4650'));
    for (const z of [-0.32, 0.32]) parts.push(tint(new THREE.CylinderGeometry(0.03, 0.03, 0.48, 5).translate(x, 0.24, z), '#3b4650'));
  }
  return prep(mergeGeometries(parts)!);
}

/** A bus-stop pole: a post with a round sign and a timetable box. */
function busStop(): THREE.BufferGeometry {
  const parts = [
    tint(new THREE.CylinderGeometry(0.045, 0.05, 2.7, 6).translate(0, 1.35, 0), '#4a535c'),
    tint(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 14).rotateX(Math.PI / 2).translate(0, 2.55, 0), '#d9dde0'),
    tint(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 14).rotateX(Math.PI / 2).translate(0, 2.55, 0), '#c8553d'),
    tint(new THREE.BoxGeometry(0.34, 0.08, 0.07).translate(0, 2.55, 0), '#f4efe6'),
    tint(new THREE.BoxGeometry(0.32, 0.5, 0.06).translate(0, 1.45, 0.05), '#e9c46a'),
  ];
  return prep(mergeGeometries(parts)!);
}

/** Footprint radius (m) per kind, for the placement audit. */
const PROP_R = [0.9, 0.3, 0.25, 0.12, 0.45, 0.45, 0.25, 0.35, 0.95, 0.1];
/** Half depth (m) across the curb per kind (benches and bike racks lie along it), for the road check. */
const PROP_ACROSS = [0.33, 0.3, 0.25, 0.12, 0.45, 0.45, 0.25, 0.35, 0.36, 0.1];

/**
 * Round 28 test hook: street furniture on a pad (any ground site, its radius plus the prop's footprint), in an alley or
 * tunnel corridor, on the diagonal avenue, out over a road, or touching a lamp post or tree trunk. All should be 0.
 */
export function propPlacementAudit(layout: CityLayout): { props: number; padHits: number; alleyHits: number; diagHits: number; roadHits: number; poleHits: number; kinds: Record<string, number> } {
  const { blockSize: B, roadWidth: R, half, roadCenters } = layout;
  const corridors = layout.alleys.map((a) => {
    const cx = roadCenters[a.bi] + R / 2 + B / 2, cz = roadCenters[a.bj] + R / 2 + B / 2, w = a.width / 2 + 0.3;
    return a.axis === 'z' ? [cx - w, cz - B / 2 - R / 2, cx + w, cz + B / 2 + R / 2] : [cx - B / 2 - R / 2, cz - w, cx + B / 2 + R / 2, cz + w];
  });
  const onRoad = (v: number) => { const m = ((v + half) % (B + R) + (B + R)) % (B + R); return m < R - 0.02; };
  const pads = layout.sites.filter((s) => s.pos.y < 4);
  let padHits = 0, alleyHits = 0, diagHits = 0, roadHits = 0, poleHits = 0;
  const kinds: Record<string, number> = {};
  for (const p of layout.props) {
    const r = PROP_R[p.kind] ?? 0.5;
    kinds[PROP_NAMES[p.kind]] = (kinds[PROP_NAMES[p.kind]] ?? 0) + 1;
    if (pads.some((s) => Math.hypot(s.pos.x - p.x, s.pos.z - p.z) < s.radius + r)) padHits++;
    if (corridors.some(([a, b, c, d]) => p.x + r > a && p.x - r < c && p.z + r > b && p.z - r < d)) alleyHits++;
    if (layout.boulevards.some((bv) => Math.abs(p.z - bv.s * p.x - bv.c) / Math.SQRT2 < bv.halfWidth + r)) diagHits++;
    const ra = PROP_ACROSS[p.kind] ?? r;
    if ([[ra, 0], [-ra, 0], [0, ra], [0, -ra]].some(([dx, dz]) => onRoad(p.x + dx) || onRoad(p.z + dz))) roadHits++;
    if (layout.lamps.some((l) => Math.hypot(l.x - p.x, l.z - p.z) < r + 0.25) || layout.trees.some((t) => Math.hypot(t.x - p.x, t.z - p.z) < r + 0.3)) poleHits++;
  }
  return { props: layout.props.length, padHits, alleyHits, diagHits, roadHits, poleHits, kinds };
}
