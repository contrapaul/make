'use strict';

/* ═══════════════════════════════════════════════════════
   Blood Bowl Companion — js/wizards.js
   Block, Pass, Foul, Throw Team-Mate wizards.
   Depends on: dice.js, panels.js (BBData), settings.js, physical-dice.js
   ═══════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────
   BLOCK DIE
   ──────────────────────────────────────────────────────── */

/* Nuffle Dice font character map (see Nuffle Dice.woff2):
   J=push arrow, K=attacker down skull, L=both down burst,
   M=stumble burst, N=defender down skull, O-T=weather icons */
const NUFFLE_NUM  = n => String.fromCharCode(64 + n); // A=1 … I=9
const NUFFLE_WEATHER = { verySunny:'O', nice:'P', pouringRain:'Q', blizzard:'R', sweltering:'S', heavyRain:'T' };

const BLOCK_FACES = [
  null,
  { key: 'att-down',  label: 'Attacker Down', sym: 'K', cls: 'att-down',  colour: 'var(--bb-red,#C8102E)' },
  { key: 'both-down', label: 'Both Down',      sym: 'N', cls: 'both-down', colour: '#BB4400' },
  { key: 'push',      label: 'Push',           sym: 'J', cls: 'push',      colour: '#888' },
  { key: 'push',      label: 'Push',           sym: 'J', cls: 'push',      colour: '#888' },
  { key: 'stumble',   label: 'Stumble',        sym: 'M', cls: 'stumble',   colour: '#774400' },
  { key: 'def-down',  label: 'Defender Down',  sym: 'L', cls: 'def-down',  colour: '#1B5E20' },
];

function buildBlockFace(el, idx) {
  const f = BLOCK_FACES[Math.max(1, Math.min(6, idx))];
  el.className = `block-face ${f.cls}`;
  el.innerHTML = `<span class="block-face-sym">${f.sym}</span><span class="block-face-label">${f.label}</span>`;
}

function buildNumericFace(el, value) {
  el.className = 'block-face';
  el.innerHTML = `<span class="block-face-sym">${'abcdef'[value - 1]}</span>`;
}

