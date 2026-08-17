/**
 * Optional image assets.
 *
 * The loader is deliberately silent about missing files, which means a mistyped
 * path would look exactly like art you haven't drawn yet. These checks close that
 * gap: the registry, IMAGES.md and the procedural fallbacks all have to agree.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import enemiesJson from '../app/src/data/enemies.json';
import { ENEMY_SHEET, ENEMY_SHEET_ROWS, IMAGE_ASSETS } from '../app/src/core/ImageManifest';
import type { EnemyType } from '../app/src/systems/EnemySystem';
import { WEAPON_ORDER } from '../app/src/systems/WeaponSystem';
import { check, section } from './harness';

const APP = join(process.cwd(), 'app');
const enemies = enemiesJson as unknown as Record<string, EnemyType>;

/** Paths the art checklist asks for. */
function documentedPaths(): Set<string> {
  const doc = readFileSync(join(APP, 'assets/IMAGES.md'), 'utf8');
  const paths = new Set<string>();

  for (const [, match] of doc.matchAll(/`((?:textures|sprites)\/[^`]+\.png)`/g)) paths.add(match!);

  return paths;
}

section('images — registry and checklist');

check('every registered image is documented, and vice versa', () => {
  const documented = documentedPaths();
  const registered = new Set(IMAGE_ASSETS.map((entry) => entry.path));

  for (const path of registered) assert.ok(documented.has(path), `${path} is loaded but not in IMAGES.md`);
  for (const path of documented) assert.ok(registered.has(path), `IMAGES.md asks for ${path}, which nothing loads`);
});

check('paths are unique and land under textures/ or sprites/', () => {
  const seen = new Set<string>();

  for (const entry of IMAGE_ASSETS) {
    assert.ok(!seen.has(entry.path), `duplicate entry for ${entry.path}`);
    seen.add(entry.path);

    assert.match(entry.path, /^(textures|sprites)\/[a-z0-9_/]+\.png$/, `odd path: ${entry.path}`);
    assert.ok(entry.replaces.length > 0, `${entry.path} does not say what it replaces`);
    assert.ok(entry.size.length > 0, `${entry.path} has no recommended size`);
  }
});

check('every enemy in the data has a sheet, and every sheet an enemy', () => {
  const sheets = IMAGE_ASSETS.filter((entry) => entry.path.startsWith('sprites/enemies/'));
  assert.equal(sheets.length, Object.keys(enemies).length);

  for (const id of Object.keys(enemies)) {
    assert.ok(
      sheets.some((entry) => entry.path === `sprites/enemies/${id}_sheet.png`),
      `no sheet registered for ${id}`,
    );
  }
});

check('every weapon has a view model', () => {
  for (const id of WEAPON_ORDER) {
    assert.ok(
      IMAGE_ASSETS.some((entry) => entry.path === `sprites/weapons/${id}_viewmodel.png`),
      `no view model registered for ${id}`,
    );
  }
});

check('the level texture ids all have a file to override them', () => {
  // These are the ids levels reference in their `textures` block.
  for (const file of [
    'textures/walls/hell_wall_01.png',
    'textures/floors/music_floor_01.png',
    'textures/ceilings/void_ceiling_01.png',
  ]) {
    assert.ok(IMAGE_ASSETS.some((entry) => entry.path === file), `${file} is not registered`);
  }
});

check('surfaces that repeat are marked as tiling, and sprites are not', () => {
  for (const entry of IMAGE_ASSETS) {
    const isSurface = /^textures\/(walls|floors|ceilings)\//.test(entry.path);
    assert.equal(entry.tiling ?? false, isSurface, `${entry.path} tiling flag looks wrong`);
  }
});

section('images — sprite sheet layout (plans.md §11.1)');

check('the sheet grid matches the documented row order', () => {
  assert.equal(ENEMY_SHEET.rows, ENEMY_SHEET_ROWS.length);
  assert.deepEqual([...ENEMY_SHEET_ROWS], ['idle', 'walk', 'attack', 'hit', 'death', 'corpse']);
  // The widest state in §11.1 is death at 8 frames.
  assert.ok(ENEMY_SHEET.columns >= 8, `${ENEMY_SHEET.columns} columns cannot hold an 8-frame death`);
});

check('every enemy sheet declares the shared grid', () => {
  for (const entry of IMAGE_ASSETS.filter((asset) => asset.path.startsWith('sprites/enemies/'))) {
    assert.deepEqual(entry.sheet, { columns: ENEMY_SHEET.columns, rows: ENEMY_SHEET.rows }, entry.path);
  }
});

check('only enemy sheets are treated as sheets', () => {
  for (const entry of IMAGE_ASSETS) {
    const isEnemySheet = entry.path.startsWith('sprites/enemies/');
    assert.equal(Boolean(entry.sheet), isEnemySheet, `${entry.path} sheet flag looks wrong`);
  }
});

check('the documented frame size divides into a power-of-two sheet', () => {
  // 8 x 6 frames of 256 is 2048 x 1536 — the width is what GPUs care about.
  const width = ENEMY_SHEET.columns * 256;
  assert.equal(width & (width - 1), 0, `sheet width ${width} is not a power of two`);
});
