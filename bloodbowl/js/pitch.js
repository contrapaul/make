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

/* ─────────────────────────────────────────────────────────
   PASS ZONE LOOKUP TABLE  (Sprint 1)
   One quadrant of the rulebook 14×14 grid (thrower at origin,
   positive dx = right, positive dy = upward rows).
   Indexed as ZONE_TABLE[ady][adx]; null = thrower's own square.
   Mirror with Math.abs(dx) / Math.abs(dy) for all four quadrants.
   ───────────────────────────────────────────────────────── */
const ZONE_TABLE = [
  /* dy=0  thrower row */
  [null,'Q','Q','Q','S','S','S','L','L','L','L','LB','LB','LB'],
  /* dy=1  */
  ['Q','Q','Q','Q','S','S','S','L','L','L','L','LB','LB','LB'],
  /* dy=2  */
  ['Q','Q','Q','S','S','S','S','L','L','L','L','LB','LB','LB'],
  /* dy=3  */
  ['Q','Q','S','S','S','S','S','L','L','L','LB','LB','LB'],
  /* dy=4  */
  ['S','S','S','S','S','S','L','L','L','L','LB','LB','LB'],
  /* dy=5  */
  ['S','S','S','S','S','L','L','L','L','LB','LB','LB'],
  /* dy=6  */
  ['S','S','S','S','L','L','L','L','L','LB','LB','LB'],
  /* dy=7  */
  ['L','L','L','L','L','L','L','L','LB','LB','LB'],
  /* dy=8  */
  ['L','L','L','L','L','L','L','LB','LB','LB','LB'],
  /* dy=9  */
  ['L','L','L','L','L','LB','LB','LB','LB','LB'],
  /* dy=10 */
  ['L','L','L','LB','LB','LB','LB','LB','LB'],
  /* dy=11 */
  ['LB','LB','LB','LB','LB','LB','LB'],
  /* dy=12 */
  ['LB','LB','LB','LB','LB'],
  /* dy=13 */
  ['LB','LB','LB'],
];

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

/* ═══════════════════════════════════════════════════════
   BloodBowlPitch — full 28×15 pitch component
   Reusable across: pass wizard, kickoff formations,
   block adjacency, drive overview.

   Options: { scale: 0.6, homeTeamRight: true, interactive: true }

   Public API:
     placePlayer(col, row, playerData)
     removePlayer(col, row)
     movePlayer(fc, fr, tc, tr)
     highlightPlayer(col, row, on)
     showPassZones(centreCol, centreRow)
     hidePassZones()
     drawPassLine(fc, fr, tc, tr)
     clearPassLine()
     getPassRange(fc, fr, tc, tr)  → { distance, rangeLabel, rangeKey, mod }
     onSquareTap(callback)         → callback(col, row, playerData|null)
     showScatterPath(col, row, dirs) — overlay scatter markers after ball scatter
     clearScatterPath()
     clear()
     setScale(s)
   ═══════════════════════════════════════════════════════ */

class BloodBowlPitch {
  constructor(containerEl, options = {}) {
    this.container      = containerEl;
    this._scale         = options.scale ?? 0.6;
    this._interactive   = options.interactive !== false;
    this._players       = new Map();   // 'c,r' → { el, data }
    this._onTapCb       = null;
    this._zonesOn       = false;
    this._throwerPos    = null;
    this._gridEl        = null;
    this._svgEl         = null;
    this._outerEl       = null;
    this._curScale      = this._scale;
    this._sqPx          = Math.round(28 * this._scale);
    this._placementMode = null;   // { data, callback } for two-step placement
    this.onPlayerMoved  = null;   // fn(fc, fr, tc, tr, data)
    /* Sprint 9: zoom transform state */
    this._tx            = 0;      // translate X (px) applied before scale
    this._ty            = 0;      // translate Y (px)
    this._tz            = 1;      // scale factor (1 = base scale)
    this._noZoom = options.noZoom === true;
    this._build();
    if (this._interactive && !this._noZoom) this._setupZoom();
  }

