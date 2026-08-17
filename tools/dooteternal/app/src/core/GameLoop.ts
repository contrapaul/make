/**
 * Frame loop with a clamped delta. The clamp matters for collision: a tab that
 * regains focus after a minute would otherwise report a 60-second step and walk
 * the player straight through a wall.
 */
const MAX_DELTA_SECONDS = 0.1;
const FPS_WINDOW_MS = 500;

export class GameLoop {
  fps = 0;

  private lastFrameMs = 0;
  private windowStartMs = 0;
  private framesThisWindow = 0;

  constructor(private readonly tick: (dt: number) => void) {}

  start(): void {
    this.lastFrameMs = performance.now();
    this.windowStartMs = this.lastFrameMs;

    const frame = (now: number): void => {
      requestAnimationFrame(frame);

      const dt = Math.min((now - this.lastFrameMs) / 1000, MAX_DELTA_SECONDS);
      this.lastFrameMs = now;

      this.framesThisWindow += 1;
      if (now - this.windowStartMs >= FPS_WINDOW_MS) {
        this.fps = Math.round((this.framesThisWindow * 1000) / (now - this.windowStartMs));
        this.framesThisWindow = 0;
        this.windowStartMs = now;
      }

      this.tick(dt);
    };

    requestAnimationFrame(frame);
  }
}
