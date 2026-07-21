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

  /* Extension hooks for future-tunable rules. */
  const BUDGET_STEP = 50_000;                  /* gold increment for the Team Budget control */
  const SKILL_COST  = 20_000;                  /* gold cost to buy one extra skill for a player */
  const PURCHASABLE_SKILL_CATEGORIES = [       /* categories a coach may buy from */
    'General Skill', 'Agility Skill', 'Strength Skill',
    'Passing Skill', 'Mutation', 'Devious Skill',
  ];

  function teamBudget(draft) {
    return draft?.budget ?? START_GP;
  }

  /* Default colours for a new custom team (accent feeds the My Teams cards / in-game theme). */
  const DEFAULT_ACCENT = '#5A8CFF';

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

  /* Returns false when localStorage is full (likely too many photos). */
  function saveTeam(team) {
    const all = getTeams();
    const idx = all.findIndex(t => t.id === team.id);
    team.updatedAt = Date.now();   /* drives cloud sync (last-write-wins) */
    if (idx >= 0) all[idx] = team; else all.push(team);
    try {
      setTeams(all);
      document.dispatchEvent(new CustomEvent('bb:teams-changed'));
      return true;
    } catch (e) {
      return false;
    }
  }

  function deleteTeam(id) {
    setTeams(getTeams().filter(t => t.id !== id));
    /* Tombstone so team-sync can delete the cloud copy (even after reload). */
    try {
      const tombs = JSON.parse(localStorage.getItem('bb_deleted_teams') ?? '[]');
      if (!tombs.includes(id)) tombs.push(id);
      localStorage.setItem('bb_deleted_teams', JSON.stringify(tombs));
    } catch {}
    document.dispatchEvent(new CustomEvent('bb:teams-changed'));
  }

  /* ─── Helpers ─────────────────────────────────────── */

  function uuid() {
    return (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  /* Next free jersey number — one above the current highest (unique even
     after players have been removed and re-added). */
  function nextJersey() {
    const used = (_draft?.players ?? []).map(p => Number(p.jerseyNumber) || 0);
    return (used.length ? Math.max(...used) : 0) + 1;
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
    return { remaining: teamBudget(draft) - spent, spent };
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

  /* Prefix data paths so the builder works from subpages (e.g. /teams/) that set
     window.BB_DATA_PREFIX = '../'. Defaults to '' for the main app. */
  function _dp(path) { return (window.BB_DATA_PREFIX || '') + path; }

  async function _getTeamsData() {
    if (_teamsData) return _teamsData;
    try {
      const res = await fetch(_dp('data/teams.json'));
      _teamsData = await res.json();
    } catch { _teamsData = []; }
    return _teamsData;
  }

  async function _getBoxTeamsData() {
    if (_boxTeamsData) return _boxTeamsData;
    try {
      const res = await fetch(_dp('data/box-teams.json'));
      _boxTeamsData = await res.json();
    } catch { _boxTeamsData = {}; }
    return _boxTeamsData;
  }

  async function _getStarPlayersData() {
    if (_starPlayersData) return _starPlayersData;
    try {
      const res = await fetch(_dp('data/star-players.json'));
      _starPlayersData = await res.json();
    } catch { _starPlayersData = []; }
    return _starPlayersData;
  }

  async function _fetchRoster(fileUrl) {
    try {
      const res = await fetch(_dp(fileUrl));
      return await res.json();
    } catch { return []; }
  }

  /* ══════════════════════════════════════════════════════
     PUBLIC — open / render into a host container
     The builder lives inside the Choose Team window's right pane.
     ══════════════════════════════════════════════════════ */

  let _builderContainer = null;   /* host element the builder renders into */
  let _onDone           = null;   /* called after save or cancel */

  /* Back-compat: external callers asking to "open" the builder are routed to
     the Choose Team window controller in script.js. */
  function open(initialView = 'list') {
    if (initialView === 'builder' && window.showTeamBuilder) { window.showTeamBuilder(null); return; }
    if (window.openChooseTeam) window.openChooseTeam('left');
  }

  function close() {
    window.Panels?.closePanel?.('chooseteam');
  }

  /* Render the full builder form for a new team (teamId null) or an edit. */
  async function renderBuilderInto(container, { teamId = null, onDone = null } = {}) {
    _builderContainer = container;
    _onDone           = onDone;

    if (teamId) {
      _draft = JSON.parse(JSON.stringify(getTeam(teamId) ?? {}));
    } else {
      _draft = null;
      _initDraft();
    }
    _ensureDraftDefaults(_draft);

    /* Prime caches + roster for the draft's race. */
    _rosterData = null;
    await Promise.all([_getTeamsData(), _getBoxTeamsData(), _getStarPlayersData()]);
    if (_draft.baseTeamId) {
      const base = (_teamsData ?? []).find(t => t.id === _draft.baseTeamId);
      if (base) _rosterData = await _fetchRoster(base.file);
    }
    _render();
  }

  function _ensureDraftDefaults(draft) {
    if (!draft) return;
    if (draft.budget == null)            draft.budget = START_GP;
    if (!draft.colors)                   draft.colors = { accent: DEFAULT_ACCENT };
    if (!draft.colors.accent)            draft.colors.accent = DEFAULT_ACCENT;
    (draft.players ?? []).forEach(p => {
      if (p.fact == null)          p.fact = '';
      if (!Array.isArray(p.learnedSkills)) p.learnedSkills = [];
    });
  }

  /* ══════════════════════════════════════════════════════
     RENDER DISPATCHER — rebuilds the form into the host container
     ══════════════════════════════════════════════════════ */

  function _render() {
    if (!_builderContainer) return;
    _builderContainer.innerHTML = '';
    _renderBuilder(_builderContainer);
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
        budget:           START_GP,
        colors:           { accent: DEFAULT_ACCENT },
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

  function _renderBuilder(body) {
    if (!_draft) _initDraft();
    _ensureDraftDefaults(_draft);

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

    /* ── Team Budget (adjustable gold) + Colour ── */
    _renderBudgetSection(body);
    _renderColorSection(body);

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
            jerseyNumber:     nextJersey(),
            position:         pos.position,
            ma: pos.ma, st: pos.st, ag: pos.ag, pa: pos.pa, av: pos.av,
            skills:           pos.skills ?? '',
            value:            pos.value ?? 0,
            fact:             '',
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

        /* Top line: jersey + name + position */
        const head = document.createElement('div');
        head.className = 'tb-player-head';

        if (p.isStarPlayer) {
          const badge = document.createElement('span');
          badge.className = 'tb-pos-pill star-pill';
          badge.textContent = '★';
          const nameEl = document.createElement('span');
          nameEl.className = 'tb-pname-static';
          nameEl.textContent = p.name;
          const pos = document.createElement('span');
          pos.className = 'tb-pos-pill'; pos.textContent = 'Star Player';
          head.appendChild(badge); head.appendChild(nameEl); head.appendChild(pos);
          row.appendChild(head);
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

          head.appendChild(jInp); head.appendChild(nInp); head.appendChild(pos);
          row.appendChild(head);

          /* Flavor text */
          const flavor = document.createElement('input');
          flavor.type = 'text'; flavor.className = 'tb-flavor-inp';
          flavor.value = p.fact ?? ''; flavor.placeholder = 'Flavor text (shown on the player’s card)…';
          flavor.addEventListener('input', () => { p.fact = flavor.value; });
          row.appendChild(flavor);

          /* Card photo: upload a picture of the miniature */
          row.appendChild(_buildPhotoControl(p));

          /* Skills: starting (read-only) + purchased (removable) + buy control */
          row.appendChild(_buildPlayerSkills(p));
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

    /* ── Save / Cancel ── */
    const actions = document.createElement('div');
    actions.className = 'tb-builder-actions';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button'; saveBtn.className = 'roll-btn tb-save-btn';
    saveBtn.innerHTML = '<span class="roll-btn-icon">💾</span> Save Team';
    const attemptSave = () => {
      if (!_draft.name.trim()) {
        /* No name yet — ask right here instead of sending them scrolling
           back to the Team Name field at the top. */
        _promptTeamName(attemptSave);
        return;
      }
      if (!_draft.baseTeamId) {
        _showToast('✗ Please select a base race', true); return;
      }
      if (_draft.players.length < 11) {
        _showToast(`✗ Need at least 11 players (have ${_draft.players.length})`, true); return;
      }
      const { remaining } = _calcDraftTreasury();
      if (remaining < 0) {
        _showToast('✗ Over budget! Raise the team budget or remove players/staff', true); return;
      }
      _draft.treasury = remaining;
      if (!saveTeam(_draft)) {
        _showToast('✗ Storage full — remove some player photos and try again', true);
        return;
      }
      _showToast(`✓ Saved: ${_draft.name}`);
      _finishBuilder();
    };
    saveBtn.addEventListener('click', attemptSave);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button'; cancelBtn.className = 'tb-cancel-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => _finishBuilder());

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    body.appendChild(actions);
  }

  function _finishBuilder() {
    _draft = null;
    _rosterData = null;
    const done = _onDone;
    _builderContainer = null;
    _onDone = null;
    if (done) done();
  }

  /* ── Card photo control: file input → downscaled JPEG dataURL ── */

  function _downscalePhoto(file, maxEdge = 512, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width  = Math.max(1, Math.round(img.width  * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')); };
      img.src = url;
    });
  }

  function _buildPhotoControl(p) {
    const wrap = document.createElement('div');
    wrap.className = 'tb-photo-row';

    const thumb = document.createElement('img');
    thumb.className = 'tb-photo-thumb';
    thumb.alt = '';

    const pick = document.createElement('button');
    pick.type = 'button'; pick.className = 'tb-photo-btn';

    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'tb-photo-remove';
    remove.textContent = '✕';
    remove.title = 'Remove photo';

    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.hidden = true;

    const sync = () => {
      thumb.src = p.photo || '';
      thumb.hidden = !p.photo;
      remove.hidden = !p.photo;
      pick.textContent = p.photo ? '📷 Replace Photo' : '📷 Add Card Photo';
    };

    pick.addEventListener('click', () => input.click());
    remove.addEventListener('click', () => { p.photo = undefined; p.photoId = undefined; sync(); });
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;
      try {
        const dataUrl = await _downscalePhoto(file);
        /* Signed in: upload to the cloud and store a URL (keeps localStorage
           small). Signed out or upload fails: keep the dataURL as before. */
        let stored = dataUrl;
        if (window.BBTeamSync?.canUpload()) {
          try {
            const up = await BBTeamSync.uploadPhotoFromDataUrl(dataUrl);
            p.photoId = up.id;
            stored = up.url;
          } catch (e) {
            p.photoId = undefined;
          }
        }
        p.photo = stored;
        sync();
      } catch (e) {
        _showToast('✗ Could not read that image', true);
      }
    });

    sync();
    wrap.appendChild(thumb); wrap.appendChild(pick); wrap.appendChild(remove); wrap.appendChild(input);
    return wrap;
  }

  /* Starting skills (read-only) + purchased skills (removable) + buy control. */
  function _buildPlayerSkills(p) {
    const wrap = document.createElement('div');
    wrap.className = 'tb-skills-row';

    const baseSkills = (p.skills ?? '').split(',').map(s => s.trim()).filter(Boolean);
    baseSkills.forEach(s => {
      const chip = document.createElement('span');
      chip.className = 'tb-skill-chip base';
      chip.textContent = s;
      wrap.appendChild(chip);
    });

    (p.learnedSkills ?? []).forEach(s => {
      const chip = document.createElement('span');
      chip.className = 'tb-skill-chip bought';
      chip.innerHTML = `${h(s)} <button class="tb-skill-x" type="button" title="Remove skill (refund ${fmtGP(SKILL_COST)})" aria-label="Remove ${h(s)}">×</button>`;
      chip.querySelector('.tb-skill-x').addEventListener('click', () => {
        p.learnedSkills = p.learnedSkills.filter(x => x !== s);
        p.value = Math.max(0, (p.value ?? 0) - SKILL_COST);
        _render();
      });
      wrap.appendChild(chip);
    });

    /* Buy control */
    const buy = document.createElement('button');
    buy.type = 'button'; buy.className = 'tb-skill-add';
    buy.textContent = `+ Skill (${fmtGP(SKILL_COST)})`;
    buy.addEventListener('click', () => _openSkillPicker(p, buy));
    wrap.appendChild(buy);

    return wrap;
  }

  /* Inline skill picker: a category-grouped select that buys on choose. */
  function _openSkillPicker(p, anchorBtn) {
    const all = (window.BBSkillsList ?? []).filter(s =>
      PURCHASABLE_SKILL_CATEGORIES.includes(s.category));
    const owned = new Set([
      ...((p.skills ?? '').split(',').map(s => s.trim())),
      ...(p.learnedSkills ?? []),
    ]);

    const sel = document.createElement('select');
    sel.className = 'tb-skill-select';
    sel.innerHTML = '<option value="">Choose a skill…</option>';
    PURCHASABLE_SKILL_CATEGORIES.forEach(cat => {
      const inCat = all.filter(s => s.category === cat && !owned.has(s.name));
      if (!inCat.length) return;
      const og = document.createElement('optgroup');
      og.label = cat.replace(' Skill', '');
      inCat.forEach(s => {
        const o = document.createElement('option');
        o.value = s.name; o.textContent = s.name;
        og.appendChild(o);
      });
      sel.appendChild(og);
    });

    sel.addEventListener('change', () => {
      const name = sel.value;
      if (!name) return;
      const { remaining } = _calcDraftTreasury();
      if (remaining < SKILL_COST) { _showToast('✗ Not enough gold!', true); return; }
      p.learnedSkills = [...(p.learnedSkills ?? []), name];
      p.value = (p.value ?? 0) + SKILL_COST;
      _render();
    });

    anchorBtn.replaceWith(sel);
    sel.focus();
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
          jerseyNumber:     nextJersey(),
          position:         pos.position,
          ma: pos.ma, st: pos.st, ag: pos.ag, pa: pos.pa, av: pos.av,
          skills:           pos.skills ?? '',
          value:            pos.value ?? 0,
          fact:             '',
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

  /* ── Team Budget (adjustable gold) ── */
  function _renderBudgetSection(body) {
    const sec = document.createElement('div');
    sec.className = 'tb-section';
    sec.innerHTML = '<div class="tb-section-title">Team Budget</div>';

    const row = document.createElement('div');
    row.className = 'tb-staff-row';

    const info = document.createElement('div');
    info.className = 'tb-staff-info';
    info.innerHTML = `<span class="tb-staff-label">Total gold to spend</span>
      <span class="tb-staff-cost">${BUDGET_STEP / 1000}k steps · default ${fmtGP(START_GP)}</span>`;

    const ctrl = document.createElement('div');
    ctrl.className = 'tb-staff-ctrl';

    const minus = document.createElement('button');
    minus.type = 'button'; minus.className = 'tb-qty-btn'; minus.textContent = '−';

    const val = document.createElement('span');
    val.className = 'tb-staff-val tb-budget-val'; val.textContent = fmtGP(teamBudget(_draft));

    const plus = document.createElement('button');
    plus.type = 'button'; plus.className = 'tb-qty-btn'; plus.textContent = '+';

    const sync = () => {
      val.textContent  = fmtGP(teamBudget(_draft));
      minus.disabled   = teamBudget(_draft) <= START_GP;
      _refreshTreasury(body.parentElement ?? body);
    };
    minus.addEventListener('click', () => {
      _draft.budget = Math.max(START_GP, teamBudget(_draft) - BUDGET_STEP);
      sync();
    });
    plus.addEventListener('click', () => {
      _draft.budget = teamBudget(_draft) + BUDGET_STEP;
      sync();
    });
    minus.disabled = teamBudget(_draft) <= START_GP;

    ctrl.appendChild(minus); ctrl.appendChild(val); ctrl.appendChild(plus);
    row.appendChild(info); row.appendChild(ctrl);
    sec.appendChild(row);
    body.appendChild(sec);
  }

  /* ── Team Colour (accent feeds the My Teams card + in-game theme) ── */
  function _renderColorSection(body) {
    const sec = document.createElement('div');
    sec.className = 'tb-section';
    sec.innerHTML = '<div class="tb-section-title">Team Colour</div>';

    const row = document.createElement('div');
    row.className = 'tb-staff-row';

    const info = document.createElement('div');
    info.className = 'tb-staff-info';
    info.innerHTML = `<span class="tb-staff-label">Accent colour</span>
      <span class="tb-staff-cost">Shown on the team card &amp; roster theme</span>`;

    const picker = document.createElement('input');
    picker.type = 'color'; picker.className = 'tb-color-input';
    picker.value = _toHex(_draft.colors?.accent) || DEFAULT_ACCENT;
    picker.addEventListener('input', () => {
      _draft.colors = { ...(_draft.colors ?? {}), accent: picker.value };
    });

    row.appendChild(info); row.appendChild(picker);
    sec.appendChild(row);
    body.appendChild(sec);
  }

  /* Best-effort coercion of an accent value to a #rrggbb the color input accepts. */
  function _toHex(c) {
    if (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)) return c;
    return null;
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
                  jerseyNumber: nextJersey(),
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
                jerseyNumber: nextJersey(),
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
      <span class="tb-treasury-spent">${fmtGP(spent)} spent of ${fmtGP(teamBudget(_draft))}</span>
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

  /* ─── Name dialog (shown by Save Team when the draft is unnamed) ─── */

  function _promptTeamName(onNamed) {
    const back = document.createElement('div');
    back.className = 'tb-name-dialog-back';

    const box = document.createElement('div');
    box.className = 'tb-name-dialog';
    box.innerHTML = '<div class="tb-section-title">Name Your Team</div>';

    const inp = document.createElement('input');
    inp.type = 'text'; inp.className = 'tb-name-field';
    inp.maxLength = 40;
    inp.placeholder = 'e.g. Gouged Eye Reserves';
    inp.value = _draft?.name ?? '';
    box.appendChild(inp);

    const row = document.createElement('div');
    row.className = 'tb-name-dialog-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button'; cancel.className = 'tb-cancel-btn'; cancel.textContent = 'Cancel';
    const ok = document.createElement('button');
    ok.type = 'button'; ok.className = 'roll-btn tb-save-btn';
    ok.innerHTML = '<span class="roll-btn-icon">💾</span> Save Team';
    row.appendChild(cancel); row.appendChild(ok);
    box.appendChild(row);

    const close = () => back.remove();
    const confirm = () => {
      const name = inp.value.trim();
      if (!name) { inp.classList.add('tb-name-field--bad'); inp.focus(); return; }
      if (_draft) _draft.name = name;
      /* Keep the Team Name field at the top of the builder in step. */
      const topInp = _builderContainer?.querySelector('.tb-name-field');
      if (topInp) topInp.value = name;
      close();
      onNamed?.();
    };

    cancel.addEventListener('click', close);
    ok.addEventListener('click', confirm);
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') confirm();
      if (e.key === 'Escape') close();
    });
    back.addEventListener('click', e => { if (e.target === back) close(); });

    back.appendChild(box);
    document.body.appendChild(back);
    inp.focus();
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
    open, close, openPicker, renderBuilderInto,
    getTeams, getTeam, saveTeam, deleteTeam,
    exportTeam, importTeam, loadIntoGame,
  };

})();

window.TeamBuilder = TeamBuilder;
