import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ModelParts } from './StreetAssets';

/**
 * Round 22: procedural street-life kit. Low-poly vehicles (one merged geometry holding every body type, drawn by a single
 * InstancedMesh: each instance keeps only the vertices of its own type, the rest collapse to a point in the vertex shader)
 * and pedestrians (one figure, limbs swung in the vertex shader). No textures, no downloads.
 */

// ------------------------------------------------------------------------------------------------------------------
// Vehicles
// ------------------------------------------------------------------------------------------------------------------

export const VT = { compact: 0, sedan: 1, taxi: 2, van: 3, truck: 4, hover: 5 } as const;
export type VehicleType = (typeof VT)[keyof typeof VT];
/** length, width, height (m) per type; ground types sit on y = 0, the hover van is centred on its origin */
export const VDIM: Record<number, { len: number; wid: number; hgt: number }> = {
  0: { len: 3.8, wid: 1.72, hgt: 1.46 },
  1: { len: 4.5, wid: 1.82, hgt: 1.44 },
  2: { len: 4.5, wid: 1.82, hgt: 1.62 },
  3: { len: 5.0, wid: 1.96, hgt: 1.98 },
  4: { len: 6.3, wid: 2.12, hgt: 2.1 },
  5: { len: 4.7, wid: 2.12, hgt: 1.66 },
};

/** glow codes: 1 headlight, 2 tail light (brighter when braking), 3 always-lit sign / hover pad */
/** round 23: `far` parts make up the low-detail version drawn far from the camera (default: body paint and glass). */
type Part = { paint?: boolean; glow?: number; glass?: boolean; far?: boolean };

function finish(g: THREE.BufferGeometry, hex: string, type: number, o: Part = {}): THREE.BufferGeometry {
  let n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (k !== 'position') n.deleteAttribute(k);
  n.computeVertexNormals();
  const c = new THREE.Color(hex);
  const count = n.getAttribute('position').count;
  const col = new Float32Array(count * 3);
  const info = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    info[i * 4] = type; info[i * 4 + 1] = o.paint ? 1 : 0; info[i * 4 + 2] = o.glow ?? 0; info[i * 4 + 3] = o.glass ? 1 : 0;
  }
  n.setAttribute('color', new THREE.BufferAttribute(col, 3));
  n.setAttribute('vinfo', new THREE.BufferAttribute(info, 4));
  n.userData = { t: type, far: o.far ?? !!(o.paint || o.glass) };
  return n;
}

/** Round 23: per vehicle type, where its vertices start, how many there are, and how many make the far version. */
export type VehicleRange = { first: number; count: number; far: number };

/** A side profile (z forward, y up) extruded across the width, centred on x = 0. */
function profile(pts: Array<[number, number]>, width: number, x = 0): THREE.BufferGeometry {
  const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, curveSegments: 1 });
  g.rotateY(-Math.PI / 2);
  g.translate(width / 2 + x, 0, 0);
  return g;
}
const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
/** Round 33: a box without its top and bottom faces. */
const sideBox = (w: number, h: number, d: number, x: number, y: number, z: number) => {
  const g = new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  const idx = g.index!.array, keep: number[] = [];
  for (const gr of g.groups) if (gr.materialIndex !== 2 && gr.materialIndex !== 3) for (let k = gr.start; k < gr.start + gr.count; k++) keep.push(idx[k]);
  g.setIndex(keep);
  g.clearGroups();
  return g;
};

const TYRE = '#1f2226';
const TRIM_DARK = '#30353c';
const GLASS = '#2c3a48';
const HEAD = '#fff2d2';
const TAIL = '#ff3426';
const CHROME = '#aeb6be';

function lights(t: number, out: THREE.BufferGeometry[], x: number, yF: number, zF: number, yR: number, zR: number, w = 0.34, h = 0.13): void {
  for (const s of [-1, 1]) {
    out.push(finish(box(w, h, 0.06, s * x, yF, zF), HEAD, t, { glow: 1 }));
    out.push(finish(box(w * 0.9, h, 0.06, s * x, yR, zR), TAIL, t, { glow: 2 }));
  }
}

function carBody(t: number, L: number, W: number, cabin: Array<[number, number]>, roof: [number, number, number], pillarZ: number[], wheelZ: number[], r: number): THREE.BufferGeometry[] {
  const h = L / 2;
  const out: THREE.BufferGeometry[] = [];
  // lower body: wedge nose, flat deck, slightly raked tail
  out.push(finish(profile([[-h, 0.3], [h, 0.3], [h, 0.6], [h - 0.28, 0.78], [-h + 0.06, 0.82], [-h, 0.64]], W), '#ffffff', t, { paint: true }));
  // sills / under-tray in dark trim
  out.push(finish(box(W - 0.08, 0.14, L - 0.5, 0, 0.27, 0), TRIM_DARK, t));
  // glass house (narrower) and the roof slab over it
  out.push(finish(profile(cabin, W - 0.16), GLASS, t, { glass: true }));
  out.push(finish(box(W - 0.2, 0.08, roof[1] - roof[0], 0, roof[2], (roof[0] + roof[1]) / 2), '#ffffff', t, { paint: true }));
  // pillars in body colour
  for (const z of pillarZ) out.push(finish(box(W - 0.14, (roof[2] - 0.82), 0.1, 0, (roof[2] + 0.82) / 2, z), '#ffffff', t, { paint: true }));
  // bumpers
  out.push(finish(box(W + 0.02, 0.16, 0.18, 0, 0.38, h + 0.02), TRIM_DARK, t));
  out.push(finish(box(W + 0.02, 0.16, 0.18, 0, 0.38, -h - 0.02), TRIM_DARK, t));
  // grille strip
  out.push(finish(box(W * 0.46, 0.08, 0.04, 0, 0.5, h + 0.005), CHROME, t));
  // round 29: the wheels are their own instanced mesh now (spin and steer, see buildWheelGeometry / WHEELS)
  void wheelZ; void r;
  lights(t, out, W / 2 - 0.3, 0.62, h + 0.01, 0.68, -h - 0.01);
  return out;
}

