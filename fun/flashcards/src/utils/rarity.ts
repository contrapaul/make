import { Card, Rarity } from '../types/cards';

const RARITY_WEIGHTS: Record<Rarity, number> = {
  Common: 50, Uncommon: 30, Rare: 15, Epic: 4, Legendary: 1
};

export function getRarityWeight(card: Card): number {
  return RARITY_WEIGHTS[card.rarity] || 50;
}

export function weightedRandomPick(cards: Card[]): Card {
  const totalWeight = cards.reduce((sum, c) => sum + getRarityWeight(c), 0);
  let random = Math.random() * totalWeight;
  for (const card of cards) {
    random -= getRarityWeight(card);
    if (random <= 0) return card;
  }
  return cards[cards.length - 1];
}
