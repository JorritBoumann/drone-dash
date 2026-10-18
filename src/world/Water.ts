import * as THREE from 'three';
import { createSeededRandom } from '../core/random';
import { PALETTE, SUN_DIR } from './Environment';

/**
 * Round 31: the bay water. A camera-following grid with sum-of-sines swell (fades out with distance), per-pixel swell
 * normals plus two scrolling detail normal maps, a Fresnel blend between a deep / shallow water colour and an analytic
 * reflection of the mood's own sky gradient, the sun glint from the key light (shadowed), shallow colour and lapping
 * foam along the seawall and round the pier legs, and V-shaped boat wakes (fed per frame from Boats).
 *
 * The swell is defined once here (WAVES) and used both by the vertex shader and by `waveHeight`, which the boats
 * sample so they ride the same surface.
 */

/** Water level at rest (m). */
export const WATER_Y = -0.7;
/** The seawall: the promenade box ends here (|x| or |z|), see CityGenerator. */
export const SHORE = 164;

type Wave = { dir: number; len: number; amp: number; phase: number };
/** Swell components: direction (rad), wavelength (m), amplitude (m), phase. Peak sum 0.28 m. */
export const WAVES: Wave[] = [
  { dir: 0.35, len: 21, amp: 0.13, phase: 0.0 },
  { dir: 1.15, len: 13, amp: 0.08, phase: 1.7 },
  { dir: -0.45, len: 8.3, amp: 0.045, phase: 4.1 },
  { dir: 2.2, len: 5.1, amp: 0.025, phase: 2.6 },
];
/** Deep-water dispersion, slowed a little for the toy scale. */
const SPEED = 0.8;
const W = WAVES.map((w) => {
  const k = (Math.PI * 2) / w.len;
  return { dx: Math.cos(w.dir), dz: Math.sin(w.dir), k, amp: w.amp, omega: Math.sqrt(9.81 * k) * SPEED, phase: w.phase };
});
/** The swell fades out between these camera distances (m), so far water stays calm and does not alias. */
export const WAVE_FADE: [number, number] = [150, 380];

/** Swell fade for a point at distance d (m) from the camera, the same smoothstep as the shader. */
export function waveFade(d: number): number {
  const t = Math.min(1, Math.max(0, (d - WAVE_FADE[0]) / (WAVE_FADE[1] - WAVE_FADE[0])));
  return 1 - t * t * (3 - 2 * t);
}

/** Water grid: fine step (m) at the camera and growth per ring, desktop and phone (see gridGeometry). */
export const GRID = { full: { step: 2.5, grow: 1.08, uniform: 10 }, lite: { step: 3.2, grow: 1.1, uniform: 8 } };
/**
 * Round 32: the grid snap made the water jump. The snap moves the grid by exactly one fine step, and the grid now has
 * `uniform` even steps round the centre, so every vertex there lands on a vertex of the old grid: no change. Beyond
 * it the cells grow and the vertices would land on new places, so the vertex swell lives only inside the even part
 * (NEAR_FADE metres from the camera, inside the even square) and only with the waves those cells can carry (a wave
 * fades out of the displacement as the cell goes from 0.2 to 0.4 of its length). Further out the swell is in the
 * per-pixel normals only, as before; at those distances 0.28 m of height never showed anyway. The boats keep riding
 * the full swell (waveHeight with the distance fade), as in round 31.
 */
export const CELL_FADE: [number, number] = [0.2, 0.4];
export const NEAR_FADE: [number, number] = [12, 21];
function cellFade(len: number, c: number): number {
  const t = Math.min(1, Math.max(0, (c - len * CELL_FADE[0]) / (len * (CELL_FADE[1] - CELL_FADE[0]))));
  return 1 - t * t * (3 - 2 * t);
}

/** Round 32: the swell height as drawn (m, relative to WATER_Y) at world (x, z), time t, for a point d metres from the
 * camera. Mirrors waveHv() and the near fade in the vertex shader (test hook only). */
