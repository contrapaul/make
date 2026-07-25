<script lang="ts">
  import CardPreview from '$lib/components/CardPreview.svelte';
  import MinionView from '$lib/components/MinionView.svelte';
  import { buildDemoDeck } from '$lib/data/demoDeck';
  import { playAiTurn } from '$lib/engine/ai';
  import { attack, canPlayCard, createMatch, endTurn, playCard } from '$lib/engine/engine';
  import { HERO_HEALTH, canAttack, legalTargets } from '$lib/engine/state';

  let state = createMatch(buildDemoDeck(), buildDemoDeck(), Date.now() % 100000);
  let selectedId: string | null = null;
  let aiThinking = false;

  $: me = state.players.player;
  $: foe = state.players.ai;
  $: myTurn = state.current === 'player' && !state.winner && !aiThinking;
  $: targets = myTurn && selectedId ? legalTargets(state, 'ai') : [];
  $: heroTargetable = targets.some((t) => t.kind === 'hero');
  // Must be a reactive value, not a function call: Svelte only re-evaluates a
  // prop expression when something it references is dirty.
  $: targetableIds = new Set(
    targets.flatMap((t) => (t.kind === 'minion' ? [t.minion.instanceId] : []))
  );

  function onHandCard(index: number) {
    if (!myTurn || !canPlayCard(state, 'player', index)) return;
    playCard(state, 'player', index);
    selectedId = null;
    state = state;
  }

  function onMyMinion(instanceId: string) {
    if (!myTurn) return;
    const minion = me.board.find((m) => m.instanceId === instanceId);
    if (!minion || !canAttack(minion)) return;
    selectedId = selectedId === instanceId ? null : instanceId;
  }

  function onEnemyTarget(target: { kind: 'minion'; instanceId: string } | { kind: 'hero' }) {
    if (!myTurn || !selectedId) return;
    attack(state, 'player', selectedId, target);
    selectedId = null;
    state = state;
  }

  function onEndTurn() {
    if (!myTurn) return;
    selectedId = null;
    endTurn(state);
    state = state;
    runAi();
  }

  function runAi() {
    if (state.winner || state.current !== 'ai') return;
    aiThinking = true;
    // A beat so the player can read what the AI did.
    setTimeout(() => {
      playAiTurn(state);
      aiThinking = false;
      state = state;
    }, 700);
  }

  function restart() {
    state = createMatch(buildDemoDeck(), buildDemoDeck(), Date.now() % 100000);
    selectedId = null;
    aiThinking = false;
  }
</script>

<svelte:head><title>Study &amp; Strike</title></svelte:head>

