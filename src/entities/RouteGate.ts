import * as THREE from 'three';

/**
 * Round 20: the suggested route made visible in the world. When a leg's shortest street route takes an alley or a tunnel,
 * its entrance gets an arch in the objective colour with the feature's name on a board (the same text as the route hint),
 * and a hovering chevron over it that can be seen from down the street. The far mouth of the narrow run gets a plain
 * arch (the way out). Drawn only, never a collider, so a pilot who ignores it can fly any route.
 * Plain (tone-mapped) colours at ordinary intensity, so the bloom stays as calm as the rest of the city.
 */
export class RouteGate {
  readonly group = new THREE.Group();
  private readonly entry = new THREE.Group();
  private readonly exit = new THREE.Group();
  private readonly chevron = new THREE.Group();
  private readonly mat = new THREE.MeshBasicMaterial({ color: '#ffb400', fog: false });
  private readonly exitMat = new THREE.MeshBasicMaterial({ color: '#ffb400', transparent: true, opacity: 0.75, fog: false });
  private readonly boardMat: THREE.MeshBasicMaterial;
  private readonly canvas = document.createElement('canvas');
  private readonly tex: THREE.CanvasTexture;
  private readonly entryParts: THREE.Mesh[] = [];
  private readonly exitParts: THREE.Mesh[] = [];
  private boardText = '';
  private boardColor = '';
  private t = 0;
  private stage: 'entrance' | 'through' = 'entrance';

  constructor() {
    this.canvas.width = 512;
    this.canvas.height = 96;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.boardMat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, side: THREE.DoubleSide, fog: false, depthWrite: false });
    const box = (w: number, h: number, d: number, m: THREE.Material) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    // entrance arch: posts, a beam, the name board above it; local frame: x across the mouth, z into the alley
    for (const s of [-1, 1]) {
      const post = box(0.45, 9, 0.45, this.mat);
      post.position.set(s * 3.45, 4.75, 0);
      this.entryParts.push(post);
      const ep = box(0.35, 7.5, 0.35, this.exitMat);
      ep.position.set(s * 3.4, 4, 0);
      this.exitParts.push(ep);
    }
    const beam = box(7.6, 0.5, 0.45, this.mat);
    beam.position.set(0, 9.3, 0);
    this.entryParts.push(beam);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.5), this.boardMat);
    board.position.set(0, 10.5, -0.05);
    board.rotation.y = Math.PI; // faces the street (local -z)
    this.entryParts.push(board);
    const eb = box(7.2, 0.35, 0.35, this.exitMat);
    eb.position.set(0, 7.9, 0);
    this.exitParts.push(eb);
    // hovering chevron pointing down into the mouth, seen over traffic and from down the street
    for (const s of [-1, 1]) {
      const arm = box(0.5, 2.6, 0.5, this.mat);
      arm.position.set(s * 0.8, 0.9, 0);
      arm.rotation.z = s * 0.7;
      this.chevron.add(arm);
    }
    this.chevron.position.set(0, 14, 0);
    this.entry.add(...this.entryParts, this.chevron);
    this.exit.add(...this.exitParts);
    this.group.add(this.entry, this.exit);
    for (const m of [...this.entryParts, ...this.exitParts, ...(this.chevron.children as THREE.Mesh[])]) m.renderOrder = 2;
    this.group.visible = false;
  }

  /** Show the gate pair. `inward` is the unit direction into the alley at the entrance, `outward` out of it at the exit. */
  show(color: THREE.Color, name: string, gate: THREE.Vector3, inward: { x: number; z: number }, exit: THREE.Vector3, outward: { x: number; z: number }, width = 6): void {
    // posts stand just outside the slot (flush with the mouth corners), so the arch never narrows it
    const k = (width / 2 + 0.45) / 3.45;
    this.entry.scale.set(k, 1, 1);
    this.exit.scale.set(k, 1, 1);
    this.mat.color.copy(color);
    this.exitMat.color.copy(color);
    this.entry.position.copy(gate);
    this.entry.rotation.y = Math.atan2(inward.x, inward.z);
    this.exit.position.copy(exit);
    this.exit.rotation.y = Math.atan2(outward.x, outward.z);
    const hex = color.getHexString();
    if (name !== this.boardText || hex !== this.boardColor) this.drawBoard(name, '#' + hex);
    this.setStage('entrance');
    this.group.visible = true;
  }

  setStage(stage: 'entrance' | 'through'): void {
    this.stage = stage;
    this.chevron.visible = stage === 'entrance'; // the named arch stays (behind you); the chevron moves on
    this.exit.visible = true;
  }

  hide(): void {
    this.group.visible = false;
  }

  get visible(): boolean {
    return this.group.visible;
  }

  get text(): string {
    return this.group.visible ? this.boardText : '';
  }

  update(dt: number): void {
    if (!this.group.visible) return;
    this.t += dt;
    this.chevron.position.y = 14 + Math.sin(this.t * 3) * 0.6;
    const pulse = 0.8 + 0.2 * Math.sin(this.t * 4);
    this.exitMat.opacity = (this.stage === 'through' ? 0.95 : 0.6) * pulse;
  }

  private drawBoard(name: string, color: string): void {
    this.boardText = name;
    this.boardColor = color.slice(1);
    const c = this.canvas.getContext('2d');
    if (!c) return;
    const w = this.canvas.width, h = this.canvas.height;
    c.clearRect(0, 0, w, h);
    c.fillStyle = 'rgba(28, 20, 34, 0.88)';
    c.beginPath();
    c.roundRect(4, 4, w - 8, h - 8, 18);
    c.fill();
    c.lineWidth = 7;
    c.strokeStyle = color;
    c.stroke();
    c.fillStyle = '#fff6e8';
    let size = 54;
    c.font = `900 ${size}px system-ui, -apple-system, Segoe UI, sans-serif`;
    while (c.measureText(name).width > w - 48 && size > 28) {
      size -= 2;
      c.font = `900 ${size}px system-ui, -apple-system, Segoe UI, sans-serif`;
    }
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(name, w / 2, h / 2 + 3);
    this.tex.needsUpdate = true;
  }
}
