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
    this._cells      = [];
    this._gridEl     = null;
    this._svgEl      = null;
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

  _build() {
    this.container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'pitch-wrap';

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
    /* Can't select the thrower's own square */
    if (this.throwerPos && col === this.throwerPos.col && row === this.throwerPos.row) return;
    this.catcherPos = { col, row };
    this._render();
    this.onCatcherSelect?.(this.getDistance(), this.getRange());
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
          el.classList.add(rng.cls);
          if (this._blizzard && (rng.cls === 'range-long' || rng.cls === 'range-bomb')) {
            el.classList.add('blizzard-blocked');
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
    this._build();
    if (this._interactive) this._setupZoom();
  }

  /* ── Public API ── */

  placePlayer(col, row, data) {
    this._removeAt(col, row);
    const cell = this._cell(col, row);
    if (!cell) return;
    const sq = this._sqPx;
    const r  = Math.max(4, sq - 4);
    const tok = document.createElement('div');
    tok.className = 'bbp-token bbp-token-' + (data.side ?? 'home');
    tok.style.cssText = `width:${r}px;height:${r}px;border-radius:50%;
      position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
      display:flex;align-items:center;justify-content:center;
      font-family:'JetBrains Mono',monospace;font-size:${Math.max(5,r*0.38)}px;
      font-weight:800;color:#fff;pointer-events:${this._interactive?'auto':'none'};
      cursor:pointer;transition:box-shadow 0.15s;z-index:3;`;
    tok.textContent = (data.label ?? '').charAt(0).toUpperCase() || '●';
    tok.title = data.label ?? '';
    if (this._interactive) {
      tok.addEventListener('click', e => {
        e.stopPropagation();
        this._highlightTok(tok, true);
        this._onTapCb?.(col, row, data);
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

  getPassRange(fc, fr, tc, tr) {
    const d = Math.max(Math.abs(tc - fc), Math.abs(tr - fr));
    if (d <= 3)  return { distance: d, rangeLabel: 'Quick Pass', rangeKey: 'quick', mod:  0 };
    if (d <= 6)  return { distance: d, rangeLabel: 'Short Pass', rangeKey: 'short', mod: -1 };
    if (d <= 10) return { distance: d, rangeLabel: 'Long Pass',  rangeKey: 'long',  mod: -1 };
    return             { distance: d, rangeLabel: 'Long Bomb',   rangeKey: 'bomb',  mod: -2 };
  }

  onSquareTap(cb) { this._onTapCb = cb; }

  clear() {
    [...this._players.keys()].forEach(k => {
      const [c, r] = k.split(',').map(Number);
      this._removeAt(c, r);
    });
    this.clearPassLine();
    this.hidePassZones();
  }

  setScale(s) {
    this._curScale = Math.max(0.4, Math.min(2.5, s));
    if (this._outerEl) {
      this._outerEl.style.transform = `scale(${this._curScale / this._scale})`;
    }
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
    this._outerEl.style.cssText = 'transform-origin:top left;transition:transform 0.12s;display:inline-block;position:relative;';
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
    for (let r = 1; r <= 15; r++) {
      for (let c = 2; c <= 27; c++) {
        if (c === tc && r === tr) continue;
        const d = Math.max(Math.abs(c - tc), Math.abs(r - tr));
        let color, isLong = false;
        if      (d <= 3)  color = 'rgba(40,180,40,0.35)';
        else if (d <= 6)  color = 'rgba(200,200,40,0.35)';
        else if (d <= 10) { color = 'rgba(220,140,20,0.35)'; isLong = true; }
        else              { color = 'rgba(200,40,40,0.35)';  isLong = true; }

        const cell = this._cell(c, r);
        if (!cell) continue;
        const ov = document.createElement('div');
        ov.className = 'bbp-zone';
        ov.style.cssText = `position:absolute;inset:0;background:${color};pointer-events:none;z-index:1;`;
        if (isBliz && isLong) {
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
    const scroll = this._outerEl.parentElement;
    const ptrs   = new Map();
    let lastDist = null;

    scroll.addEventListener('wheel', e => {
      e.preventDefault();
      this.setScale(this._curScale + (e.deltaY > 0 ? -0.1 : 0.1));
    }, { passive: false });

    scroll.addEventListener('pointerdown', e => ptrs.set(e.pointerId, e));
    scroll.addEventListener('pointermove', e => {
      ptrs.set(e.pointerId, e);
      if (ptrs.size === 2) {
        const [p1, p2] = [...ptrs.values()];
        const d = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
        if (lastDist !== null) this.setScale(this._curScale + (d - lastDist) * 0.004);
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
  `;
  document.head.appendChild(s);
})();

window.BloodBowlPitch = BloodBowlPitch;
