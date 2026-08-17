/**
 * The catalogue of optional image assets: what the game will use if you supply
 * it, where it goes, and what it replaces. Pure data, with no browser
 * dependencies, so `npm run checks` can hold it against IMAGES.md.
 *
 * The loader that consumes this lives in ImageAssets.ts.
 */
export interface ImageAsset {
  /** Path under app/assets/, which is also the path in IMAGES.md. */
  path: string;
  /** What it replaces, for the checklist. */
  replaces: string;
  /** Recommended pixel size, per plans.md §11. */
  size: string;
  /** Set for textures that tile across a surface. */
  tiling?: boolean;
  /** Frame grid, if the file is a sprite sheet rather than one image. */
  sheet?: { columns: number; rows: number };
}

/**
 * Enemy sheets follow plans.md §11.1: one row per state, in this order, with the
 * widest state setting the column count.
 */
export const ENEMY_SHEET = { columns: 8, rows: 6 } as const;
export const ENEMY_SHEET_ROWS = ['idle', 'walk', 'attack', 'hit', 'death', 'corpse'] as const;

const ENEMY_IDS = [
  'hell_tambourine',
  'infernal_maracas',
  'damned_whistle',
  'abyssal_organ',
  'screaming_siren',
  'cursed_fiddle',
  'choir_of_ruin',
  'wretched_zither',
] as const;

const WEAPON_IDS = ['trumpet', 'tuba', 'saxophone', 'electric_guitar'] as const;
const KEY_COLORS = ['red', 'blue', 'green'] as const;

/** Everything the game will use if you provide it. Also drives IMAGES.md. */
export const IMAGE_ASSETS: readonly ImageAsset[] = [
  // Level surfaces (plans.md §13) — must tile seamlessly.
  { path: 'textures/walls/hell_wall_01.png', replaces: 'wall_hell', size: '512x512', tiling: true },
  { path: 'textures/floors/music_floor_01.png', replaces: 'floor_music', size: '512x512', tiling: true },
  { path: 'textures/ceilings/void_ceiling_01.png', replaces: 'ceil_void', size: '512x512', tiling: true },

  // Effects (plans.md §11.4).
  { path: 'textures/particles/particle_gold.png', replaces: 'gold hit particle', size: '64x64' },
  ...[1, 2, 3, 4].map((n) => ({
    path: `textures/decals/gold_splat_0${n}.png`,
    replaces: `gold blood splat ${n} of 4`,
    size: '256x256',
  })),

  // Enemies (plans.md §11.1). One sheet each; the corpse row is used for corpses.
  ...ENEMY_IDS.map((id) => ({
    path: `sprites/enemies/${id}_sheet.png`,
    replaces: `${id} sprite sheet`,
    size: `${ENEMY_SHEET.columns} x ${ENEMY_SHEET.rows} frames of 256x256`,
    sheet: { ...ENEMY_SHEET },
  })),

  // First-person instruments (plans.md §11.2).
  ...WEAPON_IDS.map((id) => ({
    path: `sprites/weapons/${id}_viewmodel.png`,
    replaces: `${id} view model`,
    size: '512x512',
  })),

  // Projectiles (plans.md §11.3).
  { path: 'sprites/projectiles/proj_note.png', replaces: 'trumpet and sax notes', size: '64x64' },

  // Keys, doors and the exit (plans.md §11.5).
  ...KEY_COLORS.map((color) => ({
    path: `sprites/keys/key_${color}_note.png`,
    replaces: `${color} music-note key`,
    size: '128x128',
  })),
  ...KEY_COLORS.map((color) => ({
    path: `textures/doors/door_${color}_front.png`,
    replaces: `${color} door panel`,
    size: '512x512',
  })),
  { path: 'sprites/exit_portal.png', replaces: 'exit portal', size: '256x256' },
];

/** Where an enemy type's sprite sheet lives. */
export function enemySheetPath(typeId: string): string {
  return `sprites/enemies/${typeId}_sheet.png`;
}

/** Row index of a named enemy state within its sheet. */
export function enemySheetRow(state: (typeof ENEMY_SHEET_ROWS)[number]): number {
  return ENEMY_SHEET_ROWS.indexOf(state);
}
