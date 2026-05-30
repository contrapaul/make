'use strict';

/* ═══════════════════════════════════════════════════════
   Blood Bowl Companion — js/pass-wizard.js
   Sprint 3B: Single-screen pass wizard (overrides the
   8-step version in wizards.js).

   Loads AFTER wizards.js so this declaration wins.
   Uses helpers from wizards.js: esc, hasSkill,
   getPlayerSkills, bindStepper, onPanelOpen, rangeFind.
   Uses BloodBowlPitch from pitch.js.
   ═══════════════════════════════════════════════════════ */

/** Parse PA/AG stat string — "3+" → 3, "—" → 99 (sort last) */
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

  /* Default pitch positions */
  const DEFAULTS = {
    left:  { thrower: { col: 8,  row: 8 }, catcher: { col: 14, row: 5  } },
    right: { thrower: { col: 21, row: 8 }, catcher: { col: 15, row: 11 } },
  };

  /* Wizard state */
  const ws = {
    activeSide:      'left',
    thrower:         null,
    catcher:         null,
    throwerPos:      null,
    catcherPos:      null,
    tz:              0,
    catcherTZ:       0,
    intercept:       false,
    interceptor:     null,   /* player obj from opposing team */
    interceptAG:     4,      /* parsed AG of interceptor */
    interceptTarget: 4,      /* d6 target to intercept */
    zonesOn:         false,
    passResult:      null,
    scatterDirs:     [],
    catchResult:     null,
    pitch:           null,
  };

  function getStat(p, key) { return parsePassStat(p?.statsText, key); }

  function resetRoll() {
    ws.passResult  = null;
    ws.scatterDirs = [];
    ws.catchResult = null;
  }

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

    /* Team toggle — both lists switch together */
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
        ws.activeSide = side; ws.thrower = null; ws.catcher = null;
        ws.throwerPos = null; ws.catcherPos = null;
        ws.pitch?.clear();
        teamRow.querySelectorAll('.pwiz-team-tab').forEach(b => b.classList.toggle('active', b === btn));
        refreshLists(); updateReqs();
      });
      teamRow.appendChild(btn);
    });
    body.appendChild(teamRow);

    /* Two-column layout */
    const layout = document.createElement('div');
    layout.className = 'pwiz-layout';
    body.appendChild(layout);

    const leftCol  = document.createElement('div');
    leftCol.className  = 'pwiz-col-left';
    layout.appendChild(leftCol);

    const rightCol = document.createElement('div');
    rightCol.className = 'pwiz-col-right';
    layout.appendChild(rightCol);

    /* Right: pitch */
    const pitchWrap = document.createElement('div');
    pitchWrap.className = 'pwiz-pitch-wrap';
    rightCol.appendChild(pitchWrap);

    if (typeof window.BloodBowlPitch !== 'undefined') {
      ws.pitch = new window.BloodBowlPitch(pitchWrap, { scale: 0.6 });
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

    /* Right: requirements + roll section */
    const reqEl  = document.createElement('div');
    reqEl.className = 'pwiz-requirements'; reqEl.id = 'pwiz-req';
    rightCol.appendChild(reqEl);

    const rollEl = document.createElement('div');
    rollEl.id = 'pwiz-roll'; rollEl.hidden = true;
    rightCol.appendChild(rollEl);

    /* Left: player lists + modifiers */
    const listArea = document.createElement('div');
    listArea.id = 'pwiz-lists';
    leftCol.appendChild(listArea);

    const modArea = document.createElement('div');
    modArea.id = 'pwiz-mods'; modArea.style.marginTop = '0.5rem';
    leftCol.appendChild(modArea);

    buildLists(listArea);
    buildMods(modArea);
    updateReqs();
  }

  /* ─────────────────────────────────────────────────────
     PLAYER LISTS
     ──────────────────────────────────────────────────── */

  function refreshLists() {
    const el = document.getElementById('pwiz-lists');
    if (el) buildLists(el);
    const mod = document.getElementById('pwiz-mods');
    if (mod) buildMods(mod);
  }

  function buildLists(container) {
    container.innerHTML = '';
    const side       = ws.activeSide;
    const allPlayers = window.getPlayerList?.(side) ?? [];

    if (!allPlayers.length) {
      const msg = document.createElement('p');
      msg.className = 'panel-intro'; msg.style.margin = '0.3rem 0';
      msg.textContent = 'No roster loaded — select a team in the game bar.';
      container.appendChild(msg);
      return;
    }

    const byPA = [...allPlayers].sort((a, b) => getStat(a, 'PA') - getStat(b, 'PA'));
    const byAG = [...allPlayers].sort((a, b) => getStat(a, 'AG') - getStat(b, 'AG'));
    const defs = DEFAULTS[side];

    function makeList(players, statKey, title, isThrow) {
      const sec = document.createElement('div');
      sec.className = 'pwiz-list-sec';

      const hdr = document.createElement('div');
      hdr.className = 'pwiz-list-hdr';
      hdr.innerHTML = `<span>${esc(title)}</span><span class="pwiz-stat-lbl">${statKey}</span>`;
      sec.appendChild(hdr);

      const list = document.createElement('div');
      list.className = 'pwiz-player-list';

      players.forEach(p => {
        const val  = getStat(p, statKey);
        const str  = val >= 99 ? '—' : `${val}+`;
        const sel  = isThrow ? (ws.thrower?.idx === p.idx) : (ws.catcher?.idx === p.idx);
        const dim  = isThrow ? (ws.catcher?.idx  === p.idx) : (ws.thrower?.idx  === p.idx);

        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'pwiz-player-row' + (sel ? ' selected' : '') + (dim ? ' dimmed' : '');
        row.innerHTML = `
          <span class="pwiz-row-name">${esc(p.name || p.pos || `#${p.idx + 1}`)}</span>
          ${p.pos && p.name ? `<span class="pwiz-row-pos">${esc(p.pos)}</span>` : ''}
          <span class="pwiz-row-stat${val >= 99 ? ' pwiz-stat-none' : ''}">${str}</span>
        `;

        row.addEventListener('click', () => {
          if (isThrow) {
            if (ws.throwerPos) { ws.pitch?.removePlayer(ws.throwerPos.col, ws.throwerPos.row); }
            ws.pitch?.clearPassLine();
            if (sel) {
              ws.thrower = null; ws.throwerPos = null;
              ws.pitch?.hidePassZones(); ws.zonesOn = false;
            } else {
              ws.thrower    = p;
              ws.throwerPos = { ...defs.thrower };
              const tokSide = side === 'left' ? 'home' : 'away';
              const label   = (p.name || p.pos || '?').charAt(0).toUpperCase();
              ws.pitch?.placePlayer(ws.throwerPos.col, ws.throwerPos.row, { id: 'thrower', label, side: tokSide });
              if (ws.catcherPos) ws.pitch?.drawPassLine(ws.throwerPos.col, ws.throwerPos.row, ws.catcherPos.col, ws.catcherPos.row);
              if (ws.zonesOn) ws.pitch?.showPassZones(ws.throwerPos.col, ws.throwerPos.row);
            }
          } else {
            if (ws.catcherPos) { ws.pitch?.removePlayer(ws.catcherPos.col, ws.catcherPos.row); }
            ws.pitch?.clearPassLine();
            if (sel) {
              ws.catcher = null; ws.catcherPos = null;
            } else {
              ws.catcher    = p;
              ws.catcherPos = { ...defs.catcher };
              const tokSide = side === 'left' ? 'home' : 'away';
              const label   = (p.name || p.pos || '?').charAt(0).toUpperCase();
              ws.pitch?.placePlayer(ws.catcherPos.col, ws.catcherPos.row, { id: 'catcher', label, side: tokSide });
              if (ws.throwerPos) ws.pitch?.drawPassLine(ws.throwerPos.col, ws.throwerPos.row, ws.catcherPos.col, ws.catcherPos.row);
            }
          }
          resetRoll();
          refreshLists();
          buildMods(document.getElementById('pwiz-mods'));
          updateReqs();
        });

        list.appendChild(row);
      });

      sec.appendChild(list);
      container.appendChild(sec);
    }

    makeList(byPA, 'PA', 'THROWER — PA', true);
    makeList(byAG, 'AG', 'CATCHER — AG', false);
  }

  /* ─────────────────────────────────────────────────────
     MODIFIER SECTION
     ──────────────────────────────────────────────────── */

  function buildMods(el) {
    if (!el) return;
    el.innerHTML = '';

    /* Weather chip */
    const w = window.GameState?.currentWeather;
    if (w && w.effect && w.effect !== 'No effect') {
      const chip = document.createElement('div');
      chip.className = 'pwiz-skill-chip neg';
      chip.textContent = `${w.emoji} ${w.effect}`;
      chip.style.marginBottom = '0.3rem';
      el.appendChild(chip);
    }

    /* Thrower skill chips */
    if (ws.thrower) {
      const skills = typeof getPlayerSkills === 'function' ? getPlayerSkills(ws.thrower) : [];
      ['Accurate', 'Cannoneer', 'Nerves of Steel', 'Cloud Burster', 'Hail Mary Pass'].forEach(sk => {
        if (skills.some(s => s.toLowerCase() === sk.toLowerCase())) {
          const chip = document.createElement('div');
          chip.className = 'pwiz-skill-chip pos';
          chip.textContent = `✦ ${sk}`;
          el.appendChild(chip);
        }
      });
    }

    /* TZ steppers */
    function addTZ(label, getter, setter) {
      const row = document.createElement('div');
      row.className = 'pwiz-mod-row';
      const lbl = document.createElement('span');
      lbl.style.cssText = 'font-size:0.65rem;color:rgba(180,210,255,0.55);flex:1;font-family:JetBrains Mono,monospace;';
      lbl.textContent = label;
      row.appendChild(lbl);
      const stepper = document.createElement('div');
      stepper.className = 'stat-stepper';
      stepper.innerHTML = `<button class="stepper-btn" data-dir="-1">−</button><span class="stepper-val">${getter()}</span><button class="stepper-btn" data-dir="+1">+</button>`;
      if (typeof bindStepper === 'function') bindStepper(stepper, 0, 6, v => { setter(v); updateReqs(); });
      row.appendChild(stepper);
      el.appendChild(row);
    }
    addTZ('Thrower TZ:', () => ws.tz,        v => { ws.tz = v; });
    addTZ('Catcher TZ:', () => ws.catcherTZ, v => { ws.catcherTZ = v; });

    /* Interception section */
    const intHeader = document.createElement('div');
    intHeader.style.cssText = 'font-family:JetBrains Mono,monospace;font-size:0.62rem;text-transform:uppercase;letter-spacing:0.08em;color:rgba(180,210,255,0.4);margin:0.5rem 0 0.25rem;';
    intHeader.textContent = 'Interception';
    el.appendChild(intHeader);

    const intRow = document.createElement('div');
    intRow.className = 'pwiz-mod-row';
    const noIntBtn  = document.createElement('button');
    const yesIntBtn = document.createElement('button');
    noIntBtn.type = yesIntBtn.type = 'button';

    const intListWrap = document.createElement('div');
    intListWrap.id = 'pwiz-int-list';
    intListWrap.hidden = !ws.intercept;

    function setIntercept(val) {
      ws.intercept = val;
      noIntBtn.className  = 'pass-nav-btn' + (!val ? ' nav-primary' : '');
      yesIntBtn.className = 'pass-nav-btn' + (val  ? ' nav-primary' : '');
      intListWrap.hidden  = !val;
      if (!val) {
        ws.interceptor = null;
        ws.interceptAG = 4;
        ws.interceptTarget = 4;
      }
      updateReqs();
    }
    noIntBtn.textContent  = 'No';
    yesIntBtn.textContent = 'Yes';
    noIntBtn.addEventListener('click',  () => setIntercept(false));
    yesIntBtn.addEventListener('click', () => setIntercept(true));
    intRow.appendChild(noIntBtn);
    intRow.appendChild(yesIntBtn);
    el.appendChild(intRow);

    /* Interceptor roster — opposing team */
    const oppSide  = ws.activeSide === 'left' ? 'right' : 'left';
    const intPlayers = window.getPlayerList?.(oppSide) ?? [];
    if (intPlayers.length) {
      const intLabel = document.createElement('div');
      intLabel.style.cssText = 'font-size:0.6rem;color:rgba(180,210,255,0.4);font-family:JetBrains Mono,monospace;margin-bottom:0.2rem;';
      intLabel.textContent = (oppSide === 'left' ? 'Home' : 'Away') + ' — tap interceptor:';
      intListWrap.appendChild(intLabel);

      const intSummaryEl = document.createElement('div');

      intPlayers.filter(p => !window.STATUS_META?.[p.status]?.dim).forEach(p => {
        const ag  = parsePassStat(p.statsText, 'AG');
        const btn = document.createElement('button');
        btn.type = 'button';
        const isSel = ws.interceptor?.idx === p.idx;
        btn.className = 'pwiz-player-row' + (isSel ? ' selected' : '');
        btn.innerHTML = `<span class="pwiz-row-name">${esc(p.name || p.pos || `#${p.idx+1}`)}</span>` +
          (p.pos && p.name ? `<span class="pwiz-row-pos">${esc(p.pos)}</span>` : '') +
          `<span class="pwiz-row-stat">${ag >= 99 ? '—' : ag+'+'}</span>`;
        btn.addEventListener('click', () => {
          ws.interceptor     = p;
          ws.interceptAG     = ag >= 99 ? 4 : ag;
          ws.interceptTarget = Math.min(6, Math.max(2, ws.interceptAG));
          intListWrap.querySelectorAll('.pwiz-player-row').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          intSummaryEl.innerHTML = `<div class="pwiz-target-bar" style="margin:0.25rem 0;">
            <span class="pwiz-target-num">${ws.interceptTarget}+</span>
            <span class="pwiz-target-note"> ${esc(p.name || p.pos)}, AG${ws.interceptAG}+</span>
          </div>`;
          updateReqs();
        });
        intListWrap.appendChild(btn);
      });
      intListWrap.appendChild(intSummaryEl);
      if (ws.interceptor) {
        intSummaryEl.innerHTML = `<div class="pwiz-target-bar" style="margin:0.25rem 0;">
          <span class="pwiz-target-num">${ws.interceptTarget}+</span>
          <span class="pwiz-target-note"> ${esc(ws.interceptor.name || ws.interceptor.pos)}, AG${ws.interceptAG}+</span>
        </div>`;
      }
    }
    el.appendChild(intListWrap);

    setIntercept(ws.intercept);
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

    /* Compute targets */
    let range = null;
    if (ws.throwerPos && ws.catcherPos && ws.pitch) {
      range = ws.pitch.getPassRange(ws.throwerPos.col, ws.throwerPos.row, ws.catcherPos.col, ws.catcherPos.row);
    }
    const paBase  = getStat(ws.thrower, 'PA');
    const agBase  = getStat(ws.catcher, 'AG');
    const skills  = typeof getPlayerSkills === 'function' ? getPlayerSkills(ws.thrower) : [];
    const hasSk   = (name) => skills.some(s => s.toLowerCase() === name.toLowerCase());
    const rangeMod     = range?.mod ?? 0;
    const tzMod        = hasSk('Nerves of Steel') ? 0 : -ws.tz;
    const accurateMod  = (hasSk('Accurate') && range && range.distance <= 6) ? 1 : 0;
    const cannoneerMod = (hasSk('Cannoneer') && range && range.distance > 6)  ? 1 : 0;
    const paFinal      = paBase >= 99 ? 99 : Math.min(6, Math.max(2, paBase - rangeMod - tzMod - accurateMod - cannoneerMod));
    const w            = window.GameState?.currentWeather;
    const isBlizzard   = w?.name === 'Blizzard';
    const blizzardFumble = isBlizzard && range && (range.rangeKey === 'long' || range.rangeKey === 'bomb');
    const wCatchMod    = (w?.name === 'Pouring Rain' || isBlizzard) ? -1 : 0;
    const agFinal      = Math.min(6, Math.max(2, agBase + wCatchMod - ws.catcherTZ));

    /* Horizontal action row */
    if (rollEl) {
      rollEl.hidden = false;
      buildActionRow(rollEl, paFinal, agFinal, blizzardFumble, range);
    }
  }

  /* ─────────────────────────────────────────────────────
     HORIZONTAL ACTION ROW
     ──────────────────────────────────────────────────── */

  function buildActionRow(el, paTarget, agTarget, blizzardFumble, range) {
    el.innerHTML = '';

    const RANGE_C = { quick:'#81c784', short:'#FFD54F', long:'#FF8C00', bomb:'#ff8fa0' };
    const rangeStr = range
      ? `<span style="color:${RANGE_C[range.rangeKey]??'#ccc'};font-size:0.6rem;">${range.rangeLabel} (${range.distance}sq)</span>`
      : '';

    /* Header separator */
    const sep = document.createElement('div');
    sep.style.cssText = 'border-top:1px solid rgba(80,130,255,0.18);margin:0.5rem 0 0.4rem;padding-top:0.35rem;font-family:JetBrains Mono,monospace;font-size:0.58rem;text-transform:uppercase;letter-spacing:0.1em;color:rgba(180,210,255,0.4);display:flex;align-items:center;gap:0.4rem;';
    sep.innerHTML = `Roll Sequence ${rangeStr}`;
    el.appendChild(sep);

    /* Three-column row */
    const row = document.createElement('div');
    row.className = 'pwiz-action-row';
    el.appendChild(row);

    /* Scatter area (below row, shown if inaccurate) */
    const scatterEl = document.createElement('div');
    scatterEl.id = 'pwiz-scatter-area';
    el.appendChild(scatterEl);

    /* ── Column factory ── */
    function makeCol(icon, label, targetStr, chipCls) {
      const col = document.createElement('div');
      col.className = 'pwiz-action-col';
      col.innerHTML = `
        <div class="pwiz-action-chip ${chipCls}">${icon} ${label}<br><span class="pwiz-action-target">${targetStr}</span></div>
      `;
      const dieWrap = document.createElement('div');
      dieWrap.className = 'pwiz-action-die';
      const resEl = document.createElement('div');
      resEl.className = 'pwiz-action-result';
      col.appendChild(dieWrap);
      col.appendChild(resEl);
      return { col, dieWrap, resEl };
    }

    /* ── THROW column ── */
    const throwTarget = paTarget >= 99 ? '— (No PA)' : `${paTarget}+`;
    const { col: throwCol, dieWrap: throwDie, resEl: throwRes } = makeCol('🎯', 'Throw', throwTarget, 'chip-throw');
    const throwBtn = document.createElement('button');
    throwBtn.type = 'button'; throwBtn.className = 'roll-btn'; throwBtn.style.marginTop = '0.3rem';
    throwBtn.innerHTML = '<span class="roll-btn-icon">🎲</span> Roll';
    throwCol.appendChild(throwBtn);
    row.appendChild(throwCol);

    /* ── INTERCEPT column (if toggled) ── */
    let intCol = null, intDie = null, intRes = null, intBtn = null;
    if (ws.intercept) {
      const intTarget = ws.interceptor ? `${ws.interceptTarget}+` : '?+';
      const sub = ws.interceptor ? `<div class="pwiz-action-sub">${esc(ws.interceptor.name || ws.interceptor.pos)}</div>` : '';
      const arrow1 = document.createElement('div');
      arrow1.className = 'pwiz-action-arrow'; arrow1.textContent = '→';
      row.appendChild(arrow1);
      const built = makeCol('⚡', 'Intercept', intTarget, 'chip-int');
      intCol = built.col; intDie = built.dieWrap; intRes = built.resEl;
      if (sub) intCol.querySelector('.pwiz-action-chip').insertAdjacentHTML('beforeend', sub);
      intBtn = document.createElement('button');
      intBtn.type = 'button'; intBtn.className = 'roll-btn'; intBtn.style.marginTop = '0.3rem';
      intBtn.innerHTML = '<span class="roll-btn-icon">🎲</span> Roll';
      intBtn.disabled = true;
      intCol.appendChild(intBtn);
      row.appendChild(intCol);
    }

    /* ── CATCH column ── */
    const arrow2 = document.createElement('div');
    arrow2.className = 'pwiz-action-arrow'; arrow2.textContent = '→';
    row.appendChild(arrow2);
    const catchTarget = agTarget >= 99 ? '—' : `${agTarget}+`;
    const { col: catchCol, dieWrap: catchDie, resEl: catchRes } = makeCol('🤲', 'Catch', catchTarget, 'chip-catch');
    const catchBtn = document.createElement('button');
    catchBtn.type = 'button'; catchBtn.className = 'roll-btn'; catchBtn.style.marginTop = '0.3rem';
    catchBtn.innerHTML = '<span class="roll-btn-icon">🎲</span> Roll';
    catchBtn.disabled = true;
    catchCol.appendChild(catchBtn);
    row.appendChild(catchCol);

    /* ── Helper: roll a D6 in a dieWrap ── */
    async function rollInWrap(wrap) {
      const dieEl = document.createElement('div');
      dieEl.className = 'die'; dieEl.dataset.value = '1';
      dieEl.innerHTML = '<div class="die-face"></div>';
      wrap.innerHTML = '';
      wrap.appendChild(dieEl);
      const v = await Dice.rollDieElement(dieEl);
      return v;
    }

    /* ── THROW roll ── */
    throwBtn.addEventListener('click', async () => {
      if (blizzardFumble) {
        throwRes.innerHTML = `<span class="result-chip result-chip-bad">❌ Auto-Fumble</span><p class="result-desc" style="font-size:0.65rem;">Blizzard: Long/Bomb auto-fumble.</p>`;
        throwBtn.disabled = true; return;
      }
      throwBtn.disabled = true;
      const roll = await rollInWrap(throwDie);
      const isAccurate = paTarget >= 99 || roll >= paTarget;
      const isFumble   = roll === 1;
      ws.passResult = isFumble ? 'fumble' : (isAccurate ? 'accurate' : 'inaccurate');

      if (isFumble) {
        throwRes.innerHTML = `<div class="result-roll-num">${roll}</div><span class="result-chip result-chip-bad">💀 Fumble!</span><p class="result-desc" style="font-size:0.65rem;">Turnover!</p>`;
        return;
      }
      const cls = isAccurate ? 'result-chip-ok' : 'result-chip-warn';
      throwRes.innerHTML = `<div class="result-roll-num">${roll}</div><span class="result-chip ${cls}">${isAccurate ? '✓ Accurate' : '⚠ Inaccurate'}</span>`;

      if (!isAccurate) {
        /* Show scatter section, then arm catch */
        buildScatterSection(scatterEl, agTarget, () => { catchBtn.disabled = false; });
        return;
      }
      /* Accurate: arm intercept or catch */
      if (ws.intercept && intBtn) intBtn.disabled = false;
      else catchBtn.disabled = false;
    });

    /* ── INTERCEPT roll ── */
    if (intBtn) {
      intBtn.addEventListener('click', async () => {
        intBtn.disabled = true;
        const roll = await rollInWrap(intDie);
        const tgt    = ws.interceptTarget ?? agTarget;
        const caught = roll >= tgt;
        const cls    = caught ? 'result-chip-bad' : 'result-chip-ok';
        intRes.innerHTML = `<div class="result-roll-num">${roll}</div><span class="result-chip ${cls}">${caught ? '⚔ Intercepted!' : '✓ Not Int.'}</span>`;
        if (!caught) {
          if (ws.passResult === 'inaccurate') buildScatterSection(scatterEl, agTarget, () => { catchBtn.disabled = false; });
          else catchBtn.disabled = false;
        }
      });
    }

    /* ── CATCH roll ── */
    catchBtn.addEventListener('click', async () => {
      catchBtn.disabled = true;
      const roll   = await rollInWrap(catchDie);
      const caught = roll !== 1 && roll >= agTarget;
      ws.catchResult = caught ? 'caught' : 'dropped';
      const cls = caught ? 'result-chip-ok' : 'result-chip-bad';
      catchRes.innerHTML = `<div class="result-roll-num">${roll}</div><span class="result-chip ${cls}">${caught ? '✓ Caught!' : '✗ Dropped'}</span>`;

      if (caught && ws.catcher && window.GameState) {
        window.GameState.ballCarrier = { side: ws.activeSide, idx: ws.catcher.idx };
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button'; closeBtn.className = 'roll-btn';
        closeBtn.style.cssText = 'margin-top:0.35rem;background:rgba(76,175,80,0.15);border-color:rgba(76,175,80,0.4);color:#81c784;';
        closeBtn.innerHTML = '✓ Complete Pass — Close';
        closeBtn.addEventListener('click', () => window.Panels?.closePanel?.('pass'));
        catchRes.appendChild(closeBtn);
      } else if (!caught) {
        const bBtn = document.createElement('button');
        bBtn.type = 'button'; bBtn.className = 'pass-nav-btn'; bBtn.style.marginTop = '0.3rem';
        bBtn.textContent = '→ Ball Bounces (D8)';
        bBtn.addEventListener('click', () => buildScatterSection(scatterEl, agTarget, () => {}));
        catchRes.appendChild(bBtn);
      }
    });
  }

  const D8A = {1:'↖',2:'↑',3:'↗',4:'←',5:'→',6:'↙',7:'↓',8:'↘'};
  const D8N = {1:'Up-Left',2:'Up',3:'Up-Right',4:'Left',5:'Right',6:'Down-Left',7:'Down',8:'Down-Right'};

  /* Scatter section: 3 sequential D8 rolls, updates pitch overlay, calls onDone when complete */
  function buildScatterSection(el, agTarget, onDone) {
    el.innerHTML = '';
    const sec = document.createElement('div');
    sec.style.cssText = 'margin-top:0.5rem;padding:0.4rem 0.6rem;background:rgba(3,8,24,0.5);border:1px solid rgba(80,130,255,0.15);border-radius:4px;font-family:JetBrains Mono,monospace;';
    const h = document.createElement('div');
    h.style.cssText = 'font-size:0.62rem;text-transform:uppercase;letter-spacing:0.08em;color:rgba(180,210,255,0.45);margin-bottom:0.35rem;';
    h.textContent = '↗ Scatter — 3 × D8';
    sec.appendChild(h);
    el.appendChild(sec);

    const dirsCollected = [];
    const listEl = document.createElement('div');
    sec.appendChild(listEl);

    function rollNextScatter() {
      const n      = dirsCollected.length + 1;
      const dieEl  = document.createElement('div');
      dieEl.className = 'die'; dieEl.dataset.value = '1'; dieEl.dataset.sides = '8';
      dieEl.innerHTML = '<div class="die-face d8-face"></div>';
      dieEl.style.cssText = 'width:32px;height:32px;display:inline-block;vertical-align:middle;margin-right:0.4rem;';
      const rb = document.createElement('button');
      rb.type = 'button'; rb.className = 'roll-btn';
      rb.style.cssText = 'margin:0.2rem 0;padding:0.25rem 0.6rem;font-size:0.7rem;';
      rb.innerHTML = `<span class="roll-btn-icon">🎲</span> Scatter ${n}`;
      const rowEl = document.createElement('div');
      rowEl.style.cssText = 'display:flex;align-items:center;gap:0.4rem;margin-bottom:0.25rem;';
      rowEl.appendChild(dieEl);
      rowEl.appendChild(rb);
      listEl.appendChild(rowEl);

      rb.addEventListener('click', async () => {
        rb.disabled = true;
        const d = await Dice.rollDieElement(dieEl);
        dirsCollected.push(d);
        ws.scatterDirs.push(d);

        const lbl = document.createElement('span');
        lbl.style.cssText = 'font-size:0.85rem;color:rgba(200,220,255,0.8);';
        lbl.textContent = ` ${D8A[d]} ${D8N[d]}`;
        rowEl.appendChild(lbl);

        /* Update pitch scatter overlay after each roll */
        if (ws.catcherPos && ws.pitch) {
          ws.pitch.showScatterPath(ws.catcherPos.col, ws.catcherPos.row, dirsCollected);
        }

        if (dirsCollected.length < 3) rollNextScatter();
        else onDone();
      });
    }

    rollNextScatter();
  }

  /* ── Boot ── */
  buildLayout();

  onPanelOpen('panel-pass', () => {
    ws.thrower = null; ws.catcher = null;
    ws.throwerPos = null; ws.catcherPos = null;
    ws.intercept = false; ws.interceptor = null;
    ws.interceptAG = 4; ws.interceptTarget = 4;
    ws.zonesOn = false;
    resetRoll();
    buildLayout();
  });

  panel.addEventListener('bb:diceMode', () => {
    window.Panels?.refreshWeatherChips?.();
  });
}
