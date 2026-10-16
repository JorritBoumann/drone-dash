import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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
const wheel = (r: number, w: number, x: number, z: number, y = r) => new THREE.CylinderGeometry(r, r, w, 8).rotateZ(Math.PI / 2).translate(x, y, z);

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
  for (const z of wheelZ) for (const s of [-1, 1]) out.push(finish(wheel(r, 0.24, s * (W / 2 - 0.1), z), TYRE, t));
  lights(t, out, W / 2 - 0.3, 0.62, h + 0.01, 0.68, -h - 0.01);
  return out;
}

export function buildVehicleGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // 0 compact hatchback
  parts.push(...carBody(0, 3.8, 1.72, [[-1.75, 0.8], [0.8, 0.8], [0.12, 1.36], [-1.55, 1.38]], [-1.55, 0.14, 1.4], [-0.62], [-1.22, 1.22], 0.32));
  // 1 sedan (three-box: bonnet, glass house, boot)
  parts.push(...carBody(1, 4.5, 1.82, [[-1.45, 0.8], [0.95, 0.8], [0.28, 1.36], [-0.98, 1.36]], [-1.0, 0.3, 1.39], [-0.35], [-1.45, 1.45], 0.33));
  // 2 taxi: the sedan with a lit roof sign and a dark check band
  parts.push(...carBody(2, 4.5, 1.82, [[-1.45, 0.8], [0.95, 0.8], [0.28, 1.36], [-0.98, 1.36]], [-1.0, 0.3, 1.39], [-0.35], [-1.45, 1.45], 0.33));
  parts.push(finish(box(0.74, 0.2, 0.3, 0, 1.53, -0.32), '#ffe7a0', 2, { glow: 3 }));
  parts.push(finish(box(1.84, 0.1, 2.6, 0, 0.66, -0.1), '#22262b', 2));
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
    for (const z of [-1.65, 1.6]) for (const s of [-1, 1]) parts.push(finish(wheel(0.35, 0.26, s * (W / 2 - 0.1), z), TYRE, t));
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
    for (const z of [-h + 0.95, -h + 2.0, h - 1.15]) for (const s of [-1, 1]) parts.push(finish(wheel(0.42, 0.3, s * (W / 2 - 0.14), z), TYRE, t));
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

/** parts: 0 skin, 1 shirt (instance colour), 2 trousers, 3 hair, 4 shoes. limbs: 0 body, 1/2 legs, 3/4 arms, 5 head. */
function pedPart(g: THREE.BufferGeometry, part: number, limb: number, pivot: number): THREE.BufferGeometry {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (k !== 'position') n.deleteAttribute(k);
  n.computeVertexNormals();
  const count = n.getAttribute('position').count;
  const a = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) { a[i * 3] = part; a[i * 3 + 1] = limb; a[i * 3 + 2] = pivot; }
  n.setAttribute('pinfo', new THREE.BufferAttribute(a, 3));
  return n;
}

export function buildPedGeometry(): THREE.BufferGeometry {
  // round 23: the far version (legs, arms, torso, head, hair cap: 104 of 188 triangles) comes first in the buffer, so
  // people far from the camera draw only that slice (userData.farCount vertices)
  const F: THREE.BufferGeometry[] = [];
  const N: THREE.BufferGeometry[] = [];
  const hip = 0.88, shoulder = 1.42;
  for (const s of [-1, 1]) {
    const limb = s < 0 ? 1 : 2;
    F.push(pedPart(box(0.15, 0.8, 0.18, s * 0.095, 0.48, 0), 2, limb, hip));
    N.push(pedPart(box(0.16, 0.09, 0.27, s * 0.095, 0.045, 0.04), 4, limb, hip));
    const arm = s < 0 ? 3 : 4;
    F.push(pedPart(box(0.11, 0.42, 0.13, s * 0.26, 1.2, 0), 1, arm, shoulder));
    N.push(pedPart(box(0.09, 0.14, 0.1, s * 0.26, 0.93, 0), 0, arm, shoulder));
  }
  N.push(pedPart(box(0.36, 0.16, 0.22, 0, 0.92, 0), 2, 0, 0)); // hips
  F.push(pedPart(new THREE.CylinderGeometry(0.22, 0.17, 0.56, 6).scale(1, 1, 0.62).rotateY(Math.PI / 6).translate(0, 1.27, 0), 1, 0, 0)); // torso
  N.push(pedPart(box(0.09, 0.08, 0.09, 0, 1.58, 0), 0, 5, 1.56)); // neck
  F.push(pedPart(new THREE.IcosahedronGeometry(0.125, 0).scale(1, 1.12, 1).translate(0, 1.7, 0.01), 0, 5, 1.56)); // head
  F.push(pedPart(box(0.27, 0.1, 0.27, 0, 1.81, -0.02), 3, 5, 1.56)); // hair cap
  N.push(pedPart(box(0.26, 0.16, 0.06, 0, 1.72, -0.12), 3, 5, 1.56)); // hair back
  const farCount = F.reduce((n, g) => n + g.getAttribute('position').count, 0);
  const P = [...F, ...N];
  const g = mergeGeometries(P)!;
  g.userData.farCount = farCount;
  for (const p of P) p.dispose();
  return g;
}

