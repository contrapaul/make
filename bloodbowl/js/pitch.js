'use strict';

/* ═══════════════════════════════════════════════════════
   Blood Bowl Companion — js/pitch.js
   PitchGrid: 13×13 pass-distance selector with multi-catcher
   support and scatter-path visualization.

   Chebyshev distance from thrower determines range zone:
     1–3   Quick Pass  (mod 0)
     4–6   Short Pass  (mod −1)
     7–10  Long Pass   (mod −1)
     11+   Long Bomb   (mod −2)

   Zones are circular (Euclidean cutoff per band).

   Public API:
     setThrower(col, row)         — place thrower token (1-indexed)
     getActiveCatcher()           — {col,row,id} or null
     getDistance()                — Chebyshev from thrower to active catcher
     getRange()                   — {label,shortLabel,mod,cls,dist} or null
     clear()                      — remove all catchers
     setBlizzard(active)          — overlay ✕ on Long/Bomb squares
     showScatterPath(pos, dirs)   — overlay scatter path on grid
     clearScatter()               — remove scatter overlay
     onCatcherSelect              — fn(distance, rangeObj) on active-catcher change
   ═══════════════════════════════════════════════════════ */

/* D8 direction → [dcol, drow] */
const DIR_VECTORS = {
  1: [-1, -1], 2: [0, -1], 3: [1, -1],
  4: [-1,  0],             5: [1,  0],
  6: [-1,  1], 7: [0,  1], 8: [1,  1],
};

class PitchGrid {
  constructor(container) {
    this.container        = container;
    this.COLS             = 13;
    this.ROWS             = 13;
    this.throwerPos       = { col: 7, row: 7 };
    this._catchers        = [];   /* [{col, row, id}] — persists across taps */
    this._activeCatcherId = null;
    this._nextCatcherId   = 1;
    this._movingThrower   = false;
    this._blizzard        = false;
    this._scatterTarget   = null;
    this._scatterDirs     = [];
    this._cells           = [];
    this._gridEl          = null;
    this._svgEl           = null;
    this.onCatcherSelect  = null;
    this._build();
  }

  /* ── Public API ── */

  setThrower(col, row) {
    this.throwerPos       = { col: Math.max(1, Math.min(this.COLS, col)),
                              row: Math.max(1, Math.min(this.ROWS, row)) };
    this._catchers        = [];
    this._activeCatcherId = null;
    this._movingThrower   = false;
    this._render();
  }

  getActiveCatcher() {
    if (this._activeCatcherId === null) return null;
    return this._catchers.find(c => c.id === this._activeCatcherId) ?? null;
  }

  getDistance() {
    const ac = this.getActiveCatcher();
    if (!this.throwerPos || !ac) return null;
    return Math.max(
      Math.abs(ac.col - this.throwerPos.col),
      Math.abs(ac.row - this.throwerPos.row)
    );
  }

  getRange() {
    return this._rangeForDist(this.getDistance());
  }

  clear() {
    this._catchers        = [];
    this._activeCatcherId = null;
    this._movingThrower   = false;
    this._render();
  }

  setBlizzard(active) {
    this._blizzard = !!active;
    this._render();
  }

  /* Show scatter path overlay.
     targetPos: {col, row}  — aimed square (catcher position)
     dirs: array of D8 values rolled so far (1–3 elements) */
  showScatterPath(targetPos, dirs) {
    if (!targetPos || !dirs) return;
    this._scatterTarget = targetPos;
    this._scatterDirs   = dirs;
    this._render();
    this._renderScatterLine();
  }

  clearScatter() {
    this._scatterTarget = null;
    this._scatterDirs   = [];
    this._render();
  }

  /* ── Private helpers ── */

