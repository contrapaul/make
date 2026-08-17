/**
 * Phase 1: movement, look and collision.
 *
 * These run in Node rather than the browser because pointer lock needs a focused
 * window, which automated verification never has — so WASD can't be driven
 * through the UI. Modules that touch the DOM (canvas textures) can't be reached
 * from here at all and are verified in the browser instead.
 */
import assert from 'node:assert/strict';
import levelJson from '../app/levels/level_01.json';
import { CollisionSystem } from '../app/src/core/CollisionSystem';
import type { LevelData } from '../app/src/core/LevelLoader';
import { PlayerController } from '../app/src/core/PlayerController';
import type { InputManager } from '../app/src/core/InputManager';
import { PLAYER } from '../app/src/data/constants';
import { check, section } from './harness';

const level = levelJson as LevelData;
const collision = new CollisionSystem(level);

/** Duck-typed stand-in for real input: keys held, look delta, lock state. */
function input(keys: string[], look = { yaw: 0, pitch: 0 }): InputManager {
  return {
    locked: true,
    isDown: (code: string) => keys.includes(code),
    consumeLook: () => look,
  } as unknown as InputManager;
}

section('phase 1 — movement and collision');

check('spawns at cell centre 1,1 facing 90 deg', () => {
  const player = new PlayerController(level.start, collision);
  assert.equal(player.position.x, 1.5);
  assert.equal(player.position.z, 1.5);
  assert.equal(player.position.y, PLAYER.eyeHeight);
  assert.equal(Math.round((player.yaw * 180) / Math.PI), 90);
  assert.deepEqual(player.cell, { x: 1, y: 1 });
});

check('W walks forward (+X at yaw 90)', () => {
  const player = new PlayerController(level.start, collision);
  player.update(0.25, input(['KeyW'])); // 4 m/s for 0.25 s = 1 m
  assert.ok(Math.abs(player.position.x - 2.5) < 1e-9, `x=${player.position.x}`);
  assert.ok(Math.abs(player.position.z - 1.5) < 1e-9, `z=${player.position.z}`);
});

check('S walks backward (-X at yaw 90)', () => {
  const player = new PlayerController(level.start, collision);
  player.position.set(4.5, PLAYER.eyeHeight, 1.5);
  player.update(0.25, input(['KeyS']));
  assert.ok(Math.abs(player.position.x - 3.5) < 1e-9, `x=${player.position.x}`);
});

check('D strafes right (+Z at yaw 90), A strafes left', () => {
  const right = new PlayerController(level.start, collision);
  right.update(0.25, input(['KeyD']));
  assert.ok(Math.abs(right.position.z - 2.5) < 1e-9, `z=${right.position.z}`);
  assert.ok(Math.abs(right.position.x - 1.5) < 1e-9, `x=${right.position.x}`);

  const left = new PlayerController(level.start, collision);
  left.position.set(3.5, PLAYER.eyeHeight, 3.5);
  left.update(0.25, input(['KeyA']));
  assert.ok(Math.abs(left.position.z - 2.5) < 1e-9, `z=${left.position.z}`);
});

check('diagonal is not faster than straight', () => {
  const player = new PlayerController(level.start, collision);
  const from = { x: player.position.x, z: player.position.z };
  player.update(0.25, input(['KeyW', 'KeyD']));
  const travelled = Math.hypot(player.position.x - from.x, player.position.z - from.z);
  assert.ok(Math.abs(travelled - 1) < 1e-9, `travelled ${travelled}`);
});

check('no input, no drift', () => {
  const player = new PlayerController(level.start, collision);
  player.update(0.25, input([]));
  assert.equal(player.position.x, 1.5);
  assert.equal(player.position.z, 1.5);
});

check('unlocked pointer freezes movement', () => {
  const player = new PlayerController(level.start, collision);
  const unlocked = {
    locked: false,
    isDown: () => true,
    consumeLook: () => ({ yaw: 0, pitch: 0 }),
  } as unknown as InputManager;

  player.update(0.25, unlocked);
  assert.equal(player.position.x, 1.5);
});

