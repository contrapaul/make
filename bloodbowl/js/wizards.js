'use strict';

/* ═══════════════════════════════════════════════════════
   Blood Bowl Companion — js/wizards.js
   Block, Pass, Foul, Throw Team-Mate wizards.
   Depends on: dice.js, panels.js (BBData), settings.js, physical-dice.js
   ═══════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────
   BLOCK DIE
   ──────────────────────────────────────────────────────── */

const BLOCK_FACES = [
  null,
  { key: 'att-down',  label: 'Attacker Down', sym: '💀', cls: 'att-down',  colour: 'var(--bb-red,#C8102E)' },
  { key: 'both-down', label: 'Both Down',      sym: '⚡', cls: 'both-down', colour: '#BB4400' },
  { key: 'push',      label: 'Push',           sym: '→',  cls: 'push',      colour: '#555' },
  { key: 'push',      label: 'Push',           sym: '→',  cls: 'push',      colour: '#555' },
  { key: 'stumble',   label: 'Stumble',        sym: '↗',  cls: 'stumble',   colour: '#774400' },
  { key: 'def-down',  label: 'Defender Down',  sym: '★',  cls: 'def-down',  colour: '#1B5E20' },
];

function buildBlockFace(el, idx) {
  const f = BLOCK_FACES[Math.max(1, Math.min(6, idx))];
  el.className = `block-face ${f.cls}`;
  el.innerHTML = `<span class="block-face-sym">${f.sym}</span><span class="block-face-label">${f.label}</span>`;
}

function rollBlockDie(faceEl) {
  const result = Math.floor(Math.random() * 6) + 1;
  let cycles = 0;
  const iv = setInterval(() => {
    if (cycles++ >= 9) { clearInterval(iv); return; }
    buildBlockFace(faceEl, Math.floor(Math.random() * 6) + 1);
  }, 52);

  faceEl.classList.remove('rolling', 'settled');
  void faceEl.offsetWidth;
  faceEl.classList.add('rolling');

  return new Promise(resolve => {
    faceEl.addEventListener('animationend', () => {
      clearInterval(iv);
      faceEl.classList.remove('rolling');
      buildBlockFace(faceEl, result);
      void faceEl.offsetWidth;
      faceEl.classList.add('settled');
      faceEl.addEventListener('animationend', () => {
        faceEl.classList.remove('settled');
        resolve(result);
      }, { once: true });
    }, { once: true });
  });
}

/* ─────────────────────────────────────────────────────────
   SHARED UTILITIES
   ──────────────────────────────────────────────────────── */

function bindStepper(el, min, max, onChange) {
  if (!el) return { get: () => min, set: () => {} };
  const valEl = el.querySelector('.stepper-val');
  let value   = parseInt(valEl?.textContent ?? min, 10);

  el.querySelectorAll('.stepper-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      value = Math.min(max, Math.max(min, value + parseInt(btn.dataset.dir, 10)));
      if (valEl) valEl.textContent = value;
      onChange?.(value);
    });
  });

  return {
    get: ()  => value,
    set: v   => { value = Math.min(max, Math.max(min, v)); if (valEl) valEl.textContent = value; },
  };
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function pause(ms) { return new Promise(r => setTimeout(r, ms)); }

function rangeFind(table, roll, minKey = 'min', maxKey = 'max') {
  return (table ?? []).find(e => roll >= e[minKey] && roll <= e[maxKey]) ?? null;
}

/* Get the active dice mode for a wizard key */
function wizardMode(key) { return window.BBSettings?.getWizardDiceMode(key) ?? 'digital'; }

/* Insert a .physical-zone div after refEl, or find existing */
function ensurePhysZone(refEl, id) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id        = id;
    el.className = 'physical-zone';
    el.hidden    = true;
    refEl.insertAdjacentElement('afterend', el);
  }
  return el;
}

/* ════════════════════════════════════════════════════════
   BLOCK WIZARD
   ════════════════════════════════════════════════════════ */

function initBlockWizard() {
  const panel   = document.getElementById('panel-block');
  const rollBtn = document.getElementById('block-roll-btn');
  if (!rollBtn) return;

  let attST = 3, defST = 3, attAst = 0, defAst = 0;

  function calcBlock() {
    const a = attST + attAst;
    const d = defST + defAst;
    if (a >= d * 2) return { count: 3, who: 'attacker picks', attFav: true };
    if (a > d)      return { count: 2, who: 'attacker picks', attFav: true };
    if (a === d)    return { count: 1, who: '',               attFav: null };
    if (d >= a * 2) return { count: 3, who: 'defender picks', attFav: false };
    return                 { count: 2, who: 'defender picks', attFav: false };
  }

  function renderDiceTray(count) {
    const tray = document.getElementById('block-dice-tray');
    if (!tray) return;
    tray.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const face = document.createElement('div');
      face.id = `block-face-${i}`;
      buildBlockFace(face, 3);
      tray.appendChild(face);
    }
  }

  function updateInfo() {
    const { count, who } = calcBlock();
    const countEl = document.getElementById('block-dice-count');
    const noteEl  = document.getElementById('block-dice-note');
    if (countEl) countEl.textContent = count;
    if (noteEl)  noteEl.textContent  = who ? `${count > 1 ? 'dice' : 'die'} — ${who}` : 'block die — equal strength';
    renderDiceTray(count);
  }

  const attStStepper = bindStepper(document.getElementById('block-att-st'),      1, 7, v => { attST  = v; updateInfo(); });
  const defStStepper = bindStepper(document.getElementById('block-def-st'),      1, 7, v => { defST  = v; updateInfo(); });
  bindStepper(document.getElementById('block-att-assists'), 0, 6, v => { attAst = v; updateInfo(); });
  bindStepper(document.getElementById('block-def-assists'), 0, 6, v => { defAst = v; updateInfo(); });

  updateInfo();
  initBlockPlayerSelect(attStStepper, defStStepper);

  const resultEl = document.getElementById('block-result');

  /* Physical zone goes after the dice tray */
  const diceTray  = document.getElementById('block-dice-tray');
  const physZone  = ensurePhysZone(diceTray, 'block-phys');

  /* ── Physical block buttons (6 faces, colour-coded) ── */
  const PHYS_BLOCK_BTNS = [
    { value: 1, label: 'Attacker Down', cls: 'phys-bad'     },
    { value: 2, label: 'Both Down',     cls: 'phys-warn'    },
    { value: 3, label: 'Push',          cls: 'phys-neutral' },
    { value: 4, label: 'Push',          cls: 'phys-neutral' },
    { value: 5, label: 'Stumble',       cls: 'phys-warn'    },
    { value: 6, label: 'Defender Down', cls: 'phys-good'    },
  ];

  function processBlockResult(rolls) {
    const results = rolls.map(r => BLOCK_FACES[r]);
    const { count, who } = calcBlock();
    const picker = who
      ? `<span style="color:var(--bb-gold,#D4AF37);">${who.charAt(0).toUpperCase() + who.slice(1)}</span>`
      : 'No choice';

    let html = `
      <div class="result-roll-breakdown">
        ${count} block ${count > 1 ? 'dice' : 'die'}${who ? ` — ${picker} selects the result` : ''}
      </div>
      <div class="block-results-list">
    `;
    results.forEach(r => {
      html += `<div class="block-result-row" style="color:${r.colour}; font-weight:800; font-size:1.05rem;">${r.sym} ${r.label}</div>`;
    });
    html += '</div>';

    const keys  = new Set(results.map(r => r.key));
    const notes = [];
    if (keys.has('att-down'))  notes.push('💀 <strong>Attacker Down</strong>: attacker is knocked down — Turnover!');
    if (keys.has('both-down')) notes.push('⚡ <strong>Both Down</strong>: both fall, unless attacker has <em>Block</em> or <em>Wrestle</em>.');
    if (keys.has('stumble'))   notes.push('↗ <strong>Stumble</strong>: defender is knocked down unless they use <em>Dodge</em> to treat it as Push.');
    if (keys.has('def-down'))  notes.push('★ <strong>Defender Down</strong>: defender is knocked down — roll Armour!');

    if (notes.length) {
      html += `<div class="result-notes"><ul style="margin:0.3rem 0 0;padding-left:1.1rem;font-size:0.79rem;color:rgba(255,255,255,0.72);">`;
      notes.forEach(n => { html += `<li style="margin-bottom:0.3rem;">${n}</li>`; });
      html += '</ul></div>';
    }

    resultEl.innerHTML = html;
    resultEl.hidden    = false;
  }

  async function doRoll() {
    rollBtn.disabled = true;
    resultEl.hidden  = true;
    const { count } = calcBlock();
    const faces = Array.from({ length: count }, (_, i) => document.getElementById(`block-face-${i}`));
    const rolls = await Promise.all(faces.map(f => rollBlockDie(f)));
    processBlockResult(rolls);
    rollBtn.disabled = false;
  }

  function showPhys() {
    /* In physical block, show 6 face buttons. Player taps the result they rolled. */
    diceTray.hidden = true;
    rollBtn.hidden  = true;
    window.PhysicalDice.showPhysicalButtons(physZone, {
      buttons: PHYS_BLOCK_BTNS, columns: 3,
      onSelect(faceVal) {
        resultEl.hidden = true;
        processBlockResult([faceVal]);
      },
    });
    physZone.hidden = false;
  }

  function showDigital() {
    physZone.hidden = true;
    diceTray.hidden = false;
    rollBtn.hidden  = false;
    renderDiceTray(calcBlock().count);
  }

  panel?.addEventListener('bb:diceMode', e => e.detail.mode === 'physical' ? showPhys() : showDigital());
  rollBtn.addEventListener('click', doRoll);

  if (wizardMode('block') === 'physical') showPhys();
}

/* ════════════════════════════════════════════════════════
   PASS WIZARD  (Sprint 3 rebuild — 8-step sequence)
   ════════════════════════════════════════════════════════ */

/* ── Skill extraction from a player card DOM element ── */
function getPlayerSkills(playerObj) {
  if (!playerObj?.card) return [];
  return Array.from(playerObj.card.querySelectorAll('.skill-link'))
    .map(el => el.dataset.skill?.trim() ?? '')
    .filter(Boolean);
}

function hasSkill(playerObj, name) {
  const lc = name.toLowerCase();
  return getPlayerSkills(playerObj).some(s => s.toLowerCase() === lc);
}

/* ── Shared skill-use prompt — returns Promise<boolean>
   Renders inline Yes/No buttons in `containerEl`.
   Resolves true if the user chooses to use the skill, false otherwise.

   Example: const used = await promptSkillUse(ws.thrower, 'Pro', throwRes, rollD6);
   If used: caller should re-roll the original die and handle new result.

   For Pro specifically: on click "Use Pro", roll D6 automatically.
   If result >= 4 → resolve true (caller may re-roll).
   If result < 4  → resolve false (Pro failed, proceed to failure path). */
function promptSkillUse(playerObj, skillName, containerEl, rollD6Fn) {
  return new Promise(resolve => {
    if (!hasSkill(playerObj, skillName)) { resolve(false); return; }

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;margin-top:0.25rem;';

    const lbl = document.createElement('span');
    lbl.style.cssText = 'font-family:JetBrains Mono,monospace;font-size:0.65rem;color:rgba(180,210,255,0.6);';

    if (skillName === 'Pro') {
      lbl.textContent = 'Use Pro? (roll 4+ to re-roll)';
      const yesBtn = document.createElement('button');
      yesBtn.type = 'button'; yesBtn.className = 'pass-nav-btn nav-primary';
      yesBtn.style.cssText = 'padding:0.2rem 0.5rem;font-size:0.65rem;';
      yesBtn.textContent = 'Use Pro';
      const noBtn = document.createElement('button');
      noBtn.type = 'button'; noBtn.className = 'pass-nav-btn';
      noBtn.style.cssText = 'padding:0.2rem 0.5rem;font-size:0.65rem;';
      noBtn.textContent = 'Skip';

      yesBtn.addEventListener('click', async () => {
        yesBtn.disabled = true; noBtn.disabled = true;
        /* Roll Pro check D6 inline */
        const proRollEl = document.createElement('div');
        proRollEl.style.cssText = 'display:inline-block;vertical-align:middle;';
        wrap.appendChild(proRollEl);
        const proVal = await rollD6Fn(proRollEl);
        const proOk = proVal >= 4;
        const proRes = document.createElement('span');
        proRes.style.cssText = `font-family:JetBrains Mono,monospace;font-size:0.65rem;font-weight:700;color:${proOk ? '#81c784' : '#ff8fa0'};margin-left:0.25rem;`;
        proRes.textContent = proOk ? `${proVal} ✓ Pro succeeds — re-roll!` : `${proVal} ✗ Pro failed.`;
        wrap.appendChild(proRes);
        resolve(proOk);
      });
      noBtn.addEventListener('click', () => { wrap.remove(); resolve(false); });

      wrap.appendChild(lbl); wrap.appendChild(yesBtn); wrap.appendChild(noBtn);
    } else {
      /* Generic skill-use prompt (Sure Hands, etc.) */
      lbl.textContent = `Use ${skillName}?`;
      const yesBtn = document.createElement('button');
      yesBtn.type = 'button'; yesBtn.className = 'pass-nav-btn nav-primary';
      yesBtn.style.cssText = 'padding:0.2rem 0.5rem;font-size:0.65rem;';
      yesBtn.textContent = 'Yes';
      const noBtn = document.createElement('button');
      noBtn.type = 'button'; noBtn.className = 'pass-nav-btn';
      noBtn.style.cssText = 'padding:0.2rem 0.5rem;font-size:0.65rem;';
      noBtn.textContent = 'No';
      yesBtn.addEventListener('click', () => { resolve(true); });
      noBtn.addEventListener('click', () => { wrap.remove(); resolve(false); });
      wrap.appendChild(lbl); wrap.appendChild(yesBtn); wrap.appendChild(noBtn);
    }

    containerEl.appendChild(wrap);
  });
}