/**
 * Round 28: a CC0 car model (Kay Lousberg's City Builder cars via Poly Pizza, flattened to vertex colours in Blender and
 * scaled to the type's box) as vehicle parts: `paint` takes the instance colour, `glass` is glossy, `trim` keeps its own
 * colours. Head and tail lamps are added as small glowing boxes so dusk and braking still read.
 */
function modelBody(t: number, parts: Map<string, THREE.BufferGeometry>): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  for (const [role, g] of parts) {
    let n = g.index ? g.toNonIndexed() : g.clone();
    // round 29: the kit's own wheels survived the decimation only as broken shards inside the arches (about 200 of each
    // car's trim triangles): drop them, the instanced wheels take their place
    const spec = WHEELS_MODEL[t];
    if (role === 'trim' && spec) n = dropInside(n, spec, spec.r - MODEL_RIDE);
    n.translate(0, MODEL_RIDE, 0); // round 29: up on its wheels
    for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'color') n.deleteAttribute(k);
    n.computeVertexNormals();
    const count = n.getAttribute('position').count;
    const info = new Float32Array(count * 4);
    const paint = role === 'paint', glass = role === 'glass';
    for (let i = 0; i < count; i++) { info[i * 4] = t; info[i * 4 + 1] = paint ? 1 : 0; info[i * 4 + 2] = 0; info[i * 4 + 3] = glass ? 1 : 0; }
    n.setAttribute('vinfo', new THREE.BufferAttribute(info, 4));
    n.userData = { t, far: paint || glass };
    out.push(n);
    n = null as unknown as THREE.BufferGeometry;
  }
  const d = VDIM[t];
  lights(t, out, d.wid / 2 - 0.32, 0.58 + MODEL_RIDE, d.len / 2 + 0.012, 0.66 + MODEL_RIDE, -d.len / 2 - 0.012, 0.3, 0.12);
  return out;
}

/**
 * Round 29: wheels. The CC0 car bodies came without wheels (empty arches, body on the road), so every ground vehicle now
 * gets instanced wheels: a dark tyre with a sidewall and a light five-hole rim on both faces, flat shaded like the kit.
 * Unit size (radius 1, width 1 along x): each instance is scaled to its wheel. Traffic spins them with the distance
 * driven and turns the front pair a little through a corner. The model bodies ride MODEL_RIDE m higher, so the arches
 * sit just over the tyres. The procedural bodies (vans, trucks, and the cars before the models load) keep their old
 * wheel spots.
 */
export const MODEL_RIDE = 0.07;

