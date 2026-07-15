<script lang="ts">
  import type { Card } from '../../types/cards';

  export let card: Card;

  $: isMinion = card.type === 'Minion';
</script>

<div class="card {card.rarity.toLowerCase()}">
  <div class="cost">{card.cost}</div>
  <div class="name">{card.name}</div>

  {#if card.art}
    {#if card.art.type === 'image'}
      <div class="art-image" style="background-image: url({card.art.value})"></div>
    {:else}
      <div class="art-css" class:{card.art.value}></div>
    {/if}
  {:else}
    <div class="art-placeholder">?</div>
  {/if}

  <div class="description">{card.description}</div>

  {#if card.keywords.length > 0}
    <div class="keywords">
      {#each card.keywords as keyword}
        <span class="keyword">{keyword}</span>
      {/each}
    </div>
  {/if}

  {#if isMinion}
    <div class="stats">
      <span class="attack">{card.attack}</span>
      <span class="health">{card.health}</span>
    </div>
  {/if}

  <div class="rarity-badge">{card.rarity}</div>
</div>

<style>
  .card {
    width: 160px;
    height: 240px;
    border: 2px solid #555;
    border-radius: 8px;
    background: #1a1a2e;
    color: #eee;
    position: relative;
    padding: 8px;
    display: flex;
    flex-direction: column;
    font-family: sans-serif;
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s;
  }

  .card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 16px rgba(0,0,0,0.4);
  }

  .card.legendary { border-color: #ff8c00; }
  .card.epic { border-color: #a855f7; }
  .card.rare { border-color: #3b82f6; }
  .card.uncommon { border-color: #22c55e; }

  .cost {
    position: absolute;
    top: -6px;
    left: -6px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #4f46e5;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 14px;
    border: 2px solid #818cf8;
  }

  .name {
    font-size: 12px;
    font-weight: bold;
    text-align: center;
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .art-image, .art-css, .art-placeholder {
    flex: 1;
    background: #0f0f23;
    border-radius: 4px;
    margin: 4px 0;
    min-height: 60px;
  }

  .art-image { background-size: cover; background-position: center; }
  .art-placeholder { display: flex; align-items: center; justify-content: center; font-size: 24px; color: #333; }

  .description {
    font-size: 10px;
    line-height: 1.3;
    flex-shrink: 0;
    max-height: 48px;
    overflow: hidden;
  }

  .keywords {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    margin-top: 4px;
  }

  .keyword {
    font-size: 9px;
    background: #333;
    padding: 1px 4px;
    border-radius: 3px;
  }

  .stats {
    position: absolute;
    bottom: 6px;
    right: 8px;
    display: flex;
    gap: 6px;
    font-weight: bold;
    font-size: 14px;
  }

  .attack { color: #fbbf24; }
  .health { color: #34d399; }

  .rarity-badge {
    position: absolute;
    bottom: 6px;
    left: 8px;
    font-size: 9px;
    color: #666;
  }
</style>
