'use strict';

/* ═══════════════════════════════════════════════════════
   Blood Bowl Companion — js/drive-wizard.js

   Kickoff flows ('half-start', 'drive-only') render as a single
   fixed window (same size as the Block/Pass wizards) showing every
   step at once, with three roll modes:
     · Auto-Roll   — one click, the board rolls itself in sequence
     · I'll Roll   — a roll button per step, unlocked in order
     · Table Rolls — click the result rolled at the table, see what it means

   'drive-end' (effects + KO recovery) keeps the original bottom-sheet
   step-through.
   ═══════════════════════════════════════════════════════ */

const DriveWizard = (() => {

  /* ── Flow definitions ── */
  const FLOWS = {
    'half-start': ['weather', 'kicking', 'prayers', 'setup', 'deviation', 'kickoff', 'ready'],
    'drive-only': ['setup', 'deviation', 'kickoff', 'ready'],
    'drive-end':  ['effects', 'ko-recovery'],
  };

  /* Kickoff-board flows: every panel visible at once, resolved in order. */
  const BOARD_FLOWS = {
    'half-start': ['kicking', 'weather', 'prayers', 'deviation', 'kickoff'],
    'drive-only': ['deviation', 'kickoff'],
  };

  const BOARD_META = {
    kicking:   { icon: '⚽', title: 'Kicking Team' },
    weather:   { icon: '🌤', title: 'Weather' },
    prayers:   { icon: '✦',  title: 'Prayers to Nuffle' },
    deviation: { icon: '⬡',  title: 'Kick Deviation' },
    kickoff:   { icon: '⚡', title: 'Kickoff Event' },
  };

  const MODES = [
    { key: 'auto',   label: '⚡ Auto-Roll' },
    { key: 'manual', label: "🎲 I'll Roll" },
    { key: 'table',  label: '👆 Table Rolls' },
  ];

  const STEP_LABELS = {
    weather:       '🌤 Weather',
    kicking:       '⚽ Kicking Team',
    prayers:       '✦ Prayers',
    setup:         '📋 Setup',
    deviation:     '⬡ Kick Deviation',
    kickoff:       '⚡ Kickoff Event',
    ready:         '▸ Drive Ready',
    effects:       '🔔 Drive Effects',
    'ko-recovery': '💊 KO Recovery',
  };

  const DIR = { 1:'↖ Up-Left',2:'↑ Up',3:'↗ Up-Right',4:'← Left',5:'→ Right',6:'↙ Down-Left',7:'↓ Down',8:'↘ Down-Right' };
  const KICKOFF_AFFECTS = { 2:'both',3:'both',4:'kicking',5:'receiving',6:'both',7:'both',8:'both',9:'receiving',10:'kicking',11:'both',12:'both' };

  /* ── Internal state ── */
  let _flow       = [];
  let _flowName   = '';
  let _step       = 0;
  let _reachedEnd = false;   /* true once the final step is shown — drives "completed" */
  let _state = {};  /* { weather, kickingTeam, prayer, prayersDone, deviation, kickoff } */

  /* Kickoff-board state */
  let _boardKeys = null;     /* array of panel keys, or null (legacy step mode) */
  let _mode      = 'auto';
  let _rolling   = false;

  /* ── Next-button lock (for roll-required steps) ── */
  function _lockNext() {
    const btn = document.getElementById('dw-next');
    if (btn) { btn.disabled = true; btn.title = 'Roll first to continue'; }
  }
  function _unlockNext() {
    const btn = document.getElementById('dw-next');
    if (btn) { btn.disabled = false; btn.title = ''; }
  }

  /* ── Utilities ── */
  function h(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function ce(tag, cls, html) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (html != null) el.innerHTML = html;
    return el;
  }

  function mkDie(id, sides = 6) {
    const el = document.createElement('div');
    el.className = 'die';
    el.id        = id;
    el.dataset.value = '1';
    if (sides !== 6) el.dataset.sides = sides;
    el.innerHTML = `<div class="die-face${sides >= 8 ? ' d8-face' : ''}"></div>`;
    return el;
  }

  function isPhys() {
    return (window.BBSettings?.getSettings().diceMode ?? 'digital') === 'physical';
  }

  const _pause = ms => new Promise(r => setTimeout(r, ms));

  /* ── Public API ── */

  function open(flow = 'half-start') {
    _flowName = FLOWS[flow] ? flow : 'half-start';
    _flow  = FLOWS[_flowName];
    _step  = 0;
    _reachedEnd = false;
    _state = {};
    if (BOARD_FLOWS[_flowName]) {
      _openBoard();
      return;
    }
    _boardKeys = null;
    document.getElementById('drive-wizard')?.classList.remove('dw-board');
    _wireNav();
    _render();
    _showModal();
  }

  function close() {
    /* completed = finished the flow (vs dismissed early via backdrop).
       Lets the game page resume play. */
    const completed = _boardKeys
      ? _allResolved()
      : (_reachedEnd || _step >= _flow.length - 1);
    document.dispatchEvent(new CustomEvent('bb:driveClosed', {
      detail: { flow: _flowName, completed },
    }));
    _hideModal();
    document.getElementById('drive-wizard')?.classList.remove('dw-board');
    _boardKeys = null;
    _rolling   = false;
  }

  function minimise() {
    const el = document.getElementById('drive-wizard');
    if (el) el.hidden = true;
    const pill = document.getElementById('dw-pill');
    if (pill) { pill.hidden = false; _updatePill(); }
  }

  function restore() {
    const el   = document.getElementById('drive-wizard');
    const pill = document.getElementById('dw-pill');
    if (el)   el.hidden   = false;
    if (pill) pill.hidden = true;
  }

  /* ── Internal ── */

  function _showModal() {
    const el = document.getElementById('drive-wizard');
    if (el) el.hidden = false;
    document.getElementById('dw-backdrop')?.classList.add('active');
  }

  function _hideModal() {
    const el   = document.getElementById('drive-wizard');
    const pill = document.getElementById('dw-pill');
    if (el)   el.hidden   = true;
    if (pill) pill.hidden = true;
    document.getElementById('dw-backdrop')?.classList.remove('active');
  }

  function _updatePill() {
    const el = document.getElementById('dw-pill-step');
    if (!el) return;
    if (_boardKeys) {
      el.textContent = `${_boardKeys.filter(_isResolved).length}/${_boardKeys.length}`;
    } else {
      el.textContent = `${_step + 1}/${_flow.length}`;
    }
  }

  function _wireNav() {
    const backBtn = document.getElementById('dw-back');
    const nextBtn = document.getElementById('dw-next');
    const minBtn  = document.getElementById('dw-minimise');
    const pill    = document.getElementById('dw-pill');
    const bd      = document.getElementById('dw-backdrop');

    if (backBtn) backBtn.onclick = () => _go(-1);
    if (nextBtn) nextBtn.onclick = () => {
      if (_step >= _flow.length - 1) close();
      else _go(1);
    };
    if (minBtn) minBtn.onclick = minimise;
    if (pill)   pill.onclick   = restore;

    /* Backdrop closes wizard unless Beginner mode (cannot skip) */
    if (bd) {
      bd.onclick = () => {
        const mode = window.BBSettings?.getSettings().mode ?? 'veteran';
        if (mode !== 'beginner') close();
      };
    }
  }

  function _go(dir) {
    const n = _step + dir;
    if (n < 0 || n >= _flow.length) return;
    _step = n;
    _render();
  }

  function _render() {
    const step = _flow[_step];

    /* ── Step dots ── */
    const dotsEl = document.getElementById('dw-step-dots');
    if (dotsEl) {
      dotsEl.innerHTML = '';
      _flow.forEach((s, i) => {
        const dot = document.createElement('div');
        dot.className = 'dw-dot';
        if (i < _step)   dot.classList.add('dw-dot-done');
        if (i === _step) dot.classList.add('dw-dot-current');
        dot.title = STEP_LABELS[s] ?? s;
        dotsEl.appendChild(dot);
      });
    }

    /* ── Nav buttons ── */
    const backBtn = document.getElementById('dw-back');
    const nextBtn = document.getElementById('dw-next');
    const isLast  = _step >= _flow.length - 1;
    if (backBtn) { backBtn.style.display = ''; backBtn.disabled = _step === 0; }
    if (nextBtn) {
      nextBtn.textContent = isLast ? '▸ Done' : 'Next →';
      nextBtn.disabled    = false;
      nextBtn.classList.remove('dwk-ready');
    }
    if (isLast) _reachedEnd = true;

    _updatePill();

    /* ── Step content ── */
    const contentEl = document.getElementById('dw-content');
    if (!contentEl) return;
    contentEl.innerHTML = '';

    const titleEl = document.createElement('div');
    titleEl.className   = 'dw-step-title';
    titleEl.textContent = STEP_LABELS[step] ?? step;
    contentEl.appendChild(titleEl);

    const key = step.replace(/-/g, '_');
    if (STEPS[key]) STEPS[key](contentEl);
  }

  /* ─────────────────────────────────────────────────────
     KICKOFF BOARD — all steps in one block-wizard-sized window
     ──────────────────────────────────────────────────── */

  function _loadMode() {
    try {
      const saved = localStorage.getItem('bb:kickoffRollMode');
      if (saved && MODES.some(m => m.key === saved)) return saved;
    } catch (_) {}
    return isPhys() ? 'table' : 'auto';
  }

  function _saveMode() {
    try { localStorage.setItem('bb:kickoffRollMode', _mode); } catch (_) {}
  }

  function _openBoard() {
    _boardKeys = BOARD_FLOWS[_flowName];
    _mode      = _loadMode();
    _rolling   = false;
    document.getElementById('drive-wizard')?.classList.add('dw-board');
    _wireNav();          /* minimise / pill / backdrop; nav buttons overridden below */
    _renderBoard();
    _showModal();
  }

  function _isResolved(key) {
    switch (key) {
      case 'kicking':   return !!_state.kickingTeam;
      case 'weather':   return !!_state.weather;
      case 'prayers':   return !!_state.prayersDone;
      case 'deviation': return !!_state.deviation;
      case 'kickoff':   return !!_state.kickoff;
    }
    return false;
  }

  function _activeKey()   { return _boardKeys.find(k => !_isResolved(k)) ?? null; }
  function _allResolved() { return _boardKeys.every(_isResolved); }

  function _renderBoard() {
    /* Header: title + mode switcher replace the step dots */
    const dotsEl = document.getElementById('dw-step-dots');
    if (dotsEl) {
      dotsEl.innerHTML = '';
      const title = ce('div', 'dwk-title');
      title.textContent = _flowName === 'half-start' ? 'Kickoff' : 'New Drive';
      dotsEl.appendChild(title);

      const seg = ce('div', 'dwk-modes');
      MODES.forEach(m => {
        const b = ce('button', 'dwk-mode-btn' + (m.key === _mode ? ' active' : ''));
        b.type = 'button';
        b.textContent = m.label;
        b.addEventListener('click', () => {
          if (_rolling || m.key === _mode) return;
          _mode = m.key;
          _saveMode();
          _renderBoard();
        });
        seg.appendChild(b);
      });
      dotsEl.appendChild(seg);
    }

    /* Content: panel row + summary strip */
    const content = document.getElementById('dw-content');
    if (!content) return;
    content.innerHTML = '';

    const grid = ce('div', 'dwk-grid');
    grid.id = 'dwk-grid';
    _boardKeys.forEach(k => grid.appendChild(_buildPanel(k)));
    content.appendChild(grid);

    const summary = ce('div', 'dwk-summary');
    summary.id = 'dwk-summary';
    content.appendChild(summary);

    _refreshSummary();
    _refreshBoardNav();
    _updatePill();
  }

  function _buildPanel(key) {
    const meta = BOARD_META[key];
    const p = ce('section', 'dwk-panel');
    p.id = `dwk-panel-${key}`;
    p.dataset.key = key;
    p.appendChild(ce('div', 'dwk-panel-head',
      `<span class="dwk-panel-icon">${meta.icon}</span>` +
      `<span class="dwk-panel-title">${h(meta.title)}</span>` +
      `<span class="dwk-panel-check">✓</span>`));
    const body = ce('div', 'dwk-panel-body');
    p.appendChild(body);
    _fillPanel(key, p, body);
    return p;
  }

  function _rerenderPanel(key) {
    const p = document.getElementById(`dwk-panel-${key}`);
    if (!p) return;
    const body = p.querySelector('.dwk-panel-body');
    body.innerHTML = '';
    _fillPanel(key, p, body);
  }

  function _fillPanel(key, p, body) {
    const done   = _isResolved(key);
    const active = !done && _activeKey() === key;
    p.classList.toggle('done',   done);
    p.classList.toggle('active', active);
    p.classList.toggle('locked', !done && !active);

    if (done)    { _renderPanelResult(key, body); return; }
    if (!active) { body.appendChild(ce('div', 'dwk-wait', '·&nbsp;·&nbsp;·')); return; }

    /* Prayers resolve themselves when no team is short-handed */
    if (key === 'prayers' && !_prayersNeeded()) {
      _state.prayersDone = true;
      _state.prayersNote = 'Both teams field equal numbers — no Prayers to Nuffle.';
      _afterResolve('prayers');
      return;
    }
    PANEL_UI[key](body);
  }

  /* Marks a panel resolved in the DOM, unlocks the next, refreshes chrome. */
  function _afterResolve(key) {
    _rerenderPanel(key);
    const next = _activeKey();
    if (next) _rerenderPanel(next);
    if (_allResolved()) _reachedEnd = true;
    _refreshSummary();
    _refreshBoardNav();
    _updatePill();
  }

  /* ── State setters (shared by all three modes) ── */

  function _setKicker(side, roll = null) {
    _state.kickingTeam = side;
    _state.kickingRoll = roll;
    if (window.GameState) window.GameState.kickingTeam = side;
  }

  function _setWeather(total, d1 = null, d2 = null) {
    const data = window.BBData?.weather ?? [];
    const w    = data.find(e => total >= e.rollMin && total <= e.rollMax)
              ?? { name: 'Unknown', emoji: '❓', effect: '', desc: '', rollMin: total, rollMax: total };
    /* Store state — but do NOT call refreshWeatherChips/updateGameBarWeather
       synchronously; they can trigger setPhase/updateModuleAvailability which
       applies module-dimmed styles mid-flow. Defer. */
    if (window.GameState) window.GameState.currentWeather = w;
    _state.weather     = w;
    _state.weatherRoll = { total, d1, d2 };
    setTimeout(() => {
      window.Panels?.refreshWeatherChips?.();
      window.Panels?.updateGameBarWeather?.(w);
    }, 0);
  }

  function _setPrayer(val) {
    const data = window.BBData?.prayers ?? [];
    _state.prayer      = data.find(e => e.roll === val) ?? { name: 'Unknown Blessing', desc: '' };
    _state.prayerRoll  = val;
    _state.prayersDone = true;
  }

  function _setDeviation(dist, dir) {
    _state.deviation = { dist, dir };
  }

  function _setKickoff(total, d1 = null, d2 = null) {
    const data = window.BBData?.kickoff ?? [];
    _state.kickoff     = data.find(e => e.roll === total) ?? { name: 'Unknown Event', desc: '' };
    _state.kickoffRoll = { total, d1, d2 };
  }

  function _prayersNeeded() {
    const info = _prayersInfo();
    return info.fh !== info.fa;
  }

  /* Prayers apply only when one team fields FEWER players at kick-off. */
  function _prayersInfo() {
    const avail = side => (window.getPlayerList?.(side) || [])
      .filter(p => window.isPlayerAvailable ? window.isPlayerAvailable(p) : true).length;
    const fh = Math.min(11, avail('left')), fa = Math.min(11, avail('right'));
    const prayingSide = fh < fa ? 'left' : 'right';
    const prayingName = window.state?.[prayingSide]?.team?.name ||
      (prayingSide === 'left' ? 'Home' : 'Away');
    return { fh, fa, prayingSide, prayingName };
  }

  /* ── Per-panel UI for the ACTIVE, unresolved panel ── */

  const PANEL_UI = {

    kicking(body) {
      body.appendChild(ce('p', 'dwk-hint', 'Which team kicks off this drive?'));

      const sel = ce('div', 'dw-team-select');
      [['home', '🏠 We kick'], ['away', '✈️ They kick']].forEach(([side, label]) => {
        const b = ce('button', 'dw-team-btn');
        b.type = 'button';
        b.textContent = label;
        b.addEventListener('click', () => { _setKicker(side); _afterResolve('kicking'); });
        sel.appendChild(b);
      });
      body.appendChild(sel);

      if (_mode === 'table') {
        body.appendChild(ce('p', 'dwk-hint dwk-hint-sub', 'Flip a coin at the table if needed — 1–3 Home, 4–6 Away.'));
        return;
      }

      const flipRow = ce('div', 'dwk-flip-row');
      const die = mkDie('dwk-kick-flip-die');
      const flipBtn = ce('button', 'dmt-btn dwk-flip-btn');
      flipBtn.type = 'button';
      flipBtn.textContent = '🪙 Coin Flip (D6: 1–3 Home, 4–6 Away)';
      flipBtn.addEventListener('click', async () => {
        flipBtn.disabled = true;
        const roll = await Dice.rollDieElement(die);
        _setKicker(roll <= 3 ? 'home' : 'away', roll);
        _afterResolve('kicking');
      });
      flipRow.appendChild(die);
      flipRow.appendChild(flipBtn);
      body.appendChild(flipRow);
      if (_mode === 'auto') {
        body.appendChild(ce('p', 'dwk-hint dwk-hint-sub', 'Auto-Roll flips the coin if you don\'t choose.'));
      }
    },

    weather(body) {
      body.appendChild(ce('p', 'dwk-hint', 'Roll 2D6 on the Weather table.'));
      if (_mode === 'table') {
        const zone = ce('div', 'physical-zone');
        const data = window.BBData?.weather ?? [];
        window.PhysicalDice.showPhysicalButtons(zone, {
          columns: 3,
          buttons: Array.from({ length: 11 }, (_, i) => {
            const t = i + 2;
            const w = data.find(e => t >= e.rollMin && t <= e.rollMax);
            return { value: t, label: w ? `${w.emoji} ${w.name}` : '?',
                     cls: w && w.effect && w.effect !== 'No effect' ? 'phys-warn' : 'phys-neutral' };
          }),
          onSelect: t => { _setWeather(t); _afterResolve('weather'); },
        });
        body.appendChild(zone);
        return;
      }
      const tray = ce('div', 'dice-tray');
      tray.appendChild(mkDie('dwk-wth-d1'));
      tray.appendChild(mkDie('dwk-wth-d2'));
      body.appendChild(tray);
      if (_mode === 'manual') {
        const btn = ce('button', 'roll-btn dwk-roll-btn');
        btn.type = 'button';
        btn.innerHTML = '<span class="roll-btn-icon">🎲</span> Roll Weather';
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          const { d1, d2, total } = await Dice.roll2D6(tray.children[0], tray.children[1]);
          _setWeather(total, d1, d2);
          _afterResolve('weather');
        });
        body.appendChild(btn);
      }
    },

    prayers(body) {
      const { fh, fa, prayingName } = _prayersInfo();
      body.appendChild(ce('p', 'dwk-hint',
        `<strong>${h(prayingName)}</strong> fields fewer players (${Math.min(fh, fa)} vs ${Math.max(fh, fa)}) — its Coach may pray to Nuffle (D16).`));

      if (_mode === 'table') {
        const zone = ce('div', 'physical-zone');
        const data = window.BBData?.prayers ?? [];
        window.PhysicalDice.showPhysicalButtons(zone, {
          columns: 3,
          buttons: Array.from({ length: 16 }, (_, i) => {
            const v = i + 1;
            return { value: v, label: data.find(e => e.roll === v)?.name ?? '?' };
          }),
          onSelect: v => { _setPrayer(v); _afterResolve('prayers'); },
        });
        body.appendChild(zone);
      } else {
        const tray = ce('div', 'dice-tray single');
        tray.appendChild(mkDie('dwk-pr-d1', 16));
        body.appendChild(tray);
        if (_mode === 'manual') {
          const btn = ce('button', 'roll-btn dwk-roll-btn');
          btn.type = 'button';
          btn.innerHTML = '<span class="roll-btn-icon">🎲</span> Roll D16';
          btn.addEventListener('click', async () => {
            btn.disabled = true;
            const val = await Dice.rollDieElement(tray.children[0]);
            _setPrayer(val);
            _afterResolve('prayers');
          });
          body.appendChild(btn);
        }
      }

      const skip = ce('button', 'dwk-skip-btn');
      skip.type = 'button';
      skip.textContent = 'Skip — no prayer';
      skip.addEventListener('click', () => {
        _state.prayersDone = true;
        _state.prayersNote = 'Prayer skipped.';
        _afterResolve('prayers');
      });
      body.appendChild(skip);
    },

    deviation(body) {
      body.appendChild(ce('p', 'dwk-hint', 'D6 distance (squares) · D8 direction (scatter template).'));
      if (_mode === 'table') {
        let selDist = null;
        body.appendChild(ce('div', 'input-label dwk-sub-label', 'Distance (D6)'));
        const distZone = ce('div', 'physical-zone');
        window.PhysicalDice.showPhysicalButtons(distZone, {
          columns: 6,
          buttons: Array.from({ length: 6 }, (_, i) => ({ value: i + 1, label: `${i + 1}` })),
          onSelect(d) { selDist = d; dirLbl.hidden = false; dirZone.hidden = false; },
        });
        body.appendChild(distZone);
        const dirLbl = ce('div', 'input-label dwk-sub-label', 'Direction (D8)');
        dirLbl.hidden = true;
        body.appendChild(dirLbl);
        const dirZone = ce('div', 'physical-zone');
        dirZone.hidden = true;
        window.PhysicalDice.showCompassButtons(dirZone, dir => {
          _setDeviation(selDist, dir);
          _afterResolve('deviation');
        });
        body.appendChild(dirZone);
        return;
      }
      const tray = ce('div', 'dice-tray');
      tray.appendChild(mkDie('dwk-dev-d6'));
      tray.appendChild(mkDie('dwk-dev-d8', 8));
      body.appendChild(tray);
      if (_mode === 'manual') {
        const btn = ce('button', 'roll-btn dwk-roll-btn');
        btn.type = 'button';
        btn.innerHTML = '<span class="roll-btn-icon">🎲</span> Roll Deviation';
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          const [dist, dir] = await Promise.all([
            Dice.rollDieElement(tray.children[0]),
            Dice.rollDieElement(tray.children[1]),
          ]);
          _setDeviation(dist, dir);
          _afterResolve('deviation');
        });
        body.appendChild(btn);
      }
    },

    kickoff(body) {
      body.appendChild(ce('p', 'dwk-hint', 'Roll 2D6 on the Kickoff Event table.'));
      if (_mode === 'table') {
        const zone = ce('div', 'physical-zone');
        const data = window.BBData?.kickoff ?? [];
        window.PhysicalDice.showPhysicalButtons(zone, {
          columns: 3,
          buttons: Array.from({ length: 11 }, (_, i) => {
            const t = i + 2;
            return { value: t, label: data.find(e => e.roll === t)?.name ?? '?' };
          }),
          onSelect: t => { _setKickoff(t); _afterResolve('kickoff'); },
        });
        body.appendChild(zone);
        return;
      }
      const tray = ce('div', 'dice-tray');
      tray.appendChild(mkDie('dwk-ko-d1'));
      tray.appendChild(mkDie('dwk-ko-d2'));
      body.appendChild(tray);
      if (_mode === 'manual') {
        const btn = ce('button', 'roll-btn dwk-roll-btn');
        btn.type = 'button';
        btn.innerHTML = '<span class="roll-btn-icon">🎲</span> Roll Kickoff Event';
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          const { d1, d2, total } = await Dice.roll2D6(tray.children[0], tray.children[1]);
          _setKickoff(total, d1, d2);
          _afterResolve('kickoff');
        });
        body.appendChild(btn);
      }
    },
  };

  /* ── Resolved-panel result views ── */

  function _rollLine(roll) {
    if (!roll || roll.total == null) return '';
    const parts = roll.d1 != null ? ` <span class="dwk-res-dice">(${roll.d1} + ${roll.d2})</span>` : '';
    return `<div class="dwk-res-roll">${roll.total}${parts}</div>`;
  }

  function _renderPanelResult(key, body) {
    const wrap = ce('div', 'dwk-result');
    if (key === 'kicking') {
      const side  = _state.kickingTeam;
      const label = side === 'home' ? '🏠 Home team kicks off' : '✈️ Away team kicks off';
      wrap.innerHTML = `<div class="dwk-res-name">${label}</div>` +
        (_state.kickingRoll ? `<div class="dwk-res-dice">Coin flip: ${_state.kickingRoll}</div>` : '');
      const swap = ce('button', 'dwk-skip-btn');
      swap.type = 'button';
      swap.textContent = '⇄ Swap';
      swap.addEventListener('click', () => {
        _setKicker(side === 'home' ? 'away' : 'home');
        _rerenderPanel('kicking');
        _refreshSummary();
      });
      body.appendChild(wrap);
      body.appendChild(swap);
      return;
    }
    if (key === 'weather') {
      const w = _state.weather;
      const isPerfect = !w.effect || w.effect === 'No effect';
      wrap.innerHTML = _rollLine(_state.weatherRoll) +
        `<div class="dwk-res-name">${h(w.emoji)} ${h(w.name)}</div>` +
        (isPerfect
          ? '<span class="result-chip result-chip-ok">✓ No mechanical effect</span>'
          : `<span class="result-chip result-chip-warn">⚠ ${h(w.effect)}</span>`) +
        `<p class="dwk-res-desc">${h(w.desc)}</p>`;
    } else if (key === 'prayers') {
      wrap.innerHTML = _state.prayer
        ? `${_rollLine({ total: _state.prayerRoll })}` +
          `<div class="dwk-res-name">✦ ${h(_state.prayer.name)}</div>` +
          `<p class="dwk-res-desc">${h(_state.prayer.desc)}</p>`
        : `<div class="dwk-res-name">✦ No prayer</div>` +
          `<p class="dwk-res-desc">${h(_state.prayersNote ?? '')}</p>`;
    } else if (key === 'deviation') {
      const d = _state.deviation;
      wrap.innerHTML =
        `<div class="dwk-res-name">${d.dist} square${d.dist !== 1 ? 's' : ''}</div>` +
        `<div class="dwk-res-dir">${DIR[d.dir] ?? d.dir}</div>`;
    } else if (key === 'kickoff') {
      const ev  = _state.kickoff;
      const aff = KICKOFF_AFFECTS[_state.kickoffRoll?.total] ?? 'both';
      const chip = aff === 'kicking'
        ? '<span class="result-chip result-chip-warn">⚽ Kicking Team</span>'
        : aff === 'receiving'
        ? '<span class="result-chip result-chip-ok">🏆 Receiving Team</span>'
        : '<span class="result-chip result-chip-info">⚖️ Both Teams</span>';
      wrap.innerHTML = _rollLine(_state.kickoffRoll) +
        `<div class="dwk-res-name">${h(ev.name)}</div>` + chip +
        `<p class="dwk-res-desc">${h(ev.desc)}</p>`;
    }
    body.appendChild(wrap);
  }

  /* ── Summary strip — fills as results land ── */

  function _refreshSummary() {
    const el = document.getElementById('dwk-summary');
    if (!el) return;
    el.innerHTML = '';
    const chips = [];

    const kicker = _state.kickingTeam ?? window.GameState?.kickingTeam;
    if (kicker) chips.push({ cls: 'dwk-sum-info', text: `⚽ ${kicker === 'home' ? 'Home' : 'Away'} kicks` });
    const w = _state.weather ?? window.GameState?.currentWeather;
    if (w) {
      const isPerfect = !w.effect || w.effect === 'No effect';
      chips.push({ cls: isPerfect ? 'dwk-sum-ok' : 'dwk-sum-warn',
                   text: `${w.emoji} ${w.name}${isPerfect ? '' : ` — ${w.effect}`}` });
    }
    if (_state.prayer)    chips.push({ cls: 'dwk-sum-info', text: `✦ ${_state.prayer.name}` });
    if (_state.deviation) chips.push({ cls: 'dwk-sum-info', text: `⬡ ${_state.deviation.dist} sq ${DIR[_state.deviation.dir] ?? ''}` });
    if (_state.kickoff)   chips.push({ cls: 'dwk-sum-info', text: `⚡ ${_state.kickoff.name}` });

    if (_allResolved()) chips.push({ cls: 'dwk-sum-ready', text: '✓ Drive Ready — good luck!' });

    chips.forEach(c => el.appendChild(ce('span', `dwk-sum-chip ${c.cls}`, h(c.text))));

    el.appendChild(ce('span', 'dwk-setup-note',
      'Setup: kicking team first, at least 3 players on the line of scrimmage; ' +
      'receiving team sets up across; ball placed anywhere in the kicking half.'));
  }

  /* ── Primary button (repurposed #dw-next) ── */

  function _refreshBoardNav() {
    const backBtn = document.getElementById('dw-back');
    const nextBtn = document.getElementById('dw-next');
    if (backBtn) backBtn.style.display = 'none';
    if (!nextBtn) return;
    nextBtn.title = '';
    if (_mode === 'auto' && !_allResolved()) {
      nextBtn.textContent = _rolling ? '🎲 Rolling…' : '⚡ Roll Kickoff';
      nextBtn.disabled    = _rolling;
      nextBtn.classList.remove('dwk-ready');
      nextBtn.onclick     = _autoRollAll;
    } else {
      nextBtn.textContent = '▸ Play the Drive';
      nextBtn.disabled    = !_allResolved();
      nextBtn.classList.toggle('dwk-ready', _allResolved());
      nextBtn.onclick     = close;
    }
  }

  /* ── Auto-Roll: resolve every remaining panel in sequence ── */

  async function _autoRollAll() {
    if (_rolling) return;
    _rolling = true;
    _refreshBoardNav();
    for (const key of _boardKeys) {
      if (_isResolved(key)) continue;
      _rerenderPanel(key);           /* ensure the active dice tray is present */
      await _pause(220);
      await _autoResolve(key);
      if (!_isResolved(key)) break;  /* safety: never spin */
      await _pause(420);
    }
    _rolling = false;
    _refreshBoardNav();
  }

  async function _autoResolve(key) {
    const p = document.getElementById(`dwk-panel-${key}`);
    if (!p) return;
    const dice = p.querySelectorAll('.die');
    switch (key) {
      case 'kicking': {
        const roll = await Dice.rollDieElement(dice[0]);
        _setKicker(roll <= 3 ? 'home' : 'away', roll);
        break;
      }
      case 'weather': {
        const { d1, d2, total } = await Dice.roll2D6(dice[0], dice[1]);
        _setWeather(total, d1, d2);
        break;
      }
      case 'prayers': {
        /* Even teams already auto-resolved by _fillPanel; here a prayer is due */
        const val = await Dice.rollDieElement(dice[0]);
        _setPrayer(val);
        break;
      }
      case 'deviation': {
        const [dist, dir] = await Promise.all([
          Dice.rollDieElement(dice[0]),
          Dice.rollDieElement(dice[1]),
        ]);
        _setDeviation(dist, dir);
        break;
      }
      case 'kickoff': {
        const { d1, d2, total } = await Dice.roll2D6(dice[0], dice[1]);
        _setKickoff(total, d1, d2);
        break;
      }
    }
    _afterResolve(key);
  }

  /* ─────────────────────────────────────────────────────
     LEGACY STEP RENDERERS — drive-end flow only
     ──────────────────────────────────────────────────── */

  const STEPS = {

    /* ── DRIVE EFFECTS (end of drive) ── */
    effects(el) {
      el.innerHTML += '<p class="panel-intro">Resolve any end-of-drive effects before the KO recovery roll.</p>';

      const w = window.GameState?.currentWeather;

      const items = [];
      if (w?.name === 'Sweltering Heat') {
        items.push({ cls: 'result-chip-warn', text: '☀️ Sweltering Heat: each Coach rolls D3. Remove that many random players from the pitch to their Reserves Box.' });
      }
      items.push({ cls: 'result-chip-info', text: '⚠ Secret Weapon check: any player with a Secret Weapon who was on the pitch must roll D6. On a 2+, they are Sent Off (no Argue the Call). On a 1, nothing happens.' });

      items.forEach(item => {
        const div = document.createElement('div');
        div.className = `result-chip ${item.cls}`;
        div.style.cssText = 'display:block;margin-bottom:0.35rem;font-size:0.68rem;white-space:normal;line-height:1.5;padding:0.4rem 0.55rem;';
        div.textContent = item.text;
        el.appendChild(div);
      });
    },

    /* ── KO RECOVERY ── */
    ko_recovery(el) {
      el.innerHTML += '<p class="panel-intro">Each KO\'d player rolls D6. On 4+, they recover and return to the Reserves Box. On 1–3, they remain KO\'d.</p>';

      const allKO = [];
      ['left', 'right'].forEach(side => {
        (window.getPlayerList?.(side) ?? [])
          .filter(p => p.status === window.PlayerStatus?.KO)
          .forEach(p => allKO.push({ ...p, side }));
      });

      if (allKO.length === 0) {
        const note = document.createElement('p');
        note.className = 'panel-intro';
        note.style.color = 'rgba(130, 200, 130, 0.8)';
        note.textContent = 'No KO\'d players — everyone is fit to play!';
        el.appendChild(note);
        return;
      }

      allKO.forEach((p, i) => {
        const row = document.createElement('div');
        row.className = 'dw-ko-player';

        const name = document.createElement('span');
        name.className = 'dw-ko-name';
        name.textContent = `${p.name} (${p.side === 'left' ? 'Home' : 'Away'})`;
        row.appendChild(name);

        const resultSpan = document.createElement('span');
        resultSpan.className = 'dw-ko-result';
        row.appendChild(resultSpan);

        if (!isPhys()) {
          const dieEl = mkDie(`dw-ko-die-${i}`);
          dieEl.style.cssText = 'width:26px;height:26px;flex-shrink:0;';
          const rollBtn = document.createElement('button');
          rollBtn.type = 'button'; rollBtn.className = 'dmt-btn';
          rollBtn.style.padding = '0.28rem 0.5rem';
          rollBtn.textContent = '🎲';
          rollBtn.addEventListener('click', async () => {
            rollBtn.disabled = true;
            const roll = await Dice.rollDieElement(dieEl);
            _applyKORecovery(p, roll, resultSpan);
          });
          row.appendChild(dieEl);
          row.appendChild(rollBtn);
        } else {
          const miniZone = document.createElement('div');
          miniZone.style.cssText = 'display:flex;gap:0.18rem;flex-shrink:0;';
          [1,2,3,4,5,6].forEach(v => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `phys-btn ${v >= 4 ? 'phys-good' : 'phys-muted'}`;
            btn.style.cssText = 'min-height:1.7rem;padding:0.18rem 0.28rem;';
            btn.innerHTML = `<span class="phys-val" style="font-size:0.75rem;">${v}</span>`;
            btn.addEventListener('click', () => {
              miniZone.querySelectorAll('button').forEach(b => b.disabled = true);
              _applyKORecovery(p, v, resultSpan);
            });
            miniZone.appendChild(btn);
          });
          row.appendChild(miniZone);
        }
        el.appendChild(row);
      });
    },
  };

  function _applyKORecovery(player, roll, resultSpan) {
    if (roll >= 4) {
      resultSpan.className = 'dw-ko-result ok';
      resultSpan.textContent = `${roll} ✓ Returns!`;
      window.setPlayerStatus?.(player.side, player.idx, window.PlayerStatus?.AVAILABLE);
    } else {
      resultSpan.className = 'dw-ko-result bad';
      resultSpan.textContent = `${roll} ✗ Stays KO`;
    }
  }

  /* Public surface */
  return { open, close, minimise, restore };

})();

window.DriveWizard = DriveWizard;
