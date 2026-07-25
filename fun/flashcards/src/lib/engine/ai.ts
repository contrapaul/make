import { attack, canPlayCard, endTurn, playCard } from './engine';
import { canAttack, legalTargets, opponentOf, type MatchState, type MinionInstance } from './state';

/**
 * Heuristic opponent: spend the curve, clear Taunts, take free trades,
 * otherwise hit face. Deliberately simple — it should be beatable.
 */
export function playAiTurn(state: MatchState): void {
  if (state.winner || state.current !== 'ai') return;
  spendMana(state);
  swing(state);
  if (!state.winner) endTurn(state);
}

function spendMana(state: MatchState): void {
  const hand = () => state.players.ai.hand;

  // The Coin is only worth it when it unlocks something right now.
  const coinIndex = hand().findIndex((c) => c.name === 'The Coin');
  if (coinIndex >= 0) {
    const mana = state.players.ai.mana;
    const unlocks = hand().some((c) => c.name !== 'The Coin' && c.cost === mana + 1);
    if (unlocks) playCard(state, 'ai', coinIndex);
  }

  // Greedily play the most expensive affordable card until nothing fits.
  let played = true;
  while (played && !state.winner) {
    played = false;
    let best = -1;
    let bestCost = -1;
    hand().forEach((card, i) => {
      if (card.name === 'The Coin') return;
      if (!canPlayCard(state, 'ai', i)) return;
      if (card.cost > bestCost) {
        bestCost = card.cost;
        best = i;
      }
    });
    if (best >= 0) played = playCard(state, 'ai', best);
  }
}

function swing(state: MatchState): void {
  const foe = opponentOf('ai');

  // Keep going while any minion still has an attack left.
  let acted = true;
  while (acted && !state.winner) {
    acted = false;
    const attacker = state.players.ai.board.find(canAttack);
    if (!attacker) break;

    const targets = legalTargets(state, foe);
    const heroTarget = targets.find((t) => t.kind === 'hero');
    const minionTargets = targets.flatMap((t) => (t.kind === 'minion' ? [t.minion] : []));

    // Go face if this turn's remaining damage is lethal and nothing blocks.
    if (heroTarget) {
      const available = state.players.ai.board.filter(canAttack);
      const damage = available.reduce((sum, m) => sum + m.attack, 0);
      if (damage >= state.players[foe].health) {
        acted = attack(state, 'ai', attacker.instanceId, { kind: 'hero' });
        continue;
      }
    }

    const target = chooseTarget(attacker, minionTargets, heroTarget !== undefined);
    if (!target) break;
    acted = attack(state, 'ai', attacker.instanceId, target);
  }
}

function chooseTarget(
  attacker: MinionInstance,
  minions: MinionInstance[],
  heroAvailable: boolean
): { kind: 'minion'; instanceId: string } | { kind: 'hero' } | undefined {
  const kills = minions.filter((m) => attacker.attack >= m.health);

  // A kill that the attacker survives is always worth taking.
  const freeKill = kills.find((m) => m.attack < attacker.health);
  if (freeKill) return { kind: 'minion', instanceId: freeKill.instanceId };

  if (heroAvailable) return { kind: 'hero' };

  // Taunts are in the way: kill one if possible, else chip the weakest.
  if (kills.length > 0) return { kind: 'minion', instanceId: kills[0].instanceId };
  const weakest = [...minions].sort((a, b) => a.health - b.health)[0];
  return weakest ? { kind: 'minion', instanceId: weakest.instanceId } : undefined;
}
