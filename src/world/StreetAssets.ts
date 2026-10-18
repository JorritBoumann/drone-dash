import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Round 28: CC0 street assets (Poly Pizza models, Poly Haven textures; see ASSETS.md), loaded lazily after the first
 * frame. Every model was flattened in Blender to plain vertex colours (no textures, no materials), and split into named
 * parts (`<model>__<role>`, e.g. `car_taxi__paint`), so the game can rebuild them into its own instanced meshes.
 */
export type ModelParts = Map<string, Map<string, THREE.BufferGeometry>>;

const base = (): string => {
  const b = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  return b.endsWith('/') ? b : b + '/';
};

/** Loads a GLB and returns model -> role -> geometry (world transform applied; position, normal, linear vertex colour). */
export async function loadModelParts(file: string): Promise<ModelParts> {
  const gltf = await new GLTFLoader().loadAsync(`${base()}assets/models/${file}`);
  const out: ModelParts = new Map();
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    // node names arrive as "car_taxi__paint" (GLTFLoader drops dots, so a Blender ".001" becomes a trailing "001")
    const [model, roleRaw] = mesh.name.split('__');
    const role = (roleRaw ?? 'all').replace(/\d+$/, '').replace(/_$/, '');
    const g = mesh.geometry.clone();
    g.applyMatrix4(mesh.matrixWorld);
    // round 35: UVs are kept too (the boats carry a baked texture; the other kits have none)
    const keep = new Set(['position', 'normal', 'color', 'uv']);
    for (const k of Object.keys(g.attributes)) if (!keep.has(k)) g.deleteAttribute(k);
    // colours as float rgb (the exporter may write rgba or normalised shorts)
    const c = g.getAttribute('color');
    const n = g.getAttribute('position').count;
    const rgb = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      rgb[i * 3] = c ? c.getX(i) : 1; rgb[i * 3 + 1] = c ? c.getY(i) : 1; rgb[i * 3 + 2] = c ? c.getZ(i) : 1;
    }
    g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    let m = out.get(model);
    if (!m) out.set(model, (m = new Map()));
    m.set(role, g);
  });
  return out;
}

export function loadTexture(file: string, srgb: boolean): Promise<THREE.Texture> {
  return new THREE.TextureLoader().loadAsync(`${base()}assets/textures/${file}`).then((t) => {
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  });
}

/** Round 35: the boats (boats.glb) and their baked albedo textures (wood, paint bands, sail cloth, AO), one per model. */
export const BOAT_MODELS = ['boat_sail', 'boat_rib', 'boat_ferry', 'boat_row'] as const;
export async function loadBoatAssets(): Promise<{ parts: ModelParts; tex: Map<string, THREE.Texture> }> {
  const [parts, ...maps] = await Promise.all([
    loadModelParts('boats.glb'),
    ...BOAT_MODELS.map((m) => loadTexture(`${m}_albedo.webp`, true).catch(() => null)),
  ]);
  const tex = new Map<string, THREE.Texture>();
  BOAT_MODELS.forEach((m, i) => {
    const t = maps[i];
    if (!t) return;
    // glTF UVs (Blender export) already run top-down
    t.flipY = false;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.anisotropy = 4;
    t.needsUpdate = true;
    tex.set(m, t);
  });
  return { parts, tex };
}

export type StreetAssetSet = {
  cars: ModelParts;
  props: ModelParts;
  trees: ModelParts;
  tex: { wall: THREE.Texture; wallN: THREE.Texture; pave: THREE.Texture; paveN: THREE.Texture; asphalt: THREE.Texture; asphaltN: THREE.Texture };
  bytes: number;
};

/** Everything at once; resolves when all files are in (about 1.4 MB). */
export async function loadStreetAssets(): Promise<StreetAssetSet> {
  const [compact, wagon, taxi, props, trees, wall, wallN, pave, paveN, asphalt, asphaltN] = await Promise.all([
    loadModelParts('car_compact.glb'), loadModelParts('car_wagon.glb'), loadModelParts('car_taxi.glb'),
    loadModelParts('street_props.glb'), loadModelParts('trees.glb'),
    loadTexture('wall_plaster_albedo.webp', true), loadTexture('wall_plaster_normal.webp', false),
    loadTexture('paving_albedo.webp', true), loadTexture('paving_normal.webp', false),
    loadTexture('asphalt_albedo.webp', true), loadTexture('asphalt_normal.webp', false),
  ]);
  const cars: ModelParts = new Map([...compact, ...wagon, ...taxi]);
  return { cars, props, trees, tex: { wall, wallN, pave, paveN, asphalt, asphaltN }, bytes: 0 };
}
