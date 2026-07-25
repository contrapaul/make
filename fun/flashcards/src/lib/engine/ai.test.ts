import { describe, expect, it } from 'vitest';
import type { Card } from '../../types/cards';
import { buildDemoDeck } from '../data/demoDeck';
import { playAiTurn } from './ai';
import { COIN_CARD, createMatch, endTurn, playCard } from './engine';
import { HERO_HEALTH, type MatchState } from './state';

function minionCard(over: Partial<Card> = {}): Card {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Test Minion',
    cost: 1,
    type: 'Minion',
    rarity: 'Common',
    attack: 2,
    health: 2,
    keywords: [],
    effects: [],
    description: 'test',
    ...over
  };
}

/** An AI-to-move match with padded decks so fatigue doesn't skew assertions. */
function aiTurnMatch(): MatchState {
  const state = createMatch([], [], 1);
  for (const id of ['player', 'ai'] as const) {
    state.players[id].hand = [];
    state.players[id].board = [];
    state.players[id].deck = Array.from({ length: 20 }, () => minionCard());
    state.players[id].health = HERO_HEALTH;
    state.players[id].fatigue = 0;
  }
  state.current = 'ai';
  state.players.ai.mana = 10;
  state.players.ai.maxMana = 10;
  return state;
}

describe('ai turn', () => {
  it('spends its mana on the biggest affordable card first', () => {
    const state = aiTurnMatch();
    state.players.ai.mana = 4;
    state.players.ai.maxMana = 4;
    state.players.ai.hand = [
      minionCard({ cost: 1, name: 'Cheap' }),
      minionCard({ cost: 4, name: 'Big' })
    ];
    playAiTurn(state);
    expect(state.players.ai.board.map((m) => m.card.name)).toContain('Big');
  });

  it('plays The Coin when it unlocks a card, and holds it otherwise', () => {
    const unlocks = aiTurnMatch();
    unlocks.players.ai.mana = 1;
    unlocks.players.ai.maxMana = 1;
    unlocks.players.ai.hand = [COIN_CARD, minionCard({ cost: 2, name: 'Two Drop' })];
    playAiTurn(unlocks);
    expect(unlocks.players.ai.board.map((m) => m.card.name)).toContain('Two Drop');

    const useless = aiTurnMatch();
    useless.players.ai.mana = 1;
    useless.players.ai.maxMana = 1;
    useless.players.ai.hand = [COIN_CARD, minionCard({ cost: 5, name: 'Five Drop' })];
    playAiTurn(useless);
    expect(useless.players.ai.hand.some((c) => c.name === 'The Coin')).toBe(true);
  });

  it('attacks into Taunt instead of the hero', () => {
    const state = aiTurnMatch();
    state.players.ai.hand = [minionCard({ cost: 0, attack: 3, health: 3, keywords: ['Charge'] })];

    state.current = 'player';
    state.players.player.mana = 10;
    playCard(
      state,
      'player',
      state.players.player.hand.push(
        minionCard({ cost: 0, attack: 0, health: 5, keywords: ['Taunt'] })
      ) - 1
    );
    state.current = 'ai';

    playAiTurn(state);
    expect(state.players.player.health).toBe(HERO_HEALTH);
    expect(state.players.player.board[0].health).toBe(2);
  });

  it('goes face when nothing blocks', () => {
    const state = aiTurnMatch();
    state.players.ai.hand = [minionCard({ cost: 0, attack: 3, health: 3, keywords: ['Charge'] })];
    playAiTurn(state);
    expect(state.players.player.health).toBe(HERO_HEALTH - 3);
  });

  it('takes a free trade rather than hitting face', () => {
    const state = aiTurnMatch();
    state.players.ai.hand = [minionCard({ cost: 0, attack: 3, health: 3, keywords: ['Charge'] })];

    state.current = 'player';
    state.players.player.mana = 10;
    playCard(
      state,
      'player',
      state.players.player.hand.push(minionCard({ cost: 0, attack: 1, health: 2 })) - 1
    );
    state.current = 'ai';

    playAiTurn(state);
    expect(state.players.player.board).toHaveLength(0);
    expect(state.players.player.health).toBe(HERO_HEALTH);
  });

  it('plays a full match to a decided result without stalling', () => {
    const state = createMatch(buildDemoDeck(), buildDemoDeck(), 99);
    let guard = 0;
    while (!state.winner && guard++ < 500) {
      // The human seat passes; only the AI actually plays.
      if (state.current === 'player') endTurn(state);
      else playAiTurn(state);
    }
    expect(state.winner).not.toBeNull();
    expect(guard).toBeLessThan(500);
  });

  it('does nothing when it is not the AI to move', () => {
    const state = aiTurnMatch();
    state.current = 'player';
    state.players.ai.hand = [minionCard({ cost: 0 })];
    playAiTurn(state);
    expect(state.players.ai.board).toHaveLength(0);
    expect(state.current).toBe('player');
  });
});
