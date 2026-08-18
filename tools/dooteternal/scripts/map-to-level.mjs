#!/usr/bin/env node
/**
 * Turns an ASCII map into a level JSON file.
 *
 * Usage:  npm run map -- maps/level_03.map
 *
 * The legend follows plans.md §14, extended so all three key colours have doors:
 * uppercase picks something up, lowercase is the door it opens.
 *
 * This only converts. Run `npm run checks` afterwards — it validates every map
 * in app/levels, including whether the exit can actually be reached.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const LEGEND = {
  '#': { kind: 'wall' },
  '.': { kind: 'floor' },
  ' ': { kind: 'floor' },
  S: { kind: 'start' },
  E: { kind: 'exit' },

  K: { kind: 'key', color: 'red' },
  B: { kind: 'key', color: 'blue' },
  G: { kind: 'key', color: 'green' },

  k: { kind: 'door', color: 'red' },
  D: { kind: 'door', color: 'red' }, // §14 spells the red door D
  b: { kind: 'door', color: 'blue' },
  g: { kind: 'door', color: 'green' },

  T: { kind: 'enemy', type: 'hell_tambourine' },
  M: { kind: 'enemy', type: 'infernal_maracas' },
  W: { kind: 'enemy', type: 'damned_whistle' },
  O: { kind: 'enemy', type: 'abyssal_organ' },
  I: { kind: 'enemy', type: 'screaming_siren' },
  F: { kind: 'enemy', type: 'cursed_fiddle' },
  C: { kind: 'enemy', type: 'choir_of_ruin' },
  Z: { kind: 'enemy', type: 'wretched_zither' },
};

const source = process.argv[2];
if (!source) {
  console.error('usage: npm run map -- maps/your_map.map');
  process.exit(1);
}

const lines = readFileSync(source, 'utf8').split('\n');
const meta = { yaw: 90 };
const grid = [];

for (const line of lines) {
  const header = line.match(/^#\s*(\w+)\s*:\s*(.+?)\s*$/);
  if (header) {
    meta[header[1]] = header[2];
    continue;
  }
  // A row is any line that isn't a header and isn't blank.
  if (line.trim().length > 0) grid.push(line.replace(/\s+$/, ''));
}

const id = meta.id ?? basename(source).replace(/\.map$/, '');
const name = meta.name ?? id;
const width = Math.max(...grid.map((row) => row.length));
const height = grid.length;

const fail = (message) => {
  console.error(`${source}: ${message}`);
  process.exit(1);
};

const level = {
  id,
  name,
  width,
  height,
  start: null,
  textures: { wall: meta.wall ?? 'wall_hell', floor: meta.floor ?? 'floor_music', ceiling: meta.ceiling ?? 'ceil_void' },
  walls: [],
  doors: [],
  keys: [],
  enemies: [],
  exit: null,
};

const doorCounts = {};

grid.forEach((row, y) => {
  const cells = [];

  for (let x = 0; x < width; x += 1) {
    // Short rows are padded with wall, so ragged text still makes a sealed map.
    const symbol = x < row.length ? row[x] : '#';
    const entry = LEGEND[symbol];
    if (!entry) fail(`unknown symbol "${symbol}" at ${x},${y}`);

    cells.push(entry.kind === 'wall' ? 1 : 0);

    switch (entry.kind) {
      case 'start':
        if (level.start) fail('more than one start (S)');
        level.start = { x, y, yawDegrees: Number(meta.yaw) };
        break;
      case 'exit':
        if (level.exit) fail('more than one exit (E)');
        level.exit = { x, y };
        break;
      case 'key':
        level.keys.push({ color: entry.color, x, y });
        break;
      case 'door': {
        doorCounts[entry.color] = (doorCounts[entry.color] ?? 0) + 1;
        level.doors.push({ id: `door_${entry.color}_${doorCounts[entry.color]}`, x, y, keyColor: entry.color });
        break;
      }
      case 'enemy':
        level.enemies.push({ type: entry.type, x, y });
        break;
      default:
        break;
    }
  }

  level.walls.push(cells);
});

if (!level.start) fail('no start (S)');
if (!level.exit) fail('no exit (E)');

const out = join('app/levels', `${id}.json`);
writeFileSync(out, `${JSON.stringify(level, null, 2)}\n`);

console.log(`${out}: ${width}x${height}, ${level.enemies.length} enemies, ${level.keys.length} keys, ${level.doors.length} doors`);
console.log('add a node to app/src/data/overworld.json, then run: npm run checks');