  /* ── Public API ── */

  placePlayer(col, row, data) {
    this._removeAt(col, row);
    const cell = this._cell(col, row);
    if (!cell) return;
    const sq = this._sqPx;
    const r  = Math.max(4, sq - 4);
    const lbl = String(data.label ?? '').substring(0, 3) || '●';
    const fs  = lbl.length > 1 ? Math.max(5, r * 0.3) : Math.max(5, r * 0.38);
    const tok = document.createElement('div');
    tok.className = 'bbp-token bbp-token-' + (data.side ?? 'home');
    tok.style.cssText = `width:${r}px;height:${r}px;border-radius:50%;
      position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
      display:flex;align-items:center;justify-content:center;
      font-family:'JetBrains Mono',monospace;font-size:${fs}px;
      font-weight:800;color:#fff;pointer-events:${this._interactive?'auto':'none'};
      cursor:grab;transition:box-shadow 0.15s;z-index:3;`;
    tok.textContent = lbl;
    tok.title = data.label ?? '';
    if (this._interactive) {
      const DRAG_THRESHOLD = 5;
      tok.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        e.stopPropagation();
        tok.setPointerCapture(e.pointerId);
        let moved = false;

        const startRect = tok.getBoundingClientRect();
        const bg = data.side === 'away' ? '#1a3a8a' : '#8a1a1a';

        /* Sprint 10: ghost positioned via transform (compositor-only, no layout).
           left:0;top:0 is the document origin; translate moves it to the right place. */
        const ghost = document.createElement('div');
        ghost.style.cssText = `position:fixed;z-index:9999;pointer-events:none;border-radius:50%;
          left:0;top:0;will-change:transform;
          width:${startRect.width}px;height:${startRect.height}px;
          background:${bg};display:flex;align-items:center;justify-content:center;
          font-family:'JetBrains Mono',monospace;font-weight:800;font-size:${fs}px;
          color:#fff;opacity:0;transition:opacity 0.08s;`;
        ghost.style.transform = `translate(${startRect.left}px,${startRect.top}px)`;
        ghost.textContent = lbl;
        document.body.appendChild(ghost);
        tok.style.opacity = '0.25';
        tok.style.cursor = 'grabbing';

        /* RAF batching — only one pending frame update at a time */
        let rafId   = null;
        let pendingX = startRect.left;
        let pendingY = startRect.top;

        const onMove = ev => {
          const dx = ev.clientX - e.clientX;
          const dy = ev.clientY - e.clientY;
          if (!moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
            moved = true;
            ghost.style.opacity = '0.85';
          }
          if (moved) {
            pendingX = startRect.left + dx;
            pendingY = startRect.top  + dy;
            if (rafId === null) {
              rafId = requestAnimationFrame(() => {
                ghost.style.transform = `translate(${pendingX}px,${pendingY}px)`;
                rafId = null;
              });
            }
          }
        };

        const onUp = ev => {
          tok.removeEventListener('pointermove', onMove);
          tok.removeEventListener('pointerup',   onUp);
          if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
          ghost.remove();
          tok.style.opacity = '';
          tok.style.cursor = 'grab';

          if (!moved) {
            this._highlightTok(tok, true);
            this._onTapCb?.(col, row, data);
            return;
          }

          const target = document.elementFromPoint(ev.clientX, ev.clientY);
          const cellEl = target?.closest?.('[data-col][data-row]');
          const newCol = cellEl ? parseInt(cellEl.dataset.col) : col;
          const newRow = cellEl ? parseInt(cellEl.dataset.row) : row;

          if (newCol !== col || newRow !== row) {
            const d = this._players.get(`${col},${row}`)?.data ?? data;
            this._removeAt(col, row);
            this.placePlayer(newCol, newRow, d);
            this.onPlayerMoved?.(col, row, newCol, newRow, d);
          }
        };

        tok.addEventListener('pointermove', onMove);
        tok.addEventListener('pointerup',   onUp);
      });
    }
    cell.appendChild(tok);
    this._players.set(`${col},${row}`, { el: tok, data, col, row });
  }

  removePlayer(col, row) { this._removeAt(col, row); }

  movePlayer(fc, fr, tc, tr) {
    const e = this._players.get(`${fc},${fr}`);
    if (!e) return;
    const d = e.data;
    this._removeAt(fc, fr);
    this.placePlayer(tc, tr, d);
  }

  highlightPlayer(col, row, on = true) {
    const e = this._players.get(`${col},${row}`);
    if (e?.el) this._highlightTok(e.el, on);
  }

  showPassZones(cCol, cRow) {
    this._zonesOn    = true;
    this._throwerPos = { col: cCol, row: cRow };
    this._renderZones();
  }

  hidePassZones() {
    this._zonesOn = false;
    this._clearZones();
  }

  drawPassLine(fc, fr, tc, tr) { this._renderLine(fc, fr, tc, tr); }

  clearPassLine() {
    if (!this._svgEl) return;
    Array.from(this._svgEl.children).forEach(c => { if (c.tagName !== 'defs') c.remove(); });
  }

  /* Look up the pass zone for absolute offsets (adx, ady). Returns 'Q','S','L','LB', or null. */
  static getZoneKey(adx, ady) {
    if (ady >= ZONE_TABLE.length) return null;
    const row = ZONE_TABLE[ady];
    if (adx >= row.length) return null;
    return row[adx] ?? null;
  }

  getPassRange(fc, fr, tc, tr) {
    const adx  = Math.abs(tc - fc);
    const ady  = Math.abs(tr - fr);
    const zone = BloodBowlPitch.getZoneKey(adx, ady);
    if (!zone) return null;
    const d = Math.max(adx, ady);
    /* mod is the change applied to the die roll (negative = harder).
       Subtracting a negative mod in the wizard raises the target number. */
    const META = {
      'Q':  { rangeLabel: 'Quick Pass', rangeKey: 'quick', mod:  0 },
      'S':  { rangeLabel: 'Short Pass', rangeKey: 'short', mod: -1 },
      'L':  { rangeLabel: 'Long Pass',  rangeKey: 'long',  mod: -2 },
      'LB': { rangeLabel: 'Long Bomb',  rangeKey: 'bomb',  mod: -3 },
    };
    return { distance: d, ...META[zone] };
  }

  onSquareTap(cb) { this._onTapCb = cb; }

  /* Enter two-step placement mode. Next cell tap places data and fires callback(col,row). */
  startPlacement(data, callback) {
    this._placementMode = { data, callback };
    this._gridEl?.classList.add('bbp-placement-mode');
  }

  cancelPlacement() {
    this._placementMode = null;
    this._gridEl?.classList.remove('bbp-placement-mode');
  }

  /* Scatter path overlay on the full pitch */
  showScatterPath(startCol, startRow, dirs) {
    this.clearScatterPath();
    const DIR = {1:[-1,-1],2:[0,-1],3:[1,-1],4:[-1,0],5:[1,0],6:[-1,1],7:[0,1],8:[1,1]};
    const positions = [{ col: startCol, row: startRow }];
    let c = startCol, r = startRow;
    for (const d of dirs) {
      const [dc, dr] = DIR[d] ?? [0, 0];
      c = Math.max(1, Math.min(28, c + dc));
      r = Math.max(1, Math.min(15, r + dr));
      positions.push({ col: c, row: r });
    }
    const mark = (col, row, cls) => {
      const cell = this._cell(col, row);
      if (!cell) return;
      const div = document.createElement('div');
      div.className = `bbp-scatter ${cls}`;
      div.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2;';
      cell.appendChild(div);
    };
    mark(startCol, startRow, 'bbp-scatter-aim');
    for (let i = 1; i < positions.length - 1; i++) mark(positions[i].col, positions[i].row, 'bbp-scatter-path');
    if (positions.length > 1) {
      const last = positions[positions.length - 1];
      mark(last.col, last.row, 'bbp-scatter-land');
    }
  }

  clearScatterPath() {
    this._gridEl?.querySelectorAll('.bbp-scatter').forEach(el => el.remove());
  }

  clear() {
    [...this._players.keys()].forEach(k => {
      const [c, r] = k.split(',').map(Number);
      this._removeAt(c, r);
    });
    this.clearPassLine();
    this.hidePassZones();
    this.clearScatterPath();
  }

  setScale(s) {
    /* Programmatic scale change — zoom from current translate position. */
    this._tz       = Math.max(0.4, Math.min(2.5, s)) / this._scale;
    this._curScale = this._tz * this._scale;
    this._applyTransform();
  }

  /* Apply current _tx/_ty/_tz to the outer element. */
  _applyTransform() {
    if (this._outerEl) {
      this._outerEl.style.transform =
        `translate(${this._tx}px,${this._ty}px) scale(${this._tz})`;
    }
  }

  /* Zoom toward a specific viewport point (cx, cy) — Sprint 9.
     newTz is the target scale factor. */
  _zoomAt(newTz, cx, cy) {
    const scrollEl = this._outerEl?.parentElement;
    if (!scrollEl) return;
    const rect = scrollEl.getBoundingClientRect();
    /* Cursor position in scroll-container coordinate space */
    const sx = cx - rect.left + scrollEl.scrollLeft;
    const sy = cy - rect.top  + scrollEl.scrollTop;
    /* Adjust translate so the point under the cursor stays fixed:
       newTx = sx*(1-f) + tx*f  where f = newTz/oldTz             */
    const f = newTz / this._tz;
    this._tx = sx * (1 - f) + this._tx * f;
    this._ty = sy * (1 - f) + this._ty * f;
    this._tz       = newTz;
    this._curScale = newTz * this._scale;
    this._applyTransform();
  }

  /* ── Build ── */

  _build() {
    this.container.innerHTML = '';
    const SQ = this._sqPx;

    /* Scrollable wrapper so the pitch can be panned */
    const scrollEl = document.createElement('div');
    scrollEl.style.cssText = 'overflow:auto;max-width:100%;-webkit-overflow-scrolling:touch;';
    this.container.appendChild(scrollEl);

    this._outerEl = document.createElement('div');
    /* Sprint 9: transform-origin:0 0 pairs with translate(tx,ty) scale(tz).
       No CSS transition — zoom is driven frame-by-frame in _zoomAt(). */
    this._outerEl.style.cssText = 'transform-origin:0 0;display:inline-block;position:relative;';
    scrollEl.appendChild(this._outerEl);

    /* Grid */
    this._gridEl = document.createElement('div');
    this._gridEl.className = 'bbp-grid';
    this._gridEl.style.cssText = `display:grid;grid-template-columns:repeat(28,${SQ}px);grid-template-rows:repeat(15,${SQ}px);gap:0;border:2px solid rgba(255,255,255,0.7);box-sizing:content-box;position:relative;user-select:none;`;
    this._outerEl.appendChild(this._gridEl);

    /* SVG overlay for pass line */
    const W = SQ * 28, H = SQ * 15;
    this._svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this._svgEl.setAttribute('width', W);
    this._svgEl.setAttribute('height', H);
    this._svgEl.style.cssText = `position:absolute;top:0;left:0;width:${W}px;height:${H}px;pointer-events:none;overflow:visible;`;
    this._svgEl.setAttribute('aria-hidden', 'true');
    /* Arrowhead marker */
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const mkr  = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    mkr.setAttribute('id', 'bbp-arrowhead'); mkr.setAttribute('markerWidth', '7'); mkr.setAttribute('markerHeight', '7');
    mkr.setAttribute('refX', '6'); mkr.setAttribute('refY', '3'); mkr.setAttribute('orient', 'auto');
    const arrowP = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrowP.setAttribute('d', 'M0,0 L0,6 L7,3 z');
    arrowP.setAttribute('fill', 'rgba(212,175,55,0.9)');
    mkr.appendChild(arrowP);
    defs.appendChild(mkr);
    this._svgEl.appendChild(defs);
    this._outerEl.appendChild(this._svgEl);

    /* Build all 420 cells */
    for (let r = 1; r <= 15; r++) {
      for (let c = 1; c <= 28; c++) {
        this._gridEl.appendChild(this._makeCell(c, r, SQ));
      }
    }
  }

  _makeCell(col, row, SQ) {
    const cell = document.createElement('div');
    cell.dataset.col = col;
    cell.dataset.row = row;

    /* Background */
    let bg, bgImg = '';
    if      (col === 1)  bg = '#1a3a8a';
    else if (col === 28) bg = '#8a1a1a';
    else { bg = '#1a3d1a'; bgImg = `repeating-linear-gradient(0deg,rgba(255,255,255,0.025) 0px,rgba(255,255,255,0.025) 1px,transparent 1px,transparent ${SQ}px)`; }

    /* Borders: thin grid lines + thick dividers */
    let borderRight  = '1px solid rgba(255,255,255,0.15)';
    let borderBottom = '1px solid rgba(255,255,255,0.15)';
    const thick = '2px solid rgba(255,255,255,0.7)';
    if (col === 1 || col === 14 || col === 27) borderRight = thick;
    if ((row === 4 || row === 11) && col >= 2 && col <= 27) borderBottom = thick;

    cell.style.cssText = `width:${SQ}px;height:${SQ}px;box-sizing:border-box;position:relative;
      display:flex;align-items:center;justify-content:center;
      background:${bg};${bgImg ? `background-image:${bgImg};` : ''}
      border-right:${borderRight};border-bottom:${borderBottom};
      cursor:${this._interactive ? 'pointer' : 'default'};`;

    /* Endzone labels at row 8 */
    if ((col === 1 || col === 28) && row === 8) {
      const lbl = document.createElement('div');
      lbl.style.cssText = `writing-mode:vertical-rl;transform:rotate(180deg);
        font-family:'JetBrains Mono',monospace;font-size:${Math.max(6, Math.round(SQ * 0.42))}px;
        font-weight:800;color:rgba(255,255,255,0.8);letter-spacing:0.08em;
        pointer-events:none;user-select:none;white-space:nowrap;`;
      lbl.textContent = col === 1 ? 'AWAY' : 'HOME';
      cell.appendChild(lbl);
    }

    if (this._interactive) {
      cell.addEventListener('click', () => {
        if (this._placementMode) {
          const { data, callback } = this._placementMode;
          this._placementMode = null;
          this._gridEl?.classList.remove('bbp-placement-mode');
          this.placePlayer(col, row, data);
          callback(col, row);
          return;
        }
        const existing = this._players.get(`${col},${row}`)?.data ?? null;
        this._onTapCb?.(col, row, existing);
      });
    }
    return cell;
  }

  _cell(col, row) {
    return this._gridEl?.querySelector(`[data-col="${col}"][data-row="${row}"]`) ?? null;
  }

  _removeAt(col, row) {
    const e = this._players.get(`${col},${row}`);
    if (e) { e.el.remove(); this._players.delete(`${col},${row}`); }
  }

  _highlightTok(tok, on) {
    tok.style.boxShadow = on ? '0 0 10px rgba(212,175,55,0.8)' : '';
    tok.style.outline   = on ? '2px solid #D4AF37' : '';
  }

  _renderZones() {
    this._clearZones();
    if (!this._throwerPos) return;
    const { col: tc, row: tr } = this._throwerPos;
    const isBliz = window.GameState?.currentWeather?.name === 'Blizzard';
    const COLORS = {
      'Q':  'rgba(40,180,40,0.35)',
      'S':  'rgba(200,200,40,0.35)',
      'L':  'rgba(220,140,20,0.35)',
      'LB': 'rgba(200,40,40,0.35)',
    };
    for (let r = 1; r <= 15; r++) {
      for (let c = 2; c <= 27; c++) {
        if (c === tc && r === tr) continue;
        const zone = BloodBowlPitch.getZoneKey(Math.abs(c - tc), Math.abs(r - tr));
        if (!zone) continue;
        const cell = this._cell(c, r);
        if (!cell) continue;
        const ov = document.createElement('div');
        ov.className = 'bbp-zone';
        ov.style.cssText = `position:absolute;inset:0;background:${COLORS[zone]};pointer-events:none;z-index:1;`;
        if (isBliz && (zone === 'L' || zone === 'LB')) {
          const x = document.createElement('span');
          x.textContent = '✕';
          x.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:rgba(140,190,255,0.7);font-size:0.55rem;font-weight:900;';
          ov.appendChild(x);
        }
        cell.appendChild(ov);
      }
    }
  }

  _clearZones() {
    this._gridEl?.querySelectorAll('.bbp-zone').forEach(el => el.remove());
  }

  _renderLine(fc, fr, tc, tr) {
    this.clearPassLine();
    const SQ = this._sqPx;
    const x1 = (fc - 1) * SQ + SQ / 2, y1 = (fr - 1) * SQ + SQ / 2;
    const x2 = (tc - 1) * SQ + SQ / 2, y2 = (tr - 1) * SQ + SQ / 2;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1); line.setAttribute('y1', y1);
    line.setAttribute('x2', x2); line.setAttribute('y2', y2);
    line.setAttribute('stroke', 'rgba(212,175,55,0.85)');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-dasharray', '6 4');
    line.setAttribute('marker-end', 'url(#bbp-arrowhead)');
    line.style.animation = 'bbp-march 0.6s linear infinite';
    this._svgEl.appendChild(line);
  }

  _setupZoom() {
    /* Sprint 9: zoom centred on cursor (wheel) or pinch midpoint (touch). */
    const scroll    = this._outerEl.parentElement;
    const ptrs      = new Map();
    let   lastDist  = null;
    const MIN_TZ    = 0.4 / this._scale;
    const MAX_TZ    = 2.5 / this._scale;

    scroll.addEventListener('wheel', e => {
      e.preventDefault();
      /* Step ±0.1 in _curScale terms → ±0.1/_scale in _tz terms */
      const step  = (e.deltaY > 0 ? -0.1 : 0.1) / this._scale;
      const newTz = Math.max(MIN_TZ, Math.min(MAX_TZ, this._tz + step));
      this._zoomAt(newTz, e.clientX, e.clientY);
    }, { passive: false });

    scroll.addEventListener('pointerdown', e => ptrs.set(e.pointerId, e));
    scroll.addEventListener('pointermove', e => {
      ptrs.set(e.pointerId, e);
      if (ptrs.size === 2) {
        const [p1, p2] = [...ptrs.values()];
        const d    = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
        const midX = (p1.clientX + p2.clientX) / 2;
        const midY = (p1.clientY + p2.clientY) / 2;
        if (lastDist !== null) {
          const step  = (d - lastDist) * 0.004 / this._scale;
          const newTz = Math.max(MIN_TZ, Math.min(MAX_TZ, this._tz + step));
          this._zoomAt(newTz, midX, midY);
        }
        lastDist = d;
      }
    });
    ['pointerup', 'pointercancel'].forEach(ev =>
      scroll.addEventListener(ev, e => { ptrs.delete(e.pointerId); lastDist = null; })
    );
  }
}

/* Token colours injected via JS */
(function injectBBPStyles() {
  if (document.getElementById('bbp-style')) return;
  const s = document.createElement('style');
  s.id = 'bbp-style';
  s.textContent = `
    .bbp-token-home { background: #8a1a1a; }
    .bbp-token-away { background: #1a3a8a; }
    @keyframes bbp-march { to { stroke-dashoffset: -20; } }
    .bbp-scatter-aim  { background: rgba(255,193,7,0.30); }
    .bbp-scatter-path { background: rgba(200,140,50,0.22); }
    .bbp-scatter-land { background: rgba(200,16,46,0.38); box-shadow: inset 0 0 0 2px rgba(200,16,46,0.85); }
  `;
  document.head.appendChild(s);
})();

window.BloodBowlPitch = BloodBowlPitch;
