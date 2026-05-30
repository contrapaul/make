'use strict';

/* ═══════════════════════════════════════════════════════
   Blood Bowl Companion — js/pitch.js
   PitchGrid: 13×13 pass-distance selector.

   Chebyshev distance from thrower determines range zone:
     1–3   Quick Pass  (mod 0)
     4–6   Short Pass  (mod −1)
     7–10  Long Pass   (mod −1)
     11+   Long Bomb   (mod −2)

   Public API:
     setThrower(col, row)   — place thrower token (1-indexed)
     setCatcher(col, row)   — place catcher token
     clear()                — remove catcher token
     setBlizzard(active)    — overlay ✕ on Long/Bomb squares
     getDistance()          — Chebyshev distance (null if no catcher)
     getRange()             — { label, shortLabel, mod, cls, dist } or null
     onCatcherSelect        — fn(distance, rangeObj) called after each tap
   ═══════════════════════════════════════════════════════ */

class PitchGrid {
  constructor(container) {
    this.container   = container;
    this.COLS        = 13;
    this.ROWS        = 13;
    this.throwerPos  = { col: 7, row: 7 };  /* default: centre */
    this.catcherPos  = null;
    this._blizzard   = false;
    this._mode       = 'catcher';  /* 'thrower' | 'catcher' */
    this._cells      = [];
    this._gridEl     = null;
    this._svgEl      = null;
    this._modeBtns   = null;
    this.onCatcherSelect = null;
    this._build();
  }

  /* ── Public API ── */

  setThrower(col, row) {
    this.throwerPos = { col: Math.max(1, Math.min(this.COLS, col)),
                        row: Math.max(1, Math.min(this.ROWS, row)) };
    this.catcherPos = null;
    this._render();
  }

  setPlacementMode(mode) {
    this._mode = mode === 'thrower' ? 'thrower' : 'catcher';
    this._updateModeBtns();
  }

  setCatcher(col, row) {
    this.catcherPos = { col: Math.max(1, Math.min(this.COLS, col)),
                        row: Math.max(1, Math.min(this.ROWS, row)) };
    this._render();
    this.onCatcherSelect?.(this.getDistance(), this.getRange());
  }

  clear() {
    this.catcherPos = null;
    this._render();
  }

  setBlizzard(active) {
    this._blizzard = !!active;
    this._render();
  }

  getDistance() {
    if (!this.throwerPos || !this.catcherPos) return null;
    return Math.max(
      Math.abs(this.catcherPos.col - this.throwerPos.col),
      Math.abs(this.catcherPos.row - this.throwerPos.row)
    );
  }

  getRange() {
    return this._rangeForDist(this.getDistance());
  }

  /* ── Private ── */

  _rangeForDist(dist) {
    if (dist === null || dist === 0) return null;
    if (dist <= 3)  return { label: 'Quick Pass', shortLabel: 'Quick', mod:  0, cls: 'range-quick', dist };
    if (dist <= 6)  return { label: 'Short Pass', shortLabel: 'Short', mod: -1, cls: 'range-short', dist };
    if (dist <= 10) return { label: 'Long Pass',  shortLabel: 'Long',  mod: -1, cls: 'range-long',  dist };
    return               { label: 'Long Bomb',   shortLabel: 'Bomb',  mod: -2, cls: 'range-bomb',  dist };
  }

  _distFromThrower(col, row) {
    if (!this.throwerPos) return Infinity;
    return Math.max(
      Math.abs(col - this.throwerPos.col),
      Math.abs(row - this.throwerPos.row)
    );
  }

  /* Euclidean radius cutoff for pixelated-circle zone shape.
     Cells whose Euclidean distance exceeds this are corner-trimmed. */
  _circularCutoff(chebyshevDist) {
    if (chebyshevDist <= 3)  return 3.5;   /* Quick: trims 3 cells per corner */
    if (chebyshevDist <= 6)  return 6.8;   /* Short: trims ~6 cells per corner */
    if (chebyshevDist <= 10) return 10.8;  /* Long: more rounded */
    return 14.5;                            /* Bomb: generous (grid is small) */
  }

  _updateModeBtns() {
    if (!this._modeBtns) return;
    const [tBtn, cBtn] = this._modeBtns;
    tBtn.classList.toggle('active', this._mode === 'thrower');
    cBtn.classList.toggle('active', this._mode === 'catcher');
  }

