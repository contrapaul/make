import { Card, Effect } from '../../types/cards';
import { RawRow } from './csvParser';
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export interface FieldMapping {
  name: string;
  front: string;
  back: string;
  attack?: string;
  health?: string;
  cost?: string;
  rarity?: string;
  keywords?: string;
}

const KEYWORDS = ['Taunt', 'Charge', 'DivineShield', 'Windfury', 'Battlecry', 'Deathrattle'];
const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];

export function mapRowsToCards(rows: RawRow[], mapping: FieldMapping): Card[] {
  return rows.map(row => {
    const front = row[mapping.front] || '';
    const back = row[mapping.back] || '';

    const keywords = extractKeywords(back);
    const effects = parseEffectsFromText(back, keywords);

    const hasAttack = mapping.attack && row[mapping.attack];
    const hasHealth = mapping.health && row[mapping.health];
    const isMinion = hasAttack && hasHealth;

    const attack = isMinion ? clampInt(parseInt(row[mapping.attack!]), 1, 9) : undefined;
    const health = isMinion ? clampInt(parseInt(row[mapping.health!]), 1, 9) : undefined;

    let cost = mapping.cost && row[mapping.cost]
      ? clampInt(parseInt(row[mapping.cost]), 0, 10)
      : Math.min(9, Math.max(1, (front.length + back.length) / 5));

    let rarity: Card['rarity'] = 'Common';
    if (mapping.rarity && row[mapping.rarity]) {
      const matched = RARITIES.find(r => r.toLowerCase() === row[mapping.rarity!]?.toLowerCase());
      if (matched) rarity = matched as Card['rarity'];
    }

    const description = back || front || 'No description';

    return {
      id: generateId(),
      name: row[mapping.name] || `Card ${rows.indexOf(row) + 1}`,
      cost,
      type: isMinion ? 'Minion' : 'Spell',
      rarity,
      attack,
      health,
      keywords: keywords.filter(k => ['Taunt', 'Charge', 'DivineShield', 'Windfury'].includes(k)),
      effects,
      description: description.slice(0, 200),
      tags: [],
      _rawFront: front,
      _rawBack: back,
      _importSource: 'csv'
    };
  });
}

function extractKeywords(text: string): string[] {
  return KEYWORDS.filter(k => new RegExp(`\\b${k}\\b`, 'i').test(text));
}

function parseEffectsFromText(text: string, keywords: string[]): Effect[] {
  const effects: Effect[] = [];

  if (keywords.includes('Battlecry')) {
    const dmgMatch = text.match(/Battlecry:\s*Deal\s*(\d+)/i);
    if (dmgMatch) {
      effects.push({
        trigger: 'Battlecry',
        action: 'DealDamage',
        target: 'RandomEnemy',
        value: parseInt(dmgMatch[1])
      });
    } else {
      effects.push({
        trigger: 'Battlecry',
        action: 'DrawCard',
        value: 1
      });
    }
  }

  if (keywords.includes('Deathrattle')) {
    effects.push({
      trigger: 'Deathrattle',
      action: 'DrawCard',
      value: 1
    });
  }

  return effects.slice(0, 3);
}

function clampInt(value: number, min: number, max: number): number {
  if (isNaN(value)) return Math.floor((min + max) / 2);
  return Math.min(max, Math.max(min, value));
}