/* Parse a stat value from the card stats text (e.g. "AG3+" → 3, "PA—" → null) */
function parseStat(statsText, key) {
  const m = statsText.match(new RegExp(`\\b${key}\\s*(\\d+)`, 'i'));
  return m ? parseInt(m[1], 10) : null;
}

/* Append a wps-list into a container element, populated by buildWizardPlayerList. */
function buildListIn(container, side, filterFn, onSelect) {
  const dummy = document.createElement('div');
  dummy.id        = `_wzr_tmp_${side}_${Date.now()}`;
  dummy.className = 'wps-list';
  container.appendChild(dummy);
  buildWizardPlayerList(dummy.id, side, filterFn, onSelect);
}

/* Build a 2-tab Home/Away roster selector into el.
   tabsId: prefix for tab button IDs.
   initialSide: 'left'|'right'.
   Calls onSelect(playerObj, activeSide) on player click.
   Returns { getActiveSide }. */
function buildRosterTabs(el, { tabsId, initialSide = 'left', filterFn, onSelect }) {
  const tabs = document.createElement('div');
  tabs.className = 'pwiz-team-tabs';
  const lBtn = document.createElement('button');
  const rBtn = document.createElement('button');
  lBtn.type = rBtn.type = 'button';
  lBtn.textContent = 'Home';
  rBtn.textContent = 'Away';

  const listWrap = document.createElement('div');

  let activeSide = initialSide;

  function showSide(side) {
    activeSide = side;
    lBtn.className = 'pwiz-team-tab' + (side === 'left'  ? ' active' : '');
    rBtn.className = 'pwiz-team-tab' + (side === 'right' ? ' active' : '');
    listWrap.innerHTML = '';
    buildListIn(listWrap, side, filterFn ?? (() => true), (p, stats) => onSelect(p, stats, side));
  }

  lBtn.addEventListener('click', () => showSide('left'));
  rBtn.addEventListener('click', () => showSide('right'));
  tabs.appendChild(lBtn);
  tabs.appendChild(rBtn);
  el.appendChild(tabs);
  el.appendChild(listWrap);
  showSide(initialSide);
  return { getActiveSide: () => activeSide };
}