/** Round 29: a non-indexed geometry without the triangles whose centre lies inside a wheel (axle height `ay`). */
function dropInside(g: THREE.BufferGeometry, spec: WheelSpec, ay: number): THREE.BufferGeometry {
  const pos = g.getAttribute('position'), col = g.getAttribute('color');
  const keepP: number[] = [], keepC: number[] = [];
  for (let i = 0; i < pos.count; i += 3) {
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    if (Math.abs(cx) > 0.4 && spec.z.some((z) => Math.hypot(cz - z, cy - ay) < spec.r + 0.02)) continue;
    for (let k = i; k < i + 3; k++) {
      keepP.push(pos.getX(k), pos.getY(k), pos.getZ(k));
      if (col) keepC.push(col.getX(k), col.getY(k), col.getZ(k));
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(keepP, 3));
  if (col) out.setAttribute('color', new THREE.Float32BufferAttribute(keepC, 3));
  return out;
}
export type WheelSpec = { r: number; w: number; x: number; z: number[]; front: number };
/** Procedural bodies (round 22 positions). Index = vehicle type. `front`: z of the steering axle. */
export const WHEELS_PROC: Array<WheelSpec | null> = [
  { r: 0.32, w: 0.24, x: 0.76, z: [-1.22, 1.22], front: 1.22 },
  { r: 0.33, w: 0.24, x: 0.81, z: [-1.45, 1.45], front: 1.45 },
  { r: 0.33, w: 0.24, x: 0.81, z: [-1.45, 1.45], front: 1.45 },
  { r: 0.35, w: 0.26, x: 0.88, z: [-1.65, 1.6], front: 1.6 },
  { r: 0.42, w: 0.3, x: 0.92, z: [-2.2, -1.15, 2.0], front: 2.0 },
  null,
];
/** CC0 model bodies: the arch centres measured on the meshes (rear -1.25, front 1.15 on all three). */
export const WHEELS_MODEL: Array<WheelSpec | null> = [
  { r: 0.31, w: 0.22, x: 0.74, z: [-1.25, 1.15], front: 1.15 },
  { r: 0.31, w: 0.22, x: 0.79, z: [-1.25, 1.15], front: 1.15 },
  { r: 0.31, w: 0.22, x: 0.79, z: [-1.25, 1.15], front: 1.15 },
];

export function buildWheelGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const col = (g: THREE.BufferGeometry, hex: string) => {
    let n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (k !== 'position') n.deleteAttribute(k);
    n.computeVertexNormals();
    const c = new THREE.Color(hex), count = n.getAttribute('position').count, a = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    n.setAttribute('color', new THREE.BufferAttribute(a, 3));
    parts.push(n);
    n = null as unknown as THREE.BufferGeometry;
  };
  const SEG = 10;
  // tread (open cylinder along x)
  col(new THREE.CylinderGeometry(1, 1, 1, SEG, 1, true).rotateZ(Math.PI / 2), TYRE);
  for (const s of [-1, 1]) {
    const face = (g: THREE.BufferGeometry, off: number) => { if (s < 0) g.rotateY(-Math.PI / 2); else g.rotateY(Math.PI / 2); return g.translate(s * off, 0, 0); };
    col(face(new THREE.RingGeometry(0.64, 1, SEG, 1), 0.5), '#262a2f'); // sidewall
    col(face(new THREE.CircleGeometry(0.64, SEG), 0.46), '#b9c0c7'); // rim
    // five dark holes round the hub: they make the spin visible
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      col(face(new THREE.CircleGeometry(0.13, 4).translate(Math.cos(a) * 0.38, Math.sin(a) * 0.38, 0), 0.475), '#3a3f46');
    }
    col(face(new THREE.CircleGeometry(0.14, 6), 0.48), '#7e868f'); // hub
  }
  const g = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  return g;
}

