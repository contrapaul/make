import { INPUT } from '../data/constants';
import type { Settings } from '../systems/SaveSystem';

export interface LookDelta {
  /** Radians to add to yaw. Positive turns right. */
  yaw: number;
  /** Radians to add to pitch. Positive looks up. */
  pitch: number;
}

/**
 * Keyboard state plus pointer-lock mouse look. Look deltas accumulate between
 * frames and are drained by whoever consumes them, so a frame that takes 30 ms
 * still applies every mousemove that arrived during it.
 */
export class InputManager {
  /** Notified on pointer-lock gain/loss — Phase 5 hangs the pause menu here. */
  onLockChange?: (locked: boolean) => void;

  private readonly pressed = new Set<string>();
  private pendingYaw = 0;
  private pendingPitch = 0;
  private fireHeld = false;
  private firePressedEdge = false;
  private wheelSteps = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    /** Read live, so the sensitivity slider takes effect as it moves (§17). */
    private readonly settings: Settings,
  ) {
    window.addEventListener('keydown', (event) => this.pressed.add(event.code));
    window.addEventListener('keyup', (event) => this.pressed.delete(event.code));

    // Losing focus mid-stride would otherwise leave the key stuck down.
    window.addEventListener('blur', () => {
      this.pressed.clear();
      this.fireHeld = false;
    });

    canvas.addEventListener('click', () => this.requestLock());
    canvas.addEventListener('mousemove', (event) => this.accumulateLook(event));

    canvas.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return;
      this.fireHeld = true;
      this.firePressedEdge = true;
    });

    window.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.fireHeld = false;
    });

    canvas.addEventListener('wheel', (event) => {
      this.wheelSteps += Math.sign(event.deltaY);
    }, { passive: true });

    document.addEventListener('pointerlockchange', () => {
      this.pendingYaw = 0;
      this.pendingPitch = 0;
      this.pressed.clear();
      this.fireHeld = false;
      this.firePressedEdge = false;
      this.onLockChange?.(this.locked);
    });
  }

  get locked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  isDown(code: string): boolean {
    return this.pressed.has(code);
  }

  /** Fire button held — what the breath system means by "firing". */
  get firing(): boolean {
    return this.fireHeld;
  }

  /** True once per click, so a non-continuous weapon fires one shot per press. */
  consumeFirePressed(): boolean {
    const pressed = this.firePressedEdge;
    this.firePressedEdge = false;
    return pressed;
  }

  /** Net mouse-wheel steps since the last call, for cycling weapons. */
  consumeWeaponCycle(): number {
    const steps = this.wheelSteps;
    this.wheelSteps = 0;
    return steps;
  }

  /** Returns the look movement since the last call and resets the accumulator. */
  consumeLook(): LookDelta {
    const delta = { yaw: this.pendingYaw, pitch: this.pendingPitch };
    this.pendingYaw = 0;
    this.pendingPitch = 0;
    return delta;
  }

  private requestLock(): void {
    // Browsers reject a re-lock for a moment after ESC; the hint just stays up.
    void Promise.resolve(this.canvas.requestPointerLock()).catch(() => {});
  }

  private accumulateLook(event: MouseEvent): void {
    if (!this.locked) return;

    const scale = INPUT.lookScaleRadiansPerPixel * this.settings.mouseSensitivity;
    // Mouse right turns right, mouse up looks up (plans.md §18, with the yaw
    // sign matching the level format's clockwise-from-north convention).
    this.pendingYaw += event.movementX * scale;
    this.pendingPitch -= event.movementY * scale;
  }
}
