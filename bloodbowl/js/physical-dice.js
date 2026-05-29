'use strict';

/* ═══════════════════════════════════════════════════════
   Blood Bowl Companion — js/physical-dice.js
   Physical dice button grid component.
   Used by panels.js and wizards.js.
   ═══════════════════════════════════════════════════════ */

/**
 * Renders a grid of tappable result buttons into a container.
 *
 * config = {
 *   buttons : [{ value, label, cls? }]
 *   columns : grid column count (default 4)
 *   onSelect: fn(value, btnObj)
 * }
 */
function showPhysicalButtons(container, config) {
  container.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'phys-grid';
  grid.style.setProperty('--phys-cols', config.columns ?? 4);

  config.buttons.forEach(b => {
    const btn = document.createElement('button');
    btn.type          = 'button';
    btn.className     = `phys-btn${b.cls ? ' ' + b.cls : ''}`;
    btn.dataset.value = String(b.value);

    const valEl = document.createElement('span');
    valEl.className   = 'phys-val';
    valEl.textContent = String(b.value);
    btn.appendChild(valEl);

    if (b.label) {
      const lblEl = document.createElement('span');
      lblEl.className   = 'phys-label';
      lblEl.textContent = b.label;
      btn.appendChild(lblEl);
    }

    btn.addEventListener('click', () => {
      grid.querySelectorAll('.phys-btn.selected').forEach(el => el.classList.remove('selected'));
      btn.classList.add('selected');
      config.onSelect(b.value, b);
    });

    grid.appendChild(btn);
  });

  container.appendChild(grid);
}

/**
 * Renders an 8-direction compass (3×3 grid, centre empty) for D8 direction picks.
 * Directions match Throw-In template: 1=↖ 2=↑ 3=↗ 4=← 5=→ 6=↙ 7=↓ 8=↘
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
  const grid = document.createElement('div');
  grid.className = 'phys-compass-grid';

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
      grid.querySelectorAll('.phys-btn.selected').forEach(el => el.classList.remove('selected'));
      btn.classList.add('selected');
      onSelect(cell.value);
    });
    grid.appendChild(btn);
  });

  container.appendChild(grid);
}

window.PhysicalDice = { showPhysicalButtons, showCompassButtons };
