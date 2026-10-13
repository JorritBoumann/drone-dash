import { CAMERA, FLIGHT, QUALITY } from '../game/config';

type GuiLike = { destroy(): void; hide(): void; show(): void };

/** lil-gui tuning panel, loaded only with `?debug` so it never ships in the main bundle path. */
export class DebugTools {
  private gui: GuiLike | null = null;
  private hidden = false;

  constructor(onChange: () => void) {
    if (!new URLSearchParams(window.location.search).has('debug')) return;
    void import('lil-gui').then(({ default: GUI }) => {
      const gui = new GUI({ title: 'Drone Dash tuning' });
      const f = gui.addFolder('Flight');
      f.add(FLIGHT, 'thrust', 5, 60, 0.5);
      f.add(FLIGHT, 'maxSpeed', 5, 40, 0.5);
      f.add(FLIGHT, 'boostSpeed', 10, 60, 0.5);
      f.add(FLIGHT, 'turnRate', 0.5, 5, 0.05);
      f.add(FLIGHT, 'lateralGrip', 0.2, 10, 0.1);
      f.add(FLIGHT, 'climbSpeed', 2, 25, 0.5);
      f.add(FLIGHT, 'descendSpeed', 2, 30, 0.5);
      f.add(FLIGHT, 'bankAngle', 0, 1.2, 0.01);
      f.add(FLIGHT, 'pitchAngle', 0, 1, 0.01);
      const c = gui.addFolder('Camera');
      c.add(CAMERA, 'distance', 3, 16, 0.1);
      c.add(CAMERA, 'height', 0.5, 8, 0.1);
      c.add(CAMERA, 'followLag', 1, 20, 0.1);
      c.add(CAMERA, 'yawLag', 1, 20, 0.1);
      c.add(CAMERA, 'boostFov', 50, 100, 1);
      const q = gui.addFolder('Render');
      q.add(QUALITY, 'exposure', 0.4, 2, 0.01).onChange(onChange);
      q.add(QUALITY, 'bloom').onChange(onChange);
      q.add(QUALITY, 'maxDpr', 0.5, 2, 0.25).onChange(onChange);
      this.gui = gui;
      if (this.hidden) gui.hide();
    });
  }

  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    if (!this.gui) return;
    if (hidden) this.gui.hide();
    else this.gui.show();
  }

  dispose(): void {
    this.gui?.destroy();
    this.gui = null;
  }
}
