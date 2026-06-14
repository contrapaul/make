'use strict';

/* ═══════════════════════════════════════════════════════
   Blood Bowl Companion — js/game-page.js
   Controller for the dedicated game page (/game).
   Reconstructs the matchup handed off from the lobby
   (localStorage 'bb:activeMatch'), restores any in-progress
   state, and boots play. The intro overlay (G2) and full
   turn/sequence engine (G3) layer on top of this.

   NOTE: page uses <base href="../">, so anchor hrefs resolve
   from the bloodbowl root, but the location API does NOT —
   use page-relative '../' to return to the lobby.
   ═══════════════════════════════════════════════════════ */

(function () {

  function readMatch() {
    try { return JSON.parse(localStorage.getItem('bb:activeMatch') || 'null'); }
    catch { return null; }
  }

  /* Resolve once script.js has fetched team/skill data. */
  function whenAppReady() {
    return new Promise(resolve => {
      if (window.__bbAppReady) return resolve();
      document.addEventListener('bb:appReady', () => resolve(), { once: true });
    });
  }

  async function boot() {
    const match = readMatch();
    if (!match || !match.home || !match.away) {
      /* No active match — return to the lobby to pick teams. */
      location.replace('../');
      return;
    }

    await whenAppReady();
    if (match.gameMode) window.BBSettings?.setGameMode?.(match.gameMode);

    /* Reconstruct both sides (default → loadTeam; custom → TeamBuilder.loadIntoGame). */
    try {
      await window.reconstructSide?.('left',  match.home);
      await window.reconstructSide?.('right', match.away);
    } catch (err) {
      console.error('[BB] Failed to reconstruct match:', err);
    }

    /* Restore in-progress match globals (scores/kicking/turn/log/phase/half).
       Per-side conditions rehydrate automatically via watchRosters(). */
    window.rehydrateGlobals?.();

    wireTurnButton();
    document.body.classList.add('bb-game-ready');
    window.BBGameTimeline?.render?.();
  }

  /* G1 placeholder: the contextual button opens the start-of-half wizard.
     The full "End [Team] Turn #N" sequence engine is added in G3. */
  function wireTurnButton() {
    const btn = document.getElementById('gb-turn-btn');
    if (!btn) return;
    btn.addEventListener('click', () => window.DriveWizard?.open?.('half-start'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
