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