function initPassWizard() {
  const panel = document.getElementById('panel-pass');
  if (!panel) return;

  /* ── Wizard state ── */
  const ws = {
    step:        1,
    thrower:     null,   /* player obj */
    catcher:     null,
    throwerSide: 'left',
    catcherSide: 'right',
    paTarget:    4,      /* PA stat parsed from card */
    catchAG:     4,
    range:       null,   /* { label, shortLabel, mod, cls, dist } */
    tz:          0,      /* thrower tackle zones */
    catcherTZ:   0,
    intercept:   false,
    interceptor:     null,   /* player obj — potential interceptor */
    interceptorSide: 'right',
    interceptAG:     null,   /* parsed AG of interceptor */
    interceptTarget: null,   /* d6 target to intercept */
    pitchGrid:   null,   /* PitchGrid instance (kept alive between step re-renders) */
    passResult:  null,   /* 'accurate'|'inaccurate'|'fumble' */
    scatterDirs: [],     /* D8 values for 3 scatter rolls */
    catchResult: null,
    /* auto-detected skill mods */
    modAccurate:   false,
    modNerves:     false,
    modCatch:      false,
    modHailMary:   false,
  };

  /* ── Panel body rebuild ── */
  const body = panel.querySelector('.panel-body');

  function buildShell() {
    body.innerHTML = '';

    /* Weather chip slot (recreate since body was cleared) */
    const wChip = document.createElement('div');
    wChip.className = 'weather-chip-slot';
    wChip.id = 'wchip-pass';
    wChip.hidden = true;
    body.appendChild(wChip);

    /* Summary strip */
    const sumEl = document.createElement('div');
    sumEl.className = 'pass-summary-strip';
    sumEl.id = 'pwiz-summary';
    body.appendChild(sumEl);

    /* Step indicator */
    const indEl = document.createElement('div');
    indEl.className = 'pass-step-indicator';
    indEl.id = 'pwiz-ind';
    body.appendChild(indEl);

    /* Step content */
    const contentEl = document.createElement('div');
    contentEl.id = 'pwiz-content';
    body.appendChild(contentEl);

    /* Nav row */
    const navEl = document.createElement('div');
    navEl.className = 'pass-nav';
    navEl.innerHTML = `
      <button class="pass-nav-btn" id="pwiz-back">← Back</button>
      <button class="pass-nav-btn nav-primary" id="pwiz-next">Next →</button>
    `;
    body.appendChild(navEl);

    document.getElementById('pwiz-back').addEventListener('click', () => go(ws.step - 1));
    document.getElementById('pwiz-next').addEventListener('click', () => go(ws.step + 1));
  }

  /* ── Step definitions ── */
  const STEPS = [
    { id: 1, label: 'Thrower' },
    { id: 2, label: 'Catcher' },
    { id: 3, label: 'Range'   },
    { id: 4, label: 'Mods'    },
    { id: 5, label: 'Int.'    },
    { id: 6, label: 'Throw'   },
    { id: 7, label: 'Scatter' },
    { id: 8, label: 'Catch'   },
  ];

  /* ── Navigation ── */
  function go(n) {
    /* Skip scatter step if pass was accurate or not yet rolled */
    if (n === 7 && ws.passResult !== 'inaccurate') n = ws.passResult === 'accurate' ? 8 : 6;
    ws.step = Math.max(1, Math.min(8, n));
    render();
  }

  /* ── Render cycle ── */
  function render() {
    /* Step indicator */
    const indEl = document.getElementById('pwiz-ind');
    if (indEl) {
      indEl.innerHTML = '';
      STEPS.forEach(s => {
        const pip = document.createElement('div');
        pip.className = 'pass-step-pip';
        pip.textContent = `${s.id} ${s.label}`;
        if (s.id < ws.step)  pip.classList.add('pip-done');
        if (s.id === ws.step) pip.classList.add('pip-current');
        indEl.appendChild(pip);
      });
    }

    /* Nav buttons */
    const backBtn = document.getElementById('pwiz-back');
    const nextBtn = document.getElementById('pwiz-next');
    if (backBtn) backBtn.disabled = ws.step === 1;
    if (nextBtn) {
      nextBtn.textContent = ws.step === 8 ? 'Done ✓' : 'Next →';
      nextBtn.disabled = ws.step === 8 && !ws.catchResult;
      if (ws.step === 6) { nextBtn.textContent = 'Skip'; nextBtn.disabled = false; }
    }

    /* Step content */
    const contentEl = document.getElementById('pwiz-content');
    if (!contentEl) return;
    contentEl.innerHTML = '';

    switch (ws.step) {
      case 1: renderThrower(contentEl); break;
      case 2: renderCatcher(contentEl); break;
      case 3: renderRange(contentEl);   break;
      case 4: renderMods(contentEl);    break;
      case 5: renderIntercept(contentEl); break;
      case 6: renderThrow(contentEl);   break;
      case 7: renderScatter(contentEl); break;
      case 8: renderCatch(contentEl);   break;
    }

    updateSummary();
    /* Refresh weather chip (slot was recreated in buildShell) */
    window.Panels?.refreshWeatherChips?.();
  }

  /* ── Summary strip ── */
  function updateSummary() {
    const el = document.getElementById('pwiz-summary');
    if (!el) return;
    const tName     = ws.thrower?.name ?? '—';
    const cName     = ws.catcher?.name ?? '—';
    const rangeStr  = ws.range
      ? `${ws.range.shortLabel}${ws.range.mod !== 0 ? ` (${ws.range.mod})` : ''}`
      : '—';
    const resultStr = ws.passResult ?? '—';
    const resCls    = ws.passResult === 'accurate' ? 'ok' : ws.passResult === 'fumble' ? 'bad' : '';

    el.innerHTML = `
      <span class="pass-sum-name">${esc(tName)}</span>
      <span class="pass-sum-sep">→</span>
      <span class="pass-sum-name">${esc(cName)}</span>
      <span class="pass-sum-sep">|</span>
      <span class="pass-sum-range">${esc(rangeStr)}</span>
      <span class="pass-sum-sep">|</span>
      <span class="pass-sum-result ${resCls}">${esc(resultStr)}</span>
    `;
  }

  /* ── Roster list helper ── */
  function renderRosterTabs(container, { leftLabel, rightLabel, filterLeft, filterRight, onSelect }) {
    const tabs = document.createElement('div');
    tabs.className = 'pwiz-team-tabs';

    let activeSide = 'left';

    const leftTab  = document.createElement('button');
    const rightTab = document.createElement('button');
    leftTab.type  = rightTab.type = 'button';
    leftTab.className  = 'pwiz-team-tab active';
    rightTab.className = 'pwiz-team-tab';
    leftTab.textContent  = leftLabel;
    rightTab.textContent = rightLabel;

    const listWrap = document.createElement('div');

    function showSide(side) {
      activeSide = side;
      leftTab.classList.toggle('active',  side === 'left');
      rightTab.classList.toggle('active', side === 'right');
      listWrap.innerHTML = '';
      const filter = side === 'left' ? filterLeft : filterRight;
      const { getSelected } = buildWizardPlayerList(`_pwiz-list-${side}`, side, filter ?? (() => true), onSelect);
      const innerList = document.createElement('div');
      innerList.className = 'wps-list';
      innerList.id = `_pwiz-list-${side}`;
      listWrap.appendChild(innerList);
      buildWizardPlayerList(innerList.id, side, filter ?? (() => true), onSelect);
    }

    leftTab.addEventListener('click',  () => showSide('left'));
    rightTab.addEventListener('click', () => showSide('right'));
    tabs.appendChild(leftTab);
    tabs.appendChild(rightTab);
    container.appendChild(tabs);
    container.appendChild(listWrap);

    showSide('left');
    return { getActiveSide: () => activeSide };
  }

  /* buildListIn is now a module-level helper */

  /* ─────────────────────────────────────────────────────
     STEP 1: THROWER SELECTION
     ──────────────────────────────────────────────────── */
  function renderThrower(el) {
    el.innerHTML = '<div class="pwiz-step-title">Select Thrower</div>';

    /* Pre-select ball carrier if tracked */
    const bc = window.GameState?.ballCarrier;

    const tabs = document.createElement('div');
    tabs.className = 'pwiz-team-tabs';
    const lBtn = document.createElement('button');
    const rBtn = document.createElement('button');
    lBtn.type = rBtn.type = 'button';
    lBtn.className = 'pwiz-team-tab' + (ws.throwerSide === 'left'  ? ' active' : '');
    rBtn.className = 'pwiz-team-tab' + (ws.throwerSide === 'right' ? ' active' : '');
    lBtn.textContent = 'Home';
    rBtn.textContent = 'Away';

    const listWrap = document.createElement('div');

    function showThrowerSide(side) {
      ws.throwerSide = side;
      lBtn.classList.toggle('active', side === 'left');
      rBtn.classList.toggle('active', side === 'right');
      listWrap.innerHTML = '';
      buildListIn(listWrap, side, p => !window.STATUS_META?.[p.status]?.dim, (p) => {
        ws.thrower = { ...p, skills: getPlayerSkills(p) };
        ws.paTarget = parseStat(p.statsText, 'PA') ?? 99;
        ws.throwerSide = side;
        /* Auto-detect skills */
        ws.modAccurate = hasSkill(p, 'Accurate');
        ws.modNerves   = hasSkill(p, 'Nerves of Steel');
        ws.modHailMary = hasSkill(p, 'Hail Mary Pass');
        updateSummary();
      });

      /* Pre-select ball carrier */
      if (bc && bc.side === side) {
        setTimeout(() => {
          const btn = listWrap.querySelector(`[data-player-idx="${bc.idx}"]`);
          btn?.click();
        }, 50);
      }
    }

    lBtn.addEventListener('click', () => showThrowerSide('left'));
    rBtn.addEventListener('click', () => showThrowerSide('right'));

    tabs.appendChild(lBtn);
    tabs.appendChild(rBtn);
    el.appendChild(tabs);
    el.appendChild(listWrap);

    showThrowerSide(ws.throwerSide);

    if (ws.thrower?.name) {
      const note = document.createElement('p');
      note.className = 'panel-intro';
      note.style.marginTop = '0.4rem';
      note.textContent = `Current: ${ws.thrower.name} (PA ${ws.paTarget === 99 ? '—' : ws.paTarget + '+'})`;
      el.appendChild(note);
    }
  }

  /* ─────────────────────────────────────────────────────
     STEP 2: CATCHER SELECTION
     ──────────────────────────────────────────────────── */
  function renderCatcher(el) {
    el.innerHTML = '<div class="pwiz-step-title">Select Catcher</div>';

    const tabs = document.createElement('div');
    tabs.className = 'pwiz-team-tabs';
    const lBtn = document.createElement('button');
    const rBtn = document.createElement('button');
    lBtn.type = rBtn.type = 'button';
    lBtn.className = 'pwiz-team-tab' + (ws.catcherSide === 'left'  ? ' active' : '');
    rBtn.className = 'pwiz-team-tab' + (ws.catcherSide === 'right' ? ' active' : '');
    lBtn.textContent = 'Home';
    rBtn.textContent = 'Away';

    const listWrap = document.createElement('div');

    function showCatcherSide(side) {
      ws.catcherSide = side;
      lBtn.classList.toggle('active', side === 'left');
      rBtn.classList.toggle('active', side === 'right');
      listWrap.innerHTML = '';
      buildListIn(listWrap, side, p => !window.STATUS_META?.[p.status]?.dim, (p) => {
        ws.catcher = { ...p, skills: getPlayerSkills(p) };
        ws.catchAG = parseStat(p.statsText, 'AG') ?? 4;
        ws.catcherSide = side;
        ws.modCatch = hasSkill(p, 'Catch');
        updateSummary();
      });
    }

    lBtn.addEventListener('click', () => showCatcherSide('left'));
    rBtn.addEventListener('click', () => showCatcherSide('right'));
    tabs.appendChild(lBtn);
    tabs.appendChild(rBtn);
    el.appendChild(tabs);
    el.appendChild(listWrap);

    showCatcherSide(ws.catcherSide);

    if (ws.catcher?.name) {
      const note = document.createElement('p');
      note.className = 'panel-intro';
      note.style.marginTop = '0.4rem';
      note.textContent = `Current: ${ws.catcher.name} (AG ${ws.catchAG}+)`;
      el.appendChild(note);
    }
  }

  /* ─────────────────────────────────────────────────────
     STEP 3: RANGE GRID
     ──────────────────────────────────────────────────── */
  function renderRange(el) {
    el.innerHTML = '<div class="pwiz-step-title">Tap to Place Catchers — Tap Thrower to Move</div>';

    const gridContainer = document.createElement('div');
    el.appendChild(gridContainer);

    const resultDisplay = document.createElement('div');
    resultDisplay.className = 'range-result-display';
    resultDisplay.hidden    = true;
    el.appendChild(resultDisplay);

    /* Reuse or create PitchGrid */
    if (!ws.pitchGrid) {
      ws.pitchGrid = new window.PitchGrid(gridContainer);
    } else {
      /* Re-insert existing grid DOM into new container */
      ws.pitchGrid.container = gridContainer;
      ws.pitchGrid.clearScatter?.();
      ws.pitchGrid._build();
    }

    /* Blizzard mode */
    const w = window.GameState?.currentWeather;
    ws.pitchGrid.setBlizzard(w?.name === 'Blizzard');

    /* Show range for current active catcher if set */
    if (ws.range) {
      resultDisplay.hidden = false;
      showRangeResult(resultDisplay, ws.range);
    }

    ws.pitchGrid.onCatcherSelect = (dist, range) => {
      ws.range = range;
      if (range) {
        resultDisplay.hidden = false;
        showRangeResult(resultDisplay, range);
      } else {
        resultDisplay.hidden = true;
      }
      updateSummary();
    };
  }

  function showRangeResult(el, range) {
    el.innerHTML = `
      <div class="range-num">${range.dist}</div>
      <div class="range-label-text ${range.cls}">${esc(range.label)}
        ${range.mod !== 0 ? ` <span style="font-weight:400;color:rgba(200,220,255,0.6);">(${range.mod} modifier)</span>` : ''}
      </div>
      ${range.cls === 'range-long' || range.cls === 'range-bomb'
        ? window.GameState?.currentWeather?.name === 'Blizzard'
          ? '<div style="color:#ff8fa0;font-size:0.7rem;margin-top:0.3rem;">⚠ Blizzard: this range is not allowed</div>'
          : ''
        : ''}
    `;
  }

  /* ─────────────────────────────────────────────────────
     STEP 4: MODIFIERS
     ──────────────────────────────────────────────────── */
  function renderMods(el) {
    el.innerHTML = '<div class="pwiz-step-title">Modifiers</div>';

    /* TZ counter */
    const tzRow = document.createElement('div');
    tzRow.className = 'pwiz-mod-row';
    tzRow.innerHTML = '<span class="input-label" style="margin:0;">Thrower Tackle Zones:</span>';

    const tzMinus = document.createElement('button');
    tzMinus.type = 'button'; tzMinus.className = 'tz-btn'; tzMinus.textContent = '−';
    const tzVal   = document.createElement('span');
    tzVal.className = 'tz-val'; tzVal.textContent = ws.tz;
    const tzPlus  = document.createElement('button');
    tzPlus.type = 'button'; tzPlus.className = 'tz-btn'; tzPlus.textContent = '+';

    tzMinus.addEventListener('click', () => { ws.tz = Math.max(0, ws.tz - 1); tzVal.textContent = ws.tz; refreshTarget(); });
    tzPlus.addEventListener('click',  () => { ws.tz = Math.min(6, ws.tz + 1); tzVal.textContent = ws.tz; refreshTarget(); });

    tzRow.appendChild(tzMinus);
    tzRow.appendChild(tzVal);
    tzRow.appendChild(tzPlus);
    el.appendChild(tzRow);

    /* Auto-detected skill chips */
    const weather = window.GameState?.currentWeather;
    const chips   = document.createElement('div');
    chips.className = 'pwiz-mod-row';
    chips.style.marginTop = '0.4rem';

    function chip(label, cls, title) {
      const c = document.createElement('span');
      c.className = `pwiz-skill-chip ${cls}`;
      c.textContent = label;
      if (title) c.title = title;
      return c;
    }

    if (ws.modAccurate && (ws.range?.cls === 'range-quick' || ws.range?.cls === 'range-short')) {
      chips.appendChild(chip('Accurate +1', 'pos', 'Accurate skill: +1 for Quick/Short passes'));
    }
    if (ws.modNerves) {
      chips.appendChild(chip('Nerves of Steel', 'pos', 'Ignore Tackle Zone penalties'));
    }
    if (weather && weather.effect && weather.effect !== 'No effect') {
      chips.appendChild(chip(`${weather.emoji} ${weather.name}`, 'neg', weather.effect));
    }
    if (ws.range?.cls === 'range-long' || ws.range?.cls === 'range-bomb') {
      chips.appendChild(chip(`${ws.range.shortLabel} (${ws.range.mod})`, 'neg', 'Range modifier'));
    }
    el.appendChild(chips);

    /* Live target display */
    const targetBar = document.createElement('div');
    targetBar.className = 'pwiz-target-bar';
    targetBar.id = 'pwiz-target-bar';
    el.appendChild(targetBar);
    refreshTarget();

    function refreshTarget() {
      const bar = document.getElementById('pwiz-target-bar');
      if (!bar) return;

      const rangeMod  = ws.range?.mod ?? 0;
      const tzMod     = ws.modNerves ? 0 : -ws.tz;
      const weatherMod = (weather && weather.effect && weather.effect !== 'No effect' && weather.name !== 'Blizzard') ? -1 : 0;
      const accurateMod = (ws.modAccurate && (ws.range?.cls === 'range-quick' || ws.range?.cls === 'range-short')) ? 1 : 0;
      const totalMod  = rangeMod + tzMod + weatherMod + accurateMod;

      let display;
      if (ws.paTarget === 99) {
        display = '—';
        bar.innerHTML = `<span class="pwiz-target-num">—</span><span class="pwiz-target-note"> No PA — always inaccurate (fumble on 1)</span>`;
      } else {
        const threshold = Math.min(6, Math.max(2, ws.paTarget - totalMod));
        bar.innerHTML = `
          <span class="pwiz-target-num">${threshold}+</span>
          <span class="pwiz-target-note"> on D6 (base PA${ws.paTarget}+, net modifier ${totalMod >= 0 ? '+' : ''}${totalMod})</span>
        `;
      }

      /* Cache computed values for step 6 */
      ws._totalMod  = totalMod;
    }
  }

  /* ─────────────────────────────────────────────────────
     STEP 5: INTERCEPT — player selection + target
     ──────────────────────────────────────────────────── */
  function renderIntercept(el) {
    el.innerHTML = `<div class="pwiz-step-title">Interception?</div>
      <p class="panel-intro" style="margin-bottom:0.5rem;">Is there an opposition player in the passing lane who could intercept?</p>`;

    /* Yes / No toggle */
    const togRow = document.createElement('div');
    togRow.style.cssText = 'display:flex;gap:0.4rem;margin-bottom:0.6rem;';

    const noBtn  = document.createElement('button');
    const yesBtn = document.createElement('button');
    noBtn.type = yesBtn.type = 'button';

    function setIntercept(val) {
      ws.intercept = val;
      noBtn.className  = `pass-nav-btn${!val ? ' nav-primary' : ''}`;
      yesBtn.className = `pass-nav-btn${val  ? ' nav-primary' : ''}`;
      rosterWrap.hidden = !val;
      if (!val) {
        ws.interceptor    = null;
        ws.interceptAG    = null;
        ws.interceptTarget = null;
      }
    }

    noBtn.textContent  = 'No interceptor';
    yesBtn.textContent = 'Yes — select player';
    noBtn.addEventListener('click',  () => setIntercept(false));
    yesBtn.addEventListener('click', () => setIntercept(true));
    togRow.appendChild(noBtn);
    togRow.appendChild(yesBtn);
    el.appendChild(togRow);

    /* Roster selector (opposing team) */
    const rosterWrap = document.createElement('div');
    rosterWrap.hidden = !ws.intercept;
    el.appendChild(rosterWrap);

    /* Opposing side = opposite of thrower's side */
    const oppSide = ws.throwerSide === 'left' ? 'right' : 'left';
    const oppLabel = oppSide === 'left' ? 'Home' : 'Away';

    const listTitle = document.createElement('div');
    listTitle.className = 'input-label';
    listTitle.style.marginBottom = '0.3rem';
    listTitle.textContent = `${oppLabel} team — tap interceptor:`;
    rosterWrap.appendChild(listTitle);

    buildListIn(rosterWrap, oppSide, p => !window.STATUS_META?.[p.status]?.dim, (p) => {
      ws.interceptor    = { ...p };
      ws.interceptorSide = oppSide;
      ws.interceptAG    = parseStat(p.statsText, 'AG') ?? 4;
      /* Intercept target: same AG-based check as catching */
      ws.interceptTarget = Math.min(6, Math.max(2, ws.interceptAG));
      showInterceptSummary();
    });

    const summaryEl = document.createElement('div');
    summaryEl.style.cssText = 'margin-top:0.5rem;';
    rosterWrap.appendChild(summaryEl);

    function showInterceptSummary() {
      if (!ws.interceptor) { summaryEl.innerHTML = ''; return; }
      summaryEl.innerHTML = `
        <div class="pwiz-target-bar" style="margin-top:0.4rem;">
          <span class="pwiz-target-num">${ws.interceptTarget}+</span>
          <span class="pwiz-target-note"> to intercept — ${esc(ws.interceptor.name)}, AG${ws.interceptAG}+</span>
        </div>
        <p class="panel-intro" style="font-size:0.68rem;margin-top:0.35rem;color:rgba(255,160,160,0.75);">On success: ball caught — Turnover!</p>
      `;
    }

    if (ws.interceptor) showInterceptSummary();

    /* Apply initial state */
    setIntercept(ws.intercept);
  }

  /* ─────────────────────────────────────────────────────
     PRE-PASS STRIP — horizontal roll summary
     ──────────────────────────────────────────────────── */
  function renderPrePassStrip(el) {
    const weather    = window.GameState?.currentWeather;
    const weatherMod = (weather && weather.effect && weather.effect !== 'No effect' && weather.name !== 'Blizzard') ? -1 : 0;
    const accurateMod = (ws.modAccurate && (ws.range?.cls === 'range-quick' || ws.range?.cls === 'range-short')) ? 1 : 0;
    const tzMod      = ws.modNerves ? 0 : -ws.tz;
    const totalMod   = (ws.range?.mod ?? 0) + tzMod + weatherMod + accurateMod;
    ws._totalMod     = totalMod; /* keep in sync */

    let throwStr;
    if (ws.paTarget === 99) {
      throwStr = '— (No PA)';
    } else {
      const thresh = Math.min(6, Math.max(2, ws.paTarget - totalMod));
      throwStr = `${thresh}+`;
    }

    const catchMod    = -ws.catcherTZ + ((weather?.name === 'Pouring Rain' || weather?.name === 'Blizzard') ? -1 : 0) + (ws.modCatch ? 1 : 0);
    const catchThresh = Math.min(6, Math.max(2, ws.catchAG - catchMod));
    const catchStr    = ws.catcher ? `${catchThresh}+` : '—';

    const strip = document.createElement('div');
    strip.className = 'prepass-strip';
    strip.innerHTML = `
      <span class="prepass-chip throw-chip">🎯 Throw ${throwStr}</span>
      ${ws.interceptor
        ? `<span class="prepass-arrow">→</span>
           <span class="prepass-chip int-chip">⚡ Intercept ${ws.interceptTarget}+ <span class="prepass-sub">${esc(ws.interceptor.name)}, AG${ws.interceptAG}</span></span>`
        : ''}
      <span class="prepass-arrow">→</span>
      <span class="prepass-chip catch-chip">🤲 Catch ${catchStr}</span>
    `;
    el.appendChild(strip);
  }

  /* ─────────────────────────────────────────────────────
     STEP 6: THROW ROLL
     ──────────────────────────────────────────────────── */
  function renderThrow(el) {
    el.innerHTML = `<div class="pwiz-step-title">Throw Roll</div>`;
    renderPrePassStrip(el);

    const mod        = ws._totalMod ?? 0;
    const paTarget   = ws.paTarget;
    const resultEl   = document.createElement('div');
    resultEl.className = 'roll-result';
    resultEl.hidden    = true;

    function processThrow(roll) {
      const modified = roll + mod;
      let outcome, title, cls, desc;

      if (paTarget === 99) {
        if (roll === 1) { outcome = 'fumble'; title = 'Fumble!'; cls = 'result-cas'; desc = "Natural 1 — ball hits the ground. Scatter from thrower's square. Turnover!"; }
        else { outcome = 'inaccurate'; title = 'Inaccurate (No PA)'; cls = 'result-ko'; desc = 'No Passing Ability — always inaccurate. Ball scatters 3× from target square.'; }
      } else if (roll === 1) {
        outcome = 'fumble'; title = 'Fumble!'; cls = 'result-cas'; desc = "Natural 1 — the ball is fumbled. Scatter from thrower's square. Turnover!";
      } else if (modified >= paTarget) {
        outcome = 'accurate'; title = 'Accurate Pass!'; cls = 'result-ok';
        desc = `Roll ${roll}${mod !== 0 ? ` (→ ${modified})` : ''} vs PA${paTarget}+ — ball lands on target.`;
      } else {
        outcome = 'inaccurate'; title = 'Inaccurate Pass'; cls = 'result-ko';
        desc = `Roll ${roll}${mod !== 0 ? ` (→ ${modified})` : ''} vs PA${paTarget}+ — ball scatters 3× from target square.`;
      }

      ws.passResult    = outcome;
      ws.scatterDirs   = [];
      ws.catchResult   = null;

      resultEl.innerHTML = `
        <div class="result-roll-num">${roll}${mod !== 0 ? `<span style="font-size:1rem;font-weight:600;"> (→${modified})</span>` : ''}</div>
        <div class="result-name ${cls}">${esc(title)}</div>
        <p class="result-desc">${esc(desc)}</p>
      `;
      resultEl.hidden = false;
      updateSummary();

      /* Auto-advance after short delay */
      setTimeout(() => {
        if (outcome === 'accurate')   go(8);
        if (outcome === 'inaccurate') go(7);
        /* fumble: stay on step 6 */
      }, 900);
    }

    const isPhys = wizardMode('pass') === 'physical';

    if (!isPhys) {
      /* Digital: animated D6 */
      const dieEl = document.createElement('div');
      dieEl.className = 'die';
      dieEl.id        = 'pwiz-throw-d1';
      dieEl.dataset.value = '1';
      dieEl.innerHTML = '<div class="die-face"></div>';
      const tray = document.createElement('div');
      tray.className = 'dice-tray single';
      tray.appendChild(dieEl);
      el.appendChild(tray);

      Dice.initAllDice(); /* ensure pip rendering is initialised */
      if (typeof Dice.setDieValue === 'function') Dice.setDieValue(dieEl, 1);

      const rollBtn = document.createElement('button');
      rollBtn.type = 'button';
      rollBtn.className = 'roll-btn';
      rollBtn.innerHTML = '<span class="roll-btn-icon">🎲</span> Roll Pass';
      rollBtn.addEventListener('click', async () => {
        rollBtn.disabled = true;
        resultEl.hidden  = true;
        const roll = await Dice.rollDieElement(dieEl);
        processThrow(roll);
      });
      el.appendChild(rollBtn);
    } else {
      /* Physical: 6 labelled buttons */
      const physZone = document.createElement('div');
      physZone.className = 'physical-zone';
      const mod2 = ws._totalMod ?? 0;

      window.PhysicalDice.showPhysicalButtons(physZone, {
        columns: 3,
        buttons: Array.from({ length: 6 }, (_, i) => {
          const roll = i + 1;
          const mod2 = ws._totalMod ?? 0;
          const modified = roll + mod2;
          let label, cls;
          if (paTarget === 99) {
            if (roll === 1) { label = 'Fumble!'; cls = 'phys-bad'; }
            else            { label = 'Inaccurate'; cls = 'phys-warn'; }
          } else if (roll === 1) {
            label = 'Fumble!'; cls = 'phys-bad';
          } else if (modified >= paTarget) {
            label = 'Accurate!'; cls = 'phys-good';
          } else {
            label = 'Inaccurate'; cls = 'phys-warn';
          }
          return { value: roll, label, cls };
        }),
        onSelect(roll) { processThrow(roll); },
      });
      el.appendChild(physZone);
    }

    el.appendChild(resultEl);
  }

  /* ─────────────────────────────────────────────────────
     STEP 7: SCATTER (3× D8, 1 sq each)
     ──────────────────────────────────────────────────── */
  function renderScatter(el) {
    el.innerHTML = `<div class="pwiz-step-title">Scatter ×3</div>
      <p class="panel-intro" style="margin-bottom:0.5rem;">Ball scatters 1 square in a random direction, 3 times from the target square.</p>`;

    ws.scatterDirs = [];

    const DIR_LABELS = { 1:'↖',2:'↑',3:'↗',4:'←',5:'→',6:'↙',7:'↓',8:'↘' };
    const DIR_NAMES  = { 1:'Up-Left',2:'Up',3:'Up-Right',4:'Left',5:'Right',6:'Down-Left',7:'Down',8:'Down-Right' };
    const resultsEl  = document.createElement('div');
    const isPhys     = wizardMode('pass') === 'physical';

    /* Grid container — reuse ws.pitchGrid if available */
    const gridWrap = document.createElement('div');
    gridWrap.style.marginTop = '0.6rem';
    const gridLabel = document.createElement('div');
    gridLabel.className = 'input-label';
    gridLabel.textContent = 'Ball location:';
    gridLabel.style.marginBottom = '0.25rem';

    /* Scatter target: active catcher's grid position */
    const activeCatcher = ws.pitchGrid?.getActiveCatcher?.() ?? null;

    function updateScatterGrid() {
      if (!ws.pitchGrid || !activeCatcher) return;
      ws.pitchGrid.showScatterPath(activeCatcher, ws.scatterDirs);
    }

    function addScatterResult(dir) {
      ws.scatterDirs.push(dir);
      const row = document.createElement('div');
      row.style.cssText = 'font-family:JetBrains Mono,monospace;font-size:0.85rem;margin:0.2rem 0;color:rgba(200,220,255,0.8);';
      row.textContent = `${ws.scatterDirs.length}. ${DIR_LABELS[dir]} ${DIR_NAMES[dir]}`;
      resultsEl.appendChild(row);

      updateScatterGrid();

      if (ws.scatterDirs.length >= 3) {
        setTimeout(() => go(8), 700);
      } else {
        buildNextScatter();
      }
    }

    function buildNextScatter() {
      const n = ws.scatterDirs.length + 1;
      const sectionEl = document.createElement('div');
      sectionEl.style.marginTop = '0.5rem';

      if (isPhys) {
        const label = document.createElement('div');
        label.className   = 'input-label';
        label.textContent = `Scatter ${n}: direction (D8)`;
        label.style.marginBottom = '0.25rem';
        sectionEl.appendChild(label);
        const compZone = document.createElement('div');
        sectionEl.appendChild(compZone);
        window.PhysicalDice.showCompassButtons(compZone, dir => {
          sectionEl.remove();
          addScatterResult(dir);
        });
      } else {
        const dieEl = document.createElement('div');
        dieEl.className = 'die';
        dieEl.id        = `pwiz-scatter-d${n}`;
        dieEl.dataset.value = '1';
        dieEl.dataset.sides = '8';
        dieEl.innerHTML = '<div class="die-face d8-face"></div>';
        const tray = document.createElement('div');
        tray.className = 'dice-tray single';
        tray.appendChild(dieEl);

        const btn = document.createElement('button');
        btn.type      = 'button';
        btn.className = 'roll-btn';
        btn.innerHTML = `<span class="roll-btn-icon">🎲</span> Scatter ${n}`;

        btn.addEventListener('click', async () => {
          btn.disabled = true;
          const dir = await Dice.rollDieElement(dieEl);
          sectionEl.remove();
          addScatterResult(dir);
        });

        sectionEl.appendChild(tray);
        sectionEl.appendChild(btn);
      }

      el.appendChild(sectionEl);
    }

    el.appendChild(resultsEl);

    /* Show pitch grid if we have one with an active catcher */
    if (ws.pitchGrid && activeCatcher) {
      gridWrap.appendChild(gridLabel);
      /* Build grid into a fresh container inside gridWrap */
      const innerContainer = document.createElement('div');
      gridWrap.appendChild(innerContainer);
      ws.pitchGrid.container = innerContainer;
      ws.pitchGrid.clearScatter?.();
      ws.pitchGrid._build();
      ws.pitchGrid.onCatcherSelect = null; /* read-only in scatter view */
      el.appendChild(gridWrap);
      updateScatterGrid();
    }

    buildNextScatter();
  }

  /* ─────────────────────────────────────────────────────
     STEP 8: CATCH ROLL
     ──────────────────────────────────────────────────── */
  function renderCatch(el) {
    el.innerHTML = `<div class="pwiz-step-title">Catch Roll</div>`;

    const weather      = window.GameState?.currentWeather;
    const weatherMod   = (weather?.name === 'Pouring Rain' || weather?.name === 'Blizzard') ? -1 : 0;
    const catchSkillM  = ws.modCatch ? 1 : 0;

    /* Catcher TZ counter */
    const tzRow = document.createElement('div');
    tzRow.className = 'pwiz-mod-row';
    tzRow.innerHTML = `<span class="input-label" style="margin:0;">Catcher Tackle Zones:</span>`;
    const tzMinus = document.createElement('button'); tzMinus.type = 'button'; tzMinus.className = 'tz-btn'; tzMinus.textContent = '−';
    const tzVal   = document.createElement('span');   tzVal.className = 'tz-val'; tzVal.textContent = ws.catcherTZ;
    const tzPlus  = document.createElement('button'); tzPlus.type = 'button'; tzPlus.className = 'tz-btn'; tzPlus.textContent = '+';

    function getTotalCatchMod() {
      return -ws.catcherTZ + weatherMod + catchSkillM;
    }

    tzMinus.addEventListener('click', () => { ws.catcherTZ = Math.max(0, ws.catcherTZ - 1); tzVal.textContent = ws.catcherTZ; refreshCatchTarget(); });
    tzPlus.addEventListener('click',  () => { ws.catcherTZ = Math.min(6, ws.catcherTZ + 1); tzVal.textContent = ws.catcherTZ; refreshCatchTarget(); });
    tzRow.appendChild(tzMinus); tzRow.appendChild(tzVal); tzRow.appendChild(tzPlus);
    el.appendChild(tzRow);

    /* Skill chips */
    if (ws.modCatch || weatherMod !== 0) {
      const chips = document.createElement('div');
      chips.className = 'pwiz-mod-row';
      chips.style.marginTop = '0.3rem';
      if (ws.modCatch) chips.innerHTML += `<span class="pwiz-skill-chip pos">Catch +1</span>`;
      if (weatherMod)  chips.innerHTML += `<span class="pwiz-skill-chip neg">${weather.emoji} ${weather.name} −1</span>`;
      el.appendChild(chips);
    }

    /* Target display */
    const targetBar = document.createElement('div');
    targetBar.className = 'pwiz-target-bar';
    targetBar.id = 'pwiz-catch-target';
    el.appendChild(targetBar);

    function refreshCatchTarget() {
      const bar = document.getElementById('pwiz-catch-target');
      if (!bar) return;
      const mod = getTotalCatchMod();
      const threshold = Math.min(6, Math.max(2, ws.catchAG - mod));
      bar.innerHTML = `<span class="pwiz-target-num">${threshold}+</span><span class="pwiz-target-note"> AG${ws.catchAG}+, net ${mod >= 0 ? '+' : ''}${mod}</span>`;
    }
    refreshCatchTarget();

    const resultEl = document.createElement('div');
    resultEl.className = 'roll-result';
    resultEl.hidden    = true;

    function processCatch(roll) {
      const mod      = getTotalCatchMod();
      const modified = roll + mod;
      let title, cls, desc;

      if (roll === 1) {
        title = 'Dropped!'; cls = 'result-cas';
        desc  = 'Natural 1 — always drops. Ball scatters 1 square. Turnover!';
      } else if (modified >= ws.catchAG) {
        title = 'Caught!'; cls = 'result-ok';
        desc  = `Roll ${roll}${mod !== 0 ? ` (→ ${modified})` : ''} vs AG${ws.catchAG}+ — the ball is caught!`;
      } else {
        title = 'Dropped!'; cls = 'result-ko';
        desc  = `Roll ${roll}${mod !== 0 ? ` (→ ${modified})` : ''} vs AG${ws.catchAG}+ — ball hits the ground, scatters 1 square.`;
      }

      ws.catchResult = title === 'Caught!' ? 'caught' : 'dropped';
      resultEl.innerHTML = `<div class="result-roll-num">${roll}${mod !== 0 ? `<span style="font-size:1rem;font-weight:600;"> (→${modified})</span>` : ''}</div><div class="result-name ${cls}">${esc(title)}</div><p class="result-desc">${esc(desc)}</p>`;
      resultEl.hidden = false;
      updateSummary();
    }

    const isPhys = wizardMode('pass') === 'physical';

    if (!isPhys) {
      const dieEl = document.createElement('div');
      dieEl.className = 'die';
      dieEl.id        = 'pwiz-catch-d1';
      dieEl.dataset.value = '1';
      dieEl.innerHTML = '<div class="die-face"></div>';
      const tray = document.createElement('div');
      tray.className = 'dice-tray single';
      tray.appendChild(dieEl);
      if (typeof Dice.setDieValue === 'function') Dice.setDieValue(dieEl, 1);

      const rollBtn = document.createElement('button');
      rollBtn.type      = 'button';
      rollBtn.className = 'roll-btn';
      rollBtn.innerHTML = '<span class="roll-btn-icon">🎲</span> Roll Catch';
      rollBtn.addEventListener('click', async () => {
        rollBtn.disabled = true;
        resultEl.hidden  = true;
        const roll = await Dice.rollDieElement(dieEl);
        processCatch(roll);
      });

      el.appendChild(tray);
      el.appendChild(rollBtn);
    } else {
      const physZone = document.createElement('div');
      physZone.className = 'physical-zone';

      function buildCatchPhysButtons() {
        const mod = getTotalCatchMod();
        return Array.from({ length: 6 }, (_, i) => {
          const roll     = i + 1;
          const modified = roll + mod;
          let label, cls;
          if (roll === 1)            { label = 'Dropped!'; cls = 'phys-bad'; }
          else if (modified >= ws.catchAG) { label = 'Caught!';  cls = 'phys-good'; }
          else                       { label = 'Dropped!'; cls = 'phys-warn'; }
          return { value: roll, label, cls };
        });
      }

      window.PhysicalDice.showPhysicalButtons(physZone, {
        columns: 3,
        buttons: buildCatchPhysButtons(),
        onSelect(roll) { processCatch(roll); },
      });
      el.appendChild(physZone);
    }

    el.appendChild(resultEl);
  }

  /* ── Boot ── */
  buildShell();
  render();

  /* Re-initialize when panel opens */
  onPanelOpen('panel-pass', () => {
    /* Reset state for a fresh pass */
    ws.step            = 1;
    ws.passResult      = null;
    ws.catchResult     = null;
    ws.scatterDirs     = [];
    ws.intercept       = false;
    ws.interceptor     = null;
    ws.interceptAG     = null;
    ws.interceptTarget = null;
    if (ws.pitchGrid) ws.pitchGrid.clearScatter?.();
    buildShell();
    render();
    window.Panels?.refreshWeatherChips?.();
  });

  /* Dice mode toggle */
  panel.addEventListener('bb:diceMode', () => render());
}