function rollNumericDie(faceEl) {
  const result = Math.floor(Math.random() * 6) + 1;
  let cycles = 0;
  const iv = setInterval(() => {
    if (cycles++ >= 9) { clearInterval(iv); return; }
    buildNumericFace(faceEl, Math.floor(Math.random() * 6) + 1);
  }, 52);

  faceEl.classList.remove('rolling', 'settled');
  void faceEl.offsetWidth;
  faceEl.classList.add('rolling');

  return new Promise(resolve => {
    let settled = false;
    function finish() {
      if (settled) return;
      settled = true;
      clearInterval(iv);
      faceEl.classList.remove('rolling', 'settled');
      buildNumericFace(faceEl, result);
      resolve(result);
    }
    const fallback = setTimeout(finish, 650);
    faceEl.addEventListener('animationend', () => {
      clearInterval(iv);
      faceEl.classList.remove('rolling');
      buildNumericFace(faceEl, result);
      void faceEl.offsetWidth;
      faceEl.classList.add('settled');
      faceEl.addEventListener('animationend', () => {
        clearTimeout(fallback);
        faceEl.classList.remove('settled');
        finish();
      }, { once: true });
    }, { once: true });
  });
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
    let settled = false;
    function finish() {
      if (settled) return;
      settled = true;
      clearInterval(iv);
      faceEl.classList.remove('rolling', 'settled');
      buildBlockFace(faceEl, result);
      resolve(result);
    }

    /* Fallback: if animationend never fires (headless / reduced-motion), finish after 650ms */
    const fallback = setTimeout(finish, 650);

    faceEl.addEventListener('animationend', () => {
      clearInterval(iv);
      faceEl.classList.remove('rolling');
      buildBlockFace(faceEl, result);
      void faceEl.offsetWidth;
      faceEl.classList.add('settled');
      faceEl.addEventListener('animationend', () => {
        clearTimeout(fallback);
        faceEl.classList.remove('settled');
        finish();
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
   FIT-TO-CONTAINER SCALER
   Scales `content` (a FIXED-size stage) with transform so it fits
   `container` on both axes. The scale is driven ONLY by the window /
   panel size — never by content changes — so the layout locks in
   place like a video game and never re-scales mid-use. (The stage has
   a fixed design size; variable parts scroll internally.)
   offsetWidth/Height ignore transforms, so measurement is stable.
   ════════════════════════════════════════════════════════ */
function FitScale(container, content, opts = {}) {
  const max = opts.max ?? 1.5;
  const min = opts.min ?? 0.2;
  let raf = 0;

  function fit() {
    raf = 0;
    const cw = container.clientWidth, ch = container.clientHeight;
    const nw = content.offsetWidth,  nh = content.offsetHeight;
    if (!cw || !ch || !nw || !nh) return;
    const s = Math.max(min, Math.min(cw / nw, ch / nh, max));
    content.style.transform = `scale(${s})`;
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(fit); };

  /* Observe ONLY the container — content growth must not trigger re-scale. */
  const ro = new ResizeObserver(schedule);
  ro.observe(container);
  schedule();
  return { refit: schedule, disconnect: () => ro.disconnect() };
}
window.FitScale = FitScale;

/* ════════════════════════════════════════════════════════
   SHARED ARMOUR / INJURY / CASUALTY RULES
   Pure functions used by BOTH the Block wizard and the Special Actions
   wizard so the rules (Mighty Blow, Claws, Iron Hard Skin, Stunty,
   Thick Skull, Decay, casualty table) live in one place.
   ════════════════════════════════════════════════════════ */
const BBResolve = {
  /* Does 2D6 break armour? `bonus` is any +N (e.g. Mighty Blow, Chainsaw +3);
     Claws breaks on a natural 8+; Iron Hard Skin cancels modifiers & Claws. */
  armourBreaks(d1, d2, { av, bonus = 0, claws = false, ironHard = false } = {}) {
    const base = d1 + d2;
    if (claws && !ironHard) return { broke: base >= 8, shown: base, note: 'Claws 8+' };
    const applied = ironHard ? 0 : bonus;
    return { broke: (base + applied) >= av, shown: base + applied, note: '' };
  },

  /* Injury outcome from 2D6 plus modifiers and the target's defensive traits. */
  injuryOutcome(d1, d2, { mb = 0, stunty = 0, thickSkull = false } = {}) {
    const total = d1 + d2 + mb + stunty;
    let outcome, status;
    if (total <= 7 || (thickSkull && total === 8)) { outcome = 'Stunned';  status = window.PlayerStatus?.STUNNED; }
    else if (total <= 9)                            { outcome = "KO'd";     status = window.PlayerStatus?.KO; }
    else                                            { outcome = 'Casualty'; status = window.PlayerStatus?.BADLY_HURT; }
    return { total, outcome, status };
  },

  /* Roll the D16 casualty table (Decay adds +1). */
  rollCasualty(decay = 0) {
    const casVal = Math.min(16, Math.floor(Math.random() * 16) + 1 + (decay ? 1 : 0));
    const cas = rangeFind(window.BBData?.injury?.casualty, casVal) ?? { result: 'Unknown', 'class': '', desc: '' };
    return { casVal, cas, decay: !!decay };
  },

  applyStatus(side, idx, status) {
    /* setPlayerStatus is exported on window, NOT on GameState — the old
       GameState.setPlayerStatus?.() call silently did nothing. */
    if (status !== undefined && idx != null) window.setPlayerStatus?.(side, idx, status);
  },
};

/* ════════════════════════════════════════════════════════
   SHARED EMBEDDED TRADING CARD
   Builds the same .trading-card used by the roster modal into a
   wrapper. Used by the Block and Pass wizards. Returns the parsed
   AV so callers that need it (block armour) can read it.
   opts.small → slightly smaller card (Pass wizard, to free pitch space).
   ════════════════════════════════════════════════════════ */
function buildEmbeddedCardShared(wrapEl, player, side, opts = {}) {
  wrapEl.querySelectorAll('.bwiz-embedded-card').forEach(c => c.remove());

  const pd     = player.playerData;
  const team   = window.state?.[side]?.team ?? null;
  const colors = team?.colors || {};
  const imgDir = team?.imageDir || 'images/';

  const playerId   = pd ? String(pd.id)       : (player.id   != null ? player.id   : '?');
  const playerName = pd ? String(pd.name)     : (player.name != null ? player.name : '');
  const position   = pd ? String(pd.position) : (player.pos  != null ? player.pos  : '');
  const isStar     = pd ? !!pd.isStarPlayer   : !!(player.card && player.card.classList.contains('star-player'));
  const bgColor    = (window.POSITION_COLORS || {})[position] || '#1a3a6a';

  const KEYS = ['MA','ST','AG','PA','AV'];
  const statVals = KEYS.map(k => {
    const lk = k.toLowerCase();
    if (pd && pd[lk] !== undefined) return String(pd[lk]);
    const m = player.statsText ? player.statsText.match(new RegExp('\\b' + k + '\\s*([\\d+]+)', 'i')) : null;
    return m ? m[1] : '-';
  });
  const avVal = parseInt(statVals[4], 10) || 9;

  const card = document.createElement('div');
  card.className = 'trading-card bwiz-embedded-card'
    + (isStar ? ' star-card' : '')
    + (opts.small ? ' bwiz-card-small' : '');

  const cmap = {
    primary: '--tc-primary', primaryDark: '--tc-primary-dark',
    accent: '--tc-accent', gold: '--tc-gold', goldDark: '--tc-gold-dark',
  };
  Object.keys(cmap).forEach(k => { if (colors[k]) card.style.setProperty(cmap[k], colors[k]); });

  /* Shared trading-card markup (js/player-card.js) + live status banner */
  card.innerHTML = window.PlayerCard.html({
    id:           playerId,
    name:         playerName,
    position:     position,
    ma: statVals[0], st: statVals[1], ag: statVals[2], pa: statVals[3], av: statVals[4],
    skills:       pd ? (pd.skills || '') : '',
    value:        pd?.value,
    fact:         pd?.fact,
    isStarPlayer: isStar,
    photo:        pd?.photo,
  }, {
    imageDir:   imgDir,
    statusHTML: window.PlayerCard.statusHTML(side, player.idx),
  });
  window.PlayerCard.bindImage(card);
  window.PlayerCard.applyStatusClasses(card, side, player.idx);
  card.querySelector('.modal-image-area').style.background = bgColor;

  if (window.attachSkillEvents) window.attachSkillEvents(card, false);
  if (pd && pd.isStarPlayer && typeof window.applyHolo === 'function') window.applyHolo(card, true);
  wrapEl.appendChild(card);
  return { avVal, card };
}

/* ════════════════════════════════════════════════════════
   BLOCK WIZARD  (full rebuild)
   ════════════════════════════════════════════════════════ */

/* Skills that affect block outcomes — referenced in the side columns and
   consulted by the resolution engine. Attacker = the blocking player;
   Defender = the player being blocked. */
const ATT_BLOCK_SKILLS = new Set([
  'Block','Wrestle','Mighty Blow','Claws','Tackle','Dauntless','Horns',
  'Multiple Block','Juggernaut','Frenzy','Grab','Strip Ball','Brawler',
  'Hatred','Pro','Guard','Pile Driver','Arm Bar','Taunt','Eye Gouge','Loner',
]);
const DEF_BLOCK_SKILLS = new Set([
  'Block','Dodge','Wrestle','Fend','Stand Firm','Sidestep','Side Step','Tentacles',
  'Thick Skull','Stunty','Decay','Foul Appearance','Dump-Off','Iron Hard Skin',
  'Sure Hands','Steady Footing','Safe Pair of Hands','Saboteur','Trickster',
  'Guard','Pro','Loner',
]);

function initBlockWizard() {
  const panel      = document.getElementById('panel-block');
  const rollBtn    = document.getElementById('block-roll-btn');
  const confirmBtn = document.getElementById('block-confirm-btn');
  const useRrBtn   = document.getElementById('block-use-rr-btn');
  const defBanner  = document.getElementById('block-def-picks-banner');
  if (!rollBtn) return;

  /* ── State ── */
  let attST = 3, defST = 3, attAst = 0, defAst = 0;
  let attSkills = new Set(), defSkills = new Set();
  let attAV = 9, defAV = 9;          // armor values (parsed from statsText)
  let attPlayer = null, defPlayer = null;
  let attSide = 'left';              // which roster side the attacker is from
  const defSide = () => (attSide === 'left' ? 'right' : 'left');
  let rolledFaces = [];              // array of BLOCK_FACES[n] objects from last roll
  let chosenFace  = null;            // the face the user confirmed
  let rrUsed      = false;           // team re-roll consumed this action

  /* ── Skill-resolution state (full simulation) ── */
  let isBlitz      = false;          // block is part of a Blitz action
  let multiBlock   = false;          // attacker using Multiple Block (-2 ST)
  let dauntlessOn  = false;          // Dauntless succeeded → treat ST as equal
  let mbSpent      = false;          // Mighty Blow already applied this block
  let proUsed      = false;          // Pro re-roll consumed this action
  let preBlockDone = false;          // pre-block reactions resolved (once per action)
  let stMods       = { att: 0 };     // transient ST modifiers from skills (Horns)

  /* ── Skill helpers ── */
  const attHas = n => attSkills.has(n);
  const defHas = n => defSkills.has(n);

  /* Effective strengths after skill modifiers (Horns/Multiple Block/Dauntless). */
  function effAttST() {
    let a = attST + stMods.att - (multiBlock ? 2 : 0);
    if (dauntlessOn) a = Math.max(a, defST);
    return Math.max(1, a);
  }

  /* Inline prompt zone lives in the center column under the dice. */
  function promptZone() {
    let z = document.getElementById('bwiz-skill-prompts');
    if (!z) {
      z = document.createElement('div');
      z.id = 'bwiz-skill-prompts';
      z.className = 'bwiz-skill-prompts';
      const banner = document.getElementById('block-def-picks-banner');
      const center = document.querySelector('.bwiz-center');
      if (banner) banner.insertAdjacentElement('afterend', z);
      else center?.appendChild(z);
    }
    return z;
  }
  function clearPrompts() { const z = document.getElementById('bwiz-skill-prompts'); if (z) z.innerHTML = ''; }

  /* Render an inline choice; resolves with the chosen option's value. */
  function askInline(labelHtml, options) {
    return new Promise(resolve => {
      const z   = promptZone();
      const row = document.createElement('div');
      row.className = 'bwiz-prompt';
      const lbl = document.createElement('span');
      lbl.className = 'bwiz-prompt-label';
      lbl.innerHTML = labelHtml;
      row.appendChild(lbl);
      options.forEach(o => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'bwiz-prompt-btn' + (o.primary ? ' primary' : '');
        b.textContent = o.text;
        b.addEventListener('click', () => {
          row.querySelectorAll('button').forEach(x => { x.disabled = true; });
          b.classList.add('chosen');
          resolve(o.value);
        });
        row.appendChild(b);
      });
      z.appendChild(row);
    });
  }

  /* Roll a single inline D6 (animated) appended to the last prompt row.
     Physical mode: same row, entry grid instead of an animated die. */
  async function askD6(labelHtml) {
    const z   = promptZone();
    const row = document.createElement('div');
    row.className = 'bwiz-prompt';
    row.innerHTML = `<span class="bwiz-prompt-label">${labelHtml}</span>`;
    z.appendChild(row);
    let v;
    if (wizardMode('block') === 'physical') {
      v = await window.DiceSlot.d6(row, '');
      const die = document.createElement('div');
      die.className = 'block-face bwiz-mini-die';
      buildNumericFace(die, v);
      row.appendChild(die);
    } else {
      const die = document.createElement('div');
      die.className = 'block-face bwiz-mini-die';
      buildNumericFace(die, 1);
      row.appendChild(die);
      v = await rollNumericDie(die);
    }
    const res = document.createElement('span');
    res.className = 'bwiz-prompt-res';
    res.textContent = v;
    row.appendChild(res);
    return { value: v, row };
  }

  /* ── Phase 1a fix: "over double" is strictly > not >= ── */
  function calcBlock() {
    const a = effAttST() + attAst;
    const d = defST + defAst;
    if (a > d * 2)  return { count: 3, who: 'attacker picks', attFav: true  };
    if (a > d)      return { count: 2, who: 'attacker picks', attFav: true  };
    if (a === d)    return { count: 1, who: '',               attFav: null  };
    if (d > a * 2)  return { count: 3, who: 'defender picks', attFav: false };
    return                 { count: 2, who: 'defender picks', attFav: false };
  }

  /* ── ST compare display ── */
  function updateStDisplay() {
    const compareEl = document.getElementById('block-st-compare');
    if (!compareEl) return;
    const { count, who, attFav } = calcBlock();
    const a = attST + attAst, d = defST + defAst;
    const attTxt = attAst ? `ST ${a} (${attST} + ${attAst} assists)` : `ST ${a}`;
    const defTxt = defAst ? `ST ${d} (${defST} + ${defAst} assist)` : `ST ${d}`;
    const pickerTxt = who ? ` — ${who}` : '';
    compareEl.textContent = `${attTxt} vs. ${defTxt} · ${count} ${count === 1 ? 'die' : 'dice'}${pickerTxt}`;
    renderDiceTray(count);
    /* Flag the dice as a defender-picks (bad) block as soon as the ST compare
       establishes it — extra visual warning before the user commits to roll. */
    document.getElementById('block-dice-tray')?.classList.toggle('def-picks', attFav === false);
    renderRerolls();
  }

  /* ── Dice tray ── */
  function renderDiceTray(count) {
    const tray = document.getElementById('block-dice-tray');
    if (!tray) return;
    tray.innerHTML = '';
    tray.classList.remove('def-picks');
    for (let i = 0; i < count; i++) {
      const face = document.createElement('div');
      face.id = `block-face-${i}`;
      buildBlockFace(face, 3); // default to push
      tray.appendChild(face);
    }
  }

  /* ── Assist dots ── */
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

  /* ── Re-roll dots ── */
  function renderRerolls() {
    const el = document.getElementById('block-rerolls');
    if (!el) return;
    const gs      = window.GameState;
    /* Attacker is from left side = home team */
    const rrKey   = attSide === 'right' ? 'away' : 'home';
    const rrTotal = gs?.rerolls?.[rrKey] ?? 0;
    el.innerHTML  = '';
    for (let i = 0; i < Math.max(rrTotal, 1); i++) {
      const dot = document.createElement('button');
      dot.className = 'bwiz-rr-dot' + (i < rrTotal ? '' : ' spent') + (rrUsed ? ' used' : '');
      dot.setAttribute('aria-label', 'Use team re-roll');
      /* Disable only when: already used, no RR remaining, or no dice have been rolled yet */
      dot.disabled = rrUsed || rrTotal === 0 || rolledFaces.length === 0;
      dot.addEventListener('click', () => {
        if (rrUsed || !gs || gs.rerolls[rrKey] <= 0 || rolledFaces.length === 0) return;
        gs.rerolls[rrKey] = Math.max(0, gs.rerolls[rrKey] - 1);
        rrUsed = true;
        /* Sync game-bar pip */
        const barId = rrKey === 'home' ? '#rr-home' : '#rr-away';
        document.querySelectorAll(`${barId} .rr-pip`).forEach((pip, idx) => {
          pip.classList.toggle('used', idx >= gs.rerolls[rrKey]);
        });
        renderRerolls();
        /* Roll button remains enabled with doRoll handler — user clicks to re-roll */
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

  /* ── Embedded trading card ── */
  function buildEmbeddedCard(wrapEl, player, side) {
    const { avVal } = buildEmbeddedCardShared(wrapEl, player, side);
    if (side === "left") { attAV = avVal; } else { defAV = avVal; }
  }

  /* ── Load block-relevant skills into side column ── */
  function loadBlockSkills(side, player) {
    const colId     = side === 'att' ? 'block-att-skills-col' : 'block-def-skills-col';
    const whitelist = side === 'att' ? ATT_BLOCK_SKILLS : DEF_BLOCK_SKILLS;
    const col       = document.getElementById(colId);
    if (!col) return;

    const heading = col.querySelector('.bwiz-skills-heading');
    col.innerHTML = '';
    if (heading) col.appendChild(heading);

    /* Match on the base skill name, ignoring parenthetical suffixes such as
       "Loner (3+)" or "Hatred (Troll)" so they're detected and referenced. */
    const store = side === 'att' ? attSkills : defSkills;
    store.clear();
    const seen   = new Set();
    const cards  = [];
    getPlayerSkills(player).forEach(raw => {
      const base = raw.replace(/\s*\(.*\)$/, '').trim();
      if (!whitelist.has(base) && !whitelist.has(raw)) return;
      if (seen.has(base)) return;
      seen.add(base);
      store.add(base);
      cards.push(base);
    });

    if (!cards.length) {
      const empty = document.createElement('div');
      empty.className = 'bwiz-skills-empty';
      empty.textContent = 'No relevant skills';
      col.appendChild(empty);
      return;
    }

    cards.forEach(name => {
      col.appendChild(window.buildSkillCard(name));
    });
  }

  /* ── Home/Away tabs: which roster the ATTACKER blocks from ── */
  function renderSideTabs(picker) {
    let tabs = picker.querySelector('.bwiz-team-tabs');
    if (!tabs) {
      tabs = document.createElement('div');
      tabs.className = 'bwiz-team-tabs';
      tabs.innerHTML =
        '<button type="button" class="bwiz-team-tab" data-side="left">Home</button>' +
        '<button type="button" class="bwiz-team-tab" data-side="right">Away</button>';
      picker.insertBefore(tabs, picker.firstChild);
      tabs.querySelectorAll('.bwiz-team-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          if (attSide === btn.dataset.side) return;
          attSide   = btn.dataset.side;
          /* Both selections are side-bound — start the pick over. */
          attPlayer = null;
          defPlayer = null;
          showPicker('att');
          showPicker('def');
          resetRoll();
          updateStDisplay();
        });
      });
    }
    tabs.querySelectorAll('.bwiz-team-tab').forEach(b =>
      b.classList.toggle('active', b.dataset.side === attSide));
  }

  /* ── Show picker for a side (hide card) ── */
  function showPicker(side) {
    const wrap   = document.getElementById(`block-${side}-card-wrap`);
    const picker = document.getElementById(`block-${side}-picker`);
    if (!picker || !wrap) return;
    wrap.querySelectorAll('.bwiz-embedded-card').forEach(c => c.remove());
    picker.hidden = false;
    if (side === 'att') renderSideTabs(picker);
    updateCardGlows(); // one card removed — clear other card's glow until both are chosen again
    const rosterSide = side === 'att' ? attSide : defSide();
    buildWizardPlayerList(
      side === 'att' ? 'block-attacker-list' : 'block-defender-list',
      rosterSide,
      side === 'att'
        ? (p => window.isPlayerAvailable?.(p) && (() => { const PS = window.PlayerStatus; return p.status === PS?.AVAILABLE || p.status === PS?.PRONE || p.status === PS?.STUNNED; })())
        : (p => window.isPlayerAvailable?.(p)),
      (player, stats) => {
        /* Player selected: build card, load skills, set ST (with any active buffs) */
        if (side === 'att') {
          attPlayer = player;
          attST     = window.getEffectiveStat?.(attSide, player.idx, 'ST', stats.st ?? 3) ?? (stats.st ?? 3);
          picker.hidden = true;
          buildEmbeddedCard(wrap, player, attSide);
          loadBlockSkills('att', player);
        } else {
          defPlayer = player;
          defST     = window.getEffectiveStat?.(defSide(), player.idx, 'ST', stats.st ?? 3) ?? (stats.st ?? 3);
          picker.hidden = true;
          buildEmbeddedCard(wrap, player, defSide());
          loadBlockSkills('def', player);
        }
        resetRoll();
        updateStDisplay();
        if (attPlayer && defPlayer) setGlow('gold');
        updateCardGlows();
      },
      /* Being blocked is not an action — acted players are legal targets. */
      side === 'def' ? { allowActed: true } : {},
    );
  }

  /* Restore embedded card when panel reopens without resetting state */
  function restoreCard(side) {
    const wrap   = document.getElementById(`block-${side}-card-wrap`);
    const picker = document.getElementById(`block-${side}-picker`);
    if (!wrap || !picker) return;
    picker.hidden = true;
    if (!wrap.querySelector('.bwiz-embedded-card')) {
      const player     = side === 'att' ? attPlayer : defPlayer;
      const rosterSide = side === 'att' ? attSide : defSide();
      if (player) {
        const avVal = parseInt(player.statsText?.match(/\bAV\s*(\d+)/i)?.[1] ?? 9, 10);
        if (side === 'att') attAV = avVal; else defAV = avVal;
        buildEmbeddedCard(wrap, player, rosterSide);
      }
    }
  }

  function updateCardGlows() {
    const attCard = document.querySelector('#block-att-card-wrap .bwiz-embedded-card');
    const defCard = document.querySelector('#block-def-card-wrap .bwiz-embedded-card');
    const both    = !!(attCard && defCard);
    attCard?.classList.toggle('bwiz-card-glow-att', both);
    defCard?.classList.toggle('bwiz-card-glow-def', both);
  }

  /* ── Change buttons ── */
  document.getElementById('block-change-att')?.addEventListener('click', () => showPicker('att'));
  document.getElementById('block-change-def')?.addEventListener('click', () => showPicker('def'));

  /* ── Assist dots ── */
  renderAssistDots('block-att-assists-dots', 6, 'left',  v => { attAst = v; updateStDisplay(); });
  renderAssistDots('block-def-assists-dots', 6, 'right', v => { defAst = v; updateStDisplay(); });

  /* ── Reset all roll state ── */
  function resetRoll() {
    rolledFaces = [];
    chosenFace  = null;
    rrUsed      = false;
    isBlitz      = false;
    multiBlock   = false;
    dauntlessOn  = false;
    mbSpent      = false;
    proUsed      = false;
    preBlockDone = false;
    stMods.att   = 0;
    clearPrompts();
    rollBtn.hidden     = false;
    rollBtn.disabled   = !(attPlayer && defPlayer);
    rollBtn.onclick    = doRoll;
    rollBtn.innerHTML  = 'Roll';
    rollBtn.classList.remove('roll-btn--complete');
    if (confirmBtn) confirmBtn.hidden = true;
    if (useRrBtn)   useRrBtn.hidden   = true;
    if (defBanner)  defBanner.hidden  = true;
    /* Lock result panels */
    ['block-result-panel','armor-roll-panel','injury-roll-panel'].forEach(id => {
      document.getElementById(id)?.classList.add('locked');
    });
    document.getElementById('block-result-content').textContent  = '—';
    document.getElementById('armor-result-content').textContent  = '—';
    document.getElementById('injury-result-content').textContent = '—';
    /* Clear dice trays */
    const armorTray = document.getElementById('armor-dice-tray');
    const injTray   = document.getElementById('injury-dice-tray');
    if (armorTray) armorTray.innerHTML = '';
    if (injTray)   injTray.innerHTML   = '';
    document.getElementById('armor-roll-btn')?.setAttribute('hidden','');
    document.getElementById('injury-roll-btn')?.setAttribute('hidden','');
    renderDiceTray(calcBlock().count);
    renderRerolls();
    setGlow('off');
  }

  /* ── Phase 1b+1c: interpret chosen face with active skills ── */
  function pName(player) {
    return player?.playerData?.name ?? player?.name ?? '?';
  }

  /* Push-back follow-up handling (Fend / Stand Firm / Side Step / Grab /
     Frenzy / Strip Ball / Taunt) — surfaced as notes after a Push/Stumble. */
  function pushNotes() {
    const notes = [];
    if (defHas('Stand Firm'))                 notes.push(`${pName(defPlayer)} may use Stand Firm — no Push Back.`);
    if (defHas('Side Step') || defHas('Sidestep')) notes.push(`${pName(defPlayer)} picks the push square (Side Step)${attHas('Grab') ? ' — negated by Grab' : ''}.`);
    else if (attHas('Grab'))                  notes.push(`${pName(attPlayer)} picks the push square (Grab).`);
    if (defHas('Fend') && !attHas('Juggernaut')) notes.push(`${pName(defPlayer)} prevents Follow-up (Fend).`);
    if (attHas('Frenzy'))                     notes.push('Frenzy — must Follow-up and Block again.');
    if (attHas('Strip Ball') && !defHas('Sure Hands')) notes.push('Strip Ball — ball carrier drops the ball in the push square.');
    if (attHas('Taunt'))                      notes.push('Taunt — may force the opponent to Follow-up.');
    return notes;
  }

  function pushNoteHtml() {
    const n = pushNotes();
    return n.length ? `<ul class="bwiz-skill-notes">${n.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  }

  async function interpretResult(face) {
    let key = face.key;
    let knockedSide = null;  // 'att' | 'def' | 'both' | null
    const attName = pName(attPlayer);
    const defName = pName(defPlayer);

    /* Juggernaut: on a Blitz, Both Down is treated as a Push Back, and the
       defender cannot use Fend / Stand Firm / Wrestle. */
    const juggernaut = isBlitz && attHas('Juggernaut');

    if (key === 'att-down') {
      /* Optional re-roll of a Player Down via Hatred (vs a hated keyword). */
      if (attHas('Hatred') && !rrUsed) {
        const use = await askInline(`${esc(attName)} has <b>Hatred</b> — re-roll this Player Down?`,
          [{ text: 'Re-roll', value: true, primary: true }, { text: 'Keep', value: false }]);
        if (use) { reRollAll('Hatred'); return; }
      }
      knockedSide = 'att';
      showBlockResult(`${attName} Down!`, 'bad', 'Turnover — the attack fails.', 'bad');

    } else if (key === 'both-down') {
      /* Brawler: re-roll a single Both Down once per block. */
      if (attHas('Brawler') && !rrUsed) {
        const use = await askInline(`${esc(attName)} has <b>Brawler</b> — re-roll this Both Down?`,
          [{ text: 'Re-roll', value: true, primary: true }, { text: 'Keep', value: false }]);
        if (use) { reRollAll('Brawler'); return; }
      }
      if (juggernaut) {
        key = 'push';
        showBlockResult('Both Down → Push (Juggernaut)!', 'neutral',
          `${attName} converts Both Down to a Push Back. Fend / Stand Firm / Wrestle are ignored.`, 'ok');
        showCompleteBlock();
      } else {
        /* Wrestle (either player) may force both to Fall Over — no armour rolls. */
        if (attHas('Wrestle') || defHas('Wrestle')) {
          const who = attHas('Wrestle') ? attName : defName;
          const pick = await askInline(`Both Down — ${esc(who)} has <b>Wrestle</b>. Force both to fall?`,
            [{ text: 'Wrestle (both fall)', value: 'wrestle', primary: true },
             { text: 'Resolve normally', value: 'normal' }]);
          if (pick === 'wrestle') {
            showBlockResult('Both Down — Wrestle!', 'warn', `${attName} and ${defName} both fall. No armor rolls.`, 'warn');
            showCompleteBlock();
            return;
          }
        }
        /* Block keeps a player standing on Both Down (each side independently). */
        const attStays = attHas('Block');
        const defStays = defHas('Block');
        if (attStays && defStays) {
          showBlockResult('Both Down — No Effect!', 'neutral', `${attName} and ${defName} both have Block.`, 'ok');
          showCompleteBlock();
        } else if (attStays && !defStays) {
          knockedSide = 'def';
          showBlockResult(`${defName} Down!`, 'ok', `${attName} stays up (Block).`, 'ok');
        } else if (!attStays && defStays) {
          knockedSide = 'att';
          showBlockResult(`${attName} Down!`, 'bad', `${defName} stays up (Block). Turnover.`, 'bad');
        } else {
          knockedSide = 'both';
          showBlockResult('Both Down!', 'bad', `${attName} and ${defName} both fall. Roll armor for both.`, 'bad');
        }
      }

    } else if (key === 'stumble') {
      /* Dodge negates a Stumble (→ push) — unless the attacker has Tackle. */
      if (defHas('Dodge') && !attHas('Tackle')) {
        showBlockResult('Stumble — No Effect!', 'neutral',
          `${defName} stays up (Dodge). Treated as Push Back.`, 'ok');
        appendPushNotes();
        showCompleteBlock();
      } else {
        knockedSide = 'def';
        const why = defHas('Dodge') && attHas('Tackle')
          ? `${defName}'s Dodge is cancelled by ${attName}'s Tackle.` : 'Stumble result.';
        showBlockResult(`${defName} Down!`, 'bad', why, 'bad');
      }

    } else if (key === 'push') {
      showBlockResult('Push Back!', 'neutral', `${defName} shoved back. ${attName} may follow up.`, 'info');
      appendPushNotes();
      showCompleteBlock();
    }

    if (key === 'def-down') {
      knockedSide = 'def';
      showBlockResult(`${defName} Down!`, 'bad', 'Roll Armor.', 'info');
    }

    /* Unlock armor roll if someone is knocked down */
    if (knockedSide === 'def' || knockedSide === 'att') {
      unlockArmorRoll(knockedSide);
    } else if (knockedSide === 'both') {
      unlockArmorRoll('att', 'def');
    }
  }

  /* Append push-skill notes under the current block result. */
  function appendPushNotes() {
    const html = pushNoteHtml();
    if (!html) return;
    const content = document.getElementById('block-result-content');
    if (content) content.insertAdjacentHTML('beforeend', html);
  }

  /* Re-roll all block dice after a skill re-roll (Brawler/Hatred/Pro/Team). */
  function reRollAll(label) {
    rrUsed = true;
    if (label) {
      const z = promptZone();
      const note = document.createElement('div');
      note.className = 'bwiz-prompt-note';
      note.textContent = `${label} re-roll`;
      z.appendChild(note);
    }
    doRoll();
  }

  /* ── Glow state helper ── */
  function setGlow(mode) {
    rollBtn.classList.remove('glow-gold', 'glow-green');
    if (mode === 'gold' || mode === 'green') rollBtn.classList.add(`glow-${mode}`);
  }

  /* Transform the Roll button into a green “Complete Block” closer */
  function setCompleteMode() {
    rollBtn.disabled  = false;
    rollBtn.innerHTML = 'Complete Block';
    rollBtn.classList.add('roll-btn--complete');
    rollBtn.onclick   = () => {
      /* Block resolved — clear the matchup so the next open starts fresh. */
      attPlayer = null;
      defPlayer = null;
      document.querySelector('#panel-block .panel-close')?.click();
    };
    setGlow('green');
    /* Defensive: ensure result content divs keep their styling class */
    ['armor-result-content', 'injury-result-content'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.className = 'bwiz-result-content';
    });
  }

  function showCompleteBlock() {
    setCompleteMode();
  }

  function showBlockResult(headline, headlineCls, note = null, noteCls = 'info') {
    const panel   = document.getElementById('block-result-panel');
    const content = document.getElementById('block-result-content');
    if (panel)   panel.classList.remove('locked');
    if (!content) return;
    content.className = 'bwiz-result-content';
    content.innerHTML =
      `<div class="bwiz-result-headline bwiz-result-${headlineCls}">${esc(headline)}</div>` +
      (note ? `<p class="bwiz-result-note ${noteCls}">${esc(note)}</p>` : '');
  }

  /* ── Running record helpers: append a pending row, then fill it on roll ──
     Lets a Both Down show the attacker's armour/injury, then the defender's
     below it, instead of overwriting. */
  function appendRollRow(contentEl, who, detailText) {
    if (!contentEl) return null;
    if (contentEl.textContent.trim() === '—') contentEl.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'bwiz-roll-row pending';
    row.innerHTML = `<span class="bwiz-roll-who">${esc(who)}</span>` +
      `<span class="bwiz-roll-detail">${esc(detailText)}</span>`;
    contentEl.appendChild(row);
    contentEl.scrollTop = contentEl.scrollHeight;
    return row;
  }
  function fillRollRow(contentEl, who, html) {
    if (!contentEl) return null;
    let row = contentEl.querySelector('.bwiz-roll-row.pending');
    if (row) {
      row.classList.remove('pending');
    } else {
      if (contentEl.textContent.trim() === '—') contentEl.innerHTML = '';
      row = document.createElement('div');
      row.className = 'bwiz-roll-row';
      contentEl.appendChild(row);
    }
    row.innerHTML = `<span class="bwiz-roll-who">${esc(who)}</span>` + html;
    contentEl.scrollTop = contentEl.scrollHeight;
    return row;
  }

  /* ── Armor roll ── */
  function unlockArmorRoll(knockedSide, nextSide = null) {
    const armorPanel = document.getElementById('armor-roll-panel');
    const armorNote  = document.getElementById('armor-result-content');
    if (!armorPanel) return;

    const av    = knockedSide === 'att' ? attAV : defAV;
    const who   = pName(knockedSide === 'att' ? attPlayer : defPlayer);
    const ironHard = knockedSide === 'def' && defHas('Iron Hard Skin');
    const claws = attHas('Claws') && knockedSide === 'def' && !ironHard;
    const mbAvail = attHas('Mighty Blow') && knockedSide === 'def' && !mbSpent && !ironHard;

    armorPanel.classList.remove('locked');
    const mods = [
      claws ? 'Claws (8+ breaks)' : '',
      mbAvail ? 'Mighty Blow available' : '',
      ironHard ? 'Iron Hard Skin — no modifiers' : '',
    ].filter(Boolean).join(' · ');
    /* Append a pending row to the running record (filled when the roll lands). */
    appendRollRow(armorNote, who, `Roll Armor · AV ${av}+${mods ? ` · ${mods}` : ''}`);
    const armorTray = document.getElementById('armor-dice-tray');
    if (armorTray) armorTray.innerHTML = '';

    rollBtn.onclick  = () => rollArmor(av, claws, mbAvail, knockedSide, nextSide);
    rollBtn.disabled = false;
    setGlow('gold');
  }

  async function rollArmor(av, claws, mbAvail, knockedSide, nextSide = null) {
    const resultEl  = document.getElementById('armor-result-content');
    rollBtn.disabled = true;
    setGlow('off');

    const [d1, d2] = await rollTwoDice();
    const base = d1 + d2;

    /* Optional Mighty Blow: apply +1 here or reserve it for the Injury roll. */
    let mbHere = 0;
    if (mbAvail && !claws) {
      const choice = await askInline(
        `${esc(pName(attPlayer))} has <b>Mighty Blow</b> — apply +1 to this Armour roll?`,
        [{ text: 'Apply to Armour', value: 'armor', primary: true },
         { text: 'Save for Injury', value: 'save' }]);
      if (choice === 'armor') { mbHere = 1; mbSpent = true; }
    }

    const { broke: breaks } = BBResolve.armourBreaks(d1, d2, { av, bonus: mbHere, claws });
    const mathStr = mbHere
      ? `${d1} + ${d2} + 1 (Mighty Blow) = ${base + mbHere} vs AV ${av}+`
      : `${d1} + ${d2} = ${base}${claws ? ' · Claws 8+' : ''} vs AV ${av}+`;
    const who = pName(knockedSide === 'att' ? attPlayer : defPlayer);
    fillRollRow(resultEl, who,
      `<span class="bwiz-result-headline bwiz-result-${breaks ? 'bad' : 'ok'}">${breaks ? 'Armor Broken!' : 'Armor Holds'}</span>` +
      `<span class="bwiz-math-row">${mathStr}</span>`);

    if (breaks) {
      await pause(300);
      unlockInjuryRoll(knockedSide, nextSide);
    } else if (nextSide) {
      await pause(300);
      unlockArmorRoll(nextSide);
    } else {
      setCompleteMode();
    }
  }

  /* ── Injury roll ── */
  function unlockInjuryRoll(knockedSide, nextSide = null) {
    const injPanel = document.getElementById('injury-roll-panel');
    if (!injPanel) return;

    injPanel.classList.remove('locked');
    const ironHard = knockedSide === 'def' && defHas('Iron Hard Skin');
    const mbAvail  = attHas('Mighty Blow') && knockedSide === 'def' && !mbSpent && !ironHard;
    const who   = pName(knockedSide === 'att' ? attPlayer : defPlayer);
    const mods  = [
      mbAvail ? 'Mighty Blow available' : '',
      (knockedSide === 'def' && defHas('Stunty')) ? '+1 Stunty' : '',
      (knockedSide === 'def' && defHas('Thick Skull')) ? 'Thick Skull (KO 9+)' : '',
      (knockedSide === 'def' && defHas('Decay')) ? 'Decay (+1 Casualty)' : '',
    ].filter(Boolean).join(' · ');
    const injEl = document.getElementById('injury-result-content');
    appendRollRow(injEl, who, `Roll Injury${mods ? ` · ${mods}` : ''}`);
    const injTray = document.getElementById('injury-dice-tray');
    if (injTray) injTray.innerHTML = '';

    rollBtn.onclick  = () => rollInjury(knockedSide, mbAvail, nextSide);
    rollBtn.disabled = false;
    setGlow('gold');
  }

  async function rollInjury(knockedSide, mbAvail, nextSide = null) {
    const result = document.getElementById('injury-result-content');
    rollBtn.disabled = true;
    setGlow('off');

    const [d1, d2] = await rollTwoDice();
    const base = d1 + d2;

    /* Optional Mighty Blow on the injury roll (if not already spent on armour). */
    let mbHere = 0;
    if (mbAvail) {
      const choice = await askInline(
        `${esc(pName(attPlayer))} has <b>Mighty Blow</b> — apply +1 to this Injury roll?`,
        [{ text: 'Apply +1', value: 'yes', primary: true }, { text: 'Skip', value: 'no' }]);
      if (choice === 'yes') { mbHere = 1; mbSpent = true; }
    }

    const stunty     = knockedSide === 'def' && defHas('Stunty') ? 1 : 0;
    const thickSkull = knockedSide === 'def' && defHas('Thick Skull');
    const { total, outcome, status } = BBResolve.injuryOutcome(d1, d2, { mb: mbHere, stunty, thickSkull });

    const injuredName = pName(knockedSide === 'att' ? attPlayer : defPlayer);
    const mods = [mbHere ? '+1 Mighty Blow' : '', stunty ? '+1 Stunty' : ''].filter(Boolean).join(' ');
    const mathStr = `${d1} + ${d2}${mods ? ` ${mods}` : ''} = ${total}`;
    const headlineCls = (outcome === 'Stunned') ? 'warn' : 'bad';
    const injRow = fillRollRow(result, injuredName,
      `<span class="bwiz-result-headline bwiz-result-${headlineCls}">${esc(injuredName)} ${esc(outcome)}!</span>` +
      `<span class="bwiz-math-row">${mathStr}</span>`);

    /* Update roster status */
    const targetPlayer = knockedSide === 'att' ? attPlayer : defPlayer;
    const targetSide   = knockedSide === 'att' ? attSide : defSide();
    if (targetPlayer) BBResolve.applyStatus(targetSide, targetPlayer.idx, status);

    /* Casualty: auto-roll D16 on the casualty table (Decay adds +1). */
    if (outcome === 'Casualty') {
      const host = injRow ?? document.getElementById('injury-roll-panel');
      if (host) {
        const decay = knockedSide === 'def' && defHas('Decay') ? 1 : 0;
        let casVal, cas;
        if (wizardMode('block') === 'physical') {
          const entered = await window.DiceSlot.d16(host);
          casVal = Math.min(16, entered + decay);
          cas = rangeFind(window.BBData?.injury?.casualty, casVal) ?? { result: 'Unknown', 'class': '', desc: '' };
        } else {
          ({ casVal, cas } = BBResolve.rollCasualty(decay));
        }
        const casEl = document.createElement('div');
        casEl.className = 'bwiz-casualty-result';
        casEl.innerHTML =
          `<span class="bwiz-result-headline bwiz-result-bad">${esc(cas.result)}</span>` +
          (cas.desc ? `<span class="bwiz-result-note bad">${esc(cas.desc)}</span>` : '') +
          `<span class="bwiz-math-row">Casualty table · D16: ${casVal}${decay ? ' (+1 Decay)' : ''}</span>`;
        host.appendChild(casEl);
      }
    }

    /* Pile Driver: after Knocking Down the defender, the attacker may make a
       free Foul against them. Offer a shortcut to the Foul wizard. */
    if (knockedSide === 'def' && attHas('Pile Driver')) {
      const z = promptZone();
      const row = document.createElement('div');
      row.className = 'bwiz-prompt';
      row.innerHTML = `<span class="bwiz-prompt-label">${esc(pName(attPlayer))} may <b>Pile Driver</b> (free Foul).</span>`;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'bwiz-prompt-btn primary';
      b.textContent = 'Open Foul';
      b.addEventListener('click', () => {
        document.querySelector('#panel-block .panel-close')?.click();
        window.Panels?.openPanel?.('foul');
      });
      row.appendChild(b);
      z.appendChild(row);
    }

    /* Continue to next player's armor roll, or complete */
    if (nextSide) {
      await pause(400);
      unlockArmorRoll(nextSide);
    } else {
      setCompleteMode();
    }
  }

  /* Roll 2D6 using the main block tray (animated numeric dice).
     Physical mode: enter each die; the tray shows the entered faces. */
  async function rollTwoDice() {
    const blockTray = document.getElementById('block-dice-tray');
    if (blockTray) {
      blockTray.innerHTML = '';
      blockTray.classList.remove('def-picks');
    }
    if (wizardMode('block') === 'physical') {
      const host = promptZone();
      const d1 = await window.DiceSlot.d6(host, 'Enter the first D6');
      const d2 = await window.DiceSlot.d6(host, 'Enter the second D6');
      if (blockTray) [d1, d2].forEach(v => {
        const face = document.createElement('div');
        buildNumericFace(face, v);
        blockTray.appendChild(face);
      });
      return [d1, d2];
    }
    if (blockTray) {
      for (let i = 0; i < 2; i++) {
        const face = document.createElement('div');
        buildNumericFace(face, 1);
        blockTray.appendChild(face);
      }
    }
    const faces = blockTray ? Array.from(blockTray.children) : [];
    return faces.length === 2
      ? Promise.all(faces.map(f => rollNumericDie(f)))
      : [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
  }

  /* ── Pre-block reactions (resolved once per block action) ── */
  async function preBlock() {
    if (preBlockDone) return { abort: false };
    preBlockDone = true;
    clearPrompts();

    /* Foul Appearance: blocker rolls D6; on a 1 the Block is wasted. */
    if (defHas('Foul Appearance')) {
      const { value } = await askD6(`${esc(pName(defPlayer))} has <b>Foul Appearance</b> — ${esc(pName(attPlayer))} rolls (1 = wasted):`);
      if (value === 1) {
        showBlockResult('Block Wasted!', 'bad', `${pName(attPlayer)} is put off by ${pName(defPlayer)}'s Foul Appearance.`, 'bad');
        showCompleteBlock();
        return { abort: true };
      }
    }

    /* Blitz-dependent skills (Horns / Juggernaut / Frenzy). */
    if (attHas('Horns') || attHas('Juggernaut') || attHas('Frenzy')) {
      isBlitz = await askInline('Is this Block part of a <b>Blitz</b> action?',
        [{ text: 'Blitz', value: true, primary: true }, { text: 'Normal Block', value: false }]);
      if (isBlitz && attHas('Horns')) { stMods.att += 1; }
    }

    /* Multiple Block: block two marked players at −2 ST each. */
    if (attHas('Multiple Block')) {
      multiBlock = await askInline('Use <b>Multiple Block</b> (block two players, −2 ST each)?',
        [{ text: 'Multiple Block', value: true, primary: true }, { text: 'Single', value: false }]);
    }

    /* Dauntless vs a stronger opponent. */
    const baseA = attST + stMods.att - (multiBlock ? 2 : 0);
    if (attHas('Dauntless') && baseA < defST) {
      const { value } = await askD6(`<b>Dauntless</b> — roll D6 + ST ${baseA} vs ${esc(pName(defPlayer))} ST ${defST}:`);
      dauntlessOn = (baseA + value) > defST;
      const z = promptZone();
      const n = document.createElement('div');
      n.className = 'bwiz-prompt-note';
      n.textContent = dauntlessOn ? `Dauntless succeeds (${baseA + value} > ${defST}) — count as equal ST.`
                                  : `Dauntless fails (${baseA + value} ≤ ${defST}).`;
      z.appendChild(n);
    }

    if (defHas('Dump-Off')) {
      const z = promptZone();
      const n = document.createElement('div');
      n.className = 'bwiz-prompt-note';
      n.textContent = `${pName(defPlayer)} may Dump-Off a Quick Pass before this Block resolves.`;
      z.appendChild(n);
    }

    updateStDisplay();
    return { abort: false };
  }

  /* Offer Pro (re-roll a die on a 3+) once the dice have landed. */
  async function offerPro() {
    if (proUsed || !attHas('Pro')) return;
    const use = await askInline(`${esc(pName(attPlayer))} may use <b>Pro</b> (roll 3+ to re-roll):`,
      [{ text: 'Use Pro', value: true, primary: true }, { text: 'Skip', value: false }]);
    if (!use) return;
    proUsed = true;
    const { value } = await askD6('Pro check (3+):');
    if (value >= 3) doRoll();
    else {
      const z = promptZone();
      const n = document.createElement('div');
      n.className = 'bwiz-prompt-note';
      n.textContent = 'Pro failed — result stands.';
      z.appendChild(n);
    }
  }

  /* ── Main roll ── */
  async function doRoll() {
    rollBtn.disabled   = true;
    setGlow('off');
    if (confirmBtn) { confirmBtn.hidden = true; confirmBtn.classList.remove('glow-blue'); }
    if (useRrBtn)   { useRrBtn.hidden   = true; useRrBtn.classList.remove('glow-gold');  }
    if (defBanner)  defBanner.hidden  = true;
    chosenFace = null;

    const pre = await preBlock();
    /* The action is spent once committed — even a wasted block (Foul
       Appearance) uses the player's action for this turn. */
    if (attPlayer) window.markPlayerActed?.(attSide, attPlayer.idx, isBlitz ? 'blitz' : 'block');
    if (pre.abort) { rollBtn.disabled = true; return; }

    const { count, attFav } = calcBlock();
    renderDiceTray(count);
    if (attFav === false) document.getElementById('block-dice-tray').classList.add('def-picks');

    const faces = Array.from({ length: count }, (_, i) => document.getElementById(`block-face-${i}`));
    let rolls;
    if (wizardMode('block') === 'physical') {
      rolls = await window.DiceSlot.blockFaces(promptZone(), count);
      rolls.forEach((r, i) => buildBlockFace(faces[i], r));
    } else {
      rolls = await Promise.all(faces.map(f => rollBlockDie(f)));
    }
    rolledFaces  = rolls.map(r => BLOCK_FACES[r]);

    /* Roll button stays disabled — user must confirm or re-roll */
    renderRerolls();

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
    if (confirmBtn) { confirmBtn.hidden = false; confirmBtn.classList.add('glow-blue'); }

    /* Show Use Re-roll if the attacker's team has re-rolls left and none used yet */
    if (useRrBtn) {
      const gs    = window.GameState;
      const rrKey = attSide === 'right' ? 'away' : 'home';
      const show  = !rrUsed && (gs?.rerolls?.[rrKey] ?? 0) > 0;
      useRrBtn.hidden = !show;
      if (show) useRrBtn.classList.add('glow-gold');
    }

    /* Optional Pro re-roll once dice are visible. */
    offerPro();
  }

  function selectDie(idx) {
    const faces = document.querySelectorAll('#block-dice-tray .block-face');
    faces.forEach((f, i) => f.classList.toggle('bwiz-die-selected', i === idx));
    chosenFace = rolledFaces[idx];
  }

  useRrBtn?.addEventListener('click', async () => {
    const gs = window.GameState;
    if (rrUsed || !gs) return;
    const rrKey = attSide === 'right' ? 'away' : 'home';
    if (gs.rerolls[rrKey] <= 0) return;

    /* Loner: must roll the threshold first or the team re-roll is wasted. */
    if (attHas('Loner')) {
      const m = [...attSkills].map(s => s.match(/^Loner \((\d)\+\)$/)).find(Boolean);
      const thr = m ? parseInt(m[1], 10) : 4;
      const { value } = await askD6(`<b>Loner (${thr}+)</b> — roll to keep the team re-roll:`);
      gs.rerolls[rrKey] = Math.max(0, gs.rerolls[rrKey] - 1);  // RR is spent either way
      useRrBtn.classList.remove('glow-gold'); useRrBtn.hidden = true;
      renderRerolls();
      if (value < thr) {
        rrUsed = true;
        const z = promptZone();
        const n = document.createElement('div');
        n.className = 'bwiz-prompt-note';
        n.textContent = `Loner failed (${value}) — re-roll wasted.`;
        z.appendChild(n);
        return;
      }
    } else {
      gs.rerolls[rrKey] = Math.max(0, gs.rerolls[rrKey] - 1);
      useRrBtn.classList.remove('glow-gold'); useRrBtn.hidden = true;
    }
    rrUsed = true;
    const barId = rrKey === 'home' ? '#rr-home' : '#rr-away';
    document.querySelectorAll(`${barId} .rr-pip`).forEach((pip, idx) => {
      pip.classList.toggle('used', idx >= gs.rerolls[rrKey]);
    });
    renderRerolls();
    doRoll();
  });

  confirmBtn?.addEventListener('click', async () => {
    if (!chosenFace) return;
    confirmBtn.classList.remove('glow-blue');
    confirmBtn.hidden  = true;
    if (useRrBtn) { useRrBtn.classList.remove('glow-gold'); useRrBtn.hidden = true; }
    rollBtn.disabled   = true;   // locked until armor/injury sequence re-enables it
    if (defBanner) defBanner.hidden = true;
    /* Remove click listeners by cloning dice */
    document.querySelectorAll('#block-dice-tray .block-face').forEach(f => {
      const clone = f.cloneNode(true);
      f.replaceWith(clone);
    });
    await interpretResult(chosenFace);
  });

  /* ── Init ── */
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

  /* Ratio-locked fit: scale the whole stage to fit the panel on both axes. */
  let _blockFit = null;
  const scaleRoot = panel.querySelector('.bwiz-scale-root');

  /* Open picker on panel open — preserve player selections across close/reopen */
  onPanelOpen('panel-block', () => {
    resetRoll();
    if (!attPlayer) showPicker('att'); else restoreCard('att');
    if (!defPlayer) showPicker('def'); else restoreCard('def');
    updateStDisplay();
    renderRerolls();
    updateCardGlows();
    if (!_blockFit && scaleRoot) _blockFit = FitScale(panel.querySelector('.bwiz-panel-body'), scaleRoot, { max: 1.6 });
    else _blockFit?.refit();
  });

  rollBtn.onclick = doRoll;
}

/* ════════════════════════════════════════════════════════
   PASS WIZARD  (Sprint 3 rebuild — 8-step sequence)
   ════════════════════════════════════════════════════════ */

/* ── Skill extraction from a player card DOM element ── */
function getPlayerSkills(playerObj) {
  if (!playerObj?.card) return [];
  const domSkills = Array.from(playerObj.card.querySelectorAll('.skill-link'))
    .map(el => el.dataset.skill?.trim() ?? '')
    .filter(Boolean);
  /* Temporary effects may grant a skill for the duration (e.g. a prayer). These
     funnel through here so hasSkill / loadBlockSkills / special-action detection
     all see them. */
  const granted = (playerObj.effects ?? []).map(e => e.grantsSkill).filter(Boolean);
  return granted.length ? [...domSkills, ...granted] : domSkills;
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



/* ════════════════════════════════════════════════════════
   FOUL WIZARD
   ════════════════════════════════════════════════════════ */

function initFoulWizard() {
  const panel   = document.getElementById('panel-foul');
  const rollBtn = document.getElementById('foul-roll-btn');
  if (!rollBtn) return;

  let fouler = null, foulerSide = 'left';
  let target = null, targetSide = 'right';
  let assists = 0;

  const pName = p => p?.playerData?.name ?? p?.name ?? '?';
  const skillSet = player =>
    new Set(getPlayerSkills(player).map(s => s.replace(/\s*\(.*\)$/, '').trim()));

  /* Dice (shared numeric faces, like the Special Actions wizard).
     Physical mode: enter each die; the tray shows the entered faces.
     Per-die entry keeps the referee's natural-doubles check honest. */
  async function rollTwoD6() {
    const tray = document.getElementById('foul-dice-tray');
    tray.innerHTML = '';
    if (wizardMode('foul') === 'physical') {
      const host = tray.parentElement ?? tray;
      const d1 = await window.DiceSlot.d6(host, 'Enter the first D6');
      const d2 = await window.DiceSlot.d6(host, 'Enter the second D6');
      [d1, d2].forEach(v => {
        const d = document.createElement('div'); buildNumericFace(d, v); tray.appendChild(d);
      });
      return [d1, d2];
    }
    const faces = [0, 1].map(() => {
      const d = document.createElement('div'); buildNumericFace(d, 1); tray.appendChild(d); return d;
    });
    return Promise.all(faces.map(f => rollNumericDie(f)));
  }

  /* Result panels */
  function setPanel(panelId, contentId, headline, cls, note) {
    document.getElementById(panelId)?.classList.remove('locked');
    const el = document.getElementById(contentId);
    if (!el) return;
    el.className = 'bwiz-result-content';
    el.innerHTML = `<div class="bwiz-result-headline bwiz-result-${cls}">${esc(headline)}</div>` +
      (note ? `<p class="bwiz-result-note info">${note}</p>` : '');
  }

  function lockPanels() {
    ['foul-armor-panel', 'foul-injury-panel', 'foul-ref-panel'].forEach(id =>
      document.getElementById(id)?.classList.add('locked'));
    ['foul-armor-content', 'foul-injury-content', 'foul-ref-content'].forEach(id => {
      const el = document.getElementById(id); if (el) el.textContent = '—';
    });
    const tray = document.getElementById('foul-dice-tray'); if (tray) tray.innerHTML = '';
  }

  function complete() {
    rollBtn.disabled = false;
    rollBtn.textContent = 'Done';
    rollBtn.classList.add('roll-btn--complete');
    rollBtn.onclick = () => document.querySelector('#panel-foul .panel-close')?.click();
  }

  function readyToRoll() {
    if (rollBtn.classList.contains('roll-btn--complete')) return;
    rollBtn.disabled = !(fouler && target);
  }

  function updateSummary() {
    const el = document.getElementById('foul-summary');
    if (!el) return;
    if (!fouler || !target) { el.textContent = 'Select fouler and target'; return; }
    const dirtyPlayer = skillSet(fouler).has('Dirty Player');
    const av    = parseStat(target.statsText, 'AV') ?? 9;
    const bonus = assists + (dirtyPlayer ? 1 : 0);
    el.innerHTML = `${esc(pName(fouler))} fouls ${esc(pName(target))}` +
      `<br>vs AV ${av}+ · +${bonus}` +
      (assists ? ` (${assists} assist${assists > 1 ? 's' : ''})` : '') +
      (dirtyPlayer ? ' · Dirty Player' : '');
  }

  /* Resolution: Armour -> Injury -> Casualty, with referee doubles check */
  async function resolve() {
    if (!(fouler && target)) return;
    rollBtn.disabled = true;
    rollBtn.textContent = 'Rolling…';
    rollBtn.onclick = null;
    lockPanels();
    window.markPlayerActed?.(foulerSide, fouler.idx, 'foul');

    const tSkills     = skillSet(target);
    const dirtyPlayer = skillSet(fouler).has('Dirty Player');
    const av          = parseStat(target.statsText, 'AV') ?? 9;
    const stunty      = tSkills.has('Stunty') ? 1 : 0;
    const thickSkull  = tSkills.has('Thick Skull');
    const ironHard    = tSkills.has('Iron Hard Skin');
    const bonus       = assists + (dirtyPlayer ? 1 : 0);
    const bonusTxt    = bonus
      ? ` + ${bonus} (${assists ? `${assists} assist${assists > 1 ? 's' : ''}` : ''}${assists && dirtyPlayer ? ', ' : ''}${dirtyPlayer ? 'Dirty Player' : ''})`
      : '';

    /* Armour */
    const [a1, a2] = await rollTwoD6();
    const armour   = BBResolve.armourBreaks(a1, a2, { av, bonus, ironHard });
    setPanel('foul-armor-panel', 'foul-armor-content',
      armour.broke ? 'Armour Broken!' : 'Armour Holds', armour.broke ? 'bad' : 'ok',
      `${a1} + ${a2}${bonusTxt} = ${armour.shown} vs AV ${av}+${ironHard ? ' · Iron Hard Skin' : ''}`);

    let injuryDouble = false;
    if (armour.broke) {
      await pause(350);
      /* Injury */
      const [i1, i2] = await rollTwoD6();
      injuryDouble   = i1 === i2;
      const inj      = BBResolve.injuryOutcome(i1, i2, { mb: bonus, stunty, thickSkull });
      setPanel('foul-injury-panel', 'foul-injury-content', `${pName(target)} ${inj.outcome}!`,
        inj.outcome === 'Stunned' ? 'warn' : 'bad',
        `${i1} + ${i2}${bonus ? ` + ${bonus}` : ''}${stunty ? ' + 1 Stunty' : ''} = ${inj.total}`);
      BBResolve.applyStatus(targetSide, target.idx, inj.status);

      if (inj.outcome === 'Casualty') {
        const decay = tSkills.has('Decay') ? 1 : 0;
        let casVal, cas;
        if (wizardMode('foul') === 'physical') {
          const host = document.getElementById('foul-injury-panel') ?? document.body;
          const entered = await window.DiceSlot.d16(host);
          casVal = Math.min(16, entered + decay);
          cas = rangeFind(window.BBData?.injury?.casualty, casVal) ?? { result: 'Unknown', 'class': '', desc: '' };
        } else {
          ({ casVal, cas } = BBResolve.rollCasualty(decay));
        }
        const el = document.createElement('div');
        el.className = 'bwiz-casualty-result';
        el.innerHTML =
          `<div class="bwiz-result-headline bwiz-result-bad">${esc(cas.result)}</div>` +
          (cas.desc ? `<p class="bwiz-result-note bad">${esc(cas.desc)}</p>` : '') +
          `<p class="bwiz-math-row">Casualty table · D16: ${casVal}${decay ? ' (+1 Decay)' : ''}</p>`;
        document.getElementById('foul-injury-panel')?.appendChild(el);
      }
    }

    /* The Referee: a natural double on Armour OR Injury spots the foul */
    const armourDouble = a1 === a2;
    if (armourDouble || injuryDouble) {
      const on = armourDouble ? 'Armour' : 'Injury';
      setPanel('foul-ref-panel', 'foul-ref-content', 'Sent Off!', 'bad',
        `Natural double on the ${on} roll — the referee spots the foul and ejects ${esc(pName(fouler))}. ` +
        `<strong>Argue the Call</strong>: D6 — 6 the player stays, 1 the coach is ejected too, 2–5 the call stands. A <em>Bribe</em> avoids it on 2+.`);
    } else {
      setPanel('foul-ref-panel', 'foul-ref-content', 'No Whistle', 'ok',
        'No double rolled — the referee misses the foul.');
    }

    complete();
  }

  /* Fouler/target card columns (mirrors the Block wizard) */
  function showPicker(role) {
    const wrap   = document.getElementById(`foul-${role}-card-wrap`);
    const picker = document.getElementById(`foul-${role}-picker`);
    if (!wrap || !picker) return;
    wrap.querySelectorAll('.bwiz-embedded-card').forEach(c => c.remove());
    picker.hidden = false;

    const PS = window.PlayerStatus;
    const isFouler = role === 'fouler';
    const side     = isFouler ? foulerSide : targetSide;
    const listId   = isFouler ? 'foul-fouler-list' : 'foul-target-list';
    const filter   = isFouler
      ? (p => window.isPlayerAvailable?.(p))
      : (p => p.status === PS?.PRONE || p.status === PS?.STUNNED);

    buildWizardPlayerList(listId, side, filter, (player) => {
      if (isFouler) { fouler = player; foulerSide = side; }
      else          { target = player; targetSide = side; }
      picker.hidden = true;
      buildEmbeddedCardShared(wrap, player, side);
      resetRoll();
      updateSummary();
      readyToRoll();
    /* Being fouled is not an action — acted players are legal targets. */
    }, isFouler ? {} : { allowActed: true });
  }

  function restoreCard(role) {
    const wrap   = document.getElementById(`foul-${role}-card-wrap`);
    const picker = document.getElementById(`foul-${role}-picker`);
    if (!wrap || !picker) return;
    const player = role === 'fouler' ? fouler : target;
    const side   = role === 'fouler' ? foulerSide : targetSide;
    if (!player) { showPicker(role); return; }
    picker.hidden = true;
    if (!wrap.querySelector('.bwiz-embedded-card')) buildEmbeddedCardShared(wrap, player, side);
  }

  function resetRoll() {
    rollBtn.textContent = 'Roll Foul';
    rollBtn.classList.remove('roll-btn--complete');
    rollBtn.onclick = resolve;
    lockPanels();
    readyToRoll();
  }

  /* Reset a role's card when its roster changes while the panel is open */
  function watchRosterForReset(rosterId, role) {
    const roster = document.getElementById(rosterId);
    if (!roster) return;
    new MutationObserver(() => {
      if (panel?.hasAttribute('hidden')) return;
      if (role === 'fouler') fouler = null; else target = null;
      assists = 0;
      renderAssistDots();
      showPicker(role);
      updateSummary();
      resetRoll();
    }).observe(roster, { childList: true });
  }

  function renderAssistDots() {
    const el = document.getElementById('foul-assists-dots');
    if (!el) return;
    el.innerHTML = '';
    const label = document.createElement('div');
    label.className = 'bwiz-assists-label';
    label.textContent = 'Assists';
    el.appendChild(label);
    const row = document.createElement('div');
    row.className = 'bwiz-assists-row';
    for (let i = 1; i <= 6; i++) {
      const dot = document.createElement('button');
      dot.className = 'assist-dot' + (i <= assists ? ' active' : '');
      dot.dataset.n = i;
      dot.setAttribute('aria-label', `${i} assist${i > 1 ? 's' : ''}`);
      dot.addEventListener('click', () => {
        assists = (assists === i) ? i - 1 : i;
        renderAssistDots();
        updateSummary();
      });
      row.appendChild(dot);
    }
    el.appendChild(row);
  }

  document.getElementById('foul-change-fouler')?.addEventListener('click', () => showPicker('fouler'));
  document.getElementById('foul-change-target')?.addEventListener('click', () => showPicker('target'));

  watchRosterForReset('roster-left',  'fouler');
  watchRosterForReset('roster-right', 'target');

  /* Fit-to-panel scaling, identical to the Block wizard. */
  let _foulFit = null;
  const scaleRoot = panel.querySelector('.bwiz-scale-root');

  rollBtn.onclick = resolve;
  renderAssistDots();

  onPanelOpen('panel-foul', () => {
    /* Fouler from the team taking its turn (left), target from the opponent. */
    foulerSide = 'left'; targetSide = 'right';
    resetRoll();
    if (!fouler) showPicker('fouler'); else restoreCard('fouler');
    if (!target) showPicker('target'); else restoreCard('target');
    renderAssistDots();
    updateSummary();
    if (!_foulFit && scaleRoot) _foulFit = FitScale(panel.querySelector('.bwiz-panel-body'), scaleRoot, { max: 1.6 });
    else _foulFit?.refit();
  });
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
    /* Persistent fixed-design stage (FitScale) like Block/Foul/Special. */
    let root = body.querySelector('.bwiz-scale-root');
    if (!root) {
      root = document.createElement('div');
      root.className = 'bwiz-scale-root bwiz-scale-root--throw';
      body.appendChild(root);
    }
    root.innerHTML = '';
    const sumEl = document.createElement('div');
    sumEl.className = 'pass-summary-strip'; sumEl.id = 'twiz-summary';
    root.appendChild(sumEl);
    const indEl = document.createElement('div');
    indEl.className = 'pass-step-indicator'; indEl.id = 'twiz-ind';
    root.appendChild(indEl);
    const contentEl = document.createElement('div');
    contentEl.id = 'twiz-content';
    root.appendChild(contentEl);
    const navEl = document.createElement('div');
    navEl.className = 'pass-nav';
    navEl.innerHTML = `<button class="pass-nav-btn" id="twiz-back">← Back</button><button class="pass-nav-btn nav-primary" id="twiz-next">Next →</button>`;
    root.appendChild(navEl);
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
      filterFn: p => hasSkill(p, 'Throw Team-Mate') && window.isPlayerAvailable?.(p),
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
      filterFn: p => hasSkill(p, 'Right Stuff') && window.isPlayerAvailable?.(p),
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
      /* Throw committed — thrower AND thrown team-mate have acted. */
      if (ws.thrower) window.markPlayerActed?.(ws.throwerSide, ws.thrower.idx, 'throw-teammate');
      if (ws.thrown)  window.markPlayerActed?.(ws.thrownSide,  ws.thrown.idx,  'thrown');

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

  let _throwFit = null;
  onPanelOpen('panel-throw', () => {
    ws.step = 1;
    ws.throwResult   = null;
    ws.hungryResult  = null;
    ws.scatterDirs   = [];
    ws.landingResult = null;
    buildShell();
    render();
    const root = body.querySelector('.bwiz-scale-root');
    if (!_throwFit && root) _throwFit = FitScale(body, root, { max: 1.6 });
    else _throwFit?.refit();
  });

  panel.addEventListener('bb:diceMode', () => render());
}

/* ════════════════════════════════════════════════════════
   PLAYER SELECTION PANELS (shared utility)
   Event delegation — one listener on container.
   ════════════════════════════════════════════════════════ */

function buildWizardPlayerList(listId, side, filterFn, onSelect, opts = {}) {
  const container = document.getElementById(listId);
  if (!container) return { getSelected: () => null };

  const allPlayers = window.getPlayerList?.(side) ?? [];
  const players    = allPlayers.filter(filterFn);
  if (opts.sort) players.sort(opts.sort);

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
    /* Already acted this turn → visible but not selectable
       (opts.allowActed: e.g. catching a pass is not an action). */
    const acted = !opts.allowActed && window.hasPlayerActed?.(side, p.idx);

    const btn = document.createElement('button');
    btn.type  = 'button';
    btn.className = 'wps-player-btn' + (acted ? ' wps-acted' : '');
    btn.dataset.playerIdx = p.idx;
    if (acted) btn.disabled = true;

    const stMatch  = p.statsText.match(/\bST\s*(\d+)/i);
    const avMatch  = p.statsText.match(/\bAV\s*(\d+)/i);
    const stVal    = stMatch  ? stMatch[1]  : null;
    const avVal    = avMatch  ? avMatch[1]  : null;
    const statHint = opts.statHint ? opts.statHint(p) : (stVal ? `ST${stVal}` : (avVal ? `AV${avVal}+` : ''));

    const statusMeta = window.STATUS_META?.[p.status];
    const statusHtml = statusMeta?.label
      ? `<span class="player-status-badge ${statusMeta.cls}">${statusMeta.label}</span>`
      : '';

    btn.innerHTML = `
      <span class="wps-name">${esc(p.name)}</span>
      ${p.pos    ? `<span class="wps-pos">${esc(p.pos)}</span>` : ''}
      ${statHint ? `<span class="wps-stat-badge">${statHint}</span>` : ''}
      ${statusHtml}
      ${acted ? '<span class="player-status-badge status-acted">Acted</span>' : ''}
    `;

    if (acted) { container.appendChild(btn); return; }

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

/* initBlockPlayerSelect removed — integrated into initBlockWizard() */


/* ════════════════════════════════════════════════════════
   BOOT
   ════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════
   SPECIAL ACTIONS WIZARD
   Alternative attacks made "instead of a block": Stab, Chainsaw,
   Breathe Fire, Projectile Vomit, Chomp. Each rolls its own to-hit,
   then shares the armour → injury → casualty tail via BBResolve.
   ════════════════════════════════════════════════════════ */

const SPECIAL_ACTIONS = {
  'Stab':             { label: 'Stab',             hit: null,                                          armourBonus: 0, desc: 'Unmodified Armour roll; if broken, make an Injury roll.' },
  'Chainsaw':         { label: 'Chainsaw',         hit: { threshold: 2, selfOn1: true },               armourBonus: 3, desc: 'D6 2+ → Armour +3. On a 1 (Kickback) the user is hit instead.' },
  'Breathe Fire':     { label: 'Breathe Fire',     hit: { threshold: 2, selfOn1: true, vsStrong: -1 }, armourBonus: 0, desc: 'D6 (−1 vs ST5+). On a 1 the user is Knocked Down; 2+ hits the target.' },
  'Projectile Vomit': { label: 'Projectile Vomit', hit: { threshold: 2, selfOn1: true },               armourBonus: 0, desc: 'D6 2+ → unmodified Armour roll. On a 1 the user is Knocked Down.' },
  'Monstrous Mouth':  { label: 'Chomp',            hit: { threshold: 3 },                               armourBonus: 0, desc: 'D6 3+ → Chomp the target (Armour roll).' },
};

function specialSkillsOf(player) {
  const seen = new Set();
  return getPlayerSkills(player)
    .map(s => s.replace(/\s*\(.*\)$/, '').trim())
    .filter(s => SPECIAL_ACTIONS[s] && !seen.has(s) && seen.add(s));
}

function initSpecialWizard() {
  const rollBtn = document.getElementById('spec-roll-btn');
  if (!rollBtn) return;

  let actor = null, actorSide = 'left';
  let target = null, targetSide = 'right';
  let chosenSkill = null;

  const opposite = side => (side === 'left' ? 'right' : 'left');
  const pName = p => p?.playerData?.name ?? p?.name ?? '?';

  async function rollOneD6() {
    const tray = document.getElementById('spec-dice-tray');
    tray.innerHTML = '';
    if (wizardMode('special') === 'physical') {
      const v = await window.DiceSlot.d6(tray.parentElement ?? tray, 'Enter your D6 roll');
      const die = document.createElement('div'); buildNumericFace(die, v); tray.appendChild(die);
      return v;
    }
    const die = document.createElement('div'); buildNumericFace(die, 1); tray.appendChild(die);
    return rollNumericDie(die);
  }
  async function rollTwoD6() {
    const tray = document.getElementById('spec-dice-tray');
    tray.innerHTML = '';
    if (wizardMode('special') === 'physical') {
      const host = tray.parentElement ?? tray;
      const d1 = await window.DiceSlot.d6(host, 'Enter the first D6');
      const d2 = await window.DiceSlot.d6(host, 'Enter the second D6');
      [d1, d2].forEach(v => {
        const d = document.createElement('div'); buildNumericFace(d, v); tray.appendChild(d);
      });
      return [d1, d2];
    }
    const faces = [0, 1].map(() => { const d = document.createElement('div'); buildNumericFace(d, 1); tray.appendChild(d); return d; });
    return Promise.all(faces.map(f => rollNumericDie(f)));
  }

  function setPanel(panelId, contentId, headline, cls, note) {
    document.getElementById(panelId)?.classList.remove('locked');
    const el = document.getElementById(contentId);
    if (!el) return;
    el.className = 'bwiz-result-content';
    el.innerHTML = `<div class="bwiz-result-headline bwiz-result-${cls}">${esc(headline)}</div>` +
      (note ? `<p class="bwiz-result-note info">${note}</p>` : '');
  }

  function lockPanels() {
    ['spec-hit-panel', 'spec-armor-panel', 'spec-injury-panel'].forEach(id =>
      document.getElementById(id)?.classList.add('locked'));
    ['spec-hit-content', 'spec-armor-content', 'spec-injury-content'].forEach(id => {
      const el = document.getElementById(id); if (el) el.textContent = '—';
    });
    const tray = document.getElementById('spec-dice-tray'); if (tray) tray.innerHTML = '';
  }

  function complete() {
    rollBtn.disabled = false;
    rollBtn.textContent = 'Done';
    rollBtn.classList.add('roll-btn--complete');
    rollBtn.onclick = () => document.querySelector('#panel-special .panel-close')?.click();
  }

  function readyToResolve() {
    rollBtn.disabled = !(actor && target && chosenSkill);
  }

  function skillSet(player) {
    return new Set(getPlayerSkills(player).map(s => s.replace(/\s*\(.*\)$/, '').trim()));
  }

  async function resolve() {
    if (!(actor && target && chosenSkill)) return;
    const cfg = SPECIAL_ACTIONS[chosenSkill];
    rollBtn.disabled = true;
    rollBtn.textContent = 'Resolving…';
    rollBtn.onclick = null;
    lockPanels();
    window.markPlayerActed?.(actorSide, actor.idx, 'special');

    let victim = target, victimSide = targetSide;

    /* ── To-hit ── */
    if (cfg.hit) {
      const targetST = parseStat(target.statsText, 'ST') ?? 3;
      const mod = (cfg.hit.vsStrong && targetST >= 5) ? cfg.hit.vsStrong : 0;
      const raw = await rollOneD6();
      const val = raw + mod;
      const rollTxt = `${raw}${mod ? ` ${mod} = ${val}` : ''}`;
      if (cfg.hit.selfOn1 && raw === 1) {
        victim = actor; victimSide = actorSide;
        setPanel('spec-hit-panel', 'spec-hit-content', `${cfg.label}: Kickback!`, 'bad',
          `${esc(pName(actor))} is hit instead (rolled 1).`);
      } else if (val < cfg.hit.threshold) {
        setPanel('spec-hit-panel', 'spec-hit-content', `${cfg.label} Misses`, 'ok',
          `Rolled ${rollTxt} — needed ${cfg.hit.threshold}+.`);
        complete(); return;
      } else {
        setPanel('spec-hit-panel', 'spec-hit-content', `${cfg.label} Hits!`, 'warn', `Rolled ${rollTxt}.`);
      }
    } else {
      setPanel('spec-hit-panel', 'spec-hit-content', cfg.label, 'warn', 'Unmodified Armour roll.');
    }

    /* ── Armour ── */
    const vSkills  = skillSet(victim);
    const av       = parseStat(victim.statsText, 'AV') ?? 9;
    const ironHard = vSkills.has('Iron Hard Skin');
    const [a1, a2] = await rollTwoD6();
    const armour   = BBResolve.armourBreaks(a1, a2, { av, bonus: cfg.armourBonus, ironHard });
    const bonusTxt = (cfg.armourBonus && !ironHard) ? ` + ${cfg.armourBonus}` : '';
    setPanel('spec-armor-panel', 'spec-armor-content',
      armour.broke ? 'Armor Broken!' : 'Armor Holds', armour.broke ? 'bad' : 'ok',
      `${a1} + ${a2}${bonusTxt} = ${armour.shown} vs AV ${av}+${ironHard ? ' · Iron Hard Skin' : ''}`);
    if (!armour.broke) { complete(); return; }

    /* ── Injury ── */
    const stunty     = vSkills.has('Stunty') ? 1 : 0;
    const thickSkull = vSkills.has('Thick Skull');
    const [i1, i2]   = await rollTwoD6();
    const inj        = BBResolve.injuryOutcome(i1, i2, { stunty, thickSkull });
    setPanel('spec-injury-panel', 'spec-injury-content', `${pName(victim)} ${inj.outcome}!`,
      inj.outcome === 'Stunned' ? 'warn' : 'bad',
      `${i1} + ${i2}${stunty ? ' +1 Stunty' : ''} = ${inj.total}`);
    BBResolve.applyStatus(victimSide, victim.idx, inj.status);

    if (inj.outcome === 'Casualty') {
      const decay = vSkills.has('Decay') ? 1 : 0;
      let casVal, cas;
      if (wizardMode('special') === 'physical') {
        const entered = await window.DiceSlot.d16(document.getElementById('spec-injury-panel') ?? document.body);
        casVal = Math.min(16, entered + decay);
        cas = rangeFind(window.BBData?.injury?.casualty, casVal) ?? { result: 'Unknown', 'class': '', desc: '' };
      } else {
        ({ casVal, cas } = BBResolve.rollCasualty(decay));
      }
      const panel = document.getElementById('spec-injury-panel');
      const el = document.createElement('div');
      el.className = 'bwiz-casualty-result';
      el.innerHTML =
        `<div class="bwiz-result-headline bwiz-result-bad">${esc(cas.result)}</div>` +
        (cas.desc ? `<p class="bwiz-result-note bad">${esc(cas.desc)}</p>` : '') +
        `<p class="bwiz-math-row">Casualty table · D16: ${casVal}${decay ? ' (+1 Decay)' : ''}</p>`;
      panel.appendChild(el);
    }
    complete();
  }

  function buildActionChips() {
    const wrap = document.getElementById('spec-action-chips');
    wrap.innerHTML = '';
    chosenSkill = null;
    if (!actor) return;
    specialSkillsOf(actor).forEach(skill => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'spec-chip';
      chip.textContent = SPECIAL_ACTIONS[skill].label;
      chip.addEventListener('click', () => {
        chosenSkill = skill;
        wrap.querySelectorAll('.spec-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const n = document.getElementById('spec-action-name');
        if (n) n.innerHTML = `<b>${esc(SPECIAL_ACTIONS[skill].label)}</b> — ${esc(SPECIAL_ACTIONS[skill].desc)}`;
        readyToResolve();
      });
      wrap.appendChild(chip);
    });
  }

  function buildTargetList() {
    const PS = window.PlayerStatus;
    buildWizardPlayerList('spec-target-list', targetSide,
      p => p.status === PS?.AVAILABLE && window.isPlayerAvailable?.(p),
      (p) => { target = p; readyToResolve(); },
      /* Being attacked is not an action — acted players are legal targets. */
      { allowActed: true });
  }

  function refresh() {
    actor = null; target = null; chosenSkill = null;
    rollBtn.textContent = 'Resolve';
    rollBtn.classList.remove('roll-btn--complete');
    rollBtn.onclick = resolve;
    rollBtn.disabled = true;
    lockPanels();
    document.getElementById('spec-action-chips').innerHTML = '';
    const n = document.getElementById('spec-action-name');
    if (n) n.textContent = 'Select an acting player and a target.';
    document.getElementById('spec-target-list').innerHTML = '<p class="wps-empty">Choose an acting player</p>';

    const wrap = document.getElementById('spec-actor-wrap');
    if (wrap) {
      wrap.innerHTML = '';
      buildRosterTabs(wrap, {
        tabsId: 'spec-actor',
        initialSide: 'left',
        filterFn: p => specialSkillsOf(p).length > 0 && window.isPlayerAvailable?.(p),
        onSelect: (p, _stats, side) => {
          actor = p; actorSide = side; targetSide = opposite(side);
          buildActionChips();
          buildTargetList();
          readyToResolve();
        },
      });
    }
  }

  rollBtn.onclick = resolve;

  /* Fit-to-panel scaling, identical to the Block/Foul wizards. */
  let _specFit = null;
  const specPanel = document.getElementById('panel-special');
  const specScaleRoot = specPanel?.querySelector('.bwiz-scale-root');
  onPanelOpen('panel-special', () => {
    refresh();
    if (!_specFit && specScaleRoot) _specFit = FitScale(specPanel.querySelector('.bwiz-panel-body'), specScaleRoot, { max: 1.6 });
    else _specFit?.refit();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initBlockWizard();
  initPassWizard();
  initFoulWizard();
  initThrowWizard();
  initSpecialWizard();
});
