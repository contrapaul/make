'use strict';

/* ═══════════════════════════════════════════════════════
   Blood Bowl Companion — js/game-timeline.js
   Full-width game timeline: turn segments + clickable event
   markers (touchdowns, injuries, fumbles, sendings-off…).
   G1 stub — real rendering lands in G4. Exposes a stable
   window.BBGameTimeline.render() the game page already calls.
   ═══════════════════════════════════════════════════════ */

(function () {
  function render() {
    const host = document.getElementById('bb-game-timeline');
    if (!host) return;
    /* Placeholder until G4 builds the turn/event timeline. */
    host.innerHTML = '<div class="bb-tl-placeholder">Game timeline</div>';
  }

  document.addEventListener('bb:gameEvent', render);
  document.addEventListener('bb:turnEnd', render);
  document.addEventListener('bb:phase', render);

  window.BBGameTimeline = { render };
})();
