import type { Card } from '../../types/cards';

/**
 * Placeholder card pool for testing the match loop. Once the import pipeline
 * is wired up these get replaced by cards built from real flashcards.
 */
export const DEMO_CARDS: Card[] = [
  {
    id: '11111111-1111-4111-8111-111111111101',
    name: 'Flashcard Novice',
    cost: 1,
    type: 'Minion',
    rarity: 'Common',
    attack: 2,
    health: 1,
    keywords: [],
    effects: [],
    description: 'Eager, fragile.'
  },
  {
    id: '11111111-1111-4111-8111-111111111102',
    name: 'Note Taker',
    cost: 2,
    type: 'Minion',
    rarity: 'Common',
    attack: 2,
    health: 2,
    keywords: [],
    effects: [{ trigger: 'Battlecry', action: 'DrawCard', value: 1 }],
    description: 'Battlecry: Draw a card.'
  },
  {
    id: '11111111-1111-4111-8111-111111111103',
    name: 'Library Guard',
    cost: 2,
    type: 'Minion',
    rarity: 'Common',
    attack: 1,
    health: 4,
    keywords: ['Taunt'],
    effects: [],
    description: 'Taunt. Quiet, please.'
  },
  {
    id: '11111111-1111-4111-8111-111111111104',
    name: 'Cram Session',
    cost: 3,
    type: 'Minion',
    rarity: 'Uncommon',
    attack: 3,
    health: 3,
    keywords: [],
    effects: [{ trigger: 'Deathrattle', action: 'DrawCard', value: 2 }],
    description: 'Deathrattle: Draw 2 cards.'
  },
  {
    id: '11111111-1111-4111-8111-111111111105',
    name: 'Sharpened Pencil',
    cost: 3,
    type: 'Minion',
    rarity: 'Uncommon',
    attack: 4,
    health: 2,
    keywords: ['Charge'],
    effects: [],
    description: 'Charge. Ready immediately.'
  },
  {
    id: '11111111-1111-4111-8111-111111111106',
    name: 'Spaced Repetition',
    cost: 4,
    type: 'Minion',
    rarity: 'Rare',
    attack: 3,
    health: 4,
    keywords: [],
    effects: [{ trigger: 'StartOfTurn', action: 'BuffAttack', target: 'Self', value: 1 }],
    description: 'At the start of your turn, gain +1 Attack.'
  },
  {
    id: '11111111-1111-4111-8111-111111111107',
    name: 'Highlighter Zealot',
    cost: 4,
    type: 'Minion',
    rarity: 'Rare',
    attack: 3,
    health: 3,
    keywords: ['DivineShield'],
    effects: [],
    description: 'Divine Shield.'
  },
  {
    id: '11111111-1111-4111-8111-111111111108',
    name: 'Study Group',
    cost: 5,
    type: 'Minion',
    rarity: 'Uncommon',
    attack: 3,
    health: 4,
    keywords: [],
    effects: [{ trigger: 'Battlecry', action: 'SummonToken', value: 2 }],
    description: 'Battlecry: Summon two 1/1 Study Notes.'
  },
  {
    id: '11111111-1111-4111-8111-111111111109',
    name: 'Final Exam',
    cost: 7,
    type: 'Minion',
    rarity: 'Legendary',
    attack: 6,
    health: 6,
    keywords: ['Taunt'],
    effects: [{ trigger: 'Battlecry', action: 'DealDamage', target: 'AllEnemies', value: 2 }],
    description: 'Taunt. Battlecry: Deal 2 damage to all enemies.'
  },
  {
    id: '11111111-1111-4111-8111-111111111110',
    name: 'Pop Quiz',
    cost: 2,
    type: 'Spell',
    rarity: 'Common',
    keywords: [],
    effects: [{ trigger: 'Battlecry', action: 'DealDamage', target: 'RandomEnemy', value: 3 }],
    description: 'Deal 3 damage to a random enemy.'
  },
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'All-Nighter',
    cost: 3,
    type: 'Spell',
    rarity: 'Common',
    keywords: [],
    effects: [{ trigger: 'Battlecry', action: 'DrawCard', value: 2 }],
    description: 'Draw 2 cards.'
  },
  {
    id: '11111111-1111-4111-8111-111111111112',
    name: 'Office Hours',
    cost: 2,
    type: 'Spell',
    rarity: 'Common',
    keywords: [],
    effects: [{ trigger: 'Battlecry', action: 'Heal', target: 'Hero', value: 6 }],
    description: 'Restore 6 Health to your hero.'
  }
];

/** Two copies of each card, in a fixed order — createMatch shuffles. */
export function buildDemoDeck(): Card[] {
  return DEMO_CARDS.flatMap((card) => [card, card]);
}