/* ════════════════════════════════════════════════════════
   FOUL WIZARD
   ════════════════════════════════════════════════════════ */

function initFoulWizard() {
  const panel   = document.getElementById('panel-foul');
  const rollBtn = document.getElementById('foul-roll-btn');
  if (!rollBtn) return;

  let selectedAV = 8;
  let assists    = 0;
  const mods     = { 'dirty-player': false, stunty: false };

  function setFoulAV(av) {
    const clamped = Math.max(5, Math.min(10, av));
    let best = null, bestDiff = Infinity;
    document.querySelectorAll('#foul-av-picker .av-btn').forEach(b => {
      const d = Math.abs(parseInt(b.dataset.av, 10) - clamped);
      if (d < bestDiff) { bestDiff = d; best = b; }
    });
    if (best) {
      document.querySelectorAll('#foul-av-picker .av-btn').forEach(b => b.classList.remove('active'));
      best.classList.add('active');
      selectedAV = parseInt(best.dataset.av, 10);
    }
    if (wizardMode('foul') === 'physical') buildFoulPhysUI();
  }

  document.getElementById('foul-av-picker')?.addEventListener('click', e => {
    const btn = e.target.closest('.av-btn');
    if (!btn) return;
    document.querySelectorAll('#foul-av-picker .av-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedAV = parseInt(btn.dataset.av, 10);
    if (wizardMode('foul') === 'physical') buildFoulPhysUI();
  });

  initFoulPlayerSelect(setFoulAV);
  bindStepper(document.getElementById('foul-assists'), 0, 11, v => { assists = v; if (wizardMode('foul') === 'physical') buildFoulPhysUI(); });

  document.getElementById('foul-mod-dp')?.addEventListener('click', e => {
    mods['dirty-player'] = !mods['dirty-player'];
    e.currentTarget.classList.toggle('active', mods['dirty-player']);
    if (wizardMode('foul') === 'physical') buildFoulPhysUI();
  });
  document.getElementById('foul-mod-stunty')?.addEventListener('click', e => {
    mods.stunty = !mods.stunty;
    e.currentTarget.classList.toggle('active', mods.stunty);
  });

  const d1El       = document.getElementById('foul-d1');
  const d2El       = document.getElementById('foul-d2');
  const avResEl    = document.getElementById('foul-av-result');
  const refResEl   = document.getElementById('foul-ref-result');
  const injSection = document.getElementById('foul-injury-section');
  const diceTray   = document.getElementById('foul-dice-tray');

  const physZone   = ensurePhysZone(diceTray, 'foul-phys');

  function bonus() { return assists + (mods['dirty-player'] ? 1 : 0); }

  /* phys=true → no doubles check, no per-die breakdown */
  function processFoulArmourRoll(d1, d2, total, phys = false) {
    const bon        = bonus();
    const modded     = total + bon;
    const isDoubles  = !phys && d1 !== null && d1 === d2;
    const bonusNote  = bon > 0 ? ` + ${bon} (assists${mods['dirty-player'] ? ' + Dirty Player' : ''})` : '';
    const doubleFlag = isDoubles ? `<div class="result-effect">⚠️ Natural Double — referee may have spotted it!</div>` : '';
    const breakdown  = phys
      ? `<div class="result-roll-breakdown">Physical roll vs AV${selectedAV}+</div>`
      : `<div class="result-roll-breakdown">${d1} + ${d2}${bonusNote} vs AV${selectedAV}+</div>`;

    if (modded < selectedAV) {
      avResEl.innerHTML = `
        <div class="result-roll-num">${total}${bon ? ` (+${bon})` : ''}</div>
        ${breakdown}
        ${doubleFlag}
        <div class="result-name" style="color:var(--bb-gold,#D4AF37);">Armour Holds</div>
        <p class="result-desc">Total ${modded} is below AV ${selectedAV}+. No injury from the foul.</p>
      `;
      avResEl.hidden = false;
    } else {
      avResEl.innerHTML = `
        <div class="result-roll-num">${total}${bon ? ` (+${bon})` : ''}</div>
        ${breakdown}
        ${doubleFlag}
        <div class="result-name" style="color:var(--bb-red,#C8102E);">Armour Broken!</div>
        <p class="result-desc">Rolling Injury table…</p>
      `;
      avResEl.hidden = false;
    }

    if (isDoubles && refResEl) {
      refResEl.innerHTML = `
        <div class="result-name" style="color:#FF8C00;">⚠️ Referee Spots the Foul!</div>
        <p class="result-desc">A natural double — the fouling player is Sent Off! <strong>Argue the Call</strong>: D6 — on 6 player stays; on 1 Head Coach ejected; 2–5 call stands. A <em>Bribe</em> avoids ejection entirely (2+ succeeds).</p>
      `;
      refResEl.hidden = false;
    } else if (refResEl) {
      refResEl.hidden = true;
    }

    return modded >= selectedAV;
  }

  async function doFoulRoll() {
    rollBtn.disabled = true;
    avResEl.hidden   = true;
    if (refResEl)   refResEl.hidden   = true;
    if (injSection) injSection.hidden = true;

    const { d1, d2, total } = await Dice.roll2D6(d1El, d2El);
    const broke = processFoulArmourRoll(d1, d2, total);

    if (broke) {
      await pause(450);
      if (injSection) injSection.hidden = false;
      const injD1 = document.getElementById('foul-inj-d1');
      const injD2 = document.getElementById('foul-inj-d2');
      const { d1: i1, d2: i2, total: injTotal } = await Dice.roll2D6(injD1, injD2);
      const bon      = bonus();
      const injModded = Math.min(12, injTotal + bon);
      const injTable  = mods.stunty ? window.BBData?.injury?.stunty : window.BBData?.injury?.injury;
      const inj = rangeFind(injTable, injModded) ?? { result: 'Unknown', 'class': '', desc: '' };
      const injResEl = document.getElementById('foul-inj-result');
      if (injResEl) {
        injResEl.innerHTML = `
          <div class="result-roll-num">${injTotal}${bon ? ` (+${bon})` : ''}</div>
          <div class="result-roll-breakdown">${i1} + ${i2} — Injury table${mods.stunty ? ' (Stunty)' : ''}</div>
          <div class="result-name ${inj['class']}">${esc(inj.result)}</div>
          <p class="result-desc">${esc(inj.desc)}</p>
        `;
        injResEl.hidden = false;
      }

      if (inj.result === 'Casualty!') {
        await pause(500);
        const casTray  = document.getElementById('foul-cas-tray');
        const casD1    = document.getElementById('foul-cas-d1');
        const casResEl = document.getElementById('foul-cas-result');
        if (casTray) casTray.hidden = false;
        if (casResEl) { casResEl.innerHTML = `<p class="result-desc" style="margin:0">Rolling Casualty table (D16)…</p>`; casResEl.hidden = false; }
        await pause(300);
        const casVal = await Dice.rollDieElement(casD1);
        const cas    = rangeFind(window.BBData?.injury?.casualty, casVal) ?? { result: 'Unknown', 'class': '', desc: '' };
        if (casResEl) {
          casResEl.innerHTML = `
            <div class="result-roll-num">${casVal}</div>
            <div class="result-roll-breakdown">Casualty Table (D16)</div>
            <div class="result-name ${cas['class']}">${esc(cas.result)}</div>
            <p class="result-desc">${esc(cas.desc)}</p>
          `;
        }
      }
    }

    rollBtn.disabled = false;
  }

  /* ── Physical foul armour buttons ── */
  function buildFoulPhysUI() {
    const bon = bonus();
    window.PhysicalDice.showPhysicalButtons(physZone, {
      buttons: Array.from({ length: 11 }, (_, i) => {
        const total  = i + 2;
        const modded = total + bon;
        const breaks = modded >= selectedAV;
        return { value: total, label: breaks ? `Breaks! (${modded})` : `Holds (${modded})`, cls: breaks ? 'phys-bad' : 'phys-muted' };
      }),
      columns: 4,
      onSelect(total) {
        avResEl.hidden = true;
        if (refResEl)   refResEl.hidden   = true;
        if (injSection) injSection.hidden = true;
        /* For physical mode doubles detection is not possible — skip referee check */
        const broke = processFoulArmourRoll(null, null, total, true);
        if (!broke) return;
        /* Auto-show injury physical buttons */
        if (injSection) injSection.hidden = false;
        buildFoulInjPhysUI();
      },
    });
    physZone.hidden = false;
  }

  function buildFoulInjPhysUI() {
    const bon = bonus();
    const injPhysZone = ensurePhysZone(document.getElementById('foul-inj-result') ?? injSection, 'foul-inj-phys');
    const CLS = { 'result-ok': 'phys-neutral', 'result-ko': 'phys-warn', 'result-cas': 'phys-bad' };
    window.PhysicalDice.showPhysicalButtons(injPhysZone, {
      buttons: Array.from({ length: 11 }, (_, i) => {
        const roll   = i + 2;
        const modded = Math.min(12, roll + bon);
        const table  = mods.stunty ? window.BBData?.injury?.stunty : window.BBData?.injury?.injury;
        const entry  = rangeFind(table, modded);
        return { value: roll, label: entry?.result ?? '?', cls: CLS[entry?.['class']] ?? 'phys-neutral' };
      }),
      columns: 4,
      onSelect(roll) {
        const bon2    = bonus();
        const modded  = Math.min(12, roll + bon2);
        const table   = mods.stunty ? window.BBData?.injury?.stunty : window.BBData?.injury?.injury;
        const inj     = rangeFind(table, modded) ?? { result: 'Unknown', 'class': '', desc: '' };
        const injResEl = document.getElementById('foul-inj-result');
        if (injResEl) {
          injResEl.innerHTML = `
            <div class="result-roll-num">${roll}${bon2 ? ` (+${bon2})` : ''}</div>
            <div class="result-roll-breakdown">Physical — Injury table${mods.stunty ? ' (Stunty)' : ''}</div>
            <div class="result-name ${inj['class']}">${esc(inj.result)}</div>
            <p class="result-desc">${esc(inj.desc)}</p>
          `;
          injResEl.hidden = false;
        }
        if (inj.result === 'Casualty!') {
          const casTray  = document.getElementById('foul-cas-tray');
          const casResEl = document.getElementById('foul-cas-result');
          if (casTray) casTray.hidden = false;
          buildFoulCasPhysUI(casTray);
          if (casResEl) casResEl.hidden = true;
        }
      },
    });
    injPhysZone.hidden = false;
  }

  function buildFoulCasPhysUI(afterEl) {
    const casPhysZone = ensurePhysZone(afterEl ?? injSection, 'foul-cas-phys');
    const CLS = { 'result-ok': 'phys-neutral', 'result-ko': 'phys-warn', 'result-cas': 'phys-bad' };
    window.PhysicalDice.showPhysicalButtons(casPhysZone, {
      buttons: Array.from({ length: 16 }, (_, i) => {
        const val   = i + 1;
        const entry = rangeFind(window.BBData?.injury?.casualty, val);
        return { value: val, label: entry?.result ?? '?', cls: CLS[entry?.['class']] ?? 'phys-neutral' };
      }),
      columns: 4,
      onSelect(val) {
        const cas    = rangeFind(window.BBData?.injury?.casualty, val) ?? { result: 'Unknown', 'class': '', desc: '' };
        const casResEl = document.getElementById('foul-cas-result');
        if (casResEl) {
          casResEl.innerHTML = `
            <div class="result-roll-num">${val}</div>
            <div class="result-roll-breakdown">Physical — Casualty Table (D16)</div>
            <div class="result-name ${cas['class']}">${esc(cas.result)}</div>
            <p class="result-desc">${esc(cas.desc)}</p>
          `;
          casResEl.hidden = false;
        }
      },
    });
    casPhysZone.hidden = false;
  }

  function showPhys() {
    diceTray.hidden  = true;
    rollBtn.hidden   = true;
    avResEl.hidden   = true;
    if (refResEl)   refResEl.hidden   = true;
    if (injSection) injSection.hidden = true;
    buildFoulPhysUI();
  }

  function showDigital() {
    physZone.hidden  = true;
    diceTray.hidden  = false;
    rollBtn.hidden   = false;
  }

  panel?.addEventListener('bb:diceMode', e => e.detail.mode === 'physical' ? showPhys() : showDigital());
  rollBtn.addEventListener('click', doFoulRoll);

  if (wizardMode('foul') === 'physical') showPhys();
}

/* ════════════════════════════════════════════════════════
   THROW TEAM-MATE WIZARD  (Sprint 4 rebuild — 8-step)
   ════════════════════════════════════════════════════════ */

function initThrowWizard() {
  const panel = document.getElementById('panel-throw');
  if (!panel) return;

  /* ── Wizard state ── */
  const ws = {
    step: 1,
    thrower:     null,
    thrown:      null,
    throwerSide: 'left',
    thrownSide:  'left',
    /* Auto-detected thrower traits */
    hasAlwaysHungry: false,
    hasStrongArm:    false,
    hasHailMary:     false,
    hasBullseye:     false,
    /* Auto-detected thrown-player traits */
    hasLandingSkill: false,
    thrownAV:        8,
    thrownAG:        4,
    /* Options (step 3) */
    rangeTarget:  4,    /* 4 = Short (4+), 5 = Long (5+) */
    useHailMary:  false,
    strongArmMod: 0,    /* +1 if Strong Arm */
    landingTZ:    0,    /* tackle zones around landing square */
    /* Results */
    hungryResult: null,   /* 'ok' | 'eaten' */
    throwResult:  null,   /* 'superb'|'accurate'|'inaccurate'|'fumble' */
    scatterDirs:  [],
    landingResult: null,  /* 'safe' | 'crash' */
  };

  const body = panel.querySelector('.panel-body');

  /* ── Shell builder ── */
  function buildShell() {
    body.innerHTML = '';
    const sumEl = document.createElement('div');
    sumEl.className = 'pass-summary-strip'; sumEl.id = 'twiz-summary';
    body.appendChild(sumEl);
    const indEl = document.createElement('div');
    indEl.className = 'pass-step-indicator'; indEl.id = 'twiz-ind';
    body.appendChild(indEl);
    const contentEl = document.createElement('div');
    contentEl.id = 'twiz-content';
    body.appendChild(contentEl);
    const navEl = document.createElement('div');
    navEl.className = 'pass-nav';
    navEl.innerHTML = `<button class="pass-nav-btn" id="twiz-back">← Back</button><button class="pass-nav-btn nav-primary" id="twiz-next">Next →</button>`;
    body.appendChild(navEl);
    document.getElementById('twiz-back').addEventListener('click', () => go(ws.step - 1));
    document.getElementById('twiz-next').addEventListener('click', () => go(ws.step + 1));
  }

  /* ── Step definitions ── */
  const ALL_STEPS = [
    { id: 1, label: 'Thrower'  },
    { id: 2, label: 'Thrown'   },
    { id: 3, label: 'Range'    },
    { id: 4, label: '🍖 Hungry' },
    { id: 5, label: 'Throw'    },
    { id: 6, label: 'Scatter'  },
    { id: 7, label: 'Land'     },
    { id: 8, label: 'Armour'   },
  ];

  /* Which steps are active given current state */
  function activeSteps() {
    const s = [1, 2, 3];
    if (ws.hasAlwaysHungry)                                          s.push(4);
    if (ws.hungryResult !== 'eaten')                                 s.push(5);
    if (ws.throwResult === 'inaccurate')                             s.push(6);
    const skipLanding = !ws.throwResult || ws.throwResult === 'fumble'
      || (ws.throwResult === 'superb' && ws.hasBullseye);
    if (!skipLanding)                                                s.push(7);
    if (ws.landingResult === 'crash')                                s.push(8);
    return s;
  }

  function go(n) {
    const active = activeSteps();
    let t = n;
    const dir = n > ws.step ? 1 : -1;
    while (t > 1 && t <= 8 && !active.includes(t)) t += dir;
    ws.step = Math.max(active[0], Math.min(active[active.length - 1], t));
    render();
  }

  /* ── Render ── */
  function render() {
    const active = activeSteps();

    /* Step indicator */
    const indEl = document.getElementById('twiz-ind');
    if (indEl) {
      indEl.innerHTML = '';
      ALL_STEPS.filter(s => active.includes(s.id)).forEach(s => {
        const pip = document.createElement('div');
        pip.className = 'pass-step-pip';
        pip.textContent = s.label;
        if (s.id < ws.step)  pip.classList.add('pip-done');
        if (s.id === ws.step) pip.classList.add('pip-current');
        indEl.appendChild(pip);
      });
    }

    /* Nav */
    const backBtn = document.getElementById('twiz-back');
    const nextBtn = document.getElementById('twiz-next');
    const lastStep = active[active.length - 1];
    if (backBtn) backBtn.disabled = ws.step === active[0];
    if (nextBtn) {
      nextBtn.textContent = ws.step === lastStep ? 'Done ✓' : 'Next →';
      nextBtn.disabled = ws.step === lastStep;
    }

    const contentEl = document.getElementById('twiz-content');
    if (!contentEl) return;
    contentEl.innerHTML = '';

    switch (ws.step) {
      case 1: renderThrower(contentEl); break;
      case 2: renderThrown(contentEl);  break;
      case 3: renderRange(contentEl);   break;
      case 4: renderHungry(contentEl);  break;
      case 5: renderThrow(contentEl);   break;
      case 6: renderScatter(contentEl); break;
      case 7: renderLanding(contentEl); break;
      case 8: renderArmour(contentEl);  break;
    }
    updateSummary();
  }

  /* ── Summary strip ── */
  function updateSummary() {
    const el = document.getElementById('twiz-summary');
    if (!el) return;
    const thrName  = ws.thrower?.name ?? '—';
    const thnName  = ws.thrown?.name  ?? '—';
    const rng      = ws.rangeTarget === 4 ? 'Short' : 'Long';
    const res      = ws.throwResult ?? (ws.hungryResult === 'eaten' ? '🍖 Eaten!' : '—');
    const resCls   = ws.throwResult === 'superb' || ws.throwResult === 'accurate' ? 'ok'
                   : (ws.throwResult === 'fumble' || ws.hungryResult === 'eaten') ? 'bad' : '';
    el.innerHTML = `
      <span class="pass-sum-name">${esc(thrName)}</span>
      <span class="pass-sum-sep">⇒</span>
      <span class="pass-sum-name">${esc(thnName)}</span>
      <span class="pass-sum-sep">|</span>
      <span class="pass-sum-range">${rng} (${ws.rangeTarget}+)</span>
      <span class="pass-sum-sep">|</span>
      <span class="pass-sum-result ${resCls}">${esc(res)}</span>
    `;
  }

  /* ─────────────────────────────────────────────────────
     STEP 1: THROWER — must have Throw Team-Mate trait
     ──────────────────────────────────────────────────── */
  function renderThrower(el) {
    el.innerHTML = '<div class="pwiz-step-title">Select Thrower</div>';
    const note = document.createElement('p');
    note.className = 'panel-intro';
    note.style.marginBottom = '0.4rem';
    note.textContent = 'Only players with the Throw Team-Mate trait can throw a team-mate.';
    el.appendChild(note);

    buildRosterTabs(el, {
      initialSide: ws.throwerSide,
      filterFn: p => hasSkill(p, 'Throw Team-Mate') && !window.STATUS_META?.[p.status]?.dim,
      onSelect(p, _stats, side) {
        ws.thrower     = p;
        ws.throwerSide = side;
        ws.hasAlwaysHungry = hasSkill(p, 'Always Hungry');
        ws.hasStrongArm    = hasSkill(p, 'Strong Arm');
        ws.hasHailMary     = hasSkill(p, 'Hail Mary Pass');
        ws.hasBullseye     = hasSkill(p, 'Bullseye');
        ws.strongArmMod    = ws.hasStrongArm ? 1 : 0;
        updateSummary();

        /* Show detected traits inline */
        let existing = el.querySelector('.twiz-skill-chips');
        if (existing) existing.remove();
        const chips = document.createElement('div');
        chips.className = 'pwiz-mod-row twiz-skill-chips';
        chips.style.marginTop = '0.5rem';
        if (ws.hasAlwaysHungry) chips.innerHTML += `<span class="pwiz-skill-chip neg">🍖 Always Hungry</span>`;
        if (ws.hasStrongArm)    chips.innerHTML += `<span class="pwiz-skill-chip pos">💪 Strong Arm +1</span>`;
        if (ws.hasHailMary)     chips.innerHTML += `<span class="pwiz-skill-chip pos">Hail Mary Pass</span>`;
        if (ws.hasBullseye)     chips.innerHTML += `<span class="pwiz-skill-chip pos">🎯 Bullseye</span>`;
        if (chips.innerHTML) el.appendChild(chips);
      },
    });
  }

  /* ─────────────────────────────────────────────────────
     STEP 2: THROWN PLAYER — must have Right Stuff trait
     ──────────────────────────────────────────────────── */
  function renderThrown(el) {
    el.innerHTML = '<div class="pwiz-step-title">Select Thrown Player</div>';
    const note = document.createElement('p');
    note.className = 'panel-intro';
    note.style.marginBottom = '0.4rem';
    note.textContent = 'Only players with the Right Stuff trait can be thrown. Usually Stunty players.';
    el.appendChild(note);

    buildRosterTabs(el, {
      initialSide: ws.thrownSide,
      filterFn: p => hasSkill(p, 'Right Stuff') && !window.STATUS_META?.[p.status]?.dim,
      onSelect(p, stats, side) {
        ws.thrown      = p;
        ws.thrownSide  = side;
        ws.thrownAV    = parseStat(p.statsText, 'AV') ?? 8;
        ws.thrownAG    = parseStat(p.statsText, 'AG') ?? 4;
        ws.hasLandingSkill = hasSkill(p, 'Landing');
        updateSummary();

        let existing = el.querySelector('.twiz-skill-chips');
        if (existing) existing.remove();
        const chips = document.createElement('div');
        chips.className = 'pwiz-mod-row twiz-skill-chips';
        chips.style.marginTop = '0.5rem';
        chips.innerHTML += `<span class="pwiz-skill-chip">AV${ws.thrownAV}+</span>`;
        chips.innerHTML += `<span class="pwiz-skill-chip">AG${ws.thrownAG}+</span>`;
        if (ws.hasLandingSkill) chips.innerHTML += `<span class="pwiz-skill-chip pos">Landing +1</span>`;
        el.appendChild(chips);
      },
    });
  }

  /* ─────────────────────────────────────────────────────
     STEP 3: RANGE & OPTIONS
     ──────────────────────────────────────────────────── */
  function renderRange(el) {
    el.innerHTML = `<div class="pwiz-step-title">Range &amp; Options</div>`;

    /* Range selector */
    const label = document.createElement('div');
    label.className = 'input-label'; label.textContent = 'Throw Range';
    el.appendChild(label);

    const rangePicker = document.createElement('div');
    rangePicker.className = 'av-picker';
    rangePicker.style.marginBottom = '0.5rem';

    [{ label: 'Short (4+)', target: 4, desc: 'Up to 3 squares' },
     { label: 'Long (5+)',  target: 5, desc: '4–6 squares' }].forEach(opt => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'av-btn';
      btn.textContent = opt.label; btn.title = opt.desc;
      if (ws.rangeTarget === opt.target) btn.classList.add('active');
      btn.addEventListener('click', () => {
        rangePicker.querySelectorAll('.av-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        ws.rangeTarget = opt.target;
        refreshTargetDisplay();
        updateSummary();
      });
      rangePicker.appendChild(btn);
    });
    el.appendChild(rangePicker);

    /* Hail Mary toggle (only show if trait detected) */
    if (ws.hasHailMary) {
      const hmLabel = document.createElement('div');
      hmLabel.className = 'input-label'; hmLabel.textContent = 'Traits';
      el.appendChild(hmLabel);
      const hmBtn = document.createElement('button');
      hmBtn.type = 'button';
      hmBtn.className = `mod-toggle${ws.useHailMary ? ' active' : ''}`;
      hmBtn.textContent = 'Hail Mary Pass (always inaccurate, any range)';
      hmBtn.addEventListener('click', () => {
        ws.useHailMary = !ws.useHailMary;
        hmBtn.classList.toggle('active', ws.useHailMary);
        refreshTargetDisplay();
      });
      el.appendChild(hmBtn);
    }

    /* Strong Arm chip */
    if (ws.hasStrongArm) {
      const chipRow = document.createElement('div');
      chipRow.className = 'pwiz-mod-row'; chipRow.style.marginTop = '0.4rem';
      chipRow.innerHTML = `<span class="pwiz-skill-chip pos">💪 Strong Arm: +1 to throw roll</span>`;
      el.appendChild(chipRow);
    }

    /* Live target display */
    const targetBar = document.createElement('div');
    targetBar.className = 'pwiz-target-bar'; targetBar.id = 'twiz-target-bar';
    el.appendChild(targetBar);

    function refreshTargetDisplay() {
      const bar = document.getElementById('twiz-target-bar');
      if (!bar) return;
      if (ws.useHailMary) {
        bar.innerHTML = `<span class="pwiz-target-num">—</span><span class="pwiz-target-note"> Hail Mary — always inaccurate (fumble on 1)</span>`;
      } else {
        const eff = Math.max(2, ws.rangeTarget - ws.strongArmMod);
        bar.innerHTML = `<span class="pwiz-target-num">${eff}+</span><span class="pwiz-target-note"> on D6${ws.strongArmMod ? ` (base ${ws.rangeTarget}+, Strong Arm +1)` : ''}</span>`;
      }
    }
    refreshTargetDisplay();
  }

  /* ─────────────────────────────────────────────────────
     STEP 4: ALWAYS HUNGRY (conditional)
     ──────────────────────────────────────────────────── */
  function renderHungry(el) {
    el.innerHTML = `<div class="pwiz-step-title">🍖 Always Hungry Check</div>
      <p class="panel-intro" style="margin-bottom:0.6rem;">The thrower has <strong>Always Hungry</strong>. Roll D6 — on a 2+ the throw proceeds. On a 1, the thrower can't resist and devours the team-mate!</p>`;

    const resultEl = document.createElement('div');
    resultEl.className = 'roll-result'; resultEl.hidden = true;

    function processHungry(roll) {
      ws.hungryResult = roll === 1 ? 'eaten' : 'ok';
      if (roll === 1) {
        resultEl.innerHTML = `
          <div class="result-roll-num">1</div>
          <div class="result-name result-cas">🍖 Teammate Eaten!</div>
          <p class="result-desc">The thrower couldn't resist! The thrown player is removed from the pitch as a Casualty — they suffer a <strong>Badly Hurt</strong> result (no Casualty roll). The action ends immediately.</p>
        `;
      } else {
        resultEl.innerHTML = `
          <div class="result-roll-num">${roll}</div>
          <div class="result-name result-ok">Resisted! (${roll}, need 2+)</div>
          <p class="result-desc">The thrower managed to hold back. Proceed to the throw.</p>
        `;
      }
      resultEl.hidden = false;
      updateSummary();
      if (roll !== 1) setTimeout(() => go(5), 700);
    }

    const isPhys = wizardMode('throw') === 'physical';

    if (!isPhys) {
      const dieEl = document.createElement('div');
      dieEl.className = 'die'; dieEl.id = 'twiz-hungry-d1';
      dieEl.dataset.value = '1'; dieEl.innerHTML = '<div class="die-face"></div>';
      const tray = document.createElement('div');
      tray.className = 'dice-tray single'; tray.appendChild(dieEl);
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'roll-btn';
      btn.innerHTML = '<span class="roll-btn-icon">🎲</span> Roll Always Hungry (need 2+)';
      btn.addEventListener('click', async () => {
        btn.disabled = true; resultEl.hidden = true;
        const roll = await Dice.rollDieElement(dieEl);
        processHungry(roll);
      });
      el.appendChild(tray); el.appendChild(btn);
    } else {
      const zone = document.createElement('div'); zone.className = 'physical-zone';
      window.PhysicalDice.showPhysicalButtons(zone, {
        columns: 3,
        buttons: Array.from({ length: 6 }, (_, i) => {
          const r = i + 1;
          return r === 1
            ? { value: 1, label: '🍖 Eaten!', cls: 'phys-bad' }
            : { value: r, label: 'Proceed',   cls: 'phys-good' };
        }),
        onSelect(r) { processHungry(r); },
      });
      el.appendChild(zone);
    }

    el.appendChild(resultEl);
  }

  /* ─────────────────────────────────────────────────────
     STEP 5: THROW ROLL
     Outcomes: Natural 1 = Fumble, Natural 6 = Superb,
     ≥ target = Accurate, < target = Inaccurate
     ──────────────────────────────────────────────────── */
  function renderThrow(el) {
    el.innerHTML = `<div class="pwiz-step-title">Throw Roll</div>`;

    const effTarget = ws.useHailMary ? 99 : Math.max(2, ws.rangeTarget - ws.strongArmMod);
    const resultEl  = document.createElement('div');
    resultEl.className = 'roll-result'; resultEl.hidden = true;

    function processThrow(roll) {
      let outcome, title, cls, desc;

      if (ws.useHailMary) {
        if (roll === 1) {
          outcome = 'fumble'; title = 'Fumble!'; cls = 'result-cas';
          desc = "Natural 1 — Hail Mary fails! The team-mate is placed in the thrower's square and removed as a Casualty (Badly Hurt).";
        } else {
          outcome = 'inaccurate'; title = 'Hail Mary — Inaccurate'; cls = 'result-ko';
          desc = `Roll ${roll}. Hail Mary always scatters — the team-mate deviates once from the intended landing square. They must still make a Landing roll wherever they land.`;
        }
      } else if (roll === 1) {
        outcome = 'fumble'; title = 'Fumble!'; cls = 'result-cas';
        desc = "Natural 1 — the throw fails catastrophically! The team-mate is placed in the thrower's square and removed as a Casualty (Badly Hurt). Turnover!";
      } else if (roll === 6) {
        outcome = 'superb'; title = '★ Superb Throw!'; cls = 'result-ok';
        if (ws.hasBullseye) {
          desc = `Natural 6 — Superb! The team-mate lands precisely on target. With the Bullseye trait, no Landing roll is required!`;
        } else {
          desc = `Natural 6 — Superb throw! The team-mate lands precisely on target. Make a Landing roll now.`;
        }
      } else if (roll >= effTarget) {
        outcome = 'accurate'; title = 'Accurate Throw!'; cls = 'result-ok';
        desc = `Roll ${roll} vs ${effTarget}+ — the team-mate lands on target. Make a Landing roll.`;
      } else {
        outcome = 'inaccurate'; title = 'Inaccurate Throw'; cls = 'result-ko';
        desc = `Roll ${roll} vs ${effTarget}+ — the team-mate scatters 3 times from the intended square. Make a Landing roll in their final position.`;
      }

      ws.throwResult  = outcome;
      ws.scatterDirs  = [];
      ws.landingResult = null;

      resultEl.innerHTML = `
        <div class="result-roll-num">${roll}</div>
        <div class="result-name ${cls}">${esc(title)}</div>
        <p class="result-desc">${esc(desc)}</p>
      `;
      resultEl.hidden = false;
      updateSummary();

      setTimeout(() => {
        if (outcome === 'fumble') return; /* stay on step 5 */
        if (outcome === 'inaccurate') go(6);
        else go(7); /* superb/accurate → landing (or skip if Bullseye) */
      }, 850);
    }

    const isPhys = wizardMode('throw') === 'physical';

    if (!isPhys) {
      const dieEl = document.createElement('div');
      dieEl.className = 'die'; dieEl.id = 'twiz-throw-d1';
      dieEl.dataset.value = '1'; dieEl.innerHTML = '<div class="die-face"></div>';
      const tray = document.createElement('div');
      tray.className = 'dice-tray single'; tray.appendChild(dieEl);
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'roll-btn';
      btn.innerHTML = '<span class="roll-btn-icon">🎲</span> Roll Throw';
      btn.addEventListener('click', async () => {
        btn.disabled = true; resultEl.hidden = true;
        const roll = await Dice.rollDieElement(dieEl);
        processThrow(roll);
      });
      el.appendChild(tray); el.appendChild(btn);
    } else {
      const zone = document.createElement('div'); zone.className = 'physical-zone';
      window.PhysicalDice.showPhysicalButtons(zone, {
        columns: 3,
        buttons: Array.from({ length: 6 }, (_, i) => {
          const roll = i + 1;
          let label, cls;
          if (ws.useHailMary) {
            label = roll === 1 ? 'Fumble!' : 'Inaccurate';
            cls   = roll === 1 ? 'phys-bad' : 'phys-warn';
          } else if (roll === 1) {
            label = 'Fumble!'; cls = 'phys-bad';
          } else if (roll === 6) {
            label = '★ Superb!'; cls = 'phys-good';
          } else if (roll >= effTarget) {
            label = 'Accurate!'; cls = 'phys-good';
          } else {
            label = 'Inaccurate'; cls = 'phys-warn';
          }
          return { value: roll, label, cls };
        }),
        onSelect(r) { processThrow(r); },
      });
      el.appendChild(zone);
    }

    el.appendChild(resultEl);
  }

  /* ─────────────────────────────────────────────────────
     STEP 6: SCATTER
     Inaccurate → 3×D8   |   Hail Mary → 1×D8
     ──────────────────────────────────────────────────── */
  function renderScatter(el) {
    const scatterCount = ws.useHailMary ? 1 : 3;
    el.innerHTML = `<div class="pwiz-step-title">Scatter ×${scatterCount}</div>
      <p class="panel-intro" style="margin-bottom:0.5rem;">The team-mate scatters ${scatterCount === 1 ? 'once' : '3 times'} from the intended landing square. Roll D8 for direction each time — they move 1 square per roll.</p>`;

    ws.scatterDirs = [];
    const resultsEl = document.createElement('div');
    const DIR_LABEL = { 1:'↖ Up-Left',2:'↑ Up',3:'↗ Up-Right',4:'← Left',5:'→ Right',6:'↙ Down-Left',7:'↓ Down',8:'↘ Down-Right' };
    const DIR_SYM   = { 1:'↖',2:'↑',3:'↗',4:'←',5:'→',6:'↙',7:'↓',8:'↘' };
    const isPhys    = wizardMode('throw') === 'physical';

    function addScatter(dir) {
      ws.scatterDirs.push(dir);
      const row = document.createElement('div');
      row.style.cssText = 'font-family:JetBrains Mono,monospace;font-size:0.82rem;margin:0.2rem 0;color:rgba(200,220,255,0.8);';
      row.textContent = `${ws.scatterDirs.length}. ${DIR_LABEL[dir]}`;
      resultsEl.appendChild(row);
      if (ws.scatterDirs.length >= scatterCount) {
        setTimeout(() => go(7), 600);
      } else {
        buildNextScatter();
      }
    }

    function buildNextScatter() {
      const n = ws.scatterDirs.length + 1;
      const sec = document.createElement('div');
      sec.style.marginTop = '0.5rem';

      if (isPhys) {
        const lbl = document.createElement('div');
        lbl.className = 'input-label'; lbl.style.marginBottom = '0.25rem';
        lbl.textContent = `Scatter ${n}: direction (D8)`;
        sec.appendChild(lbl);
        const cz = document.createElement('div');
        sec.appendChild(cz);
        window.PhysicalDice.showCompassButtons(cz, dir => { sec.remove(); addScatter(dir); });
      } else {
        const dieEl = document.createElement('div');
        dieEl.className = 'die'; dieEl.id = `twiz-scatter-d${n}`;
        dieEl.dataset.value = '1'; dieEl.dataset.sides = '8';
        dieEl.innerHTML = '<div class="die-face d8-face"></div>';
        const tray = document.createElement('div');
        tray.className = 'dice-tray single'; tray.appendChild(dieEl);
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'roll-btn';
        btn.innerHTML = `<span class="roll-btn-icon">🎲</span> Scatter ${n}`;
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          const dir = await Dice.rollDieElement(dieEl);
          sec.remove(); addScatter(dir);
        });
        sec.appendChild(tray); sec.appendChild(btn);
      }
      el.appendChild(sec);
    }

    el.appendChild(resultsEl);
    buildNextScatter();
  }

  /* ─────────────────────────────────────────────────────
     STEP 7: LANDING ROLL
     Need 4+ (modified by TZ, Landing skill)
     Superb + Bullseye → this step is skipped entirely
     ──────────────────────────────────────────────────── */
  function renderLanding(el) {
    el.innerHTML = `<div class="pwiz-step-title">Landing Roll</div>`;

    /* Superb + Bullseye: skipped automatically (activeSteps excludes 7) */

    if (ws.throwResult === 'superb') {
      const banner = document.createElement('p');
      banner.className = 'panel-intro';
      banner.style.color = '#81c784';
      banner.textContent = '★ Superb throw — no Landing roll needed! The team-mate touches down perfectly.';
      el.appendChild(banner);
      /* This branch only reached if Bullseye is absent */
    }

    /* TZ counter for landing square */
    const tzRow = document.createElement('div');
    tzRow.className = 'pwiz-mod-row';
    tzRow.innerHTML = '<span class="input-label" style="margin:0;">Tackle Zones in Landing Square:</span>';
    const tzMinus = document.createElement('button'); tzMinus.type = 'button'; tzMinus.className = 'tz-btn'; tzMinus.textContent = '−';
    const tzVal   = document.createElement('span');   tzVal.className = 'tz-val'; tzVal.textContent = ws.landingTZ;
    const tzPlus  = document.createElement('button'); tzPlus.type = 'button'; tzPlus.className = 'tz-btn'; tzPlus.textContent = '+';
    function getLandMod() { return -ws.landingTZ + (ws.hasLandingSkill ? 1 : 0); }
    function refreshLandTarget() {
      const bar = document.getElementById('twiz-land-target');
      if (!bar) return;
      const mod = getLandMod();
      const eff = Math.min(6, Math.max(2, 4 - mod));
      bar.innerHTML = `<span class="pwiz-target-num">${eff}+</span><span class="pwiz-target-note"> (base 4+, net ${mod >= 0 ? '+' : ''}${mod})</span>`;
    }
    tzMinus.addEventListener('click', () => { ws.landingTZ = Math.max(0, ws.landingTZ-1); tzVal.textContent = ws.landingTZ; refreshLandTarget(); });
    tzPlus.addEventListener('click',  () => { ws.landingTZ = Math.min(6, ws.landingTZ+1); tzVal.textContent = ws.landingTZ; refreshLandTarget(); });
    tzRow.appendChild(tzMinus); tzRow.appendChild(tzVal); tzRow.appendChild(tzPlus);
    el.appendChild(tzRow);

    if (ws.hasLandingSkill) {
      const c = document.createElement('div'); c.className = 'pwiz-mod-row'; c.style.marginTop='0.3rem';
      c.innerHTML = `<span class="pwiz-skill-chip pos">Landing +1</span>`;
      el.appendChild(c);
    }

    const targetBar = document.createElement('div');
    targetBar.className = 'pwiz-target-bar'; targetBar.id = 'twiz-land-target';
    el.appendChild(targetBar);

    const occupiedNote = document.createElement('p');
    occupiedNote.className = 'panel-intro';
    occupiedNote.style.cssText = 'font-size:0.68rem;color:rgba(255,200,80,0.75);margin-top:0.4rem;';
    occupiedNote.textContent = '⚠ If the landing square is occupied: both players are knocked down and must roll Armour.';
    el.appendChild(occupiedNote);

    const resultEl = document.createElement('div');
    resultEl.className = 'roll-result'; resultEl.hidden = true;

    function processLanding(roll) {
      const mod      = getLandMod();
      const modified = roll + mod;
      let title, cls, desc;

      if (modified >= 4) {
        ws.landingResult = 'safe';
        title = 'Safe Landing!'; cls = 'result-ok';
        desc  = `Roll ${roll}${mod !== 0 ? ` (→ ${modified})` : ''} vs 4+ — the team-mate sticks the landing! They are placed on the pitch and may act normally (if not yet activated this turn).`;
      } else if (roll === 1) {
        ws.landingResult = 'crash';
        title = 'Crash Landing!'; cls = 'result-cas';
        desc  = 'Natural 1 — always fails. The team-mate is knocked down in their landing square. Roll Armour on step 8.';
      } else {
        ws.landingResult = 'crash';
        title = 'Crash Landing!'; cls = 'result-cas';
        desc  = `Roll ${roll}${mod !== 0 ? ` (→ ${modified})` : ''} vs 4+ — the team-mate crashes down! They are knocked down. Roll Armour on step 8.`;
      }

      resultEl.innerHTML = `
        <div class="result-roll-num">${roll}${mod !== 0 ? `<span style="font-size:1rem;font-weight:600;"> (→${modified})</span>` : ''}</div>
        <div class="result-name ${cls}">${esc(title)}</div>
        <p class="result-desc">${esc(desc)}</p>
      `;
      resultEl.hidden = false;
      updateSummary();
      if (ws.landingResult === 'crash') setTimeout(() => go(8), 850);
    }

    const isPhys = wizardMode('throw') === 'physical';

    if (!isPhys) {
      const dieEl = document.createElement('div');
      dieEl.className = 'die'; dieEl.id = 'twiz-land-d1';
      dieEl.dataset.value = '1'; dieEl.innerHTML = '<div class="die-face"></div>';
      const tray = document.createElement('div');
      tray.className = 'dice-tray single'; tray.appendChild(dieEl);
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'roll-btn';
      btn.innerHTML = '<span class="roll-btn-icon">🎲</span> Roll Landing (need 4+)';
      btn.addEventListener('click', async () => {
        btn.disabled = true; resultEl.hidden = true;
        const roll = await Dice.rollDieElement(dieEl);
        processLanding(roll);
      });
      el.appendChild(tray); el.appendChild(btn);
    } else {
      const zone = document.createElement('div'); zone.className = 'physical-zone';
      function landPhysButtons() {
        const mod = getLandMod();
        return Array.from({ length: 6 }, (_, i) => {
          const roll = i + 1;
          const modified = roll + mod;
          const safe = modified >= 4;
          return { value: roll, label: safe ? 'Safe!' : 'Crash!', cls: safe ? 'phys-good' : 'phys-bad' };
        });
      }
      window.PhysicalDice.showPhysicalButtons(zone, {
        columns: 3, buttons: landPhysButtons(),
        onSelect(r) { processLanding(r); },
      });
      el.appendChild(zone);
    }

    refreshLandTarget();
    el.appendChild(resultEl);
  }

  /* ─────────────────────────────────────────────────────
     STEP 8: ARMOUR ROLL (Crash Landing)
     Pre-loaded with thrown player's AV
     ──────────────────────────────────────────────────── */
  function renderArmour(el) {
    const av = ws.thrownAV;
    el.innerHTML = `<div class="pwiz-step-title">Armour Roll</div>
      <p class="panel-intro" style="margin-bottom:0.5rem;">Crash landing! Roll 2D6 vs the thrown player's AV${av}+. If broken, the player is injured — use the Injury panel for the injury table.</p>`;

    const avChip = document.createElement('div');
    avChip.className = 'pwiz-mod-row';
    avChip.innerHTML = `<span class="pwiz-skill-chip">Target: AV${av}+</span>`;
    if (ws.thrown?.name) avChip.innerHTML += `<span class="pwiz-skill-chip">${esc(ws.thrown.name)}</span>`;
    el.appendChild(avChip);

    const resultEl = document.createElement('div');
    resultEl.className = 'roll-result'; resultEl.hidden = true;

    function processArmour(d1, d2, total) {
      const isPhysRoll = d1 === null;
      const breakdownHtml = isPhysRoll
        ? `<div class="result-roll-breakdown">Physical roll vs AV${av}+</div>`
        : `<div class="result-roll-breakdown">${d1} + ${d2} vs AV${av}+</div>`;

      if (total >= av) {
        resultEl.innerHTML = `
          <div class="result-roll-num">${total}</div>
          ${breakdownHtml}
          <div class="result-name" style="color:var(--bb-red,#C8102E);">Armour Broken!</div>
          <p class="result-desc">Total ${total} ≥ AV${av}. The thrown player's armour is broken — open the <strong>Injury panel</strong> and roll the Injury table. Apply any relevant modifiers.</p>
        `;
      } else {
        resultEl.innerHTML = `
          <div class="result-roll-num">${total}</div>
          ${breakdownHtml}
          <div class="result-name" style="color:var(--bb-gold,#D4AF37);">Armour Holds</div>
          <p class="result-desc">Total ${total} &lt; AV${av}. The armour held — the player is Prone but not injured. They will be turned face-up at the start of your next turn.</p>
        `;
      }
      resultEl.hidden = false;
    }

    const isPhys = wizardMode('throw') === 'physical';

    if (!isPhys) {
      const d1El = document.createElement('div');
      d1El.className = 'die'; d1El.id = 'twiz-av-d1';
      d1El.dataset.value = '1'; d1El.innerHTML = '<div class="die-face"></div>';
      const d2El = document.createElement('div');
      d2El.className = 'die'; d2El.id = 'twiz-av-d2';
      d2El.dataset.value = '1'; d2El.innerHTML = '<div class="die-face"></div>';
      const tray = document.createElement('div');
      tray.className = 'dice-tray'; tray.appendChild(d1El); tray.appendChild(d2El);
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'roll-btn';
      btn.innerHTML = `<span class="roll-btn-icon">🎲</span> Roll Armour Check (vs AV${av}+)`;
      btn.addEventListener('click', async () => {
        btn.disabled = true; resultEl.hidden = true;
        const { d1, d2, total } = await Dice.roll2D6(d1El, d2El);
        processArmour(d1, d2, total);
      });
      el.appendChild(tray); el.appendChild(btn);
    } else {
      const zone = document.createElement('div'); zone.className = 'physical-zone';
      window.PhysicalDice.showPhysicalButtons(zone, {
        columns: 4,
        buttons: Array.from({ length: 11 }, (_, i) => {
          const total  = i + 2;
          const breaks = total >= av;
          return { value: total, label: breaks ? `Breaks! (${total})` : `Holds (${total})`, cls: breaks ? 'phys-bad' : 'phys-muted' };
        }),
        onSelect(total) { processArmour(null, null, total); },
      });
      el.appendChild(zone);
    }

    el.appendChild(resultEl);
  }

  /* ── Boot ── */
  buildShell();
  render();

  onPanelOpen('panel-throw', () => {
    ws.step = 1;
    ws.throwResult   = null;
    ws.hungryResult  = null;
    ws.scatterDirs   = [];
    ws.landingResult = null;
    buildShell();
    render();
  });

  panel.addEventListener('bb:diceMode', () => render());
}

