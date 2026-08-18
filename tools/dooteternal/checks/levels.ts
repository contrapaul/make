/**
 * Every map in app/levels/, whether or not anything imports it.
 *
 * These are read off disk rather than imported so a map you add this morning is
 * held to the same standard as the two that shipped: right shape, everything
 * standing on floor, and — the one that actually bites — an exit you can reach
 * by collecting keys and opening the doors they unlock, in that order.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import enemiesJson from '../app/src/data/enemies.json';
import overworldJson from '../app/src/data/overworld.json';
import type { LevelData } from '../app/src/core/LevelLoader';
import type { EnemyType } from '../app/src/systems/EnemySystem';
import type { Overworld } from '../app/src/systems/Progress';
import { KEY_COLORS } from '../app/src/data/keys';
import { check, section } from './harness';

const LEVELS_DIR = join(process.cwd(), 'app/levels');
const enemies = enemiesJson as unknown as Record<string, EnemyType>;
const overworld = overworldJson as Overworld;

/** Every level file on disk, in filename order. */
export const LEVELS: LevelData[] = readdirSync(LEVELS_DIR)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => JSON.parse(readFileSync(join(LEVELS_DIR, name), 'utf8')) as LevelData);

section(`levels — ${LEVELS.length} map(s) in app/levels (plans.md §14)`);

check('at least one map exists and every id is unique', () => {
  assert.ok(LEVELS.length > 0, 'no levels found');

  const ids = LEVELS.map((level) => level.id);
  assert.equal(new Set(ids).size, ids.length, `duplicate level ids: ${ids.join(', ')}`);
});

for (const level of LEVELS) {
  check(`${level.id}: grid matches its declared size`, () => {
    assert.ok(level.name.length > 0, 'a level needs a display name');
    assert.equal(level.walls.length, level.height, 'row count');
    for (const [index, row] of level.walls.entries()) {
      assert.equal(row.length, level.width, `row ${index} width`);
    }
  });

  check(`${level.id}: start, exit, keys, doors and enemies all stand on floor`, () => {
    const open = (x: number, y: number) => level.walls[y]?.[x] === 0;

    assert.ok(open(level.start.x, level.start.y), 'start is inside a wall');
    assert.ok(open(level.exit.x, level.exit.y), 'exit is inside a wall');

    for (const key of level.keys) assert.ok(open(key.x, key.y), `${key.color} key is inside a wall`);
    for (const door of level.doors) assert.ok(open(door.x, door.y), `${door.id} overlaps a static wall`);
    for (const spawn of level.enemies) {
      assert.ok(open(spawn.x, spawn.y), `${spawn.type} at ${spawn.x},${spawn.y} is inside a wall`);
      assert.ok(enemies[spawn.type], `unknown enemy type "${spawn.type}"`);
    }
  });

  check(`${level.id}: keys and doors are paired, in known colours`, () => {
    const keyColors = new Set(level.keys.map((key) => key.color));
    const doorColors = new Set(level.doors.map((door) => door.keyColor));

    for (const color of [...keyColors, ...doorColors]) {
      assert.ok(KEY_COLORS[color], `"${color}" is not a key colour the game can draw`);
    }
    for (const color of doorColors) assert.ok(keyColors.has(color), `no ${color} key for a ${color} door`);
    for (const color of keyColors) assert.ok(doorColors.has(color), `${color} key opens nothing`);

    assert.equal(new Set(level.doors.map((door) => door.id)).size, level.doors.length, 'duplicate door ids');
    assert.equal(keyColors.size, level.keys.length, 'two keys of the same colour');
  });

  check(`${level.id}: the exit can actually be reached, keys first`, () => {
    const { region, collected, openedDoors } = walkthrough(level);

    for (const key of level.keys) assert.ok(collected.has(key.color), `${key.color} key is unreachable`);
    for (const door of level.doors) {
      assert.ok(openedDoors.has(cellKey(door.x, door.y)), `${door.id} can never be opened`);
    }
    assert.ok(region.has(cellKey(level.exit.x, level.exit.y)), 'exit is sealed off');
  });

  check(`${level.id}: no enemy is stranded outside the reachable map`, () => {
    const { region } = walkthrough(level);
    for (const spawn of level.enemies) {
      assert.ok(region.has(cellKey(spawn.x, spawn.y)), `${spawn.type} at ${spawn.x},${spawn.y} is walled off`);
    }
  });

  check(`${level.id}: the outer edge is solid`, () => {
    for (let x = 0; x < level.width; x += 1) {
      assert.notEqual(level.walls[0]![x], 0, `gap in the top edge at x=${x}`);
      assert.notEqual(level.walls[level.height - 1]![x], 0, `gap in the bottom edge at x=${x}`);
    }
    for (let y = 0; y < level.height; y += 1) {
      assert.notEqual(level.walls[y]![0], 0, `gap in the left edge at y=${y}`);
      assert.notEqual(level.walls[y]![level.width - 1], 0, `gap in the right edge at y=${y}`);
    }
  });
}

