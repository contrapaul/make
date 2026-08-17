import overworldJson from '../data/overworld.json';

/** Descent map, plans.md §15. Nodes are laid out vertically to imply depth. */
export interface OverworldNode {
  id: string;
  name: string;
  x: number;
  y: number;
}

export interface Overworld {
  nodes: OverworldNode[];
  edges: [string, string][];
}

export const OVERWORLD = overworldJson as Overworld;

/** Save-file progress, plans.md §16. */
export interface Progress {
  currentLevelId: string;
  completedLevels: string[];
  unlockedLevels: string[];
}

export type NodeState = 'locked' | 'available' | 'cleared';

/** Only the first node is open on a fresh save. */
export function initialProgress(overworld: Overworld = OVERWORLD): Progress {
  const first = overworld.nodes[0]!.id;

  return { currentLevelId: first, completedLevels: [], unlockedLevels: [first] };
}

/** What the node after `levelId` is, following the map's edges. */
export function nextLevelId(levelId: string, overworld: Overworld = OVERWORLD): string | null {
  const edge = overworld.edges.find(([from]) => from === levelId);

  return edge ? edge[1] : null;
}

/**
 * Marks a level cleared and unlocks whatever it leads to. Returns fresh progress
 * rather than mutating, so the caller decides when it becomes the saved state.
 */
export function completeLevel(progress: Progress, levelId: string, overworld: Overworld = OVERWORLD): Progress {
  const completedLevels = progress.completedLevels.includes(levelId)
    ? [...progress.completedLevels]
    : [...progress.completedLevels, levelId];

  const unlockedLevels = [...progress.unlockedLevels];
  const next = nextLevelId(levelId, overworld);
  if (next && !unlockedLevels.includes(next)) unlockedLevels.push(next);

  return {
    // Finishing the last level leaves you standing on it.
    currentLevelId: next ?? levelId,
    completedLevels,
    unlockedLevels,
  };
}

export function nodeState(progress: Progress, levelId: string): NodeState {
  if (progress.completedLevels.includes(levelId)) return 'cleared';
  if (progress.unlockedLevels.includes(levelId)) return 'available';

  return 'locked';
}

export function isUnlocked(progress: Progress, levelId: string): boolean {
  return progress.unlockedLevels.includes(levelId);
}