/* ════════════════════════════════════════════════════════
   PLAYER SELECTION PANELS (shared utility)
   Event delegation — one listener on container.
   ════════════════════════════════════════════════════════ */

function buildWizardPlayerList(listId, side, filterFn, onSelect) {
  const container = document.getElementById(listId);
  if (!container) return { getSelected: () => null };

  const allPlayers = window.getPlayerList?.(side) ?? [];
  const players    = allPlayers.filter(filterFn);

  container.innerHTML = '';
  const oldHandler = container._wpsHandler;
  if (oldHandler) container.removeEventListener('click', oldHandler);

  if (allPlayers.length === 0) {
    container.innerHTML = '<p class="wps-empty">No roster loaded</p>';
    return { getSelected: () => null };
  }
  if (players.length === 0) {
    container.innerHTML = '<p class="wps-empty">No eligible players</p>';
    return { getSelected: () => null };
  }

  const playerMap = new Map();

  players.forEach(p => {
    const btn = document.createElement('button');
    btn.type  = 'button';
    btn.className = 'wps-player-btn';
    btn.dataset.playerIdx = p.idx;

    const stMatch  = p.statsText.match(/\bST\s*(\d+)/i);
    const avMatch  = p.statsText.match(/\bAV\s*(\d+)/i);
    const stVal    = stMatch  ? stMatch[1]  : null;
    const avVal    = avMatch  ? avMatch[1]  : null;
    const statHint = stVal ? `ST${stVal}` : (avVal ? `AV${avVal}+` : '');

    const statusMeta = window.STATUS_META?.[p.status];
    const statusHtml = statusMeta?.label
      ? `<span class="player-status-badge ${statusMeta.cls}">${statusMeta.label}</span>`
      : '';

    btn.innerHTML = `
      <span class="wps-name">${esc(p.name)}</span>
      ${p.pos    ? `<span class="wps-pos">${esc(p.pos)}</span>` : ''}
      ${statHint ? `<span class="wps-stat-badge">${statHint}</span>` : ''}
      ${statusHtml}
    `;

    playerMap.set(p.idx, {
      player: p,
      stats: { st: stVal ? parseInt(stVal, 10) : null, av: avVal ? parseInt(avVal, 10) : null },
    });
    container.appendChild(btn);
  });

  let selectedIdx = null;

  function handler(e) {
    const btn = e.target.closest('.wps-player-btn');
    if (!btn) return;
    const idx = parseInt(btn.dataset.playerIdx, 10);
    if (!playerMap.has(idx)) return;
    container.querySelectorAll('.wps-player-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedIdx = idx;
    const { player, stats } = playerMap.get(idx);
    onSelect?.(player, stats);
  }

  container._wpsHandler = handler;
  container.addEventListener('click', handler);

  return {
    getSelected:    () => (selectedIdx !== null ? (playerMap.get(selectedIdx)?.player ?? null) : null),
    clearSelection: () => {
      selectedIdx = null;
      container.querySelectorAll('.wps-player-btn').forEach(b => b.classList.remove('selected'));
    },
  };
}

function onPanelOpen(panelId, fn) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  new MutationObserver(mutations => {
    mutations.forEach(m => {
      if (m.attributeName === 'hidden' && !panel.hasAttribute('hidden')) fn();
    });
  }).observe(panel, { attributes: true });
}