export function buildVehicleGeometry(models?: ModelParts): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const car = (name: string) => models?.get(name);
  // 0 compact hatchback
  const m0 = car('car_compact'), m1 = car('car_wagon'), m2 = car('car_taxi');
  if (m0) parts.push(...modelBody(0, m0));
  else parts.push(...carBody(0, 3.8, 1.72, [[-1.75, 0.8], [0.8, 0.8], [0.12, 1.36], [-1.55, 1.38]], [-1.55, 0.14, 1.4], [-0.62], [-1.22, 1.22], 0.32));
  // 1 sedan (three-box: bonnet, glass house, boot); round 28: an estate car model when loaded
  if (m1) parts.push(...modelBody(1, m1));
  else parts.push(...carBody(1, 4.5, 1.82, [[-1.45, 0.8], [0.95, 0.8], [0.28, 1.36], [-0.98, 1.36]], [-1.0, 0.3, 1.39], [-0.35], [-1.45, 1.45], 0.33));
  // 2 taxi: the sedan with a lit roof sign and a dark check band
  if (m2) {
    parts.push(...modelBody(2, m2));
    parts.push(finish(box(0.5, 0.06, 0.2, 0, 1.6 + MODEL_RIDE, -0.05), '#ffe7a0', 2, { glow: 3 }));
  } else {
    parts.push(...carBody(2, 4.5, 1.82, [[-1.45, 0.8], [0.95, 0.8], [0.28, 1.36], [-0.98, 1.36]], [-1.0, 0.3, 1.39], [-0.35], [-1.45, 1.45], 0.33));
    parts.push(finish(box(0.74, 0.2, 0.3, 0, 1.53, -0.32), '#ffe7a0', 2, { glow: 3 }));
    parts.push(finish(box(1.84, 0.1, 2.6, 0, 0.66, -0.1), '#22262b', 2));
  }
  // 3 delivery van: tall box, sloped nose, orange depot stripe
  {
    const t = 3, L = 5.0, W = 1.96, h = L / 2;
    parts.push(finish(profile([[-h, 0.32], [h, 0.32], [h, 0.86], [h - 0.42, 1.16], [h - 0.98, 1.96], [-h, 1.96]], W), '#ffffff', t, { paint: true }));
    // windscreen and cab side glass, proud of the body by 2 cm
    const zs = h - 0.42, ys = 1.16, ze = h - 0.98, ye = 1.96, k = (zs - ze) / (ye - ys);
    parts.push(finish(profile([[h - 1.5, 1.14], [zs + 0.03, 1.14], [zs + 0.03 - k * 0.64, 1.78], [h - 1.5, 1.78]], W + 0.03), GLASS, t, { glass: true }));
    parts.push(finish(box(W + 0.02, 0.22, 3.3, 0, 1.02, -0.75), '#e8833a', t));
    parts.push(finish(box(W - 0.04, 0.14, L - 0.6, 0, 0.28, 0), TRIM_DARK, t));
    parts.push(finish(box(W + 0.02, 0.18, 0.18, 0, 0.42, h + 0.02), TRIM_DARK, t));
    parts.push(finish(box(W + 0.02, 0.18, 0.18, 0, 0.42, -h - 0.02), TRIM_DARK, t));
    parts.push(finish(box(0.04, 1.3, 0.04, 0, 1.18, -h - 0.01), TRIM_DARK, t)); // rear door split
    lights(t, parts, W / 2 - 0.28, 0.7, h + 0.01, 0.62, -h - 0.01, 0.3, 0.2);
  }
  // 4 box truck: cab + cream cargo box (2.1 m tall, clears the hover-vans' pads)
  {
    const t = 4, L = 6.3, W = 2.12, h = L / 2;
    parts.push(finish(profile([[h - 1.95, 0.42], [h, 0.42], [h, 1.0], [h - 0.3, 1.86], [h - 1.95, 1.92]], W - 0.08), '#ffffff', t, { paint: true }));
    parts.push(finish(profile([[h - 1.2, 1.12], [h + 0.02, 1.12], [h - 0.29, 1.8], [h - 1.2, 1.84]], W - 0.05), GLASS, t, { glass: true }));
    parts.push(finish(box(W, 1.66, 4.1, 0, 0.44 + 0.83, -h + 2.05), '#ece4d4', t, { far: true }));
    parts.push(finish(box(W + 0.02, 0.26, 4.12, 0, 1.6, -h + 2.05), '#e8833a', t));
    parts.push(finish(box(W + 0.03, 0.06, 4.13, 0, 2.08, -h + 2.05), '#c9bba5', t));
    parts.push(finish(box(W - 0.3, 0.3, L - 0.4, 0, 0.42, 0), TRIM_DARK, t));
    parts.push(finish(box(W + 0.02, 0.2, 0.2, 0, 0.5, h + 0.02), TRIM_DARK, t));
    lights(t, parts, W / 2 - 0.3, 0.78, h + 0.01, 0.62, -h - 0.01, 0.3, 0.16);
  }
  // 5 hover-van (rush hour): rounded pod on four glowing pads, origin at its centre
  {
    const t = 5, W = 2.1, h = 2.35;
    parts.push(finish(profile([[-h, -0.5], [h - 0.2, -0.5], [h, -0.2], [h - 0.06, 0.32], [h - 0.75, 0.86], [-h + 0.1, 0.86], [-h, 0.7]], W), '#ffffff', t, { paint: true }));
    parts.push(finish(profile([[h - 1.6, 0.26], [h - 0.03, 0.26], [h - 0.12, 0.38], [h - 0.72, 0.84], [h - 1.6, 0.84]], W + 0.03), GLASS, t, { glass: true }));
    parts.push(finish(box(W + 0.02, 0.24, 2 * h - 0.3, 0, -0.33, -0.08), '#e8833a', t));
    parts.push(finish(box(W - 0.3, 0.1, 2 * h - 0.6, 0, -0.56, 0), TRIM_DARK, t));
    for (const z of [-1.5, 1.45]) for (const s of [-1, 1]) {
      parts.push(finish(box(0.16, 0.16, 0.16, s * 0.82, -0.58, z), TRIM_DARK, t));
      parts.push(finish(new THREE.CylinderGeometry(0.42, 0.36, 0.1, 10).translate(s * 0.82, -0.68, z), '#8fe3ff', t, { glow: 3 }));
    }
    lights(t, parts, W / 2 - 0.32, 0.0, h + 0.01, 0.1, -h - 0.01, 0.4, 0.12);
  }
  // round 23: order by type, and within a type the far parts first, so each type is one slice of the buffer and its
  // far version is the start of that slice (drawn with a shorter draw range, no extra buffers)
  parts.sort((a, b) => a.userData.t - b.userData.t || (a.userData.far ? 0 : 1) - (b.userData.far ? 0 : 1));
  const ranges: VehicleRange[] = [];
  let at = 0;
  for (const p of parts) {
    const t = p.userData.t as number, n = p.getAttribute('position').count;
    const r = (ranges[t] ??= { first: at, count: 0, far: 0 });
    r.count += n;
    if (p.userData.far) r.far += n;
    at += n;
  }
  const g = mergeGeometries(parts)!;
  g.userData.ranges = ranges;
  for (const p of parts) p.dispose();
  return g;
}

/**
 * Standard material with three per-vertex roles (body paint takes the instance colour, glass is glossy and metallic,
 * lamps glow) and per-instance type and brake. `lights` scales the head and tail lamps with the city's light mood.
 */
export function vehicleMaterial(lights: { value: number }): { material: THREE.MeshStandardMaterial; depth: THREE.MeshDepthMaterial } {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.18 });
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uLights = lights;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 vinfo;\nattribute vec2 iinfo;\nvarying float vGlow;\nvarying float vGlass;\nuniform float uLights;')
      .replace('#include <color_vertex>', `
        vColor = vec4(color, 1.0);
        #ifdef USE_INSTANCING_COLOR
          vColor.rgb = mix(vColor.rgb, vColor.rgb * instanceColor.rgb, vinfo.y);
        #endif
        float gcode = vinfo.z;
        vGlow = gcode < 0.5 ? 0.0 : gcode < 1.5 ? uLights * 2.3 + 0.2 : gcode < 2.5 ? uLights * 1.3 + 0.25 + iinfo.y * 1.8 : 1.5 + uLights;
        vGlass = vinfo.w;`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nif (abs(vinfo.x - iinfo.x) > 0.5) transformed = vec3(0.0);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGlow;\nvarying float vGlass;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.1, vGlass);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.75, vGlass);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vGlow;');
  };
  material.customProgramCacheKey = () => 'street-vehicles-v1';
  const depth = new THREE.MeshDepthMaterial();
  depth.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 vinfo;\nattribute vec2 iinfo;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nif (abs(vinfo.x - iinfo.x) > 0.5) transformed = vec3(0.0);');
  };
  depth.customProgramCacheKey = () => 'street-vehicles-depth-v1';
  return { material, depth };
}

