'use strict';

/* ═══════════════════════════════════════════════════════
   Blood Bowl Companion — js/pass-wizard.js
   Sprint 4: Revised pass wizard.

   Changes from Sprint 3B:
   - Roster hidden behind Add buttons (on-demand dropdowns)
   - Player numbers shown in roster (#N Name format)
   - Two-step placement: pick player → tap pitch to place
   - Players draggable on pitch (snap-to-grid)
   - Multiple opposing players; TZ auto-calculated from
     their tackle zones around thrower/catcher
   - Circular zones fix via BloodBowlPitch Euclidean cutoff
   - Interception auto-detected from line of pass
   - Fumble → scatter from thrower square (not catcher)
   - Failed throw locks catch button until scatter completes
   - Failed catch → auto-scatter (1 bounce)
   - Scatter: horizontal left-to-right, auto-rolling
   - Team re-roll buttons after failed rolls
   - Skill result explanation text on each roll
   ═══════════════════════════════════════════════════════ */

function parsePassStat(statsText, key) {
  if (!statsText) return 99;
  if (new RegExp(`\\b${key}\\s*[—\\-]`, 'i').test(statsText)) return 99;
  const m = statsText.match(new RegExp(`\\b${key}\\s*(\\d+)`, 'i'));
  return m ? parseInt(m[1], 10) : 99;
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
    opposingPlayers: [],   // [{ player, col, row, id }]
    tz:              0,    // computed from opposing players near thrower
    catcherTZ:       0,    // computed from opposing players near catcher
    zonesOn:         false,
    passResult:      null,
    catchResult:     null,
    pitch:           null,
  };

  function getStat(p, key) { return parsePassStat(p?.statsText, key); }

  function hasSk(p, name) {
    if (!p) return false;
    const sk = typeof getPlayerSkills === 'function' ? getPlayerSkills(p) : [];
    return sk.some(s => s.toLowerCase() === name.toLowerCase());
  }

  function resetRoll() { ws.passResult = null; ws.catchResult = null; }

  /* Player number / label helpers */
  function playerNum(p) { return p?.number != null ? String(p.number) : String((p?.idx ?? 0) + 1); }
  function playerLabel(p) { return `#${playerNum(p)} ${p?.name || p?.pos || '?'}`; }

  /* Compute TZ counts from placed opposing players */
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

  /* Bresenham line cells between two squares (excludes endpoints) */
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

  /* Find opposing players that could intercept (on or adjacent to pass line) */
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

  /* ─────────────────────────────────────────────────────
     LAYOUT BUILDER
     ──────────────────────────────────────────────────── */

  function buildLayout() {
    body.innerHTML = '';
    resetRoll();

    /* Weather chip */
    const wChip = document.createElement('div');
    wChip.className = 'weather-chip-slot'; wChip.id = 'wchip-pass'; wChip.hidden = true;
    body.appendChild(wChip);
    window.Panels?.refreshWeatherChips?.();

    /* Team toggle */
    const teamRow = document.createElement('div');
    teamRow.className = 'pwiz-team-tabs';
    teamRow.style.marginBottom = '0.5rem';
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
        rebuildLeft(); updateReqs();
      });
      teamRow.appendChild(btn);
    });
    body.appendChild(teamRow);

    /* Two-column layout */
    const layout = document.createElement('div');
    layout.className = 'pwiz-layout';
    body.appendChild(layout);

    const leftCol  = document.createElement('div');
    leftCol.className = 'pwiz-col-left';
    leftCol.id = 'pwiz-left-col';
    layout.appendChild(leftCol);

    const rightCol = document.createElement('div');
    rightCol.className = 'pwiz-col-right';
    layout.appendChild(rightCol);

    /* Placement banner */
    const placeBanner = document.createElement('div');
    placeBanner.id = 'pwiz-place-banner';
    placeBanner.hidden = true;
    placeBanner.style.cssText = 'padding:0.3rem 0.6rem;background:rgba(212,175,55,0.15);border:1px solid rgba(212,175,55,0.4);border-radius:4px;font-family:JetBrains Mono,monospace;font-size:0.68rem;color:#D4AF37;margin-bottom:0.3rem;text-align:center;cursor:pointer;';
    placeBanner.title = 'Click to cancel placement';
    placeBanner.addEventListener('click', () => {
      ws.pitch?.cancelPlacement();
      placeBanner.hidden = true;
    });
    rightCol.appendChild(placeBanner);

    /* Pitch */
    const pitchWrap = document.createElement('div');
    pitchWrap.className = 'pwiz-pitch-wrap';
    rightCol.appendChild(pitchWrap);

    if (typeof window.BloodBowlPitch !== 'undefined') {
      ws.pitch = new window.BloodBowlPitch(pitchWrap, { scale: 0.6 });
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
        updateReqs();
      };
    }

    /* Zones toggle */
    const zonesBtn = document.createElement('button');
    zonesBtn.type = 'button'; zonesBtn.className = 'dmt-btn';
    zonesBtn.style.marginTop = '0.3rem';
    zonesBtn.textContent = '⬡ Show Zones';
    zonesBtn.addEventListener('click', () => {
      ws.zonesOn = !ws.zonesOn;
      zonesBtn.classList.toggle('active', ws.zonesOn);
      if (ws.zonesOn && ws.throwerPos) ws.pitch?.showPassZones(ws.throwerPos.col, ws.throwerPos.row);
      else ws.pitch?.hidePassZones();
    });
    rightCol.appendChild(zonesBtn);

    /* Requirements + roll area */
    const reqEl = document.createElement('div');
    reqEl.className = 'pwiz-requirements'; reqEl.id = 'pwiz-req';
    rightCol.appendChild(reqEl);

    const rollEl = document.createElement('div');
    rollEl.id = 'pwiz-roll'; rollEl.hidden = true;
    rightCol.appendChild(rollEl);

    buildLeftCol(leftCol);
    updateReqs();
  }

  /* ─────────────────────────────────────────────────────
     LEFT COLUMN — Add buttons + active player info
     ──────────────────────────────────────────────────── */

  function rebuildLeft() {
    const el = document.getElementById('pwiz-left-col');
    if (el) buildLeftCol(el);
  }

  function buildLeftCol(container) {
    container.innerHTML = '';

    /* Thrower */
    buildPlayerSlot(container, 'Thrower', ws.thrower, ws.throwerPos,
      () => {
        if (ws.throwerPos) ws.pitch?.removePlayer(ws.throwerPos.col, ws.throwerPos.row);
        ws.thrower = null; ws.throwerPos = null;
        ws.pitch?.clearPassLine(); ws.pitch?.hidePassZones(); ws.zonesOn = false;
        computeTZ(); rebuildLeft(); updateReqs();
      },
      () => openPicker('thrower')
    );

    /* Catcher */
    buildPlayerSlot(container, 'Catcher', ws.catcher, ws.catcherPos,
      () => {
        if (ws.catcherPos) ws.pitch?.removePlayer(ws.catcherPos.col, ws.catcherPos.row);
        ws.catcher = null; ws.catcherPos = null;
        ws.pitch?.clearPassLine();
        computeTZ(); rebuildLeft(); updateReqs();
      },
      () => openPicker('catcher')
    );

    /* Opposing players */
    const oppHdr = document.createElement('div');
    oppHdr.style.cssText = 'font-family:JetBrains Mono,monospace;font-size:0.57rem;text-transform:uppercase;letter-spacing:0.1em;color:rgba(180,210,255,0.35);margin:0.55rem 0 0.2rem;';
    oppHdr.textContent = 'Opposing Players';
    container.appendChild(oppHdr);

    ws.opposingPlayers.forEach((op, i) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:0.3rem;margin-bottom:0.2rem;padding:0.2rem 0.4rem;background:rgba(200,16,46,0.08);border:1px solid rgba(200,16,46,0.2);border-radius:3px;';
      const lbl = document.createElement('span');
      lbl.style.cssText = 'flex:1;font-family:JetBrains Mono,monospace;font-size:0.62rem;color:rgba(255,150,150,0.8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      lbl.textContent = `${esc(playerLabel(op.player))}`;
      const pos = document.createElement('span');
      pos.style.cssText = 'font-family:JetBrains Mono,monospace;font-size:0.55rem;color:rgba(255,150,150,0.4);flex-shrink:0;';
      pos.textContent = `(${op.col},${op.row})`;
      const rmBtn = document.createElement('button');
      rmBtn.type = 'button'; rmBtn.className = 'pwiz-rm-btn'; rmBtn.textContent = '✕';
      rmBtn.addEventListener('click', () => {
        ws.pitch?.removePlayer(op.col, op.row);
        ws.opposingPlayers.splice(i, 1);
        computeTZ(); rebuildLeft(); updateReqs();
      });
      row.appendChild(lbl); row.appendChild(pos); row.appendChild(rmBtn);
      container.appendChild(row);
    });

    const addOppBtn = document.createElement('button');
    addOppBtn.type = 'button'; addOppBtn.className = 'pwiz-add-btn';
    addOppBtn.textContent = '+ Add Opposing Player';
    addOppBtn.addEventListener('click', () => openPicker('opposing'));
    container.appendChild(addOppBtn);

    /* Skill chips — thrower/catcher skills shown as hoverable chips.
       Skills that affect the roll are displayed inline in the roll area (Sprint 3);
       here we show informational skills that don't modify the math directly. */
    if (ws.thrower) {
      const infoSkills = ['Pass','Cloud Burster','Dump-Off','Hail Mary Pass','Consummate Professional'];
      const chips = infoSkills.filter(s => hasSk(ws.thrower, s));
      if (chips.length) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.2rem;margin-top:0.4rem;';
        chips.forEach(s => {
          const c = makeSkillChip(s);
          c.style.setProperty('--chip-prefix', '✦ ');
          wrap.appendChild(c);
        });
        container.appendChild(wrap);
      }
    }
    if (ws.catcher) {
      const catcherInfoSkills = ['Diving Catch','Sure Hands','Extra Arms'];
      const chips = catcherInfoSkills.filter(s => hasSk(ws.catcher, s));
      if (chips.length) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.2rem;margin-top:0.4rem;';
        chips.forEach(s => wrap.appendChild(makeSkillChip(s)));
        container.appendChild(wrap);
      }
    }

    /* Weather */
    const w = window.GameState?.currentWeather;
    if (w?.effect && w.effect !== 'No effect') {
      const chip = document.createElement('div');
      chip.className = 'pwiz-skill-chip neg';
      chip.style.marginTop = '0.3rem';
      chip.textContent = `${w.emoji ?? ''} ${w.effect}`.trim();
      container.appendChild(chip);
    }
  }

  function buildPlayerSlot(container, role, player, pos, onRemove, onAdd) {
    if (player) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:0.3rem;margin-bottom:0.2rem;padding:0.25rem 0.5rem;background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.3);border-radius:4px;';
      const lbl = document.createElement('span');
      lbl.style.cssText = 'flex:1;font-family:JetBrains Mono,monospace;font-size:0.62rem;color:#D4AF37;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      lbl.innerHTML = `<span style="opacity:0.5;">${esc(role)}:</span> ${esc(playerLabel(player))}`;
      if (pos) {
        const posLbl = document.createElement('span');
        posLbl.style.cssText = 'font-size:0.55rem;color:rgba(212,175,55,0.45);flex-shrink:0;font-family:JetBrains Mono,monospace;';
        posLbl.textContent = `(${pos.col},${pos.row})`;
        row.appendChild(lbl); row.appendChild(posLbl);
      } else { row.appendChild(lbl); }
      const rm = document.createElement('button');
      rm.type = 'button'; rm.className = 'pwiz-rm-btn'; rm.textContent = '✕';
      rm.addEventListener('click', onRemove);
      row.appendChild(rm);
      container.appendChild(row);
    }

    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'pwiz-add-btn';
    btn.textContent = player ? `↺ Change ${role}` : `+ Add ${role}`;
    btn.addEventListener('click', onAdd);
    container.appendChild(btn);
  }

  /* ─────────────────────────────────────────────────────
     ROSTER PICKER DROPDOWN
     ──────────────────────────────────────────────────── */

  let _activePickerClose = null;

  function openPicker(role) {
    _activePickerClose?.();

    const anchor = document.getElementById('pwiz-left-col');
    if (!anchor) return;

    const side = role === 'opposing'
      ? (ws.activeSide === 'left' ? 'right' : 'left')
      : ws.activeSide;
    let players = window.getPlayerList?.(side) ?? [];
    if (!players.length) return;

    if (role === 'thrower') players = [...players].sort((a, b) => getStat(a, 'PA') - getStat(b, 'PA'));
    else if (role === 'catcher') players = [...players].sort((a, b) => getStat(a, 'AG') - getStat(b, 'AG'));
    if (role === 'opposing') players = players.filter(p => !window.STATUS_META?.[p.status]?.dim);

    const overlay = document.createElement('div');
    overlay.className = 'pwiz-picker-overlay';

    const card = document.createElement('div');
    card.className = 'pwiz-picker-card';

    const hdr = document.createElement('div');
    hdr.className = 'pwiz-picker-hdr';
    hdr.textContent = role === 'thrower' ? 'Select Thrower' : role === 'catcher' ? 'Select Catcher' : 'Select Opposing Player';
    card.appendChild(hdr);

    players.forEach(p => {
      const statKey = role === 'catcher' ? 'AG' : 'PA';
      const val = getStat(p, statKey);
      const str = val >= 99 ? '—' : `${val}+`;
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'pwiz-player-row';
      btn.innerHTML = `<span class="pwiz-row-name">${esc(`#${playerNum(p)} ${p.name || p.pos || '?'}`)}</span>`
        + (role !== 'opposing' ? `<span class="pwiz-row-stat${val >= 99 ? ' pwiz-stat-none' : ''}">${str}</span>` : '');
      btn.addEventListener('click', () => {
        close();
        doPlacement(role, p);
      });
      card.appendChild(btn);
    });

    overlay.appendChild(card);
    anchor.appendChild(overlay);

    function close() {
      overlay.remove();
      _activePickerClose = null;
      document.removeEventListener('click', onOutside, true);
      document.removeEventListener('keydown', onKey);
    }

    const onOutside = e => { if (!card.contains(e.target)) close(); };
    const onKey     = e => { if (e.key === 'Escape') close(); };
    setTimeout(() => {
      document.addEventListener('click', onOutside, true);
      document.addEventListener('keydown', onKey);
    }, 0);
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

    /* ── Throw modifiers ─────────────────────────────────────
       All mods are penalty values (positive = harder, added to target).
       rangeMod comes from getPassRange as a negative number;
       subtracting it raises the target. */
    const nosThrow    = hasSk(ws.thrower, 'Nerves of Steel');
    const hasAccurate = hasSk(ws.thrower, 'Accurate');
    const hasCannoneer= hasSk(ws.thrower, 'Cannoneer');
    const hasHailMary = hasSk(ws.thrower, 'Hail Mary Pass');

    const rangePenalty   = range?.mod ?? 0;   // ≤0; negating it adds to target
    const tzPenalty      = nosThrow ? 0 : ws.tz;
    /* Accurate: +1 to PA roll on Quick/Short (reduces target by 1) */
    const accurateBonus  = (hasAccurate && range &&
      (range.rangeKey === 'quick' || range.rangeKey === 'short')) ? 1 : 0;
    /* Cannoneer: +1 to PA roll on Long/Long Bomb (reduces target by 1) */
    const cannoneerBonus = (hasCannoneer && range &&
      (range.rangeKey === 'long' || range.rangeKey === 'bomb')) ? 1 : 0;
    /* Very Sunny: -1 to all PA tests (raises target by 1) */
    const verySunnyPenalty = w?.name === 'Very Sunny' ? 1 : 0;

    const paFinal = paBase >= 99 ? 99 : Math.min(6, Math.max(2,
      paBase - rangePenalty + tzPenalty + verySunnyPenalty - accurateBonus - cannoneerBonus));

    /* Hail Mary: treat as Long Bomb but accurate = inaccurate, cannot intercept */
    const blizzFumble  = isBlizzard && range && (range.rangeKey === 'long' || range.rangeKey === 'bomb');

    /* ── Catch modifiers ─────────────────────────────────────
       Pouring Rain: -1 to Catch roll (raises target by 1).
       Blizzard does NOT affect catching per rulebook. */
    const wCatchPenalty  = w?.name === 'Pouring Rain' ? 1 : 0;
    const catchTZPenalty = hasSk(ws.catcher, 'Nerves of Steel') ? 0 : ws.catcherTZ;
    const catchSkBonus   = hasSk(ws.catcher, 'Catch') ? 1 : 0;
    const agFinal        = Math.min(6, Math.max(2, agBase + wCatchPenalty + catchTZPenalty - catchSkBonus));

    /* ── Intercept modifier ──────────────────────────────────
       Pouring Rain also applies -1 to Intercept rolls. */
    const intWeatherPenalty = w?.name === 'Pouring Rain' ? 1 : 0;

    /* TZ / interceptor info strip */
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
     ACTION ROW
     ──────────────────────────────────────────────────── */

  /* Appends a Close/Complete button to the given container. */
  function addCompleteButton(container, label) {
    if (container.querySelector('.pwiz-complete-btn')) return; // idempotent
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'roll-btn pwiz-complete-btn';
    btn.style.cssText = 'margin-top:0.5rem;background:rgba(76,175,80,0.1);border-color:rgba(76,175,80,0.35);color:#81c784;display:block;width:100%;';
    btn.textContent = label ?? '✓ Complete — Close';
    btn.addEventListener('click', () => window.Panels?.closePanel?.('pass'));
    container.appendChild(btn);
  }

  /* ── Skill tooltip chip ─────────────────────────────────────
     Creates a small clickable/hoverable chip that shows the skill
     description from skills.json on interaction. */
  function makeSkillChip(skillName, extraClass) {
    const entry = typeof lookupSkill === 'function' ? lookupSkill(skillName) : null;
    const chip  = document.createElement('span');
    chip.className = 'pwiz-skill-chip pos pwiz-skill-inline' + (extraClass ? ` ${extraClass}` : '');
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

  /* ── Modifier breakdown element ─────────────────────────────
     Returns a <div> listing every factor that contributed to a
     target number. Used under both the throw and catch columns. */
  function buildModBreakdown(rows) {
    const wrap = document.createElement('div');
    wrap.className = 'pwiz-mod-breakdown';
    rows.forEach(({ label, value, chip: chipName, cls }) => {
      const row = document.createElement('div');
      row.className = 'pwiz-mod-row' + (cls ? ` ${cls}` : '');
      const lbl = document.createElement('span');
      lbl.className = 'pwiz-mod-label';
      if (chipName) {
        lbl.appendChild(makeSkillChip(chipName));
      } else {
        lbl.textContent = label;
      }
      const val = document.createElement('span');
      val.className = 'pwiz-mod-value';
      val.textContent = value;
      row.appendChild(lbl);
      row.appendChild(val);
      wrap.appendChild(row);
    });
    return wrap;
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

    /* ── Throw modifier breakdown (Sprint 3) ─────────── */
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

    /* Scatter area — populated dynamically */
    const scatterEl = document.createElement('div');
    scatterEl.id = 'pwiz-scatter-area';
    el.appendChild(scatterEl);

    /* Result summary area — Complete button goes here */
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

    /* Offer the Pass skill re-roll (Sprint 4).
       Only for failed PA tests (not fumbles). Returns Promise<bool>. */
    function offerPassSkillReroll(resEl) {
      if (!hasSk(ws.thrower, 'Pass')) return Promise.resolve(false);
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
        btn.addEventListener('click', () => { btn.remove(); skipBtn.remove(); resolve(true); });
        skipBtn.addEventListener('click', () => { btn.remove(); skipBtn.remove(); resolve(false); });
        resEl.appendChild(btn); resEl.appendChild(skipBtn);
      });
    }

    /* Offer a team re-roll — returns Promise<bool> (true = re-roll accepted).
       Consummate Professional: thrower uses re-roll without removing it from pool. */
    function offerReroll(resEl, label) {
      return new Promise(resolve => {
        const side       = ws.activeSide;
        const rerolls    = window.GameState?.rerolls?.[side] ?? 0;
        const isConsProf = hasSk(ws.thrower, 'Consummate Professional');
        if (rerolls <= 0 && !isConsProf) { resolve(false); return; }
        if (rerolls <= 0) { resolve(false); return; }

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
          /* Consummate Professional: do NOT decrement the re-roll pool */
          if (!isConsProf && window.GameState?.rerolls) {
            window.GameState.rerolls[side] = Math.max(0, rerolls - 1);
            window.Panels?.renderRerollPips?.(side);
          }
          resolve(true);
        });
        skipBtn.addEventListener('click', () => { rrBtn.remove(); skipBtn.remove(); resolve(false); });
        resEl.appendChild(rrBtn); resEl.appendChild(skipBtn);
      });
    }

    /* ── THROW column ── */
    const throwTarget = paTarget >= 99 ? '— (No PA)' : `${paTarget}+`;
    const { col: throwCol, dieWrap: throwDie, resEl: throwRes } = makeCol('🎯', 'Throw', throwTarget, 'chip-throw');
    const throwBtn = document.createElement('button');
    throwBtn.type = 'button'; throwBtn.className = 'roll-btn'; throwBtn.style.marginTop = '0.3rem';
    throwBtn.innerHTML = '<span class="roll-btn-icon">🎲</span> Roll';
    throwCol.appendChild(throwBtn);
    row.appendChild(throwCol);

    /* ── INTERCEPT columns ── */
    const intCols = [];
    interceptors.forEach(op => {
      addArrow();
      const ag = getStat(op.player, 'AG');
      /* Pouring Rain: -1 to intercept roll (raises target by 1) */
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

    /* ── CATCH column ── */
    addArrow();
    const { col: catchCol, dieWrap: catchDie, resEl: catchRes } = makeCol('🤲', 'Catch', agTarget >= 99 ? '—' : `${agTarget}+`, 'chip-catch');
    const catchBtn = document.createElement('button');
    catchBtn.type = 'button'; catchBtn.className = 'roll-btn'; catchBtn.style.marginTop = '0.3rem';
    catchBtn.innerHTML = '<span class="roll-btn-icon">🎲</span> Roll';
    catchBtn.disabled = true;
    catchCol.appendChild(catchBtn);
    row.appendChild(catchCol);

    /* ── THROW roll handler ── */
    throwBtn.addEventListener('click', async () => {
      throwBtn.disabled = true;
      await doThrow();
    });

    async function doThrow() {
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
        /* Pro can re-roll a fumble; team re-roll cannot */
        if (typeof promptSkillUse === 'function' && hasSkill(ws.thrower, 'Pro')) {
          const proOk = await promptSkillUse(ws.thrower, 'Pro', throwRes, rollD6);
          if (proOk) { throwRes.innerHTML = ''; await doThrow(); return; }
        }
        await autoScatter(scatterEl, ws.throwerPos, 3, '💀 Fumble — Ball Scatters from Thrower');
        addCompleteButton(resultSummary, '💀 Fumble — Close');
        return;
      }

      const okCls = isAccurate ? 'result-chip-ok' : 'result-chip-warn';
      throwRes.innerHTML = `<div class="result-roll-num">${roll}</div><span class="result-chip ${okCls}">${isAccurate ? '✓ Accurate' : '⚠ Inaccurate'}</span>`;
      if (explain) throwRes.insertAdjacentHTML('beforeend', `<p class="result-desc" style="font-size:0.6rem;opacity:0.65;">${explain}</p>`);

      if (!isAccurate) {
        catchBtn.disabled = true;
        /* Pass skill re-roll first (Sprint 4) */
        const usePassSkill = await offerPassSkillReroll(throwRes);
        if (usePassSkill) { throwRes.innerHTML = ''; await doThrow(); return; }
        /* Pro skill check before team re-roll */
        if (typeof promptSkillUse === 'function' && hasSkill(ws.thrower, 'Pro')) {
          const proOk = await promptSkillUse(ws.thrower, 'Pro', throwRes, rollD6);
          if (proOk) { throwRes.innerHTML = ''; await doThrow(); return; }
        }
        const useReroll = await offerReroll(throwRes, '→ Scatter');
        if (useReroll) {
          throwRes.innerHTML = '';
          await doThrow();
          return;
        }
        await autoScatter(scatterEl, ws.catcherPos, 3, '⚠ Inaccurate — Scatter');
        addCompleteButton(resultSummary, '⚠ Inaccurate — Close');
        return;
      }

      /* Accurate: arm first interceptor or catch */
      if (intCols.length) intCols[0].btn.disabled = false;
      else catchBtn.disabled = false;
    }

    /* ── INTERCEPT roll handlers ── */
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

    /* ── CATCH roll handler ── */
    catchBtn.addEventListener('click', async () => {
      catchBtn.disabled = true;
      await doCatch();
    });

    async function doCatch() {
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
        closeBtn.addEventListener('click', () => window.Panels?.closePanel?.('pass'));
        resultSummary.appendChild(closeBtn);
        return;
      }

      /* Pro skill check before team re-roll */
      if (typeof promptSkillUse === 'function' && hasSkill(ws.catcher, 'Pro')) {
        const proOk = await promptSkillUse(ws.catcher, 'Pro', catchRes, rollD6);
        if (proOk) { catchRes.innerHTML = ''; await doCatch(); return; }
      }
      const useReroll = await offerReroll(catchRes, '→ Ball Bounces');
      if (useReroll) {
        catchRes.innerHTML = '';
        await doCatch();
        return;
      }
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

    /* Section wrapper */
    const sec = document.createElement('div');
    sec.style.cssText = 'margin-top:0.5rem;border-top:1px solid rgba(80,130,255,0.18);padding-top:0.4rem;';
    const h = document.createElement('div');
    h.style.cssText = 'font-family:JetBrains Mono,monospace;font-size:0.58rem;text-transform:uppercase;letter-spacing:0.1em;color:rgba(180,210,255,0.4);margin-bottom:0.4rem;';
    h.textContent = title || `↗ Scatter — ${numDice} × D8`;
    sec.appendChild(h);

    /* Cards row — same flex container as pwiz-action-row */
    const cardsRow = document.createElement('div');
    cardsRow.className = 'pwiz-action-row';
    sec.appendChild(cardsRow);
    el.appendChild(sec);

    const dirsCollected = [];

    for (let i = 0; i < numDice; i++) {
      /* Arrow separator between cards */
      if (i > 0) {
        const arr = document.createElement('div');
        arr.className = 'pwiz-action-arrow'; arr.textContent = '→';
        cardsRow.appendChild(arr);
        await delay(250);
      }

      /* Card — same structure as Throw/Catch columns */
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

      /* Roll this die */
      const d = await Dice.rollDieElement(dieEl);
      dirsCollected.push(d);
      resEl.innerHTML = `<div class="result-roll-num" style="font-size:1rem;">${d}</div><div style="font-size:0.65rem;color:rgba(200,220,255,0.7);margin-top:0.1rem;">${D8A[d]} ${D8N[d]}</div>`;

      if (originPos && ws.pitch) {
        ws.pitch.showScatterPath(originPos.col, originPos.row, dirsCollected);
      }
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
  buildLayout();

  onPanelOpen('panel-pass', () => {
    ws.thrower = null; ws.catcher = null;
    ws.throwerPos = null; ws.catcherPos = null;
    ws.opposingPlayers = [];
    ws.zonesOn = false;
    resetRoll();
    buildLayout();
  });

  panel.addEventListener('bb:diceMode', () => {
    window.Panels?.refreshWeatherChips?.();
  });
}
