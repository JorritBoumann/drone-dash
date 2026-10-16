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

/**
 * Round 21: player camera control, consumed once per frame by the chase camera.
 *  - yaw / pitch: radians to orbit since the last read (+yaw looks left like the drone's own yaw, +pitch swings the
 *    camera higher to look down). Drag right / scroll right looks right; drag up looks up; scroll down looks down.
 *  - zoom: log change of the chase distance since the last read (+ = farther)
 *  - held: a drag (right / middle mouse button, or a finger on empty screen) is still down
 */
export type ViewIntent = {
  yaw: number;
  pitch: number;
  zoom: number;
  held: boolean;
};

/** Orbit sensitivity in radians per CSS pixel. */
const VIEW = {
  mouse: 0.0055,
  touch: 0.0075,
  trackpad: 0.0045,
  pitchScale: 0.8, // pitch moves a little slower than yaw
  wheelZoom: 0.0015, // log zoom per wheel pixel (one mouse notch is ~100 px: ~16%)
  pinchZoom: 0.008, // log zoom per pinch (ctrl+wheel) pixel
  lineHeight: 33, // px per wheel line (deltaMode 1, Firefox)
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
  // round 21: camera orbit
  private viewYaw = 0;
  private viewPitch = 0;
  private viewZoom = 0;
  private dragId: number | null = null; // pointer id of the orbit drag (mouse right/middle or a touch on empty screen)
  private dragX = 0;
  private dragY = 0;
  private dragTouch = false;
  private trackpadAt = -1e9; // last wheel event that looked like a trackpad (keeps one gesture on one path)
  private gestureScale = 1;
  /** Fires the first time the player orbits or zooms the view in a run (hides the first-run hint). */
  onView: (() => void) | null = null;
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

    // Mouse: left button boosts (held), right or middle button drag orbits the camera. Touch: one finger on empty
    // screen (not the stick or buttons, which take their own pointers) drags the camera.
    this.listen(canvas, 'pointerdown', (e) => {
      const ev = e as PointerEvent;
      this.onGesture?.();
      if (ev.pointerType === 'mouse') {
        if (ev.button === 0) this.mouseBoost = true;
        else if (ev.button === 1 || ev.button === 2) {
          if (ev.button === 1) ev.preventDefault(); // no autoscroll
          this.beginDrag(ev, false);
        }
      } else if (this.dragId === null) {
        this.beginDrag(ev, true);
      }
    });
    this.listen(window, 'pointermove', (e) => {
      const ev = e as PointerEvent;
      if (ev.pointerType === 'mouse') {
        // chorded presses arrive as pointermove: a left press during an orbit drag boosts, a left release stops it
        if (!(ev.buttons & 1)) this.mouseBoost = false;
        else if (this.dragId === ev.pointerId && !this.dragTouch) this.mouseBoost = true;
        if (this.dragId === ev.pointerId && !(ev.buttons & 6)) {
          this.endDrag();
          return;
        }
        if (this.dragId === null && ev.buttons & 6 && ev.target === canvas) this.beginDrag(ev, false);
      }
      if (ev.pointerId !== this.dragId) return;
      const dx = ev.clientX - this.dragX, dy = ev.clientY - this.dragY;
      this.dragX = ev.clientX;
      this.dragY = ev.clientY;
      if (dx === 0 && dy === 0) return;
      const k = this.dragTouch ? VIEW.touch : VIEW.mouse;
      this.addView(-dx * k, dy * k * VIEW.pitchScale, 0);
    });
    const dragEnd = (e: Event) => {
      const ev = e as PointerEvent;
      if (ev.pointerType === 'mouse' && !(ev.buttons & 1)) this.mouseBoost = false;
      if (ev.pointerId === this.dragId) this.endDrag();
    };
    this.listen(window, 'pointerup', dragEnd);
    this.listen(window, 'pointercancel', dragEnd);
    // right-drag must not open the browser menu over the game
    this.listen(canvas, 'contextmenu', (e) => e.preventDefault());
    this.listen(window, 'contextmenu', (e) => {
      if (this.dragId !== null) e.preventDefault();
    });

    // Wheel: trackpad two-finger scroll orbits, pinch (ctrl+wheel) zooms, a mouse wheel zooms.
    this.listen(canvas, 'wheel', (e) => this.onWheel(e as WheelEvent));
    // Safari pinch arrives as gesture events, not ctrl+wheel
    this.listen(canvas, 'gesturestart', (e) => {
      e.preventDefault();
      this.gestureScale = (e as unknown as { scale: number }).scale || 1;
    });
    this.listen(canvas, 'gesturechange', (e) => {
      e.preventDefault();
      const sc = (e as unknown as { scale: number }).scale || 1;
      if (this.enabled) this.addView(0, 0, -Math.log(sc / this.gestureScale));
      this.gestureScale = sc;
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

  private beginDrag(ev: PointerEvent, touch: boolean): void {
    this.dragId = ev.pointerId;
    this.dragTouch = touch;
    this.dragX = ev.clientX;
    this.dragY = ev.clientY;
    try {
      this.canvas.setPointerCapture(ev.pointerId);
    } catch {
      /* synthetic events */
    }
  }

  private endDrag(): void {
    if (this.dragId === null) return;
    try {
      if (this.canvas.hasPointerCapture(this.dragId)) this.canvas.releasePointerCapture(this.dragId);
    } catch {
      /* already released */
    }
    this.dragId = null;
  }

  private addView(yaw: number, pitch: number, zoom: number): void {
    if (!this.enabled) return;
    this.viewYaw += yaw;
    this.viewPitch += pitch;
    this.viewZoom += zoom;
    this.onView?.();
  }

  /**
   * Tell a trackpad from a mouse wheel. Pinch is ctrl+wheel on every Mac browser. A mouse wheel scrolls in lines
   * (deltaMode 1) or in whole notches (wheelDeltaY a multiple of 120); a trackpad scrolls in pixels, sideways too,
   * often in fractions, and Chrome / Safari report wheelDeltaY = -3 x deltaY for it. Once a gesture reads as a
   * trackpad, the rest of it (and its inertia tail) stays on that path.
   */
  private onWheel(ev: WheelEvent): void {
    ev.preventDefault(); // no page scroll or browser zoom over the game
    if (!this.enabled) return;
    const now = performance.now();
    const unit = ev.deltaMode === 1 ? VIEW.lineHeight : ev.deltaMode === 2 ? 400 : 1;
    const dx = ev.deltaX * unit, dy = ev.deltaY * unit;
    if (ev.ctrlKey) {
      this.addView(0, 0, dy * VIEW.pinchZoom);
      return;
    }
    const wdy = (ev as WheelEvent & { wheelDeltaY?: number }).wheelDeltaY ?? 0;
    let trackpad: boolean;
    if (ev.deltaMode !== 0) trackpad = false;
    else if (dx !== 0) trackpad = true;
    else if (now - this.trackpadAt < 250) trackpad = true;
    else if (wdy !== 0 && Math.abs(wdy + 3 * ev.deltaY) < 1) trackpad = true;
    else if (wdy !== 0 && wdy % 120 === 0) trackpad = false;
    else if (!Number.isInteger(dy)) trackpad = true;
    else trackpad = Math.abs(dy) < 40;
    if (trackpad) {
      this.trackpadAt = now;
      this.addView(-dx * VIEW.trackpad, dy * VIEW.trackpad * VIEW.pitchScale, 0);
    } else {
      this.addView(0, 0, dy * VIEW.wheelZoom);
    }
  }

  private forcedHeld = false;
  /** Test hook: orbit / zoom as a drag or wheel would; `held` keeps a virtual drag down until set false. */
  injectView(yaw: number, pitch = 0, zoom = 0, held?: boolean): void {
    if (held !== undefined) this.forcedHeld = held;
    this.addView(yaw, pitch, zoom);
  }

  /** Orbit and zoom input since the last call (consumed). */
  readView(out: ViewIntent): ViewIntent {
    out.yaw = this.viewYaw;
    out.pitch = this.viewPitch;
    out.zoom = this.viewZoom;
    this.viewYaw = this.viewPitch = this.viewZoom = 0;
    out.held = this.dragId !== null || this.forcedHeld;
    return out;
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
    this.endDrag();
    this.viewYaw = this.viewPitch = this.viewZoom = 0;
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