/** Body colours per light mood (index into Environment.MOODS): painterly, a little muted, from the city's own palette. */
export const CAR_PAINTS: string[][] = [
  ['#e76f51', '#f4a261', '#e9c46a', '#2a9d8f', '#3f6b8a', '#f1eee4', '#c8553d', '#5b8e7d', '#86adae', '#264653', '#dcd6ca', '#8a5a44', '#b85c5c'], // golden hour
  ['#e76f51', '#7fb7c9', '#e9c46a', '#2a9d8f', '#3d7cc9', '#f6f3ec', '#f4a261', '#a9c2a8', '#c9bdd9', '#455a6e', '#dfe3e6', '#d98f6c', '#6c8f5a'], // bright morning
  ['#c8553d', '#b07aa1', '#e0a39a', '#3f6b8a', '#2f4858', '#ece4d4', '#9d4b3a', '#5b8e7d', '#7c6c9c', '#26343f', '#d6a676', '#86adae', '#a33f4f'], // rose dusk
  ['#e9c46a', '#86adae', '#f4a261', '#2a9d8f', '#4f8db4', '#f5f0e2', '#c9705c', '#a9c2a8', '#adc0cf', '#3a5260', '#ecc871', '#9a7b5c', '#5b8e7d'], // hazy noon
];
export const VAN_PAINTS = ['#f4efe6', '#ffffff', '#e9e2d4', '#dfe3e6', '#f4efe6'];
export const TAXI_PAINT = '#f2c23a';
/** Head and tail lamp strength per mood: low in daylight, full at dusk. */
export const MOOD_LIGHTS = [0.75, 0.22, 1.0, 0.15];

// ------------------------------------------------------------------------------------------------------------------
// Pedestrians
// ------------------------------------------------------------------------------------------------------------------

/**
 * Round 27: people with knees and elbows, outfits, hair styles, accessories and poses.
 * pinfo = (colour role, limb, joint pivot y), pmask = which per-person option shows the part (0 always).
 * Colour roles: 0 skin, 1 shirt, 2 trousers, 3 hair, 4 shoes, 5 accent (hat, bag, jacket), 6 lower leg (skin under shorts
 * or a dress), 7 phone, 8 dress, 9 torso and sleeves (accent for a jacket or coat), 10 forearm (skin for short sleeves).
 * Limbs: 0 body, 1/2 thighs, 3/4 upper arms, 5 head, 6/7 shins, 8/9 forearms.
 * Masks: 1 dress, 2 hat, 3 shoulder bag, 4 backpack, 5 phone, 6 long hair, 7 bun, 8 hair cap (not cropped), 9 coat.
 */
function pedPart(g: THREE.BufferGeometry, part: number, limb: number, pivot: number, mask = 0): THREE.BufferGeometry {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (k !== 'position') n.deleteAttribute(k);
  n.computeVertexNormals();
  const count = n.getAttribute('position').count;
  const a = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) { a[i * 4] = part; a[i * 4 + 1] = limb; a[i * 4 + 2] = pivot; a[i * 4 + 3] = mask; }
  n.setAttribute('pinfo', new THREE.BufferAttribute(a, 4));
  return n;
}

const HIP = 0.9, KNEE = 0.5, SHOULDER = 1.47, ELBOW = 1.2, NECK = 1.55;

