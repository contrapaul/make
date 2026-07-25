import type { Card, Effect, Trigger } from '../../types/cards';
import { createRng, pick, shuffle, type Rng } from './rng';
import {
  BOARD_LIMIT,
  HAND_LIMIT,
  HERO_HEALTH,
  MAX_MANA,
  canAttack,
  legalTargets,
  opponentOf,
  type Character,
  type MatchState,
  type MinionInstance,
  type PlayerId,
  type PlayerState
} from './state';

const TOKEN_CARD: Card = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Study Note',
  cost: 1,
  type: 'Minion',
  rarity: 'Common',
  attack: 1,
  health: 1,
  keywords: [],
  effects: [],
  description: 'A scrap of revision.'
};

/** Compensation for going second. Not part of any deck — dealt at match start. */
export const COIN_CARD: Card = {
  id: '00000000-0000-4000-8000-000000000002',
  name: 'The Coin',
  cost: 0,
  type: 'Spell',
  rarity: 'Common',
  keywords: [],
  effects: [{ trigger: 'Battlecry', action: 'GainMana', value: 1 }],
  description: 'Gain 1 Mana Crystal this turn.'
};

// ── Setup ──────────────────────────────────────────────────────

function createPlayer(id: PlayerId, deck: Card[]): PlayerState {
  return {
    id,
    health: HERO_HEALTH,
    mana: 0,
    maxMana: 0,
    deck,
    hand: [],
    board: [],
    fatigue: 0
  };
}

export function createMatch(playerDeck: Card[], aiDeck: Card[], seed = 1): MatchState {
  const rng = createRng(seed);
  const state: MatchState = {
    players: {
      player: createPlayer('player', shuffle(rng, playerDeck)),
      ai: createPlayer('ai', shuffle(rng, aiDeck))
    },
    current: 'player',
    turnNumber: 0,
    winner: null,
    log: [],
    seed,
    nextInstanceId: 1
  };

  // The player moves first; the AI gets an extra card and The Coin to compensate.
  for (let i = 0; i < 3; i++) drawCard(state, 'player');
  for (let i = 0; i < 4; i++) drawCard(state, 'ai');
  state.players.ai.hand.push(COIN_CARD);

  startTurn(state, 'player');
  return state;
}

/** Each match re-derives its RNG from the seed plus turn count so replays match. */
function rngFor(state: MatchState): Rng {
  return createRng(state.seed + state.turnNumber * 7919 + state.nextInstanceId);
}

// ── Turn structure ─────────────────────────────────────────────

function startTurn(state: MatchState, id: PlayerId): void {
  const p = state.players[id];
  state.current = id;
  state.turnNumber++;
  p.maxMana = Math.min(MAX_MANA, p.maxMana + 1);
  p.mana = p.maxMana;
  for (const minion of p.board) {
    minion.summonedThisTurn = false;
    minion.attacksThisTurn = 0;
  }
  state.log.push(`— ${id} turn ${state.turnNumber} (${p.mana} mana) —`);
  drawCard(state, id);
  triggerBoard(state, id, 'StartOfTurn');
}

export function endTurn(state: MatchState): void {
  if (state.winner) return;
  const id = state.current;
  triggerBoard(state, id, 'EndOfTurn');
  if (state.winner) return;
  startTurn(state, opponentOf(id));
}

function triggerBoard(state: MatchState, id: PlayerId, trigger: Trigger): void {
  // Snapshot: effects can kill minions mid-loop.
  for (const minion of [...state.players[id].board]) {
    if (!state.players[id].board.includes(minion)) continue;
    for (const effect of minion.card.effects) {
      if (effect.trigger === trigger) resolveEffect(state, id, minion, effect);
    }
  }
  checkDeaths(state);
}

// ── Cards ──────────────────────────────────────────────────────

export function drawCard(state: MatchState, id: PlayerId): void {
  const p = state.players[id];
  const card = p.deck.shift();
  if (!card) {
    p.fatigue++;
    state.log.push(`${id} is out of cards — ${p.fatigue} fatigue damage.`);
    damageHero(state, id, p.fatigue);
    return;
  }
  if (p.hand.length >= HAND_LIMIT) {
    state.log.push(`${id}'s hand is full — ${card.name} burned.`);
    return;
  }
  p.hand.push(card);
}

