import * as THREE from 'three';
import { WORLD } from '../data/constants';
import { placeholderTexture } from './PlaceholderAssets';

/**
 * Level format from plans.md §14. Grid cells are 1 m; map y becomes world z, so
 * cell (x, y) has its centre at world (x + 0.5, ·, y + 0.5).
 *
 * doors/keys/enemies/exit are part of the format but unused until Phases 2–4.
 */
export interface LevelData {
  id: string;
  name: string;
  width: number;
  height: number;
  start: { x: number; y: number; yawDegrees: number };
  textures: { wall: string; floor: string; ceiling: string };
  /** Row-major; 0 is open floor, non-zero is a solid wall. */
  walls: number[][];
  doors: { id: string; x: number; y: number; keyColor: string }[];
  keys: { color: string; x: number; y: number }[];
  enemies: { type: string; x: number; y: number }[];
  exit: { x: number; y: number };
}

/** World-space centre of a map cell. */
export function cellCentre(cellX: number, cellY: number): { x: number; z: number } {
  return { x: cellX + 0.5, z: cellY + 0.5 };
}

/** Builds the whole level as one group, so swapping levels is add/remove of one object. */
export function buildLevel(level: LevelData): THREE.Group {
  const group = new THREE.Group();
  group.name = level.id;

  const { width, height } = level;
  const wallHeight = WORLD.wallHeightMeters;

  group.add(buildFloor(level, width, height));
  group.add(buildCeiling(level, width, height, wallHeight));
  group.add(buildWalls(level, wallHeight));

  // Flat-ish lighting: enough directional bias to read corners, bright ambient
  // so nothing goes fully black the way a real light rig would.
  group.add(new THREE.AmbientLight(0xffffff, 1.5));

  const sun = new THREE.DirectionalLight(0xffe0a8, 1.2);
  sun.position.set(0.4, 1, 0.25);
  group.add(sun);

  return group;
}

function buildFloor(level: LevelData, width: number, height: number): THREE.Mesh {
  const texture = tiled(placeholderTexture(level.textures.floor), width, height);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshLambertMaterial({ map: texture }),
  );

  floor.rotation.x = -Math.PI / 2;
  floor.position.set(width / 2, 0, height / 2);
  return floor;
}

function buildCeiling(level: LevelData, width: number, height: number, wallHeight: number): THREE.Mesh {
  const texture = tiled(placeholderTexture(level.textures.ceiling), width, height);
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshLambertMaterial({ map: texture }),
  );

  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(width / 2, wallHeight, height / 2);
  return ceiling;
}

/** One instanced box per solid cell — a single draw call for the whole level. */
function buildWalls(level: LevelData, wallHeight: number): THREE.InstancedMesh {
  const solidCells: { x: number; y: number }[] = [];
  level.walls.forEach((row, cellY) => {
    row.forEach((cell, cellX) => {
      if (cell !== 0) solidCells.push({ x: cellX, y: cellY });
    });
  });

  // Vertical repeat so a 3 m wall shows three tiles rather than one stretched one.
  const texture = tiled(placeholderTexture(level.textures.wall), 1, wallHeight);
  const walls = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, wallHeight, 1),
    new THREE.MeshLambertMaterial({ map: texture }),
    solidCells.length,
  );

  const transform = new THREE.Matrix4();
  solidCells.forEach((cell, index) => {
    const centre = cellCentre(cell.x, cell.y);
    transform.makeTranslation(centre.x, wallHeight / 2, centre.z);
    walls.setMatrixAt(index, transform);
  });

  walls.instanceMatrix.needsUpdate = true;
  return walls;
}

function tiled(texture: THREE.Texture, repeatX: number, repeatY: number): THREE.Texture {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  return texture;
}
