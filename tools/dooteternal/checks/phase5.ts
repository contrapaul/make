/**
 * Phase 5: saving, settings and the descent map.
 *
 * SaveSystem takes its storage as an interface, so the schema, its validation
 * and the progression rules are all exercised here without a browser. The menus
 * themselves are DOM and are verified in play.
 */
import assert from 'node:assert/strict';
import level01 from '../app/levels/level_01.json';
import level02 from '../app/levels/level_02.json';
import type { LevelData } from '../app/src/core/LevelLoader';
import {
  clampSettings,
  defaultSave,
  memoryStorage,
  SAVE_KEY,
  SAVE_VERSION,
  SaveSystem,
  SENSITIVITY_RANGE,
  type LevelState,
  type SaveStorage,
} from '../app/src/systems/SaveSystem';
import {
  completeLevel,
  initialProgress,
  isUnlocked,
  nextLevelId,
  nodeState,
  OVERWORLD,
} from '../app/src/systems/Progress';
import { check, section } from './harness';

const levels: LevelData[] = [level01 as LevelData, level02 as LevelData];

function sampleLevelState(levelId = 'level_01'): LevelState {
  return {
    levelId,
    breath: 32,
    keysCollected: ['red'],
    doorsOpened: ['door_red_1'],
    killedEnemyIds: ['enemy_hell_tambourine_0', 'enemy_infernal_maracas_3'],
    playerPosition: { x: 4.5, y: 2.5, yawDegrees: 90 },
  };
}

section('phase 5 — settings (plans.md §17)');

check('defaults match the spec', () => {
  const { settings } = defaultSave();
  assert.equal(settings.soundtrackEnabled, true);
  assert.equal(settings.sfxVolume, 0.8);
  assert.equal(settings.mouseSensitivity, 1.0);
});

check('sensitivity is clamped to the 0.25x–3.0x range', () => {
  assert.equal(SENSITIVITY_RANGE.min, 0.25);
  assert.equal(SENSITIVITY_RANGE.max, 3.0);
  assert.equal(clampSettings({ mouseSensitivity: 99 }).mouseSensitivity, 3.0);
  assert.equal(clampSettings({ mouseSensitivity: 0 }).mouseSensitivity, 0.25);
  assert.equal(clampSettings({ mouseSensitivity: 1.75 }).mouseSensitivity, 1.75);
});

check('sfx volume is clamped to 0–1', () => {
  assert.equal(clampSettings({ sfxVolume: 4 }).sfxVolume, 1);
  assert.equal(clampSettings({ sfxVolume: -1 }).sfxVolume, 0);
  assert.equal(clampSettings({ sfxVolume: 0.35 }).sfxVolume, 0.35);
});

check('nonsense settings fall back to defaults', () => {
  const settings = clampSettings({ sfxVolume: Number.NaN, mouseSensitivity: undefined });
  assert.equal(settings.sfxVolume, 0.8);
  assert.equal(settings.mouseSensitivity, 1.0);
  assert.equal(clampSettings(undefined).soundtrackEnabled, true);
});

section('phase 5 — save round trip (plans.md §16)');

check('settings and progress survive a reload', () => {
  const storage = memoryStorage();

  const first = new SaveSystem(storage);
  first.settings.sfxVolume = 0.25;
  first.settings.mouseSensitivity = 2.5;
  first.settings.soundtrackEnabled = false;
  first.save();
  first.setProgress(completeLevel(first.progress, 'level_01'));

  // A fresh instance over the same storage is what a browser refresh looks like.
  const second = new SaveSystem(storage);
  assert.equal(second.settings.sfxVolume, 0.25);
  assert.equal(second.settings.mouseSensitivity, 2.5);
  assert.equal(second.settings.soundtrackEnabled, false);
  assert.deepEqual(second.progress.completedLevels, ['level_01']);
  assert.deepEqual(second.progress.unlockedLevels, ['level_01', 'level_02']);
  assert.equal(second.progress.currentLevelId, 'level_02');
});

check('saving keeps the settings object identity', () => {
  // The pause menu, InputManager and AudioManager all hold this object so that
  // slider changes apply live. Replacing it on save silently detaches them.
  const saved = new SaveSystem(memoryStorage());
  const held = saved.settings;

  saved.settings.sfxVolume = 0.4;
  saved.save();

  assert.equal(saved.settings, held, 'save() must not swap the settings object');
  assert.equal(held.sfxVolume, 0.4);

  held.mouseSensitivity = 99;
  saved.save();
  assert.equal(held.mouseSensitivity, 3.0, 'clamping should still reach the shared object');
});

check('mid-level state survives a reload', () => {
  const storage = memoryStorage();
  const first = new SaveSystem(storage);
  first.setLevelState(sampleLevelState());

  const second = new SaveSystem(storage);
  assert.deepEqual(second.data.levelState, sampleLevelState());
});

check('clearing level state persists as cleared', () => {
  const storage = memoryStorage();
  const first = new SaveSystem(storage);
  first.setLevelState(sampleLevelState());
  first.setLevelState(null);

  assert.equal(new SaveSystem(storage).data.levelState, null);
});

