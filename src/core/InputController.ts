/**
 * Collects keyboard, mouse and touch input into flight intents.
 *  - turn:   -1 (left) .. 1 (right)
 *  - thrust: -1 (back) .. 1 (forward)
 *  - lift:   -1 (down) .. 1 (up)
 *  - boost:  held
 */
export type FlightIntent = {
  turn: number;
  thrust: number;
  lift: number;
  boost: boolean;
};

const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'ShiftLeft', 'ShiftRight', 'KeyC', 'KeyE',
]);

type StickState = { id: number | null; cx: number; cy: number; radius: number; x: number; y: number };

export class InputController {
  private readonly keys = new Set<string>();
  private mouseBoost = false;
  private touchUp = false;
  private touchDown = false;
  private touchBoost = false;
  private readonly stick: StickState = { id: null, cx: 0, cy: 0, radius: 1, x: 0, y: 0 };
  private readonly cleanups: Array<() => void> = [];
  /** Fires on keydown of Escape / P (pause toggle). */
  onPauseKey: (() => void) | null = null;
  /** Fires on any user gesture (used to unlock audio). */
  onGesture: (() => void) | null = null;
  enabled = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly stickEl: HTMLElement,
    private readonly knobEl: HTMLElement,
    upBtn: HTMLElement,
    downBtn: HTMLElement,
    boostBtn: HTMLElement,
  ) {
    this.listen(window, 'keydown', (e) => {
      const ev = e as KeyboardEvent;
      this.onGesture?.();
      if (ev.code === 'Escape' || ev.code === 'KeyP') {
        if (!ev.repeat) this.onPauseKey?.();
        return;
      }
      if (GAME_KEYS.has(ev.code)) {
        this.keys.add(ev.code);
        if (this.enabled) ev.preventDefault();
      }
    });
    this.listen(window, 'keyup', (e) => this.keys.delete((e as KeyboardEvent).code));
    this.listen(window, 'blur', () => this.clear());

    this.listen(canvas, 'pointerdown', (e) => {
      const ev = e as PointerEvent;
      this.onGesture?.();
      if (ev.pointerType === 'mouse' && ev.button === 0) this.mouseBoost = true;
    });
    this.listen(window, 'pointerup', (e) => {
      if ((e as PointerEvent).pointerType === 'mouse') this.mouseBoost = false;
    });

    // Virtual joystick
    this.listen(stickEl, 'pointerdown', (e) => {
      const ev = e as PointerEvent;
      ev.preventDefault();
      this.onGesture?.();
      const rect = stickEl.getBoundingClientRect();
      this.stick.id = ev.pointerId;
      this.stick.cx = rect.left + rect.width / 2;
      this.stick.cy = rect.top + rect.height / 2;
      this.stick.radius = rect.width * 0.4;
      try {
        stickEl.setPointerCapture(ev.pointerId);
      } catch {
        /* synthetic events */
      }
      this.moveStick(ev.clientX, ev.clientY);
    });
    this.listen(stickEl, 'pointermove', (e) => {
      const ev = e as PointerEvent;
      if (ev.pointerId !== this.stick.id) return;
      ev.preventDefault();
      this.moveStick(ev.clientX, ev.clientY);
    });
    const release = (e: Event) => {
      if ((e as PointerEvent).pointerId !== this.stick.id) return;
      this.stick.id = null;
      this.stick.x = 0;
      this.stick.y = 0;
      this.updateKnob();
    };
    this.listen(stickEl, 'pointerup', release);
    this.listen(stickEl, 'pointercancel', release);

    this.bindHold(upBtn, (v) => (this.touchUp = v));
    this.bindHold(downBtn, (v) => (this.touchDown = v));
    this.bindHold(boostBtn, (v) => (this.touchBoost = v));
  }

  private bindHold(el: HTMLElement, set: (v: boolean) => void): void {
    this.listen(el, 'pointerdown', (e) => {
      e.preventDefault();
      this.onGesture?.();
      set(true);
      el.classList.add('is-pressed');
    });
    const off = (e: Event) => {
      e.preventDefault();
      set(false);
      el.classList.remove('is-pressed');
    };
    this.listen(el, 'pointerup', off);
    this.listen(el, 'pointercancel', off);
    this.listen(el, 'pointerleave', off);
  }

  private listen(target: EventTarget, type: string, fn: (e: Event) => void): void {
    target.addEventListener(type, fn, { passive: false });
    this.cleanups.push(() => target.removeEventListener(type, fn));
  }

  private moveStick(x: number, y: number): void {
    let dx = (x - this.stick.cx) / this.stick.radius;
    let dy = (y - this.stick.cy) / this.stick.radius;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    this.stick.x = dx;
    this.stick.y = dy;
    this.updateKnob();
  }

  private updateKnob(): void {
    const travel = this.stickEl.clientWidth * 0.32;
    this.knobEl.style.transform = `translate(calc(-50% + ${this.stick.x * travel}px), calc(-50% + ${this.stick.y * travel}px))`;
  }

  /** Simulate a held key (used by automated tests via __GAME__). */
  setKey(code: string, down: boolean): void {
    if (down) this.keys.add(code);
    else this.keys.delete(code);
  }

  clear(): void {
    this.keys.clear();
    this.mouseBoost = false;
    this.touchUp = this.touchDown = this.touchBoost = false;
  }

  read(out: FlightIntent): FlightIntent {
    const k = this.keys;
    let turn = 0;
    let thrust = 0;
    let lift = 0;
    if (k.has('KeyA') || k.has('ArrowLeft')) turn -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) turn += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) thrust += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) thrust -= 1;
    if (k.has('Space') || this.touchUp) lift += 1;
    if (k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyC') || this.touchDown) lift -= 1;

    // Joystick: gentle response curve so small thumbs give fine control.
    const sx = Math.sign(this.stick.x) * Math.pow(Math.abs(this.stick.x), 1.4);
    const sy = -Math.sign(this.stick.y) * Math.pow(Math.abs(this.stick.y), 1.2);
    out.turn = Math.max(-1, Math.min(1, turn + sx));
    out.thrust = Math.max(-1, Math.min(1, thrust + sy));
    out.lift = Math.max(-1, Math.min(1, lift));
    out.boost = k.has('KeyE') || this.mouseBoost || this.touchBoost;
    return out;
  }

  dispose(): void {
    for (const fn of this.cleanups) fn();
    this.cleanups.length = 0;
  }

  get canvasElement(): HTMLCanvasElement {
    return this.canvas;
  }
}
