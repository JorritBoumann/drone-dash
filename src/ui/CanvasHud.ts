import * as THREE from 'three';

/**
 * Round 41: the recording HUD, drawn on the WebGL canvas itself (the Stateloop recorder captures only the canvas).
 * Each panel is a small 2D canvas on a screen-space quad in an orthographic scene, drawn after post-processing (so bloom
 * never touches it). A panel is redrawn and uploaded only when its values change, at most `hz` times a second.
 * Placement: every panel sits on the box of the HTML element it replaces (kept in the layout with visibility: hidden),
 * so the safe areas, the 64 px top-left corner and every overlap rule of the HTML HUD hold for the canvas HUD too.
 */
export const HUD_FONT = 'ui-rounded, "SF Pro Rounded", Nunito, "Avenir Next", "Segoe UI", system-ui, sans-serif';
export type Box = { x: number; y: number; w: number; h: number };
type Ctx = CanvasRenderingContext2D;

export class Panel {
  readonly canvas = document.createElement('canvas');
  readonly ctx: Ctx;
  tex: THREE.Texture;
  readonly mat: THREE.MeshBasicMaterial;
  readonly mesh: THREE.Mesh;
  allocW = 0;
  allocH = 0;
  pr = 1;
  key = '';
  lastAt = -1e9;
  draws = 0;
  box: Box | null = null; // where the panel is on screen (CSS px), null when hidden
  constructor(readonly name: string, readonly hz: number, external?: HTMLCanvasElement) {
    this.ctx = this.canvas.getContext('2d')!;
    this.tex = new THREE.CanvasTexture(external ?? this.canvas);
    this.setupTex(this.tex);
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.name = `hud-${name}`;
  }
  private setupTex(t: THREE.Texture): void {
    t.colorSpace = THREE.SRGBColorSpace;
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
  }
  /** Make the backing store at least w x h CSS px at pixel ratio pr. Returns the context in CSS px, cleared. */
  begin(w: number, h: number, pr: number): Ctx {
    const aw = Math.ceil(w / 8) * 8, ah = Math.ceil(h / 8) * 8;
    if (aw > this.allocW || ah > this.allocH || pr !== this.pr) {
      this.allocW = Math.max(aw, pr === this.pr ? this.allocW : 0);
      this.allocH = Math.max(ah, pr === this.pr ? this.allocH : 0);
      this.pr = pr;
      this.canvas.width = Math.round(this.allocW * pr);
      this.canvas.height = Math.round(this.allocH * pr);
      // a new size needs a new GPU texture
      this.tex.dispose();
      this.tex = new THREE.CanvasTexture(this.canvas);
      this.setupTex(this.tex);
      this.mat.map = this.tex;
    }
    const c = this.ctx;
    c.setTransform(pr, 0, 0, pr, 0, 0);
    c.clearRect(0, 0, this.allocW, this.allocH);
    return c;
  }
  commit(now: number): void {
    this.tex.needsUpdate = true;
    this.lastAt = now;
    this.draws++;
  }
  /** Put the texture's top-left at (x, y) CSS px, snapped to whole device pixels. */
  place(x: number, y: number, w = this.allocW, h = this.allocH): void {
    const pr = this.pr;
    const sx = Math.round(x * pr) / pr, sy = Math.round(y * pr) / pr;
    this.mesh.position.set(sx + w / 2, -(sy + h / 2), 0);
    this.mesh.scale.set(w, h, 1);
  }
  dispose(): void {
    this.tex.dispose();
    this.mat.dispose();
    this.mesh.geometry.dispose();
  }
}