<main>
  <header>
    <h1>Study &amp; Strike</h1>
    <p class="tagline">Import flashcards. Build decks. Play.</p>
  </header>

  <section class="table">
    <!-- Opponent -->
    <div class="side">
      <div class="hero-row">
        <button
          class="hero enemy"
          class:targetable={heroTargetable}
          on:click={() => onEnemyTarget({ kind: 'hero' })}
          disabled={!heroTargetable}
        >
          <span class="hero-label">Opponent</span>
          <span class="hp">{foe.health}<small>/{HERO_HEALTH}</small></span>
        </button>
        <div class="meta">
          <span>Hand {foe.hand.length}</span>
          <span>Deck {foe.deck.length}</span>
          <span>Mana {foe.mana}/{foe.maxMana}</span>
        </div>
      </div>

      <div class="board">
        {#each foe.board as minion (minion.instanceId)}
          <MinionView
            {minion}
            targetable={targetableIds.has(minion.instanceId)}
            on:click={() => onEnemyTarget({ kind: 'minion', instanceId: minion.instanceId })}
          />
        {:else}
          <p class="empty">no minions</p>
        {/each}
      </div>
    </div>

    <div class="divider">
      {#if aiThinking}
        <span class="thinking">Opponent is thinking…</span>
      {:else if myTurn}
        <span class="prompt">{selectedId ? 'Pick a target' : 'Your move'}</span>
      {/if}
    </div>

    <!-- You -->
    <div class="side">
      <div class="board">
        {#each me.board as minion (minion.instanceId)}
          <MinionView
            {minion}
            ready={myTurn && canAttack(minion)}
            selected={selectedId === minion.instanceId}
            on:click={() => onMyMinion(minion.instanceId)}
          />
        {:else}
          <p class="empty">no minions</p>
        {/each}
      </div>

      <div class="hero-row">
        <div class="hero you">
          <span class="hero-label">You</span>
          <span class="hp">{me.health}<small>/{HERO_HEALTH}</small></span>
        </div>
        <div class="meta">
          <span>Deck {me.deck.length}</span>
          <span class="mana">Mana {me.mana}/{me.maxMana}</span>
        </div>
        <button class="end-turn" on:click={onEndTurn} disabled={!myTurn}>End turn</button>
      </div>
    </div>
  </section>

  <section class="hand">
    {#each me.hand as card, i (i + card.id)}
      <div
        class="hand-slot"
        class:playable={myTurn && canPlayCard(state, 'player', i)}
        role="button"
        tabindex="0"
        on:click={() => onHandCard(i)}
        on:keydown={(e) => e.key === 'Enter' && onHandCard(i)}
      >
        <CardPreview {card} />
      </div>
    {:else}
      <p class="empty">hand empty</p>
    {/each}
  </section>

  <details class="log">
    <summary>Match log</summary>
    <ol>
      {#each [...state.log].reverse() as line}
        <li>{line}</li>
      {/each}
    </ol>
  </details>

  {#if state.winner}
    <div class="overlay">
      <div class="result">
        <h2>
          {state.winner === 'player' ? 'You win' : state.winner === 'ai' ? 'You lose' : 'Draw'}
        </h2>
        <button on:click={restart}>Play again</button>
      </div>
    </div>
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    background: #0f0f23;
    color: #e5e7eb;
    font-family: system-ui, sans-serif;
  }

  main {
    max-width: 1100px;
    margin: 0 auto;
    padding: 16px;
  }

  header { text-align: center; margin-bottom: 8px; }
  h1 { margin: 0; font-size: 24px; }
  .tagline { margin: 2px 0 0; color: #8b8bb0; font-size: 13px; }

  .table {
    background: #16162e;
    border: 1px solid #2a2a4a;
    border-radius: 12px;
    padding: 12px;
  }

  .side { display: flex; flex-direction: column; gap: 8px; }

  .hero-row {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 110px;
    padding: 8px 14px;
    border-radius: 10px;
    border: 2px solid #3f3f6b;
    background: #1e1e3c;
    color: inherit;
    font-family: inherit;
  }

  .hero.enemy.targetable {
    border-color: #f87171;
    cursor: crosshair;
    box-shadow: 0 0 12px rgba(248, 113, 113, 0.6);
  }

  .hero-label { font-size: 11px; color: #9ca3cf; }
  .hp { font-size: 22px; font-weight: bold; color: #f87171; }
  .hp small { font-size: 12px; color: #6b7280; font-weight: normal; }

  .meta {
    display: flex;
    gap: 12px;
    font-size: 12px;
    color: #9ca3cf;
  }
  .meta .mana { color: #a5b4fc; font-weight: 600; }

  .board {
    display: flex;
    gap: 8px;
    min-height: 108px;
    align-items: center;
    padding: 4px;
    background: #12122a;
    border-radius: 8px;
    overflow-x: auto;
  }

  .divider {
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 6px 0;
    border-top: 1px dashed #2a2a4a;
    font-size: 12px;
  }
  .thinking { color: #fbbf24; }
  .prompt { color: #6ee7b7; }

  .empty { color: #3f3f6b; font-size: 12px; margin: 0 8px; }

  .end-turn {
    margin-left: auto;
    padding: 10px 18px;
    border-radius: 8px;
    border: none;
    background: #4f46e5;
    color: white;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
  }
  .end-turn:disabled { background: #2a2a4a; color: #6b7280; cursor: default; }

  .hand {
    display: flex;
    gap: 4px;
    padding: 8px 4px 4px;
    overflow-x: auto;
    min-height: 176px;
  }

  /* CardPreview renders at a fixed 180x244; shrink it so the board and hand
     share one screen. min-width:0 stops the flex item floring at that width. */
  .hand-slot {
    flex: 0 0 132px;
    min-width: 0;
    height: 172px;
    opacity: 0.5;
    transition: opacity 0.12s, transform 0.12s;
  }
  .hand-slot :global(.card) {
    transform: scale(0.72);
    transform-origin: top left;
  }
  .hand-slot.playable { opacity: 1; }
  .hand-slot.playable:hover { transform: translateY(-6px); }

  .log {
    margin-top: 6px;
    font-size: 12px;
    color: #9ca3cf;
  }
  .log summary { cursor: pointer; }
  .log ol {
    max-height: 180px;
    overflow-y: auto;
    padding-left: 20px;
    margin: 8px 0 0;
  }

  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 15, 35, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .result {
    background: #1e1e3c;
    border: 1px solid #3f3f6b;
    border-radius: 12px;
    padding: 32px 48px;
    text-align: center;
  }
  .result h2 { margin: 0 0 16px; font-size: 28px; }
  .result button {
    padding: 10px 24px;
    border-radius: 8px;
    border: none;
    background: #4f46e5;
    color: white;
    font-size: 15px;
    cursor: pointer;
  }
</style>
