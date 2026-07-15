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
  effects: z.array(EffectSchema).max(3),
  description: z.string().min(1).max(200),
  art: z.object({ type: z.enum(['css', 'image']), value: z.string() }).optional(),
  tags: z.array(z.string()).default([]),
  _rawFront: z.string().optional(),
  _rawBack: z.string().optional(),
  _importSource: z.enum(['csv', 'md', 'anki', 'manual']).optional()
}).refine((data) => {
  if (data.type === 'Minion') return data.attack !== undefined && data.health !== undefined;
  if (data.type === 'Spell' || data.type === 'HeroPower') return data.attack === undefined && data.health === undefined;
  return true;
});

export type ValidatedCard = z.infer<typeof CardSchema>;