export function roundRect(c: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, h / 2, w / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

export const font = (weight: number, px: number): string => `${weight} ${px}px ${HUD_FONT}`;
export const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');

/** Numbers the game passes each frame (text comes from the hidden HTML HUD, so both always say the same). */
export type HudNumbers = { timeFrac: number; goalQ: number; slipLevel: number; objDist: number };
type Ev = { kind: string; main: string; sub: string; tone: string; el: HTMLElement; at: number; dur: number };

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const TONE: Record<string, string> = { drop: '#2fe6c0', pickup: '#ffb400', crash: '#ff5d4a', rush: '#ff6a3d', event: '#fff7ea', slip: '#ffc35a', medal1: '#f0a46b', medal2: '#e6ecf3', medal3: '#ffd166', medal4: '#5ff5d4' };
const MEDAL = ['#9aa3b0', '#e0955a', '#eef2f7', '#ffd166', '#5ff5d4'];

export class CanvasHud {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10);
  readonly panels: Record<'score' | 'clock' | 'objective' | 'slip' | 'event' | 'over', Panel>;
  readonly map: Panel;
  private readonly el = {
    score: document.querySelector('.hud-score') as HTMLElement, scoreValue: $('score-value'), pending: $('score-pending'),
    goal: $('goal'), goalName: $('goal-name'), goalScore: $('goal-score'), combo: $('combo-chip'), comboValue: $('combo-value'),
    timer: $('timer'), timerValue: $('timer-value'), objective: $('objective'), objVerb: $('objective-verb'), objName: $('objective-name'),
    rush: $('objective-rush'), rushValue: $('objective-rush-value'), slip: $('slip'), slipChain: $('slip-chain'), minimap: $('minimap'),
    right: document.querySelector('.hud-right') as HTMLElement,
  };
  private boxes: Record<string, Box | null> = {};
  private flags = { goal: false, combo: false, pending: false, slipOn: 0, rush: false };
  private measuredAt = -1e9;
  private vw = 0;
  private vh = 0;
  private ev: Ev | null = null;
  private evDrawn: Ev | null = null;
  mapDirty = false;
  uploads = 0;
  msSum = 0;
  msMax = 0;
  frames = 0;

  constructor(private readonly app: HTMLElement, minimapCanvas: HTMLCanvasElement, private readonly pr: () => number) {
    this.panels = {
      score: new Panel('score', 20), clock: new Panel('clock', 20), objective: new Panel('objective', 12),
      slip: new Panel('slip', 20), event: new Panel('event', 30), over: new Panel('over', 4),
    };
    this.map = new Panel('minimap', 30, minimapCanvas);
    for (const p of [...Object.values(this.panels), this.map]) this.scene.add(p.mesh);
    app.classList.add('canvas-hud');
    window.addEventListener('resize', this.onResize);
  }

  private readonly onResize = () => { this.measuredAt = -1e9; };

  dispose(): void {
    window.removeEventListener('resize', this.onResize);
    for (const p of [...Object.values(this.panels), this.map]) p.dispose();
    this.app.classList.remove('canvas-hud');
  }

  /** A centre message (pop, medal, event, payout) was shown by the HTML HUD: the canvas shows the same words. */
  centre(kind: string, main: string, sub: string, tone: string, el: HTMLElement, durMs: number): void {
    this.ev = { kind, main, sub, tone, el, at: performance.now(), dur: durMs };
    // round 42: where the HTML message rests, read now (the old box, measured up to 250 ms ago, put a new label on the
    // objective pill for a frame or two)
    this.evAnchor = this.anchorOf(el);
  }

  /** Round 42: the resting centre of a centre message (left / top of an element centred with translate(-50%, -50%)). */
  private evAnchor: { x: number; y: number } | null = null;
  private anchorOf(el: HTMLElement): { x: number; y: number } | null {
    const p = el.offsetParent as HTMLElement | null;
    if (!p) return null;
    const r = p.getBoundingClientRect();
    return { x: r.left + el.offsetLeft, y: r.top + el.offsetTop };
  }

  clearEvents(): void {
    this.ev = null;
  }

  /** Boxes of the hidden HTML elements, read at most 4 times a second (and after a resize). */
  private measure(now: number): void {
    if (now - this.measuredAt < 250) return;
    this.measuredAt = now;
    const vis = (e: HTMLElement): Box | null => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
    };
    const E = this.el;
    this.boxes.score = vis(E.score);
    this.boxes.clock = vis(E.timer);
    this.boxes.objective = vis(E.objective);
    this.boxes.slip = vis(E.slip);
    this.boxes.minimap = E.minimap.hidden ? null : vis(E.minimap);
    this.boxes.right = vis(E.right);
    this.flags.goal = !!vis(E.goal);
    this.flags.combo = !E.combo.hidden && !!vis(E.combo);
    this.flags.pending = !E.pending.hidden && !!vis(E.pending);
    this.flags.rush = !E.rush.hidden && !!vis(E.rush);
    this.flags.slipOn = this.boxes.slip ? Number(getComputedStyle(E.slip).opacity) : 0;
    if (this.ev) this.evAnchor = this.anchorOf(this.ev.el) ?? this.evAnchor;
  }

  /** Every frame in play or pause. Redraws only panels whose content changed (each at most its own rate). */
  update(n: HudNumbers, touch: boolean): void {
    const t0 = performance.now();
    this.measure(t0);
    const pr = this.pr();
    const P = this.panels;
    const due = (p: Panel, key: string) => key !== p.key && t0 - p.lastAt >= 1000 / p.hz - 1;
    const E = this.el;

    // score, pending bank, medal goal, combo
    const sb = this.boxes.score;
    if (sb) {
      const key = `${E.scoreValue.textContent}|${this.flags.pending ? E.pending.textContent : ''}|${this.flags.goal ? `${E.goalName.textContent}${E.goalScore.textContent}${E.goal.dataset.m}${Math.round(n.goalQ * 100)}` : ''}|${this.flags.combo ? E.comboValue.textContent : ''}|${pr}|${touch}`;
      if (due(P.score, key)) { P.score.key = key; this.drawScore(P.score, pr, n, touch); P.score.commit(t0); this.uploads++; }
      P.score.place(sb.x - 8, sb.y - 6);
      P.score.box = { x: sb.x - 8, y: sb.y - 6, w: this.scoreW, h: this.scoreH };
    }
    this.show(P.score, !!sb);

    const cb = this.boxes.clock;
    if (cb) {
      const T = E.timer.classList;
      const st = T.contains('ot') || T.contains('ot-done') ? 'ot' : T.contains('low') ? 'low' : T.contains('slow') ? 'slow' : '';
      const key = `${E.timerValue.textContent}|${st}|${Math.round(n.timeFrac * 60)}|${Math.round(cb.w)}x${Math.round(cb.h)}|${pr}`;
      if (due(P.clock, key)) { P.clock.key = key; this.drawClock(P.clock, pr, cb, n.timeFrac, st); P.clock.commit(t0); this.uploads++; }
      P.clock.place(cb.x, cb.y);
      P.clock.box = { x: cb.x, y: cb.y, w: cb.w, h: cb.h };
    }
    this.show(P.clock, !!cb);

    const ob = this.boxes.objective;
    if (ob) {
      const kind = E.objective.dataset.rush === '1' ? 'rush' : E.objective.dataset.kind ?? 'pickup';
      const dist = n.objDist >= 0 ? `${Math.round(n.objDist)} m` : '';
      const maxW = this.objMax();
      const key = `${kind}|${E.objVerb.textContent}|${E.objName.textContent}|${dist}|${this.flags.rush ? E.rushValue.textContent : ''}|${pr}|${touch}|${maxW}`;
      if (due(P.objective, key)) { P.objective.key = key; this.drawObjective(P.objective, pr, kind, dist, touch, maxW); P.objective.commit(t0); this.uploads++; }
      const x = ob.x + ob.w / 2 - P.objective.allocW / 2;
      P.objective.place(x, ob.y);
      P.objective.box = { x: ob.x + ob.w / 2 - this.objW / 2, y: ob.y, w: this.objW, h: this.objH };
    }
    this.show(P.objective, !!ob);

    const slb = this.boxes.slip;
    const slipOn = !!slb && this.flags.slipOn > 0.05;
    if (slb && slipOn) {
      const key = `${E.slipChain.textContent}|${Math.round(n.slipLevel * 40)}|${E.slip.classList.contains('drafting')}|${pr}|${Math.round(slb.w)}`;
      if (due(P.slip, key)) { P.slip.key = key; this.drawSlip(P.slip, pr, slb, n.slipLevel); P.slip.commit(t0); this.uploads++; }
      P.slip.place(slb.x - 6, slb.y - 4);
      P.slip.box = { x: slb.x - 6, y: slb.y - 4, w: slb.w + 12, h: slb.h + 8 };
      P.slip.mat.opacity = Math.min(1, this.flags.slipOn);
    }
    this.show(P.slip, slipOn);

    this.updateEvent(t0, pr, touch);

    const mb = this.boxes.minimap;
    if (mb && this.mapDirty) { this.map.tex.needsUpdate = true; this.mapDirty = false; this.uploads++; this.map.draws++; }
    if (mb) { this.map.pr = pr; this.map.place(mb.x, mb.y, mb.w, mb.h); this.map.box = mb; }
    this.show(this.map, !!mb);

    const ms = performance.now() - t0;
    this.frames++;
    this.msSum += ms;
    this.msMax = Math.max(this.msMax, ms);
  }

  private show(p: Panel, on: boolean): void {
    p.mesh.visible = on;
    if (!on) p.box = null;
  }

  render(renderer: THREE.WebGLRenderer): void {
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    if (w !== this.vw || h !== this.vh) {
      this.vw = w;
      this.vh = h;
      this.camera.left = 0; this.camera.right = w; this.camera.top = 0; this.camera.bottom = -h;
      this.camera.updateProjectionMatrix();
    }
    const auto = renderer.autoClear;
    renderer.autoClear = false;
    renderer.render(this.scene, this.camera);
    renderer.autoClear = auto;
  }

  hideAll(): void {
    for (const p of [...Object.values(this.panels), this.map]) this.show(p, false);
  }

  private drawScore(p: Panel, pr: number, n: HudNumbers, touch: boolean): void {
    const E = this.el, F = this.flags;
    const big = touch ? 26 : 32;
    const tmp = p.ctx;
    tmp.font = font(800, big);
    const sw = tmp.measureText(E.scoreValue.textContent ?? '0').width;
    tmp.font = font(800, 13);
    const pw = F.pending ? tmp.measureText(E.pending.textContent ?? '').width + 14 : 0;
    const goalText = F.goal ? `${E.goalName.textContent} ${E.goalScore.textContent}` : '';
    const gw = F.goal ? tmp.measureText(goalText).width + 26 : 0;
    const w = Math.ceil(Math.max(150, 24 + sw + (pw ? pw + 8 : 0), 24 + gw));
    const h = 18 + big + (F.goal ? 24 : 0) + (F.combo ? 24 : 0) + 8;
    const c = p.begin(w, h, pr);
    this.scoreW = w;
    this.scoreH = h;
    c.fillStyle = 'rgba(29, 34, 48, 0.46)';
    roundRect(c, 0, 0, w, h, 12);
    c.fill();
    c.textBaseline = 'alphabetic';
    c.fillStyle = 'rgba(255, 247, 234, 0.78)';
    c.font = font(800, 10);
    c.fillText('SCORE', 12, 15);
    c.fillStyle = '#fff7ea';
    c.font = font(800, big);
    c.fillText(E.scoreValue.textContent ?? '0', 12, 14 + big);
    if (pw) {
      c.font = font(800, 13);
      c.fillStyle = 'rgba(47, 230, 192, 0.25)';
      roundRect(c, 20 + sw, 18 + big * 0.35, pw, 18, 9);
      c.fill();
      c.fillStyle = '#5ff5d4';
      c.fillText(E.pending.textContent ?? '', 27 + sw, 18 + big * 0.35 + 13.5);
    }
    let y = 18 + big;
    if (F.goal) {
      const tier = Number(E.goal.dataset.m) || 1;
      c.fillStyle = MEDAL[Math.min(4, tier)];
      c.beginPath();
      c.arc(19, y + 9, 6, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#fff7ea';
      c.font = font(800, 13);
      c.fillText(goalText, 30, y + 13.5);
      c.fillStyle = 'rgba(255, 247, 234, 0.25)';
      roundRect(c, 12, y + 19, w - 24, 4, 2);
      c.fill();
      c.fillStyle = MEDAL[Math.min(4, tier)];
      roundRect(c, 12, y + 19, Math.max(4, (w - 24) * Math.max(0, Math.min(1, n.goalQ))), 4, 2);
      c.fill();
      y += 24;
    }
    if (F.combo) {
      const txt = `${E.comboValue.textContent} combo`;
      c.font = font(800, 12);
      const cw = c.measureText(txt).width + 16;
      c.fillStyle = 'rgba(255, 176, 46, 0.9)';
      roundRect(c, 12, y + 4, cw, 18, 9);
      c.fill();
      c.fillStyle = '#1d2230';
      c.fillText(txt, 20, y + 17);
    }
  }

  private drawClock(p: Panel, pr: number, b: Box, frac: number, st: string): void {
    const w = Math.ceil(b.w), h = Math.ceil(b.h);
    const c = p.begin(w, h, pr);
    const col = st === 'ot' ? '#ffd166' : st === 'low' ? '#ff5d4a' : st === 'slow' ? '#2ff0c4' : '#ffb02e';
    c.fillStyle = st === 'low' ? 'rgba(120, 24, 16, 0.62)' : 'rgba(29, 34, 48, 0.55)';
    roundRect(c, 0, 0, w, h, h / 2);
    c.fill();
    const r = h / 2 - 8, cx = 6 + r + 2, cy = h / 2;
    c.lineWidth = 4;
    c.strokeStyle = 'rgba(255, 247, 234, 0.22)';
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = col;
    c.lineCap = 'round';
    c.beginPath(); c.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.001, Math.min(1, frac))); c.stroke();
    c.fillStyle = st === 'low' || st === 'ot' ? col : '#fff7ea';
    c.font = font(800, Math.round(h * 0.5));
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.fillText(this.el.timerValue.textContent ?? '', cx + r + 8, cy + 1);
    c.textBaseline = 'alphabetic';
  }

  private scoreW = 0;
  private scoreH = 0;
  private objW = 0;
  private objH = 0;
  /**
   * Round 42: the widest the objective pill may be. It is centred, so twice the smaller gap to the score panel (as drawn
   * here) and to the right chips, and never wider than the HTML pill's own cap (--obj-max, set by Hud.fitObjective).
   */
  private objMax(): number {
    const css = parseFloat(this.el.objective.style.getPropertyValue('--obj-max')) || 420;
    let half = this.vw / 2 - 12;
    const sb = this.panels.score.box;
    if (sb) half = Math.min(half, this.vw / 2 - (sb.x + sb.w) - 12);
    const rb = this.boxes.right;
    if (rb) half = Math.min(half, rb.x - this.vw / 2 - 12);
    return Math.max(120, Math.min(css, 420, Math.floor(half * 2)));
  }
  private drawObjective(p: Panel, pr: number, kind: string, dist: string, touch: boolean, maxW: number): void {
    const E = this.el, c0 = p.ctx;
    const verb = (E.objVerb.textContent ?? '').toUpperCase();
    const name = E.objName.textContent ?? '';
    const fs = touch ? 14 : 16;
    c0.font = font(900, 11);
    const vw = c0.measureText(verb).width;
    c0.font = font(800, fs);
    let nm = name;
    const maxName = touch ? 170 : 240;
    while (nm.length > 3 && c0.measureText(nm).width > maxName) nm = nm.slice(0, -2);
    if (nm !== name) nm = `${nm.trimEnd()}…`;
    c0.font = font(800, fs - 1);
    const dw = dist ? c0.measureText(dist).width + 14 : 0;
    const rush = this.flags.rush ? `RUSH ${E.rushValue.textContent}` : '';
    c0.font = font(900, 11);
    const rw = rush ? c0.measureText(rush).width + 16 : 0;
    const h = touch ? 30 : 34;
    // round 42: a long name is cut so the pill keeps to its slot (it never reaches the score panel)
    const rest = 30 + vw + 8 + dw + (rw ? rw + 8 : 0) + 14;
    c0.font = font(800, fs);
    let nw = c0.measureText(nm).width;
    if (rest + nw > maxW) {
      let cut = nm.replace(/…$/, '');
      while (cut.length > 1 && rest + c0.measureText(`${cut.trimEnd()}…`).width > maxW) cut = cut.slice(0, -1);
      nm = `${cut.trimEnd()}…`;
      nw = c0.measureText(nm).width;
    }
    const w = Math.ceil(rest + nw);
    const aw = Math.max(w, 480);
    const c = p.begin(aw, h, pr);
    this.objW = w;
    this.objH = h;
    const x0 = Math.round((p.allocW - w) / 2);
    const col = TONE[kind === 'drop' ? 'drop' : kind === 'rush' ? 'rush' : 'pickup'];
    c.fillStyle = 'rgba(29, 34, 48, 0.62)';
    roundRect(c, x0, 0, w, h, 12);
    c.fill();
    c.fillStyle = col;
    c.beginPath(); c.arc(x0 + 16, h / 2, 5, 0, Math.PI * 2); c.fill();
    c.textBaseline = 'middle';
    let x = x0 + 28;
    c.font = font(900, 11);
    c.fillText(verb, x, h / 2 + 1);
    x += vw + 8;
    c.fillStyle = '#fff7ea';
    c.font = font(800, fs);
    c.fillText(nm, x, h / 2 + 1);
    x += nw;
    if (dist) {
      c.fillStyle = col;
      c.font = font(800, fs - 1);
      c.fillText(` · ${dist}`, x + 2, h / 2 + 1);
      x += dw;
    }
    if (rush) {
      c.fillStyle = '#ff6a3d';
      roundRect(c, x + 8, h / 2 - 9, rw, 18, 9);
      c.fill();
      c.fillStyle = '#1d2230';
      c.font = font(900, 11);
      c.fillText(rush, x + 16, h / 2 + 1);
    }
    c.textBaseline = 'alphabetic';
  }

  private drawSlip(p: Panel, pr: number, b: Box, level: number): void {
    const w = Math.ceil(b.w) + 12, h = Math.ceil(b.h) + 8;
    const c = p.begin(w, h, pr);
    c.fillStyle = 'rgba(29, 34, 48, 0.5)';
    roundRect(c, 0, 0, w, h, 10);
    c.fill();
    const chain = this.el.slipChain.textContent ?? '';
    c.font = font(900, 11);
    c.fillStyle = '#fff7ea';
    c.fillText('SLIPSTREAM', 10, 16);
    if (chain) {
      const lw = c.measureText('SLIPSTREAM').width;
      c.fillStyle = '#ffb02e';
      c.font = font(900, 13);
      c.fillText(chain, 16 + lw, 16.5);
    }
    const by = Math.min(h - 12, 24);
    c.fillStyle = 'rgba(255, 247, 234, 0.22)';
    roundRect(c, 10, by, w - 20, 7, 3.5);
    c.fill();
    const g = c.createLinearGradient(10, 0, w - 10, 0);
    g.addColorStop(0, '#ff9a2e');
    g.addColorStop(1, '#ffe08a');
    c.fillStyle = g;
    if (level > 0.01) {
      roundRect(c, 10, by, Math.max(7, (w - 20) * Math.min(1, level)), 7, 3.5);
      c.fill();
    }
  }

  private updateEvent(now: number, pr: number, touch: boolean): void {
    const P = this.panels.event, e = this.ev;
    if (!e || now - e.at > e.dur + 300) { this.show(P, false); return; }
    if (this.evDrawn !== e || P.pr !== pr) {
      this.evDrawn = e;
      const mf = touch ? 22 : 28, sf = touch ? 12 : 14;
      const c0 = P.ctx;
      c0.font = font(900, mf);
      const mw = c0.measureText(e.main).width;
      c0.font = font(800, sf);
      const sw = e.sub ? c0.measureText(e.sub).width : 0;
      const w = Math.ceil(Math.max(mw, sw) + 36), h = Math.ceil(mf + (e.sub ? sf + 10 : 0) + 22);
      const c = P.begin(w, h, pr);
      c.fillStyle = 'rgba(29, 34, 48, 0.6)';
      roundRect(c, 0, 0, w, h, 14);
      c.fill();
      c.textAlign = 'center';
      c.fillStyle = TONE[e.tone] ?? '#fff7ea';
      c.font = font(900, mf);
      c.fillText(e.main, w / 2, 10 + mf * 0.85);
      if (e.sub) {
        c.fillStyle = '#fff7ea';
        c.font = font(800, sf);
        c.fillText(e.sub, w / 2, 14 + mf + sf);
      }
      c.textAlign = 'left';
      P.key = `${e.main}|${e.sub}`;
      P.commit(now);
      this.uploads++;
      P.box = { x: 0, y: 0, w, h };
      this.evW = w;
      this.evH = h;
    }
    const a = this.evAnchor;
    let cx = a ? a.x : this.vw / 2, cy = a ? a.y : this.vh * 0.32;
    const w = this.evW, h = this.evH;
    cx = Math.max(w / 2 + 8, Math.min(this.vw - w / 2 - 8, cx));
    cy = Math.max(h / 2 + 8, Math.min(this.vh - h / 2 - 8, cy));
    let x = cx - w / 2;
    let y = cy - h / 2;
    if (x < 72 && y < 64) x = 72; // the platform's back arrow corner
    // round 42: never on (or touching) the score panel, the clock, the objective pill or the minimap: below them
    const gap = 6;
    for (let i = 0; i < 4; i++) {
      let moved = false;
      for (const q of [this.panels.score.box, this.panels.clock.box, this.panels.objective.box, this.map.box]) {
        if (q && x < q.x + q.w + gap && q.x < x + w + gap && y < q.y + q.h + gap && q.y < y + h + gap) { y = q.y + q.h + gap; moved = true; }
      }
      if (!moved) break;
    }
    const age = now - e.at;
    const fadeIn = Math.min(1, age / 120), fadeOut = Math.max(0, Math.min(1, (e.dur + 300 - age) / 300));
    P.mat.opacity = Math.min(fadeIn, fadeOut);
    // round 42: the pop-in scale is set from the base size every frame (it multiplied the current scale before), and
    // grows about the label's centre
    const s = age < 160 ? 0.9 + 0.1 * (age / 160) : 1;
    this.evScale = s;
    this.evAge = age;
    if (s === 1) P.place(x, y);
    else {
      const pr2 = P.pr, sx = Math.round((x + (w * (1 - s)) / 2) * pr2) / pr2, sy = Math.round((y + (h * (1 - s)) / 2) * pr2) / pr2;
      P.mesh.position.set(sx + (P.allocW * s) / 2, -(sy + (P.allocH * s) / 2), 0);
      P.mesh.scale.set(P.allocW * s, P.allocH * s, 1);
    }
    P.box = { x, y, w, h };
    this.show(P, true);
  }
  private evScale = 1;
  private evAge = 0;

  /**
   * Round 42: the game-over card, on the canvas (the recorder sees only the canvas). Score, medal, a short breakdown and
   * the city seed, read from the HTML game-over card (so both say the same). Drawn once per run end, centred.
   */
  private overKey = '';
  private overAt = 0;
  updateOver(seed: number, touch: boolean): void {
    const now = performance.now();
    const pr = this.pr();
    for (const p of [...Object.values(this.panels), this.map]) if (p !== this.panels.over) this.show(p, false);
    const P = this.panels.over;
    const t = (id: string) => (document.getElementById(id)?.textContent ?? '').trim();
    const rows: [string, string][] = [];
    for (const d of Array.from(document.querySelectorAll('#over-breakdown > div'))) {
      const dt = d.querySelector('dt'), dd = d.querySelector('dd');
      if (!dt || !dd || d.classList.contains('total')) continue;
      const small = dt.querySelector('small')?.textContent ?? '';
      const label = (dt.firstChild?.textContent ?? '').trim();
      rows.push([small ? `${label} ${small}` : label, (dd.textContent ?? '').trim()]);
    }
    const tier = Number((document.getElementById('over-medal') as HTMLElement | null)?.dataset.m ?? 0) || 0;
    const key = `${t('over-score')}|${t('over-medal-name')}|${rows.map((r) => r.join('=')).join(';')}|${seed}|${pr}|${touch}|${this.vw}x${this.vh}`;
    if (key !== this.overKey) {
      if (!this.overKey) this.overAt = now;
      this.overKey = key;
      this.drawOver(P, pr, touch, t('over-score'), t('over-medal-name'), tier, rows, seed, t('over-city'));
      P.commit(now);
      this.uploads++;
    }
    const w = this.overW, h = this.overH;
    const x = Math.max(72, (this.vw - w) / 2), y = Math.max(8, (this.vh - h) / 2);
    P.place(x, y);
    P.box = { x, y, w, h };
    P.mat.opacity = Math.min(1, (now - this.overAt) / 250);
    this.show(P, true);
  }
  hideOver(): void {
    this.show(this.panels.over, false);
    this.overKey = '';
  }
  private overW = 0;
  private overH = 0;
  private drawOver(p: Panel, pr: number, touch: boolean, score: string, medal: string, tier: number, rows: [string, string][], seed: number, city: string): void {
    const small = touch || this.vh < 460;
    const S = small ? 0.8 : 1;
    const pad = Math.round(18 * S), rowH = Math.round(17 * S), big = Math.round(46 * S);
    const c0 = p.ctx;
    const seedLine = city && !/\d/.test(city) ? `${city} · seed ${seed}` : `City seed ${seed}`;
    c0.font = font(800, Math.round(13 * S));
    let w = Math.round(280 * S);
    for (const [l, v] of rows) w = Math.max(w, c0.measureText(l).width + c0.measureText(v).width + 2 * pad + 24);
    c0.font = font(800, Math.round(12 * S));
    w = Math.ceil(Math.min(Math.max(w, c0.measureText(seedLine).width + 2 * pad), this.vw - 88));
    const h = Math.ceil(pad + 14 * S + 8 + 22 * S + 6 + big + 10 + rows.length * rowH + 8 + 16 * S + pad);
    const c = p.begin(w, h, pr);
    this.overW = w;
    this.overH = h;
    c.fillStyle = 'rgba(29, 34, 48, 0.82)';
    roundRect(c, 0, 0, w, h, 16);
    c.fill();
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    let y = pad + 11 * S;
    c.fillStyle = '#ffb02e';
    c.font = font(900, Math.round(12 * S));
    c.fillText("TIME'S UP", w / 2, y);
    y += 8 + 20 * S;
    c.font = font(900, Math.round(16 * S));
    const mw = c.measureText(medal).width;
    c.fillStyle = MEDAL[Math.min(4, Math.max(0, tier))];
    c.beginPath(); c.arc(w / 2 - mw / 2 - 12 * S, y - 5 * S, 7 * S, 0, Math.PI * 2); c.fill();
    c.fillStyle = tier > 0 ? MEDAL[Math.min(4, tier)] : '#fff7ea';
    c.fillText(medal, w / 2 + 6 * S, y);
    y += 6 + big * 0.9;
    c.fillStyle = '#fff7ea';
    c.font = font(900, big);
    c.fillText(score, w / 2, y);
    y += 10 + big * 0.1;
    c.font = font(800, Math.round(13 * S));
    for (const [l, v] of rows) {
      y += rowH;
      c.textAlign = 'left';
      c.fillStyle = 'rgba(255, 247, 234, 0.82)';
      c.fillText(l, pad, y);
      c.textAlign = 'right';
      c.fillStyle = '#fff7ea';
      c.fillText(v, w - pad, y);
    }
    c.fillStyle = 'rgba(255, 247, 234, 0.22)';
    c.fillRect(pad, y + 6, w - 2 * pad, 1);
    y += 8 + 14 * S;
    c.textAlign = 'center';
    c.fillStyle = 'rgba(255, 247, 234, 0.7)';
    c.font = font(800, Math.round(12 * S));
    c.fillText(seedLine, w / 2, y);
    c.textAlign = 'left';
  }
  private evW = 0;
  private evH = 0;

  /** Debug hook data. */
  stats(): Record<string, unknown> {
    const out: Record<string, unknown> = { on: true, uploads: this.uploads, msMean: this.frames ? this.msSum / this.frames : 0, msMax: this.msMax, frames: this.frames };
    out.panels = [...Object.values(this.panels), this.map].map((p) => ({ name: p.name, visible: p.mesh.visible, box: p.box, draws: p.draws, tex: [p.canvas.width, p.canvas.height], opacity: p.mat.opacity }));
    out.event = this.ev ? { main: this.ev.main, sub: this.ev.sub, kind: this.ev.kind, age: this.evAge, scale: this.evScale, meshScale: [this.panels.event.mesh.scale.x, this.panels.event.mesh.scale.y], alloc: [this.panels.event.allocW, this.panels.event.allocH] } : null;
    return out;
  }
  resetStats(): void {
    this.uploads = 0; this.msSum = 0; this.msMax = 0; this.frames = 0;
  }
}