  _build() {
    this.container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'pitch-wrap';

    /* Mode toggle row */
    const modeRow = document.createElement('div');
    modeRow.className = 'pitch-mode-row';
    const tBtn = document.createElement('button');
    const cBtn = document.createElement('button');
    tBtn.type = cBtn.type = 'button';
    tBtn.className = 'pitch-mode-btn' + (this._mode === 'thrower' ? ' active' : '');
    cBtn.className = 'pitch-mode-btn' + (this._mode === 'catcher' ? ' active' : '');
    tBtn.textContent = '🏃 Move Thrower';
    cBtn.textContent = '🎯 Move Catcher';
    tBtn.addEventListener('click', () => this.setPlacementMode('thrower'));
    cBtn.addEventListener('click', () => this.setPlacementMode('catcher'));
    this._modeBtns = [tBtn, cBtn];
    modeRow.appendChild(tBtn);
    modeRow.appendChild(cBtn);
    this.container.appendChild(modeRow);

    /* Grid */
    this._gridEl = document.createElement('div');
    this._gridEl.className = 'pitch-grid';

    /* SVG overlay for the pass line */
    this._svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this._svgEl.classList.add('pitch-svg');
    this._svgEl.setAttribute('aria-hidden', 'true');

    /* Build cells */
    this._cells = [];
    for (let r = 1; r <= this.ROWS; r++) {
      for (let c = 1; c <= this.COLS; c++) {
        const cell = document.createElement('div');
        cell.className = 'pitch-cell';
        cell.dataset.col = c;
        cell.dataset.row = r;
        cell.addEventListener('click', () => this._onCellClick(c, r));
        this._gridEl.appendChild(cell);
        this._cells.push({ el: cell, col: c, row: r });
      }
    }

    wrap.appendChild(this._gridEl);
    wrap.appendChild(this._svgEl);
    this.container.appendChild(wrap);

    /* Legend */
    const legend = document.createElement('div');
    legend.className = 'pitch-legend';
    legend.innerHTML = `
      <span class="pitch-legend-item"><span class="pitch-legend-swatch swatch-quick"></span>Quick (1–3)</span>
      <span class="pitch-legend-item"><span class="pitch-legend-swatch swatch-short"></span>Short (4–6, −1)</span>
      <span class="pitch-legend-item"><span class="pitch-legend-swatch swatch-long"></span>Long (7–10, −1)</span>
      <span class="pitch-legend-item"><span class="pitch-legend-swatch swatch-bomb"></span>Bomb (11+, −2)</span>
    `;
    this.container.appendChild(legend);

    this._render();
  }

  _onCellClick(col, row) {
    if (this._mode === 'thrower') {
      this.throwerPos = { col, row };
      this.catcherPos = null;
      this._render();
      this.onCatcherSelect?.(null, null);
    } else {
      /* Can't select the thrower's own square */
      if (this.throwerPos && col === this.throwerPos.col && row === this.throwerPos.row) return;
      this.catcherPos = { col, row };
      this._render();
      this.onCatcherSelect?.(this.getDistance(), this.getRange());
    }
  }

  _render() {
    const t = this.throwerPos;
    const c = this.catcherPos;

    this._cells.forEach(({ el, col, row }) => {
      el.className = 'pitch-cell';
      el.innerHTML = '';

      const dist = this._distFromThrower(col, row);
      if (dist === 0) {
        el.classList.add('range-thrower-cell');
      } else {
        const rng = this._rangeForDist(dist);
        if (rng) {
          /* Circular zone mask: trim corners using Euclidean distance */
          const dx = col - (this.throwerPos?.col ?? 7);
          const dy = row - (this.throwerPos?.row ?? 7);
          const euclidean = Math.sqrt(dx * dx + dy * dy);
          if (euclidean <= this._circularCutoff(dist)) {
            el.classList.add(rng.cls);
            if (this._blizzard && (rng.cls === 'range-long' || rng.cls === 'range-bomb')) {
              el.classList.add('blizzard-blocked');
            }
          }
        }
      }

      const isThrower = t && col === t.col && row === t.row;
      const isCatcher = c && col === c.col && row === c.row;

      if (isThrower) {
        el.classList.add('is-thrower');
        const tok = document.createElement('div');
        tok.className = 'pitch-token pitch-token-thrower';
        el.appendChild(tok);
      } else if (isCatcher) {
        el.classList.add('is-catcher');
        const tok = document.createElement('div');
        tok.className = 'pitch-token pitch-token-catcher';
        el.appendChild(tok);
      }
    });

    this._renderLine();
  }

  _renderLine() {
    this._svgEl.innerHTML = '';
    if (!this.throwerPos || !this.catcherPos) return;

    const tEl = this._gridEl.querySelector(
      `[data-col="${this.throwerPos.col}"][data-row="${this.throwerPos.row}"]`
    );
    const cEl = this._gridEl.querySelector(
      `[data-col="${this.catcherPos.col}"][data-row="${this.catcherPos.row}"]`
    );
    if (!tEl || !cEl) return;

    const gridRect = this._gridEl.getBoundingClientRect();
    const tRect    = tEl.getBoundingClientRect();
    const cRect    = cEl.getBoundingClientRect();

    const x1 = tRect.left + tRect.width  / 2 - gridRect.left;
    const y1 = tRect.top  + tRect.height / 2 - gridRect.top;
    const x2 = cRect.left + cRect.width  / 2 - gridRect.left;
    const y2 = cRect.top  + cRect.height / 2 - gridRect.top;

    this._svgEl.setAttribute('width',  gridRect.width);
    this._svgEl.setAttribute('height', gridRect.height);
    this._svgEl.style.width  = gridRect.width  + 'px';
    this._svgEl.style.height = gridRect.height + 'px';

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1); line.setAttribute('y1', y1);
    line.setAttribute('x2', x2); line.setAttribute('y2', y2);
    line.setAttribute('stroke', 'rgba(212, 175, 55, 0.75)');
    line.setAttribute('stroke-width', '1.5');
    line.setAttribute('stroke-dasharray', '4 3');
    this._svgEl.appendChild(line);
  }
}

window.PitchGrid = PitchGrid;