  _rangeForDist(dist) {
    if (dist === null || dist === 0) return null;
    if (dist <= 3)  return { label: 'Quick Pass', shortLabel: 'Quick', mod:  0, cls: 'range-quick', dist };
    if (dist <= 6)  return { label: 'Short Pass', shortLabel: 'Short', mod: -1, cls: 'range-short', dist };
    if (dist <= 10) return { label: 'Long Pass',  shortLabel: 'Long',  mod: -1, cls: 'range-long',  dist };
    return               { label: 'Long Bomb',   shortLabel: 'Bomb',  mod: -2, cls: 'range-bomb',  dist };
  }

  _chebyshev(col, row) {
    if (!this.throwerPos) return Infinity;
    return Math.max(
      Math.abs(col - this.throwerPos.col),
      Math.abs(row - this.throwerPos.row)
    );
  }

  /* Euclidean radius cutoff per Chebyshev band for circular zone shape */
  _circularCutoff(chebyshev) {
    if (chebyshev <= 3)  return 3.5;
    if (chebyshev <= 6)  return 6.8;
    if (chebyshev <= 10) return 10.8;
    return 14.5;
  }

  _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* Compute scatter positions from a target and list of D8 dirs */
  _scatterPositions(target, dirs) {
    const positions = [{ col: target.col, row: target.row }];
    let col = target.col;
    let row = target.row;
    for (const d of dirs) {
      const [dc, dr] = DIR_VECTORS[d] ?? [0, 0];
      col = this._clamp(col + dc, 1, this.COLS);
      row = this._clamp(row + dr, 1, this.ROWS);
      positions.push({ col, row });
    }
    return positions; /* [aim, after1, after2, after3] */
  }

  _build() {
    this.container.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'pitch-wrap';

    this._gridEl = document.createElement('div');
    this._gridEl.className = 'pitch-grid';

    this._svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this._svgEl.classList.add('pitch-svg');
    this._svgEl.setAttribute('aria-hidden', 'true');

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
    const isThrowerCell = this.throwerPos &&
      col === this.throwerPos.col && row === this.throwerPos.row;

    /* Tapping the gold thrower token arms "move thrower" for next tap */
    if (isThrowerCell && !this._movingThrower) {
      this._movingThrower = true;
      this._render();
      return;
    }

    /* If "move thrower" is armed, next tap relocates the thrower */
    if (this._movingThrower) {
      this.throwerPos       = { col, row };
      this._catchers        = [];
      this._activeCatcherId = null;
      this._movingThrower   = false;
      this._render();
      this.onCatcherSelect?.(null, null);
      return;
    }

    /* Check if tapping an existing catcher */
    const existingIdx = this._catchers.findIndex(c => c.col === col && c.row === row);
    if (existingIdx !== -1) {
      const tapped = this._catchers[existingIdx];
      if (tapped.id === this._activeCatcherId) {
        /* Tapping the active catcher removes it */
        this._catchers.splice(existingIdx, 1);
        const prev = this._catchers[this._catchers.length - 1];
        this._activeCatcherId = prev?.id ?? null;
      } else {
        /* Tapping a non-active catcher makes it active */
        this._activeCatcherId = tapped.id;
      }
      this._render();
      this.onCatcherSelect?.(this.getDistance(), this.getRange());
      return;
    }

    /* Empty cell — add a new catcher */
    const newCatcher = { col, row, id: this._nextCatcherId++ };
    this._catchers.push(newCatcher);
    this._activeCatcherId = newCatcher.id;
    this._render();
    this.onCatcherSelect?.(this.getDistance(), this.getRange());
  }

