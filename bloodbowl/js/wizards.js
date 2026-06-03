'use strict';

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Blood Bowl Companion â€” js/wizards.js
   Block, Pass, Foul, Throw Team-Mate wizards.
   Depends on: dice.js, panels.js (BBData), settings.js, physical-dice.js
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   BLOCK DIE
   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

/* Nuffle Dice font character map (see Nuffle Dice.woff2):
   J=push arrow, K=attacker down skull, L=both down burst,
   M=stumble burst, N=defender down skull, O-T=weather icons */
const NUFFLE_NUM  = n => String.fromCharCode(64 + n); // A=1 â€¦ I=9
const NUFFLE_WEATHER = { verySunny:'O', nice:'P', pouringRain:'Q', blizzard:'R', sweltering:'S', heavyRain:'T' };

const BLOCK_FACES = [
  null,
  { key: 'att-down',  label: 'Attacker Down', sym: 'K', cls: 'att-down',  colour: 'var(--bb-red,#C8102E)' },
  { key: 'both-down', label: 'Both Down',      sym: 'L', cls: 'both-down', colour: '#BB4400' },
  { key: 'push',      label: 'Push',           sym: 'J', cls: 'push',      colour: '#888' },
  { key: 'push',      label: 'Push',           sym: 'J', cls: 'push',      colour: '#888' },
  { key: 'stumble',   label: 'Stumble',        sym: 'M', cls: 'stumble',   colour: '#774400' },
  { key: 'def-down',  label: 'Defender Down',  sym: 'N', cls: 'def-down',  colour: '#1B5E20' },
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   SHARED UTILITIES
   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   BLOCK WIZARD  (full rebuild)
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

/* Skills that affect block outcomes */
const ATT_BLOCK_SKILLS = new Set([
  'Block','Wrestle','Juggernaut','Fend','Mighty Blow',
  'Dauntless','Horns','Multiple Block','Claws',
]);
const DEF_BLOCK_SKILLS = new Set([
  'Dodge','Fend','Stand Firm','Side Step','Wrestle',
  'Tentacles','Grab','Thick Skull',
]);

function initBlockWizard() {
  const panel      = document.getElementById('panel-block');
  const rollBtn    = document.getElementById('block-roll-btn');
  const confirmBtn = document.getElementById('block-confirm-btn');
  const defBanner  = document.getElementById('block-def-picks-banner');
  if (!rollBtn) return;

  /* â”€â”€ State â”€â”€ */
  let attST = 3, defST = 3, attAst = 0, defAst = 0;
  let attSkills = new Set(), defSkills = new Set();
  let attAV = 9, defAV = 9;          // armor values (parsed from statsText)
  let attPlayer = null, defPlayer = null;
  let rolledFaces = [];              // array of BLOCK_FACES[n] objects from last roll
  let chosenFace  = null;            // the face the user confirmed
  let rrUsed      = false;           // team re-roll consumed this action

  /* â”€â”€ Phase 1a fix: "over double" is strictly > not >= â”€â”€ */
  function calcBlock() {
    const a = attST + attAst;
    const d = defST + defAst;
    if (a > d * 2)  return { count: 3, who: 'attacker picks', attFav: true  };
    if (a > d)      return { count: 2, who: 'attacker picks', attFav: true  };
    if (a === d)    return { count: 1, who: '',               attFav: null  };
    if (d > a * 2)  return { count: 3, who: 'defender picks', attFav: false };
    return                 { count: 2, who: 'defender picks', attFav: false };
  }

  /* â”€â”€ ST compare display â”€â”€ */
  function updateStDisplay() {
    const compareEl = document.getElementById('block-st-compare');
    if (!compareEl) return;
    const { count, who } = calcBlock();
    const a = attST + attAst, d = defST + defAst;
    const attTxt = attAst ? `ST ${a} (${attST}+${attAst})` : `ST ${a}`;
    const defTxt = defAst ? `ST ${d} (${defST}+${defAst})` : `ST ${d}`;
    const pickerTxt = who ? ` â€” ${who}` : '';
    compareEl.textContent = `${attTxt} vs ${defTxt} Â· ${count} ${count === 1 ? 'die' : 'dice'}${pickerTxt}`;
    renderDiceTray(count);
    renderRerolls();
  }

  /* â”€â”€ Dice tray â”€â”€ */
  function renderDiceTray(count) {
    const tray = document.getElementById('block-dice-tray');
    if (!tray) return;
    tray.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const face = document.createElement('div');
      face.id = `block-face-${i}`;
      buildBlockFace(face, 3); // default to push
      tray.appendChild(face);
    }
  }

  /* â”€â”€ Assist dots â”€â”€ */
  function renderAssistDots(elId, count, teamSide, onChangeFn) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = '';
    const label = document.createElement('div');
    label.className = 'bwiz-assists-label';
    label.textContent = 'Assists';
    el.appendChild(label);
    const row = document.createElement('div');
    row.className = 'bwiz-assists-row';
    let active = 0;
    for (let i = 1; i <= 6; i++) {
      const dot = document.createElement('button');
      dot.className = 'assist-dot';
      dot.dataset.n = i;
      dot.setAttribute('aria-label', `${i} assist${i > 1 ? 's' : ''}`);
      dot.addEventListener('click', () => {
        active = (active === i) ? i - 1 : i;
        updateDots();
        onChangeFn(active);
      });
      row.appendChild(dot);
    }
    function updateDots() {
      row.querySelectorAll('.assist-dot').forEach((d, idx) => {
        d.classList.toggle('active', idx < active);
      });
    }
    el.appendChild(row);
  }

  /* â”€â”€ Re-roll dots â”€â”€ */
  function renderRerolls() {
    const el = document.getElementById('block-rerolls');
    if (!el) return;
    const gs      = window.GameState;
    const rrTotal = gs?.rerolls?.home ?? 0;  // attacker is always left = home
    el.innerHTML  = '';
    for (let i = 0; i < Math.max(rrTotal, 1); i++) {
      const dot = document.createElement('button');
      dot.className = 'bwiz-rr-dot' + (i < rrTotal ? '' : ' spent') + (rrUsed ? ' used' : '');
      dot.setAttribute('aria-label', 'Use team re-roll');
      dot.disabled = rrUsed || rrTotal === 0 || rolledFaces.length === 0 || chosenFace !== null;
      dot.addEventListener('click', () => {
        if (rrUsed || !gs || gs.rerolls.home <= 0 || rolledFaces.length === 0) return;
        gs.rerolls.home = Math.max(0, gs.rerolls.home - 1);
        rrUsed = true;
        /* Sync game-bar pip */
        document.querySelectorAll('#rr-home .rr-pip').forEach((pip, idx) => {
          pip.classList.toggle('used', idx >= gs.rerolls.home);
        });
        doRoll();
      });
      el.appendChild(dot);
    }
    if (rrUsed) {
      const note = document.createElement('div');
      note.className = 'bwiz-rr-used-note';
      note.textContent = 'Used';
      el.appendChild(note);
    }
  }

  /* â”€â”€ Embedded trading card â”€â”€ */
  function buildEmbeddedCard(wrapEl, player, side) {
    /* Remove any existing card but leave the picker div intact */
    wrapEl.querySelectorAll('.bwiz-embedded-card').forEach(c => c.remove());

    const team     = window.state?.[side]?.team;
    const isStar   = player.isStarPlayer;
    const colors   = team?.colors ?? {};
    const imgDir   = team?.imageDir ?? 'images/';
    const bgColor  = (window.POSITION_COLORS ?? {})[player.position] || '#1a3a6a';

    /* Parse AV from statsText: "AV 9+" â†’ 9 */
    const avMatch = player.statsText?.match(/\bAV\s*(\d+)/i);
    const avVal   = avMatch ? parseInt(avMatch[1], 10) : 9;
    if (side === 'left') attAV = avVal; else defAV = avVal;

    /* Parse all stats */
    const statLabels = ['MA','ST','AG','PA','AV'];
    const statVals   = statLabels.map(k => {
      const m = player.statsText?.match(new RegExp(`\\b${k}\\s*([\\d+]+)`, 'i'));
      return m ? m[1] : 'â€”';
    });

    /* Skills */
    const skills = getPlayerSkills(player);

    const card = document.createElement('div');
    card.className = 'trading-card bwiz-embedded-card' + (isStar ? ' star-card' : '');

    /* Apply team colors */
    const COLOR_PROP_MAP = {
      primary:'--tc-primary', primaryDark:'--tc-primary-dark',
      accent:'--tc-accent', gold:'--tc-gold', goldDark:'--tc-gold-dark',
    };
    Object.entries(COLOR_PROP_MAP).forEach(([k, prop]) => {
      if (colors[k]) card.style.setProperty(prop, colors[k]);
    });

    card.innerHTML = `
      <div class="modal-image-area" style="background:${bgColor};">
        <img class="modal-img" src="${imgDir}Player${player.id}.png" alt="${esc(player.name)}">
        <span class="img-placeholder-num" aria-hidden="true">${player.id}</span>
        <div class="modal-card-overlay${isStar ? ' star-overlay' : ''}">
          <div class="modal-jersey-circle">${player.id}</div>
          <div class="modal-overlay-info">
            <h2 class="modal-name">${esc(player.name)}</h2>
            <p class="modal-position">${esc(player.position)}</p>
          </div>
        </div>
      </div>
      <div class="modal-stats">
        <div class="modal-stats-row">
          ${statLabels.map((l, i) => `
            <div class="modal-stat">
              <span class="ms-label">${l}</span>
              <span class="ms-value">${statVals[i]}</span>
            </div>`).join('')}
        </div>
      </div>
      <div class="modal-skills">
        <p class="skills-label">Skills &amp; Traits</p>
        <p class="skills-text">${skills.length ? skills.map(s => `<span class="skill-link">${esc(s)}</span>`).join('<span class="skill-sep">, </span>') : '<span class="no-skills">â€”</span>'}</p>
      </div>
    `;

    /* Hide img if it errors */
    const img  = card.querySelector('.modal-img');
    const stub = card.querySelector('.img-placeholder-num');
    img.addEventListener('load',  () => { stub.style.display = 'none'; });
    img.addEventListener('error', () => { img.style.display  = 'none'; });

    wrapEl.appendChild(card);
  }

  /* â”€â”€ Load block-relevant skills into side column â”€â”€ */
  function loadBlockSkills(side, player) {
    const colId    = side === 'att' ? 'block-att-skills-col' : 'block-def-skills-col';
    const whitelist = side === 'att' ? ATT_BLOCK_SKILLS : DEF_BLOCK_SKILLS;
    const col      = document.getElementById(colId);
    if (!col) return;

    const heading = col.querySelector('.bwiz-skills-heading');
    col.innerHTML = '';
    if (heading) col.appendChild(heading);

    const skills = getPlayerSkills(player).filter(s => whitelist.has(s));
    const store  = side === 'att' ? attSkills : defSkills;
    store.clear();
    skills.forEach(s => store.add(s));

    if (!skills.length) {
      const empty = document.createElement('div');
      empty.className = 'bwiz-skills-empty';
      empty.textContent = 'No relevant skills';
      col.appendChild(empty);
      return;
    }

    /* Reuse .sk-card tiles from skills page */
    skills.forEach(name => {
      const tile = document.createElement('div');
      tile.className = 'bwiz-skill-tile';
      tile.textContent = name;
      col.appendChild(tile);
    });
  }

  /* â”€â”€ Show picker for a side (hide card) â”€â”€ */
  function showPicker(side) {
    const wrap   = document.getElementById(`block-${side}-card-wrap`);
    const picker = document.getElementById(`block-${side}-picker`);
    if (!picker || !wrap) return;
    wrap.querySelectorAll('.bwiz-embedded-card').forEach(c => c.remove());
    picker.hidden = false;
    buildWizardPlayerList(
      side === 'att' ? 'block-attacker-list' : 'block-defender-list',
      side === 'att' ? 'left' : 'right',
      side === 'att'
        ? (p => { const PS = window.PlayerStatus; return p.status === PS?.AVAILABLE || p.status === PS?.PRONE || p.status === PS?.STUNNED; })
        : (() => true),
      (player, stats) => {
        /* Player selected: build card, load skills, set ST */
        if (side === 'att') {
          attPlayer = player;
          attST = stats.st ?? 3;
          picker.hidden = true;
          buildEmbeddedCard(wrap, player, 'left');
          loadBlockSkills('att', player);
        } else {
          defPlayer = player;
          defST = stats.st ?? 3;
          picker.hidden = true;
          buildEmbeddedCard(wrap, player, 'right');
          loadBlockSkills('def', player);
        }
        resetRoll();
        updateStDisplay();
      },
    );
  }

  /* â”€â”€ Change buttons â”€â”€ */
  document.getElementById('block-change-att')?.addEventListener('click', () => showPicker('att'));
  document.getElementById('block-change-def')?.addEventListener('click', () => showPicker('def'));

  /* â”€â”€ Assist dots â”€â”€ */
  renderAssistDots('block-att-assists-dots', 6, 'left',  v => { attAst = v; updateStDisplay(); });
  renderAssistDots('block-def-assists-dots', 6, 'right', v => { defAst = v; updateStDisplay(); });

  /* â”€â”€ Reset all roll state â”€â”€ */
  function resetRoll() {
    rolledFaces = [];
    chosenFace  = null;
    rrUsed      = false;
    rollBtn.hidden     = false;
    rollBtn.disabled   = false;
    if (confirmBtn) confirmBtn.hidden = true;
    if (defBanner)  defBanner.hidden  = true;
    /* Lock result panels */
    ['block-result-panel','armor-roll-panel','injury-roll-panel'].forEach(id => {
      document.getElementById(id)?.classList.add('locked');
    });
    document.getElementById('block-result-content').textContent  = 'â€”';
    document.getElementById('armor-result-content').textContent  = 'â€”';
    document.getElementById('injury-result-content').textContent = 'â€”';
    document.getElementById('armor-roll-btn')?.setAttribute('hidden','');
    document.getElementById('injury-roll-btn')?.setAttribute('hidden','');
    renderDiceTray(calcBlock().count);
    renderRerolls();
  }

  /* â”€â”€ Phase 1b+1c: interpret chosen face with active skills â”€â”€ */
  function interpretResult(face) {
    const key = face.key;
    let knockedSide = null;  // 'att' | 'def' | 'both' | null

    if (key === 'att-down') {
      knockedSide = 'att';
      showBlockResult(`Attacker Down â€” Turnover!`, 'bad');
    } else if (key === 'both-down') {
      if (attSkills.has('Block')) {
        knockedSide = 'def';
        showBlockResult('Both Down â€” Block! Only defender falls.', 'ok');
      } else if (attSkills.has('Wrestle')) {
        knockedSide = 'both';
        showBlockResult('Both Down â€” Wrestle! Both fall. No armor rolls.', 'warn');
        knockedSide = null; // Wrestle: both fall but no armor for either
      } else {
        knockedSide = 'both';
        showBlockResult('Both Down â€” both players fall. Armor for both.', 'bad');
      }
    } else if (key === 'push') {
      showBlockResult('Push Back â€” defender shoved. Attacker may follow up.', 'ok');
    } else if (key === 'stumble') {
      if (defSkills.has('Dodge')) {
        showBlockResult('Stumble â€” Dodge! Treated as Push Back.', 'ok');
      } else {
        knockedSide = 'def';
        showBlockResult('Stumble â€” Pow! Defender knocked down.', 'ok');
      }
    } else if (key === 'def-down') {
      knockedSide = 'def';
      showBlockResult('Defender Down â€” roll Armor!', 'ok');
    }

    /* Unlock armor roll if someone is knocked down */
    if (knockedSide === 'def' || knockedSide === 'att') {
      unlockArmorRoll(knockedSide);
    } else if (knockedSide === 'both') {
      /* Both down without Wrestle: armor for both â€” show defender's armor for now */
      unlockArmorRoll('def');
    }
  }

  function showBlockResult(text, cls) {
    const panel   = document.getElementById('block-result-panel');
    const content = document.getElementById('block-result-content');
    if (panel)   panel.classList.remove('locked');
    if (content) {
      content.textContent  = text;
      content.className    = `bwiz-result-content bwiz-result-${cls}`;
    }
  }

  /* â”€â”€ Armor roll â”€â”€ */
  function unlockArmorRoll(knockedSide) {
    const armorPanel = document.getElementById('armor-roll-panel');
    const armorBtn   = document.getElementById('armor-roll-btn');
    const armorNote  = document.getElementById('armor-result-content');
    if (!armorPanel) return;

    const av  = knockedSide === 'att' ? attAV : defAV;
    const who = knockedSide === 'att' ? 'Attacker' : 'Defender';
    const mb  = attSkills.has('Mighty Blow') && knockedSide === 'def' ? 1 : 0;
    const claws = attSkills.has('Claws') && knockedSide === 'def';

    armorPanel.classList.remove('locked');
    armorNote.textContent = `${who} AV ${av}+${mb ? ' (+1 Mighty Blow)' : ''}${claws ? ' (Claws: 8+ breaks)' : ''}`;
    armorBtn.removeAttribute('hidden');

    armorBtn.onclick = () => rollArmor(av, mb, claws, knockedSide);
  }

  async function rollArmor(av, mightyBlowBonus, claws, knockedSide) {
    const armorBtn   = document.getElementById('armor-roll-btn');
    const tray       = document.getElementById('armor-dice-tray');
    const resultEl   = document.getElementById('armor-result-content');
    if (armorBtn) armorBtn.disabled = true;

    /* Roll 2D6 */
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    let total = d1 + d2 + mightyBlowBonus;

    if (tray) {
      tray.textContent = `${d1} + ${d2}${mightyBlowBonus ? ` +${mightyBlowBonus}` : ''} = ${total}`;
    }

    const breaks = claws ? (d1 + d2 >= 8) : (total >= av);
    if (resultEl) {
      resultEl.textContent = breaks ? `Armor broken! (${total} vs ${av}+)` : `Armor holds. (${total} vs ${av}+)`;
      resultEl.className   = `bwiz-result-content bwiz-result-${breaks ? 'ok' : 'warn'}`;
    }

    if (breaks) {
      await pause(300);
      unlockInjuryRoll(knockedSide);
    }
    if (armorBtn) armorBtn.disabled = false;
  }

  /* â”€â”€ Injury roll â”€â”€ */
  function unlockInjuryRoll(knockedSide) {
    const injPanel = document.getElementById('injury-roll-panel');
    const injBtn   = document.getElementById('injury-roll-btn');
    if (!injPanel) return;

    injPanel.classList.remove('locked');
    const mb = attSkills.has('Mighty Blow') && knockedSide === 'def' ? 1 : 0;
    document.getElementById('injury-result-content').textContent =
      `Ready to roll${mb ? ' (+1 Mighty Blow)' : ''}`;
    injBtn.removeAttribute('hidden');
    injBtn.onclick = () => rollInjury(knockedSide, mb);
  }

  async function rollInjury(knockedSide, mightyBlowBonus) {
    const injBtn  = document.getElementById('injury-roll-btn');
    const tray    = document.getElementById('injury-dice-tray');
    const result  = document.getElementById('injury-result-content');
    if (injBtn) injBtn.disabled = true;

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const total = d1 + d2 + mightyBlowBonus;

    if (tray) {
      tray.textContent = `${d1} + ${d2}${mightyBlowBonus ? ` +${mightyBlowBonus}` : ''} = ${total}`;
    }

    let outcome, status, statusLabel;
    if (total <= 7)       { outcome = 'Stunned';   status = window.PlayerStatus?.STUNNED;      statusLabel = 'STUNNED';    }
    else if (total <= 9)  { outcome = "KO'd";      status = window.PlayerStatus?.KO;           statusLabel = 'KO';         }
    else                  { outcome = 'Casualty';  status = window.PlayerStatus?.BADLY_HURT;   statusLabel = 'BADLY HURT'; }

    const extra = total >= 10 ? ' â€” Pro mode has full casualty table.' : '';
    if (result) {
      result.textContent = `${outcome} (${total})${extra}`;
      result.className   = `bwiz-result-content bwiz-result-${total <= 7 ? 'warn' : 'bad'}`;
    }

    /* Update roster status */
    const targetPlayer = knockedSide === 'att' ? attPlayer : defPlayer;
    const targetSide   = knockedSide === 'att' ? 'left' : 'right';
    if (targetPlayer && status !== undefined && window.GameState) {
      window.GameState.setPlayerStatus?.(targetSide, targetPlayer.idx, status);
    }

    if (injBtn) injBtn.disabled = false;
  }

  /* â”€â”€ Main roll â”€â”€ */
  async function doRoll() {
    rollBtn.disabled   = true;
    if (confirmBtn) confirmBtn.hidden = true;
    if (defBanner)  defBanner.hidden  = true;
    chosenFace = null;

    const { count, attFav } = calcBlock();
    renderDiceTray(count);

    const faces = Array.from({ length: count }, (_, i) => document.getElementById(`block-face-${i}`));
    const rolls = await Promise.all(faces.map(f => rollBlockDie(f)));
    rolledFaces  = rolls.map(r => BLOCK_FACES[r]);

    rollBtn.disabled = false;
    renderRerolls(); // update so re-roll btn reflects new roll state

    /* Make dice clickable for selection */
    faces.forEach((faceEl, i) => {
      faceEl.classList.add('bwiz-die-selectable');
      faceEl.style.cursor = 'pointer';
      faceEl.addEventListener('click', () => selectDie(i), { once: false });
    });

    /* Auto-select first die; if defender picks, show banner */
    if (attFav !== false) {
      selectDie(0);
    } else {
      if (defBanner) defBanner.hidden = false;
    }
    if (confirmBtn) confirmBtn.hidden = false;
  }

  function selectDie(idx) {
    const faces = document.querySelectorAll('#block-dice-tray .block-face');
    faces.forEach((f, i) => f.classList.toggle('bwiz-die-selected', i === idx));
    chosenFace = rolledFaces[idx];
  }

  confirmBtn?.addEventListener('click', () => {
    if (!chosenFace) return;
    confirmBtn.hidden = true;
    if (defBanner) defBanner.hidden = true;
    /* Remove click listeners by cloning dice */
    document.querySelectorAll('#block-dice-tray .block-face').forEach(f => {
      const clone = f.cloneNode(true);
      f.replaceWith(clone);
    });
    interpretResult(chosenFace);
  });

  /* â”€â”€ Init â”€â”€ */
  updateStDisplay();
  resetRoll();

  /* Reset a side's card when its roster changes (team swap while panel is open) */
  function watchRosterForReset(rosterId, side) {
    const roster = document.getElementById(rosterId);
    if (!roster) return;
    new MutationObserver(() => {
      if (panel?.hasAttribute('hidden')) return; // panel closed — ignore
      if (side === 'att') { attPlayer = null; attST = 3; attAst = 0; attSkills.clear(); }
      else                { defPlayer = null; defST = 3; defAst = 0; defSkills.clear(); }
      showPicker(side);
      updateStDisplay();
    }).observe(roster, { childList: true });
  }
  watchRosterForReset('roster-left',  'att');
  watchRosterForReset('roster-right', 'def');

  /* Open picker on panel open */
  onPanelOpen('panel-block', () => {
    resetRoll();
    showPicker('att');
    showPicker('def');
    updateStDisplay();
    renderRerolls();
  });

  rollBtn.addEventListener('click', doRoll);
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   PASS WIZARD  (Sprint 3 rebuild â€” 8-step sequence)
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

