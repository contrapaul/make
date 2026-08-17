import * as THREE from 'three';
import { INPUT, PLAYER } from '../data/constants';
import type { CollisionSystem } from './CollisionSystem';
import type { InputManager } from './InputManager';
import { cellCentre, type LevelData } from './LevelLoader';

/**
 * Free-strafing walker on the XZ plane. Constant velocity, no acceleration —
 * plans.md §18 lists easing as optional, so it stays out until it's asked for.
 *
 * Yaw is clockwise from map-north to match the level format: forward is
 * (sin yaw, 0, -cos yaw), so yaw 0 walks toward -Z and yaw 90° toward +X.
 */
export class PlayerController {
  readonly position = new THREE.Vector3();
  yaw = 0;
  pitch = 0;

  constructor(
    start: LevelData['start'],
    private readonly collision: CollisionSystem,
  ) {
    const spawn = cellCentre(start.x, start.y);
    this.position.set(spawn.x, PLAYER.eyeHeight, spawn.z);
    this.yaw = (start.yawDegrees * Math.PI) / 180;
  }

  /** Current map cell, for the HUD and for level scripting later. */
  get cell(): { x: number; y: number } {
    return { x: Math.floor(this.position.x), y: Math.floor(this.position.z) };
  }

  update(dt: number, input: InputManager): void {
    const look = input.consumeLook();
    this.yaw += look.yaw;
    this.pitch = clamp(this.pitch + look.pitch, -INPUT.pitchLimitRadians, INPUT.pitchLimitRadians);

    if (!input.locked) return;

    const forward = axis(input.isDown('KeyW'), input.isDown('KeyS'));
    const strafe = axis(input.isDown('KeyD'), input.isDown('KeyA'));
    if (forward === 0 && strafe === 0) return;

    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);

    // Diagonals normalise, so holding two keys isn't faster than one.
    const length = Math.hypot(forward, strafe);
    const step = (PLAYER.moveSpeed * dt) / length;
    const moveX = (forward * sinYaw + strafe * cosYaw) * step;
    const moveZ = (forward * -cosYaw + strafe * sinYaw) * step;

    const resolved = this.collision.resolve(this.position.x + moveX, this.position.z + moveZ, PLAYER.radius);
    this.position.x = resolved.x;
    this.position.z = resolved.z;
  }
}

function axis(positive: boolean, negative: boolean): number {
  return (positive ? 1 : 0) - (negative ? 1 : 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
