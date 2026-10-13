import * as THREE from 'three';
import { createSeededRandom } from '../core/random';

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [c, ctx];
}

/** Tileable asphalt: speckle noise, patch repairs and faint tyre wear. */
export function asphaltTexture(): THREE.CanvasTexture {
  const size = 512;
  const [c, ctx] = canvas(size);
  const rng = createSeededRandom(77);
  ctx.fillStyle = '#4b4e55';
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rng() - 0.5) * 26;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n + 2;
  }
  ctx.putImageData(img, 0, 0);
  // repair patches (wrapped so the tile stays seamless)
  for (let k = 0; k < 14; k++) {
    const x = rng() * size, y = rng() * size, w = 20 + rng() * 80, h = 14 + rng() * 50;
    ctx.fillStyle = rng() > 0.5 ? 'rgba(30,32,36,0.18)' : 'rgba(120,120,125,0.08)';
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) ctx.fillRect(x + ox, y + oy, w, h);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Soft radial blob (alpha), used for contact shadows and glows. */
export function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 128): THREE.CanvasTexture {
  const [c, ctx] = canvas(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.45, inner.replace(/[\d.]+\)$/, '0.55)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Landing pad glyph: dashed ring with chevrons; white on transparent so markers tint it. */
export function padGlyphTexture(kind: 'pickup' | 'drop'): THREE.CanvasTexture {
  const size = 256;
  const [c, ctx] = canvas(size);
  const m = size / 2;
  ctx.strokeStyle = 'white';
  ctx.fillStyle = 'white';
  ctx.lineWidth = 10;
  ctx.setLineDash([22, 14]);
  ctx.beginPath();
  ctx.arc(m, m, m - 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(m, m, m - 40, 0, Math.PI * 2);
  ctx.stroke();
  if (kind === 'pickup') {
    // package glyph
    ctx.lineWidth = 9;
    ctx.strokeRect(m - 34, m - 30, 68, 60);
    ctx.beginPath();
    ctx.moveTo(m, m - 30);
    ctx.lineTo(m, m + 30);
    ctx.moveTo(m - 34, m - 8);
    ctx.lineTo(m + 34, m - 8);
    ctx.stroke();
  } else {
    // drop arrows pointing to center
    for (let k = 0; k < 4; k++) {
      ctx.save();
      ctx.translate(m, m);
      ctx.rotate((k * Math.PI) / 2);
      ctx.beginPath();
      ctx.moveTo(-18, -62);
      ctx.lineTo(0, -40);
      ctx.lineTo(18, -62);
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(m, m, 14, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Tileable ripple normal map for the bay water. */
export function waterNormalTexture(): THREE.CanvasTexture {
  const size = 256;
  const [c, ctx] = canvas(size);
  const rng = createSeededRandom(9);
  const h = new Float32Array(size * size);
  const waves = Array.from({ length: 9 }, () => ({
    kx: Math.round((rng() - 0.5) * 10), ky: Math.round((rng() - 0.5) * 10) || 1, a: 0.4 + rng(), p: rng() * 6.28,
  }));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      for (const w of waves) v += w.a * Math.sin(((w.kx * x + w.ky * y) / size) * Math.PI * 2 + w.p);
      h[y * size + x] = v;
    }
  }
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = h[y * size + ((x - 1 + size) % size)], r = h[y * size + ((x + 1) % size)];
      const u = h[((y - 1 + size) % size) * size + x], d = h[((y + 1) % size) * size + x];
      let nx = (l - r) * 0.5, ny = (u - d) * 0.5;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len;
      const i = (y * size + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz / len * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