/* ════════════════════════════════════════════════════════
   BLOCK WIZARD — player selection
   ════════════════════════════════════════════════════════ */

function initBlockPlayerSelect(attStStepper, defStStepper) {
  const PS = window.PlayerStatus;

  function refreshBlockLists() {
    buildWizardPlayerList(
      'block-attacker-list', 'left',
      p => p.status === PS?.AVAILABLE || p.status === PS?.PRONE || p.status === PS?.STUNNED,
      (p, stats) => { if (stats.st && attStStepper) attStStepper.set(stats.st); }
    );
    buildWizardPlayerList(
      'block-defender-list', 'right',
      () => true,
      (p, stats) => { if (stats.st && defStStepper) defStStepper.set(stats.st); }
    );
  }

  onPanelOpen('panel-block', refreshBlockLists);
}

/* ════════════════════════════════════════════════════════
   FOUL WIZARD — player selection
   ════════════════════════════════════════════════════════ */

function initFoulPlayerSelect(avPickerUpdate) {
  const PS = window.PlayerStatus;

  function refreshFoulLists() {
    buildWizardPlayerList(
      'foul-fouler-list', 'left',
      p => !window.STATUS_META?.[p.status]?.dim,
      () => {}
    );
    buildWizardPlayerList(
      'foul-target-list', 'right',
      p => p.status === PS?.PRONE || p.status === PS?.STUNNED,
      (p, stats) => { if (stats.av && avPickerUpdate) avPickerUpdate(stats.av); }
    );
  }

  onPanelOpen('panel-foul', refreshFoulLists);
}

/* ════════════════════════════════════════════════════════
   BOOT
   ════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  initBlockWizard();
  initPassWizard();
  initFoulWizard();
  initThrowWizard();
});
