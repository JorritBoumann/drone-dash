import * as THREE from 'three';

/**
 * Round 33: draw only the first `mesh.userData.shadowCount` instances in the sun's shadow pass (the owner writes its
 * instances nearest first). The shadow map only covers the city round the drone, so instances far outside it cost
 * triangles for nothing. A shadow count of 0 skips the shadow draw call entirely (three.js skips zero-instance draws).
 * Without a shadowCount set, the mesh casts as before.
 */
export function shadowSubset(mesh: THREE.InstancedMesh): void {
  let full = 0;
  mesh.onBeforeShadow = () => {
    full = mesh.count;
    const n = mesh.userData.shadowCount as number | undefined;
    if (n !== undefined) mesh.count = Math.min(full, n);
  };
  mesh.onAfterShadow = () => { mesh.count = full; };
}

/** Shadow-casting radius (m, horizontal from the camera) for small and mid-size props. */
export const SHADOW_NEAR = 45;
/** Shadow-casting radius for tall things (lamps, trees): the shadow box (±75 m) plus a long low-sun shadow. */
export const SHADOW_FAR = 115;

/**
 * Round 33: the merged city in the shadow pass. The sun's shadow camera is an ortho box ±extent wide across the sun's
 * horizontal direction (its right axis is horizontal), so a triangle further than `extent` across that axis from the
 * shadow focus can never land in the shadow map. The city's triangles are sorted once by that cross-sun coordinate and
 * the shadow pass draws only the contiguous slab round the focus. Long faces turned to the sky and long paint strips go
 * last and are left out (the shadow pass culls the first anyway; the second are 4 cm high). Checked with slabVerify: no left-out triangle touches the shadow frustum.
 */
export function shadowSlab(mesh: THREE.Mesh, sun: THREE.Vector3, extent: number, focus: () => THREE.Vector3): void {
  const g = mesh.geometry;
  if (g.index) return;
  const hl = Math.hypot(sun.x, sun.z);
  if (hl < 1e-3) return;
  const ux = -sun.z / hl, uz = sun.x / hl;
  const pos = g.getAttribute('position');
  const nt = Math.floor(pos.count / 3);
  const nor = g.getAttribute('normal');
  const lo = new Float32Array(nt), hi = new Float32Array(nt), up = new Float32Array(nt), top = new Float32Array(nt);
  for (let t = 0; t < nt; t++) {
    let a = Infinity, b = -Infinity, ny = 0, y = -Infinity;
    for (let k = 0; k < 3; k++) {
      const i = t * 3 + k, u = ux * pos.getX(i) + uz * pos.getZ(i);
      a = Math.min(a, u); b = Math.max(b, u); ny += nor ? nor.getY(i) / 3 : 0; y = Math.max(y, pos.getY(i));
    }
    lo[t] = a; hi[t] = b; up[t] = ny; top[t] = y;
  }
  const LONG = 70;
  const keep: number[] = [], skip: number[] = [];
  let margin = 0;
  const longKept: number[][] = [];
  for (let t = 0; t < nt; t++) {
    // a long face turned up to the sky (ground slab, plaza) is a front face to the sun: the shadow pass (back faces for
    // front-sided materials) never draws it anyway, so leaving it out changes nothing. Nor does a long paint strip on
    // the road (the diagonal boulevard's, 4 cm high).
    if (hi[t] - lo[t] > LONG && (up[t] > 0.5 || top[t] <= 0.1)) { skip.push(t); continue; }
    keep.push(t);
    margin = Math.max(margin, (hi[t] - lo[t]) / 2);
    if (hi[t] - lo[t] > LONG) longKept.push([+(hi[t] - lo[t]).toFixed(0), +up[t].toFixed(2), +pos.getX(t * 3).toFixed(0), +pos.getY(t * 3).toFixed(1), +pos.getZ(t * 3).toFixed(0), +Math.max(pos.getY(t * 3), pos.getY(t * 3 + 1), pos.getY(t * 3 + 2)).toFixed(2)]);
  }
  const mid = (t: number) => (lo[t] + hi[t]) / 2;
  keep.sort((a, b) => mid(a) - mid(b));
  const order = keep.concat(skip);
  for (const name of Object.keys(g.attributes)) {
    const attr = g.getAttribute(name) as THREE.BufferAttribute;
    const s = attr.itemSize * 3, src = attr.array as Float32Array, dst = new Float32Array(src.length);
    order.forEach((t, j) => dst.set(src.subarray(t * s, t * s + s), j * s));
    attr.array = dst;
    attr.needsUpdate = true;
  }
  const centres = Float32Array.from(keep, mid);
  const bound = (v: number) => { let a = 0, b = centres.length; while (a < b) { const m = (a + b) >> 1; if (centres[m] < v) a = m + 1; else b = m; } return a; };
  const reach = extent + margin + 2;
  mesh.userData.slab = { triangles: nt, sorted: keep.length, skipped: skip.length, margin: +margin.toFixed(1), drawn: 0, longKept: longKept.slice(0, 12) };
  let lastCam: THREE.Camera | null = null, lastA = 0, lastB = 0;
  mesh.onBeforeShadow = (_r, _o, _c, shadowCamera) => {
    const f = focus(), uf = ux * f.x + uz * f.z;
    const a = bound(uf - reach), b = bound(uf + reach);
    g.setDrawRange(a * 3, (b - a) * 3);
    mesh.userData.slab.drawn = b - a;
    lastCam = shadowCamera; lastA = a; lastB = b;
  };
  // test hook: how many of the left-out triangles touch the last shadow camera's frustum (should be 0, skipped long
  // ground slabs aside, which are counted separately)
  mesh.userData.slabVerify = () => {
    if (!lastCam) return null;
    const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(lastCam.projectionMatrix, lastCam.matrixWorldInverse));
    const p = g.getAttribute('position'), vs = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    let missed = 0, skippedIn = 0;
    for (let t = 0; t < nt; t++) {
      if (t >= lastA && t < lastB) continue;
      for (let k = 0; k < 3; k++) vs[k].fromBufferAttribute(p, t * 3 + k);
      // outside when all three corners are behind one frustum plane
      const outside = fr.planes.some((pl) => vs.every((q) => pl.distanceToPoint(q) < 0));
      if (!outside) { if (t < keep.length) missed++; else skippedIn++; }
    }
    return { missed, skippedIn };
  };
  mesh.onAfterShadow = () => { g.setDrawRange(0, Infinity); };
}

/**
 * Round 34: a layer the sun's shadow camera sees and the game cameras do not. A shadow proxy on it (one merged mesh
 * standing in for several meshes' shadows) costs one draw in the shadow pass and none in the main pass.
 */
export const SHADOW_ONLY_LAYER = 2;
