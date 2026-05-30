'use strict';

/* ═══════════════════════════════════════════════════════
   Blood Bowl Companion — js/team-builder.js
   Custom team creation, storage, export/import, and
   in-game loading.
   ═══════════════════════════════════════════════════════ */

const TeamBuilder = (() => {

  const STORE_KEY   = 'bb_teams';
  const START_GP    = 1_000_000;
  const STAFF_COSTS = { fanFactor: 10_000, assistantCoaches: 10_000, cheerleaders: 10_000 };
  const APOTH_COST  = 50_000;

  /* ─── Storage ─────────────────────────────────────── */

  function getTeams() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]'); } catch { return []; }
  }

  function setTeams(teams) {
    localStorage.setItem(STORE_KEY, JSON.stringify(teams));
  }

  function getTeam(id) {
    return getTeams().find(t => t.id === id) ?? null;
  }

  function saveTeam(team) {
    const all = getTeams();
    const idx = all.findIndex(t => t.id === team.id);
    if (idx >= 0) all[idx] = team; else all.push(team);
    setTeams(all);
  }

  function deleteTeam(id) {
    setTeams(getTeams().filter(t => t.id !== id));
  }

  /* ─── Helpers ─────────────────────────────────────── */

  function uuid() {
    return (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function h(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function fmtGP(n) {
    return (n / 1000).toFixed(0) + 'k gp';
  }

  /* Parse max qty from "0-16" / "0–2" format */
  function parseMaxQty(qtyStr) {
    const m = String(qtyStr ?? '').match(/\d+[–\-](\d+)/);
    return m ? parseInt(m[1], 10) : 1;
  }

  /* Treasury calculation */
  function calcTreasury(draft, baseTeam) {
    let spent = draft.players.reduce((s, p) => s + (p.value ?? 0), 0);
    spent += draft.rerolls        * (baseTeam?.reroll ?? 60_000);
    spent += draft.fanFactor      * STAFF_COSTS.fanFactor;
    spent += draft.assistantCoaches * STAFF_COSTS.assistantCoaches;
    spent += draft.cheerleaders   * STAFF_COSTS.cheerleaders;
    spent += draft.apothecary     ? APOTH_COST : 0;
    return { remaining: START_GP - spent, spent };
  }

  /* ─── Export / Import ─────────────────────────────── */

  function exportTeam(id) {
    const team = getTeam(id);
    if (!team) return;
    const blob = new Blob([JSON.stringify(team, null, 2)], { type: 'application/json' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `${(team.name || 'team').replace(/[^a-z0-9]/gi, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  function importTeam(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      if (!data.name || !data.baseTeamId || !Array.isArray(data.players)) {
        return { ok: false, error: 'Invalid team structure: missing name, baseTeamId, or players array' };
      }
      data.id = uuid();   /* always assign fresh ID on import */
      saveTeam(data);
      return { ok: true, team: data };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /* ─── Load into game ──────────────────────────────── */

  async function loadIntoGame(id, side) {
    const team = getTeam(id);
    if (!team) return;
    if (window.loadCustomTeam) {
      await window.loadCustomTeam(side, team);
    }
  }

  /* ══════════════════════════════════════════════════════
     UI STATE
     ══════════════════════════════════════════════════════ */

  let _view      = 'list';    /* 'list' | 'builder' */
  let _draft     = null;      /* team being built */
  let _rosterData    = null;  /* fetched roster positions for selected race */
  let _teamsData     = null;  /* cache of data/teams.json */
  let _boxTeamsData  = null;  /* cache of data/box-teams.json */
  let _starPlayersData = null; /* cache of data/star-players.json */

  async function _getTeamsData() {
    if (_teamsData) return _teamsData;
    try {
      const res = await fetch('data/teams.json');
      _teamsData = await res.json();
    } catch { _teamsData = []; }
    return _teamsData;
  }

  async function _getBoxTeamsData() {
    if (_boxTeamsData) return _boxTeamsData;
    try {
      const res = await fetch('data/box-teams.json');
      _boxTeamsData = await res.json();
    } catch { _boxTeamsData = {}; }
    return _boxTeamsData;
  }

  async function _getStarPlayersData() {
    if (_starPlayersData) return _starPlayersData;
    try {
      const res = await fetch('data/star-players.json');
      _starPlayersData = await res.json();
    } catch { _starPlayersData = []; }
    return _starPlayersData;
  }

  async function _fetchRoster(fileUrl) {
    try {
      const res = await fetch(fileUrl);
      return await res.json();
    } catch { return []; }
  }

  /* ══════════════════════════════════════════════════════
     PUBLIC — open / close
     ══════════════════════════════════════════════════════ */

  function open(initialView = 'list') {
    _view = initialView;
    const el = document.getElementById('tb-overlay');
    if (el) el.hidden = false;
    _render();
  }

  function close() {
    const el = document.getElementById('tb-overlay');
    if (el) el.hidden = true;
  }

  /* ══════════════════════════════════════════════════════
     RENDER DISPATCHER
     ══════════════════════════════════════════════════════ */

  function _render() {
    const container = document.getElementById('tb-container');
    if (!container) return;
    container.innerHTML = '';

    /* Header */
    const header = document.createElement('div');
    header.className = 'tb-header';
    header.innerHTML = `
      <div class="tb-title">⬡ Team Builder</div>
      <button class="tb-close" id="tb-close-btn" aria-label="Close team builder">&#215;</button>
    `;
    container.appendChild(header);
    document.getElementById('tb-close-btn').addEventListener('click', close);

    /* Tabs */
    const tabs = document.createElement('div');
    tabs.className = 'tb-tabs';
    [{ id: 'list', label: 'My Teams' }, { id: 'builder', label: '+ New Team' }].forEach(t => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = `tb-tab${_view === t.id ? ' active' : ''}`;
      btn.textContent = t.label;
      btn.addEventListener('click', () => { _view = t.id; if (t.id === 'builder') _initDraft(); _render(); });
      tabs.appendChild(btn);
    });
    container.appendChild(tabs);

    /* Body */
    const body = document.createElement('div');
    body.className = 'tb-body';
    container.appendChild(body);

    if (_view === 'list') _renderList(body);
    else                  _renderBuilder(body);
  }

  /* ══════════════════════════════════════════════════════
     MY TEAMS LIST VIEW
     ══════════════════════════════════════════════════════ */

  function _renderList(body) {
    const teams = getTeams();

    /* Import zone */
    const importZone = document.createElement('div');
    importZone.className = 'tb-import-zone';
    importZone.textContent = '⬆ Import team from JSON file — tap to browse';
    importZone.addEventListener('click', () => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.json,application/json';
      inp.addEventListener('change', () => {
        const file = inp.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
          const result = importTeam(e.target.result);
          if (result.ok) {
            _showToast(`✓ Imported: ${result.team.name}`);
            _render();
          } else {
            _showToast(`✗ Import failed: ${result.error}`, true);
          }
        };
        reader.readAsText(file);
      });
      inp.click();
    });
    body.appendChild(importZone);

    if (teams.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'panel-intro';
      empty.style.cssText = 'margin:1rem 0;text-align:center;opacity:0.5;';
      empty.textContent = 'No saved teams yet. Click "+ New Team" to create one.';
      body.appendChild(empty);
      return;
    }

    /* Team grid */
    const grid = document.createElement('div');
    grid.className = 'tb-team-grid';
    grid.style.marginTop = '0.6rem';

    teams.forEach(team => {
      const card = document.createElement('div');
      card.className = 'tb-team-card';
      const { remaining } = calcTreasury(team, null);
      card.innerHTML = `
        <div class="tb-team-card-name">${h(team.name)}</div>
        <div class="tb-team-card-meta">${h(team.baseTeamId)} · ${team.players.length} players · ${team.rerolls} RR · ${fmtGP(remaining)} left</div>
      `;

      const actions = document.createElement('div');
      actions.className = 'tb-team-card-actions';

      /* Load Home */
      const loadHome = document.createElement('button');
      loadHome.type = 'button'; loadHome.className = 'tb-action-btn load';
      loadHome.textContent = '▸ Home';
      loadHome.title = 'Load as Home team';
      loadHome.addEventListener('click', async () => {
        await loadIntoGame(team.id, 'left');
        close();
        _showToast(`✓ ${team.name} loaded as Home`);
      });

      /* Load Away */
      const loadAway = document.createElement('button');
      loadAway.type = 'button'; loadAway.className = 'tb-action-btn load';
      loadAway.textContent = '▸ Away';
      loadAway.title = 'Load as Away team';
      loadAway.addEventListener('click', async () => {
        await loadIntoGame(team.id, 'right');
        close();
        _showToast(`✓ ${team.name} loaded as Away`);
      });

      /* Export */
      const expBtn = document.createElement('button');
      expBtn.type = 'button'; expBtn.className = 'tb-action-btn';
      expBtn.textContent = '⬇ Export';
      expBtn.addEventListener('click', () => exportTeam(team.id));

      /* Edit */
      const editBtn = document.createElement('button');
      editBtn.type = 'button'; editBtn.className = 'tb-action-btn';
      editBtn.textContent = '✏ Edit';
      editBtn.addEventListener('click', () => {
        _draft = JSON.parse(JSON.stringify(team));
        _view = 'builder';
        _renderBuilderWithDraft();
      });

      /* Delete */
      const delBtn = document.createElement('button');
      delBtn.type = 'button'; delBtn.className = 'tb-action-btn del';
      delBtn.textContent = '✕ Delete';
      delBtn.addEventListener('click', () => {
        if (confirm(`Delete "${team.name}"? This cannot be undone.`)) {
          deleteTeam(team.id);
          _render();
        }
      });

      [loadHome, loadAway, expBtn, editBtn, delBtn].forEach(b => actions.appendChild(b));
      card.appendChild(actions);
      grid.appendChild(card);
    });

    body.appendChild(grid);
  }

  /* ══════════════════════════════════════════════════════
     NEW TEAM BUILDER VIEW
     ══════════════════════════════════════════════════════ */

  function _initDraft() {
    if (!_draft) {
      _draft = {
        id:               uuid(),
        name:             '',
        baseTeamId:       null,
        rerolls:          0,
        fanFactor:        0,
        assistantCoaches: 0,
        cheerleaders:     0,
        apothecary:       false,
        players:          [],
      };
      _rosterData = null;
    }
  }

  async function _renderBuilderWithDraft() {
    /* Fetch roster for pre-existing draft's base team */
    if (_draft.baseTeamId && !_rosterData) {
      const all  = await _getTeamsData();
      const base = all.find(t => t.id === _draft.baseTeamId);
      if (base) _rosterData = await _fetchRoster(base.file);
    }
    await Promise.all([_getBoxTeamsData(), _getStarPlayersData()]);
    _render();
  }

  function _renderBuilder(body) {
    if (!_draft) _initDraft();

    /* ── Team name ── */
    const nameSec = document.createElement('div');
    nameSec.className = 'tb-section';
    nameSec.innerHTML = '<div class="tb-section-title">Team Name</div>';
    const nameInp = document.createElement('input');
    nameInp.type = 'text'; nameInp.className = 'tb-name-field';
    nameInp.placeholder = 'e.g. Skavenblight Scramblers';
    nameInp.value = _draft.name;
    nameInp.addEventListener('input', () => { _draft.name = nameInp.value; _refreshTreasury(body); });
    nameSec.appendChild(nameInp);
    body.appendChild(nameSec);

    /* ── Race selection ── */
    const raceSec = document.createElement('div');
    raceSec.className = 'tb-section';
    raceSec.innerHTML = '<div class="tb-section-title">Base Race</div>';

    _getTeamsData().then(teamsData => {
      const grid = document.createElement('div');
      grid.className = 'tb-race-grid';

      teamsData.forEach(team => {
        if (!team.file) return;  /* skip entries without a roster file */
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = `tb-race-btn${_draft.baseTeamId === team.id ? ' active' : ''}`;
        btn.textContent = team.name;
        btn.dataset.teamId = team.id;

        btn.addEventListener('click', async () => {
          grid.querySelectorAll('.tb-race-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          _draft.baseTeamId = team.id;
          _draft.rerolls    = 0;
          _draft.players    = [];
          [_rosterData] = await Promise.all([
            _fetchRoster(team.file),
            _getBoxTeamsData(),
            _getStarPlayersData(),
          ]);

          _render();
        });

        grid.appendChild(btn);
      });

      raceSec.appendChild(grid);

      /* Re-attach listener after async re-inject */
      const existing = raceSec.querySelector('.tb-race-grid');
      if (existing && existing !== grid) existing.replaceWith(grid);
    });

    body.appendChild(raceSec);

    /* ── Treasury ── */
    const treasury = document.createElement('div');
    treasury.className = 'tb-treasury';
    treasury.id = 'tb-treasury';
    body.appendChild(treasury);
    _refreshTreasury(body);

    if (!_rosterData || !_draft.baseTeamId) return;

    /* ── Box team banner ── */
    const boxEntry = _boxTeamsData?.[ _draft.baseTeamId];
    if (boxEntry && _draft.players.filter(p => !p.isStarPlayer).length === 0) {
      const banner = document.createElement('div');
      banner.className = 'tb-box-banner';
      banner.innerHTML = `<span class="tb-box-label">📦 ${h(boxEntry.label)}</span>`;
      const useBtn = document.createElement('button');
      useBtn.type = 'button'; useBtn.className = 'tb-box-btn';
      useBtn.textContent = 'Use Starter Roster';
      useBtn.addEventListener('click', () => _loadBoxTeam(boxEntry));
      banner.appendChild(useBtn);
      body.appendChild(banner);
    }

    /* ── Roster ── */
    const rosterSec = document.createElement('div');
    rosterSec.className = 'tb-section';
    rosterSec.innerHTML = '<div class="tb-section-title">Roster</div>';
    body.appendChild(rosterSec);

    const rosterList = document.createElement('div');
    rosterSec.appendChild(rosterList);

    _rosterData
      .filter(pos => !pos.isStarPlayer)  /* exclude star players */
      .forEach(pos => {
        const maxQty   = parseMaxQty(pos.qty);
        const curCount = _draft.players.filter(p => p.rosterSlotId === pos.id).length;

        const row = document.createElement('div');
        row.className = 'tb-pos-row';
        row.dataset.rosterSlotId = pos.id;

        const minusBtn = document.createElement('button');
        minusBtn.type = 'button'; minusBtn.className = 'tb-qty-btn';
        minusBtn.textContent = '−'; minusBtn.disabled = curCount === 0;
        minusBtn.addEventListener('click', () => {
          const idx = _draft.players.findLastIndex?.(p => p.rosterSlotId === pos.id)
                   ?? [..._draft.players].reverse().findIndex(p => p.rosterSlotId === pos.id);
          /* findLastIndex may not exist everywhere */
          let actualIdx = -1;
          for (let i = _draft.players.length - 1; i >= 0; i--) {
            if (_draft.players[i].rosterSlotId === pos.id) { actualIdx = i; break; }
          }
          if (actualIdx >= 0) {
            _draft.players.splice(actualIdx, 1);
            _render();
          }
        });

        const countEl = document.createElement('span');
        countEl.className = 'tb-pos-count'; countEl.textContent = curCount;

        const plusBtn = document.createElement('button');
        plusBtn.type = 'button'; plusBtn.className = 'tb-qty-btn';
        plusBtn.textContent = '+'; plusBtn.disabled = curCount >= maxQty;
        plusBtn.addEventListener('click', () => {
          const { remaining } = _calcDraftTreasury();
          if (remaining < (pos.value ?? 0)) {
            _showToast('✗ Not enough gold!', true); return;
          }
          if (curCount >= maxQty) return;
          const num = _draft.players.filter(p => p.rosterSlotId === pos.id).length + 1;
          _draft.players.push({
            id:               uuid(),
            rosterSlotId:     pos.id,
            name:             `${pos.position} ${num}`,
            jerseyNumber:     _draft.players.length + 1,
            position:         pos.position,
            ma: pos.ma, st: pos.st, ag: pos.ag, pa: pos.pa, av: pos.av,
            skills:           pos.skills ?? '',
            value:            pos.value ?? 0,
            spp:              0,
            learnedSkills:    [],
            nigglingInjuries: 0,
            missingNextGame:  false,
            dead:             false,
            statModifiers:    {},
          });
          _render();
        });

        const nameEl = document.createElement('span');
        nameEl.className = 'tb-pos-name'; nameEl.textContent = pos.position;

        const maxEl = document.createElement('span');
        maxEl.className = 'tb-pos-max'; maxEl.textContent = `/ ${maxQty}`;

        const costEl = document.createElement('span');
        costEl.className = 'tb-pos-cost'; costEl.textContent = pos.value ? fmtGP(pos.value) : '—';

        row.appendChild(minusBtn); row.appendChild(countEl); row.appendChild(plusBtn);
        row.appendChild(nameEl); row.appendChild(maxEl); row.appendChild(costEl);
        rosterList.appendChild(row);
      });

    /* ── Player names ── */
    if (_draft.players.length > 0) {
      const playersSec = document.createElement('div');
      playersSec.className = 'tb-section';
      playersSec.innerHTML = '<div class="tb-section-title">Player Names &amp; Numbers</div>';
      const list = document.createElement('div');
      list.className = 'tb-players-list';

      _draft.players.forEach((p, i) => {
        const row = document.createElement('div');
        row.className = `tb-player-row${p.isStarPlayer ? ' star-player-row' : ''}`;

        if (p.isStarPlayer) {
          /* Star players: read-only name badge, no jersey edit */
          const badge = document.createElement('span');
          badge.className = 'tb-pos-pill star-pill';
          badge.textContent = '★';
          const nameEl = document.createElement('span');
          nameEl.className = 'tb-pname-static';
          nameEl.textContent = p.name;
          const pos = document.createElement('span');
          pos.className = 'tb-pos-pill'; pos.textContent = 'Star Player';
          row.appendChild(badge); row.appendChild(nameEl); row.appendChild(pos);
        } else {
          const jInp = document.createElement('input');
          jInp.type = 'text'; jInp.className = 'tb-jersey-inp';
          jInp.value = p.jerseyNumber; jInp.placeholder = '#';
          jInp.addEventListener('change', () => { p.jerseyNumber = parseInt(jInp.value, 10) || (i + 1); });

          const nInp = document.createElement('input');
          nInp.type = 'text'; nInp.className = 'tb-pname-inp';
          nInp.value = p.name; nInp.placeholder = 'Player name';
          nInp.addEventListener('input', () => { p.name = nInp.value; });

          const pos = document.createElement('span');
          pos.className = 'tb-pos-pill'; pos.textContent = p.position;

          row.appendChild(jInp); row.appendChild(nInp); row.appendChild(pos);
        }
        list.appendChild(row);
      });
      playersSec.appendChild(list);
      body.appendChild(playersSec);
    }

    /* ── Star Players ── */
    _renderStarPlayerSection(body);

    /* ── Staff & Extras ── */
    _renderStaffSection(body);

    /* ── Save button ── */
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button'; saveBtn.className = 'roll-btn';
    saveBtn.style.cssText = 'width:100%;margin-top:1rem;';
    saveBtn.innerHTML = '<span class="roll-btn-icon">💾</span> Save Team';
    saveBtn.addEventListener('click', () => {
      if (!_draft.name.trim()) {
        _showToast('✗ Please give your team a name', true); return;
      }
      if (!_draft.baseTeamId) {
        _showToast('✗ Please select a base race', true); return;
      }
      if (_draft.players.length < 11) {
        _showToast(`✗ Need at least 11 players (have ${_draft.players.length})`, true); return;
      }
      const { remaining } = _calcDraftTreasury();
      if (remaining < 0) {
        _showToast('✗ Over budget! Remove some players or staff', true); return;
      }
      _draft.treasury = remaining;
      saveTeam(_draft);
      _showToast(`✓ Saved: ${_draft.name}`);
      _draft = null;
      _rosterData = null;
      _view = 'list';
      _render();
    });
    body.appendChild(saveBtn);
  }

  function _loadBoxTeam(boxEntry) {
    if (!_rosterData || !boxEntry) return;
    _draft.players = _draft.players.filter(p => p.isStarPlayer);
    boxEntry.positions.forEach(({ positionId, count }) => {
      const pos = _rosterData.find(r => r.id === positionId);
      if (!pos) return;
      for (let i = 0; i < count; i++) {
        const num = _draft.players.filter(p => !p.isStarPlayer && p.rosterSlotId === pos.id).length + i + 1;
        _draft.players.push({
          id:               uuid(),
          rosterSlotId:     pos.id,
          name:             `${pos.position} ${num}`,
          jerseyNumber:     _draft.players.length + 1,
          position:         pos.position,
          ma: pos.ma, st: pos.st, ag: pos.ag, pa: pos.pa, av: pos.av,
          skills:           pos.skills ?? '',
          value:            pos.value ?? 0,
          spp:              0,
          learnedSkills:    [],
          nigglingInjuries: 0,
          missingNextGame:  false,
          dead:             false,
          statModifiers:    {},
          isStarPlayer:     false,
        });
      }
    });
    _render();
  }

  function _renderStarPlayerSection(body) {
    if (!_starPlayersData || !_draft.baseTeamId) return;

    const eligible = _starPlayersData.filter(sp => sp.eligibleTeams.includes(_draft.baseTeamId));
    if (eligible.length === 0) return;

    const hiredStars = _draft.players.filter(p => p.isStarPlayer);
    const starSlotsFilled = hiredStars.length;

    const sec = document.createElement('div');
    sec.className = 'tb-section tb-star-section';
    sec.innerHTML = '<div class="tb-section-title">★ Star Players</div>';

    const note = document.createElement('p');
    note.className = 'tb-star-note';
    note.textContent = `${starSlotsFilled}/2 slots filled · Stars use Loner and cannot be renamed`;
    sec.appendChild(note);

    const list = document.createElement('div');
    list.className = 'tb-star-list';

    eligible.forEach(sp => {
      const isHired = hiredStars.some(p => p.starPlayerId === sp.id);
      const isPair  = sp.isPair === true;
      const slotsNeeded = isPair ? 2 : 1;
      const canHire = !isHired && (starSlotsFilled + slotsNeeded <= 2);

      const row = document.createElement('div');
      row.className = `tb-star-row${isHired ? ' hired' : ''}`;

      const namePart = document.createElement('div');
      namePart.className = 'tb-star-name';
      namePart.innerHTML = `<span class="tb-star-badge">★${isPair ? '★' : ''}</span> ${h(sp.name)}`;

      const statPart = document.createElement('div');
      statPart.className = 'tb-star-stats';
      if (isPair) {
        statPart.textContent = sp.players.map(p => p.name).join(' + ');
      } else {
        statPart.textContent = `${sp.ma}/${sp.st}/${sp.ag}/${sp.pa}/${sp.av}`;
      }

      const costPart = document.createElement('span');
      costPart.className = 'tb-star-cost';
      costPart.textContent = fmtGP(sp.value);

      const actionBtn = document.createElement('button');
      actionBtn.type = 'button';

      if (isHired) {
        actionBtn.className = 'tb-qty-btn tb-star-release';
        actionBtn.textContent = 'Release';
        actionBtn.addEventListener('click', () => {
          _draft.players = _draft.players.filter(p => p.starPlayerId !== sp.id);
          _render();
        });
      } else {
        actionBtn.className = 'tb-qty-btn';
        actionBtn.textContent = 'Hire';
        actionBtn.disabled = !canHire;
        if (canHire) {
          actionBtn.addEventListener('click', () => {
            const { remaining } = _calcDraftTreasury();
            if (remaining < sp.value) { _showToast('✗ Not enough gold!', true); return; }
            if (isPair) {
              sp.players.forEach((pp, idx) => {
                _draft.players.push({
                  id:           uuid(),
                  rosterSlotId: null,
                  starPlayerId: sp.id,
                  name:         pp.name,
                  jerseyNumber: _draft.players.length + 1,
                  position:     'Star Player',
                  ma: pp.ma, st: pp.st, ag: pp.ag, pa: pp.pa, av: pp.av,
                  skills:       pp.skills ?? '',
                  value:        idx === 0 ? sp.value : 0,
                  spp: 0, learnedSkills: [], nigglingInjuries: 0,
                  missingNextGame: false, dead: false, statModifiers: {},
                  isStarPlayer: true,
                });
              });
            } else {
              _draft.players.push({
                id:           uuid(),
                rosterSlotId: null,
                starPlayerId: sp.id,
                name:         sp.name,
                jerseyNumber: _draft.players.length + 1,
                position:     'Star Player',
                ma: sp.ma, st: sp.st, ag: sp.ag, pa: sp.pa, av: sp.av,
                skills:       sp.skills ?? '',
                value:        sp.value,
                spp: 0, learnedSkills: [], nigglingInjuries: 0,
                missingNextGame: false, dead: false, statModifiers: {},
                isStarPlayer: true,
              });
            }
            _render();
          });
        }
      }

      row.appendChild(namePart);
      row.appendChild(statPart);
      row.appendChild(costPart);
      row.appendChild(actionBtn);
      list.appendChild(row);
    });

    sec.appendChild(list);
    body.appendChild(sec);
  }

  function _renderStaffSection(body) {
    const allTeams = _teamsData ?? [];
    const baseTeam = allTeams.find(t => t.id === _draft.baseTeamId);
    const rrCost   = baseTeam?.reroll ?? 60_000;

    const sec = document.createElement('div');
    sec.className = 'tb-section';
    sec.innerHTML = '<div class="tb-section-title">Staff &amp; Extras</div>';

    const staffDefs = [
      { key: 'rerolls',          label: 'Team Re-rolls',    cost: rrCost,    min: 0, max: 8 },
      { key: 'fanFactor',        label: 'Fan Factor',        cost: 10_000,   min: 0, max: 6 },
      { key: 'assistantCoaches', label: 'Assistant Coaches', cost: 10_000,   min: 0, max: 6 },
      { key: 'cheerleaders',     label: 'Cheerleaders',      cost: 10_000,   min: 0, max: 12 },
    ];

    staffDefs.forEach(def => {
      const row = document.createElement('div');
      row.className = 'tb-staff-row';

      const infoEl = document.createElement('div');
      infoEl.className = 'tb-staff-info';
      infoEl.innerHTML = `<span class="tb-staff-label">${def.label}</span><span class="tb-staff-cost">${fmtGP(def.cost)} each</span>`;

      const ctrl = document.createElement('div');
      ctrl.className = 'tb-staff-ctrl';

      const minusBtn = document.createElement('button');
      minusBtn.type = 'button'; minusBtn.className = 'tb-qty-btn';
      minusBtn.textContent = '−';

      const valEl = document.createElement('span');
      valEl.className = 'tb-staff-val'; valEl.textContent = _draft[def.key];

      const plusBtn = document.createElement('button');
      plusBtn.type = 'button'; plusBtn.className = 'tb-qty-btn';
      plusBtn.textContent = '+';

      function update() {
        valEl.textContent       = _draft[def.key];
        minusBtn.disabled       = _draft[def.key] <= def.min;
        plusBtn.disabled        = _draft[def.key] >= def.max;
        _refreshTreasury(body.parentElement ?? body);
      }

      minusBtn.addEventListener('click', () => {
        if (_draft[def.key] > def.min) { _draft[def.key]--; update(); }
      });
      plusBtn.addEventListener('click', () => {
        const { remaining } = _calcDraftTreasury();
        if (remaining < def.cost) { _showToast('✗ Not enough gold!', true); return; }
        if (_draft[def.key] < def.max) { _draft[def.key]++; update(); }
      });

      minusBtn.disabled = _draft[def.key] <= def.min;
      plusBtn.disabled  = _draft[def.key] >= def.max;

      ctrl.appendChild(minusBtn); ctrl.appendChild(valEl); ctrl.appendChild(plusBtn);
      row.appendChild(infoEl); row.appendChild(ctrl);
      sec.appendChild(row);
    });

    /* Apothecary toggle */
    const apothRow = document.createElement('div');
    apothRow.className = 'tb-staff-row';
    apothRow.innerHTML = `<div class="tb-staff-info"><span class="tb-staff-label">Apothecary</span><span class="tb-staff-cost">${fmtGP(APOTH_COST)}</span></div>`;
    const apothBtn = document.createElement('button');
    apothBtn.type = 'button';
    apothBtn.className = `mod-toggle${_draft.apothecary ? ' active' : ''}`;
    apothBtn.style.cssText = 'font-size:0.65rem;padding:0.2rem 0.5rem;';
    apothBtn.textContent = _draft.apothecary ? 'Hired' : 'Hire';
    apothBtn.addEventListener('click', () => {
      if (!_draft.apothecary) {
        const { remaining } = _calcDraftTreasury();
        if (remaining < APOTH_COST) { _showToast('✗ Not enough gold!', true); return; }
      }
      _draft.apothecary = !_draft.apothecary;
      apothBtn.textContent = _draft.apothecary ? 'Hired' : 'Hire';
      apothBtn.classList.toggle('active', _draft.apothecary);
      _refreshTreasury(body.parentElement ?? body);
    });
    apothRow.appendChild(apothBtn);
    sec.appendChild(apothRow);

    body.appendChild(sec);
  }

  function _calcDraftTreasury() {
    if (!_draft) return { remaining: START_GP, spent: 0 };
    const allTeams = _teamsData ?? [];
    const baseTeam = allTeams.find(t => t.id === _draft.baseTeamId);
    return calcTreasury(_draft, baseTeam);
  }

  function _refreshTreasury(container) {
    const el = (container ?? document).getElementById?.('tb-treasury')
            ?? document.getElementById('tb-treasury');
    if (!el) return;
    const { remaining, spent } = _calcDraftTreasury();
    el.innerHTML = `
      <span class="tb-treasury-num${remaining < 0 ? ' over' : ''}">${fmtGP(Math.abs(remaining))}${remaining < 0 ? ' OVER BUDGET' : ' remaining'}</span>
      <span class="tb-treasury-label">treasury</span>
      <span class="tb-treasury-spent">${fmtGP(spent)} spent of ${fmtGP(START_GP)}</span>
    `;
  }

  /* ──────────────────────────────────────────────────────
     COMPACT TEAM PICKER (shown near game-bar team selects)
     ────────────────────────────────────────────────────── */

  function openPicker(side) {
    /* Remove any existing picker */
    document.getElementById('tb-picker-backdrop')?.remove();
    document.getElementById('tb-picker-modal')?.remove();

    const teams = getTeams();

    const bd = document.createElement('div');
    bd.className = 'tb-picker-backdrop'; bd.id = 'tb-picker-backdrop';

    const modal = document.createElement('div');
    modal.className = 'tb-picker-modal'; modal.id = 'tb-picker-modal';

    const title = document.createElement('div');
    title.className = 'tb-picker-title';
    title.textContent = `Load team as ${side === 'left' ? 'Home' : 'Away'}`;
    modal.appendChild(title);

    if (teams.length === 0) {
      modal.innerHTML += '<p class="panel-intro" style="opacity:0.5;">No saved teams. Open Team Builder to create one.</p>';
    }

    teams.forEach(team => {
      const item = document.createElement('div');
      item.className = 'tb-picker-item';
      item.innerHTML = `
        <span class="tb-picker-item-name">${h(team.name)}</span>
        <span class="tb-picker-item-meta">${team.players.length}pl · ${team.rerolls}RR</span>
      `;
      item.addEventListener('click', async () => {
        bd.remove(); modal.remove();
        await loadIntoGame(team.id, side);
      });
      modal.appendChild(item);
    });

    const buildBtn = document.createElement('button');
    buildBtn.type = 'button'; buildBtn.className = 'pass-nav-btn';
    buildBtn.style.cssText = 'width:100%;margin-top:0.5rem;';
    buildBtn.textContent = '+ Build a New Team';
    buildBtn.addEventListener('click', () => { bd.remove(); modal.remove(); open('builder'); });
    modal.appendChild(buildBtn);

    bd.addEventListener('click', () => { bd.remove(); modal.remove(); });
    document.body.appendChild(bd);
    document.body.appendChild(modal);
  }

  /* ─── Toast ─── */

  function _showToast(msg, isError = false) {
    let toast = document.getElementById('tb-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'tb-toast';
      toast.style.cssText = `
        position:fixed; bottom:1.5rem; left:50%; transform:translateX(-50%);
        z-index:900; background:rgba(4,10,30,0.95); border:1px solid rgba(80,130,255,0.3);
        border-radius:6px; padding:0.45rem 1rem; font-family:'JetBrains Mono',monospace;
        font-size:0.75rem; font-weight:700; white-space:nowrap;
        box-shadow:0 4px 16px rgba(0,0,0,0.4);
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.color = isError ? '#ff8fa0' : '#81c784';
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2800);
  }

  /* ══════════════════════════════════════════════════════
     PUBLIC SURFACE
     ══════════════════════════════════════════════════════ */

  return {
    open, close, openPicker,
    getTeams, getTeam, saveTeam, deleteTeam,
    exportTeam, importTeam, loadIntoGame,
  };

})();

window.TeamBuilder = TeamBuilder;