/* â”€â”€ Skill extraction from a player card DOM element â”€â”€ */
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

/* â”€â”€ Shared skill-use prompt â€” returns Promise<boolean>
   Renders inline Yes/No buttons in `containerEl`.
   Resolves true if the user chooses to use the skill, false otherwise.

   Example: const used = await promptSkillUse(ws.thrower, 'Pro', throwRes, rollD6);
   If used: caller should re-roll the original die and handle new result.

   For Pro specifically: on click "Use Pro", roll D6 automatically.
   If result >= 4 â†’ resolve true (caller may re-roll).
   If result < 4  â†’ resolve false (Pro failed, proceed to failure path). */
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
        proRes.textContent = proOk ? `${proVal} âœ“ Pro succeeds â€” re-roll!` : `${proVal} âœ— Pro failed.`;
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

/* Parse a stat value from the card stats text (e.g. "AG3+" â†’ 3, "PAâ€”" â†’ null) */
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



/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   FOUL WIZARD
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

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

  /* phys=true â†’ no doubles check, no per-die breakdown */
  function processFoulArmourRoll(d1, d2, total, phys = false) {
    const bon        = bonus();
    const modded     = total + bon;
    const isDoubles  = !phys && d1 !== null && d1 === d2;
    const bonusNote  = bon > 0 ? ` + ${bon} (assists${mods['dirty-player'] ? ' + Dirty Player' : ''})` : '';
    const doubleFlag = isDoubles ? `<div class="result-effect">âš ï¸ Natural Double â€” referee may have spotted it!</div>` : '';
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
        <p class="result-desc">Rolling Injury tableâ€¦</p>
      `;
      avResEl.hidden = false;
    }

    if (isDoubles && refResEl) {
      refResEl.innerHTML = `
        <div class="result-name" style="color:#FF8C00;">âš ï¸ Referee Spots the Foul!</div>
        <p class="result-desc">A natural double â€” the fouling player is Sent Off! <strong>Argue the Call</strong>: D6 â€” on 6 player stays; on 1 Head Coach ejected; 2â€“5 call stands. A <em>Bribe</em> avoids ejection entirely (2+ succeeds).</p>
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
          <div class="result-roll-breakdown">${i1} + ${i2} â€” Injury table${mods.stunty ? ' (Stunty)' : ''}</div>
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
        if (casResEl) { casResEl.innerHTML = `<p class="result-desc" style="margin:0">Rolling Casualty table (D16)â€¦</p>`; casResEl.hidden = false; }
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

  /* â”€â”€ Physical foul armour buttons â”€â”€ */
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
        /* For physical mode doubles detection is not possible â€” skip referee check */
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
            <div class="result-roll-breakdown">Physical â€” Injury table${mods.stunty ? ' (Stunty)' : ''}</div>
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
            <div class="result-roll-breakdown">Physical â€” Casualty Table (D16)</div>
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

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   THROW TEAM-MATE WIZARD  (Sprint 4 rebuild â€” 8-step)
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

function initThrowWizard() {
  const panel = document.getElementById('panel-throw');
  if (!panel) return;

  /* â”€â”€ Wizard state â”€â”€ */
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

  /* â”€â”€ Shell builder â”€â”€ */
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
    navEl.innerHTML = `<button class="pass-nav-btn" id="twiz-back">â† Back</button><button class="pass-nav-btn nav-primary" id="twiz-next">Next â†’</button>`;
    body.appendChild(navEl);
    document.getElementById('twiz-back').addEventListener('click', () => go(ws.step - 1));
    document.getElementById('twiz-next').addEventListener('click', () => go(ws.step + 1));
  }

  /* â”€â”€ Step definitions â”€â”€ */
  const ALL_STEPS = [
    { id: 1, label: 'Thrower'  },
    { id: 2, label: 'Thrown'   },
    { id: 3, label: 'Range'    },
    { id: 4, label: 'ðŸ– Hungry' },
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

  /* â”€â”€ Render â”€â”€ */
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
      nextBtn.textContent = ws.step === lastStep ? 'Done âœ“' : 'Next â†’';
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

  /* â”€â”€ Summary strip â”€â”€ */
  function updateSummary() {
    const el = document.getElementById('twiz-summary');
    if (!el) return;
    const thrName  = ws.thrower?.name ?? 'â€”';
    const thnName  = ws.thrown?.name  ?? 'â€”';
    const rng      = ws.rangeTarget === 4 ? 'Short' : 'Long';
    const res      = ws.throwResult ?? (ws.hungryResult === 'eaten' ? 'ðŸ– Eaten!' : 'â€”');
    const resCls   = ws.throwResult === 'superb' || ws.throwResult === 'accurate' ? 'ok'
                   : (ws.throwResult === 'fumble' || ws.hungryResult === 'eaten') ? 'bad' : '';
    el.innerHTML = `
      <span class="pass-sum-name">${esc(thrName)}</span>
      <span class="pass-sum-sep">â‡’</span>
      <span class="pass-sum-name">${esc(thnName)}</span>
      <span class="pass-sum-sep">|</span>
      <span class="pass-sum-range">${rng} (${ws.rangeTarget}+)</span>
      <span class="pass-sum-sep">|</span>
      <span class="pass-sum-result ${resCls}">${esc(res)}</span>
    `;
  }

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
     STEP 1: THROWER â€” must have Throw Team-Mate trait
     â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
        if (ws.hasAlwaysHungry) chips.innerHTML += `<span class="pwiz-skill-chip neg">ðŸ– Always Hungry</span>`;
        if (ws.hasStrongArm)    chips.innerHTML += `<span class="pwiz-skill-chip pos">ðŸ’ª Strong Arm +1</span>`;
        if (ws.hasHailMary)     chips.innerHTML += `<span class="pwiz-skill-chip pos">Hail Mary Pass</span>`;
        if (ws.hasBullseye)     chips.innerHTML += `<span class="pwiz-skill-chip pos">ðŸŽ¯ Bullseye</span>`;
        if (chips.innerHTML) el.appendChild(chips);
      },
    });
  }

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
     STEP 2: THROWN PLAYER â€” must have Right Stuff trait
     â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
     STEP 3: RANGE & OPTIONS
     â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
     { label: 'Long (5+)',  target: 5, desc: '4â€“6 squares' }].forEach(opt => {
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
      chipRow.innerHTML = `<span class="pwiz-skill-chip pos">ðŸ’ª Strong Arm: +1 to throw roll</span>`;
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
        bar.innerHTML = `<span class="pwiz-target-num">â€”</span><span class="pwiz-target-note"> Hail Mary â€” always inaccurate (fumble on 1)</span>`;
      } else {
        const eff = Math.max(2, ws.rangeTarget - ws.strongArmMod);
        bar.innerHTML = `<span class="pwiz-target-num">${eff}+</span><span class="pwiz-target-note"> on D6${ws.strongArmMod ? ` (base ${ws.rangeTarget}+, Strong Arm +1)` : ''}</span>`;
      }
    }
    refreshTargetDisplay();
  }

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
     STEP 4: ALWAYS HUNGRY (conditional)
     â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function renderHungry(el) {
    el.innerHTML = `<div class="pwiz-step-title">ðŸ– Always Hungry Check</div>
      <p class="panel-intro" style="margin-bottom:0.6rem;">The thrower has <strong>Always Hungry</strong>. Roll D6 â€” on a 2+ the throw proceeds. On a 1, the thrower can't resist and devours the team-mate!</p>`;

    const resultEl = document.createElement('div');
    resultEl.className = 'roll-result'; resultEl.hidden = true;

    function processHungry(roll) {
      ws.hungryResult = roll === 1 ? 'eaten' : 'ok';
      if (roll === 1) {
        resultEl.innerHTML = `
          <div class="result-roll-num">1</div>
          <div class="result-name result-cas">ðŸ– Teammate Eaten!</div>
          <p class="result-desc">The thrower couldn't resist! The thrown player is removed from the pitch as a Casualty â€” they suffer a <strong>Badly Hurt</strong> result (no Casualty roll). The action ends immediately.</p>
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
      btn.innerHTML = '<span class="roll-btn-icon">ðŸŽ²</span> Roll Always Hungry (need 2+)';
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
            ? { value: 1, label: 'ðŸ– Eaten!', cls: 'phys-bad' }
            : { value: r, label: 'Proceed',   cls: 'phys-good' };
        }),
        onSelect(r) { processHungry(r); },
      });
      el.appendChild(zone);
    }

    el.appendChild(resultEl);
  }

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
     STEP 5: THROW ROLL
     Outcomes: Natural 1 = Fumble, Natural 6 = Superb,
     â‰¥ target = Accurate, < target = Inaccurate
     â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
          desc = "Natural 1 â€” Hail Mary fails! The team-mate is placed in the thrower's square and removed as a Casualty (Badly Hurt).";
        } else {
          outcome = 'inaccurate'; title = 'Hail Mary â€” Inaccurate'; cls = 'result-ko';
          desc = `Roll ${roll}. Hail Mary always scatters â€” the team-mate deviates once from the intended landing square. They must still make a Landing roll wherever they land.`;
        }
      } else if (roll === 1) {
        outcome = 'fumble'; title = 'Fumble!'; cls = 'result-cas';
        desc = "Natural 1 â€” the throw fails catastrophically! The team-mate is placed in the thrower's square and removed as a Casualty (Badly Hurt). Turnover!";
      } else if (roll === 6) {
        outcome = 'superb'; title = 'â˜… Superb Throw!'; cls = 'result-ok';
        if (ws.hasBullseye) {
          desc = `Natural 6 â€” Superb! The team-mate lands precisely on target. With the Bullseye trait, no Landing roll is required!`;
        } else {
          desc = `Natural 6 â€” Superb throw! The team-mate lands precisely on target. Make a Landing roll now.`;
        }
      } else if (roll >= effTarget) {
        outcome = 'accurate'; title = 'Accurate Throw!'; cls = 'result-ok';
        desc = `Roll ${roll} vs ${effTarget}+ â€” the team-mate lands on target. Make a Landing roll.`;
      } else {
        outcome = 'inaccurate'; title = 'Inaccurate Throw'; cls = 'result-ko';
        desc = `Roll ${roll} vs ${effTarget}+ â€” the team-mate scatters 3 times from the intended square. Make a Landing roll in their final position.`;
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
        else go(7); /* superb/accurate â†’ landing (or skip if Bullseye) */
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
      btn.innerHTML = '<span class="roll-btn-icon">ðŸŽ²</span> Roll Throw';
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
            label = 'â˜… Superb!'; cls = 'phys-good';
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

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
     STEP 6: SCATTER
     Inaccurate â†’ 3Ã—D8   |   Hail Mary â†’ 1Ã—D8
     â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function renderScatter(el) {
    const scatterCount = ws.useHailMary ? 1 : 3;
    el.innerHTML = `<div class="pwiz-step-title">Scatter Ã—${scatterCount}</div>
      <p class="panel-intro" style="margin-bottom:0.5rem;">The team-mate scatters ${scatterCount === 1 ? 'once' : '3 times'} from the intended landing square. Roll D8 for direction each time â€” they move 1 square per roll.</p>`;

    ws.scatterDirs = [];
    const resultsEl = document.createElement('div');
    const DIR_LABEL = { 1:'â†– Up-Left',2:'â†‘ Up',3:'â†— Up-Right',4:'â† Left',5:'â†’ Right',6:'â†™ Down-Left',7:'â†“ Down',8:'â†˜ Down-Right' };
    const DIR_SYM   = { 1:'â†–',2:'â†‘',3:'â†—',4:'â†',5:'â†’',6:'â†™',7:'â†“',8:'â†˜' };
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
        btn.innerHTML = `<span class="roll-btn-icon">ðŸŽ²</span> Scatter ${n}`;
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

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
     STEP 7: LANDING ROLL
     Need 4+ (modified by TZ, Landing skill)
     Superb + Bullseye â†’ this step is skipped entirely
     â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function renderLanding(el) {
    el.innerHTML = `<div class="pwiz-step-title">Landing Roll</div>`;

    /* Superb + Bullseye: skipped automatically (activeSteps excludes 7) */

    if (ws.throwResult === 'superb') {
      const banner = document.createElement('p');
      banner.className = 'panel-intro';
      banner.style.color = '#81c784';
      banner.textContent = 'â˜… Superb throw â€” no Landing roll needed! The team-mate touches down perfectly.';
      el.appendChild(banner);
      /* This branch only reached if Bullseye is absent */
    }

    /* TZ counter for landing square */
    const tzRow = document.createElement('div');
    tzRow.className = 'pwiz-mod-row';
    tzRow.innerHTML = '<span class="input-label" style="margin:0;">Tackle Zones in Landing Square:</span>';
    const tzMinus = document.createElement('button'); tzMinus.type = 'button'; tzMinus.className = 'tz-btn'; tzMinus.textContent = 'âˆ’';
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
    occupiedNote.textContent = 'âš  If the landing square is occupied: both players are knocked down and must roll Armour.';
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
        desc  = `Roll ${roll}${mod !== 0 ? ` (â†’ ${modified})` : ''} vs 4+ â€” the team-mate sticks the landing! They are placed on the pitch and may act normally (if not yet activated this turn).`;
      } else if (roll === 1) {
        ws.landingResult = 'crash';
        title = 'Crash Landing!'; cls = 'result-cas';
        desc  = 'Natural 1 â€” always fails. The team-mate is knocked down in their landing square. Roll Armour on step 8.';
      } else {
        ws.landingResult = 'crash';
        title = 'Crash Landing!'; cls = 'result-cas';
        desc  = `Roll ${roll}${mod !== 0 ? ` (â†’ ${modified})` : ''} vs 4+ â€” the team-mate crashes down! They are knocked down. Roll Armour on step 8.`;
      }

      resultEl.innerHTML = `
        <div class="result-roll-num">${roll}${mod !== 0 ? `<span style="font-size:1rem;font-weight:600;"> (â†’${modified})</span>` : ''}</div>
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
      btn.innerHTML = '<span class="roll-btn-icon">ðŸŽ²</span> Roll Landing (need 4+)';
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

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
     STEP 8: ARMOUR ROLL (Crash Landing)
     Pre-loaded with thrown player's AV
     â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function renderArmour(el) {
    const av = ws.thrownAV;
    el.innerHTML = `<div class="pwiz-step-title">Armour Roll</div>
      <p class="panel-intro" style="margin-bottom:0.5rem;">Crash landing! Roll 2D6 vs the thrown player's AV${av}+. If broken, the player is injured â€” use the Injury panel for the injury table.</p>`;

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
          <p class="result-desc">Total ${total} â‰¥ AV${av}. The thrown player's armour is broken â€” open the <strong>Injury panel</strong> and roll the Injury table. Apply any relevant modifiers.</p>
        `;
      } else {
        resultEl.innerHTML = `
          <div class="result-roll-num">${total}</div>
          ${breakdownHtml}
          <div class="result-name" style="color:var(--bb-gold,#D4AF37);">Armour Holds</div>
          <p class="result-desc">Total ${total} &lt; AV${av}. The armour held â€” the player is Prone but not injured. They will be turned face-up at the start of your next turn.</p>
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
      btn.innerHTML = `<span class="roll-btn-icon">ðŸŽ²</span> Roll Armour Check (vs AV${av}+)`;
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

  /* â”€â”€ Boot â”€â”€ */
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

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   PLAYER SELECTION PANELS (shared utility)
   Event delegation â€” one listener on container.
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

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

/* initBlockPlayerSelect removed â€” integrated into initBlockWizard() */

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   FOUL WIZARD â€” player selection
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

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

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   BOOT
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

document.addEventListener('DOMContentLoaded', () => {
  initBlockWizard();
  initPassWizard();
  initFoulWizard();
  initThrowWizard();
});
