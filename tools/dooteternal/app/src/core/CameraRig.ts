import * as THREE from 'three';

/**
 * Owns the camera and converts player yaw/pitch into three.js rotation.
 *
 * The level format measures yaw clockwise from map-north (plans.md §14: 0 faces
 * -Z, 90° faces +X) while three.js rotates counter-clockwise about Y, hence the
 * negated yaw. YXZ order keeps pitch from rolling the view as yaw changes.
 */
const SHAKE_DECAY_PER_SECOND = 0.5;

export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(75, 1, 0.05, 200);

  private shakeIntensity = 0;

  constructor() {
    this.camera.rotation.order = 'YXZ';
  }

  /** Kick from a heavy kill (plans.md §10). Takes the strongest recent hit. */
  shake(intensity: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  follow(position: THREE.Vector3, yaw: number, pitch: number, dt: number): void {
    this.camera.position.copy(position);

    if (this.shakeIntensity > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.z += (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity = Math.max(0, this.shakeIntensity - SHAKE_DECAY_PER_SECOND * dt);
    }

    this.camera.rotation.set(pitch, -yaw, 0);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  }
}
