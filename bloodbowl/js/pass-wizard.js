'use strict';

/* ═══════════════════════════════════════════════════════
   Blood Bowl Companion — js/pass-wizard.js
   Sprints 11-14: Console TV layout, player chooser cards,
   skill tooltips, right info panel.
   ═══════════════════════════════════════════════════════ */

function parsePassStat(statsText, key) {
  if (!statsText) return 99;
  if (new RegExp(`\\b${key}\\s*[—\\-]`, 'i').test(statsText)) return 99;
  const m = statsText.match(new RegExp(`\\b${key}\\s*(\\d+)`, 'i'));
  return m ? parseInt(m[1], 10) : 99;
}

function parseAllStats(statsText) {
  const stats = {};
  if (!statsText) return stats;
  ['MA', 'ST', 'AG', 'PA', 'AV'].forEach(key => {
    if (new RegExp(`\\b${key}\\s*[—\\-]`, 'i').test(statsText)) { stats[key] = '—'; return; }
    const m = statsText.match(new RegExp(`\\b${key}\\s*(\\d+)(\\+)?`, 'i'));
    if (m) stats[key] = m[1] + (m[2] || '');
  });
  return stats;
}

function initPassWizard() {
  const panel = document.getElementById('panel-pass');
  if (!panel) return;

  const body = panel.querySelector('.panel-body');

  /* ── Wizard state ── */
  const ws = {
    activeSide:      'left',
    thrower:         null,
    catcher:         null,
    throwerPos:      null,
    catcherPos:      null,
    opposingPlayers: [],
    tz:              0,
    catcherTZ:       0,
    zonesOn:         false,
    passResult:      null,
    catchResult:     null,
    pitch:           null,
    passSkillUsed:   false,
    teamRRUsed:      false,
    _built:          false,
    variant:         parseInt(localStorage.getItem('pwiz-variant') || '1', 10),
  };

  function gbSide() { return ws.activeSide === 'left' ? 'home' : 'away'; }

  function resetWizardState() {
    ws.pitch?.clear();
    ws.thrower         = null;
    ws.catcher         = null;
    ws.throwerPos      = null;
    ws.catcherPos      = null;
    ws.opposingPlayers = [];
    ws.zonesOn         = false;
    ws._built          = false;
    resetRoll();
  }

  function getStat(p, key) { return parsePassStat(p?.statsText, key); }

  function hasSk(p, name) {
    if (!p) return false;
    const sk = typeof getPlayerSkills === 'function' ? getPlayerSkills(p) : [];
    return sk.some(s => s.toLowerCase() === name.toLowerCase());
  }

  function resetRoll() {
    ws.passResult    = null;
    ws.catchResult   = null;
    ws.passSkillUsed = false;
    ws.teamRRUsed    = false;
  }

  function playerNum(p)   { return p?.number != null ? String(p.number) : String((p?.idx ?? 0) + 1); }
  function playerLabel(p) { return `#${playerNum(p)} ${p?.name || p?.pos || '?'}`; }

  function computeTZ() {
    function count(pos) {
      if (!pos) return 0;
      let n = 0;
      for (const op of ws.opposingPlayers) {
        if (Math.abs(op.col - pos.col) <= 1 && Math.abs(op.row - pos.row) <= 1 &&
            !(op.col === pos.col && op.row === pos.row)) n++;
      }
      return n;
    }
    ws.tz        = count(ws.throwerPos);
    ws.catcherTZ = count(ws.catcherPos);
  }

  function getLineCells(fc, fr, tc, tr) {
    const cells = [];
    let x = fc, y = fr;
    const dx = Math.abs(tc - fc), dy = Math.abs(tr - fr);
    const sx = fc < tc ? 1 : -1, sy = fr < tr ? 1 : -1;
    let err = dx - dy;
    while (true) {
      if (!(x === fc && y === fr) && !(x === tc && y === tr)) cells.push({ col: x, row: y });
      if (x === tc && y === tr) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 <  dx) { err += dx; y += sy; }
    }
    return cells;
  }

  function getInterceptors() {
    if (!ws.throwerPos || !ws.catcherPos) return [];
    const line = getLineCells(ws.throwerPos.col, ws.throwerPos.row, ws.catcherPos.col, ws.catcherPos.row);
    return ws.opposingPlayers
      .filter(op => line.some(c => Math.abs(c.col - op.col) <= 1 && Math.abs(c.row - op.row) <= 1))
      .sort((a, b) => {
        const da = Math.hypot(a.col - ws.throwerPos.col, a.row - ws.throwerPos.row);
        const db = Math.hypot(b.col - ws.throwerPos.col, b.row - ws.throwerPos.row);
        return da - db;
      });
  }

  const delay = ms => new Promise(r => setTimeout(r, ms));

  /* Pitch scale: fills center column, capped at 60vw max.
     Panel = min(82vw,1600px). Column widths mirror CSS clamp values.
     Pitch at scale s ≈ s × 784px wide (28 cols × round(28s) px). */
  function _pitchScale() {
    const vw     = window.innerWidth;
    const panelW = Math.min(vw * 0.82, 1600);
    const leftW  = Math.max(150, Math.min(240, vw * 0.17));
    const rightW = Math.max(100, Math.min(195, vw * 0.115));
    const gaps   = 60;
    const centerW = Math.max(200, panelW - leftW - rightW - gaps);
    const target  = Math.min(centerW * 0.95, vw * 0.60);
    return Math.max(0.35, target / 784);
  }

  /* ── Skill tooltip chip (Sprint 13) ── */
  const RELEVANT_SKILLS = new Set([
    'Accurate','Strong Arm','Pass','Nerves of Steel','Cannoneer',
    'Hail Mary Pass','Catch','Diving Catch','Sure Hands','Extra Arms',
    'Consummate Professional','Cloud Burster','Dump-Off','Pro',
  ]);

  function makeSkillChip(skillName, extraClass) {
    const entry = typeof lookupSkill === 'function' ? lookupSkill(skillName) : null;
    const chip  = document.createElement('span');
    const isRel = RELEVANT_SKILLS.has(skillName);
    chip.className = `pwiz-skill-chip ${isRel ? 'pos' : 'neutral'} pwiz-skill-inline`
      + (extraClass ? ` ${extraClass}` : '');
    chip.textContent = skillName;
    if (entry?.description) {
      chip.title = entry.description;
      chip.style.cursor = 'help';
      chip.addEventListener('click', e => {
        e.stopPropagation();
        let tip = chip.querySelector('.pwiz-skill-tooltip');
        if (tip) { tip.remove(); return; }
        tip = document.createElement('div');
        tip.className = 'pwiz-skill-tooltip';
        tip.textContent = entry.description;
        chip.appendChild(tip);
        const off = e => { if (!chip.contains(e.target)) { tip.remove(); document.removeEventListener('click', off, true); } };
        setTimeout(() => document.addEventListener('click', off, true), 0);
      });
    }
    return chip;
  }

  function buildModBreakdown(rows) {
    const wrap = document.createElement('div');
    wrap.className = 'pwiz-mod-breakdown';
    rows.forEach(({ label, value, chip: chipName, cls }) => {
      const row = document.createElement('div');
      row.className = 'pwiz-mod-row' + (cls ? ` ${cls}` : '');
      const lbl = document.createElement('span');
      lbl.className = 'pwiz-mod-label';
      if (chipName) lbl.appendChild(makeSkillChip(chipName));
      else lbl.textContent = label;
      const val = document.createElement('span');
      val.className = 'pwiz-mod-value';
      val.textContent = value;
      row.appendChild(lbl);
      row.appendChild(val);
      wrap.appendChild(row);
    });
    return wrap;
  }

  /* ─────────────────────────────────────────────────────
     LAYOUT BUILDER (Sprint 11)
     3-column: left panel | center (pitch + choosers) | right panel
     5 variant buttons switch visual style.
     ──────────────────────────────────────────────────── */

  function buildLayout() {
    body.innerHTML = '';
    resetRoll();

    /* Hidden weather chip slot (for Panels.refreshWeatherChips) */
    const wChip = document.createElement('div');
    wChip.className = 'weather-chip-slot'; wChip.id = 'wchip-pass'; wChip.hidden = true;
    body.appendChild(wChip);
    window.Panels?.refreshWeatherChips?.();

    /* Root */
    const root = document.createElement('div');
    root.className = `pwiz-v2 pwiz-variant-${ws.variant}`;
    root.id = 'pwiz-v2-root';
    body.appendChild(root);

    /* Header: variant selector + team tabs */
    _buildHeader(root);

    /* Body: 3 columns */
    const bodyEl = document.createElement('div');
    bodyEl.className = 'pwiz-v2-body';
    root.appendChild(bodyEl);

    const leftEl = document.createElement('div');
    leftEl.className = 'pwiz-v2-left';
    leftEl.id = 'pwiz-v2-left';
    bodyEl.appendChild(leftEl);

    const centerEl = document.createElement('div');
    centerEl.className = 'pwiz-v2-center';
    bodyEl.appendChild(centerEl);

    const rightEl = document.createElement('div');
    rightEl.className = 'pwiz-v2-right';
    rightEl.id = 'pwiz-v2-right';
    bodyEl.appendChild(rightEl);

    /* Placement banner */
    const placeBanner = document.createElement('div');
    placeBanner.id = 'pwiz-place-banner';
    placeBanner.hidden = true;
    placeBanner.className = 'pwiz-place-banner';
    placeBanner.title = 'Click to cancel placement';
    placeBanner.addEventListener('click', () => { ws.pitch?.cancelPlacement(); placeBanner.hidden = true; });
    centerEl.appendChild(placeBanner);

    /* Pitch */
    const pitchWrap = document.createElement('div');
    pitchWrap.className = 'pwiz-pitch-wrap';
    centerEl.appendChild(pitchWrap);

    if (typeof window.BloodBowlPitch !== 'undefined') {
      ws.pitch = new window.BloodBowlPitch(pitchWrap, { scale: _pitchScale(), noZoom: true });
      ws.pitch.onPlayerMoved = (fc, fr, tc, tr, data) => {
        if (data.id === 'thrower') {
          ws.throwerPos = { col: tc, row: tr };
          if (ws.zonesOn) ws.pitch.showPassZones(tc, tr);
          if (ws.catcherPos) ws.pitch.drawPassLine(tc, tr, ws.catcherPos.col, ws.catcherPos.row);
        } else if (data.id === 'catcher') {
          ws.catcherPos = { col: tc, row: tr };
          if (ws.throwerPos) ws.pitch.drawPassLine(ws.throwerPos.col, ws.throwerPos.row, tc, tr);
        } else {
          const op = ws.opposingPlayers.find(o => o.col === fc && o.row === fr);
          if (op) { op.col = tc; op.row = tr; }
        }
        computeTZ();
        rebuildLeft();
        rebuildRight();
        updateReqs();
      };
    }

    /* Left panel (includes chooser cards at top) */
    _buildLeftPanel(leftEl);

    /* Right panel */
    _buildRightPanel(rightEl);

    /* Roll area (full-width below 3 columns) */
    const reqEl = document.createElement('div');
    reqEl.className = 'pwiz-requirements'; reqEl.id = 'pwiz-req';
    root.appendChild(reqEl);

    const rollEl = document.createElement('div');
    rollEl.id = 'pwiz-roll'; rollEl.hidden = true;
    root.appendChild(rollEl);

    updateReqs();
  }

  /* ── Header: variant selector + Home/Away tabs ── */
  function _buildHeader(root) {
    const hdr = document.createElement('div');
    hdr.className = 'pwiz-v2-header';
    root.appendChild(hdr);

    /* Variant buttons */
    const variantRow = document.createElement('div');
    variantRow.className = 'pwiz-variant-row';
    const variantLabels = ['① Default', '② Large', '③ Wide', '④ Gold', '⑤ Compact'];
    variantLabels.forEach((label, i) => {
      const n = i + 1;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pwiz-variant-btn' + (ws.variant === n ? ' active' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => {
        ws.variant = n;
        localStorage.setItem('pwiz-variant', String(n));
        const rootEl = document.getElementById('pwiz-v2-root');
        if (rootEl) {
          rootEl.className = `pwiz-v2 pwiz-variant-${n}`;
        }
        variantRow.querySelectorAll('.pwiz-variant-btn').forEach((b, j) =>
          b.classList.toggle('active', j + 1 === n));
      });
      variantRow.appendChild(btn);
    });
    hdr.appendChild(variantRow);

    /* Team tabs */
    const teamRow = document.createElement('div');
    teamRow.className = 'pwiz-team-tabs';
    ['Home', 'Away'].forEach((label, i) => {
      const side = i === 0 ? 'left' : 'right';
      const btn  = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pwiz-team-tab' + (ws.activeSide === side ? ' active' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => {
        if (ws.activeSide === side) return;
        ws.activeSide = side;
        ws.thrower = null; ws.catcher = null;
        ws.throwerPos = null; ws.catcherPos = null;
        ws.opposingPlayers = [];
        ws.pitch?.clear();
        teamRow.querySelectorAll('.pwiz-team-tab').forEach(b => b.classList.toggle('active', b === btn));
        rebuildLeft(); rebuildRight(); updateReqs();
      });
      teamRow.appendChild(btn);
    });
    hdr.appendChild(teamRow);
  }

  /* ── Left panel: chooser cards + zones toggle + opposing players + weather ── */
  function _buildLeftPanel(container) {
    container.innerHTML = '';

    /* Thrower + catcher chooser cards (moved from below-pitch) */
    const chooserWrap = document.createElement('div');
    chooserWrap.className = 'pwiz-below-pitch';
    chooserWrap.id = 'pwiz-below-pitch';
    container.appendChild(chooserWrap);
    _buildBelowPitch(chooserWrap);

    /* Section label */
    const lbl = document.createElement('div');
    lbl.className = 'pwiz-panel-label';
    lbl.textContent = 'Controls';
    container.appendChild(lbl);

    /* Zones toggle */
    const zonesBtn = document.createElement('button');
    zonesBtn.type = 'button'; zonesBtn.className = 'dmt-btn pwiz-zones-btn' + (ws.zonesOn ? ' active' : '');
    zonesBtn.textContent = '⬡ Show Zones';
    zonesBtn.addEventListener('click', () => {
      ws.zonesOn = !ws.zonesOn;
      zonesBtn.classList.toggle('active', ws.zonesOn);
      if (ws.zonesOn && ws.throwerPos) ws.pitch?.showPassZones(ws.throwerPos.col, ws.throwerPos.row);
      else ws.pitch?.hidePassZones();
    });
    container.appendChild(zonesBtn);

    /* Opposing players section */
    const oppHdr = document.createElement('div');
    oppHdr.className = 'pwiz-panel-label';
    oppHdr.style.marginTop = '0.8rem';
    oppHdr.textContent = 'Opposing Players';
    container.appendChild(oppHdr);

    ws.opposingPlayers.forEach((op, i) => {
      const row = document.createElement('div');
      row.className = 'pwiz-opp-row';
      const lbl2 = document.createElement('span');
      lbl2.className = 'pwiz-opp-label';
      lbl2.textContent = playerLabel(op.player);
      const pos = document.createElement('span');
      pos.className = 'pwiz-opp-pos';
      pos.textContent = `(${op.col},${op.row})`;
      const rmBtn = document.createElement('button');
      rmBtn.type = 'button'; rmBtn.className = 'pwiz-rm-btn'; rmBtn.textContent = '✕';
      rmBtn.addEventListener('click', () => {
        ws.pitch?.removePlayer(op.col, op.row);
        ws.opposingPlayers.splice(i, 1);
        computeTZ(); rebuildLeft(); rebuildRight(); updateReqs();
      });
      row.appendChild(lbl2); row.appendChild(pos); row.appendChild(rmBtn);
      container.appendChild(row);
    });

    const addOppBtn = document.createElement('button');
    addOppBtn.type = 'button'; addOppBtn.className = 'pwiz-add-btn';
    addOppBtn.textContent = '+ Add Opposing Player';
    addOppBtn.addEventListener('click', () => openPicker('opposing'));
    container.appendChild(addOppBtn);

    /* TZ summary */
    if (ws.throwerPos || ws.catcherPos) {
      const tzDiv = document.createElement('div');
      tzDiv.className = 'pwiz-tz-summary';
      const parts = [];
      if (ws.tz)        parts.push(`Thrower: ${ws.tz} TZ${hasSk(ws.thrower, 'Nerves of Steel') ? ' (NoS)' : ''}`);
      if (ws.catcherTZ) parts.push(`Catcher: ${ws.catcherTZ} TZ`);
      if (parts.length) tzDiv.textContent = parts.join(' · ');
      if (parts.length) container.appendChild(tzDiv);
    }

    /* Weather effect note */
    const w = window.GameState?.currentWeather;
    if (w?.effect && w.effect !== 'No effect') {
      const chip = document.createElement('div');
      chip.className = 'pwiz-skill-chip neg';
      chip.style.marginTop = '0.8rem';
      chip.textContent = `${w.emoji ?? ''} ${w.effect}`.trim();
      container.appendChild(chip);
    }
  }

  /* ── Below-pitch: thrower + catcher chooser areas ── */
  function _buildBelowPitch(container) {
    container.innerHTML = '';

    ['thrower', 'catcher'].forEach(role => {
      const area = document.createElement('div');
      area.className = 'pwiz-chooser-area';
      area.dataset.role = role;

      const player = role === 'thrower' ? ws.thrower : ws.catcher;
      const pos    = role === 'thrower' ? ws.throwerPos : ws.catcherPos;

      if (player) {
        /* Selected state */
        area.classList.add('pwiz-chooser-selected');

        const nameEl = document.createElement('div');
        nameEl.className = 'pwiz-chooser-name';
        nameEl.innerHTML = `<span class="pwiz-chooser-role">${role === 'thrower' ? '🎯 Thrower' : '🤲 Catcher'}</span>`
          + `<span class="pwiz-chooser-player-name">${esc(playerLabel(player))}</span>`;
        if (pos) {
          nameEl.innerHTML += ` <span class="pwiz-chooser-pos">(${pos.col},${pos.row})</span>`;
        }
        area.appendChild(nameEl);

        /* Stats row */
        const stats = parseAllStats(player.statsText);
        if (Object.keys(stats).length) {
          const statsEl = document.createElement('div');
          statsEl.className = 'pwiz-chooser-stats';
          ['MA', 'ST', 'AG', 'PA', 'AV'].forEach(key => {
            const val = stats[key];
            if (!val) return;
            const st = document.createElement('div');
            st.className = 'pwiz-chooser-stat';
            st.innerHTML = `<span class="pwiz-cs-key">${key}</span><span class="pwiz-cs-val">${val}</span>`;
            statsEl.appendChild(st);
          });
          area.appendChild(statsEl);
        }

        /* Relevant skills */
        const skills = typeof getPlayerSkills === 'function' ? getPlayerSkills(player) : [];
        if (skills.length) {
          const skillsEl = document.createElement('div');
          skillsEl.className = 'pwiz-chooser-skills';
          skills.forEach(s => skillsEl.appendChild(makeSkillChip(s)));
          area.appendChild(skillsEl);
        }

        /* Remove button */
        const rmBtn = document.createElement('button');
        rmBtn.type = 'button'; rmBtn.className = 'pwiz-rm-btn';
        rmBtn.style.marginTop = '0.3rem';
        rmBtn.textContent = '✕ Remove';
        rmBtn.addEventListener('click', () => {
          if (role === 'thrower') {
            if (ws.throwerPos) ws.pitch?.removePlayer(ws.throwerPos.col, ws.throwerPos.row);
            ws.thrower = null; ws.throwerPos = null;
            ws.pitch?.clearPassLine(); ws.pitch?.hidePassZones(); ws.zonesOn = false;
          } else {
            if (ws.catcherPos) ws.pitch?.removePlayer(ws.catcherPos.col, ws.catcherPos.row);
            ws.catcher = null; ws.catcherPos = null;
            ws.pitch?.clearPassLine();
          }
          computeTZ(); rebuildLeft(); rebuildRight(); updateReqs();
        });
        area.appendChild(rmBtn);

      } else {
        /* Empty state */
        const chooseBtn = document.createElement('button');
        chooseBtn.type = 'button'; chooseBtn.className = 'pwiz-chooser-btn';
        chooseBtn.innerHTML = (role === 'thrower' ? '🎯' : '🤲')
          + ` Choose ${role === 'thrower' ? 'Thrower' : 'Catcher'}`;
        chooseBtn.addEventListener('click', () => openPicker(role));
        area.appendChild(chooseBtn);
      }

      container.appendChild(area);
    });
  }

  /* ── Right panel: team re-rolls + weather + game info (Sprint 14) ── */
  function _buildRightPanel(container) {
    container.innerHTML = '';

    const lbl = document.createElement('div');
    lbl.className = 'pwiz-panel-label';
    lbl.textContent = 'Game Info';
    container.appendChild(lbl);

    /* Team re-rolls (large display) */
    const rrCount = window.GameState?.rerolls?.[gbSide()] ?? 0;
    const rrBlock = document.createElement('div');
    rrBlock.className = 'pwiz-right-rr';
    rrBlock.id = 'pwiz-right-rr';
    rrBlock.innerHTML = `
      <div class="pwiz-rr-big-num${rrCount === 0 ? ' zero' : ''}">${rrCount}</div>
      <div class="pwiz-rr-big-label">Team Re-rolls</div>
    `;
    if (ws.teamRRUsed) {
      const used = document.createElement('div');
      used.className = 'pwiz-rr-used-note';
      used.textContent = 'Used this roll';
      rrBlock.appendChild(used);
    }
    container.appendChild(rrBlock);

    /* Weather */
    const w = window.GameState?.currentWeather;
    const weatherBlock = document.createElement('div');
    weatherBlock.className = 'pwiz-right-weather';
    if (w?.name) {
      weatherBlock.innerHTML = `
        <div class="pwiz-weather-emoji">${w.emoji ?? '🌤'}</div>
        <div class="pwiz-weather-name">${esc(w.name)}</div>
        ${w.effect && w.effect !== 'No effect' ? `<div class="pwiz-weather-effect">${esc(w.effect)}</div>` : ''}
      `;
    } else {
      weatherBlock.innerHTML = `<div class="pwiz-weather-name" style="opacity:0.4;">No weather</div>`;
    }
    container.appendChild(weatherBlock);

    /* Turn / half */
    const gs = window.GameState;
    const half = gs?.half ?? 1;
    const turn = typeof gbState !== 'undefined' ? (gbState.currentTurn ?? 0) : 0;
    const gameBlock = document.createElement('div');
    gameBlock.className = 'pwiz-right-game';
    gameBlock.innerHTML = `
      <div class="pwiz-game-row"><span class="pwiz-game-key">Half</span><span class="pwiz-game-val">${half}</span></div>
      ${turn ? `<div class="pwiz-game-row"><span class="pwiz-game-key">Turn</span><span class="pwiz-game-val">${turn}</span></div>` : ''}
    `;
    container.appendChild(gameBlock);

    /* Score */
    const scores = gs?.scores ?? window.gbState?.scores;
    if (scores) {
      const scoreBlock = document.createElement('div');
      scoreBlock.className = 'pwiz-right-game';
      scoreBlock.style.marginTop = '0.3rem';
      scoreBlock.innerHTML = `
        <div class="pwiz-game-row"><span class="pwiz-game-key">Score</span>
          <span class="pwiz-game-val">${scores.home ?? 0} – ${scores.away ?? 0}</span></div>
      `;
      container.appendChild(scoreBlock);
    }

    /* Active side re-roll pip display note */
    const sideLabel = ws.activeSide === 'left' ? 'Home' : 'Away';
    const sideNote = document.createElement('div');
    sideNote.className = 'pwiz-right-note';
    sideNote.textContent = `Showing ${sideLabel} re-rolls`;
    container.appendChild(sideNote);
  }

  /* ── Rebuild helpers ── */

  function rebuildLeft() {
    const el = document.getElementById('pwiz-v2-left');
    if (el) _buildLeftPanel(el);
  }

  function rebuildBelowPitch() {
    rebuildLeft(); // choosers now live inside the left panel
  }

  function rebuildRight() {
    const el = document.getElementById('pwiz-v2-right');
    if (el) _buildRightPanel(el);
  }

  /* ─────────────────────────────────────────────────────
     ROSTER PICKER — full card overlay (Sprint 12)
     ──────────────────────────────────────────────────── */

  let _activePickerClose = null;

  function openPicker(role) {
    _activePickerClose?.();

    const anchor = document.getElementById('pwiz-v2-root') ?? body;
    const side = role === 'opposing'
      ? (ws.activeSide === 'left' ? 'right' : 'left')
      : ws.activeSide;
    let players = window.getPlayerList?.(side) ?? [];
    if (!players.length) return;

    if (role === 'thrower')  players = [...players].sort((a, b) => getStat(a, 'PA') - getStat(b, 'PA'));
    else if (role === 'catcher') players = [...players].sort((a, b) => getStat(a, 'AG') - getStat(b, 'AG'));
    if (role === 'opposing') players = players.filter(p => !window.STATUS_META?.[p.status]?.dim);

    const overlay = document.createElement('div');
    overlay.className = 'pwiz-full-picker-overlay';

    const card = document.createElement('div');
    card.className = 'pwiz-full-picker-card';

    const hdr = document.createElement('div');
    hdr.className = 'pwiz-full-picker-hdr';
    const titles = { thrower: '🎯 Choose Thrower', catcher: '🤲 Choose Catcher', opposing: '⚔ Add Opposing Player' };
    hdr.innerHTML = `<span>${titles[role] ?? 'Select Player'}</span>`;
    const closeX = document.createElement('button');
    closeX.type = 'button'; closeX.className = 'pwiz-rm-btn'; closeX.textContent = '✕';
    closeX.style.cssText = 'width:22px;height:22px;font-size:0.75rem;';
    closeX.addEventListener('click', close);
    hdr.appendChild(closeX);
    card.appendChild(hdr);

    const grid = document.createElement('div');
    grid.className = 'pwiz-full-picker-grid';

    const THROWER_SKILLS = ['Accurate','Strong Arm','Pass','Nerves of Steel','Cannoneer','Hail Mary Pass','Consummate Professional','Cloud Burster','Dump-Off'];
    const CATCHER_SKILLS = ['Catch','Diving Catch','Sure Hands','Extra Arms','Nerves of Steel'];
    const highlightSet = role === 'thrower' ? new Set(THROWER_SKILLS)
                       : role === 'catcher' ? new Set(CATCHER_SKILLS)
                       : new Set();

    players.forEach(p => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'pwiz-player-pick-card';

      /* Name row */
      const nameRow = document.createElement('div');
      nameRow.className = 'pwiz-pick-name-row';
      const nameEl = document.createElement('div');
      nameEl.className = 'pwiz-pick-name';
      nameEl.textContent = playerLabel(p);
      const posEl = document.createElement('div');
      posEl.className = 'pwiz-pick-pos';
      posEl.textContent = p.pos || '';
      nameRow.appendChild(nameEl); nameRow.appendChild(posEl);
      btn.appendChild(nameRow);

      /* Stats */
      const stats = parseAllStats(p.statsText);
      if (Object.keys(stats).length) {
        const statsRow = document.createElement('div');
        statsRow.className = 'pwiz-pick-stats';
        ['MA', 'ST', 'AG', 'PA', 'AV'].forEach(key => {
          const val = stats[key];
          const st = document.createElement('div');
          st.className = 'pwiz-pick-stat' + (key === 'PA' && role !== 'catcher' ? ' pwiz-stat-focus' : '')
            + (key === 'AG' && role === 'catcher' ? ' pwiz-stat-focus' : '');
          st.innerHTML = `<span class="pwiz-stat-key">${key}</span><span class="pwiz-stat-val">${val || '—'}</span>`;
          statsRow.appendChild(st);
        });
        btn.appendChild(statsRow);
      }

      /* Skills */
      const skills = typeof getPlayerSkills === 'function' ? getPlayerSkills(p) : [];
      if (skills.length) {
        const skillsRow = document.createElement('div');
        skillsRow.className = 'pwiz-pick-skills';
        skills.forEach(s => {
          const chip = makeSkillChip(s, highlightSet.has(s) ? 'highlight' : '');
          skillsRow.appendChild(chip);
        });
        btn.appendChild(skillsRow);
      }

      btn.addEventListener('click', () => { close(); doPlacement(role, p); });
      grid.appendChild(btn);
    });

    card.appendChild(grid);
    overlay.appendChild(card);
    anchor.appendChild(overlay);

    function close() {
      overlay.remove();
      _activePickerClose = null;
      document.removeEventListener('keydown', onKey);
    }
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);

    const onOutside = e => { if (!card.contains(e.target)) { close(); document.removeEventListener('click', onOutside, true); } };
    setTimeout(() => document.addEventListener('click', onOutside, true), 0);
    _activePickerClose = close;
  }

  /* ─────────────────────────────────────────────────────
     TWO-STEP PLACEMENT
     ──────────────────────────────────────────────────── */

  function doPlacement(role, player) {
    const banner = document.getElementById('pwiz-place-banner');
    if (banner) { banner.hidden = false; banner.textContent = `Tap pitch to place ${playerLabel(player)} — tap banner to cancel`; }

    const tokSide = role === 'opposing'
      ? (ws.activeSide === 'left' ? 'away' : 'home')
      : (ws.activeSide === 'left' ? 'home' : 'away');
    const lbl = playerNum(player);
    const id  = role === 'opposing' ? `opp-${Date.now()}` : role;

    ws.pitch?.startPlacement({ id, label: lbl, side: tokSide }, (col, row) => {
      if (banner) banner.hidden = true;

      if (role === 'thrower') {
        if (ws.throwerPos) ws.pitch?.removePlayer(ws.throwerPos.col, ws.throwerPos.row);
        ws.thrower    = player;
        ws.throwerPos = { col, row };
        ws.pitch?.clearPassLine();
        if (ws.catcherPos) ws.pitch?.drawPassLine(col, row, ws.catcherPos.col, ws.catcherPos.row);
        if (ws.zonesOn) ws.pitch?.showPassZones(col, row);
      } else if (role === 'catcher') {
        if (ws.catcherPos) ws.pitch?.removePlayer(ws.catcherPos.col, ws.catcherPos.row);
        ws.catcher    = player;
        ws.catcherPos = { col, row };
        ws.pitch?.clearPassLine();
        if (ws.throwerPos) ws.pitch?.drawPassLine(ws.throwerPos.col, ws.throwerPos.row, col, row);
      } else {
        ws.opposingPlayers.push({ player, col, row, id });
      }
      computeTZ();
      rebuildLeft();
      rebuildRight();
      updateReqs();
    });
  }

  /* ─────────────────────────────────────────────────────
     REQUIREMENTS SUMMARY
     ──────────────────────────────────────────────────── */

  function updateReqs() {
    const reqEl  = document.getElementById('pwiz-req');
    const rollEl = document.getElementById('pwiz-roll');
    if (!reqEl) return;
    reqEl.innerHTML = '';
    if (rollEl) { rollEl.innerHTML = ''; rollEl.hidden = true; }

    if (!ws.thrower || !ws.catcher) {
      reqEl.innerHTML = '<p class="panel-intro" style="margin:0.4rem 0;">Select a thrower and catcher to see requirements.</p>';
      return;
    }

    let range = null;
    if (ws.throwerPos && ws.catcherPos && ws.pitch) {
      range = ws.pitch.getPassRange(ws.throwerPos.col, ws.throwerPos.row, ws.catcherPos.col, ws.catcherPos.row);
    }

    const paBase  = getStat(ws.thrower, 'PA');
    const agBase  = getStat(ws.catcher, 'AG');
    const w            = window.GameState?.currentWeather;
    const isBlizzard   = w?.name === 'Blizzard';

    const nosThrow     = hasSk(ws.thrower, 'Nerves of Steel');
    const hasAccurate  = hasSk(ws.thrower, 'Accurate');
    const hasCannoneer = hasSk(ws.thrower, 'Cannoneer');
    const hasHailMary  = hasSk(ws.thrower, 'Hail Mary Pass');

    const rangePenalty      = range?.mod ?? 0;
    const tzPenalty         = nosThrow ? 0 : ws.tz;
    const accurateBonus     = (hasAccurate && range &&
      (range.rangeKey === 'quick' || range.rangeKey === 'short')) ? 1 : 0;
    const cannoneerBonus    = (hasCannoneer && range &&
      (range.rangeKey === 'long' || range.rangeKey === 'bomb')) ? 1 : 0;
    const verySunnyPenalty  = w?.name === 'Very Sunny' ? 1 : 0;

    const paFinal = paBase >= 99 ? 99 : Math.min(6, Math.max(2,
      paBase - rangePenalty + tzPenalty + verySunnyPenalty - accurateBonus - cannoneerBonus));

    const blizzFumble = isBlizzard && range && (range.rangeKey === 'long' || range.rangeKey === 'bomb');

    const wCatchPenalty  = w?.name === 'Pouring Rain' ? 1 : 0;
    const catchTZPenalty = hasSk(ws.catcher, 'Nerves of Steel') ? 0 : ws.catcherTZ;
    const catchSkBonus   = hasSk(ws.catcher, 'Catch') ? 1 : 0;
    const agFinal        = Math.min(6, Math.max(2, agBase + wCatchPenalty + catchTZPenalty - catchSkBonus));

    const intWeatherPenalty = w?.name === 'Pouring Rain' ? 1 : 0;

    const interceptors = getInterceptors();
    const parts = [];
    if (ws.tz)        parts.push(`Thrower: ${ws.tz} TZ${hasSk(ws.thrower,'Nerves of Steel') ? ' (NoS)' : ''}`);
    if (ws.catcherTZ) parts.push(`Catcher: ${ws.catcherTZ} TZ`);
    if (interceptors.length) parts.push(`${interceptors.length} possible interceptor${interceptors.length > 1 ? 's' : ''}`);
    if (parts.length) {
      const strip = document.createElement('div');
      strip.style.cssText = 'font-family:JetBrains Mono,monospace;font-size:0.6rem;color:rgba(180,210,255,0.5);margin-bottom:0.3rem;';
      strip.textContent = parts.join(' · ');
      reqEl.appendChild(strip);
    }

    if (rollEl) {
      rollEl.hidden = false;
      buildActionRow(rollEl, paFinal, agFinal, blizzFumble, range, interceptors, {
        paBase, rangePenalty, tzPenalty, verySunnyPenalty, accurateBonus, cannoneerBonus,
        nosThrow, hasAccurate, hasCannoneer, hasHailMary,
        agBase, wCatchPenalty, catchTZPenalty, catchSkBonus,
        intWeatherPenalty,
      });
    }
  }

  /* ─────────────────────────────────────────────────────
     ACTION ROW (roll sequence — unchanged from Sprint 6)
     ──────────────────────────────────────────────────── */

  function addCompleteButton(container, label) {
    if (container.querySelector('.pwiz-complete-btn')) return;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'roll-btn pwiz-complete-btn';
    btn.style.cssText = 'margin-top:0.5rem;background:rgba(76,175,80,0.1);border-color:rgba(76,175,80,0.35);color:#81c784;display:block;width:100%;';
    btn.textContent = label ?? '✓ Complete — Close';
    btn.addEventListener('click', () => {
      resetWizardState();
      window.Panels?.closePanel?.('pass');
    });
    container.appendChild(btn);
  }

  function buildActionRow(el, paTarget, agTarget, blizzardFumble, range, interceptors, mods) {
    el.innerHTML = '';

    const RANGE_C = { quick:'#81c784', short:'#FFD54F', long:'#FF8C00', bomb:'#ff8fa0' };
    const rangeStr = range
      ? `<span style="color:${RANGE_C[range.rangeKey] ?? '#ccc'};font-size:0.6rem;">${range.rangeLabel} (${range.distance}sq)</span>`
      : '';

    const sep = document.createElement('div');
    sep.style.cssText = 'border-top:1px solid rgba(80,130,255,0.18);margin:0.5rem 0 0.4rem;padding-top:0.35rem;font-family:JetBrains Mono,monospace;font-size:0.58rem;text-transform:uppercase;letter-spacing:0.1em;color:rgba(180,210,255,0.4);display:flex;align-items:center;gap:0.4rem;';
    sep.innerHTML = `Roll Sequence ${rangeStr}`;
    el.appendChild(sep);

    if (mods && paTarget < 99) {
      const modRows = [];
      modRows.push({ label: `PA ${mods.paBase}+`, value: 'base' });
      if (range?.mod) modRows.push({ label: range.rangeLabel, value: `+${-range.mod}`, cls: 'neg' });
      if (mods.tzPenalty)        modRows.push({ label: `${mods.tzPenalty} Tackle Zone${mods.tzPenalty > 1 ? 's' : ''}`, value: `+${mods.tzPenalty}`, cls: 'neg' });
      if (mods.verySunnyPenalty) modRows.push({ label: '☀ Very Sunny', value: '+1', cls: 'neg' });
      if (mods.nosThrow)         modRows.push({ chip: 'Nerves of Steel', value: '(TZ ignored)', cls: 'pos' });
      if (mods.accurateBonus)    modRows.push({ chip: 'Accurate',        value: '−1', cls: 'pos' });
      if (mods.cannoneerBonus)   modRows.push({ chip: 'Cannoneer',       value: '−1', cls: 'pos' });
      if (mods.hasHailMary)      modRows.push({ chip: 'Hail Mary Pass',  value: '(LB range, no intercept)', cls: 'pos' });
      modRows.push({ label: `Final: ${paTarget}+`, value: '', cls: 'final' });
      el.appendChild(buildModBreakdown(modRows));
    }

    const row = document.createElement('div');
    row.className = 'pwiz-action-row';
    el.appendChild(row);

    const scatterEl = document.createElement('div');
    scatterEl.id = 'pwiz-scatter-area';
    el.appendChild(scatterEl);

    const resultSummary = document.createElement('div');
    resultSummary.id = 'pwiz-result-summary';
    el.appendChild(resultSummary);

    function makeCol(icon, label, targetStr, chipCls) {
      const col = document.createElement('div');
      col.className = 'pwiz-action-col';
      col.innerHTML = `<div class="pwiz-action-chip ${chipCls}">${icon} ${label}<br><span class="pwiz-action-target">${targetStr}</span></div>`;
      const dieWrap = document.createElement('div'); dieWrap.className = 'pwiz-action-die';
      const resEl   = document.createElement('div'); resEl.className   = 'pwiz-action-result';
      col.appendChild(dieWrap); col.appendChild(resEl);
      return { col, dieWrap, resEl };
    }

    function addArrow() {
      const a = document.createElement('div');
      a.className = 'pwiz-action-arrow'; a.textContent = '→';
      row.appendChild(a);
    }

    async function rollD6(wrap) {
      const die = document.createElement('div');
      die.className = 'die'; die.dataset.value = '1';
      die.innerHTML = '<div class="die-face"></div>';
      wrap.innerHTML = ''; wrap.appendChild(die);
      return await Dice.rollDieElement(die);
    }

    function offerPassSkillReroll(resEl) {
      if (!hasSk(ws.thrower, 'Pass') || ws.passSkillUsed) return Promise.resolve(false);
      return new Promise(resolve => {
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'pass-nav-btn';
        btn.style.cssText = 'margin-top:0.2rem;margin-right:0.25rem;background:rgba(212,175,55,0.12);border-color:rgba(212,175,55,0.4);';
        btn.appendChild(makeSkillChip('Pass'));
        btn.insertAdjacentText('beforeend', ' Re-roll');
        const skipBtn = document.createElement('button');
        skipBtn.type = 'button'; skipBtn.className = 'pass-nav-btn';
        skipBtn.style.marginTop = '0.2rem';
        skipBtn.textContent = '→ Skip';
        btn.addEventListener('click', () => {
          btn.remove(); skipBtn.remove();
          ws.passSkillUsed = true;
          ws.teamRRUsed    = true;
          rebuildLeft(); rebuildRight();
          resolve(true);
        });
        skipBtn.addEventListener('click', () => { btn.remove(); skipBtn.remove(); resolve(false); });
        resEl.appendChild(btn); resEl.appendChild(skipBtn);
      });
    }

    function offerReroll(resEl, label) {
      return new Promise(resolve => {
        const gs      = window.GameState?.rerolls;
        const key     = gbSide();
        const rerolls = gs?.[key] ?? 0;
        if (ws.teamRRUsed || rerolls <= 0) { resolve(false); return; }

        const isConsProf = hasSk(ws.thrower, 'Consummate Professional');

        const rrBtn = document.createElement('button');
        rrBtn.type = 'button'; rrBtn.className = 'pass-nav-btn';
        rrBtn.style.cssText = 'margin-top:0.2rem;margin-right:0.25rem;';
        if (isConsProf) {
          rrBtn.appendChild(makeSkillChip('Consummate Professional'));
          rrBtn.insertAdjacentText('beforeend', ` Re-roll (${rerolls}, not spent)`);
        } else {
          rrBtn.textContent = `↺ Team Re-roll (${rerolls})`;
        }
        const skipBtn = document.createElement('button');
        skipBtn.type = 'button'; skipBtn.className = 'pass-nav-btn';
        skipBtn.style.marginTop = '0.2rem';
        skipBtn.textContent = label ?? '→ Continue';
        rrBtn.addEventListener('click', () => {
          rrBtn.remove(); skipBtn.remove();
          ws.teamRRUsed = true;
          if (!isConsProf && gs) {
            gs[key] = Math.max(0, rerolls - 1);
            window.Panels?.renderRerollPips?.(key);
          }
          rebuildLeft(); rebuildRight();
          resolve(true);
        });
        skipBtn.addEventListener('click', () => { rrBtn.remove(); skipBtn.remove(); resolve(false); });
        resEl.appendChild(rrBtn); resEl.appendChild(skipBtn);
      });
    }

    /* Throw column */
    const throwTarget = paTarget >= 99 ? '— (No PA)' : `${paTarget}+`;
    const { col: throwCol, dieWrap: throwDie, resEl: throwRes } = makeCol('🎯', 'Throw', throwTarget, 'chip-throw');
    const throwBtn = document.createElement('button');
    throwBtn.type = 'button'; throwBtn.className = 'roll-btn'; throwBtn.style.marginTop = '0.3rem';
    throwBtn.innerHTML = '<span class="roll-btn-icon">🎲</span> Roll';
    throwCol.appendChild(throwBtn);
    row.appendChild(throwCol);

    /* Intercept columns */
    const intCols = [];
    interceptors.forEach(op => {
      addArrow();
      const ag = getStat(op.player, 'AG');
      const intTarget = Math.min(6, Math.max(2, (ag >= 99 ? 4 : ag) + (mods?.intWeatherPenalty ?? 0)));
      const { col: ic, dieWrap: id_, resEl: ir } = makeCol('⚡', 'Intercept', `${intTarget}+`, 'chip-int');
      ic.querySelector('.pwiz-action-chip').insertAdjacentHTML('beforeend',
        `<div class="pwiz-action-sub">${esc(op.player.name || op.player.pos || '?')}</div>`);
      const intBtn = document.createElement('button');
      intBtn.type = 'button'; intBtn.className = 'roll-btn'; intBtn.style.marginTop = '0.3rem';
      intBtn.innerHTML = '<span class="roll-btn-icon">🎲</span> Roll';
      intBtn.disabled = true;
      ic.appendChild(intBtn);
      row.appendChild(ic);
      intCols.push({ btn: intBtn, dieWrap: id_, resEl: ir, target: intTarget, op });
    });

    /* Catch column */
    addArrow();
    const { col: catchCol, dieWrap: catchDie, resEl: catchRes } = makeCol('🤲', 'Catch', agTarget >= 99 ? '—' : `${agTarget}+`, 'chip-catch');
    const catchBtn = document.createElement('button');
    catchBtn.type = 'button'; catchBtn.className = 'roll-btn'; catchBtn.style.marginTop = '0.3rem';
    catchBtn.innerHTML = '<span class="roll-btn-icon">🎲</span> Roll';
    catchBtn.disabled = true;
    catchCol.appendChild(catchBtn);
    row.appendChild(catchCol);

    throwBtn.addEventListener('click', async () => {
      throwBtn.disabled = true;
      await doThrow();
    });

    async function doThrow() {
      ws.teamRRUsed = false;
      if (blizzardFumble) {
        throwRes.innerHTML = `<span class="result-chip result-chip-bad">❌ Auto-Fumble</span><p class="result-desc" style="font-size:0.65rem;">Blizzard blocks Long/Bomb passes.</p>`;
        ws.passResult = 'fumble';
        catchBtn.disabled = true;
        await autoScatter(scatterEl, ws.throwerPos, 3, '💀 Fumble — Ball Scatters from Thrower');
        addCompleteButton(resultSummary, '💀 Fumble — Close');
        return;
      }

      const roll = await rollD6(throwDie);
      const isFumble   = roll === 1 && paTarget < 99;
      const isAccurate = !isFumble && (paTarget >= 99 || roll >= paTarget);
      ws.passResult = isFumble ? 'fumble' : (isAccurate ? 'accurate' : 'inaccurate');

      const explain = buildThrowExplain(paTarget, range);

      if (isFumble) {
        throwRes.innerHTML = `<div class="result-roll-num">${roll}</div><span class="result-chip result-chip-bad">💀 Fumble!</span>`;
        if (explain) throwRes.insertAdjacentHTML('beforeend', `<p class="result-desc" style="font-size:0.6rem;opacity:0.65;">${explain}</p>`);
        catchBtn.disabled = true;
        await autoScatter(scatterEl, ws.throwerPos, 3, '💀 Fumble — Ball Scatters from Thrower');
        addCompleteButton(resultSummary, '💀 Fumble — Close');
        return;
      }

      const okCls = isAccurate ? 'result-chip-ok' : 'result-chip-warn';
      throwRes.innerHTML = `<div class="result-roll-num">${roll}</div><span class="result-chip ${okCls}">${isAccurate ? '✓ Accurate' : '⚠ Inaccurate'}</span>`;
      if (explain) throwRes.insertAdjacentHTML('beforeend', `<p class="result-desc" style="font-size:0.6rem;opacity:0.65;">${explain}</p>`);

      if (!isAccurate) {
        catchBtn.disabled = true;
        const usePassSkill = await offerPassSkillReroll(throwRes);
        if (usePassSkill) { throwRes.innerHTML = ''; await doThrow(); return; }
        const useReroll = await offerReroll(throwRes, '→ Scatter');
        if (useReroll) { throwRes.innerHTML = ''; await doThrow(); return; }
        await autoScatter(scatterEl, ws.catcherPos, 3, '⚠ Inaccurate — Scatter');
        addCompleteButton(resultSummary, '⚠ Inaccurate — Close');
        return;
      }

      if (intCols.length) intCols[0].btn.disabled = false;
      else catchBtn.disabled = false;
    }

    intCols.forEach(({ btn: intBtn, dieWrap: intDie, resEl: intRes, target: intTarget }, i) => {
      intBtn.addEventListener('click', async () => {
        intBtn.disabled = true;
        const roll   = await rollD6(intDie);
        const caught = roll >= intTarget;
        intRes.innerHTML = `<div class="result-roll-num">${roll}</div><span class="result-chip ${caught ? 'result-chip-bad' : 'result-chip-ok'}">${caught ? '⚔ Intercepted!' : '✓ Not Int.'}</span>`;
        if (caught) {
          ws.passResult = 'intercepted';
          resultSummary.innerHTML = `<div style="margin-top:0.5rem;padding:0.4rem 0.6rem;background:rgba(200,16,46,0.1);border:1px solid rgba(200,16,46,0.3);border-radius:4px;font-family:JetBrains Mono,monospace;font-size:0.72rem;color:#ff8fa0;">⚔ Intercepted — Turnover!</div>`;
          addCompleteButton(resultSummary, '⚔ Intercepted — Close');
        } else {
          if (i + 1 < intCols.length) intCols[i + 1].btn.disabled = false;
          else catchBtn.disabled = false;
        }
      });
    });

    catchBtn.addEventListener('click', async () => {
      catchBtn.disabled = true;
      await doCatch();
    });

    async function doCatch() {
      ws.teamRRUsed = false;
      const roll   = await rollD6(catchDie);
      const caught = roll !== 1 && roll >= agTarget;
      ws.catchResult = caught ? 'caught' : 'dropped';
      const explain = buildCatchExplain(agTarget);
      catchRes.innerHTML = `<div class="result-roll-num">${roll}</div><span class="result-chip ${caught ? 'result-chip-ok' : 'result-chip-bad'}">${caught ? '✓ Caught!' : '✗ Dropped'}</span>`;
      if (explain) catchRes.insertAdjacentHTML('beforeend', `<p class="result-desc" style="font-size:0.6rem;opacity:0.65;">${explain}</p>`);

      if (caught) {
        if (ws.catcher && window.GameState) {
          window.GameState.ballCarrier = { side: ws.activeSide, idx: ws.catcher.idx };
        }
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button'; closeBtn.className = 'roll-btn';
        closeBtn.style.cssText = 'margin-top:0.5rem;background:rgba(76,175,80,0.15);border-color:rgba(76,175,80,0.4);color:#81c784;';
        closeBtn.innerHTML = '✓ Complete Pass — Close';
        closeBtn.addEventListener('click', () => { resetWizardState(); window.Panels?.closePanel?.('pass'); });
        resultSummary.appendChild(closeBtn);
        return;
      }

      const useReroll = await offerReroll(catchRes, '→ Ball Bounces');
      if (useReroll) { catchRes.innerHTML = ''; await doCatch(); return; }
      await autoScatter(scatterEl, ws.catcherPos, 1, 'Dropped — Ball Bounces (D8)');
      addCompleteButton(resultSummary, '✗ Dropped — Close');
    }
  }

  /* ─────────────────────────────────────────────────────
     AUTO-ROLLING SCATTER
     ──────────────────────────────────────────────────── */

  const D8A = {1:'↖',2:'↑',3:'↗',4:'←',5:'→',6:'↙',7:'↓',8:'↘'};
  const D8N = {1:'Up-Left',2:'Up',3:'Up-Right',4:'Left',5:'Right',6:'Down-Left',7:'Down',8:'Down-Right'};

  async function autoScatter(el, originPos, numDice, title) {
    el.innerHTML = '';
    const sec = document.createElement('div');
    sec.style.cssText = 'margin-top:0.5rem;border-top:1px solid rgba(80,130,255,0.18);padding-top:0.4rem;';
    const h = document.createElement('div');
    h.style.cssText = 'font-family:JetBrains Mono,monospace;font-size:0.58rem;text-transform:uppercase;letter-spacing:0.1em;color:rgba(180,210,255,0.4);margin-bottom:0.4rem;';
    h.textContent = title || `↗ Scatter — ${numDice} × D8`;
    sec.appendChild(h);

    const cardsRow = document.createElement('div');
    cardsRow.className = 'pwiz-action-row';
    sec.appendChild(cardsRow);
    el.appendChild(sec);

    const dirsCollected = [];

    for (let i = 0; i < numDice; i++) {
      if (i > 0) {
        const arr = document.createElement('div');
        arr.className = 'pwiz-action-arrow'; arr.textContent = '→';
        cardsRow.appendChild(arr);
        await delay(250);
      }
      const card = document.createElement('div');
      card.className = 'pwiz-action-col';
      const chip = document.createElement('div');
      chip.className = 'pwiz-action-chip chip-scatter';
      chip.innerHTML = `↗ Scatter ${i + 1}<br><span class="pwiz-action-target">D8</span>`;
      card.appendChild(chip);
      const dieWrap = document.createElement('div');
      dieWrap.className = 'pwiz-action-die';
      const dieEl = document.createElement('div');
      dieEl.className = 'die'; dieEl.dataset.value = '1'; dieEl.dataset.sides = '8';
      dieEl.innerHTML = '<div class="die-face d8-face"></div>';
      dieWrap.appendChild(dieEl);
      card.appendChild(dieWrap);
      const resEl = document.createElement('div');
      resEl.className = 'pwiz-action-result';
      card.appendChild(resEl);
      cardsRow.appendChild(card);

      const d = await Dice.rollDieElement(dieEl);
      dirsCollected.push(d);
      resEl.innerHTML = `<div class="result-roll-num" style="font-size:1rem;">${d}</div><div style="font-size:0.65rem;color:rgba(200,220,255,0.7);margin-top:0.1rem;">${D8A[d]} ${D8N[d]}</div>`;
      if (originPos && ws.pitch) ws.pitch.showScatterPath(originPos.col, originPos.row, dirsCollected);
    }
  }

  /* ─────────────────────────────────────────────────────
     ROLL EXPLANATION BUILDERS
     ──────────────────────────────────────────────────── */

  function buildThrowExplain(target, range) {
    if (!ws.thrower || target >= 99) return '';
    const parts = [];
    if (range?.mod) parts.push(`${range.rangeLabel}: +${-range.mod} to target`);
    if (ws.tz > 0) {
      if (hasSk(ws.thrower, 'Nerves of Steel')) parts.push(`${ws.tz} TZ (Nerves of Steel: ignored)`);
      else parts.push(`${ws.tz} TZ: +${ws.tz} to target`);
    }
    const w = window.GameState?.currentWeather;
    if (w?.name === 'Very Sunny') parts.push('Very Sunny: +1 to target');
    if (hasSk(ws.thrower, 'Accurate') && range &&
        (range.rangeKey === 'quick' || range.rangeKey === 'short')) parts.push('Accurate: −1 target');
    if (hasSk(ws.thrower, 'Cannoneer') && range &&
        (range.rangeKey === 'long'  || range.rangeKey === 'bomb'))  parts.push('Cannoneer: −1 target');
    return parts.join(' · ');
  }

  function buildCatchExplain(target) {
    if (!ws.catcher || target >= 99) return '';
    const parts = [];
    if (hasSk(ws.catcher, 'Catch')) parts.push('Catch: −1 target');
    if (ws.catcherTZ > 0) parts.push(`${ws.catcherTZ} TZ penalty`);
    const w = window.GameState?.currentWeather;
    if (w?.name === 'Pouring Rain' || w?.name === 'Blizzard') parts.push(`${w.name}: +1 target`);
    return parts.join(' · ');
  }

  /* ── Boot ── */
  onPanelOpen('panel-pass', () => {
    if (!ws._built) {
      buildLayout();
      ws._built = true;
    } else {
      rebuildLeft();
      rebuildRight();
      window.Panels?.refreshWeatherChips?.();
    }
  });

  panel.addEventListener('bb:diceMode', () => {
    window.Panels?.refreshWeatherChips?.();
  });
}