check('pitch clamps at +/-85 deg, yaw is free', () => {
  const player = new PlayerController(level.start, collision);
  player.update(0.016, input([], { yaw: 0.5, pitch: 99 }));
  assert.ok(Math.abs((player.pitch * 180) / Math.PI - 85) < 1e-9, `pitch=${(player.pitch * 180) / Math.PI}`);

  player.update(0.016, input([], { yaw: 0, pitch: -99 }));
  assert.ok(Math.abs((player.pitch * 180) / Math.PI + 85) < 1e-9);
});

check('out of bounds counts as solid', () => {
  assert.equal(collision.isSolid(-1, 1), true);
  assert.equal(collision.isSolid(level.width, 1), true);
  assert.equal(collision.isSolid(1, -1), true);
  assert.equal(collision.isSolid(1, level.height), true);
  assert.equal(collision.isSolid(1, 1), false);
  assert.equal(collision.isSolid(7, 1), true); // interior divider
});

check('walking into a wall stops at radius, does not pass through', () => {
  const player = new PlayerController(level.start, collision);
  for (let i = 0; i < 240; i += 1) player.update(0.1, input(['KeyW'])); // 96 m of walking
  const expected = 7 - PLAYER.radius; // divider wall at cell x=7
  assert.ok(Math.abs(player.position.x - expected) < 1e-6, `stopped at x=${player.position.x}, expected ${expected}`);
  assert.equal(player.cell.y, 1);
});

check('sliding along a wall keeps moving', () => {
  const player = new PlayerController(level.start, collision);
  player.position.set(6.6, PLAYER.eyeHeight, 1.5); // pressed against the x=7 divider
  for (let i = 0; i < 10; i += 1) player.update(0.1, input(['KeyW', 'KeyD']));
  assert.ok(player.position.x <= 7 - PLAYER.radius + 1e-6, `x=${player.position.x}`);
  assert.ok(player.position.z > 2.5, `expected to slide along z, got ${player.position.z}`);
});

check('never ends up inside a solid cell, over a random walk', () => {
  const player = new PlayerController(level.start, collision);
  const keysets = [['KeyW'], ['KeyA'], ['KeyS'], ['KeyD'], ['KeyW', 'KeyD'], ['KeyS', 'KeyA'], ['KeyW', 'KeyA']];
  let seed = 12345;
  const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

  for (let step = 0; step < 4000; step += 1) {
    const keys = keysets[Math.floor(random() * keysets.length)]!;
    player.update(0.1, input(keys, { yaw: (random() - 0.5) * 1.2, pitch: 0 }));

    const cell = player.cell;
    assert.equal(collision.isSolid(cell.x, cell.y), false, `entered solid cell ${cell.x},${cell.y} on step ${step}`);

    for (let cellY = cell.y - 1; cellY <= cell.y + 1; cellY += 1) {
      for (let cellX = cell.x - 1; cellX <= cell.x + 1; cellX += 1) {
        if (!collision.isSolid(cellX, cellY)) continue;
        const nearestX = Math.min(Math.max(player.position.x, cellX), cellX + 1);
        const nearestZ = Math.min(Math.max(player.position.z, cellY), cellY + 1);
        const gap = Math.hypot(player.position.x - nearestX, player.position.z - nearestZ);
        assert.ok(gap >= PLAYER.radius - 1e-6, `overlapped wall ${cellX},${cellY} by ${PLAYER.radius - gap}`);
      }
    }
  }
});

check('reaches the far side through the row-7 gap', () => {
  const player = new PlayerController(level.start, collision);
  player.position.set(5.5, PLAYER.eyeHeight, 6.5); // above the gap at cell 5,7
  player.yaw = Math.PI; // face +Z (map south)
  for (let i = 0; i < 40; i += 1) player.update(0.05, input(['KeyW']));
  assert.ok(player.position.z > 8, `expected to pass into the lower room, z=${player.position.z}`);
});
