'use strict';

/* ═══════════════════════════════════════════════════════
   Blood Bowl Companion — js/game-timeline.js
   Full-width game timeline: two team rows × two halves of
   8 turn-cells, the current turn highlighted, with event
   markers (touchdown / injury / fumble / sending-off) placed
   on the turn they occurred. Markers show detail on hover
   (title) and click (popover). Reads GameState (turn,
   activeTeam, half, gameLog); re-renders on game events.
   ═══════════════════════════════════════════════════════ */

(function () {

  const TURNS = 8;

  const MARKERS = {
    touchdown: { glyph: '🏆', cls: 'tl-m-td',    label: 'Touchdown' },
    injury:    { glyph: '✚',  cls: 'tl-m-inj',   label: 'Injury' },
    fumble:    { glyph: '⚽', cls: 'tl-m-fum',   label: 'Fumble' },
    'sent-off':{ glyph: '🟥', cls: 'tl-m-off',   label: 'Sent off' },
  };

  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function teamName(team) {
    const side = team === 'home' ? 'left' : 'right';
    return window.state?.[side]?.team?.name || (team === 'home' ? 'Home' : 'Away');
  }

  function render() {
    const host = document.getElementById('bb-game-timeline');
    if (!host) return;
    const g = window.GameState;
    if (!g) { host.innerHTML = ''; return; }

    const curHalf = g.half || 1;
    const active  = g.activeTeam;
    const turn    = g.turn || { home: 0, away: 0 };

    /* Bucket events by team|half|turn */
    const byCell = {};
    (g.gameLog || []).forEach(ev => {
      const team = ev.activeTeam;
      if (!team || !MARKERS[ev.type]) return;
      const half = ev.half || 1;
      const t    = Math.min(TURNS, Math.max(1, ev.turn || 1));
      (byCell[`${team}|${half}|${t}`] ||= []).push(ev);
    });

    host.innerHTML = '';
    const tl = document.createElement('div');
    tl.className = 'bb-tl';

    /* Header: half labels aligned over the two 8-cell blocks */
    tl.appendChild(rowEl('', [halfLabel('First Half'), halfLabel('Second Half')], 'bb-tl-headrow'));

    ['home', 'away'].forEach(team => {
      const blocks = [1, 2].map(half => {
        const block = document.createElement('div');
        block.className = 'bb-tl-half';
        for (let t = 1; t <= TURNS; t++) {
          const cell = document.createElement('div');
          cell.className = 'bb-tl-cell';
          const played  = half < curHalf || (half === curHalf && t <= (turn[team] || 0));
          const current = half === curHalf && team === active && t === (turn[team] || 0);
          if (played)  cell.classList.add('bb-tl-cell--played');
          if (current) cell.classList.add('bb-tl-cell--current');
          cell.title = `${teamName(team)} · ${half === 1 ? '1st' : '2nd'} half · turn ${t}`;

          (byCell[`${team}|${half}|${t}`] || []).forEach(ev => cell.appendChild(markerEl(ev)));
          block.appendChild(cell);
        }
        return block;
      });
      tl.appendChild(rowEl(teamName(team), blocks, 'bb-tl-row' + (team === active ? ' bb-tl-row--active' : '')));
    });

    host.appendChild(tl);
  }

  function rowEl(labelText, blocks, cls) {
    const row = document.createElement('div');
    row.className = cls;
    const label = document.createElement('div');
    label.className = 'bb-tl-rowlabel';
    label.textContent = labelText;
    label.title = labelText;
    row.appendChild(label);
    blocks.forEach((b, i) => {
      if (i > 0) { const sep = document.createElement('div'); sep.className = 'bb-tl-sep'; row.appendChild(sep); }
      row.appendChild(b);
    });
    return row;
  }

  function halfLabel(text) {
    const d = document.createElement('div');
    d.className = 'bb-tl-halflabel';
    d.textContent = text;
    return d;
  }

  function markerEl(ev) {
    const m = MARKERS[ev.type];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `bb-tl-marker ${m.cls}`;
    btn.textContent = m.glyph;
    const detail = ev.detail || m.label;
    btn.title = `${m.label}: ${detail}`;
    btn.addEventListener('click', e => { e.stopPropagation(); showPop(btn, m.label, detail); });
    return btn;
  }

  let _pop = null;
  function showPop(anchor, title, detail) {
    hidePop();
    const host = document.getElementById('bb-game-timeline');
    if (!host) return;
    _pop = document.createElement('div');
    _pop.className = 'bb-tl-pop';
    _pop.innerHTML = `<span class="bb-tl-pop-title">${esc(title)}</span><span class="bb-tl-pop-detail">${esc(detail)}</span>`;
    host.appendChild(_pop);
    const a = anchor.getBoundingClientRect();
    const h = host.getBoundingClientRect();
    _pop.style.left = `${a.left - h.left + a.width / 2}px`;
    _pop.style.top  = `${a.bottom - h.top + 6}px`;
    setTimeout(() => document.addEventListener('click', hidePop, { once: true }), 0);
  }
  function hidePop() { if (_pop) { _pop.remove(); _pop = null; } }

  document.addEventListener('bb:gameEvent', render);
  document.addEventListener('bb:turnEnd', render);
  document.addEventListener('bb:phase', render);
  window.addEventListener('resize', hidePop);

  window.BBGameTimeline = { render };
})();
