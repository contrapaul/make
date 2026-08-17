import * as THREE from 'three';
import { LEVEL_FLOW, WORLD } from '../data/constants';
import { doorTexture, keyTexture, portalTexture } from '../core/PlaceholderAssets';
import { cellCentre, type LevelData } from '../core/LevelLoader';
import type { CollisionSystem } from '../core/CollisionSystem';
import type { AudioSink } from './AudioManager';

/**
 * Coloured music-note keys, the doors they open, and the exit portal
 * (plans.md §14). A door swings open on its own once the player carrying the
 * matching key walks up to it — there is nothing to press.
 */
const DOOR_SLIDE_SECONDS = 0.45;

interface Door {
  id: string;
  cellX: number;
  cellY: number;
  keyColor: string;
  mesh: THREE.Mesh;
  /** 0 closed, 1 fully risen into the ceiling. */
  openProgress: number;
  opened: boolean;
}

interface KeyPickup {
  color: string;
  position: THREE.Vector3;
  sprite: THREE.Sprite;
  taken: boolean;
}

export class DoorKeySystem {
  readonly group = new THREE.Group();

  private readonly doors: Door[] = [];
  private readonly keys: KeyPickup[] = [];
  private readonly held = new Set<string>();
  private readonly exit: { position: THREE.Vector3; sprite: THREE.Sprite };
  private exitReached = false;

  /** Fired when a key or door changes hands, so §16 can save on the event. */
  onProgress?: () => void;

  constructor(
    level: LevelData,
    private readonly collision: CollisionSystem,
    private readonly audio: AudioSink,
    /** Called once, when the player steps into the portal. */
    private readonly onExit: () => void,
    /** Restored from a save: keys already taken and doors already open (§16). */
    restored: { keysCollected?: string[]; doorsOpened?: string[] } = {},
  ) {
    for (const spec of level.keys) {
      const centre = cellCentre(spec.x, spec.y);
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: keyTexture(spec.color), transparent: true, depthWrite: false }),
      );
      sprite.scale.setScalar(0.55);
      sprite.position.set(centre.x, 0.85, centre.z);

      const taken = restored.keysCollected?.includes(spec.color) ?? false;
      if (taken) {
        sprite.visible = false;
        this.held.add(spec.color);
      }

      this.group.add(sprite);
      this.keys.push({ color: spec.color, position: sprite.position.clone(), sprite, taken });
    }

    for (const spec of level.doors) {
      const centre = cellCentre(spec.x, spec.y);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, WORLD.wallHeightMeters, 1),
        new THREE.MeshLambertMaterial({ map: doorTexture(spec.keyColor) }),
      );
      mesh.position.set(centre.x, WORLD.wallHeightMeters / 2, centre.z);

      const opened = restored.doorsOpened?.includes(spec.id) ?? false;
      if (opened) {
        // Already open in the save: leave the cell clear and the slab hidden.
        collision.openDoor(spec.x, spec.y);
        mesh.visible = false;
      }

      this.group.add(mesh);
      this.doors.push({
        id: spec.id,
        cellX: spec.x,
        cellY: spec.y,
        keyColor: spec.keyColor,
        mesh,
        openProgress: opened ? 1 : 0,
        opened,
      });
    }

    const exitCentre = cellCentre(level.exit.x, level.exit.y);
    const exitSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: portalTexture(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    exitSprite.scale.setScalar(1.8);
    exitSprite.position.set(exitCentre.x, 1.1, exitCentre.z);
    this.group.add(exitSprite);

    this.exit = { position: exitSprite.position.clone(), sprite: exitSprite };
  }

  get heldKeys(): string[] {
    return [...this.held];
  }

  get openedDoorIds(): string[] {
    return this.doors.filter((door) => door.opened).map((door) => door.id);
  }

  get remainingKeys(): number {
    return this.keys.filter((key) => !key.taken).length;
  }

  update(dt: number, playerPosition: THREE.Vector3): void {
    this.spinPickups(dt);
    this.collectKeys(playerPosition);
    this.openDoors(dt, playerPosition);
    this.checkExit(playerPosition);
  }

  private spinPickups(dt: number): void {
    for (const key of this.keys) {
      if (!key.taken) key.sprite.material.rotation += dt * 1.6;
    }

    this.exit.sprite.material.rotation -= dt * 0.7;
  }

  private collectKeys(playerPosition: THREE.Vector3): void {
    for (const key of this.keys) {
      if (key.taken) continue;
      if (horizontalDistance(key.position, playerPosition) > LEVEL_FLOW.keyPickupRangeMeters) continue;

      key.taken = true;
      key.sprite.visible = false;
      this.held.add(key.color);
      this.audio.playOne(`audio/sfx/key_pickup_${key.color}.ogg`);
      this.onProgress?.();
    }
  }

  private openDoors(dt: number, playerPosition: THREE.Vector3): void {
    for (const door of this.doors) {
      if (door.openProgress >= 1) continue;

      if (!door.opened) {
        const centre = cellCentre(door.cellX, door.cellY);
        const distance = Math.hypot(centre.x - playerPosition.x, centre.z - playerPosition.z);
        if (distance > LEVEL_FLOW.doorOpenRangeMeters || !this.held.has(door.keyColor)) continue;

        // Free the cell the moment it starts rising, so nobody clips the slab.
        door.opened = true;
        this.collision.openDoor(door.cellX, door.cellY);
        this.audio.playOne('audio/sfx/door_open.ogg');
        this.onProgress?.();
      }

      door.openProgress = Math.min(1, door.openProgress + dt / DOOR_SLIDE_SECONDS);
      door.mesh.position.y = WORLD.wallHeightMeters / 2 + door.openProgress * WORLD.wallHeightMeters;
      if (door.openProgress >= 1) door.mesh.visible = false;
    }
  }

  private checkExit(playerPosition: THREE.Vector3): void {
    if (this.exitReached) return;
    if (horizontalDistance(this.exit.position, playerPosition) > LEVEL_FLOW.exitRangeMeters) return;

    this.exitReached = true;
    this.audio.playOne('audio/sfx/exit_portal.ogg');
    this.onExit();
  }
}

function horizontalDistance(a: THREE.Vector3, b: THREE.Vector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
