'use strict';

/* ═══════════════════════════════════════════════════════
   Blood Bowl Companion — js/throw-wizard.js
   Throw Team-Mate, rebuilt on the Pass wizard (v3) layout:
   trading-card players (thrower left, thrown right), options
   column in the middle, sequence result strip on top, and a
   single Roll button with Confirm / Use Re-roll below.
   Rules folded in from the old step wizard: Always Hungry,
   Short 4+ / Long 5+, Strong Arm, Hail Mary, Bullseye,
   scatter ×3 (×1 Hail Mary), Landing 4+ (TZ / Landing skill),
   then the shared armour → injury → casualty tail.
   Depends on wizards.js globals (buildEmbeddedCardShared,
   buildWizardPlayerList, BBResolve, dice helpers, FitScale).
   ═══════════════════════════════════════════════════════ */

const TTM_THROWER_SKILLS = ['Throw Team-Mate', 'Always Hungry', 'Strong Arm', 'Hail Mary Pass', 'Bullseye', 'Animosity', 'Pro'];
const TTM_THROWN_SKILLS  = ['Right Stuff', 'Landing', 'Stunty', 'Thick Skull', 'Iron Hard Skin', 'Decay'];

function initThrowTeammateWizard() {
  const panel = document.getElementById('panel-throw');
  if (!panel) return;
  const body = panel.querySelector('.panel-body');

  const ws = {
    activeSide:  'left',
    thrower:     null,
    thrown:      null,
    rangeTarget: 4,      /* 4 = Short (4+), 5 = Long (5+) */
    useHailMary: false,
    landingTZ:   0,
    activeStepKey: 'throw',
    teamRRUsed:  false,
    acted:       false,
    _fit:        null,
  };

  const gbSide = () => (ws.activeSide === 'left' ? 'home' : 'away');
  const delay  = ms => new Promise(r => setTimeout(r, ms));

  function hasSk(p, name) {
    if (!p) return false;
    return (getPlayerSkills(p) || []).some(s => s.replace(/\s*\(.*\)$/, '').trim().toLowerCase() === name.toLowerCase());
  }

  const thrTraits = () => ({
    hungry:    hasSk(ws.thrower, 'Always Hungry'),
    strongArm: hasSk(ws.thrower, 'Strong Arm'),
    hailMary:  hasSk(ws.thrower, 'Hail Mary Pass'),
    bullseye:  hasSk(ws.thrower, 'Bullseye'),
  });
  const thnTraits = () => ({
    landing:    hasSk(ws.thrown, 'Landing'),
    stunty:     hasSk(ws.thrown, 'Stunty') ? 1 : 0,
    thickSkull: hasSk(ws.thrown, 'Thick Skull'),
    ironHard:   hasSk(ws.thrown, 'Iron Hard Skin'),
    decay:      hasSk(ws.thrown, 'Decay'),
    av:         parseStat(ws.thrown?.statsText, 'AV') ?? 8,
  });

  function throwTarget() {
    if (ws.useHailMary) return 99;                        /* always inaccurate */
    return Math.max(2, ws.rangeTarget - (thrTraits().strongArm ? 1 : 0));
  }
  function landTarget() {
    const mod = -ws.landingTZ + (thnTraits().landing ? 1 : 0);
    return Math.min(6, Math.max(2, 4 - mod));
  }

  const playerNum   = p => (p?.number != null ? String(p.number) : String((p?.idx ?? 0) + 1));
  const playerLabel = p => `#${playerNum(p)} ${p?.name || p?.pos || '?'}`;

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  /* ─────────────────────────────────────────────────────
     LAYOUT (pwiz3 shell, options column instead of pitch)
     ──────────────────────────────────────────────────── */
  function buildLayout() {
    body.innerHTML = '';

    const root = el('div', 'pwiz3'); root.id = 'twiz3-root';
    body.appendChild(root);

    /* Team tabs */
    const teamRow = el('div', 'pwiz-team-tabs');
    ['Home', 'Away'].forEach((label, i) => {
      const side = i === 0 ? 'left' : 'right';
      const btn  = el('button', 'pwiz-team-tab' + (ws.activeSide === side ? ' active' : ''));
      btn.type = 'button'; btn.textContent = label;
      btn.addEventListener('click', () => {
        if (ws.activeSide === side) return;
        ws.activeSide = side;
        ws.thrower = ws.thrown = null;
        teamRow.querySelectorAll('.pwiz-team-tab').forEach(b => b.classList.toggle('active', b === btn));
        buildPlayerColumn('thrower'); buildPlayerColumn('thrown'); buildOptions(); armWizard();
      });
      teamRow.appendChild(btn);
    });
    root.appendChild(teamRow);

    /* Sequence strip */
    root.appendChild(el('div', 'pwiz3-seq', null)).id = 'twiz3-seq';

    /* Stage: thrower skills | thrower card | options | thrown card | thrown skills */
    const stage = el('div', 'pwiz3-stage');
    root.appendChild(stage);
    stage.appendChild(el('div', 'pwiz3-skills-col')).id = 'twiz3-thrower-skills';
    stage.appendChild(el('div', 'pwiz3-col pwiz3-col-left')).id = 'twiz3-thrower-col';
    stage.appendChild(el('div', 'twiz3-mid')).id = 'twiz3-opts';
    stage.appendChild(el('div', 'pwiz3-col pwiz3-col-right')).id = 'twiz3-thrown-col';
    stage.appendChild(el('div', 'pwiz3-skills-col')).id = 'twiz3-thrown-skills';

    /* Roll frame */
    const frame = el('div', 'pwiz3-rollframe');
    root.appendChild(frame);
    const fLeft = el('div', 'pwiz3-frame-left'); fLeft.id = 'twiz3-frame-left';
    frame.appendChild(fLeft);
    frame.appendChild(el('div', 'pwiz3-math')).id = 'twiz3-math';
    const fRoll = el('div', 'pwiz3-frame-roll');
    const diceRow = el('div', 'pwiz3-dice-row');
    diceRow.appendChild(el('div', 'pwiz3-dice-slot')).id = 'twiz3-dice';
    const rollBtn = el('button', 'roll-btn pwiz3-roll-btn'); rollBtn.id = 'twiz3-roll';
    rollBtn.type = 'button'; rollBtn.textContent = 'Roll'; rollBtn.disabled = true;
    diceRow.appendChild(rollBtn);
    fRoll.appendChild(diceRow);
    const actRow = el('div', 'pwiz3-act-row');
    const confirmBtn = el('button', 'bwiz-confirm-btn'); confirmBtn.id = 'twiz3-confirm';
    confirmBtn.type = 'button'; confirmBtn.textContent = 'Confirm Result'; confirmBtn.hidden = true;
    const rerollBtn = el('button', 'bwiz-rr-action-btn'); rerollBtn.id = 'twiz3-reroll';
    rerollBtn.type = 'button'; rerollBtn.textContent = 'Use Re-roll'; rerollBtn.hidden = true;
    actRow.appendChild(confirmBtn); actRow.appendChild(rerollBtn);
    fRoll.appendChild(actRow);
    frame.appendChild(fRoll);

    buildPlayerColumn('thrower');
    buildPlayerColumn('thrown');
    buildOptions();
    armWizard();

    ws._fit?.disconnect?.();
    if (window.FitScale) ws._fit = window.FitScale(body, root, { max: 1.4 });
  }

  /* ── Player columns (embedded card + skills, like Pass) ── */
  function buildPlayerColumn(role) {
    const col       = document.getElementById(role === 'thrower' ? 'twiz3-thrower-col' : 'twiz3-thrown-col');
    const skillsCol = document.getElementById(role === 'thrower' ? 'twiz3-thrower-skills' : 'twiz3-thrown-skills');
    if (!col) return;
    const player = role === 'thrower' ? ws.thrower : ws.thrown;
    const label  = role === 'thrower' ? 'Thrower' : 'Thrown Team-Mate';

    if (!player) { showInlinePicker(role); return; }

    col.innerHTML = '';
    if (skillsCol) skillsCol.innerHTML = '';
    col.appendChild(el('div', 'pwiz3-col-label', label));
    const cardWrap = el('div', 'pwiz3-card-wrap');
    col.appendChild(cardWrap);
    buildEmbeddedCardShared(cardWrap, player, ws.activeSide, { small: true });

    const btn = el('button', 'pwiz3-choose-btn'); btn.type = 'button';
    btn.textContent = `Change ${role === 'thrower' ? 'Thrower' : 'Thrown'}`;
    btn.addEventListener('click', () => showInlinePicker(role));
    col.appendChild(btn);

    if (skillsCol) {
      skillsCol.appendChild(el('div', 'pwiz3-col-label', `${label} Skills`));
      const set = new Set(role === 'thrower' ? TTM_THROWER_SKILLS : TTM_THROWN_SKILLS);
      const rel = [...new Set((getPlayerSkills(player) || [])
        .map(s => s.replace(/\s*\(.*\)$/, '').trim())
        .filter(s => set.has(s)))];
      if (rel.length) rel.forEach(s => skillsCol.appendChild(window.buildSkillCard(s)));
      else skillsCol.appendChild(el('div', 'pwiz3-skill-empty', 'No relevant skills'));
    }
  }

  function showInlinePicker(role) {
    const col       = document.getElementById(role === 'thrower' ? 'twiz3-thrower-col' : 'twiz3-thrown-col');
    const skillsCol = document.getElementById(role === 'thrower' ? 'twiz3-thrower-skills' : 'twiz3-thrown-skills');
    if (!col) return;
    col.innerHTML = '';
    if (skillsCol) skillsCol.innerHTML = '';
    col.appendChild(el('div', 'pwiz3-col-label', role === 'thrower' ? 'Thrower' : 'Thrown Team-Mate'));

    const picker = el('div', 'pwiz3-picker');
    picker.appendChild(el('div', 'pwiz3-picker-label',
      role === 'thrower' ? 'Select Thrower — needs Throw Team-Mate' : 'Select Thrown — needs Right Stuff'));
    const list = el('div', 'wps-list'); list.id = `twiz3-${role}-list`;
    picker.appendChild(list);
    col.appendChild(picker);

    const need = role === 'thrower' ? 'Throw Team-Mate' : 'Right Stuff';
    buildWizardPlayerList(list.id, ws.activeSide,
      p => hasSkill(p, need) && window.isPlayerAvailable?.(p),
      (p) => {
        if (role === 'thrower') ws.thrower = p; else ws.thrown = p;
        if (ws.thrower && ws.thrown && ws.thrower.idx === ws.thrown.idx) {
          if (role === 'thrower') ws.thrown = null; else ws.thrower = null;
          buildPlayerColumn(role === 'thrower' ? 'thrown' : 'thrower');
        }
        buildPlayerColumn(role);
        buildOptions();
        armWizard();
      });
  }

  /* ── Middle options column: range, Hail Mary, landing TZ ── */
  function buildOptions() {
    const host = document.getElementById('twiz3-opts');
    if (!host) return;
    host.innerHTML = '';
    const tt = thrTraits(), tn = thnTraits();

    host.appendChild(el('div', 'pwiz3-col-label', 'Throw Options'));

    host.appendChild(el('div', 'input-label', 'Range'));
    const rangePicker = el('div', 'av-picker');
    [{ label: 'Short (4+)', target: 4, desc: 'Up to 3 squares' },
     { label: 'Long (5+)',  target: 5, desc: '4–6 squares' }].forEach(opt => {
      const btn = el('button', 'av-btn' + (ws.rangeTarget === opt.target ? ' active' : ''));
      btn.type = 'button'; btn.textContent = opt.label; btn.title = opt.desc;
      btn.addEventListener('click', () => {
        rangePicker.querySelectorAll('.av-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        ws.rangeTarget = opt.target;
        armWizard();
      });
      rangePicker.appendChild(btn);
    });
    host.appendChild(rangePicker);

    if (tt.hailMary) {
      const hmBtn = el('button', 'mod-toggle' + (ws.useHailMary ? ' active' : ''));
      hmBtn.type = 'button';
      hmBtn.textContent = 'Hail Mary Pass — any range, always inaccurate';
      hmBtn.addEventListener('click', () => {
        ws.useHailMary = !ws.useHailMary;
        hmBtn.classList.toggle('active', ws.useHailMary);
        armWizard();
      });
      host.appendChild(hmBtn);
    }

    host.appendChild(el('div', 'input-label', 'Tackle Zones at Landing Square'));
    const tzRow = el('div', 'pwiz-mod-row twiz3-tz-row');
    const tzMinus = el('button', 'tz-btn', '−'); tzMinus.type = 'button';
    const tzVal   = el('span', 'tz-val', String(ws.landingTZ));
    const tzPlus  = el('button', 'tz-btn', '+'); tzPlus.type = 'button';
    const bump = d => {
      ws.landingTZ = Math.min(6, Math.max(0, ws.landingTZ + d));
      tzVal.textContent = ws.landingTZ;
      const chip = document.querySelector('#twiz3-seq .pwiz3-result-panel[data-key="land"] .pwiz3-result-target');
      if (chip) chip.textContent = `${landTarget()}+`;
      renderMath();
    };
    tzMinus.addEventListener('click', () => bump(-1));
    tzPlus.addEventListener('click',  () => bump(1));
    tzRow.appendChild(tzMinus); tzRow.appendChild(tzVal); tzRow.appendChild(tzPlus);
    host.appendChild(tzRow);

    /* Auto-detected trait chips */
    const chips = el('div', 'pwiz-mod-row twiz3-chips');
    if (ws.thrower) {
      if (tt.hungry)    chips.innerHTML += '<span class="pwiz-skill-chip neg">🍖 Always Hungry</span>';
      if (tt.strongArm) chips.innerHTML += '<span class="pwiz-skill-chip pos">💪 Strong Arm +1</span>';
      if (tt.bullseye)  chips.innerHTML += '<span class="pwiz-skill-chip pos">🎯 Bullseye</span>';
    }
    if (ws.thrown) {
      if (tn.landing) chips.innerHTML += '<span class="pwiz-skill-chip pos">Landing +1</span>';
      chips.innerHTML += `<span class="pwiz-skill-chip">AV ${tn.av}+</span>`;
    }
    if (chips.innerHTML) host.appendChild(chips);

    host.appendChild(el('p', 'twiz3-note',
      '⚠ If the landing square is occupied, both players are Knocked Down — roll Armour for each.'));
  }

  /* ─────────────────────────────────────────────────────
     SEQUENCE STRIP + MATH
     ──────────────────────────────────────────────────── */
  let seqChips = {};

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
    const seq = document.getElementById('twiz3-seq');
    if (!seq) return;
    seq.innerHTML = '';
    seqChips = {};
    if (!ws.thrower || !ws.thrown) {
      const steps = [];
      if (!ws.thrower) steps.push('Select a Thrower (Throw Team-Mate)');
      if (!ws.thrown)  steps.push('Select a Thrown player (Right Stuff)');
      seq.appendChild(el('div', 'pwiz3-seq-wait', steps.join(' · ')));
      return;
    }
    const tt = thrTraits(), tn = thnTraits();
    const strip = el('div', 'pwiz3-results-strip');
    if (tt.hungry) strip.appendChild(resultPanel('hungry', 'Always Hungry', '2+'));
    strip.appendChild(resultPanel('throw', 'Throw', ws.useHailMary ? '—' : `${throwTarget()}+`));
    strip.appendChild(resultPanel('land', 'Landing', `${landTarget()}+`));
    strip.appendChild(resultPanel('armour', 'Armour', `AV ${tn.av}+`, 'if crashed'));
    strip.appendChild(resultPanel('inj', 'Injury', '—', 'if broken'));
    seq.appendChild(strip);
  }

  function setSeqActive(key) {
    ws.activeStepKey = key;
    document.querySelectorAll('#twiz3-seq .pwiz3-result-panel').forEach(c =>
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

  function stepMath(key) {
    const tt = thrTraits(), tn = thnTraits();
    if (key === 'hungry') {
      return { label: 'Always Hungry', base: 'D6', terms: [], target: '2+',
        effects: ['On a 1 the thrower devours the team-mate'] };
    }
    if (key === 'throw') {
      if (ws.useHailMary) {
        return { label: 'Throw', base: 'Hail Mary', terms: [], target: '—',
          effects: ['Always inaccurate — scatters once', 'Fumble on a natural 1'] };
      }
      const terms = [];
      if (tt.strongArm) terms.push({ label: 'Strong Arm', delta: -1 });
      const effects = ['Natural 6 = Superb' + (tt.bullseye ? ' (Bullseye: no Landing roll)' : ''), 'Natural 1 = Fumble'];
      return { label: 'Throw', base: `${ws.rangeTarget === 4 ? 'Short' : 'Long'} ${ws.rangeTarget}+`, terms,
        target: `${throwTarget()}+`, effects };
    }
    if (key === 'land') {
      const terms = [];
      if (ws.landingTZ)  terms.push({ label: `${ws.landingTZ} Tackle Zone${ws.landingTZ > 1 ? 's' : ''}`, delta: ws.landingTZ });
      if (tn.landing)    terms.push({ label: 'Landing', delta: -1 });
      return { label: 'Landing', base: 'Base 4+', terms, target: `${landTarget()}+`,
        effects: ['Natural 1 always crashes'] };
    }
    if (key === 'armour') {
      return { label: 'Armour', base: `AV ${tn.av}+`, terms: [], target: `${tn.av}+`,
        effects: tn.ironHard ? ['Iron Hard Skin'] : [] };
    }
    if (key === 'inj') {
      const terms = [];
      if (tn.stunty) terms.push({ label: 'Stunty', delta: 1 });
      return { label: 'Injury', base: '2D6', terms, target: '',
        effects: tn.thickSkull ? ['Thick Skull'] : [] };
    }
    return null;
  }

  function renderMath() {
    const host = document.getElementById('twiz3-math');
    if (!host) return;
    if (!ws.thrower || !ws.thrown) {
      host.innerHTML = '<div class="pwiz3-math-wait">Select a thrower (Throw Team-Mate) and a team-mate (Right Stuff).</div>';
      return;
    }
    const m = stepMath(ws.activeStepKey || 'throw');
    if (!m) { host.innerHTML = ''; return; }
    const terms = m.terms.map(t => {
      const cls  = t.delta > 0 ? 'neg' : 'pos';
      const sign = t.delta > 0 ? '+' : '−';
      return `<span class="pwiz3-math-term ${cls}">${sign}${Math.abs(t.delta)}<small>${esc(t.label)}</small></span>`;
    }).join('<span class="pwiz3-math-op">·</span>');
    const eff = m.effects.map(e => `<span class="pwiz3-math-effect">${esc(e)}</span>`).join('');
    host.innerHTML =
      `<div class="pwiz3-math-step">${esc(m.label)}</div>` +
      `<div class="pwiz3-math-eq">` +
        `<span class="pwiz3-math-base">${esc(m.base)}</span>` +
        (terms ? `<span class="pwiz3-math-op">·</span>${terms}` : '') +
        (m.target ? `<span class="pwiz3-math-eq-sep">=</span><span class="pwiz3-math-target">${esc(m.target)}</span>` : '') +
      `</div>` +
      (eff ? `<div class="pwiz3-math-effects">${eff}</div>` : '');
  }

  /* ─────────────────────────────────────────────────────
     ROLL FLOW (single button, confirm / re-roll — like Pass)
     ──────────────────────────────────────────────────── */
  const rollBtnEl = () => document.getElementById('twiz3-roll');
  const confirmEl = () => document.getElementById('twiz3-confirm');
  const rerollEl  = () => document.getElementById('twiz3-reroll');
  const diceEl    = () => document.getElementById('twiz3-dice');

  function clearAfterRoll() {
    confirmEl().hidden = true; confirmEl().classList.remove('glow-blue'); confirmEl().onclick = null;
    rerollEl().hidden = true; rerollEl().classList.remove('glow-gold'); rerollEl().onclick = null;
  }

  function consumeTeamRR() {
    const gs = window.GameState?.rerolls; const key = gbSide();
    if (gs && gs[key] > 0) { gs[key] = Math.max(0, gs[key] - 1); window.Panels?.renderRerollPips?.(key); }
    ws.teamRRUsed = true;
  }

  function afterRoll({ onConfirm, rerollFn = null }) {
    rollBtnEl().disabled = true;
    const cf = confirmEl(); cf.hidden = false; cf.classList.add('glow-blue');
    cf.onclick = () => { clearAfterRoll(); onConfirm(); };
    const rr = window.GameState?.rerolls?.[gbSide()] ?? 0;
    if (rerollFn && !ws.teamRRUsed && rr > 0) {
      const rb = rerollEl(); rb.hidden = false; rb.classList.add('glow-gold');
      rb.onclick = () => { consumeTeamRR(); clearAfterRoll(); rerollFn(); };
    }
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
    roll.onclick = () => window.Panels?.closePanel?.('throw');
    clearAfterRoll();
  }

  async function rollDie() {
    const slot = diceEl(); slot.innerHTML = '';
    if (wizardMode('throw') === 'physical') {
      const v = await window.DiceSlot.d6(slot, 'Enter your D6 roll');
      const face = document.createElement('div');
      buildNumericFace(face, v);
      slot.appendChild(face);
      return v;
    }
    const face = document.createElement('div');
    buildNumericFace(face, 1);
    slot.appendChild(face);
    return await rollNumericDie(face);
  }

  async function rollTwoDice() {
    const slot = diceEl(); slot.innerHTML = '';
    if (wizardMode('throw') === 'physical') {
      const d1 = await window.DiceSlot.d6(slot, 'Enter the first D6');
      const d2 = await window.DiceSlot.d6(slot, 'Enter the second D6');
      [d1, d2].forEach(v => { const f = document.createElement('div'); buildNumericFace(f, v); slot.appendChild(f); });
      return [d1, d2];
    }
    const faces = [0, 1].map(() => { const f = document.createElement('div'); buildNumericFace(f, 1); slot.appendChild(f); return f; });
    return Promise.all(faces.map(f => rollNumericDie(f)));
  }

  function armWizard() {
    renderSeq();
    ws.teamRRUsed = false;
    ws.acted = false;
    const roll = rollBtnEl(); if (!roll) return;
    clearAfterRoll();
    if (diceEl()) diceEl().innerHTML = '';
    if (!ws.thrower || !ws.thrown) {
      roll.disabled = true; roll.textContent = 'Roll';
      roll.classList.remove('roll-btn--complete', 'glow-gold', 'glow-green');
      roll.onclick = null;
      renderMath();
      return;
    }
    if (thrTraits().hungry) { armRoll('Roll Always Hungry', doHungry); setSeqActive('hungry'); }
    else                    { armRoll('Roll Throw', doThrow);          setSeqActive('throw'); }
  }

  function commitAction() {
    if (ws.acted) return;
    ws.acted = true;
    if (ws.thrower) window.markPlayerActed?.(ws.activeSide, ws.thrower.idx, 'throw-teammate');
    if (ws.thrown)  window.markPlayerActed?.(ws.activeSide, ws.thrown.idx,  'thrown');
  }

  function applyBadlyHurt() {
    if (ws.thrown) BBResolve.applyStatus(ws.activeSide, ws.thrown.idx, 'badly_hurt');
  }

  async function doHungry() {
    setSeqActive('hungry');
    rollBtnEl().disabled = true;
    commitAction();
    const roll = await rollDie();
    if (roll === 1) {
      seqResult('hungry', roll, '🍖 Eaten!', 'bad',
        `${ws.thrown?.name || 'The team-mate'} is devoured — Badly Hurt, no Casualty roll. Turnover.`);
      window.logGameEvent?.('injury', { side: ws.activeSide, idx: ws.thrown?.idx, status: 'badly_hurt',
        detail: `${ws.thrown?.name || 'Team-mate'} — eaten by ${ws.thrower?.name || 'the thrower'} (Always Hungry)` });
      afterRoll({
        onConfirm: () => { applyBadlyHurt(); finish('🍖 Eaten — Turnover — Close'); },
        rerollFn: doHungry,
      });
      return;
    }
    seqResult('hungry', roll, 'Resisted', 'ok', 'The thrower holds back. On to the throw.');
    afterRoll({ onConfirm: () => { armRoll('Roll Throw', doThrow); setSeqActive('throw'); }, rerollFn: doHungry });
  }

  async function doThrow() {
    setSeqActive('throw');
    rollBtnEl().disabled = true;
    commitAction();
    const target = throwTarget();
    const roll = await rollDie();

    let outcome;
    if (roll === 1) outcome = 'fumble';
    else if (ws.useHailMary) outcome = 'inaccurate';
    else if (roll === 6) outcome = 'superb';
    else outcome = roll >= target ? 'accurate' : 'inaccurate';

    if (outcome === 'fumble') {
      seqResult('throw', roll, 'Fumble!', 'bad',
        `${ws.thrown?.name || 'The team-mate'} is dropped in the thrower's square — Badly Hurt. Turnover.`);
      afterRoll({
        onConfirm: () => {
          window.logGameEvent?.('fumble', { side: ws.activeSide, detail: `${ws.thrown?.name || 'Team-mate'} thrown — fumbled` });
          applyBadlyHurt();
          finish('Fumble — Turnover — Close');
        },
        rerollFn: doThrow,
      });
      return;
    }

    if (outcome === 'superb') {
      const bullseye = thrTraits().bullseye;
      seqResult('throw', roll, '★ Superb!', 'ok',
        bullseye ? 'Lands precisely on target — Bullseye: no Landing roll needed!'
                 : 'Lands precisely on target. Make the Landing roll.');
      afterRoll({
        onConfirm: () => {
          if (bullseye) {
            seqResult('land', null, 'Perfect', 'ok', 'Bullseye — no Landing roll required.');
            finish('Superb Throw — Close');
          } else armLanding();
        },
        rerollFn: doThrow,
      });
      return;
    }

    if (outcome === 'accurate') {
      seqResult('throw', roll, 'Accurate', 'ok', `Rolled ${roll} vs ${target}+ — on target. Make the Landing roll.`);
      afterRoll({ onConfirm: armLanding, rerollFn: doThrow });
      return;
    }

    /* Inaccurate: scatter ×3 (Hail Mary ×1) rendered into the Throw panel. */
    const n = ws.useHailMary ? 1 : 3;
    seqResult('throw', roll, ws.useHailMary ? 'Hail Mary — Inaccurate' : 'Inaccurate', 'warn',
      `Scatters ${n === 1 ? 'once' : `${n} times`} from the intended square, then lands.`);
    afterRoll({
      onConfirm: async () => { await runScatter('throw', n); armLanding(); },
      rerollFn: doThrow,
    });
  }

  const D8A = { 1: '↖', 2: '↑', 3: '↗', 4: '←', 5: '→', 6: '↙', 7: '↓', 8: '↘' };
  const D8N = { 1: 'Up-Left', 2: 'Up', 3: 'Up-Right', 4: 'Left', 5: 'Right', 6: 'Down-Left', 7: 'Down', 8: 'Down-Right' };

  async function runScatter(key, numDice) {
    const content = seqChips[key];
    if (!content) return;
    const host = el('div', 'pwiz3-scatter');
    content.appendChild(host);
    host.appendChild(el('div', 'pwiz3-scatter-title', `Scatter — ${numDice} × D8`));
    const cardsRow = el('div', 'pwiz3-scatter-row');
    host.appendChild(cardsRow);
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
      if (wizardMode('throw') === 'physical') {
        d = await window.DiceSlot.direction(card, 'Enter the scatter direction');
        Dice.setDieValue(dieEl, d);
      } else {
        d = await Dice.rollDieElement(dieEl);
      }
      resEl.innerHTML = `<span class="pwiz3-scatter-arrow">${D8A[d]}</span> ${D8N[d]}`;
      const scrollHost = host.closest('.bwiz-result-content');
      if (scrollHost) scrollHost.scrollTop = scrollHost.scrollHeight;
    }
  }

  function armLanding() {
    setSeqActive('land');
    armRoll('Roll Landing', doLanding);
  }

  async function doLanding() {
    setSeqActive('land');
    rollBtnEl().disabled = true;
    const target = landTarget();
    const roll = await rollDie();
    const mod = -ws.landingTZ + (thnTraits().landing ? 1 : 0);
    const safe = roll !== 1 && (roll + mod) >= 4;

    if (safe) {
      seqResult('land', roll, 'Safe Landing!', 'ok',
        `Rolled ${roll}${mod ? ` (→ ${roll + mod})` : ''} vs 4+ — sticks the landing and may act on if not yet activated.`);
      afterRoll({ onConfirm: () => finish('Safe Landing — Close'), rerollFn: doLanding });
      return;
    }
    seqResult('land', roll, 'Crash Landing!', 'bad',
      roll === 1 ? 'Natural 1 always fails — knocked down. Roll Armour.'
                 : `Rolled ${roll}${mod ? ` (→ ${roll + mod})` : ''} vs 4+ — knocked down. Roll Armour.`);
    afterRoll({ onConfirm: armArmour, rerollFn: doLanding });
  }

  function armArmour() {
    setSeqActive('armour');
    armRoll('Roll Armour', doArmour);
  }

  async function doArmour() {
    setSeqActive('armour');
    rollBtnEl().disabled = true;
    const tn = thnTraits();
    const [a1, a2] = await rollTwoDice();
    const armour = BBResolve.armourBreaks(a1, a2, { av: tn.av, ironHard: tn.ironHard });
    if (!armour.broke) {
      seqResult('armour', `${a1} + ${a2}`, 'Armor Holds', 'ok',
        `${armour.shown} vs AV ${tn.av}+${tn.ironHard ? ' · Iron Hard Skin' : ''} — prone but unhurt.`);
      afterRoll({ onConfirm: () => finish('Armour Holds — Prone — Close') });
      return;
    }
    seqResult('armour', `${a1} + ${a2}`, 'Armor Broken!', 'bad',
      `${armour.shown} vs AV ${tn.av}+ — roll the Injury.`);
    afterRoll({ onConfirm: () => { setSeqActive('inj'); armRoll('Roll Injury', doInjury); } });
  }

  async function doInjury() {
    rollBtnEl().disabled = true;
    const tn = thnTraits();
    const [i1, i2] = await rollTwoDice();
    const inj = BBResolve.injuryOutcome(i1, i2, { stunty: tn.stunty, thickSkull: tn.thickSkull });
    seqResult('inj', `${i1} + ${i2}`, `${ws.thrown?.name || 'Player'} ${inj.outcome}!`,
      inj.outcome === 'Stunned' ? 'warn' : 'bad',
      `${i1} + ${i2}${tn.stunty ? ' +1 Stunty' : ''} = ${inj.total}`);
    BBResolve.applyStatus(ws.activeSide, ws.thrown.idx, inj.status);
    window.logGameEvent?.('injury', { side: ws.activeSide, idx: ws.thrown?.idx, status: inj.status,
      detail: `${ws.thrown?.name || 'Player'} — crash landing (${inj.outcome})` });

    if (inj.outcome === 'Casualty') {
      const decay = tn.decay ? 1 : 0;
      let casVal, cas;
      if (wizardMode('throw') === 'physical') {
        const entered = await window.DiceSlot.d16(seqChips['inj']?.closest('.pwiz3-result-panel') ?? document.body);
        casVal = Math.min(16, entered + decay);
        cas = rangeFind(window.BBData?.injury?.casualty, casVal) ?? { result: 'Unknown', desc: '' };
      } else {
        ({ casVal, cas } = BBResolve.rollCasualty(decay));
      }
      const slot = seqChips['inj'];
      if (slot) {
        slot.innerHTML +=
          `<div class="bwiz-result-headline bwiz-result-bad">${esc(cas.result)}</div>` +
          (cas.desc ? `<p class="bwiz-result-note bad">${esc(cas.desc)}</p>` : '') +
          `<p class="pwiz3-result-roll">Casualty D16: ${casVal}${decay ? ' (+1 Decay)' : ''}</p>`;
      }
    }
    finish('Crash Resolved — Close');
  }

  /* ── Boot ── */
  onPanelOpen('panel-throw', () => {
    /* One throw per activation — reset fully each open. */
    ws.thrower = null; ws.thrown = null;
    ws.rangeTarget = 4; ws.useHailMary = false; ws.landingTZ = 0;
    ws.activeSide = window.activeRosterSide?.() ?? 'left';
    buildLayout();
  });

  panel.addEventListener('bb:diceMode', () => { /* dice mode picked up on next roll */ });
}

document.addEventListener('DOMContentLoaded', initThrowTeammateWizard);
