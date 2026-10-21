import { storeGet, storeSet } from '../core/storage';
/**
 * Round 40: the minimap. A round, heading-up map (straight ahead is always up) of about `radius` metres round the drone.
 *
 * - The static city layer (water, island and seawall, block paving, building footprints, parks, tunnels) is drawn ONCE
 *   per city into an offscreen canvas from the generator data (`buildMinimapLayer`). No second 3D render.
 * - `drawMinimap` draws that layer rotated and translated, plus the dynamic markers (objective with its distance, an
 *   edge-clamped arrow when it is outside the radius, the leg's shortcut entrance, the drone arrow). It draws into ANY
 *   2D context at a given rect, so a canvas-drawn HUD (platform recordings) can reuse it as is.
 * - `Minimap` owns the DOM canvas: size and pixel ratio, at most 30 redraws a second, the M toggle (remembered in
 *   localStorage), and the cost per draw.
 */
import type { CityLayout } from '../world/CityGenerator';

export type MinimapLayer = {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  /** World x and z of the layer's top-left corner, and its size in metres (square). */
  x0: number; z0: number; size: number;
};

export type MinimapFrame = {
  /** Drone position (x, z) and yaw (rad; 0 faces -z, the forward vector is (-sin yaw, -cos yaw)). */
  px: number; pz: number; yaw: number;
  /** Metres from the centre to the rim. */
  radius: number;
  objective: { x: number; z: number; kind: 'pickup' | 'drop' | 'rush'; dist: number } | null;
  /** The leg's suggested shortcut: entrance (x, z) and exit (ex, ez) of the alley or tunnel run. */
  shortcut: { x: number; z: number; ex: number; ez: number; kind: 'alley' | 'tunnel' } | null;
  /** Round 48: the leg's tailwind rings (centre and the way through); taken ones (`on` false) are not drawn. */
  rings?: ReadonlyArray<{ x: number; z: number; dx: number; dz: number; on: boolean }>;
  /** Size of the marks in target pixels per desktop CSS pixel (default size / 160). */
  markScale?: number;
};

/** What the last draw put where (for probes): marker angle in degrees clockwise from up, clamped to the rim or not. */
export type MinimapDrawInfo = { markerAngle: number; markerClamped: boolean; markerR: number; shortcutShown: boolean };

const C = {
  water: '#6cb4cd',
  waterDeep: '#5aa4c0',
  street: '#fdf5e8',
  paving: '#e3cfb2',
  building: '#c39a73',
  park: '#a3cd8a',
  tunnel: '#c6d6e2',
  wall: '#3b4658',
  ink: '#1d2230',
  cream: '#fff7ea',
  pickup: '#ffb02e',
  drop: '#14c9a0',
  rush: '#ff5d4a',
  alley: '#f29a2e',
  tunnelMark: '#3f9fd8',
  ring: '#2fd8f0',
};
const FONT = "ui-rounded, 'SF Pro Rounded', 'Nunito', 'Avenir Next', 'Segoe UI', system-ui, sans-serif";

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * Draw the city's static top-down layer once. `shore` is the seawall half size (the island is |x|, |z| < shore);
 * `tunnels` the covered alley rectangles (drawn lighter so they read as a way through). `pxPerM` sets the detail.
 */
