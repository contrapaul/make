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

    /* Skill chips */
    if (ws.thrower) {
      const sk = ['Accurate','Cannoneer','Nerves of Steel','Cloud Burster','Hail Mary Pass'];
      const chips = sk.filter(s => hasSk(ws.thrower, s));
      if (chips.length) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.2rem;margin-top:0.4rem;';
        chips.forEach(s => {
          const c = document.createElement('div');
          c.className = 'pwiz-skill-chip pos'; c.textContent = `✦ ${s}`;
          wrap.appendChild(c);
        });
        container.appendChild(wrap);
      }
    }
    if (ws.catcher && hasSk(ws.catcher, 'Catch')) {
      const c = document.createElement('div');
      c.className = 'pwiz-skill-chip pos'; c.textContent = '✦ Catch';
      c.style.marginTop = '0.2rem';
      container.appendChild(c);
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
    /* rangeMod is negative (e.g. -1 for Short). Subtracting a negative increases
       the target, making the pass harder — which is the correct Blood Bowl mechanic. */
    const rangePenalty  = range?.mod ?? 0;           // ≤0
    const tzPenalty     = hasSk(ws.thrower, 'Nerves of Steel') ? 0 : ws.tz;  // ≥0, harder
    const accurateBonus = (hasSk(ws.thrower, 'Accurate')  && range && range.distance <= 6) ? 1 : 0;
    const cannoneerBonus= (hasSk(ws.thrower, 'Cannoneer') && range && range.distance >  6) ? 1 : 0;
    // paBase − penalty (negative mod → subtracting negative = higher target = harder)
    const paFinal       = paBase >= 99 ? 99 : Math.min(6, Math.max(2,
      paBase - rangePenalty + tzPenalty - accurateBonus - cannoneerBonus));

    const w            = window.GameState?.currentWeather;
    const isBlizzard   = w?.name === 'Blizzard';
    const blizzFumble  = isBlizzard && range && (range.rangeKey === 'long' || range.rangeKey === 'bomb');
    const wCatchPenalty  = (w?.name === 'Pouring Rain' || isBlizzard) ? 1 : 0;  // harder
    const catchTZPenalty = hasSk(ws.catcher, 'Nerves of Steel') ? 0 : ws.catcherTZ;
    const catchSkBonus   = hasSk(ws.catcher, 'Catch') ? 1 : 0;
    const agFinal        = Math.min(6, Math.max(2, agBase + wCatchPenalty + catchTZPenalty - catchSkBonus));

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
      buildActionRow(rollEl, paFinal, agFinal, blizzFumble, range, interceptors);
    }
  }

  /* ─────────────────────────────────────────────────────
     ACTION ROW
     ──────────────────────────────────────────────────── */

  function buildActionRow(el, paTarget, agTarget, blizzardFumble, range, interceptors) {
    el.innerHTML = '';

    const RANGE_C = { quick:'#81c784', short:'#FFD54F', long:'#FF8C00', bomb:'#ff8fa0' };
    const rangeStr = range
      ? `<span style="color:${RANGE_C[range.rangeKey] ?? '#ccc'};font-size:0.6rem;">${range.rangeLabel} (${range.distance}sq)</span>`
      : '';

    const sep = document.createElement('div');
    sep.style.cssText = 'border-top:1px solid rgba(80,130,255,0.18);margin:0.5rem 0 0.4rem;padding-top:0.35rem;font-family:JetBrains Mono,monospace;font-size:0.58rem;text-transform:uppercase;letter-spacing:0.1em;color:rgba(180,210,255,0.4);display:flex;align-items:center;gap:0.4rem;';
    sep.innerHTML = `Roll Sequence ${rangeStr}`;
    el.appendChild(sep);

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

    /* Offer re-roll — returns Promise<bool> (true = reroll accepted) */
    function offerReroll(resEl, label) {
      return new Promise(resolve => {
        const side    = ws.activeSide;
        const rerolls = window.GameState?.rerolls?.[side] ?? 0;
        if (rerolls <= 0) { resolve(false); return; }
        const rrBtn = document.createElement('button');
        rrBtn.type = 'button'; rrBtn.className = 'pass-nav-btn';
        rrBtn.style.cssText = 'margin-top:0.2rem;margin-right:0.25rem;';
        rrBtn.textContent = `↺ Re-roll (${rerolls})`;
        const skipBtn = document.createElement('button');
        skipBtn.type = 'button'; skipBtn.className = 'pass-nav-btn';
        skipBtn.style.marginTop = '0.2rem';
        skipBtn.textContent = label ?? '→ Continue';
        rrBtn.addEventListener('click', () => {
          rrBtn.remove(); skipBtn.remove();
          if (window.GameState?.rerolls) window.GameState.rerolls[side] = Math.max(0, rerolls - 1);
          window.Panels?.renderRerollPips?.(side);
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
      const intTarget = Math.min(6, Math.max(2, ag >= 99 ? 4 : ag));
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
        return;
      }

      const okCls = isAccurate ? 'result-chip-ok' : 'result-chip-warn';
      throwRes.innerHTML = `<div class="result-roll-num">${roll}</div><span class="result-chip ${okCls}">${isAccurate ? '✓ Accurate' : '⚠ Inaccurate'}</span>`;
      if (explain) throwRes.insertAdjacentHTML('beforeend', `<p class="result-desc" style="font-size:0.6rem;opacity:0.65;">${explain}</p>`);

      if (!isAccurate) {
        catchBtn.disabled = true;
        const useReroll = await offerReroll(throwRes, '→ Scatter');
        if (useReroll) {
          throwRes.innerHTML = '';
          await doThrow();
          return;
        }
        await autoScatter(scatterEl, ws.catcherPos, 3, '⚠ Inaccurate — Scatter');
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

      const useReroll = await offerReroll(catchRes, '→ Ball Bounces');
      if (useReroll) {
        catchRes.innerHTML = '';
        await doCatch();
        return;
      }
      await autoScatter(scatterEl, ws.catcherPos, 1, 'Dropped — Ball Bounces (D8)');
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
    sec.style.cssText = 'margin-top:0.5rem;padding:0.4rem 0.6rem;background:rgba(3,8,24,0.5);border:1px solid rgba(80,130,255,0.15);border-radius:4px;font-family:JetBrains Mono,monospace;';
    const h = document.createElement('div');
    h.style.cssText = 'font-size:0.62rem;text-transform:uppercase;letter-spacing:0.08em;color:rgba(180,210,255,0.45);margin-bottom:0.4rem;';
    h.textContent = title || `↗ Scatter — ${numDice} × D8`;
    sec.appendChild(h);

    const diceRow = document.createElement('div');
    diceRow.style.cssText = 'display:flex;align-items:flex-start;gap:0.35rem;flex-wrap:wrap;';
    sec.appendChild(diceRow);
    el.appendChild(sec);

    const dirsCollected = [];

    for (let i = 0; i < numDice; i++) {
      if (i > 0) {
        const arr = document.createElement('span');
        arr.textContent = '→';
        arr.style.cssText = 'color:rgba(140,170,220,0.35);font-size:0.9rem;align-self:center;';
        diceRow.appendChild(arr);
        await delay(250);
      }

      const dieWrap = document.createElement('div');
      dieWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:0.1rem;';
      const dieEl = document.createElement('div');
      dieEl.className = 'die'; dieEl.dataset.value = '1'; dieEl.dataset.sides = '8';
      dieEl.innerHTML = '<div class="die-face d8-face"></div>';
      dieEl.style.cssText = 'width:32px;height:32px;display:inline-block;';
      dieWrap.appendChild(dieEl);
      const dirLbl = document.createElement('div');
      dirLbl.style.cssText = 'font-size:0.65rem;color:rgba(200,220,255,0.65);text-align:center;';
      dieWrap.appendChild(dirLbl);
      diceRow.appendChild(dieWrap);

      const d = await Dice.rollDieElement(dieEl);
      dirsCollected.push(d);
      dirLbl.textContent = `${D8A[d]} ${D8N[d]}`;

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
    if (range?.mod) parts.push(`${range.rangeLabel}: ${range.mod < 0 ? '' : '+'}${range.mod} to roll`);
    if (ws.tz > 0) {
      if (hasSk(ws.thrower, 'Nerves of Steel')) parts.push(`${ws.tz} TZ (Nerves of Steel: ignored)`);
      else parts.push(`${ws.tz} TZ penalty`);
    }
    if (hasSk(ws.thrower, 'Accurate') && range && range.distance <= 6) parts.push('Accurate: −1 target');
    if (hasSk(ws.thrower, 'Cannoneer') && range && range.distance > 6)  parts.push('Cannoneer: −1 target');
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
