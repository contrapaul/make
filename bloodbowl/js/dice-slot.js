'use strict';

/* ═══════════════════════════════════════════════════════
   Blood Bowl Companion — js/dice-slot.js
   Shared physical-dice entry slots for wizard roll points.

   Each wizard keeps its own digital dice animation; when the
   wizard's dice mode is 'physical' it calls these helpers
   instead. Each helper renders a two-tap entry grid (via
   PhysicalDice) into the same host area the digital dice
   occupy, returns a Promise of the entered value(s), and
   removes itself — so wizard logic downstream is identical
   in both modes.

   Depends on: physical-dice.js, settings.js
   ═══════════════════════════════════════════════════════ */

(function () {

  function mode(wizardKey) {
    return window.BBSettings?.getWizardDiceMode(wizardKey) ?? 'digital';
  }
  function isPhysical(wizardKey) { return mode(wizardKey) === 'physical'; }

  /* Render a self-removing physical entry zone into `host`.
     Resolves with the chosen value. */
  function ask(host, { title = '', buttons, columns = 6, compass = false } = {}) {
    return new Promise(resolve => {
      const zone = document.createElement('div');
      zone.className = 'physical-zone dice-slot-zone';
      if (title) {
        const t = document.createElement('div');
        t.className = 'phys-zone-title';
        t.textContent = title;
        zone.appendChild(t);
      }
      const gridHost = document.createElement('div');
      zone.appendChild(gridHost);
      host.appendChild(zone);

      const done = v => { zone.remove(); resolve(v); };
      if (compass) window.PhysicalDice.showCompassButtons(gridHost, done);
      else window.PhysicalDice.showPhysicalButtons(gridHost, { buttons, columns, onSelect: done });
    });
  }

  /* ── Single D6 (1–6) ── */
  function d6(host, title = 'Enter your D6 roll') {
    return ask(host, {
      title,
      buttons: [1, 2, 3, 4, 5, 6].map(v => ({ value: v })),
      columns: 6,
    });
  }

  /* ── 2D6 sum (2–12). Returns [d1, d2] so callers keep their shape. ── */
  async function twoD6(host, title = 'Enter your 2D6 total') {
    const total = await ask(host, {
      buttons: Array.from({ length: 11 }, (_, i) => ({ value: i + 2 })),
      columns: 6,
      title,
    });
    const d1 = Math.ceil(total / 2);
    return [d1, total - d1];
  }

  /* ── D8 (1–8) ── */
  function d8(host, title = 'Enter your D8 roll') {
    return ask(host, {
      title,
      buttons: Array.from({ length: 8 }, (_, i) => ({ value: i + 1 })),
      columns: 4,
    });
  }

  /* ── D16 (1–16) — casualty table ── */
  function d16(host, title = 'Enter your D16 casualty roll') {
    return ask(host, {
      title,
      buttons: Array.from({ length: 16 }, (_, i) => ({ value: i + 1 })),
      columns: 8,
    });
  }

  /* ── D8 direction compass ── */
  function direction(host, title = 'Enter the scatter direction') {
    return ask(host, { title, compass: true });
  }

  /* ── Block dice: enter `count` rolled block dice, one at a time.
     Resolves with an array of face indices (1–6, matching BLOCK_FACES).
     Push occupies faces 3 & 4 — one button covers both. ── */
  async function blockFaces(host, count) {
    const FACES = [
      { value: 1, sym: 'K', label: 'Attacker Down' },
      { value: 2, sym: 'N', label: 'Both Down' },
      { value: 3, sym: 'J', label: 'Push' },
      { value: 5, sym: 'M', label: 'Stumble' },
      { value: 6, sym: 'L', label: 'Defender Down' },
    ];
    const rolls = [];
    for (let i = 0; i < count; i++) {
      const v = await ask(host, {
        title: count > 1 ? `Enter block die ${i + 1} of ${count}` : 'Enter your block die',
        buttons: FACES.map(f => ({ value: f.value, display: f.sym, label: f.label, cls: 'phys-block-btn' })),
        columns: 5,
      });
      rolls.push(v);
    }
    return rolls;
  }

  window.DiceSlot = { mode, isPhysical, ask, d6, twoD6, d8, d16, direction, blockFaces };
})();
