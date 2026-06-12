'use strict';

/* ═══════════════════════════════════════════════════════
   Blood Bowl Companion — js/pass-wizard.js
   Rebuilt layout: trading-card players (thrower left, catcher
   right), pitch + cards lowered, a single Roll button in a
   dice frame under the pitch, sequence info above the pitch,
   and a block-wizard-style single-roll flow.
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

/* Skills shown as cards under the matching player. */
const PASS_THROWER_SKILLS = ['Pass','Accurate','Strong Arm','Cannoneer','Hail Mary Pass',
  'Nerves of Steel','Consummate Professional','Cloud Burster','Dump-Off','Pro','Safe Pass'];
const PASS_CATCHER_SKILLS = ['Catch','Diving Catch','Sure Hands','Extra Arms','Nerves of Steel','Pro'];

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
    activeStepKey:   'throw',
    pitch:           null,
    passSkillUsed:   false,
    teamRRUsed:      false,
    plan:            null,
    intIndex:        0,
    _built:          false,
    _fit:            null,
  };

  /* Fixed design scale for the pitch; the whole stage is then ratio-locked
     to the panel by FitScale, so the pitch never scales twice dynamically. */
  const PITCH_SCALE = 0.78;

  const gbSide = () => (ws.activeSide === 'left' ? 'home' : 'away');
  const delay  = ms => new Promise(r => setTimeout(r, ms));
  const cap    = s => s.charAt(0).toUpperCase() + s.slice(1);
  const getStat = (p, key) => parsePassStat(p?.statsText, key);

  function hasSk(p, name) {
    if (!p) return false;
    const sk = typeof getPlayerSkills === 'function' ? getPlayerSkills(p) : [];
    return sk.some(s => s.replace(/\s*\(.*\)$/, '').trim().toLowerCase() === name.toLowerCase());
  }

  function resetRoll() {
    ws.passResult = null; ws.catchResult = null;
    ws.passSkillUsed = false; ws.teamRRUsed = false;
    ws.intIndex = 0;
  }

  function resetWizardState() {
    ws.pitch?.clear();
    ws.thrower = null; ws.catcher = null;
    ws.throwerPos = null; ws.catcherPos = null;
    ws.opposingPlayers = [];
    ws.zonesOn = false; ws._built = false; ws.plan = null;
    resetRoll();
  }

  const playerNum   = p => (p?.number != null ? String(p.number) : String((p?.idx ?? 0) + 1));
  const playerLabel = p => `#${playerNum(p)} ${p?.name || p?.pos || '?'}`;

  function computeTZ() {
    const count = pos => {
      if (!pos) return 0;
      let n = 0;
      for (const op of ws.opposingPlayers) {
        if (Math.abs(op.col - pos.col) <= 1 && Math.abs(op.row - pos.row) <= 1 &&
            !(op.col === pos.col && op.row === pos.row)) n++;
      }
      return n;
    };
    ws.tz = count(ws.throwerPos);
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
    if (hasSk(ws.thrower, 'Hail Mary Pass')) return [];
    const line = getLineCells(ws.throwerPos.col, ws.throwerPos.row, ws.catcherPos.col, ws.catcherPos.row);
    return ws.opposingPlayers
      .filter(op => line.some(c => Math.abs(c.col - op.col) <= 1 && Math.abs(c.row - op.row) <= 1))
      .sort((a, b) => {
        const da = Math.hypot(a.col - ws.throwerPos.col, a.row - ws.throwerPos.row);
        const db = Math.hypot(b.col - ws.throwerPos.col, b.row - ws.throwerPos.row);
        return da - db;
      });
  }

  function _pitchScale() {
    const vw      = window.innerWidth;
    const panelW  = Math.min(vw * 0.82, 1600);
    const sideW   = 2 * Math.max(150, Math.min(220, vw * 0.13));
    const centerW = Math.max(200, panelW - sideW - 60);
    const target  = Math.min(centerW * 0.98, vw * 0.6);
    return Math.max(0.35, target / 784);
  }

  /* ─────────────────────────────────────────────────────
     LAYOUT
     ──────────────────────────────────────────────────── */

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function buildLayout() {
    body.innerHTML = '';
    resetRoll();

    const wChip = el('div', 'weather-chip-slot'); wChip.id = 'wchip-pass'; wChip.hidden = true;
    body.appendChild(wChip);
    window.Panels?.refreshWeatherChips?.();

    const root = el('div', 'pwiz3'); root.id = 'pwiz3-root';
    body.appendChild(root);

    /* Header — team tabs only */
    const teamRow = el('div', 'pwiz-team-tabs');
    ['Home', 'Away'].forEach((label, i) => {
      const side = i === 0 ? 'left' : 'right';
      const btn  = el('button', 'pwiz-team-tab' + (ws.activeSide === side ? ' active' : ''));
      btn.type = 'button'; btn.textContent = label;
      btn.addEventListener('click', () => {
        if (ws.activeSide === side) return;
        ws.activeSide = side;
        ws.thrower = ws.catcher = ws.throwerPos = ws.catcherPos = null;
        ws.opposingPlayers = []; ws.pitch?.clear();
        teamRow.querySelectorAll('.pwiz-team-tab').forEach(b => b.classList.toggle('active', b === btn));
        buildPlayerColumn('thrower'); buildPlayerColumn('catcher'); buildOppList(); armWizard();
      });
      teamRow.appendChild(btn);
    });
    root.appendChild(teamRow);

    /* Sequence strip (top, above pitch) */
    const seq = el('div', 'pwiz3-seq'); seq.id = 'pwiz3-seq';
    root.appendChild(seq);

    /* Stage: thrower skills | thrower card | pitch | catcher card | catcher skills */
    const stage = el('div', 'pwiz3-stage');
    root.appendChild(stage);

    const throwerSkills = el('div', 'pwiz3-skills-col'); throwerSkills.id = 'pwiz3-thrower-skills';
    stage.appendChild(throwerSkills);

    const throwerCol = el('div', 'pwiz3-col pwiz3-col-left'); throwerCol.id = 'pwiz3-thrower-col';
    stage.appendChild(throwerCol);

    const pitchCol = el('div', 'pwiz3-pitch');
    const placeBanner = el('div', 'pwiz-place-banner'); placeBanner.id = 'pwiz-place-banner';
    placeBanner.hidden = true; placeBanner.title = 'Click to cancel placement';
    placeBanner.addEventListener('click', () => { ws.pitch?.cancelPlacement(); placeBanner.hidden = true; });
    pitchCol.appendChild(placeBanner);
    const pitchWrap = el('div', 'pwiz-pitch-wrap');
    pitchCol.appendChild(pitchWrap);
    stage.appendChild(pitchCol);

    const catcherCol = el('div', 'pwiz3-col pwiz3-col-right'); catcherCol.id = 'pwiz3-catcher-col';
    stage.appendChild(catcherCol);

    const catcherSkills = el('div', 'pwiz3-skills-col'); catcherSkills.id = 'pwiz3-catcher-skills';
    stage.appendChild(catcherSkills);

    if (typeof window.BloodBowlPitch !== 'undefined') {
      ws.pitch = new window.BloodBowlPitch(pitchWrap, { scale: PITCH_SCALE, noZoom: true });
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
        computeTZ(); buildPlayerColumn('thrower'); buildPlayerColumn('catcher'); buildOppList(); armWizard();
      };
    }

    /* Roll frame (under pitch) */
    const frame = el('div', 'pwiz3-rollframe');
    root.appendChild(frame);

    /* Left: add opposing + zones toggle + opp list */
    const fLeft = el('div', 'pwiz3-frame-left');
    const addOpp = el('button', 'pwiz3-tool-btn'); addOpp.type = 'button';
    addOpp.textContent = 'Add Opposing Player';
    addOpp.addEventListener('click', () => openPicker('opposing'));
    fLeft.appendChild(addOpp);
    const zonesBtn = el('button', 'pwiz3-tool-btn' + (ws.zonesOn ? ' active' : ''));
    zonesBtn.type = 'button'; zonesBtn.id = 'pwiz3-zones-btn';
    zonesBtn.textContent = 'Show Passing Zones';
    zonesBtn.addEventListener('click', () => {
      ws.zonesOn = !ws.zonesOn;
      zonesBtn.classList.toggle('active', ws.zonesOn);
      if (ws.zonesOn && ws.throwerPos) ws.pitch?.showPassZones(ws.throwerPos.col, ws.throwerPos.row);
      else ws.pitch?.hidePassZones();
    });
    fLeft.appendChild(zonesBtn);
    const oppList = el('div', 'pwiz3-opp-list'); oppList.id = 'pwiz3-opp-list';
    fLeft.appendChild(oppList);
    frame.appendChild(fLeft);

    /* Center: color-coded equation for the active roll (to the left of the dice) */
    const fMath = el('div', 'pwiz3-math'); fMath.id = 'pwiz3-math';
    frame.appendChild(fMath);

    /* Right: dice (left of button) + big Roll, with confirm/reroll + skill slot */
    const fRoll = el('div', 'pwiz3-frame-roll');
    const diceRow = el('div', 'pwiz3-dice-row');
    const dice = el('div', 'pwiz3-dice-slot'); dice.id = 'pwiz3-dice';
    const rollBtn = el('button', 'roll-btn pwiz3-roll-btn'); rollBtn.id = 'pwiz3-roll';
    rollBtn.type = 'button'; rollBtn.textContent = 'Roll'; rollBtn.disabled = true;
    diceRow.appendChild(dice); diceRow.appendChild(rollBtn);
    fRoll.appendChild(diceRow);

    const actRow = el('div', 'pwiz3-act-row');
    const confirmBtn = el('button', 'bwiz-confirm-btn'); confirmBtn.id = 'pwiz3-confirm';
    confirmBtn.type = 'button'; confirmBtn.textContent = 'Confirm Result'; confirmBtn.hidden = true;
    const rerollBtn = el('button', 'bwiz-rr-action-btn'); rerollBtn.id = 'pwiz3-reroll';
    rerollBtn.type = 'button'; rerollBtn.textContent = 'Use Re-roll'; rerollBtn.hidden = true;
    actRow.appendChild(confirmBtn); actRow.appendChild(rerollBtn);
    fRoll.appendChild(actRow);

    const skillSlot = el('div', 'pwiz3-skill-slot'); skillSlot.id = 'pwiz3-skill';
    fRoll.appendChild(skillSlot);
    frame.appendChild(fRoll);

    buildPlayerColumn('thrower');
    buildPlayerColumn('catcher');
    buildOppList();
    armWizard();

    /* Ratio-locked fit: scale the whole stage to fit the panel on both axes. */
    ws._fit?.disconnect?.();
    const pbody = panel.querySelector('.panel-body');
    if (window.FitScale && pbody) ws._fit = window.FitScale(pbody, root, { max: 1.4 });
  }

  /* ── Player columns (card in the middle, skills in the outer column) ── */
  function buildPlayerColumn(role) {
    const col       = document.getElementById(role === 'thrower' ? 'pwiz3-thrower-col' : 'pwiz3-catcher-col');
    const skillsCol = document.getElementById(role === 'thrower' ? 'pwiz3-thrower-skills' : 'pwiz3-catcher-skills');
    if (!col) return;

    const player = role === 'thrower' ? ws.thrower : ws.catcher;
    const pos    = role === 'thrower' ? ws.throwerPos : ws.catcherPos;

    /* No player yet → load the roster inline where the card will go. */
    if (!player) { showInlinePicker(role); return; }

    col.innerHTML = '';
    if (skillsCol) skillsCol.innerHTML = '';
    col.appendChild(el('div', 'pwiz3-col-label', role === 'thrower' ? 'Thrower' : 'Catcher'));

    const cardWrap = el('div', 'pwiz3-card-wrap');
    col.appendChild(cardWrap);
    buildEmbeddedCardShared(cardWrap, player, ws.activeSide, { small: true });
    if (pos) col.appendChild(el('div', 'pwiz3-pos-note', `Placed at (${pos.col}, ${pos.row})`));
    else     col.appendChild(el('div', 'pwiz3-pos-note pwiz3-pos-warn', 'Tap the pitch to place'));

    const btn = el('button', 'pwiz3-choose-btn'); btn.type = 'button';
    btn.textContent = `Change ${cap(role)}`;
    btn.addEventListener('click', () => showInlinePicker(role));
    col.appendChild(btn);

    /* Relevant skills → outer column */
    if (skillsCol) {
      skillsCol.appendChild(el('div', 'pwiz3-col-label', `${cap(role)} Skills`));
      const set = new Set(role === 'thrower' ? PASS_THROWER_SKILLS : PASS_CATCHER_SKILLS);
      const rel = [...new Set((getPlayerSkills(player) || [])
        .map(s => s.replace(/\s*\(.*\)$/, '').trim())
        .filter(s => set.has(s)))];
      if (rel.length) rel.forEach(s => skillsCol.appendChild(window.buildSkillCard(s)));
      else skillsCol.appendChild(el('div', 'pwiz3-skill-empty', 'No passing skills'));
    }
  }

  /* ── Inline roster picker (in the card slot, like the block wizard) ──
     Sorted best-first: by Passing Ability for the thrower, Agility for the
     catcher, so the most likely picks are at the top — no scrolling needed. */
  function showInlinePicker(role) {
    const col       = document.getElementById(role === 'thrower' ? 'pwiz3-thrower-col' : 'pwiz3-catcher-col');
    const skillsCol = document.getElementById(role === 'thrower' ? 'pwiz3-thrower-skills' : 'pwiz3-catcher-skills');
    if (!col) return;
    col.innerHTML = '';
    if (skillsCol) skillsCol.innerHTML = '';
    col.appendChild(el('div', 'pwiz3-col-label', role === 'thrower' ? 'Thrower' : 'Catcher'));

    const statKey = role === 'thrower' ? 'PA' : 'AG';
    const picker = el('div', 'pwiz3-picker');
    picker.appendChild(el('div', 'pwiz3-picker-label',
      role === 'thrower' ? 'Select Thrower — best PA first' : 'Select Catcher — best AG first'));
    const list = el('div', 'wps-list'); list.id = `pwiz3-${role}-list`;
    picker.appendChild(list);
    col.appendChild(picker);

    buildWizardPlayerList(list.id, ws.activeSide,
      p => !window.STATUS_META?.[p.status]?.dim,
      (p) => doPlacement(role, p),
      {
        sort:     (a, b) => getStat(a, statKey) - getStat(b, statKey),   // lower target = better, on top
        statHint: p => { const v = getStat(p, statKey); return v >= 99 ? `${statKey} —` : `${statKey} ${v}+`; },
      });
  }

  /* ── Opposing players list (under Add button) ── */
  function buildOppList() {
    const list = document.getElementById('pwiz3-opp-list');
    if (!list) return;
    list.innerHTML = '';
    ws.opposingPlayers.forEach((op, i) => {
      const row = el('div', 'pwiz3-opp-row');
      row.appendChild(el('span', 'pwiz3-opp-name', esc(playerLabel(op.player))));
      row.appendChild(el('span', 'pwiz3-opp-pos', `(${op.col},${op.row})`));
      const rm = el('button', 'pwiz3-opp-rm'); rm.type = 'button'; rm.textContent = 'Remove';
      rm.addEventListener('click', () => {
        ws.pitch?.removePlayer(op.col, op.row);
        ws.opposingPlayers.splice(i, 1);
        computeTZ(); buildOppList(); armWizard();
      });
      row.appendChild(rm);
      list.appendChild(row);
    });
  }

  /* ─────────────────────────────────────────────────────
     PLAN + SEQUENCE STRIP
     ──────────────────────────────────────────────────── */

  function computePlan() {
    if (!ws.thrower || !ws.catcher) return null;

    let range = null;
    if (ws.throwerPos && ws.catcherPos && ws.pitch) {
      range = ws.pitch.getPassRange(ws.throwerPos.col, ws.throwerPos.row, ws.catcherPos.col, ws.catcherPos.row);
    }

    const w          = window.GameState?.currentWeather;
    const isBlizzard = w?.name === 'Blizzard';

    const paBase       = getStat(ws.thrower, 'PA');
    const nosThrow     = hasSk(ws.thrower, 'Nerves of Steel');
    const hasAccurate  = hasSk(ws.thrower, 'Accurate');
    const hasCannoneer = hasSk(ws.thrower, 'Cannoneer');
    const hasHailMary  = hasSk(ws.thrower, 'Hail Mary Pass');

    const rangePenalty     = range?.mod ?? 0;
    const tzPenalty        = nosThrow ? 0 : ws.tz;
    const accurateBonus    = (hasAccurate  && range && (range.rangeKey === 'quick' || range.rangeKey === 'short')) ? 1 : 0;
    const cannoneerBonus   = (hasCannoneer && range && (range.rangeKey === 'long'  || range.rangeKey === 'bomb'))  ? 1 : 0;
    const verySunnyPenalty = w?.name === 'Very Sunny' ? 1 : 0;

    const paFinal = paBase >= 99 ? 99 : Math.min(6, Math.max(2,
      paBase - rangePenalty + tzPenalty + verySunnyPenalty - accurateBonus - cannoneerBonus));

    const blizzFumble = isBlizzard && range && (range.rangeKey === 'long' || range.rangeKey === 'bomb');

    const agBase         = getStat(ws.catcher, 'AG');
    const wCatchPenalty  = (w?.name === 'Pouring Rain' || w?.name === 'Blizzard') ? 1 : 0;
    const catchTZPenalty = hasSk(ws.catcher, 'Nerves of Steel') ? 0 : ws.catcherTZ;
    const catchSkBonus   = hasSk(ws.catcher, 'Catch') ? 1 : 0;
    const agFinal        = agBase >= 99 ? 99 : Math.min(6, Math.max(2, agBase + wCatchPenalty + catchTZPenalty - catchSkBonus));

    const intWeatherPenalty = w?.name === 'Pouring Rain' ? 1 : 0;
    const interceptors = getInterceptors().map(op => {
      const ag = getStat(op.player, 'AG');
      return { op, target: Math.min(6, Math.max(2, (ag >= 99 ? 4 : ag) + intWeatherPenalty)) };
    });

    return {
      range, paBase, paFinal, agBase, agFinal, blizzFumble, interceptors,
      mods: { rangePenalty, tzPenalty, verySunnyPenalty, accurateBonus, cannoneerBonus,
        nosThrow, hasAccurate, hasCannoneer, hasHailMary,
        wCatchPenalty, catchTZPenalty, catchSkBonus },
    };
  }

  function weatherLabel() {
    const w = window.GameState?.currentWeather;
    return w?.name && w.name !== 'Nice' ? w.name : null;
  }

  /* ── Per-step equation for the active roll (drives the bottom math) ── */
  function stepMath(key) {
    const p = ws.plan; if (!p) return null;

    if (key === 'throw') {
      if (p.paFinal >= 99)
        return { label: 'Throw', base: 'PA —', terms: [], target: '—', effects: ['This player cannot pass'] };
      const m = p.mods, terms = [], effects = [];
      if (m.rangePenalty)     terms.push({ label: p.range.rangeLabel, delta: -m.rangePenalty });
      if (m.tzPenalty)        terms.push({ label: `${m.tzPenalty} Tackle Zone${m.tzPenalty > 1 ? 's' : ''}`, delta: m.tzPenalty });
      if (m.verySunnyPenalty) terms.push({ label: 'Very Sunny', delta: 1 });
      if (m.accurateBonus)    terms.push({ label: 'Accurate', delta: -1 });
      if (m.cannoneerBonus)   terms.push({ label: 'Cannoneer', delta: -1 });
      if (m.nosThrow && ws.tz) effects.push('Nerves of Steel — tackle zones ignored');
      if (m.hasHailMary)       effects.push('Hail Mary Pass — cannot be intercepted');
      if (p.blizzFumble)       effects.push('Blizzard — Long/Bomb passes auto-fumble');
      return { label: 'Throw', base: `PA ${p.paBase}+`, terms, target: `${p.paFinal}+`, effects };
    }

    if (key === 'catch') {
      if (p.agFinal >= 99)
        return { label: 'Catch', base: 'AG —', terms: [], target: '—', effects: [] };
      const m = p.mods, terms = [], effects = [];
      if (m.catchSkBonus)   terms.push({ label: 'Catch', delta: -1 });
      if (m.catchTZPenalty) terms.push({ label: `${m.catchTZPenalty} Tackle Zone${m.catchTZPenalty > 1 ? 's' : ''}`, delta: m.catchTZPenalty });
      if (m.wCatchPenalty)  terms.push({ label: weatherLabel() || 'Weather', delta: 1 });
      if (hasSk(ws.catcher, 'Nerves of Steel') && ws.catcherTZ) effects.push('Nerves of Steel — tackle zones ignored');
      return { label: 'Catch', base: `AG ${p.agBase}+`, terms, target: `${p.agFinal}+`, effects };
    }

    if (key.startsWith('int')) {
      const it = p.interceptors[parseInt(key.slice(3), 10)]; if (!it) return null;
      const ag = getStat(it.op.player, 'AG');
      const terms = [];
      if (window.GameState?.currentWeather?.name === 'Pouring Rain') terms.push({ label: 'Pouring Rain', delta: 1 });
      return {
        label: `Intercept · ${it.op.player.name || it.op.player.pos || '?'}`,
        base: `AG ${ag >= 99 ? '4' : ag}+`, terms, target: `${it.target}+`, effects: [],
      };
    }
    return null;
  }

  /* ── Bottom math: color-coded equation, big target, right next to Roll ── */
  function renderMath() {
    const host = document.getElementById('pwiz3-math');
    if (!host) return;
    const m = stepMath(ws.activeStepKey || 'throw');
    if (!m) {
      host.innerHTML = '<div class="pwiz3-math-wait">Select a thrower and catcher, then place both on the pitch.</div>';
      return;
    }
    const terms = m.terms.map(t => {
      const cls  = t.delta > 0 ? 'neg' : 'pos';
      const sign = t.delta > 0 ? '+' : '−';
      return `<span class="pwiz3-math-term ${cls}">${sign}${Math.abs(t.delta)}<small>${esc(t.label)}</small></span>`;
    }).join('<span class="pwiz3-math-op">·</span>');
    const eff  = m.effects.map(e => `<span class="pwiz3-math-effect">${esc(e)}</span>`).join('');
    const verb = m.label.startsWith('Throw') ? 'pass' : m.label.startsWith('Catch') ? 'catch' : 'intercept';
    host.innerHTML =
      `<div class="pwiz3-math-step">${esc(m.label)}</div>` +
      `<div class="pwiz3-math-eq">` +
        `<span class="pwiz3-math-base">${esc(m.base)}</span>` +
        (terms ? `<span class="pwiz3-math-op">·</span>${terms}` : '') +
        `<span class="pwiz3-math-eq-sep">=</span>` +
        `<span class="pwiz3-math-target">${esc(m.target)}</span>` +
        `<span class="pwiz3-math-need">to&nbsp;${verb}</span>` +
      `</div>` +
      (eff ? `<div class="pwiz3-math-effects">${eff}</div>` : '');
  }

  let seqChips = {};

  /* Block-wizard-style result panel: label + big target, result fills in after the roll. */
  function resultPanel(key, label, target, sub) {
    const p = el('div', 'pwiz3-result-panel locked');
    p.dataset.key = key;
    p.innerHTML =
      `<div class="pwiz3-result-top">` +
        `<span class="bwiz-result-label">${esc(label)}${sub ? ` · ${esc(sub)}` : ''}</span>` +
        `<span class="pwiz3-result-target">${esc(target)}</span>` +
      `</div>` +
      `<div class="bwiz-result-content"><div class="pwiz3-result-idle">Awaiting roll…</div></div>`;
    seqChips[key] = p.querySelector('.bwiz-result-content');
    return p;
  }

  function renderSeq() {
    const seq = document.getElementById('pwiz3-seq');
    if (!seq) return;
    seq.innerHTML = '';
    seqChips = {};

    if (!ws.plan) {
      const steps = [];
      if (!ws.thrower) steps.push('Select a Thrower');
      else if (!ws.throwerPos) steps.push('Place the Thrower on the pitch');
      if (!ws.catcher) steps.push('Select a Catcher');
      else if (!ws.catcherPos) steps.push('Place the Catcher on the pitch');
      seq.appendChild(el('div', 'pwiz3-seq-wait', steps.join(' · ') || 'Ready'));
      return;
    }

    const strip = el('div', 'pwiz3-results-strip');
    strip.appendChild(resultPanel('throw', 'Throw', ws.plan.paFinal >= 99 ? '—' : `${ws.plan.paFinal}+`));
    ws.plan.interceptors.forEach((it, i) =>
      strip.appendChild(resultPanel(`int${i}`, 'Intercept', `${it.target}+`,
        it.op.player.name || it.op.player.pos || '?')));
    strip.appendChild(resultPanel('catch', 'Catch', ws.plan.agFinal >= 99 ? '—' : `${ws.plan.agFinal}+`));
    seq.appendChild(strip);
  }

  function setSeqActive(key) {
    ws.activeStepKey = key;
    document.querySelectorAll('#pwiz3-seq .pwiz3-result-panel').forEach(c =>
      c.classList.toggle('active', c.dataset.key === key));
    renderMath();
  }

  function seqResult(key, roll, label, cls, explain) {
    const slot = seqChips[key];
    if (!slot) return;
    slot.closest('.pwiz3-result-panel')?.classList.remove('locked');
    slot.innerHTML =
      `<div class="bwiz-result-headline bwiz-result-${cls}">${esc(label)}</div>` +
      (roll != null ? `<div class="pwiz3-result-roll">rolled <b>${roll}</b></div>` : '') +
      (explain ? `<p class="bwiz-result-note ${cls}">${esc(explain)}</p>` : '');
  }

  /* ─────────────────────────────────────────────────────
     ROLL FLOW (single button, block-wizard style)
     ──────────────────────────────────────────────────── */

  const rollBtnEl  = () => document.getElementById('pwiz3-roll');
  const confirmEl  = () => document.getElementById('pwiz3-confirm');
  const rerollEl   = () => document.getElementById('pwiz3-reroll');
  const skillEl    = () => document.getElementById('pwiz3-skill');
  const diceEl     = () => document.getElementById('pwiz3-dice');

  function clearAfterRoll() {
    confirmEl().hidden = true; confirmEl().classList.remove('glow-blue'); confirmEl().onclick = null;
    rerollEl().hidden = true; rerollEl().classList.remove('glow-gold'); rerollEl().onclick = null;
    if (skillEl()) skillEl().innerHTML = '';
  }

  function consumeTeamRR() {
    const gs = window.GameState?.rerolls; const key = gbSide();
    if (gs && gs[key] > 0) { gs[key] = Math.max(0, gs[key] - 1); window.Panels?.renderRerollPips?.(key); }
    ws.teamRRUsed = true;
  }

  /* Show Confirm + (optional) Use Re-roll + context skill buttons after a roll. */
  function afterRoll({ onConfirm, rerollFn = null, skillButtons = [] }) {
    const roll = rollBtnEl(); roll.disabled = true;
    const cf = confirmEl(); cf.hidden = false; cf.classList.add('glow-blue');
    cf.onclick = () => { clearAfterRoll(); onConfirm(); };

    const rr = window.GameState?.rerolls?.[gbSide()] ?? 0;
    if (rerollFn && !ws.teamRRUsed && rr > 0) {
      const rb = rerollEl(); rb.hidden = false; rb.classList.add('glow-gold');
      rb.onclick = () => { consumeTeamRR(); clearAfterRoll(); rerollFn(); };
    }
    const slot = skillEl(); if (slot) { slot.innerHTML = ''; skillButtons.forEach(b => slot.appendChild(b)); }
  }

  function armRoll(label, fn) {
    const roll = rollBtnEl();
    roll.textContent = label;
    roll.classList.remove('roll-btn--complete', 'glow-green');
    roll.classList.add('glow-gold');
    roll.disabled = false;
    roll.onclick = fn;
    clearAfterRoll();
  }

  function finish(label) {
    const roll = rollBtnEl();
    roll.disabled = false;
    roll.textContent = label || 'Complete — Close';
    roll.classList.add('roll-btn--complete', 'glow-green');
    roll.classList.remove('glow-gold');
    roll.onclick = () => { resetWizardState(); window.Panels?.closePanel?.('pass'); };
    clearAfterRoll();
  }

  async function rollDie() {
    const slot = diceEl(); slot.innerHTML = '';
    if (window.BBSettings?.getWizardDiceMode('pass') === 'physical') {
      const v = await window.DiceSlot.d6(slot, 'Enter your D6 roll');
      const face = document.createElement('div');
      buildNumericFace(face, v);
      slot.appendChild(face);
      return v;
    }
    /* Custom numeric die from the block wizard (Nuffle Dice face). */
    const face = document.createElement('div');
    buildNumericFace(face, 1);
    slot.appendChild(face);
    return await rollNumericDie(face);
  }

  function armWizard() {
    ws.plan = computePlan();
    resetRoll();
    ws.activeStepKey = 'throw';
    renderSeq();
    const roll = rollBtnEl(); if (!roll) return;
    clearAfterRoll();
    if (diceEl()) diceEl().innerHTML = '';
    if (!ws.plan || !ws.throwerPos || !ws.catcherPos) {
      roll.disabled = true; roll.textContent = 'Roll';
      roll.classList.remove('roll-btn--complete', 'glow-gold', 'glow-green');
      roll.onclick = null;
      renderMath();
      return;
    }
    armRoll('Roll Throw', doThrow);
    setSeqActive('throw');
  }

  /* Pass skill re-roll button (context skill slot). */
  function passSkillButton() {
    const b = el('button', 'pwiz3-skill-btn'); b.type = 'button';
    b.textContent = 'Pass — Re-roll';
    b.addEventListener('click', () => {
      ws.passSkillUsed = true; ws.teamRRUsed = true;
      clearAfterRoll(); doThrow();
    });
    return b;
  }

  async function doThrow() {
    setSeqActive('throw');
    rollBtnEl().disabled = true;
    /* Pass committed — the thrower has acted (catching is not an action). */
    if (ws.thrower) window.markPlayerActed?.(ws.activeSide, ws.thrower.idx, 'pass');

    if (ws.plan.blizzFumble) {
      seqResult('throw', null, 'Auto-Fumble', 'bad', 'Blizzard blocks Long/Bomb passes');
      ws.passResult = 'fumble';
      await scatterFrom(ws.throwerPos, 3, 'Fumble — ball scatters from thrower');
      finish('Fumble — Close'); return;
    }

    const roll = await rollDie();
    const isFumble   = roll === 1 && ws.plan.paFinal < 99;
    const isAccurate = !isFumble && (ws.plan.paFinal >= 99 || roll >= ws.plan.paFinal);
    ws.passResult = isFumble ? 'fumble' : (isAccurate ? 'accurate' : 'inaccurate');
    const explain = buildThrowExplain(ws.plan.paFinal, ws.plan.range);

    if (isFumble) {
      seqResult('throw', roll, 'Fumble', 'bad', explain);
      await scatterFrom(ws.throwerPos, 3, 'Fumble — ball scatters from thrower');
      finish('Fumble — Close'); return;
    }

    seqResult('throw', roll, isAccurate ? 'Accurate' : 'Inaccurate', isAccurate ? 'ok' : 'warn', explain);

    if (isAccurate) {
      afterRoll({ onConfirm: afterThrowAccurate, rerollFn: doThrow });
    } else {
      const skills = (hasSk(ws.thrower, 'Pass') && !ws.passSkillUsed) ? [passSkillButton()] : [];
      afterRoll({
        onConfirm: async () => { await scatterFrom(ws.catcherPos, 3, 'Inaccurate — ball scatters'); finish('Inaccurate — Close'); },
        rerollFn: doThrow,
        skillButtons: skills,
      });
    }
  }

  function afterThrowAccurate() {
    if (ws.plan.interceptors.length) { ws.intIndex = 0; armIntercept(); }
    else armCatch();
  }

  function armIntercept() {
    const it = ws.plan.interceptors[ws.intIndex];
    setSeqActive(`int${ws.intIndex}`);
    armRoll(`Roll Intercept — ${it.op.player.name || it.op.player.pos || '?'}`, doIntercept);
  }

  async function doIntercept() {
    const it = ws.plan.interceptors[ws.intIndex];
    rollBtnEl().disabled = true;
    const roll = await rollDie();
    const caught = roll >= it.target;
    seqResult(`int${ws.intIndex}`, roll, caught ? 'Intercepted' : 'No Intercept', caught ? 'bad' : 'ok');
    if (caught) {
      ws.passResult = 'intercepted';
      finish('Intercepted — Turnover — Close');
      return;
    }
    afterRoll({
      onConfirm: () => {
        if (ws.intIndex + 1 < ws.plan.interceptors.length) { ws.intIndex++; armIntercept(); }
        else armCatch();
      },
    });
  }

  function armCatch() {
    setSeqActive('catch');
    armRoll('Roll Catch', doCatch);
  }

  async function doCatch() {
    setSeqActive('catch');
    rollBtnEl().disabled = true;
    const roll = await rollDie();
    const caught = roll !== 1 && (ws.plan.agFinal >= 99 || roll >= ws.plan.agFinal);
    ws.catchResult = caught ? 'caught' : 'dropped';
    const explain = buildCatchExplain(ws.plan.agFinal);
    seqResult('catch', roll, caught ? 'Caught' : 'Dropped', caught ? 'ok' : 'bad', explain);

    if (caught) {
      if (ws.catcher && window.GameState) {
        window.GameState.ballCarrier = { side: ws.activeSide, idx: ws.catcher.idx };
      }
      finish('Complete Pass — Close');
      return;
    }
    afterRoll({
      onConfirm: async () => { await scatterFrom(ws.catcherPos, 1, 'Dropped — ball bounces'); finish('Dropped — Close'); },
      rerollFn: doCatch,
    });
  }

  /* ─────────────────────────────────────────────────────
     SCATTER (rendered into the sequence strip)
     ──────────────────────────────────────────────────── */
  const D8A = {1:'↖',2:'↑',3:'↗',4:'←',5:'→',6:'↙',7:'↓',8:'↘'};
  const D8N = {1:'Up-Left',2:'Up',3:'Up-Right',4:'Left',5:'Right',6:'Down-Left',7:'Down',8:'Down-Right'};

  async function scatterFrom(originPos, numDice, title) {
    const content = seqChips[ws.activeStepKey];
    if (!content) return;
    const host = el('div', 'pwiz3-scatter');
    content.appendChild(host);
    host.appendChild(el('div', 'pwiz3-scatter-title', title || `Scatter — ${numDice} × D8`));
    const cardsRow = el('div', 'pwiz3-scatter-row');
    host.appendChild(cardsRow);

    const dirs = [];
    for (let i = 0; i < numDice; i++) {
      if (i > 0) { cardsRow.appendChild(el('div', 'pwiz3-seq-arrow', '→')); await delay(200); }
      const card = el('div', 'pwiz3-scatter-card');
      const dieWrap = el('div', 'pwiz3-scatter-die');
      const dieEl = el('div', 'die'); dieEl.dataset.value = '1'; dieEl.dataset.sides = '8';
      dieEl.innerHTML = '<div class="die-face d8-face"></div>';
      dieWrap.appendChild(dieEl);
      card.appendChild(dieWrap);
      const resEl = el('div', 'pwiz3-scatter-res');
      card.appendChild(resEl);
      cardsRow.appendChild(card);

      let d;
      if (window.BBSettings?.getWizardDiceMode('pass') === 'physical') {
        d = await window.DiceSlot.direction(card, 'Enter the scatter direction');
        Dice.setDieValue(dieEl, d);
      } else {
        d = await Dice.rollDieElement(dieEl);
      }
      dirs.push(d);
      resEl.innerHTML = `<span class="pwiz3-scatter-arrow">${D8A[d]}</span> ${D8N[d]}`;
      if (originPos && ws.pitch) ws.pitch.showScatterPath(originPos.col, originPos.row, dirs);
    }
  }

  /* ── Explanation builders (weather-aware) ── */
  function buildThrowExplain(target, range) {
    if (!ws.thrower || target >= 99) return '';
    const parts = [];
    if (range?.mod) parts.push(`${range.rangeLabel} +${-range.mod}`);
    if (ws.tz > 0) parts.push(hasSk(ws.thrower, 'Nerves of Steel') ? `${ws.tz} TZ (ignored)` : `${ws.tz} TZ +${ws.tz}`);
    const w = window.GameState?.currentWeather;
    if (w?.name === 'Very Sunny') parts.push('Very Sunny +1');
    if (hasSk(ws.thrower, 'Accurate')  && range && (range.rangeKey === 'quick' || range.rangeKey === 'short')) parts.push('Accurate −1');
    if (hasSk(ws.thrower, 'Cannoneer') && range && (range.rangeKey === 'long'  || range.rangeKey === 'bomb'))  parts.push('Cannoneer −1');
    return parts.join(' · ');
  }

  function buildCatchExplain(target) {
    if (!ws.catcher || target >= 99) return '';
    const parts = [];
    if (hasSk(ws.catcher, 'Catch')) parts.push('Catch −1');
    if (ws.catcherTZ > 0) parts.push(`${ws.catcherTZ} TZ +${ws.catcherTZ}`);
    const w = window.GameState?.currentWeather;
    if (w?.name === 'Pouring Rain' || w?.name === 'Blizzard') parts.push(`${w.name} +1`);
    return parts.join(' · ');
  }

  /* ─────────────────────────────────────────────────────
     ROSTER PICKER + PLACEMENT
     ──────────────────────────────────────────────────── */
  let _activePickerClose = null;

  function openPicker(role) {
    _activePickerClose?.();
    const anchor = document.getElementById('pwiz3-root') ?? body;
    const side = role === 'opposing'
      ? (ws.activeSide === 'left' ? 'right' : 'left')
      : ws.activeSide;
    let players = window.getPlayerList?.(side) ?? [];
    if (!players.length) return;

    if (role === 'thrower')      players = [...players].sort((a, b) => getStat(a, 'PA') - getStat(b, 'PA'));
    else if (role === 'catcher') players = [...players].sort((a, b) => getStat(a, 'AG') - getStat(b, 'AG'));
    if (role === 'opposing')     players = players.filter(p => !window.STATUS_META?.[p.status]?.dim);

    const overlay = el('div', 'pwiz-full-picker-overlay');
    const card    = el('div', 'pwiz-full-picker-card');
    const hdr     = el('div', 'pwiz-full-picker-hdr');
    const titles  = { thrower: 'Choose Thrower', catcher: 'Choose Catcher', opposing: 'Add Opposing Player' };
    hdr.innerHTML = `<span>${titles[role] ?? 'Select Player'}</span>`;
    const closeX  = el('button', 'pwiz3-opp-rm'); closeX.type = 'button'; closeX.textContent = 'Close';
    closeX.addEventListener('click', close);
    hdr.appendChild(closeX);
    card.appendChild(hdr);

    const grid = el('div', 'pwiz-full-picker-grid');
    const THROWER_SET = new Set(PASS_THROWER_SKILLS);
    const CATCHER_SET = new Set(PASS_CATCHER_SKILLS);
    const highlight = role === 'thrower' ? THROWER_SET : role === 'catcher' ? CATCHER_SET : new Set();

    players.forEach(p => {
      /* Thrower must be fresh; a catcher may already have acted
         (receiving a pass is not an action). */
      const acted = role === 'thrower' && window.hasPlayerActed?.(side, p.idx);

      const btn = el('button', 'pwiz-player-pick-card' + (acted ? ' wps-acted' : '')); btn.type = 'button';
      if (acted) btn.disabled = true;
      const nameRow = el('div', 'pwiz-pick-name-row');
      nameRow.appendChild(el('div', 'pwiz-pick-name', esc(playerLabel(p))));
      nameRow.appendChild(el('div', 'pwiz-pick-pos', esc(p.pos || '')));
      btn.appendChild(nameRow);

      const stats = parseAllStats(p.statsText);
      if (Object.keys(stats).length) {
        const sr = el('div', 'pwiz-pick-stats');
        ['MA','ST','AG','PA','AV'].forEach(key => {
          const focus = (key === 'PA' && role !== 'catcher') || (key === 'AG' && role === 'catcher');
          sr.appendChild(el('div', 'pwiz-pick-stat' + (focus ? ' pwiz-stat-focus' : ''),
            `<span class="pwiz-stat-key">${key}</span><span class="pwiz-stat-val">${stats[key] || '—'}</span>`));
        });
        btn.appendChild(sr);
      }

      const skills = (getPlayerSkills(p) || []).map(s => s.replace(/\s*\(.*\)$/, '').trim());
      if (skills.length) {
        const skr = el('div', 'pwiz-pick-skills');
        skills.forEach(s => {
          const chip = el('span', 'pwiz3-pick-chip' + (highlight.has(s) ? ' hi' : ''), esc(s));
          skr.appendChild(chip);
        });
        btn.appendChild(skr);
      }

      btn.addEventListener('click', () => { if (acted) return; close(); doPlacement(role, p); });
      grid.appendChild(btn);
    });

    card.appendChild(grid);
    overlay.appendChild(card);
    anchor.appendChild(overlay);

    function close() {
      overlay.remove(); _activePickerClose = null;
      document.removeEventListener('keydown', onKey);
    }
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    const onOutside = e => { if (!card.contains(e.target)) { close(); document.removeEventListener('click', onOutside, true); } };
    setTimeout(() => document.addEventListener('click', onOutside, true), 0);
    _activePickerClose = close;
  }

  function doPlacement(role, player) {
    const tokSide = role === 'opposing'
      ? (ws.activeSide === 'left' ? 'away' : 'home')
      : (ws.activeSide === 'left' ? 'home' : 'away');
    const data = { id: role === 'opposing' ? `opp-${Date.now()}` : role, label: playerNum(player), side: tokSide };

    /* Load the player's card immediately — before placement. */
    if (role === 'thrower')      ws.thrower = player;
    else if (role === 'catcher') ws.catcher = player;
    if (role !== 'opposing') { buildPlayerColumn(role); armWizard(); }

    const banner = document.getElementById('pwiz-place-banner');
    if (banner) { banner.hidden = false; banner.textContent =
      `Tap the pitch to place ${playerLabel(player)} — or tap outside for the default spot`; }

    let done = false;
    const finalize = (col, row) => {
      if (done) return; done = true;
      document.removeEventListener('click', onOutside, true);
      ws.pitch?.cancelPlacement();
      if (banner) banner.hidden = true;

      if (role === 'thrower') {
        if (ws.throwerPos) ws.pitch?.removePlayer(ws.throwerPos.col, ws.throwerPos.row);
        ws.throwerPos = { col, row };
      } else if (role === 'catcher') {
        if (ws.catcherPos) ws.pitch?.removePlayer(ws.catcherPos.col, ws.catcherPos.row);
        ws.catcherPos = { col, row };
      } else {
        ws.opposingPlayers.push({ player, col, row, id: data.id });
      }
      ws.pitch?.placePlayer(col, row, data);
      ws.pitch?.clearPassLine();
      if (ws.throwerPos && ws.catcherPos) {
        ws.pitch?.drawPassLine(ws.throwerPos.col, ws.throwerPos.row, ws.catcherPos.col, ws.catcherPos.row);
      }
      if (role === 'thrower' && ws.zonesOn) ws.pitch?.showPassZones(col, row);

      computeTZ();
      buildPlayerColumn('thrower'); buildPlayerColumn('catcher'); buildOppList();
      armWizard();
    };

    ws.pitch?.startPlacement(data, (col, row) => finalize(col, row));

    /* Tap anywhere outside the pitch → drop at the default spot (thrower 8,8 /
       catcher 12,8); the token can be dragged afterwards. */
    const DEFAULT = role === 'catcher' ? { col: 12, row: 8 } : { col: 8, row: 8 };
    const pitchWrap = document.querySelector('#panel-pass .pwiz-pitch-wrap');
    function onOutside(e) {
      if (pitchWrap && pitchWrap.contains(e.target)) return;     // pitch taps handled above
      if (e.target.closest('.pwiz-full-picker-overlay')) return; // ignore picker clicks
      finalize(DEFAULT.col, DEFAULT.row);
    }
    setTimeout(() => document.addEventListener('click', onOutside, true), 0);
  }

  /* ── Boot ── */
  onPanelOpen('panel-pass', () => {
    if (!ws._built) { buildLayout(); ws._built = true; }
    else {
      buildPlayerColumn('thrower'); buildPlayerColumn('catcher');
      buildOppList(); armWizard();
      window.Panels?.refreshWeatherChips?.();
    }
  });

  panel.addEventListener('bb:diceMode', () => { window.Panels?.refreshWeatherChips?.(); });
}