export function surfaceHeight(x: number, z: number, t: number, d: number, lite: boolean): number {
  const c = (lite ? GRID.lite : GRID.full).step;
  let h = 0;
  for (let i = 0; i < W.length; i++) {
    const w = W[i];
    h += w.amp * cellFade(WAVES[i].len, c) * Math.sin(w.k * (w.dx * x + w.dz * z) - w.omega * t + w.phase);
  }
  const k = Math.min(1, Math.max(0, (d - NEAR_FADE[0]) / (NEAR_FADE[1] - NEAR_FADE[0])));
  return h * (1 - k * k * (3 - 2 * k));
}

/** Swell height (m, relative to WATER_Y, before the fade) at world (x, z) and time t. Mirrors waveH() in GLSL. */
export function waveHeight(x: number, z: number, t: number): number {
  let h = 0;
  for (const w of W) h += w.amp * Math.sin(w.k * (w.dx * x + w.dz * z) - w.omega * t + w.phase);
  return h;
}

/** Signed distance (m) from the seawall (box |x|,|z| < SHORE), positive out on the water. */
export function shoreDistance(x: number, z: number): number {
  const qx = Math.abs(x) - SHORE, qz = Math.abs(z) - SHORE;
  const ox = Math.max(qx, 0), oz = Math.max(qz, 0);
  return Math.hypot(ox, oz) + Math.min(Math.max(qx, qz), 0);
}

/** Per-mood water colours (sRGB hex): deep, shallow (near the wall), foam tint; and the sky reflection strength. */
const MOOD_WATER: Array<{ deep: string; shallow: string; foam: string; refl: number; chop: number }> = [
  { deep: '#14425a', shallow: '#2f7f86', foam: '#fff1e2', refl: 0.92, chop: 1.0 }, // golden hour
  { deep: '#134b6b', shallow: '#2f8f98', foam: '#f6fbff', refl: 0.88, chop: 1.15 }, // bright morning
  { deep: '#1c3358', shallow: '#3a6f86', foam: '#ffe9e6', refl: 0.95, chop: 1.15 }, // rose dusk
  { deep: '#16506a', shallow: '#3a9a96', foam: '#fffaf0', refl: 0.85, chop: 0.68 }, // hazy noon
];

export const MAX_WAKES = 8;
export const MAX_PIERS = 4;

/** Tileable detail normal map (RGB) with a foam noise height in alpha, made in code (no file). */
function detailNormalTexture(size: number): THREE.DataTexture {
  const rng = createSeededRandom(31);
  const waves = Array.from({ length: 18 }, () => {
    let kx = 0, ky = 0;
    while (kx === 0 && ky === 0) { kx = Math.round((rng() - 0.5) * 16); ky = Math.round((rng() - 0.5) * 16); }
    const kl = Math.hypot(kx, ky);
    return { kx, ky, a: (0.6 + rng()) / Math.sqrt(kl), p: rng() * 6.283 };
  });
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      for (const w of waves) v += w.a * Math.sin(((w.kx * x + w.ky * y) / size) * 6.2831853 + w.p);
      h[y * size + x] = v;
    }
  }
  let lo = Infinity, hi = -Infinity;
  for (const v of h) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const data = new Uint8Array(size * size * 4);
  const s = 2.2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = h[y * size + ((x - 1 + size) % size)], r = h[y * size + ((x + 1) % size)];
      const u = h[((y - 1 + size) % size) * size + x], d = h[((y + 1) % size) * size + x];
      const nx = (l - r) * s, ny = (u - d) * s, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const i = (y * size + x) * 4;
      data[i] = (nx / len * 0.5 + 0.5) * 255;
      data[i + 1] = (ny / len * 0.5 + 0.5) * 255;
      data[i + 2] = (nz / len * 0.5 + 0.5) * 255;
      data[i + 3] = ((h[y * size + x] - lo) / (hi - lo)) * 255;
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