/** Round 27: the near figure (far = false) or the far figure. Round 33: about 680 and 150 triangles (accessories included). */
export function buildPedGeometry(far = false): THREE.BufferGeometry {
  // round 33: P = parts that make the shadow, D = small details drawn after them (the shadow pass stops before D)
  const P: THREE.BufferGeometry[] = [], D: THREE.BufferGeometry[] = [];
  // round 28: near figures get tapered round limbs, rounded hands and a smooth head (no boxes left but the shoes)
  const limb = (rt: number, rb: number, h: number, x: number, y: number, z: number, sz = 1) =>
    new THREE.CylinderGeometry(rt, rb, h, 6, 1).scale(1, 1, sz).translate(x, y, z);
  for (const s of [-1, 1]) {
    const L = s < 0 ? 0 : 1;
    if (far) {
      // round 33: far limbs are open-ended boxes (8 triangles, no end caps: too small to see past 24 m)
      P.push(pedPart(sideBox(0.15, 0.42, 0.17, s * 0.092, 0.69, 0), 2, 1 + L, HIP)); // thigh
      P.push(pedPart(sideBox(0.125, 0.44, 0.14, s * 0.092, 0.29, -0.005), 6, 6 + L, KNEE)); // shin
      P.push(pedPart(sideBox(0.1, 0.31, 0.115, s * 0.245, 1.33, 0), 9, 3 + L, SHOULDER)); // upper arm (sleeve)
      P.push(pedPart(sideBox(0.088, 0.27, 0.1, s * 0.245, 1.065, 0), 10, 8 + L, ELBOW)); // forearm
    } else {
      P.push(pedPart(limb(0.083, 0.064, 0.44, s * 0.092, 0.69, 0), 2, 1 + L, HIP)); // thigh
      P.push(pedPart(limb(0.062, 0.047, 0.45, s * 0.092, 0.29, -0.005), 6, 6 + L, KNEE)); // shin
      P.push(pedPart(limb(0.056, 0.05, 0.32, s * 0.245, 1.33, 0), 9, 3 + L, SHOULDER)); // upper arm (sleeve)
      P.push(pedPart(limb(0.048, 0.04, 0.28, s * 0.245, 1.065, 0), 10, 8 + L, ELBOW)); // forearm
      D.push(pedPart(box(0.1, 0.075, 0.25, s * 0.092, 0.04, 0.045), 4, 6 + L, KNEE)); // shoe
      D.push(pedPart(new THREE.IcosahedronGeometry(0.048, 0).scale(0.8, 1.15, 0.95).translate(s * 0.245, 0.885, 0.005), 0, 8 + L, ELBOW)); // hand
    }
  }
  // torso: shoulders wider than the waist
  P.push(pedPart(new THREE.CylinderGeometry(0.205, 0.165, 0.58, far ? 6 : 8).scale(1, 1, 0.6).translate(0, 1.25, 0), 9, 0, 0));
  const ball = (r: number) => (far ? new THREE.IcosahedronGeometry(r, 0) : new THREE.SphereGeometry(r, 8, 6)); // round 33: was 9 x 7
  P.push(pedPart(ball(0.112).scale(0.93, 1.12, 1).translate(0, 1.68, 0.01), 0, 5, NECK)); // head
  P.push(pedPart(new THREE.IcosahedronGeometry(0.126, far ? 0 : 1).scale(1.0, 0.86, 1.02).translate(0, 1.718, -0.022), 3, 5, NECK, 8)); // hair cap
  P.push(pedPart(new THREE.CylinderGeometry(0.19, 0.3, 0.44, far ? 6 : 8).scale(1, 1, 0.78).translate(0, 0.76, 0), 8, 0, 0, 1)); // dress skirt
  if (!far) {
    D.push(pedPart(box(0.34, 0.17, 0.21, 0, 0.92, 0), 2, 0, 0)); // hips
    D.push(pedPart(limb(0.042, 0.048, 0.1, 0, 1.56, 0), 0, 5, NECK)); // neck
    D.push(pedPart(box(0.03, 0.045, 0.035, 0, 1.665, 0.11), 0, 5, NECK)); // nose
    P.push(pedPart(box(0.235, 0.3, 0.07, 0, 1.56, -0.095), 3, 5, NECK, 6)); // long hair
    D.push(pedPart(new THREE.IcosahedronGeometry(0.058, 0).translate(0, 1.79, -0.11), 3, 5, NECK, 7)); // bun
    P.push(pedPart(new THREE.CylinderGeometry(0.128, 0.132, 0.075, 8).translate(0, 1.795, -0.01), 5, 5, NECK, 2)); // cap
    D.push(pedPart(box(0.2, 0.02, 0.13, 0, 1.765, 0.12), 5, 5, NECK, 2)); // cap brim
    P.push(pedPart(box(0.07, 0.25, 0.23, 0.225, 0.98, 0.02), 5, 0, 0, 3)); // shoulder bag
    D.push(pedPart(box(0.025, 0.56, 0.04, 0, 0, 0).rotateZ(0.62).translate(0.0, 1.25, 0.115), 5, 0, 0, 3)); // bag strap (round 28: rotated about its own centre, it floated beside the person)
    P.push(pedPart(box(0.28, 0.36, 0.14, 0, 1.24, -0.17), 5, 0, 0, 4)); // backpack
    D.push(pedPart(box(0.065, 0.115, 0.016, 0.245, 0.875, 0.06), 7, 9, ELBOW, 5)); // phone in the right hand
    P.push(pedPart(new THREE.CylinderGeometry(0.2, 0.27, 0.46, 8).scale(1, 1, 0.72).translate(0, 0.77, 0), 5, 0, 0, 9)); // coat skirt
  }
  const shadowVerts = P.reduce((n, p) => n + p.getAttribute('position').count, 0);
  const all = [...P, ...D];
  const g = mergeGeometries(all)!;
  for (const p of all) p.dispose();
  g.userData.shadowVerts = shadowVerts;
  return g;
}

/**
 * Lambert material for people. Per instance: instance colour = shirt, `ipants` = trousers, `ianim` = (walk phase,
 * walk amount, reaction 0..1, skin + 4 * hair colour + 16 * hair style), `iextra` = (outfit, accessory bits, pose,
 * accent colour). Hips, knees, shoulders and elbows bend; a reaction ducks the figure, throws the arms up over the head
 * and tips the head back to look up. Poses: 0 walk / stand, 1 phone, 2 talking, 3 sitting.
 */