check('every map has a node on the descent, and every node a map', () => {
  const levelIds = new Set(LEVELS.map((level) => level.id));
  const nodeIds = new Set(overworld.nodes.map((node) => node.id));

  for (const id of levelIds) assert.ok(nodeIds.has(id), `${id} has no node in overworld.json, so it is unreachable`);
  for (const id of nodeIds) assert.ok(levelIds.has(id), `overworld.json lists ${id}, which has no level file`);
});

check('the descent is a single chain with no orphans', () => {
  const reachable = new Set([overworld.nodes[0]!.id]);
  let grew = true;

  while (grew) {
    grew = false;
    for (const [from, to] of overworld.edges) {
      if (reachable.has(from) && !reachable.has(to)) {
        reachable.add(to);
        grew = true;
      }
    }
  }

  for (const node of overworld.nodes) {
    assert.ok(reachable.has(node.id), `${node.id} can never be unlocked — no edge leads to it`);
  }
});

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

/**
 * Plays the level the way a player must: explore, pick up whatever keys are
 * reachable, open the doors those keys unlock, explore again. Returns what can
 * be reached once no further progress is possible — so a level that can't be
 * finished shows up as an unreachable exit rather than as a bug report later.
 */
export function walkthrough(level: LevelData): {
  region: Set<string>;
  collected: Set<string>;
  openedDoors: Set<string>;
} {
  const doorCells = new Map(level.doors.map((door) => [cellKey(door.x, door.y), door] as const));
  const openedDoors = new Set<string>();
  const collected = new Set<string>();
  let region = flood(level, doorCells, openedDoors);

  for (;;) {
    let progressed = false;

    for (const key of level.keys) {
      if (region.has(cellKey(key.x, key.y)) && !collected.has(key.color)) {
        collected.add(key.color);
        progressed = true;
      }
    }

    for (const [cell, door] of doorCells) {
      if (openedDoors.has(cell) || !collected.has(door.keyColor)) continue;
      // A door opens when the player can stand next to it.
      const adjacent = [
        cellKey(door.x + 1, door.y),
        cellKey(door.x - 1, door.y),
        cellKey(door.x, door.y + 1),
        cellKey(door.x, door.y - 1),
      ];
      if (!adjacent.some((neighbour) => region.has(neighbour))) continue;

      openedDoors.add(cell);
      progressed = true;
    }

    if (!progressed) return { region, collected, openedDoors };
    region = flood(level, doorCells, openedDoors);
  }
}

function flood(level: LevelData, doorCells: Map<string, unknown>, openedDoors: Set<string>): Set<string> {
  const seen = new Set<string>();
  const queue = [{ x: level.start.x, y: level.start.y }];

  while (queue.length > 0) {
    const { x, y } = queue.pop()!;
    const cell = cellKey(x, y);
    if (seen.has(cell)) continue;
    if (level.walls[y]?.[x] !== 0) continue;
    if (doorCells.has(cell) && !openedDoors.has(cell)) continue;

    seen.add(cell);
    queue.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 });
  }

  return seen;
}
