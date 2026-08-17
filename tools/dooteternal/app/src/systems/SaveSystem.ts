import { initialProgress, type Progress } from './Progress';

/**
 * Local save, plans.md §16. Settings and progress persist so a browser refresh
 * drops the player back where they were.
 *
 * Storage is injected rather than reaching for localStorage directly: it keeps
 * the schema and its validation testable outside a browser, and gives private
 * mode — where localStorage throws on write — somewhere harmless to fall back to.
 */
export const SAVE_KEY = 'musicHell_save_v1';
export const SAVE_VERSION = 1;

export interface Settings {
  soundtrackEnabled: boolean;
  /** 0–1. */
  sfxVolume: number;
  /** 0.25x–3.0x (plans.md §17). */
  mouseSensitivity: number;
}

/** Mid-level state, so a refresh doesn't cost the player their progress. */
export interface LevelState {
  levelId: string;
  breath: number;
  keysCollected: string[];
  doorsOpened: string[];
  killedEnemyIds: string[];
  playerPosition: { x: number; y: number; yawDegrees: number };
}

export interface SaveData {
  version: number;
  settings: Settings;
  progress: Progress;
  levelState: LevelState | null;
}

/** The slice of the Storage API this needs. */
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const DEFAULT_SETTINGS: Settings = {
  soundtrackEnabled: true,
  sfxVolume: 0.8,
  mouseSensitivity: 1.0,
};

export const SENSITIVITY_RANGE = { min: 0.25, max: 3.0 };

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    progress: initialProgress(),
    levelState: null,
  };
}

/** Keeps loaded or slider-set values inside the ranges §17 specifies. */
export function clampSettings(settings: Partial<Settings> | undefined): Settings {
  return {
    soundtrackEnabled: settings?.soundtrackEnabled ?? DEFAULT_SETTINGS.soundtrackEnabled,
    sfxVolume: clamp(numberOr(settings?.sfxVolume, DEFAULT_SETTINGS.sfxVolume), 0, 1),
    mouseSensitivity: clamp(
      numberOr(settings?.mouseSensitivity, DEFAULT_SETTINGS.mouseSensitivity),
      SENSITIVITY_RANGE.min,
      SENSITIVITY_RANGE.max,
    ),
  };
}

/**
 * In-memory storage, used when localStorage is unavailable. The session still
 * behaves normally; it just doesn't outlive the tab.
 */
export function memoryStorage(): SaveStorage {
  const map = new Map<string, string>();

  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
  };
}

export function browserStorage(): SaveStorage {
  try {
    const probe = '__doot_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    console.info('[save] localStorage unavailable, progress will not persist');
    return memoryStorage();
  }
}

export class SaveSystem {
  readonly data: SaveData;

  constructor(private readonly storage: SaveStorage) {
    this.data = this.read();
  }

  get settings(): Settings {
    return this.data.settings;
  }

  get progress(): Progress {
    return this.data.progress;
  }

  setProgress(progress: Progress): void {
    this.data.progress = progress;
    this.save();
  }

  setLevelState(levelState: LevelState | null): void {
    this.data.levelState = levelState;
    this.save();
  }

  /** Mutate `settings` then call this — sliders change live, then persist. */
  save(): void {
    // Clamp in place. The menu, input and audio all hold a reference to this
    // object so changes are heard live; replacing it would detach every one of
    // them and their edits would quietly stop having any effect.
    Object.assign(this.data.settings, clampSettings(this.data.settings));

    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      // A full or blocked store shouldn't take the game down mid-fight.
    }
  }

  private read(): SaveData {
    const raw = this.storage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();

    try {
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      // A save from another version isn't worth guessing at.
      if (parsed.version !== SAVE_VERSION) return defaultSave();

      const fallback = defaultSave();

      return {
        version: SAVE_VERSION,
        settings: clampSettings(parsed.settings),
        progress: validProgress(parsed.progress) ? parsed.progress : fallback.progress,
        levelState: validLevelState(parsed.levelState) ? parsed.levelState : null,
      };
    } catch {
      return defaultSave();
    }
  }
}

function validProgress(progress: Progress | undefined): progress is Progress {
  return (
    !!progress &&
    typeof progress.currentLevelId === 'string' &&
    Array.isArray(progress.completedLevels) &&
    Array.isArray(progress.unlockedLevels) &&
    progress.unlockedLevels.length > 0
  );
}

function validLevelState(state: LevelState | null | undefined): state is LevelState {
  return (
    !!state &&
    typeof state.levelId === 'string' &&
    typeof state.breath === 'number' &&
    Array.isArray(state.keysCollected) &&
    Array.isArray(state.doorsOpened) &&
    Array.isArray(state.killedEnemyIds) &&
    !!state.playerPosition &&
    typeof state.playerPosition.x === 'number' &&
    typeof state.playerPosition.y === 'number' &&
    typeof state.playerPosition.yawDegrees === 'number'
  );
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