/**
 * Grid coordinates along one axis: `uniform` even steps round the centre (round 32: so a one-step snap maps the near
 * grid exactly onto itself), then growing geometrically out to `far`.
 */
function axisCoords(step: number, grow: number, far: number, uniform: number): number[] {
  const pos: number[] = [0];
  let x = 0, s = step;
  for (let i = 0; i < uniform; i++) { x += step; pos.push(x); }
  while (x < far) { s *= grow; x += s; pos.push(Math.min(x, far)); }
  return [...pos.slice(1).reverse().map((v) => -v), ...pos];
}

function gridGeometry(step: number, grow: number, far: number, uniform: number): THREE.BufferGeometry {
  const c = axisCoords(step, grow, far, uniform);
  const n = c.length;
  const pos = new Float32Array(n * n * 3);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = (j * n + i) * 3;
    pos[k] = c[i]; pos[k + 1] = 0; pos[k + 2] = c[j];
  }
  const idx: number[] = [];
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = j * n + i, b = a + 1, d = a + n, e = d + 1;
    idx.push(a, d, b, b, d, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const nrm = new Float32Array(n * n * 3);
  for (let k = 1; k < nrm.length; k += 3) nrm[k] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}

const GLSL_WAVES = (lite = false): string => {
  const f = (v: number) => v.toFixed(5);
  const g = lite ? GRID.lite : GRID.full;
  const termsC = W.map((w, i) => `${f(w.amp)} * (1.0 - smoothstep(${f(WAVES[i].len * CELL_FADE[0])}, ${f(WAVES[i].len * CELL_FADE[1])}, c)) * sin(${f(w.k)} * dot(vec2(${f(w.dx)}, ${f(w.dz)}), p) - ${f(w.omega)} * t + ${f(w.phase)})`);
  const terms = W.map((w) => `${f(w.amp)} * sin(${f(w.k)} * dot(vec2(${f(w.dx)}, ${f(w.dz)}), p) - ${f(w.omega)} * t + ${f(w.phase)})`);
  const grads = W.map((w) => `${f(w.amp * w.k)} * cos(${f(w.k)} * dot(vec2(${f(w.dx)}, ${f(w.dz)}), p) - ${f(w.omega)} * t + ${f(w.phase)}) * vec2(${f(w.dx)}, ${f(w.dz)})`);
  return `
  float waveH(vec2 p, float t){ return ${terms.join(' + ')}; }
  vec2 waveG(vec2 p, float t){ return ${grads.join(' + ')}; }
  float waveFade(float d){ return 1.0 - smoothstep(${f(WAVE_FADE[0])}, ${f(WAVE_FADE[1])}, d); }
  float waveHv(vec2 p, float t){ float c = ${f(g.step)}; return ${termsC.join(' + ')}; }
  float nearFade(float d){ return 1.0 - smoothstep(${f(NEAR_FADE[0])}, ${f(NEAR_FADE[1])}, d); }`;
};

export class Water {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly normalTex: THREE.DataTexture;
  readonly uniforms: Record<string, THREE.IUniform>;
  /** Wakes: (x, z, heading, speed) and (half length, half beam, sin heading, cos heading) per boat; count in uWakeN. */
  readonly wakeA: THREE.Vector4[] = Array.from({ length: MAX_WAKES }, () => new THREE.Vector4());
  readonly wakeB: THREE.Vector4[] = Array.from({ length: MAX_WAKES }, () => new THREE.Vector4());
  /** Pier footprints (centre x, z, half x, half z) for leg foam. */
  readonly piers: THREE.Vector4[] = Array.from({ length: MAX_PIERS }, () => new THREE.Vector4(1e5, 1e5, 0, 0));
  private readonly snap: number;