export function canPlayCard(state: MatchState, id: PlayerId, handIndex: number): boolean {
  if (state.winner || state.current !== id) return false;
  const p = state.players[id];
  const card = p.hand[handIndex];
  if (!card) return false;
  if (card.cost > p.mana) return false;
  if (card.type === 'Minion' && p.board.length >= BOARD_LIMIT) return false;
  return true;
}

export function playCard(state: MatchState, id: PlayerId, handIndex: number): boolean {
  if (!canPlayCard(state, id, handIndex)) return false;
  const p = state.players[id];
  const [card] = p.hand.splice(handIndex, 1);
  p.mana -= card.cost;
  state.log.push(`${id} plays ${card.name}.`);

  let summoned: MinionInstance | undefined;
  if (card.type === 'Minion') summoned = summon(state, id, card);

  // Battlecry-triggered effects fire on play, for minions and spells alike.
  for (const effect of card.effects) {
    if (effect.trigger === 'Battlecry') resolveEffect(state, id, summoned, effect);
  }

  checkDeaths(state);
  return true;
}

function summon(state: MatchState, id: PlayerId, card: Card): MinionInstance | undefined {
  const p = state.players[id];
  if (p.board.length >= BOARD_LIMIT) return undefined;
  const minion: MinionInstance = {
    instanceId: `m${state.nextInstanceId++}`,
    card,
    attack: card.attack ?? 0,
    health: card.health ?? 1,
    maxHealth: card.health ?? 1,
    keywords: [...card.keywords],
    divineShield: card.keywords.includes('DivineShield'),
    summonedThisTurn: true,
    attacksThisTurn: 0
  };
  p.board.push(minion);
  return minion;
}

// ── Combat ─────────────────────────────────────────────────────

export function attack(
  state: MatchState,
  id: PlayerId,
  attackerInstanceId: string,
  target: { kind: 'minion'; instanceId: string } | { kind: 'hero' }
): boolean {
  if (state.winner || state.current !== id) return false;

  const attacker = state.players[id].board.find((m) => m.instanceId === attackerInstanceId);
  if (!attacker || !canAttack(attacker)) return false;

  const defenderId = opponentOf(id);
  const allowed = legalTargets(state, defenderId);
  const chosen = allowed.find((c) =>
    target.kind === 'hero'
      ? c.kind === 'hero'
      : c.kind === 'minion' && c.minion.instanceId === target.instanceId
  );
  if (!chosen) return false;

  attacker.attacksThisTurn++;
  for (const effect of attacker.card.effects) {
    if (effect.trigger === 'OnAttack') resolveEffect(state, id, attacker, effect);
  }

  if (chosen.kind === 'hero') {
    state.log.push(`${attacker.card.name} hits ${defenderId} for ${attacker.attack}.`);
    damageHero(state, defenderId, attacker.attack);
  } else {
    const defender = chosen.minion;
    state.log.push(`${attacker.card.name} attacks ${defender.card.name}.`);
    const incoming = defender.attack;
    damageMinion(state, defender, attacker.attack);
    damageMinion(state, attacker, incoming);
  }

  checkDeaths(state);
  return true;
}

function damageMinion(state: MatchState, minion: MinionInstance, amount: number): void {
  if (amount <= 0) return;
  if (minion.divineShield) {
    minion.divineShield = false;
    minion.keywords = minion.keywords.filter((k) => k !== 'DivineShield');
    state.log.push(`${minion.card.name}'s Divine Shield absorbs the hit.`);
    return;
  }
  minion.health -= amount;
}

function damageHero(state: MatchState, id: PlayerId, amount: number): void {
  if (amount <= 0) return;
  state.players[id].health -= amount;
  checkWinner(state);
}

function damageCharacter(state: MatchState, target: Character, amount: number): void {
  if (target.kind === 'hero') damageHero(state, target.owner, amount);
  else damageMinion(state, target.minion, amount);
}

function checkDeaths(state: MatchState): void {
  // Deathrattles can kill further minions, so settle the board repeatedly.
  let settled = false;
  while (!settled) {
    settled = true;
    for (const owner of ['player', 'ai'] as PlayerId[]) {
      const board = state.players[owner].board;
      const dead = board.filter((m) => m.health <= 0);
      if (dead.length === 0) continue;
      settled = false;
      state.players[owner].board = board.filter((m) => m.health > 0);
      for (const minion of dead) {
        state.log.push(`${minion.card.name} dies.`);
        for (const effect of minion.card.effects) {
          if (effect.trigger === 'Deathrattle') resolveEffect(state, owner, minion, effect);
        }
      }
    }
  }
  checkWinner(state);
}

