<script lang="ts">
  import type { MinionInstance } from '../engine/state';

  export let minion: MinionInstance;
  export let ready = false;
  export let selected = false;
  export let targetable = false;
</script>

<button
  class="minion"
  class:ready
  class:selected
  class:targetable
  class:shielded={minion.divineShield}
  on:click
  title={minion.card.description}
>
  <span class="name">{minion.card.name}</span>

  {#if minion.keywords.length > 0}
    <span class="keywords">
      {#each minion.keywords as keyword}
        <span class="keyword">{keyword}</span>
      {/each}
    </span>
  {/if}

  <span class="stats">
    <span class="attack">{minion.attack}</span>
    <span class="health" class:hurt={minion.health < minion.maxHealth}>{minion.health}</span>
  </span>
</button>

<style>
  .minion {
    width: 96px;
    height: 116px;
    border: 2px solid #444;
    border-radius: 8px;
    background: #232346;
    color: #eee;
    font-family: inherit;
    padding: 6px 4px 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    cursor: default;
    transition: transform 0.12s, box-shadow 0.12s, border-color 0.12s;
  }

  .minion.ready {
    border-color: #34d399;
    cursor: pointer;
    box-shadow: 0 0 8px rgba(52, 211, 153, 0.4);
  }

  .minion.selected {
    border-color: #fbbf24;
    transform: translateY(-6px);
    box-shadow: 0 0 12px rgba(251, 191, 36, 0.7);
  }

  .minion.targetable {
    border-color: #f87171;
    cursor: crosshair;
    box-shadow: 0 0 10px rgba(248, 113, 113, 0.6);
  }

  .minion.shielded {
    outline: 2px solid #fde68a;
    outline-offset: 1px;
  }

  .name {
    font-size: 10px;
    font-weight: 600;
    line-height: 1.2;
    text-align: center;
    overflow: hidden;
  }

  .keywords {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    justify-content: center;
  }

  .keyword {
    font-size: 8px;
    background: #3b3b6d;
    padding: 1px 3px;
    border-radius: 3px;
  }

  .stats {
    display: flex;
    justify-content: space-between;
    width: 100%;
    padding: 0 4px;
    font-weight: bold;
    font-size: 15px;
  }

  .attack { color: #fbbf24; }
  .health { color: #34d399; }
  .health.hurt { color: #f87171; }
</style>