  constructor(mood: number, readonly lite: boolean) {
    const mw = MOOD_WATER[mood] ?? MOOD_WATER[0];
    this.normalTex = detailNormalTexture(lite ? 128 : 256);
    this.snap = lite ? GRID.lite.step : GRID.full.step;
    const gp = lite ? GRID.lite : GRID.full;
    const geo = gridGeometry(gp.step, gp.grow, 1300, gp.uniform);
    this.uniforms = {
      uTime: { value: 0 },
      uDetail: { value: this.normalTex },
      uDeep: { value: new THREE.Color(mw.deep) },
      uShallow: { value: new THREE.Color(mw.shallow) },
      uFoamCol: { value: new THREE.Color(mw.foam) },
      uRefl: { value: mw.refl },
      uChop: { value: mw.chop },
      uSkyTop: { value: PALETTE.skyTop },
      uSkyMid: { value: PALETTE.skyMid },
      uSkyHorizon: { value: PALETTE.horizon },
      uSkySun: { value: PALETTE.sun },
      uSunDir: { value: SUN_DIR },
      uWakeA: { value: this.wakeA },
      uWakeB: { value: this.wakeB },
      uWakeN: { value: 0 },
      uPier: { value: this.piers },
    };
    this.material = new THREE.MeshStandardMaterial({
      color: mw.deep, roughness: 0.16, metalness: 0, envMapIntensity: 0.35,
    });
    this.material.onBeforeCompile = (shader) => this.patch(shader);
    this.material.customProgramCacheKey = () => `water33-${lite ? 'lite' : 'full'}`;
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.y = WATER_Y;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.name = 'water';
    // the grid follows the camera that draws it (snapped to the fine step so the near vertices never swim)
    this.mesh.onBeforeRender = (_r, _s, camera) => {
      const s = this.snap;
      const x = Math.round(camera.position.x / s) * s, z = Math.round(camera.position.z / s) * s;
      if (x !== this.mesh.position.x || z !== this.mesh.position.z) {
        this.mesh.position.x = x;
        this.mesh.position.z = z;
        this.mesh.updateMatrixWorld(); // the renderer builds modelViewMatrix right after this hook
      }
    };
  }