function checkWinner(state: MatchState): void {
  if (state.winner) return;
  const playerDead = state.players.player.health <= 0;
  const aiDead = state.players.ai.health <= 0;
  if (playerDead && aiDead) state.winner = 'draw';
  else if (playerDead) state.winner = 'ai';
  else if (aiDead) state.winner = 'player';
  if (state.winner) state.log.push(`Game over — ${state.winner}.`);
}

// ── Effects ────────────────────────────────────────────────────

const HELPFUL = new Set(['Heal', 'BuffAttack', 'BuffHealth', 'GainKeyword']);

/**
 * `source` is the minion the effect came from, or undefined for spells.
 * Targets resolve automatically — no manual targeting in v0.1.
 */
function resolveTargets(
  state: MatchState,
  owner: PlayerId,
  source: MinionInstance | undefined,
  effect: Effect,
  rng: Rng
): Character[] {
  const foe = opponentOf(owner);
  const enemyBoard = state.players[foe].board;
  const friendlyBoard = state.players[owner].board;

  switch (effect.target) {
    case 'Self':
      return source
        ? [{ kind: 'minion', owner, minion: source }]
        : [{ kind: 'hero', owner }];

    case 'EnemyMinion': {
      const m = pick(rng, enemyBoard);
      return m ? [{ kind: 'minion', owner: foe, minion: m }] : [];
    }

    case 'FriendlyMinion': {
      const others = friendlyBoard.filter((m) => m !== source);
      const m = pick(rng, others.length > 0 ? others : friendlyBoard);
      return m ? [{ kind: 'minion', owner, minion: m }] : [];
    }

    // Helpful effects aimed at "Hero" mean your own; harmful ones mean theirs.
    case 'Hero':
      return [{ kind: 'hero', owner: HELPFUL.has(effect.action) ? owner : foe }];

    case 'RandomEnemy': {
      const candidates: Character[] = [
        ...enemyBoard.map((minion) => ({ kind: 'minion' as const, owner: foe, minion })),
        { kind: 'hero' as const, owner: foe }
      ];
      const c = pick(rng, candidates);
      return c ? [c] : [];
    }

    case 'AllEnemies':
      return [
        ...enemyBoard.map((minion) => ({ kind: 'minion' as const, owner: foe, minion })),
        { kind: 'hero' as const, owner: foe }
      ];

    default:
      return [];
  }
}

function resolveEffect(
  state: MatchState,
  owner: PlayerId,
  source: MinionInstance | undefined,
  effect: Effect
): void {
  const rng = rngFor(state);
  const value = effect.value ?? 1;

  // These act on the owner directly and need no target.
  if (effect.action === 'DrawCard') {
    for (let i = 0; i < value; i++) drawCard(state, owner);
    return;
  }
  if (effect.action === 'SummonToken') {
    for (let i = 0; i < value; i++) summon(state, owner, TOKEN_CARD);
    return;
  }
  if (effect.action === 'GainMana') {
    const p = state.players[owner];
    p.mana = Math.min(MAX_MANA, p.mana + value);
    return;
  }

  for (const target of resolveTargets(state, owner, source, effect, rng)) {
    switch (effect.action) {
      case 'DealDamage':
        damageCharacter(state, target, value);
        break;

      case 'Heal':
        if (target.kind === 'hero') {
          const p = state.players[target.owner];
          p.health = Math.min(HERO_HEALTH, p.health + value);
        } else {
          const m = target.minion;
          m.health = Math.min(m.maxHealth, m.health + value);
        }
        break;

      case 'BuffAttack':
        if (target.kind === 'minion') target.minion.attack += value;
        break;

      case 'BuffHealth':
        if (target.kind === 'minion') {
          target.minion.maxHealth += value;
          target.minion.health += value;
        }
        break;

      case 'Destroy':
        if (target.kind === 'minion') target.minion.health = 0;
        break;

      case 'GainKeyword': {
        // The schema has no keyword field, so `condition` carries the name.
        if (target.kind !== 'minion') break;
        const keyword = effect.condition ?? 'Taunt';
        if (!target.minion.keywords.includes(keyword)) {
          target.minion.keywords.push(keyword);
          if (keyword === 'DivineShield') target.minion.divineShield = true;
        }
        break;
      }
    }
  }
}
