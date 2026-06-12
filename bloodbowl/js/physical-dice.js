'use strict';

/* ═══════════════════════════════════════════════════════
   Blood Bowl Companion — js/physical-dice.js
   Physical dice button grid component.
   Used by panels.js and wizards.js.

   Two-tap confirmation flow:
     1st tap → highlights button gold, shows lock-in bar
     2nd tap on same button OR "✓ Confirm" → fires onSelect
     "✕ Cancel" → deselects, hides bar
   ═══════════════════════════════════════════════════════ */

/**
 * Renders a grid of tappable result buttons into a container.
 * Requires two taps (or tap + Confirm) to fire onSelect.
 *
 * config = {
 *   buttons : [{ value, label, cls? }]
 *   columns : grid column count (default 4)
 *   onSelect: fn(value, btnObj)
 * }
 */
function showPhysicalButtons(container, config) {
  container.innerHTML = '';

  /* Lock-in bar — sits above the grid */
  const lockBar = document.createElement('div');
  lockBar.className = 'physical-lock-bar';
  lockBar.setAttribute('hidden', '');

  const plbLabel   = document.createElement('span');
  plbLabel.className = 'plb-label';
  plbLabel.textContent = 'Lock in: —';

  const plbConfirm = document.createElement('button');
  plbConfirm.type      = 'button';
  plbConfirm.className = 'plb-confirm';
  plbConfirm.textContent = '✓ Confirm';

  const plbCancel  = document.createElement('button');
  plbCancel.type      = 'button';
  plbCancel.className = 'plb-cancel';
  plbCancel.textContent = '✕ Cancel';

  lockBar.appendChild(plbLabel);
  lockBar.appendChild(plbConfirm);
  lockBar.appendChild(plbCancel);
  container.appendChild(lockBar);

  /* Grid */
  const grid = document.createElement('div');
  grid.className = 'phys-grid';
  grid.style.setProperty('--phys-cols', config.columns ?? 4);

  let pendingBtn = null;
  let pendingValue = null;

  function confirmSelection() {
    if (pendingValue === null) return;
    const val = pendingValue;
    const btn = pendingBtn;
    pendingBtn   = null;
    pendingValue = null;
    lockBar.setAttribute('hidden', '');
    if (btn) btn.classList.add('confirmed');
    config.onSelect(val, config.buttons.find(b => String(b.value) === String(val)));
  }

  function cancelSelection() {
    if (pendingBtn) pendingBtn.classList.remove('selected');
    pendingBtn   = null;
    pendingValue = null;
    lockBar.setAttribute('hidden', '');
  }

  plbConfirm.addEventListener('click', confirmSelection);
  plbCancel.addEventListener('click', cancelSelection);

  config.buttons.forEach(b => {
    const btn = document.createElement('button');
    btn.type          = 'button';
    btn.className     = `phys-btn${b.cls ? ' ' + b.cls : ''}`;
    btn.dataset.value = String(b.value);

    const valEl = document.createElement('span');
    valEl.className   = 'phys-val';
    valEl.textContent = b.display ?? String(b.value);
    btn.appendChild(valEl);

    if (b.label) {
      const lblEl = document.createElement('span');
      lblEl.className   = 'phys-label';
      lblEl.textContent = b.label;
      btn.appendChild(lblEl);
    }

    btn.addEventListener('click', () => {
      const isSameBtn = (btn === pendingBtn);

      /* Clear previous selection */
      grid.querySelectorAll('.phys-btn.selected').forEach(el => el.classList.remove('selected'));

      if (isSameBtn) {
        /* Second tap on same button = confirm */
        pendingBtn   = null;
        pendingValue = null;
        lockBar.setAttribute('hidden', '');
        btn.classList.add('confirmed');
        config.onSelect(b.value, b);
      } else {
        /* First tap = select */
        pendingBtn   = btn;
        pendingValue = b.value;
        btn.classList.add('selected');
        plbLabel.textContent = `Lock in: ${b.label || b.value}`;
        lockBar.removeAttribute('hidden');
      }
    });

    grid.appendChild(btn);
  });

  container.appendChild(grid);
}