  _render() {
    const t  = this.throwerPos;
    const ac = this.getActiveCatcher();

    /* Build scatter position list for overlay */
    const scatterPositions = (this._scatterTarget && this._scatterDirs?.length)
      ? this._scatterPositions(this._scatterTarget, this._scatterDirs)
      : null;

    this._cells.forEach(({ el, col, row }) => {
      el.className = 'pitch-cell';
      el.innerHTML = '';

      /* ── Zone coloring (Chebyshev + Euclidean circular mask) ── */
      const cheby = this._chebyshev(col, row);
      if (cheby === 0) {
        el.classList.add('range-thrower-cell');
      } else {
        const rng = this._rangeForDist(cheby);
        if (rng) {
          const dx = col - (t?.col ?? 7);
          const dy = row - (t?.row ?? 7);
          const euclidean = Math.sqrt(dx * dx + dy * dy);
          if (euclidean <= this._circularCutoff(cheby)) {
            el.classList.add(rng.cls);
            if (this._blizzard && (rng.cls === 'range-long' || rng.cls === 'range-bomb')) {
              el.classList.add('blizzard-blocked');
            }
          }
        }
      }

      /* ── Scatter overlay ── */
      if (scatterPositions) {
        const last = scatterPositions[scatterPositions.length - 1];
        const isTarget = scatterPositions[0].col === col && scatterPositions[0].row === row;
        const isLand   = last.col === col && last.row === row && scatterPositions.length > 1;
        const isPath   = !isTarget && !isLand &&
          scatterPositions.some(p => p.col === col && p.row === row);

        if (isLand)        el.classList.add('scatter-land');
        else if (isPath)   el.classList.add('scatter-path');
        else if (isTarget) el.classList.add('scatter-target');
      }

      /* ── Thrower token ── */
      if (t && col === t.col && row === t.row) {
        el.classList.add('is-thrower');
        if (this._movingThrower) el.classList.add('is-thrower-moving');
        const tok = document.createElement('div');
        tok.className = 'pitch-token pitch-token-thrower';
        el.appendChild(tok);
        return;
      }

      /* ── Catcher tokens ── */
      const catcherHere = this._catchers.find(c => c.col === col && c.row === row);
      if (catcherHere) {
        const isActive = catcherHere.id === this._activeCatcherId;
        el.classList.add(isActive ? 'is-catcher' : 'is-catcher-dim');
        const tok = document.createElement('div');
        tok.className = `pitch-token pitch-token-catcher${isActive ? '' : ' dim'}`;
        el.appendChild(tok);
        const lbl = document.createElement('span');
        lbl.className = 'pitch-catcher-label';
        lbl.textContent = this._catchers.indexOf(catcherHere) + 1;
        el.appendChild(lbl);
      }
    });

    this._renderLine();
  }

  _renderLine() {
    this._svgEl.innerHTML = '';
    const ac = this.getActiveCatcher();
    if (!this.throwerPos || !ac) return;

    const tEl = this._gridEl.querySelector(
      `[data-col="${this.throwerPos.col}"][data-row="${this.throwerPos.row}"]`
    );
    const cEl = this._gridEl.querySelector(
      `[data-col="${ac.col}"][data-row="${ac.row}"]`
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

  /* Draw a polyline connecting scatter positions */
  _renderScatterLine() {
    if (!this._scatterTarget || !this._scatterDirs?.length) return;
    const positions = this._scatterPositions(this._scatterTarget, this._scatterDirs);
    if (positions.length < 2) return;

    const gridRect = this._gridEl.getBoundingClientRect();
    if (!gridRect.width) return;

    this._svgEl.setAttribute('width',  gridRect.width);
    this._svgEl.setAttribute('height', gridRect.height);
    this._svgEl.style.width  = gridRect.width  + 'px';
    this._svgEl.style.height = gridRect.height + 'px';

    const pts = positions.map(({ col, row }) => {
      const cellEl = this._gridEl.querySelector(`[data-col="${col}"][data-row="${row}"]`);
      if (!cellEl) return null;
      const r = cellEl.getBoundingClientRect();
      return { x: r.left + r.width / 2 - gridRect.left, y: r.top + r.height / 2 - gridRect.top };
    }).filter(Boolean);

    if (pts.length < 2) return;

    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    poly.setAttribute('points', pts.map(p => `${p.x},${p.y}`).join(' '));
    poly.setAttribute('stroke', 'rgba(200, 16, 46, 0.75)');
    poly.setAttribute('stroke-width', '1.5');
    poly.setAttribute('stroke-dasharray', '3 2');
    poly.setAttribute('fill', 'none');
    this._svgEl.appendChild(poly);
  }
}

window.PitchGrid = PitchGrid;