  private patch(shader: THREE.WebGLProgramParametersWithUniforms): void {
    Object.assign(shader.uniforms, this.uniforms);
    const lite = this.lite;
    shader.vertexShader = `uniform float uTime;
varying vec3 vWaterW;
${GLSL_WAVES(lite)}
` + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  vec4 wp0 = modelMatrix * vec4(transformed, 1.0);
  float dCam = distance(wp0.xz, cameraPosition.xz);
  transformed.y += waveHv(wp0.xz, uTime) * nearFade(dCam);
  vWaterW = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    shader.fragmentShader = `uniform float uTime;
uniform sampler2D uDetail;
uniform vec3 uDeep, uShallow, uFoamCol, uSkyTop, uSkyMid, uSkyHorizon, uSkySun, uSunDir;
uniform float uRefl;
uniform float uChop;
uniform vec4 uWakeA[${MAX_WAKES}];
uniform vec4 uWakeB[${MAX_WAKES}];
uniform int uWakeN;
uniform vec4 uPier[${MAX_PIERS}];
varying vec3 vWaterW;
${GLSL_WAVES(lite)}
float shoreD(vec2 p){ vec2 q = abs(p) - vec2(${SHORE.toFixed(1)}); return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0); }
float rectD(vec2 p, vec4 r){ vec2 q = abs(p - r.xy) - r.zw; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0); }
vec3 skyRefl(vec3 d){
  float y = max(d.y, 0.0);
  vec3 col = mix(uSkyHorizon, uSkyMid, smoothstep(-0.02, 0.22, y));
  col = mix(col, uSkyTop, smoothstep(0.12, 0.75, y));
  float sd = clamp(dot(d, normalize(uSunDir)), 0.0, 1.0);
  col += uSkySun * (pow(sd, 6.0) * 0.4);
  return col;
}
` + shader.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
  vec2 wxz = vWaterW.xz;
  float camD = distance(cameraPosition, vWaterW);
  // round 32: the sea calms with height and distance. hiK is 0 when skimming low (keep the close chop) and 1 at play
  // height (15 to 30 m). The fine ripples fade by the metres one pixel covers on the water (mip-aware) and by distance,
  // both tighter from above; a broad, slow swell layer and soft wind patches take over, so from above the bay reads as
  // big soft colour shapes with sparkle mostly in the glint path.
  float camH = max(cameraPosition.y - (${WATER_Y.toFixed(2)}), 0.3);
  // round 33: the calm sets in from 6 m of camera height (was 4) and is full from 20 m (was 15): close low-sun views
  // (14 m glint) keep more glitter; play height (game camera at 18 to 30 m) stays calm
  float hiK = smoothstep(6.0, 20.0, camH);
  vec2 fwx = fwidth(wxz);
  float foot = max(fwx.x, fwx.y);
  float footS = mix(8.0, 1.0, hiK);
  float kFine = (1.0 - smoothstep(0.03 * footS, 0.16 * footS, foot)) * (1.0 - smoothstep(mix(70.0, 18.0, hiK), mix(300.0, 90.0, hiK), camD));
  float kMid = (1.0 - smoothstep(0.08 * footS, 0.6 * footS, foot)) * (1.0 - smoothstep(mix(80.0, 22.0, hiK), mix(420.0, 120.0, hiK), camD));
  // swell normal (analytic) plus the detail layers
  // (from above, the short swell's slopes also ease off with distance; the vertex swell keeps its full height)
  vec2 g = waveG(wxz, uTime) * waveFade(distance(wxz, cameraPosition.xz)) * (1.0 - 0.6 * hiK * smoothstep(40.0, 200.0, camD));
  vec4 dB = texture2D(uDetail, wxz * 0.0135 + vec2(uTime * 0.0021, -uTime * 0.0014));
  float wind = smoothstep(0.25, 0.8, dB.w); // calm and ruffled patches, tens of metres across (the broad layer's height)
  vec2 dnB = (dB.xy * 2.0 - 1.0) * mix(0.05, 0.155 * uChop, hiK);
  vec4 d1 = texture2D(uDetail, wxz * 0.071 + vec2(uTime * 0.013, uTime * 0.008));
  vec2 dn = (d1.xy * 2.0 - 1.0) * mix(0.3, 0.26, hiK) * mix(0.2, 1.0, kMid);
  float foamN = d1.w;
  ${lite ? '' : `// the finest layer is skipped where it has faded out (most of the bay from play height); explicit gradients keep
  // the mip choice right inside the branch, and the foam noise blends over to the coarser layer alone
  vec2 uv2 = mat2(0.8, -0.6, 0.6, 0.8) * wxz * 0.19 - vec2(uTime * 0.021, -uTime * 0.016);
  vec2 uv2dx = dFdx(uv2), uv2dy = dFdy(uv2);
  vec4 d2 = vec4(0.5, 0.5, 1.0, d1.w);
  if (kFine > 0.001) d2 = textureGrad(uDetail, uv2, uv2dx, uv2dy);
  dn += (d2.xy * 2.0 - 1.0) * mix(0.27, 0.22, hiK) * kFine;
  foamN = foamN * 0.6 + mix(d1.w, d2.w, smoothstep(0.001, 0.05, kFine)) * 0.4;
  // round 33: a fine near layer (ripples about 2 m across) right round the camera, where one pixel covers less than a
  // few centimetres, so the water under a low drone stays crisp instead of smearing into soft streaks
  float kNear = (1.0 - smoothstep(10.0, 40.0, camD)) * (1.0 - smoothstep(0.012, 0.06, foot));
  vec2 uv3 = mat2(0.6, 0.8, -0.8, 0.6) * wxz * 0.47 + vec2(uTime * 0.035, uTime * 0.027);
  vec2 uv3dx = dFdx(uv3), uv3dy = dFdy(uv3);
  if (kNear > 0.001) { vec4 d3 = textureGrad(uDetail, uv3, uv3dx, uv3dy); dn += (d3.xy * 2.0 - 1.0) * 0.2 * kNear; }`}
  dn *= mix(1.0, mix(0.55, 1.05, wind) * uChop, hiK); // uChop: how breezy the mood's bay looks from above
  dn += dnB;
  // shore: shallow colour and lapping foam along the seawall, foam round the pier legs
  float sdist = shoreD(wxz);
  float shallow = exp(-max(sdist, 0.0) / 16.0);
  vec3 waterCol = mix(uDeep, uShallow, shallow);
  waterCol *= mix(0.72, 1.0, smoothstep(0.0, 1.6, sdist)); // the wall's foot shows darker through the shallows
  float lap = 0.55 + 0.45 * sin(uTime * 1.3 + (wxz.x + wxz.y) * 0.045 + foamN * 2.5);
  float foam = (1.0 - smoothstep(0.4, 1.6 + lap * 2.2, sdist + (foamN - 0.5) * 2.0)) * 0.95;
  foam += (1.0 - smoothstep(1.5, 6.5, sdist)) * smoothstep(0.58, 0.78, foamN) * 0.6 * (0.4 + 0.6 * lap);
  for (int i = 0; i < ${MAX_PIERS}; i++) {
    float pd = rectD(wxz, uPier[i]);
    foam += (1.0 - smoothstep(0.2, 1.8, pd + (foamN - 0.5) * 1.2)) * 0.85;
  }
  // boat wakes: a Kelvin V (19.5 deg arms) with a foam trail and bow wave
  vec2 wakeN = vec2(0.0);
  float wakeFoam = 0.0;
  for (int i = 0; i < ${MAX_WAKES}; i++) {
    if (i >= uWakeN) break;
    vec4 a = uWakeA[i]; vec4 b = uWakeB[i];
    vec2 rel = wxz - a.xy;
    float reach = b.x * 2.0 + 20.0 + a.w * 6.0;
    if (dot(rel, rel) > reach * reach) continue; // most of the bay is far from every boat
    vec2 fwd = b.zw; // (sin, cos) of the heading, from the CPU
    vec2 rgt = vec2(fwd.y, -fwd.x);
    float u = -dot(rel, fwd) - b.x * 0.75; // metres behind the stern
    float v = dot(rel, rgt);
    float spd = clamp(a.w / 8.0, 0.0, 1.0);
    // round 33: a big hull churns more than its speed says (the 14 m harbour bus at 4.6 m/s left a faint trail)
    float churn = clamp(spd + max(b.x - 4.0, 0.0) * 0.12, 0.0, 1.0);
    float len = 14.0 + a.w * 6.0;
    if (u > -b.x * 1.8 && u < len) {
      float uu = max(u, 0.0);
      float fade = 1.0 - smoothstep(0.0, len, uu);
      float armOff = abs(v) - (uu * 0.354 + b.y * 0.9);
      float armW = 0.35 + uu * 0.05;
      float arm = exp(-armOff * armOff / armW) * fade * step(0.0, u);
      float trail = exp(-v * v / (b.y * b.y * (0.8 + uu * 0.12))) * exp(-uu / (4.0 + a.w * 2.6 + max(b.x - 4.0, 0.0) * 0.8)) * step(0.0, u);
      // bow wave: a short crescent round the front of the hull
      vec2 bow = rel - fwd * b.x * 0.55;
      float bowD = length(vec2(dot(bow, rgt), max(dot(bow, fwd), 0.0) * 1.6)) - b.y * 1.15;
      float bowF = (1.0 - smoothstep(0.0, 0.9, abs(bowD))) * step(dot(rel, fwd), b.x * 0.9) * step(-b.x * 0.6, dot(rel, fwd));
      float wf = arm * (0.45 + 0.55 * foamN) * (0.25 + 0.75 * spd) + trail * (0.75 + 0.45 * foamN) * (0.35 + 0.65 * churn) + bowF * 0.6 * spd;
      foam += wf;
      wakeFoam += trail * (0.75 + 0.45 * foamN) * (0.35 + 0.65 * churn);
      // ripples along the arms tilt the surface
      wakeN += rgt * sign(v) * cos(armOff * 3.0) * exp(-armOff * armOff / (armW * 3.0)) * fade * 0.35 * spd * step(0.0, u);
    }
  }
  foam = clamp(foam, 0.0, 1.0);
  vec3 nW = normalize(vec3(-g.x - dn.x - wakeN.x, 1.0, -g.y - dn.y - wakeN.y));
  // the sun glint (key light) sees less of the fine layer when the sun is low and the camera is high, so a low sun
  // lays a soft glitter path instead of lighting every ripple on the bay
  float lowSun = 1.0 - smoothstep(0.28, 0.6, normalize(uSunDir).y);
  float specK = 1.0 - 0.6 * lowSun * hiK;
  vec2 dnL = dnB + (dn - dnB) * specK;
  vec3 nL = normalize(vec3(-g.x - dnL.x - wakeN.x, 1.0, -g.y - dnL.y - wakeN.y));
  diffuseColor.rgb = mix(waterCol, uFoamCol, foam);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  normal = normalize((viewMatrix * vec4(nL, 0.0)).xyz);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  // fine ripples that fade out widen the glint instead (their slope spread becomes roughness)
  roughnessFactor = mix(roughnessFactor, 0.3, (1.0 - kFine) * hiK);`)
      .replace('#include <opaque_fragment>', `
  {
    vec3 V = normalize(cameraPosition - vWaterW);
    float NdV = clamp(dot(nW, V), 0.0, 1.0);
    float fres0 = clamp((0.02 + 0.98 * pow(clamp(1.0 - NdV, 0.0, 1.0), 5.0)) * uRefl, 0.0, 1.0);
    float fres = fres0 * (1.0 - foam);
    vec3 R = reflect(-V, nW);
    R.y = abs(R.y);
    vec3 refl = skyRefl(normalize(R + vec3(0.0, 0.001, 0.0)));
    // foam also scatters the sky light, so it stays white in building shadow
    outgoingLight = mix(totalDiffuse, refl, fres) + reflectedLight.directSpecular * (1.0 - foam) + uFoamCol * refl * foam * 0.32;
    // round 32: looking toward a low sun the open water is bright sky reflection plus glint, brighter than sunlit foam,
    // so wakes vanished. Foam is now always brighter than the bare water round it (by up to 150% at full foam), colour
    // kept, capped at 1.4.
    {
      const vec3 LW = vec3(0.2126, 0.7152, 0.0722);
      float wl = dot(refl * fres0 + reflectedLight.directSpecular, LW);
      float ol = dot(outgoingLight, LW);
      float need = min(wl * (1.0 + 1.5 * foam) + 0.05 * foam, 1.4);
      // round 33: in the glitter path of a low sun the open water round a wake is bright everywhere, not only where this
      // pixel sparkles: a wake's foam trail there gets a floor set by how squarely the view looks down the glitter path
      vec3 R0 = reflect(-V, vec3(0.0, 1.0, 0.0));
      float glare = smoothstep(0.4, 0.95, dot(R0, normalize(uSunDir))) * lowSun;
      // (trail only, and under the bloom threshold, so it reads as bright froth, not a glowing beam)
      need = max(need, glare * smoothstep(0.05, 0.4, wakeFoam) * 1.05);
      if (foam > 0.01 && ol < need) outgoingLight *= need / max(ol, 0.001);
    }
  }
  #include <opaque_fragment>`);
  }

  /** Mood colours (for a live mood switch; the build picks them in the constructor). */
  update(time: number): void {
    this.uniforms.uTime.value = time;
  }
}
