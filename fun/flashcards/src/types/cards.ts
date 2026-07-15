// ──────────────────────────────────────────────────────────────
// CARD SCHEMA & VALIDATION RULES v0.1
// Designed for: Flashcard import, early-Hearthstone pacing, 
// deterministic fallbacks, rarity-weighted drafting
// ──────────────────────────────────────────────────────────────

export type CardType = 'Minion' | 'Spell' | 'HeroPower';
export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';
export type Trigger = 
  | 'Battlecry' 
  | 'Deathrattle' 
  | 'StartOfTurn' 
  | 'EndOfTurn' 
  | 'OnAttack' 
  | 'Passive';
export type Action = 
  | 'DealDamage' 
  | 'DrawCard' 
  | 'BuffAttack' 
  | 'BuffHealth' 
  | 'Heal' 
  | 'SummonToken' 
  | 'Destroy' 
  | 'GainKeyword';
export type Target = 
  | 'Self' 
  | 'EnemyMinion' 
  | 'FriendlyMinion' 
  | 'Hero' 
  | 'RandomEnemy' 
  | 'AllEnemies';

export interface Effect {
  trigger: Trigger;
  action: Action;
  target?: Target;
  value?: number; // e.g., damage, buff size, cards to draw
  condition?: string | null; // Optional: "if_target_has_taunt", "only_if_empty_board", etc.
}

export interface Card {
  id: string; // UUIDv4 or deterministic hash (e.g., sha256(name+frontText))
  name: string;
  cost: number; // Mana to play (0-10)
  type: CardType;
  rarity: Rarity;
  
  // Minion-only fields (undefined for Spells/HeroPowers)
  attack?: number; // 1-9
  health?: number; // 1-9
  
  keywords: string[]; // ['Taunt', 'Charge', 'DivineShield', 'Windfury']
  effects: Effect[]; // Structured effect array (parsed or manual)
  description: string; // Human-readable UI text (auto-generated from effects or raw input)
  
  art?: { type: 'css' | 'image'; value: string }; // CSS class/hash or R2 URL
  tags?: string[]; // Flashcard metadata, used for rarity weighting & filtering
  
  // Import/Mapping metadata (stripped before match sync)
  _rawFront?: string;
  _rawBack?: string;
  _importSource?: 'csv' | 'md' | 'anki' | 'manual';
}

// ──────────────────────────────────────────────────────────────
// ZOD RUNTIME VALIDATION (drop into src/validators/card.validator.ts)
// ──────────────────────────────────────────────────────────────
import { z } from 'zod';

const EffectSchema = z.object({
  trigger: z.enum(['Battlecry', 'Deathrattle', 'StartOfTurn', 'EndOfTurn', 'OnAttack', 'Passive']),
  action: z.enum(['DealDamage', 'DrawCard', 'BuffAttack', 'BuffHealth', 'Heal', 'SummonToken', 'Destroy', 'GainKeyword']),
  target: z.enum(['Self', 'EnemyMinion', 'FriendlyMinion', 'Hero', 'RandomEnemy', 'AllEnemies']).optional(),
  value: z.number().int().min(0).max(99).optional(),
  condition: z.string().nullable().optional()
});

export const CardSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  cost: z.number().int().min(0).max(10),
  type: z.enum(['Minion', 'Spell', 'HeroPower']),
  rarity: z.enum(['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']),
  attack: z.number().int().min(1).max(9).optional(),
  health: z.number().int().min(1).max(9).optional(),
  keywords: z.array(z.enum(['Taunt', 'Charge', 'DivineShield', 'Windfury'])).default([]),
  effects: z.array(EffectSchema).max(3), // v1 limit for pacing & parseability
  description: z.string().min(1).max(200),
  art: z.object({ type: z.enum(['css', 'image']), value: z.string() }).optional(),
  tags: z.array(z.string()).default([]),
  _rawFront: z.string().optional(),
  _rawBack: z.string().optional(),
  _importSource: z.enum(['csv', 'md', 'anki', 'manual']).optional()
}).refine((data) => {
  // Type-specific constraints
  if (data.type === 'Minion') {
    return data.attack !== undefined && data.health !== undefined;
  }
  if (data.type === 'Spell' || data.type === 'HeroPower') {
    return data.attack === undefined && data.health === undefined;
  }
  return true;
});

export type ValidatedCard = z.infer<typeof CardSchema>;
