import * as THREE from 'three';
import { viewModelTexture } from '../core/PlaceholderAssets';

/**
 * First-person instrument held at the lower right (plans.md §11.2), with idle
 * sway and a recoil kick on each shot.
 *
 * It rides as a child of the camera, and draws with depth testing off so it can
 * never clip into a wall the player is standing against.
 */
const RECOIL_SECONDS = 0.16;

export class ViewModel {
  readonly sprite: THREE.Sprite;

  private readonly textures = new Map<string, THREE.CanvasTexture>();
  /** Far enough into the corner to keep the crosshair area clear (§11.2). */
  private readonly restPosition = new THREE.Vector3(0.54, -0.52, -1);
  private elapsed = 0;
  private recoilRemaining = 0;

  constructor(weaponId: string) {
    this.sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false }),
    );
    this.sprite.scale.setScalar(1.1);
    this.sprite.renderOrder = 999;
    this.sprite.position.copy(this.restPosition);

    this.setWeapon(weaponId);
  }

  setWeapon(weaponId: string): void {
    let texture = this.textures.get(weaponId);
    if (!texture) {
      texture = viewModelTexture(weaponId);
      this.textures.set(weaponId, texture);
    }

    this.sprite.material.map = texture;
    this.sprite.material.needsUpdate = true;
  }

  recoil(): void {
    this.recoilRemaining = RECOIL_SECONDS;
  }

  /** Dims the instrument when there isn't breath left to play it. */
  setStarved(starved: boolean): void {
    this.sprite.material.color.setHex(starved ? 0x6a6a6a : 0xffffff);
  }

  update(dt: number): void {
    this.elapsed += dt;

    const kick = this.recoilRemaining / RECOIL_SECONDS;
    this.sprite.position.set(
      this.restPosition.x + Math.sin(this.elapsed * 1.6) * 0.012,
      this.restPosition.y + Math.cos(this.elapsed * 2.1) * 0.009 - kick * 0.09,
      this.restPosition.z + kick * 0.1,
    );

    if (this.recoilRemaining > 0) this.recoilRemaining = Math.max(0, this.recoilRemaining - dt);
  }
}
