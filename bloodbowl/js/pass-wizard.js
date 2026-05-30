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
    activeSide:  'left',
    thrower:     null,
    catcher:     null,
    throwerPos:  null,
    catcherPos:  null,
    tz:          0,
    catcherTZ:   0,
    intercept:   false,
    zonesOn:     false,
    passResult:  null,
    scatterDirs: [],
    catchResult: null,
    pitch:       null,
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

    /* Interception toggle */
    const intRow = document.createElement('div');
    intRow.className = 'pwiz-mod-row'; intRow.style.marginTop = '0.3rem';
    const intBtn = document.createElement('button');
    intBtn.type = 'button'; intBtn.className = 'mod-toggle' + (ws.intercept ? ' active' : '');
    intBtn.textContent = 'Include Interception';
    intBtn.addEventListener('click', () => {
      ws.intercept = !ws.intercept;
      intBtn.classList.toggle('active', ws.intercept);
      updateReqs();
    });
    intRow.appendChild(intBtn);
    el.appendChild(intRow);
  }

  /* ─────────────────────────────────────────────────────
     REQUIREMENTS SUMMARY
     ──────────────────────────────────────────────────── */

  function updateReqs() {
    const reqEl  = document.getElementById('pwiz-req');
    const rollEl = document.getElementById('pwiz-roll');
    if (!reqEl) return;

    reqEl.innerHTML = '';

    if (!ws.thrower || !ws.catcher) {
      reqEl.innerHTML = '<p class="panel-intro" style="margin:0.4rem 0;">Select a thrower and catcher to see requirements.</p>';
      if (rollEl) rollEl.hidden = true;
      return;
    }

    /* Compute range from pitch positions */
    let range = null;
    if (ws.throwerPos && ws.catcherPos && ws.pitch) {
      range = ws.pitch.getPassRange(ws.throwerPos.col, ws.throwerPos.row, ws.catcherPos.col, ws.catcherPos.row);
    }

    const paBase  = getStat(ws.thrower, 'PA');
    const agBase  = getStat(ws.catcher, 'AG');
    const skills  = typeof getPlayerSkills === 'function' ? getPlayerSkills(ws.thrower) : [];
    const hasSk   = (name) => skills.some(s => s.toLowerCase() === name.toLowerCase());

    const rangeMod      = range?.mod ?? 0;
    const nervesOnThr   = hasSk('Nerves of Steel');
    const tzMod         = nervesOnThr ? 0 : -ws.tz;
    const accurateMod   = (hasSk('Accurate') && range && range.distance <= 6) ? 1 : 0;
    const cannoneerMod  = (hasSk('Cannoneer') && range && range.distance > 6)  ? 1 : 0;
    const paFinal       = paBase >= 99 ? 99 : paBase - rangeMod - tzMod - accurateMod - cannoneerMod;

    const w               = window.GameState?.currentWeather;
    const isBlizzard      = w?.name === 'Blizzard';
    const blizzardFumble  = isBlizzard && range && (range.rangeKey === 'long' || range.rangeKey === 'bomb');
    const wCatchMod       = (w?.name === 'Pouring Rain' || w?.name === 'Blizzard') ? -1 : 0;
    const catchTZMod      = -ws.catcherTZ;
    const agFinal         = agBase + wCatchMod + catchTZMod;

    const RANGE_C = { quick: '#81c784', short: '#FFD54F', long: '#FF8C00', bomb: '#ff8fa0' };
    let html = '<div style="font-size:0.72rem;font-family:JetBrains Mono,monospace;line-height:2;">';

    if (blizzardFumble) html += `<div style="color:#ff8fa0;font-weight:700;">⚠ BLIZZARD: Long/Long Bomb auto-fumble!</div>`;

    if (range) {
      const rc   = RANGE_C[range.rangeKey] ?? '#ccc';
      const mods = [];
      if (rangeMod)     mods.push(`range ${rangeMod}`);
      if (tzMod)        mods.push(`TZ ${tzMod}`);
      if (accurateMod)  mods.push('Accurate +1');
      if (cannoneerMod) mods.push('Cannoneer +1');
      html += `<div><strong>PASS:</strong> <span style="color:${rc};">${range.rangeLabel}</span> (${range.distance} sq) — <strong>${paFinal >= 99 ? 'No PA' : paFinal + '+'}</strong>`;
      if (mods.length) html += ` <span style="opacity:0.5;">(${mods.join(', ')})</span>`;
      html += '</div>';
    }

    const cm = [];
    if (wCatchMod)  cm.push(`weather ${wCatchMod}`);
    if (catchTZMod) cm.push(`TZ ${catchTZMod}`);
    html += `<div><strong>CATCH:</strong> Need <strong>${agFinal >= 99 ? '—' : agFinal + '+'}</strong>`;
    if (cm.length) html += ` <span style="opacity:0.5;">(${cm.join(', ')})</span>`;
    html += '</div>';

    if (w?.name === 'Pouring Rain') html += '<div style="opacity:0.65;">🌧 Pouring Rain: −1 to catch</div>';
    if (isBlizzard)                 html += '<div style="opacity:0.65;">❄️ Blizzard: −1 to catch</div>';

    html += '</div>';
    reqEl.innerHTML = html;

    /* Show roll section once — don't rebuild it if already built */
    if (rollEl && rollEl.hidden) {
      rollEl.hidden = false;
      buildRollSection(rollEl, paFinal, agFinal, blizzardFumble);
    }
  }

  /* ─────────────────────────────────────────────────────
     ROLL SEQUENCE
     ──────────────────────────────────────────────────── */

  function buildRollSection(el, paTarget, agTarget, blizzardFumble) {
    el.innerHTML = '';

    const divEl = document.createElement('div');
    divEl.style.cssText = 'border-top:1px solid rgba(80,130,255,0.18);margin:0.5rem 0 0.4rem;padding-top:0.4rem;font-family:JetBrains Mono,monospace;font-size:0.62rem;text-transform:uppercase;letter-spacing:0.1em;color:rgba(180,210,255,0.45);';
    divEl.textContent = 'Roll Sequence';
    el.appendChild(divEl);

    const throwBtn = document.createElement('button');
    throwBtn.type = 'button'; throwBtn.className = 'roll-btn';
    throwBtn.innerHTML = '<span class="roll-btn-icon">🎲</span> Roll Pass';
    el.appendChild(throwBtn);

    const throwResEl = document.createElement('div');
    throwResEl.className = 'roll-result'; throwResEl.hidden = true;
    el.appendChild(throwResEl);

    throwBtn.addEventListener('click', async () => {
      if (blizzardFumble) {
        throwResEl.innerHTML = '<div class="result-name" style="color:#ff8fa0;">❌ Auto-Fumble</div><p class="result-desc">Blizzard: Long and Long Bomb passes are automatically fumbled.</p>';
        throwResEl.hidden = false; throwBtn.disabled = true;
        return;
      }
      throwBtn.disabled = true;

      const dieEl = document.createElement('div');
      dieEl.className = 'die'; dieEl.dataset.value = '1';
      dieEl.innerHTML = '<div class="die-face"></div>';
      dieEl.style.cssText = 'width:36px;height:36px;display:inline-block;margin-bottom:0.4rem;';
      el.insertBefore(dieEl, throwResEl);
      const roll = await Dice.rollDieElement(dieEl);
      dieEl.remove();

      let outcome, cls, desc;
      if (roll === 1) {
        outcome = 'Fumble!'; cls = 'result-chip-bad';
        desc = `Rolled ${roll} — fumble! Ball bounces. Turnover!`;
      } else if (paTarget >= 99 || roll >= paTarget) {
        outcome = '✓ Accurate'; cls = 'result-chip-ok';
        desc = paTarget >= 99 ? 'No PA required — accurate.' : `Rolled ${roll} vs ${paTarget}+ — accurate!`;
      } else {
        outcome = '⚠ Inaccurate'; cls = 'result-chip-warn';
        desc = `Rolled ${roll} vs ${paTarget}+ — inaccurate, ball scatters.`;
      }

      throwResEl.innerHTML = `<div class="result-roll-num">${roll}</div><span class="result-chip ${cls}">${outcome}</span><p class="result-desc">${desc}</p>`;
      throwResEl.hidden = false;
      ws.passResult = roll === 1 ? 'fumble' : ((paTarget >= 99 || roll >= paTarget) ? 'accurate' : 'inaccurate');
      if (ws.passResult === 'fumble') return;

      if (ws.intercept) { buildInterceptStep(el, agTarget); return; }
      if (ws.passResult === 'inaccurate') buildScatterStep(el, agTarget);
      else buildCatchStep(el, agTarget);
    });
  }

  const D8A = {1:'↖',2:'↑',3:'↗',4:'←',5:'→',6:'↙',7:'↓',8:'↘'};
  const D8N = {1:'Up-Left',2:'Up',3:'Up-Right',4:'Left',5:'Right',6:'Down-Left',7:'Down',8:'Down-Right'};

  function subSection(el, title) {
    const sec = document.createElement('div');
    sec.style.marginTop = '0.5rem';
    const h = document.createElement('div');
    h.style.cssText = 'font-family:JetBrains Mono,monospace;font-size:0.68rem;font-weight:700;color:rgba(180,210,255,0.6);margin-bottom:0.25rem;';
    h.textContent = title; sec.appendChild(h);
    el.appendChild(sec);
    return sec;
  }

  async function rollSingleDie(container, sides) {
    const die = document.createElement('div');
    die.className = 'die'; die.dataset.value = '1';
    if (sides !== 6) die.dataset.sides = sides;
    die.innerHTML = `<div class="die-face${sides > 6 ? ' d8-face' : ''}"></div>`;
    die.style.cssText = 'width:32px;height:32px;display:inline-block;margin-bottom:0.25rem;';
    container.appendChild(die);
    const v = await Dice.rollDieElement(die);
    die.remove();
    return v;
  }

  function buildInterceptStep(el, agTarget) {
    const sec = subSection(el, '⚔ INTERCEPTION CHECK');
    const p   = document.createElement('p');
    p.className = 'panel-intro'; p.style.margin = '0 0 0.3rem';
    p.textContent = 'Intercepting player needs this+ to intercept:';
    sec.appendChild(p);

    let intAG = 4;
    const agSel = document.createElement('div');
    agSel.className = 'av-picker';
    [2,3,4,5,6].forEach(n => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'av-btn' + (n === 4 ? ' active' : '');
      btn.textContent = `${n}+`; btn.dataset.ag = n;
      btn.addEventListener('click', () => {
        agSel.querySelectorAll('.av-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active'); intAG = n;
      });
      agSel.appendChild(btn);
    });
    sec.appendChild(agSel);

    const rb = document.createElement('button');
    rb.type = 'button'; rb.className = 'roll-btn'; rb.style.marginTop = '0.3rem';
    rb.innerHTML = '<span class="roll-btn-icon">🎲</span> Roll Intercept';
    const resEl = document.createElement('div');
    resEl.className = 'roll-result'; resEl.hidden = true;

    rb.addEventListener('click', async () => {
      rb.disabled = true;
      const roll   = await rollSingleDie(sec, 6);
      const caught = roll >= intAG;
      resEl.innerHTML = `<div class="result-roll-num">${roll}</div>
        <span class="result-chip ${caught ? 'result-chip-bad' : 'result-chip-ok'}">${caught ? '⚔ Intercepted!' : '✓ Not Intercepted'}</span>
        <p class="result-desc">${caught ? 'Intercepted!' : `Rolled ${roll} vs ${intAG}+ — not intercepted. Continue.`}</p>`;
      resEl.hidden = false;
      if (!caught) {
        if (ws.passResult === 'inaccurate') buildScatterStep(el, agTarget);
        else buildCatchStep(el, agTarget);
      }
    });
    sec.appendChild(rb); sec.appendChild(resEl);
  }

  function buildScatterStep(el, agTarget) {
    const sec    = subSection(el, '↗ SCATTER (3 × D8)');
    const resEl  = document.createElement('div');
    resEl.className = 'roll-result'; resEl.hidden = true;
    const rb = document.createElement('button');
    rb.type = 'button'; rb.className = 'roll-btn';
    rb.innerHTML = '<span class="roll-btn-icon">🎲</span> Roll Scatter';

    rb.addEventListener('click', async () => {
      rb.disabled = true;
      const dirs = [];
      for (let i = 0; i < 3; i++) {
        const d = await rollSingleDie(sec, 8);
        dirs.push(d); ws.scatterDirs.push(d);
      }
      resEl.innerHTML = `<div class="result-name">Ball scatters:</div>` +
        dirs.map(d => `<div class="result-roll-breakdown" style="font-size:1.3rem;">${D8A[d]} ${D8N[d]}</div>`).join('');
      resEl.hidden = false;
      buildCatchStep(el, agTarget);
    });

    sec.appendChild(rb); sec.appendChild(resEl);
  }

  function buildCatchStep(el, agTarget) {
    const sec   = subSection(el, '🏈 CATCH');
    const tgt   = agTarget >= 99 ? 6 : agTarget;
    const resEl = document.createElement('div');
    resEl.className = 'roll-result'; resEl.hidden = true;
    const rb = document.createElement('button');
    rb.type = 'button'; rb.className = 'roll-btn';
    rb.innerHTML = `<span class="roll-btn-icon">🎲</span> Roll Catch (need ${tgt}+)`;

    rb.addEventListener('click', async () => {
      rb.disabled = true;
      const roll   = await rollSingleDie(sec, 6);
      const caught = roll >= tgt;
      ws.catchResult = caught ? 'caught' : 'dropped';

      resEl.innerHTML = `<div class="result-roll-num">${roll}</div>
        <span class="result-chip ${caught ? 'result-chip-ok' : 'result-chip-bad'}">${caught ? '✓ Caught!' : '✗ Dropped'}</span>
        <p class="result-desc">${caught ? `Rolled ${roll} vs ${tgt}+ — caught!` : `Rolled ${roll} vs ${tgt}+ — dropped!`}</p>`;
      resEl.hidden = false;

      if (caught) {
        const completeBtn = document.createElement('button');
        completeBtn.type = 'button'; completeBtn.className = 'roll-btn';
        completeBtn.style.cssText = 'margin-top:0.4rem;background:rgba(76,175,80,0.15);border-color:rgba(76,175,80,0.4);color:#81c784;';
        completeBtn.innerHTML = '✓ Complete Pass — Close';
        completeBtn.addEventListener('click', () => {
          if (ws.catcher && window.GameState) {
            window.GameState.ballCarrier = { side: ws.activeSide, idx: ws.catcher.idx };
          }
          window.Panels?.closePanel?.('pass');
        });
        resEl.appendChild(completeBtn);
      } else {
        const bBtn = document.createElement('button');
        bBtn.type = 'button'; bBtn.className = 'pass-nav-btn'; bBtn.style.marginTop = '0.35rem';
        bBtn.textContent = '→ Ball Bounces (D8)';
        bBtn.addEventListener('click', () => {
          const agFinal = tgt; /* reuse same target */
          buildScatterStep(el, agFinal);
        });
        resEl.appendChild(bBtn);
      }
    });

    sec.appendChild(rb); sec.appendChild(resEl);
  }

  /* ── Boot ── */
  buildLayout();

  onPanelOpen('panel-pass', () => {
    ws.thrower = null; ws.catcher = null;
    ws.throwerPos = null; ws.catcherPos = null;
    ws.intercept = false; ws.zonesOn = false;
    resetRoll();
    buildLayout();
  });

  panel.addEventListener('bb:diceMode', () => {
    window.Panels?.refreshWeatherChips?.();
  });
}