check('the save key and version are the ones the spec names', () => {
  const storage = memoryStorage();
  new SaveSystem(storage).save();

  const raw = storage.getItem(SAVE_KEY);
  assert.ok(raw, `nothing written under ${SAVE_KEY}`);
  assert.equal(JSON.parse(raw).version, SAVE_VERSION);
  assert.equal(SAVE_KEY, 'musicHell_save_v1');
});

section('phase 5 — corrupt and hostile saves');

check('unparseable data starts a fresh game rather than throwing', () => {
  const storage = memoryStorage();
  storage.setItem(SAVE_KEY, '{not json');

  const loaded = new SaveSystem(storage);
  assert.deepEqual(loaded.progress, initialProgress());
  assert.equal(loaded.data.levelState, null);
});

check('a save from another version is discarded', () => {
  const storage = memoryStorage();
  storage.setItem(SAVE_KEY, JSON.stringify({ version: 99, progress: { currentLevelId: 'level_09' } }));

  assert.deepEqual(new SaveSystem(storage).progress, initialProgress());
});

check('a half-written level state is ignored, keeping the rest', () => {
  const storage = memoryStorage();
  storage.setItem(
    SAVE_KEY,
    JSON.stringify({
      version: SAVE_VERSION,
      settings: { sfxVolume: 0.5 },
      progress: { currentLevelId: 'level_02', completedLevels: ['level_01'], unlockedLevels: ['level_01', 'level_02'] },
      levelState: { levelId: 'level_01', breath: 'lots' },
    }),
  );

  const loaded = new SaveSystem(storage);
  assert.equal(loaded.data.levelState, null, 'malformed level state should be dropped');
  assert.equal(loaded.settings.sfxVolume, 0.5, 'valid settings should survive alongside it');
  assert.deepEqual(loaded.progress.completedLevels, ['level_01']);
});

check('progress with no unlocked levels is rejected as unplayable', () => {
  const storage = memoryStorage();
  storage.setItem(
    SAVE_KEY,
    JSON.stringify({
      version: SAVE_VERSION,
      progress: { currentLevelId: 'level_01', completedLevels: [], unlockedLevels: [] },
    }),
  );

  assert.deepEqual(new SaveSystem(storage).progress, initialProgress());
});

check('a storage that refuses writes does not take the game down', () => {
  const hostile: SaveStorage = {
    getItem: () => null,
    setItem: () => {
      throw new Error('quota exceeded');
    },
  };

  const loaded = new SaveSystem(hostile);
  loaded.setLevelState(sampleLevelState());
  loaded.save();
  assert.equal(loaded.settings.sfxVolume, 0.8, 'the session keeps working in memory');
});

section('phase 5 — descent map (plans.md §15)');

check('the map has a node per level and edges between them', () => {
  assert.equal(OVERWORLD.nodes.length, levels.length);

  const nodeIds = OVERWORLD.nodes.map((node) => node.id);
  assert.deepEqual(nodeIds, levels.map((level) => level.id));

  for (const [from, to] of OVERWORLD.edges) {
    assert.ok(nodeIds.includes(from), `edge from unknown node ${from}`);
    assert.ok(nodeIds.includes(to), `edge to unknown node ${to}`);
  }
});

check('node names match the levels they load', () => {
  for (const node of OVERWORLD.nodes) {
    const level = levels.find((entry) => entry.id === node.id)!;
    assert.equal(node.name, level.name, `${node.id} name`);
  }
});

check('nodes descend: each one sits below the last', () => {
  for (let i = 1; i < OVERWORLD.nodes.length; i += 1) {
    assert.ok(OVERWORLD.nodes[i]!.y < OVERWORLD.nodes[i - 1]!.y, 'later nodes should be deeper');
  }
});

check('only the first level is open on a fresh save', () => {
  const progress = initialProgress();
  assert.deepEqual(progress.unlockedLevels, ['level_01']);
  assert.equal(nodeState(progress, 'level_01'), 'available');
  assert.equal(nodeState(progress, 'level_02'), 'locked');
  assert.equal(isUnlocked(progress, 'level_02'), false);
});

check('clearing a level marks it and unlocks the next', () => {
  const after = completeLevel(initialProgress(), 'level_01');
  assert.equal(nodeState(after, 'level_01'), 'cleared');
  assert.equal(nodeState(after, 'level_02'), 'available');
  assert.equal(after.currentLevelId, 'level_02');
});

check('replaying a cleared level does not duplicate it', () => {
  const once = completeLevel(initialProgress(), 'level_01');
  const twice = completeLevel(once, 'level_01');
  assert.deepEqual(twice.completedLevels, ['level_01']);
  assert.deepEqual(twice.unlockedLevels, ['level_01', 'level_02']);
});

check('finishing the last level leaves the player standing on it', () => {
  const end = completeLevel(completeLevel(initialProgress(), 'level_01'), 'level_02');
  assert.equal(nextLevelId('level_02'), null);
  assert.equal(end.currentLevelId, 'level_02');
  assert.deepEqual(end.completedLevels, ['level_01', 'level_02']);
});

check('completeLevel does not mutate the progress it is given', () => {
  const before = initialProgress();
  completeLevel(before, 'level_01');
  assert.deepEqual(before, initialProgress());
});