/**
 * Lambert material for people. Per instance: instance colour = shirt, `ipants` = trousers, `ianim` = (walk phase,
 * walk amount, reaction 0..1, skin + 4 * hair index). Legs and arms swing about the hip and shoulder; a reaction ducks
 * the figure, throws the arms up over the head and tips the head back to look up.
 */
export function pedMaterial(): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  const pose = /* glsl */ `
    float pPart = pinfo.x, pLimb = pinfo.y, pPivot = pinfo.z;
    float wph = ianim.x, wamt = ianim.y, wre = ianim.z;
    float sw = sin(wph) * 0.62 * wamt;
    float ang = 0.0;
    if (pLimb > 0.5 && pLimb < 1.5) ang = sw * (1.0 - wre);
    else if (pLimb > 1.5 && pLimb < 2.5) ang = -sw * (1.0 - wre);
    else if (pLimb > 2.5 && pLimb < 3.5) ang = -sw * 0.75 - wre * 2.5;
    else if (pLimb > 3.5 && pLimb < 4.5) ang = sw * 0.75 - wre * 2.5;
    else if (pLimb > 4.5) ang = -wre * 0.55;
    float ca = cos(ang), sa = sin(ang);`;
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 pinfo;\nattribute vec4 ianim;\nattribute vec3 ipants;')
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        objectNormal = vec3(objectNormal.x, objectNormal.y * ca - objectNormal.z * sa, objectNormal.y * sa + objectNormal.z * ca);`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float ry = transformed.y - pPivot;
          if (pLimb > 0.5) transformed = vec3(transformed.x, pPivot + ry * ca - transformed.z * sa, ry * sa + transformed.z * ca);
          // duck: hips drop, body leans forward
          transformed.y *= 1.0 - wre * 0.28;
          transformed.z += wre * 0.18 * smoothstep(0.6, 1.6, transformed.y);
          transformed.y += abs(cos(wph)) * 0.035 * wamt;
        }`)
      .replace('#include <color_vertex>', `
        ${pose}
        {
          float sk = mod(ianim.w, 4.0), hr = floor(ianim.w / 4.0);
          vec3 skin = sk < 0.5 ? vec3(0.93, 0.66, 0.5) : sk < 1.5 ? vec3(0.72, 0.47, 0.32) : sk < 2.5 ? vec3(0.45, 0.28, 0.18) : vec3(0.98, 0.78, 0.64);
          vec3 hair = hr < 0.5 ? vec3(0.08, 0.06, 0.05) : hr < 1.5 ? vec3(0.32, 0.18, 0.08) : hr < 2.5 ? vec3(0.75, 0.55, 0.25) : vec3(0.55, 0.55, 0.55);
          vec3 c = pPart < 0.5 ? skin * skin : pPart < 1.5 ? instanceColor.rgb : pPart < 2.5 ? ipants : pPart < 3.5 ? hair * hair : vec3(0.014, 0.012, 0.01);
          vColor = vec4(c, 1.0);
        }`);
  };
  m.customProgramCacheKey = () => 'street-peds-v1';
  return m;
}

/** Shirt and trouser colours (sRGB hex). */
export const SHIRTS = ['#e76f51', '#2a9d8f', '#e9c46a', '#3f6b8a', '#f4a261', '#f1eee4', '#c8553d', '#5b8e7d', '#c9bdd9', '#86adae', '#ecc871', '#264653', '#b07aa1', '#ffffff', '#d98f6c', '#8fb0ec'];
export const PANTS = ['#2b3440', '#3a4654', '#4f6a7a', '#6b4a36', '#22262b', '#7c6c5c', '#3d5a80', '#5a5a5a', '#c9bba5'];