export function buildMinimapLayer(
  layout: CityLayout, shore: number,
  tunnels: Array<{ x0: number; z0: number; x1: number; z1: number }>, pxPerM = 1.6, margin = 170,
): MinimapLayer {
  // water margin of at least the map radius round the island: a view near the shore never samples outside the bitmap
  const ext = shore + margin;
  const size = ext * 2;
  const n = Math.ceil(size * pxPerM);
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : new OffscreenCanvas(n, n);
  canvas.width = n;
  canvas.height = n;
  const ctx = canvas.getContext('2d') as Ctx2D;
  const x0 = -ext, z0 = -ext;
  ctx.setTransform(pxPerM, 0, 0, pxPerM, -x0 * pxPerM, -z0 * pxPerM); // world metres from here on
  // water, with a slightly deeper tone further out
  ctx.fillStyle = C.waterDeep;
  ctx.fillRect(x0, z0, size, size);
  ctx.fillStyle = C.water;
  ctx.fillRect(-shore - 30, -shore - 30, (shore + 30) * 2, (shore + 30) * 2);
  // the island: streets and promenade are the light ground
  ctx.fillStyle = C.street;
  ctx.fillRect(-shore, -shore, shore * 2, shore * 2);
  // block paving
  const B = layout.blockSize, R = layout.roadWidth;
  const parks = layout.sites.filter((s) => s.kind === 'park');
  for (let i = 0; i < layout.blocks; i++) {
    for (let j = 0; j < layout.blocks; j++) {
      const bx = layout.roadCenters[i] + R / 2, bz = layout.roadCenters[j] + R / 2;
      const park = parks.some((s) => s.pos.x > bx && s.pos.x < bx + B && s.pos.z > bz && s.pos.z < bz + B);
      ctx.fillStyle = park ? C.park : C.paving;
      roundRect(ctx, bx, bz, B, B, 2.5);
      ctx.fill();
    }
  }
  // the diagonal boulevards cut through the blocks: street colour along them (buildings are drawn over it)
  ctx.save();
  ctx.beginPath();
  ctx.rect(-layout.half, -layout.half, layout.half * 2, layout.half * 2);
  ctx.clip();
  ctx.strokeStyle = C.street;
  ctx.lineCap = 'butt';
  for (const b of layout.boulevards) {
    // the line z = s * x + c across the city
    const h = layout.half;
    ctx.lineWidth = b.halfWidth * 2;
    ctx.beginPath();
    ctx.moveTo(-h, b.s * -h + b.c);
    ctx.lineTo(h, b.s * h + b.c);
    ctx.stroke();
  }
  ctx.restore();
  // tunnels: the covered runs, a cool grey strip
  ctx.fillStyle = C.tunnel;
  for (const t of tunnels) ctx.fillRect(t.x0, t.z0, t.x1 - t.x0, t.z1 - t.z0);
  // building footprints: every solid standing on the ground that is tall enough to fly into
  ctx.fillStyle = C.building;
  for (const b of layout.colliders) {
    if (b.soft || b.minY > 1.5 || b.maxY < 3) continue;
    const w = b.maxX - b.minX, d = b.maxZ - b.minZ;
    if (w * d < 9 || Math.min(w, d) < 1.5 || Math.abs(b.minX) > shore || Math.abs(b.minZ) > shore) continue;
    ctx.fillRect(b.minX, b.minZ, w, d);
  }
  // the seawall (island edge)
  ctx.strokeStyle = C.wall;
  ctx.lineWidth = 1.6;
  ctx.strokeRect(-shore, -shore, shore * 2, shore * 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return { canvas, x0, z0, size };
}

function roundRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const info: MinimapDrawInfo = { markerAngle: 0, markerClamped: false, markerR: 0, shortcutShown: false };

/**
 * Draw the minimap into `ctx` at the rect (x, y, size, size), in the context's current pixel units. Heading-up: the
 * drone's forward is screen up. Returns where the objective marker went (shared object, overwritten by the next draw).
 */
export function drawMinimap(ctx: Ctx2D, x: number, y: number, size: number, layer: MinimapLayer, f: MinimapFrame): MinimapDrawInfo {
  const cx = x + size / 2, cy = y + size / 2;
  const rim = Math.max(2, size * 0.035);
  const rr = size / 2 - rim; // inner radius (px)
  const k = rr / f.radius; // px per metre
  const cos = Math.cos(f.yaw), sin = Math.sin(f.yaw);
  // world offset (dx, dz) -> screen: rotate by yaw (forward (-sin, -cos) goes to (0, -1)), then scale
  const sx = (dx: number, dz: number) => (dx * cos - dz * sin) * k;
  const sy = (dx: number, dz: number) => (dx * sin + dz * cos) * k;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, rr, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = C.waterDeep;
  ctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
  // the static layer, rotated about the drone
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(f.yaw);
  ctx.scale(k, k);
  ctx.translate(-f.px, -f.pz);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(layer.canvas as CanvasImageSource, layer.x0, layer.z0, layer.size, layer.size);
  ctx.restore();

  // a soft vignette at the rim so the markers on the edge stay readable
  const g = ctx.createRadialGradient(cx, cy, rr * 0.72, cx, cy, rr);
  g.addColorStop(0, 'rgba(29,34,48,0)');
  g.addColorStop(1, 'rgba(29,34,48,0.16)');
  ctx.fillStyle = g;
  ctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);

  const u = f.markScale ?? size / 160; // scale of the marks (1 at the desktop size)
  // a faint forward view cone from the drone (straight ahead is up)
  {
    const cone = ctx.createLinearGradient(cx, cy, cx, cy - rr);
    cone.addColorStop(0, 'rgba(255,247,234,0.34)');
    cone.addColorStop(1, 'rgba(255,247,234,0)');
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - rr * 0.47, cy - rr * 0.88);
    ctx.arc(cx, cy, rr, -Math.PI / 2 - 0.49, -Math.PI / 2 + 0.49);
    ctx.closePath();
    ctx.fillStyle = cone;
    ctx.fill();
  }
  // the leg's suggested shortcut entrance (alley or tunnel arch): a small arch mark
  info.shortcutShown = false;
  if (f.shortcut) {
    const dx = f.shortcut.x - f.px, dz = f.shortcut.z - f.pz;
    const ex = sx(dx, dz), ey = sy(dx, dz);
    if (Math.hypot(ex, ey) < rr - 6 * u) {
      info.shortcutShown = true;
      const col = f.shortcut.kind === 'tunnel' ? C.tunnelMark : C.alley;
      // the run itself: a short dashed line from the entrance to the exit, with a chevron at the exit end
      const qx = sx(f.shortcut.ex - f.px, f.shortcut.ez - f.pz), qy = sy(f.shortcut.ex - f.px, f.shortcut.ez - f.pz);
      const ql = Math.hypot(qx - ex, qy - ey);
      if (ql > 4 * u) {
        const ux = (qx - ex) / ql, uy = (qy - ey) / ql;
        ctx.save();
        ctx.setLineDash([3.5 * u, 3 * u]);
        ctx.lineCap = 'round';
        ctx.lineWidth = 2.2 * u;
        ctx.strokeStyle = col;
        ctx.beginPath();
        ctx.moveTo(cx + ex + ux * 6 * u, cy + ey + uy * 6 * u);
        ctx.lineTo(cx + qx, cy + qy);
        ctx.stroke();
        ctx.setLineDash([]);
        const c = 4 * u;
        ctx.beginPath();
        ctx.moveTo(cx + qx - ux * c - uy * c, cy + qy - uy * c + ux * c);
        ctx.lineTo(cx + qx, cy + qy);
        ctx.lineTo(cx + qx - ux * c + uy * c, cy + qy - uy * c - ux * c);
        ctx.stroke();
        ctx.restore();
      }
      const a = 5.5 * u;
      ctx.lineWidth = 2.6 * u;
      ctx.lineCap = 'round';
      ctx.strokeStyle = C.cream;
      ctx.beginPath();
      ctx.moveTo(cx + ex - a, cy + ey + a * 0.7);
      ctx.lineTo(cx + ex - a, cy + ey - a * 0.1);
      ctx.arc(cx + ex, cy + ey - a * 0.1, a, Math.PI, 0);
      ctx.lineTo(cx + ex + a, cy + ey + a * 0.7);
      ctx.lineWidth = 4.4 * u;
      ctx.stroke();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.4 * u;
      ctx.stroke();
    }
  }

  // round 48: tailwind rings: a small hoop seen from above (a bar across the way through, with a cream outline)
  if (f.rings) {
    for (const r of f.rings) {
      if (!r.on) continue;
      const qx = sx(r.x - f.px, r.z - f.pz), qy = sy(r.x - f.px, r.z - f.pz);
      if (Math.hypot(qx, qy) > rr - 5 * u) continue;
      // across the way through: the screen direction of (dz, -dx)
      const ax = sx(r.dz, -r.dx), ay = sy(r.dz, -r.dx);
      const al = Math.hypot(ax, ay) || 1;
      const h = 5 * u;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + qx - (ax / al) * h, cy + qy - (ay / al) * h);
      ctx.lineTo(cx + qx + (ax / al) * h, cy + qy + (ay / al) * h);
      ctx.strokeStyle = C.cream;
      ctx.lineWidth = 4.6 * u;
      ctx.stroke();
      ctx.strokeStyle = C.ring;
      ctx.lineWidth = 2.6 * u;
      ctx.stroke();
    }
  }

  // the objective: a diamond inside the radius, an arrow on the rim outside it
  info.markerClamped = false;
  const pillH = 15 * u, pillTop = y + size - pillH + 2 * u;
  if (f.objective) {
    const o = f.objective;
    const col = o.kind === 'rush' ? C.rush : o.kind === 'drop' ? C.drop : C.pickup;
    const dx = o.x - f.px, dz = o.z - f.pz;
    let ox = sx(dx, dz), oy = sy(dx, dz);
    const r = Math.hypot(ox, oy);
    info.markerAngle = (Math.atan2(ox, -oy) * 180) / Math.PI;
    const edge = rr - 9 * u; // one threshold: the marker is clamped to it and turns into the edge arrow there
    if (r > edge) {
      // edge-clamped arrow, pointing out toward the objective
      info.markerClamped = true;
      const ux = ox / r, uy = oy / r;
      // behind the drone the arrow stops above the distance pill (same direction, a little closer in)
      const keep = uy > 0.2 && Math.abs(ux * edge) < 34 * u ? Math.min(edge, (pillTop - 9 * u - cy) / uy) : edge;
      ox = ux * keep; oy = uy * keep;
      const ang = Math.atan2(uy, ux);
      ctx.save();
      ctx.translate(cx + ox, cy + oy);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(7.5 * u, 0);
      ctx.lineTo(-5 * u, 6.5 * u);
      ctx.lineTo(-2.5 * u, 0);
      ctx.lineTo(-5 * u, -6.5 * u);
      ctx.closePath();
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3 * u;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.fill();
      ctx.restore();
    } else {
      const a = 6.5 * u;
      // a diamond that would sit under the distance pill moves up along its direction, just clear of it
      if (r > 1e-3 && oy > 0 && cy + oy + a > pillTop - 2 * u && Math.abs(ox) < 34 * u) {
        const kk = Math.max(0, (pillTop - 2 * u - a - cy) / oy);
        ox *= Math.min(1, kk); oy *= Math.min(1, kk);
      }
      ctx.beginPath();
      ctx.moveTo(cx + ox, cy + oy - a);
      ctx.lineTo(cx + ox + a, cy + oy);
      ctx.lineTo(cx + ox, cy + oy + a);
      ctx.lineTo(cx + ox - a, cy + oy);
      ctx.closePath();
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3 * u;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + ox, cy + oy, 1.8 * u, 0, Math.PI * 2);
      ctx.fillStyle = C.cream;
      ctx.fill();
    }
    info.markerR = Math.min(r, edge);
  }

  // the drone: an arrow at the centre, always pointing up
  ctx.beginPath();
  ctx.moveTo(cx, cy - 9 * u);
  ctx.lineTo(cx + 6.5 * u, cy + 6.5 * u);
  ctx.lineTo(cx, cy + 3 * u);
  ctx.lineTo(cx - 6.5 * u, cy + 6.5 * u);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3.2 * u;
  ctx.strokeStyle = C.cream;
  ctx.stroke();
  ctx.fillStyle = C.ink;
  ctx.fill();
  ctx.restore(); // clip off

  // the rim: cream ring with a thin ink edge
  ctx.beginPath();
  ctx.arc(cx, cy, rr + rim / 2, 0, Math.PI * 2);
  ctx.lineWidth = rim;
  ctx.strokeStyle = C.cream;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2 - 0.5, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(1, size / 160);
  ctx.strokeStyle = 'rgba(29,34,48,0.35)';
  ctx.stroke();

  // north tick on the rim: a small "N" where world north (-z) is
  {
    const nx = sx(0, -1), ny = sy(0, -1);
    const nl = Math.hypot(nx, ny) || 1;
    const px = cx + (nx / nl) * (rr + rim / 2), py = cy + (ny / nl) * (rr + rim / 2);
    const nr = 6.2 * u;
    // the distance pill owns the bottom of the rim: no N badge under it (heading roughly south)
    if (!(f.objective && ny / nl > 0.85)) {
    ctx.beginPath();
    ctx.arc(px, py, nr, 0, Math.PI * 2);
    ctx.fillStyle = C.ink;
    ctx.fill();
    ctx.fillStyle = C.cream;
    ctx.font = `900 ${Math.round(8.5 * u * 10) / 10}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', px, py + 0.5 * u);
    }
  }

  // the objective's distance: a pill on the bottom rim, in the objective's colour
  if (f.objective) {
    const o = f.objective;
    const col = o.kind === 'rush' ? C.rush : o.kind === 'drop' ? C.drop : C.pickup;
    const label = o.dist >= 1000 ? `${(o.dist / 1000).toFixed(1)} km` : `${Math.round(o.dist)} m`;
    ctx.font = `900 ${Math.round(11 * u * 10) / 10}px ${FONT}`;
    const tw = ctx.measureText(label).width;
    const ph = pillH, pw = tw + 16 * u;
    const px = cx - pw / 2, py = pillTop;
    roundRect(ctx, px, py, pw, ph, ph / 2);
    ctx.fillStyle = C.ink;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + 6.5 * u, py + ph / 2, 2.6 * u, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.fillStyle = C.cream;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, px + pw / 2 + 3 * u, py + ph / 2 + 0.5 * u);
  }
  return info;
}

const STORE_KEY = 'drone-dash-minimap-v1';

/** The DOM minimap: a canvas in the HUD, redrawn at most 30 times a second. */
export class Minimap {
  readonly el: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private layer: MinimapLayer | null = null;
  visible = true;
  radius = 150;
  private acc = 1;
  private cssSize = 0;
  private dpr = 1;
  /** Probes: draws, the mean and max cost of a draw (ms), and the last draw's marker info and frame. */
  draws = 0;
  private msSum = 0;
  msMax = 0;
  last: (MinimapDrawInfo & { yaw: number; px: number; pz: number; ox: number; oz: number; t: number }) | null = null;
  private sizeDirty = true;
  private readonly onResize = () => { this.sizeDirty = true; };

  constructor(el: HTMLCanvasElement) {
    this.el = el;
    this.ctx = el.getContext('2d');
    // the CSS size and pixel ratio are read only after a resize (one listener for the page's life; see dispose)
    window.addEventListener('resize', this.onResize);
    try {
      const v = storeGet(STORE_KEY);
      if (v === '0') this.visible = false;
    } catch {
      /* storage unavailable: default on */
    }
    this.apply();
  }

  /** Round 41: called after each redraw (the canvas HUD uploads this canvas as its minimap texture then). */
  onDrawn: (() => void) | null = null;

  dispose(): void {
    window.removeEventListener('resize', this.onResize);
  }

  /** The touch class (phone size) changed: read the size again on the next draw. */
  relayout(): void {
    this.sizeDirty = true;
  }

  setLayer(layer: MinimapLayer): void {
    this.layer = layer;
    this.acc = 1;
  }

  toggle(): void {
    this.visible = !this.visible;
    try {
      storeSet(STORE_KEY, this.visible ? '1' : '0');
    } catch {
      /* not remembered */
    }
    this.apply();
    this.acc = 1;
    this.sizeDirty = true;
  }

  private apply(): void {
    this.el.hidden = !this.visible;
  }

  get msMean(): number {
    return this.draws ? this.msSum / this.draws : 0;
  }

  resetStats(): void {
    this.draws = 0;
    this.msSum = 0;
    this.msMax = 0;
  }

  /** The canvas box in CSS px (null when hidden or not laid out). */
  box(): { l: number; t: number; r: number; b: number } | null {
    if (!this.visible) return null;
    const r = this.el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null;
  }

  /** Advance by real seconds. True when a redraw is due (at most 30 a second); nothing else is done on other frames. */
  due(realDt: number): boolean {
    if (!this.visible || !this.layer || !this.ctx) return false;
    this.acc += realDt;
    return this.acc >= 1 / 30 - 1e-4;
  }

  /** Redraw now (call when `due`, or any time in a fixed-step probe). */
  draw(frame: MinimapFrame): void {
    if (!this.visible || !this.layer || !this.ctx) return;
    this.acc = 0;
    const t0 = performance.now();
    if (this.sizeDirty) {
      // one CSS size; the backing store is that times the pixel ratio (at most 2), read only after a resize or toggle
      this.sizeDirty = false;
      this.cssSize = this.el.clientWidth;
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.el.width = Math.max(1, Math.round(this.cssSize * this.dpr));
      this.el.height = Math.max(1, Math.round(this.cssSize * this.dpr));
    }
    const css = this.cssSize, dpr = this.dpr;
    if (css <= 0) { this.sizeDirty = true; return; }
    const ctx = this.ctx;
    // draw in CSS pixels: text and icons keep their size at any pixel ratio
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, css, css);
    frame.radius = this.radius;
    // marks keep a readable size on the small phone map (at least 85% of the desktop marks)
    frame.markScale = Math.max(0.85, css / 160);
    const r = drawMinimap(ctx, 0, 0, css, this.layer, frame);
    this.onDrawn?.();
    const ms = performance.now() - t0;
    this.draws++;
    this.msSum += ms;
    this.msMax = Math.max(this.msMax, ms);
    const L = this.last ?? (this.last = { markerAngle: 0, markerClamped: false, markerR: 0, shortcutShown: false, yaw: 0, px: 0, pz: 0, ox: 0, oz: 0, t: 0 });
    L.markerAngle = r.markerAngle; L.markerClamped = r.markerClamped; L.markerR = r.markerR; L.shortcutShown = r.shortcutShown;
    L.yaw = frame.yaw; L.px = frame.px; L.pz = frame.pz; L.ox = frame.objective?.x ?? NaN; L.oz = frame.objective?.z ?? NaN; L.t = t0;
  }

  /** due() then draw(); `force` draws now. */
  update(realDt: number, frame: MinimapFrame, force = false): void {
    if (this.due(realDt) || force) this.draw(frame);
  }
}
