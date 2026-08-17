import * as THREE from 'three';

/**
 * Owns the camera and converts player yaw/pitch into three.js rotation.
 *
 * The level format measures yaw clockwise from map-north (plans.md §14: 0 faces
 * -Z, 90° faces +X) while three.js rotates counter-clockwise about Y, hence the
 * negated yaw. YXZ order keeps pitch from rolling the view as yaw changes.
 */
export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(75, 1, 0.05, 200);

  constructor() {
    this.camera.rotation.order = 'YXZ';
  }

  follow(position: THREE.Vector3, yaw: number, pitch: number): void {
    this.camera.position.copy(position);
    this.camera.rotation.set(pitch, -yaw, 0);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  }
}