export function pedMaterial(): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  const pose = /* glsl */ `
    float pPart = pinfo.x, pLimb = pinfo.y, pPivot = pinfo.z, pMask = pinfo.w;
    float wph = ianim.x, wamt = ianim.y, wre = ianim.z;
    float outfit = iextra.x, acc = iextra.y, ppose = iextra.z;
    float hstyle = floor(ianim.w / 16.0);
    float sw = sin(wph) * 0.5 * wamt;
    float cw = cos(wph);
    float isPhone = step(0.5, ppose) * step(ppose, 1.5);
    float isTalk = step(1.5, ppose) * step(ppose, 2.5);
    float isSit = step(2.5, ppose);
    float hipL = sw, hipR = -sw;
    float kneeL = wamt * (0.1 + 0.75 * max(0.0, -cw)), kneeR = wamt * (0.1 + 0.75 * max(0.0, cw));
    float shL = -sw * 0.8, shR = sw * 0.8;
    float elL = -(0.18 + 0.3 * wamt + 0.12 * max(0.0, sw)), elR = -(0.18 + 0.3 * wamt + 0.12 * max(0.0, -sw));
    float headA = 0.0;
    // standing idle: a slow weight shift (wamt carries it, small) without leg swing
    if (isPhone > 0.5) { shR = -0.32; elR = -1.3; headA = 0.42; }
    if (isTalk > 0.5) { float gst = sin(wph * 1.7); shR = -0.25 - 0.15 * gst; elR = -0.9 - 0.45 * max(0.0, gst); shL = -0.05; elL = -0.35; headA = 0.08 * sin(wph * 0.9); }
    if (isSit > 0.5) { hipL = -1.5; hipR = -1.45; kneeL = 1.5; kneeR = 1.42; shL = -0.3; shR = -0.32; elL = -0.85; elR = -0.8; headA = 0.06; }
    // reaction: arms up, head back, legs still
    float legRe = wre * (1.0 - isSit);
    hipL *= 1.0 - legRe; hipR *= 1.0 - legRe; kneeL *= 1.0 - legRe; kneeR *= 1.0 - legRe;
    shL = mix(shL, -2.6, wre); shR = mix(shR, -2.6, wre); elL = mix(elL, -0.25, wre); elR = mix(elR, -0.25, wre);
    headA = mix(headA, -0.55, wre);
    float jointA = 0.0, rootA = 0.0, rootPivot = 0.0;
    if (pLimb > 0.5 && pLimb < 1.5) { rootA = hipL; rootPivot = ${HIP.toFixed(2)}; }
    else if (pLimb > 1.5 && pLimb < 2.5) { rootA = hipR; rootPivot = ${HIP.toFixed(2)}; }
    else if (pLimb > 2.5 && pLimb < 3.5) { rootA = shL; rootPivot = ${SHOULDER.toFixed(2)}; }
    else if (pLimb > 3.5 && pLimb < 4.5) { rootA = shR; rootPivot = ${SHOULDER.toFixed(2)}; }
    else if (pLimb > 4.5 && pLimb < 5.5) { rootA = headA; rootPivot = ${NECK.toFixed(2)}; }
    else if (pLimb > 5.5 && pLimb < 6.5) { jointA = kneeL; rootA = hipL; rootPivot = ${HIP.toFixed(2)}; }
    else if (pLimb > 6.5 && pLimb < 7.5) { jointA = kneeR; rootA = hipR; rootPivot = ${HIP.toFixed(2)}; }
    else if (pLimb > 7.5 && pLimb < 8.5) { jointA = elL; rootA = shL; rootPivot = ${SHOULDER.toFixed(2)}; }
    else if (pLimb > 8.5) { jointA = elR; rootA = shR; rootPivot = ${SHOULDER.toFixed(2)}; }
    // which optional parts this person shows
    float show = 1.0;
    if (pMask > 0.5 && pMask < 1.5) show = step(1.5, outfit) * step(outfit, 2.5);
    else if (pMask > 1.5 && pMask < 2.5) show = mod(acc, 2.0);
    else if (pMask > 2.5 && pMask < 3.5) show = mod(floor(acc / 2.0), 2.0);
    else if (pMask > 3.5 && pMask < 4.5) show = mod(floor(acc / 4.0), 2.0);
    else if (pMask > 4.5 && pMask < 5.5) show = isPhone;
    else if (pMask > 5.5 && pMask < 6.5) show = step(0.5, hstyle) * step(hstyle, 1.5);
    else if (pMask > 6.5 && pMask < 7.5) show = step(1.5, hstyle) * step(hstyle, 2.5) * (1.0 - mod(acc, 2.0));
    else if (pMask > 7.5 && pMask < 8.5) show = 1.0 - step(2.5, hstyle) * 0.0;
    else if (pMask > 8.5) show = step(3.5, outfit) * (1.0 - isSit);
    float ca = cos(rootA), sa = sin(rootA), cj = cos(jointA), sj = sin(jointA);`;
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 pinfo;\nattribute vec4 ianim;\nattribute vec3 ipants;\nattribute vec4 iextra;')
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        objectNormal = vec3(objectNormal.x, objectNormal.y * cj - objectNormal.z * sj, objectNormal.y * sj + objectNormal.z * cj);
        objectNormal = vec3(objectNormal.x, objectNormal.y * ca - objectNormal.z * sa, objectNormal.y * sa + objectNormal.z * ca);`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          if (jointA != 0.0) { float ry = transformed.y - pPivot; transformed = vec3(transformed.x, pPivot + ry * cj - transformed.z * sj, ry * sj + transformed.z * cj); }
          if (pLimb > 0.5) { float ry = transformed.y - rootPivot; transformed = vec3(transformed.x, rootPivot + ry * ca - transformed.z * sa, ry * sa + transformed.z * ca); }
          // sitting: the whole figure drops onto the seat
          transformed.y -= isSit * 0.45;
          // duck: hips drop, body leans forward
          transformed.y *= 1.0 - wre * 0.28;
          transformed.z += wre * 0.18 * smoothstep(0.6, 1.6, transformed.y);
          transformed.y += abs(cw) * 0.03 * wamt;
          // a little side sway of the upper body with each step
          transformed.x += sin(wph) * 0.018 * wamt * smoothstep(0.85, 1.6, transformed.y);
          if (show < 0.5) transformed = vec3(0.0);
        }`)
      .replace('#include <color_vertex>', `
        ${pose}
        {
          float sk = mod(ianim.w, 4.0), hr = mod(floor(ianim.w / 4.0), 4.0);
          vec3 skin = sk < 0.5 ? vec3(0.93, 0.66, 0.5) : sk < 1.5 ? vec3(0.72, 0.47, 0.32) : sk < 2.5 ? vec3(0.45, 0.28, 0.18) : vec3(0.98, 0.78, 0.64);
          vec3 hair = hr < 0.5 ? vec3(0.08, 0.06, 0.05) : hr < 1.5 ? vec3(0.32, 0.18, 0.08) : hr < 2.5 ? vec3(0.75, 0.55, 0.25) : vec3(0.6, 0.6, 0.58);
          float ai = iextra.w;
          vec3 accent = ai < 0.5 ? vec3(0.13, 0.15, 0.2) : ai < 1.5 ? vec3(0.45, 0.3, 0.18) : ai < 2.5 ? vec3(0.62, 0.55, 0.42) : ai < 3.5 ? vec3(0.2, 0.32, 0.26)
            : ai < 4.5 ? vec3(0.6, 0.18, 0.14) : ai < 5.5 ? vec3(0.85, 0.82, 0.75) : ai < 6.5 ? vec3(0.25, 0.25, 0.27) : vec3(0.85, 0.6, 0.2);
          float o = iextra.x;
          bool bareLeg = (o > 0.5 && o < 2.5);
          bool jacket = o > 2.5;
          bool shortSleeve = (o > 0.5 && o < 2.5);
          vec3 c;
          if (pPart < 0.5) c = skin * skin;
          else if (pPart < 1.5) c = instanceColor.rgb;
          else if (pPart < 2.5) c = (o > 1.5 && o < 2.5) ? skin * skin : ipants;
          else if (pPart < 3.5) c = hair * hair;
          else if (pPart < 4.5) c = mod(ai, 3.0) < 0.5 ? vec3(0.8, 0.78, 0.74) : vec3(0.02, 0.018, 0.016);
          else if (pPart < 5.5) {
            // hats and bags take a second and third accent so a person is not one colour head to toe
            float k = pMask > 1.5 && pMask < 2.5 ? 3.0 : pMask > 2.5 && pMask < 4.5 ? 5.0 : 0.0;
            float aj = mod(ai + k, 8.0);
            vec3 a2 = aj < 0.5 ? vec3(0.13, 0.15, 0.2) : aj < 1.5 ? vec3(0.45, 0.3, 0.18) : aj < 2.5 ? vec3(0.62, 0.55, 0.42) : aj < 3.5 ? vec3(0.2, 0.32, 0.26)
              : aj < 4.5 ? vec3(0.6, 0.18, 0.14) : aj < 5.5 ? vec3(0.85, 0.82, 0.75) : aj < 6.5 ? vec3(0.25, 0.25, 0.27) : vec3(0.85, 0.6, 0.2);
            c = a2 * a2;
          }
          else if (pPart < 6.5) c = bareLeg ? skin * skin : ipants;
          else if (pPart < 7.5) c = vec3(0.01, 0.012, 0.016);
          else if (pPart < 8.5) c = instanceColor.rgb;
          else if (pPart < 9.5) c = jacket ? accent * accent : instanceColor.rgb;
          else c = shortSleeve ? skin * skin : (jacket ? accent * accent : instanceColor.rgb);
          vColor = vec4(c, 1.0);
        }`);
  };
  m.customProgramCacheKey = () => 'street-peds-v2';
  return m;
}

/** Shirt and trouser colours (sRGB hex). */
export const SHIRTS = ['#e76f51', '#2a9d8f', '#e9c46a', '#3f6b8a', '#f4a261', '#f1eee4', '#c8553d', '#5b8e7d', '#c9bdd9', '#86adae', '#ecc871', '#264653', '#b07aa1', '#ffffff', '#d98f6c', '#8fb0ec'];
export const PANTS = ['#2b3440', '#3a4654', '#4f6a7a', '#6b4a36', '#22262b', '#7c6c5c', '#3d5a80', '#5a5a5a', '#c9bba5'];
