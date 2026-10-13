export class Loop {
  private frameId = 0;
  private lastTime = 0;
  private running = false;
  private wallFrames = 0;
  private wallStart = performance.now();
  /** Real frames-per-second measured against wall-clock time (not the clamped sim delta). */
  fps = 0;

  sampleFps(): void {
    const now = performance.now();
    const span = now - this.wallStart;
    if (span >= 500) {
      this.fps = (this.wallFrames * 1000) / span;
      this.wallFrames = 0;
      this.wallStart = now;
    }
  }

  constructor(
    private readonly update: (deltaSeconds: number, elapsedSeconds: number) => void,
    private readonly render: () => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frameId);
  }

  private readonly tick = (time: number) => {
    if (!this.running) return;
    // rAF timestamps can precede the performance.now() taken in start(); never feed a negative delta.
    const deltaSeconds = Math.max(0, Math.min((time - this.lastTime) / 1000, 0.05));
    this.lastTime = Math.max(time, this.lastTime);
    this.wallFrames++;
    this.update(deltaSeconds, time / 1000);
    this.render();
    this.frameId = requestAnimationFrame(this.tick);
  };
}