/**
 * Renders an 8-direction compass (3×3 grid, centre empty) for D8 direction picks.
 * Directions match Throw-In template: 1=↖ 2=↑ 3=↗ 4=← 5=→ 6=↙ 7=↓ 8=↘
 * Also uses two-tap confirmation.
 *
 * @param {HTMLElement} container
 * @param {Function}    onSelect  fn(directionValue 1–8)
 */
function showCompassButtons(container, onSelect) {
  const LAYOUT = [
    { value: 1, sym: '↖', label: 'Up-Left'   },
    { value: 2, sym: '↑', label: 'Up'         },
    { value: 3, sym: '↗', label: 'Up-Right'   },
    { value: 4, sym: '←', label: 'Left'       },
    null,                                        /* centre — empty */
    { value: 5, sym: '→', label: 'Right'      },
    { value: 6, sym: '↙', label: 'Down-Left'  },
    { value: 7, sym: '↓', label: 'Down'       },
    { value: 8, sym: '↘', label: 'Down-Right' },
  ];

  container.innerHTML = '';

  /* Lock-in bar */
  const lockBar = document.createElement('div');
  lockBar.className = 'physical-lock-bar';
  lockBar.setAttribute('hidden', '');

  const plbLabel   = document.createElement('span');
  plbLabel.className = 'plb-label';
  plbLabel.textContent = 'Lock in: —';

  const plbConfirm = document.createElement('button');
  plbConfirm.type      = 'button';
  plbConfirm.className = 'plb-confirm';
  plbConfirm.textContent = '✓ Confirm';

  const plbCancel  = document.createElement('button');
  plbCancel.type      = 'button';
  plbCancel.className = 'plb-cancel';
  plbCancel.textContent = '✕ Cancel';

  lockBar.appendChild(plbLabel);
  lockBar.appendChild(plbConfirm);
  lockBar.appendChild(plbCancel);
  container.appendChild(lockBar);

  const grid = document.createElement('div');
  grid.className = 'phys-compass-grid';

  let pendingBtn   = null;
  let pendingValue = null;

  function confirmSelection() {
    if (pendingValue === null) return;
    const val = pendingValue;
    const btn = pendingBtn;
    pendingBtn   = null;
    pendingValue = null;
    lockBar.setAttribute('hidden', '');
    if (btn) btn.classList.add('confirmed');
    onSelect(val);
  }

  function cancelSelection() {
    if (pendingBtn) pendingBtn.classList.remove('selected');
    pendingBtn   = null;
    pendingValue = null;
    lockBar.setAttribute('hidden', '');
  }

  plbConfirm.addEventListener('click', confirmSelection);
  plbCancel.addEventListener('click', cancelSelection);

  LAYOUT.forEach(cell => {
    if (!cell) {
      const ctr = document.createElement('div');
      ctr.className   = 'phys-compass-centre';
      ctr.textContent = '📍';
      grid.appendChild(ctr);
      return;
    }

    const btn = document.createElement('button');
    btn.type          = 'button';
    btn.className     = 'phys-btn phys-compass-btn';
    btn.dataset.value = cell.value;
    btn.title         = cell.label;
    btn.innerHTML     = `<span class="phys-val">${cell.sym}</span>`;

    btn.addEventListener('click', () => {
      const isSameBtn = (btn === pendingBtn);
      grid.querySelectorAll('.phys-btn.selected').forEach(el => el.classList.remove('selected'));

      if (isSameBtn) {
        pendingBtn   = null;
        pendingValue = null;
        lockBar.setAttribute('hidden', '');
        btn.classList.add('confirmed');
        onSelect(cell.value);
      } else {
        pendingBtn   = btn;
        pendingValue = cell.value;
        btn.classList.add('selected');
        plbLabel.textContent = `Lock in: ${cell.label} (${cell.sym})`;
        lockBar.removeAttribute('hidden');
      }
    });

    grid.appendChild(btn);
  });

  container.appendChild(grid);
}

window.PhysicalDice = { showPhysicalButtons, showCompassButtons };
