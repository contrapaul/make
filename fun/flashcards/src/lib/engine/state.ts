import type { Card } from '../../types/cards';

export const HERO_HEALTH = 30;
export const MAX_MANA = 10;
export const BOARD_LIMIT = 7;
export const HAND_LIMIT = 10;

export type PlayerId = 'player' | 'ai';

export interface MinionInstance {
  instanceId: string;
  card: Card;
  attack: number;
  health: number;
  maxHealth: number;
  keywords: string[];
  divineShield: boolean;
  summonedThisTurn: boolean;
  attacksThisTurn: number;
}

export interface PlayerState {
  id: PlayerId;
  health: number;
  mana: number;
  maxMana: number;
  deck: Card[];
  hand: Card[];
  board: MinionInstance[];
  fatigue: number;
}

export interface MatchState {
  players: Record<PlayerId, PlayerState>;
  current: PlayerId;
  turnNumber: number;
  winner: PlayerId | 'draw' | null;
  log: string[];
  seed: number;
  nextInstanceId: number;
}

/** A minion or a hero — anything that can be damaged or healed. */
export type Character =
  | { kind: 'minion'; owner: PlayerId; minion: MinionInstance }
  | { kind: 'hero'; owner: PlayerId };

export function opponentOf(id: PlayerId): PlayerId {
  return id === 'player' ? 'ai' : 'player';
}

export function findMinion(
  state: MatchState,
  instanceId: string
): { owner: PlayerId; minion: MinionInstance } | undefined {
  for (const owner of ['player', 'ai'] as PlayerId[]) {
    const minion = state.players[owner].board.find((m) => m.instanceId === instanceId);
    if (minion) return { owner, minion };
  }
  return undefined;
}

/** Windfury minions get two swings a turn; everything else gets one. */
export function maxAttacksFor(minion: MinionInstance): number {
  return minion.keywords.includes('Windfury') ? 2 : 1;
}

export function canAttack(minion: MinionInstance): boolean {
  if (minion.attack <= 0) return false;
  if (minion.attacksThisTurn >= maxAttacksFor(minion)) return false;
  if (minion.summonedThisTurn && !minion.keywords.includes('Charge')) return false;
  return true;
}

/** Taunt forces attackers to go through it first. */
export function legalTargets(state: MatchState, defenderId: PlayerId): Character[] {
  const board = state.players[defenderId].board;
  const taunts = board.filter((m) => m.keywords.includes('Taunt'));
  if (taunts.length > 0) {
    return taunts.map((minion) => ({ kind: 'minion', owner: defenderId, minion }));
  }
  return [
    ...board.map((minion) => ({ kind: 'minion' as const, owner: defenderId, minion })),
    { kind: 'hero' as const, owner: defenderId }
  ];
}
