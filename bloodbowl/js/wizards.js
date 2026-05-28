'use strict';

/* ═══════════════════════════════════════════════════════
   Blood Bowl Companion — js/wizards.js
   Phase 3 action wizards: Block, Pass, Foul, Throw Team-Mate
   Depends on: dice.js (window.Dice), panels.js (window.BBData)
   ═══════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────
   BLOCK DIE
   BB2025 faces (1-indexed):
     1  Attacker Down   (skull — bad; attacker falls)
     2  Both Down       (both players fall)
     3  Push            (defender pushed)
     4  Push            (push — two push faces on the die)
     5  Stumble         (defender stumbles; Dodge can save)
     6  Defender Down   (green — best for attacker)
   ──────────────────────────────────────────────────────── */

const BLOCK_FACES = [
  null, /* 1-indexed — index 0 unused */
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
  const MAX = 9;
  const iv = setInterval(() => {
    if (cycles++ >= MAX) { clearInterval(iv); return; }
    buildBlockFace(faceEl, Math.floor(Math.random() * 6) + 1);
  }, 52);

  faceEl.classList.remove('rolling', 'settled');
  void faceEl.offsetWidth;                          /* restart animation */
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

/** Bind a stepper widget (+/− buttons around a value span).
 *  Returns { get, set } accessor. onChange(value) fires on each change. */
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

/** HTML-escape a string. */
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Promise-based delay. */
function pause(ms) { return new Promise(r => setTimeout(r, ms)); }

/** Find first entry in a range table where roll >= e.min && roll <= e.max. */
function rangeFind(table, roll, minKey = 'min', maxKey = 'max') {
  return (table ?? []).find(e => roll >= e[minKey] && roll <= e[maxKey]) ?? null;
}

/* ════════════════════════════════════════════════════════
   BLOCK WIZARD
   ════════════════════════════════════════════════════════ */

function initBlockWizard() {
  const rollBtn  = document.getElementById('block-roll-btn');
  if (!rollBtn) return;

  /* State */
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
      buildBlockFace(face, 3); /* default: Push */
      tray.appendChild(face);
    }
  }

  function updateInfo() {
    const { count, who } = calcBlock();
    const countEl = document.getElementById('block-dice-count');
    const noteEl  = document.getElementById('block-dice-note');
    if (countEl) countEl.textContent = count;
    if (noteEl) {
      noteEl.textContent = who
        ? `${count > 1 ? 'dice' : 'die'} — ${who}`
        : 'block die — equal strength';
    }
    renderDiceTray(count);
  }

  /* Wire up steppers */
  const attStStepper = bindStepper(document.getElementById('block-att-st'),      1, 7, v => { attST  = v; updateInfo(); });
  const defStStepper = bindStepper(document.getElementById('block-def-st'),      1, 7, v => { defST  = v; updateInfo(); });
  bindStepper(document.getElementById('block-att-assists'), 0, 6, v => { attAst = v; updateInfo(); });
  bindStepper(document.getElementById('block-def-assists'), 0, 6, v => { defAst = v; updateInfo(); });

  updateInfo();

  /* Player selection lists */
  initBlockPlayerSelect(attStStepper, defStStepper);

  const resultEl = document.getElementById('block-result');

  rollBtn.addEventListener('click', async () => {
    rollBtn.disabled = true;
    resultEl.hidden  = true;

    const { count, who } = calcBlock();
    const faces = Array.from({ length: count }, (_, i) => document.getElementById(`block-face-${i}`));

    /* Roll all dice simultaneously */
    const rolls   = await Promise.all(faces.map(f => rollBlockDie(f)));
    const results = rolls.map(r => BLOCK_FACES[r]);

    /* Determine chooser label */
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

    /* Skill / rules notes for present results */
    const keys   = new Set(results.map(r => r.key));
    const notes  = [];
    if (keys.has('att-down'))  notes.push('💀 <strong>Attacker Down</strong>: attacker is knocked down — Turnover!');
    if (keys.has('both-down')) notes.push('⚡ <strong>Both Down</strong>: both fall, unless attacker has <em>Block</em> skill (cancel one Both Down) or <em>Wrestle</em>.');
    if (keys.has('stumble'))   notes.push('↗ <strong>Stumble</strong>: defender is knocked down, unless they use their <em>Dodge</em> skill to treat it as a Push instead.');
    if (keys.has('def-down'))  notes.push('★ <strong>Defender Down</strong>: defender is knocked down — roll Armour!');

    if (notes.length) {
      html += `<div class="result-notes"><ul style="margin:0.3rem 0 0;padding-left:1.1rem;font-size:0.79rem;color:rgba(255,255,255,0.72);">`;
      notes.forEach(n => { html += `<li style="margin-bottom:0.3rem;">${n}</li>`; });
      html += '</ul></div>';
    }

    resultEl.innerHTML  = html;
    resultEl.hidden     = false;
    rollBtn.disabled    = false;
  });
}

/* ════════════════════════════════════════════════════════
   PASS WIZARD
   ════════════════════════════════════════════════════════ */

function initPassWizard() {
  const rollBtn = document.getElementById('pass-roll-btn');
  if (!rollBtn) return;

  let paTarget  = 4;    /* PA stat — need to meet or beat this on D6 */
  let rangeMod  = 0;    /* modifier from range selection */
  const mods    = { tz: false, weather: false };
  let catchAG   = 4;
  const catchMods = { tz: false, weather: false };

  /* ── PA picker ── */
  document.getElementById('pass-pa-picker')?.addEventListener('click', e => {
    const btn = e.target.closest('.av-btn');
    if (!btn) return;
    document.querySelectorAll('#pass-pa-picker .av-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    paTarget = parseInt(btn.dataset.pa, 10);
    refreshTarget();
  });

  /* ── Range picker ── */
  document.querySelectorAll('#pass-range-picker .av-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#pass-range-picker .av-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      rangeMod = parseInt(btn.dataset.range, 10) || 0;
      refreshTarget();
    });
  });

  /* ── Pass modifier toggles ── */
  document.getElementById('pass-mod-tz')?.addEventListener('click', e => {
    mods.tz = !mods.tz; e.currentTarget.classList.toggle('active', mods.tz); refreshTarget();
  });
  document.getElementById('pass-mod-weather')?.addEventListener('click', e => {
    mods.weather = !mods.weather; e.currentTarget.classList.toggle('active', mods.weather); refreshTarget();
  });

  function totalMod() { return rangeMod + (mods.tz ? -1 : 0) + (mods.weather ? -1 : 0); }

  function refreshTarget() {
    const targetEl = document.getElementById('pass-target');
    const noteEl   = document.getElementById('pass-mod-note');
    if (!targetEl) return;
    const mod = totalMod();
    if (paTarget === 99) {
      targetEl.textContent = '—';
      if (noteEl) noteEl.textContent = ' No PA — always inaccurate';
    } else {
      /* Effective threshold: roll must be (paTarget - mod) or better on a raw die,
         which is equivalent to asking for modified roll ≥ paTarget. */
      const threshold = Math.min(6, Math.max(2, paTarget - mod));
      targetEl.textContent = `${threshold}+`;
      if (noteEl) noteEl.textContent = mod !== 0 ? ` (base ${paTarget}+, modifier ${mod > 0 ? '+' : ''}${mod})` : '';
    }
  }

  refreshTarget();

  /* ── Catch AG picker ── */
  document.getElementById('catch-ag-picker')?.addEventListener('click', e => {
    const btn = e.target.closest('.av-btn');
    if (!btn) return;
    document.querySelectorAll('#catch-ag-picker .av-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    catchAG = parseInt(btn.dataset.ag, 10);
  });

  document.getElementById('catch-mod-tz')?.addEventListener('click', e => {
    catchMods.tz = !catchMods.tz; e.currentTarget.classList.toggle('active', catchMods.tz);
  });
  document.getElementById('catch-mod-weather')?.addEventListener('click', e => {
    catchMods.weather = !catchMods.weather; e.currentTarget.classList.toggle('active', catchMods.weather);
  });

  /* ── Main pass roll ── */
  const d1El         = document.getElementById('pass-d1');
  const resultEl     = document.getElementById('pass-result');
  const catchSection = document.getElementById('pass-catch-section');

  rollBtn.addEventListener('click', async () => {
    rollBtn.disabled = true;
    resultEl.hidden  = true;
    if (catchSection) catchSection.hidden = true;

    const roll     = await Dice.rollDieElement(d1El);
    const mod      = totalMod();
    const modified = roll + mod;

    let outcome, title, cls, desc;

    if (paTarget === 99) {
      /* No PA — always inaccurate (fumble on 1) */
      if (roll === 1) {
        outcome = 'fumble'; title = 'Fumble!'; cls = 'result-cas';
        desc = "Natural 1 — the ball hits the ground! Place it in the thrower's square, scatter once, Turnover.";
      } else {
        outcome = 'inaccurate'; title = 'Inaccurate Pass'; cls = 'result-ko';
        desc = 'No Passing Ability — the pass is always inaccurate. The ball scatters 3 times from the target square. Play continues (no Turnover unless it scatters OOB or is caught by opponent).';
      }
    } else if (roll === 1) {
      /* Natural 1 = Fumble regardless of modifiers */
      outcome = 'fumble'; title = 'Fumble!'; cls = 'result-cas';
      desc = "Natural 1 — the ball is fumbled! Place it in the thrower's square, scatter once, Turnover.";
    } else if (modified >= paTarget) {
      outcome = 'complete'; title = 'Accurate Pass!'; cls = 'result-ok';
      desc = `Roll ${roll}${mod !== 0 ? ` (modified to ${modified})` : ''} vs ${paTarget}+ — the ball lands on target. A catcher in the square may now attempt to catch it.`;
    } else {
      outcome = 'inaccurate'; title = 'Inaccurate Pass'; cls = 'result-ko';
      desc = `Roll ${roll}${mod !== 0 ? ` (modified to ${modified})` : ''} vs ${paTarget}+ — the ball scatters 3 times from the target square. Play continues (no Turnover unless the ball is caught by an opponent or goes OOB without being caught).`;
    }

    resultEl.innerHTML = `
      <div class="result-roll-num">${roll}${mod !== 0 ? `<span style="font-size:1rem;font-weight:600;"> (${mod > 0 ? '+' : ''}${mod})</span>` : ''}</div>
      <div class="result-name ${cls}">${esc(title)}</div>
      <p class="result-desc">${esc(desc)}</p>
    `;
    resultEl.hidden  = false;
    rollBtn.disabled = false;

    /* Reveal catch section for complete or inaccurate (someone may still catch a scatter) */
    if (outcome !== 'fumble' && catchSection) {
      const introEl = document.getElementById('pass-catch-intro');
      if (introEl) {
        introEl.textContent = outcome === 'complete'
          ? 'The ball is on target. A catcher in the square attempts to catch it.'
          : 'The ball has scattered. If it lands on a player, they may attempt to catch it.';
      }
      const catchD1 = document.getElementById('catch-d1');
      if (catchD1) Dice.setDieValue(catchD1, 1);
      const catchRes = document.getElementById('catch-result');
      if (catchRes) catchRes.hidden = true;
      catchSection.hidden = false;
    }
  });

  /* ── Catch roll ── */
  const catchRollBtn = document.getElementById('catch-roll-btn');
  const catchD1El    = document.getElementById('catch-d1');
  const catchResEl   = document.getElementById('catch-result');

  catchRollBtn?.addEventListener('click', async () => {
    catchRollBtn.disabled = true;
    if (catchResEl) catchResEl.hidden = true;

    const roll     = await Dice.rollDieElement(catchD1El);
    const mod      = (catchMods.tz ? -1 : 0) + (catchMods.weather ? -1 : 0);
    const modified = roll + mod;

    let title, cls, desc;
    if (roll === 1) {
      title = 'Dropped!'; cls = 'result-cas';
      desc  = 'Natural 1 — always a failure. The ball hits the ground and scatters 1 square. Turnover!';
    } else if (modified >= catchAG) {
      title = 'Caught!'; cls = 'result-ok';
      desc  = `Roll ${roll}${mod !== 0 ? ` (modified to ${modified})` : ''} vs ${catchAG}+ — the ball is caught!`;
    } else {
      title = 'Dropped!'; cls = 'result-ko';
      desc  = `Roll ${roll}${mod !== 0 ? ` (modified to ${modified})` : ''} vs ${catchAG}+ — the ball slips away and scatters 1 square.`;
    }

    if (catchResEl) {
      catchResEl.innerHTML = `
        <div class="result-roll-num">${roll}${mod !== 0 ? `<span style="font-size:1rem;font-weight:600;"> (${mod > 0 ? '+' : ''}${mod})</span>` : ''}</div>
        <div class="result-name ${cls}">${esc(title)}</div>
        <p class="result-desc">${esc(desc)}</p>
      `;
      catchResEl.hidden = false;
    }
    catchRollBtn.disabled = false;
  });
}

/* ════════════════════════════════════════════════════════
   FOUL WIZARD
   Full sequence: armour roll (2D6 + assists) → ref check on doubles
                → injury roll (auto) → casualty D16 if needed
   ════════════════════════════════════════════════════════ */

function initFoulWizard() {
  const rollBtn = document.getElementById('foul-roll-btn');
  if (!rollBtn) return;

  let selectedAV = 8;
  let assists    = 0;
  const mods     = { 'dirty-player': false, stunty: false };

  /* AV picker */
  function setFoulAV(av) {
    const clamped = Math.max(5, Math.min(10, av));
    /* Find the closest matching button */
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
  }

  document.getElementById('foul-av-picker')?.addEventListener('click', e => {
    const btn = e.target.closest('.av-btn');
    if (!btn) return;
    document.querySelectorAll('#foul-av-picker .av-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedAV = parseInt(btn.dataset.av, 10);
  });

  /* Player selection lists */
  initFoulPlayerSelect(setFoulAV);

  /* Assists stepper */
  bindStepper(document.getElementById('foul-assists'), 0, 11, v => { assists = v; });

  /* Modifier toggles */
  document.getElementById('foul-mod-dp')?.addEventListener('click', e => {
    mods['dirty-player'] = !mods['dirty-player'];
    e.currentTarget.classList.toggle('active', mods['dirty-player']);
  });
  document.getElementById('foul-mod-stunty')?.addEventListener('click', e => {
    mods.stunty = !mods.stunty;
    e.currentTarget.classList.toggle('active', mods.stunty);
  });

  /* Element refs */
  const d1El       = document.getElementById('foul-d1');
  const d2El       = document.getElementById('foul-d2');
  const avResEl    = document.getElementById('foul-av-result');
  const refResEl   = document.getElementById('foul-ref-result');
  const injSection = document.getElementById('foul-injury-section');

  rollBtn.addEventListener('click', async () => {
    rollBtn.disabled = true;
    avResEl.hidden   = true;
    if (refResEl)   refResEl.hidden   = true;
    if (injSection) injSection.hidden = true;

    const dpMod  = mods['dirty-player'] ? 1 : 0;
    const bonus  = assists + dpMod;

    /* ── Armour roll ── */
    const { d1, d2, total } = await Dice.roll2D6(d1El, d2El);
    const modded     = total + bonus;
    const isDoubles  = d1 === d2;

    const bonusNote  = bonus > 0 ? ` + ${bonus} (assists${dpMod ? ' + Dirty Player' : ''})` : '';
    const doubleFlag = isDoubles ? `<div class="result-effect">⚠️ Natural Double — referee may have spotted it!</div>` : '';

    if (modded < selectedAV) {
      /* Armour holds */
      avResEl.innerHTML = `
        <div class="result-roll-num">${total}${bonus ? ` (+${bonus})` : ''}</div>
        <div class="result-roll-breakdown">${d1} + ${d2}${bonusNote} vs AV${selectedAV}+</div>
        ${doubleFlag}
        <div class="result-name" style="color:var(--bb-gold,#D4AF37);">Armour Holds</div>
        <p class="result-desc">Total ${modded} is below AV ${selectedAV}+. No injury from the foul.</p>
      `;
      avResEl.hidden = false;
    } else {
      /* Armour broken — show interim then auto-roll injury */
      avResEl.innerHTML = `
        <div class="result-roll-num">${total}${bonus ? ` (+${bonus})` : ''}</div>
        <div class="result-roll-breakdown">${d1} + ${d2}${bonusNote} vs AV${selectedAV}+</div>
        ${doubleFlag}
        <div class="result-name" style="color:var(--bb-red,#C8102E);">Armour Broken!</div>
        <p class="result-desc">Rolling Injury table…</p>
      `;
      avResEl.hidden = false;

      await pause(450);

      /* ── Injury roll ── */
      const injD1 = document.getElementById('foul-inj-d1');
      const injD2 = document.getElementById('foul-inj-d2');
      if (injSection) injSection.hidden = false;

      const { d1: i1, d2: i2, total: injTotal } = await Dice.roll2D6(injD1, injD2);
      const injModded = Math.min(12, injTotal + bonus);

      const injTable = mods.stunty ? window.BBData?.injury?.stunty : window.BBData?.injury?.injury;
      const inj = rangeFind(injTable, injModded)
               ?? { result: 'Unknown', 'class': '', desc: 'No entry.' };

      const injResEl = document.getElementById('foul-inj-result');
      if (injResEl) {
        injResEl.innerHTML = `
          <div class="result-roll-num">${injTotal}${bonus ? ` (+${bonus})` : ''}</div>
          <div class="result-roll-breakdown">${i1} + ${i2} — Injury table${mods.stunty ? ' (Stunty)' : ''}</div>
          <div class="result-name ${inj['class']}">${esc(inj.result)}</div>
          <p class="result-desc">${esc(inj.desc)}</p>
        `;
        injResEl.hidden = false;
      }

      /* ── Casualty roll ── */
      if (inj.result === 'Casualty!') {
        await pause(500);
        const casTray = document.getElementById('foul-cas-tray');
        const casD1   = document.getElementById('foul-cas-d1');
        const casResEl = document.getElementById('foul-cas-result');
        if (casTray) casTray.hidden = false;
        if (casResEl) {
          casResEl.innerHTML = `<p class="result-desc" style="margin:0">Rolling Casualty table (D16)…</p>`;
          casResEl.hidden = false;
        }
        await pause(300);
        const casVal = await Dice.rollDieElement(casD1);
        const cas = rangeFind(window.BBData?.injury?.casualty, casVal)
                 ?? { result: 'Unknown', 'class': '', desc: 'No entry.' };
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

    /* ── Referee spotted — show Argue the Call rules ── */
    if (isDoubles && refResEl) {
      await pause(300);
      refResEl.innerHTML = `
        <div class="result-name" style="color:#FF8C00;">⚠️ Referee Spots the Foul!</div>
        <p class="result-desc">
          A natural double was rolled on the Armour check — the fouling player is Sent Off!
          The coach may <strong>Argue the Call</strong>: roll a D6 —
          on a <strong>6</strong> the player stays;
          on a <strong>1</strong> the Head Coach is also ejected for the rest of the game;
          on 2–5 the call stands, player is sent off.
          A <em>Bribe</em> may be used to avoid the ejection entirely (roll D6: 2+ succeeds).
        </p>
      `;
      refResEl.hidden = false;
    }

    rollBtn.disabled = false;
  });
}

/* ════════════════════════════════════════════════════════
   THROW TEAM-MATE WIZARD
   Sequence: [Always Hungry] → Throw roll → Landing roll (4+)
   ════════════════════════════════════════════════════════ */

function initThrowWizard() {
  const throwBtn = document.getElementById('throw-roll-btn');
  if (!throwBtn) return;

  let throwTarget = 4;   /* 4+ for Short, 5+ for Long */
  const traits    = { 'always-hungry': false, 'hail-mary': false };
  const landMods  = { tz: false, landing: false };

  /* Range picker */
  document.querySelectorAll('#throw-range-picker .av-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#throw-range-picker .av-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      throwTarget = parseInt(btn.dataset.target, 10);
    });
  });

  /* Always Hungry toggle — shows/hides the sub-step */
  document.getElementById('throw-mod-hungry')?.addEventListener('click', e => {
    traits['always-hungry'] = !traits['always-hungry'];
    e.currentTarget.classList.toggle('active', traits['always-hungry']);
    const sec = document.getElementById('throw-hungry-section');
    if (sec) sec.hidden = !traits['always-hungry'];
    /* Reset hungry result when toggled off */
    if (!traits['always-hungry']) {
      const hr = document.getElementById('throw-hungry-result');
      if (hr) hr.hidden = true;
    }
  });

  /* Hail Mary toggle */
  document.getElementById('throw-mod-hailmary')?.addEventListener('click', e => {
    traits['hail-mary'] = !traits['hail-mary'];
    e.currentTarget.classList.toggle('active', traits['hail-mary']);
  });

  /* ── Always Hungry roll ── */
  const hungryBtn = document.getElementById('throw-hungry-btn');
  const hungryD1  = document.getElementById('throw-hungry-d1');
  const hungryRes = document.getElementById('throw-hungry-result');

  hungryBtn?.addEventListener('click', async () => {
    hungryBtn.disabled = true;
    if (hungryRes) hungryRes.hidden = true;

    const roll = await Dice.rollDieElement(hungryD1);

    if (hungryRes) {
      if (roll === 1) {
        hungryRes.innerHTML = `
          <div class="result-roll-num">${roll}</div>
          <div class="result-name result-cas">Teammate Eaten! 🍖</div>
          <p class="result-desc">Rolled a 1 — the thrower can't resist! The team-mate is consumed. They are removed from the pitch as a Casualty (Badly Hurt result, no Casualty roll needed). The throw action ends immediately.</p>
        `;
      } else {
        hungryRes.innerHTML = `
          <div class="result-roll-num">${roll}</div>
          <div class="result-name result-ok">Resisted! (${roll}, need 2+)</div>
          <p class="result-desc">The thrower held back — proceed with the throw below.</p>
        `;
      }
      hungryRes.hidden = false;
    }
    hungryBtn.disabled = false;
  });

  /* ── Landing modifiers ── */
  document.getElementById('throw-land-tz')?.addEventListener('click', e => {
    landMods.tz = !landMods.tz;
    e.currentTarget.classList.toggle('active', landMods.tz);
  });
  document.getElementById('throw-land-skill')?.addEventListener('click', e => {
    landMods.landing = !landMods.landing;
    e.currentTarget.classList.toggle('active', landMods.landing);
  });

  /* ── Main throw roll ── */
  const throwD1      = document.getElementById('throw-d1');
  const throwResEl   = document.getElementById('throw-result');
  const landSection  = document.getElementById('throw-landing-section');

  throwBtn.addEventListener('click', async () => {
    throwBtn.disabled = true;
    throwResEl.hidden = true;
    if (landSection) landSection.hidden = true;

    const roll = await Dice.rollDieElement(throwD1);

    let title, cls, desc, showLanding = false, landIntro = '';

    if (traits['hail-mary']) {
      /* Hail Mary — any range, always inaccurate; fumble on 1 */
      if (roll === 1) {
        title = 'Fumble!'; cls = 'result-cas';
        desc  = "Natural 1 — Hail Mary fails! The team-mate is placed in the thrower's square. Action ends.";
      } else {
        title = 'Hail Mary — Inaccurate'; cls = 'result-ko';
        desc  = `Roll ${roll}. Hail Mary passes always scatter — the thrown player scatters D6 squares from the intended landing square. They must still make a Landing roll wherever they land.`;
        showLanding = true;
        landIntro = 'The team-mate has scattered and must make a Landing roll in whatever square they landed.';
      }
    } else if (roll === 1) {
      title = 'Fumble!'; cls = 'result-cas';
      desc  = "Natural 1 — the throw fails! The team-mate is placed in the thrower's square. Action ends immediately.";
    } else if (roll >= throwTarget) {
      title = 'Accurate Throw!'; cls = 'result-ok';
      desc  = `Roll ${roll} vs ${throwTarget}+ — the team-mate lands on target. Make a Landing roll now.`;
      showLanding = true;
      landIntro = 'The team-mate lands in the target square — they must pass a Landing roll (D6, need 4+).';
    } else {
      title = 'Inaccurate Throw'; cls = 'result-ko';
      desc  = `Roll ${roll} vs ${throwTarget}+ — the team-mate scatters 3 times from the intended square. Make a Landing roll wherever they end up.`;
      showLanding = true;
      landIntro = 'After scattering, the team-mate must make a Landing roll (D6, need 4+) in their final square.';
    }

    throwResEl.innerHTML = `
      <div class="result-roll-num">${roll}</div>
      <div class="result-name ${cls}">${esc(title)}</div>
      <p class="result-desc">${esc(desc)}</p>
    `;
    throwResEl.hidden  = false;
    throwBtn.disabled  = false;

    if (showLanding && landSection) {
      const introEl = document.getElementById('throw-landing-intro');
      if (introEl) introEl.textContent = landIntro;
      const landD1 = document.getElementById('throw-land-d1');
      if (landD1) Dice.setDieValue(landD1, 1);
      const landRes = document.getElementById('throw-land-result');
      if (landRes) landRes.hidden = true;
      landSection.hidden = false;
    }
  });

  /* ── Landing roll ── */
  const landBtn   = document.getElementById('throw-land-btn');
  const landD1El  = document.getElementById('throw-land-d1');
  const landResEl = document.getElementById('throw-land-result');

  landBtn?.addEventListener('click', async () => {
    landBtn.disabled = true;
    if (landResEl) landResEl.hidden = true;

    const roll     = await Dice.rollDieElement(landD1El);
    const mod      = (landMods.tz ? -1 : 0) + (landMods.landing ? 1 : 0);
    const modified = roll + mod;

    let title, cls, desc;
    if (modified >= 4) {
      title = 'Safe Landing!'; cls = 'result-ok';
      desc  = `Roll ${roll}${mod !== 0 ? ` (modified to ${modified})` : ''} vs 4+. The team-mate sticks the landing and may act normally this turn (if they haven't already been activated).`;
    } else if (roll === 1) {
      title = 'Crash Landing!'; cls = 'result-cas';
      desc  = 'Natural 1 — always fails. The player is knocked down in their landing square. Roll Armour using the Injury panel.';
    } else {
      title = 'Crash Landing!'; cls = 'result-cas';
      desc  = `Roll ${roll}${mod !== 0 ? ` (modified to ${modified})` : ''} vs 4+ — the team-mate crashes down! They are knocked down in their landing square. Roll Armour using the Injury panel.`;
    }

    if (landResEl) {
      landResEl.innerHTML = `
        <div class="result-roll-num">${roll}${mod !== 0 ? `<span style="font-size:1rem;font-weight:600;"> (${mod > 0 ? '+' : ''}${mod})</span>` : ''}</div>
        <div class="result-name ${cls}">${esc(title)}</div>
        <p class="result-desc">${esc(desc)}</p>
      `;
      landResEl.hidden = false;
    }
    landBtn.disabled = false;
  });
}

/* ════════════════════════════════════════════════════════
   PLAYER SELECTION PANELS (shared utility)
   Used by Block and Foul wizards to show roster lists.
   ════════════════════════════════════════════════════════ */

/**
 * Populate a wizard player list container.
 * @param {string}   listId    – ID of the .wps-list container
 * @param {string}   side      – 'left' | 'right'
 * @param {Function} filterFn  – receives a player object, returns bool
 * @param {Function} onSelect  – called with the player object when clicked
 * @returns {{ getSelected: Function }} — accessor
 */
function buildWizardPlayerList(listId, side, filterFn, onSelect) {
  const container = document.getElementById(listId);
  if (!container) return { getSelected: () => null };

  const allPlayers = window.getPlayerList?.(side) ?? [];
  const players    = allPlayers.filter(filterFn);

  container.innerHTML = '';

  if (allPlayers.length === 0) {
    container.innerHTML = '<p class="wps-empty">No roster loaded</p>';
    return { getSelected: () => null };
  }

  if (players.length === 0) {
    container.innerHTML = '<p class="wps-empty">No eligible players</p>';
    return { getSelected: () => null };
  }

  let selectedIdx = null;

  players.forEach(p => {
    const btn = document.createElement('button');
    btn.type  = 'button';
    btn.className = 'wps-player-btn';

    /* Extract stat hint from card stats text if possible */
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
      ${p.pos   ? `<span class="wps-pos">${esc(p.pos)}</span>` : ''}
      ${statHint ? `<span class="wps-stat-badge">${statHint}</span>` : ''}
      ${statusHtml}
    `;

    btn.addEventListener('click', () => {
      container.querySelectorAll('.wps-player-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedIdx = p.idx;
      onSelect?.(p, { st: stVal ? parseInt(stVal, 10) : null, av: avVal ? parseInt(avVal, 10) : null });
    });

    container.appendChild(btn);
  });

  return {
    getSelected: () => players.find(p => p.idx === selectedIdx) ?? null,
    clearSelection: () => {
      selectedIdx = null;
      container.querySelectorAll('.wps-player-btn').forEach(b => b.classList.remove('selected'));
    },
  };
}

/** Watch for a panel to open (hidden attribute removed) and call fn each time. */
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
   BLOCK WIZARD — player involvement extension
   ════════════════════════════════════════════════════════ */

function initBlockPlayerSelect(attStStepper, defStStepper) {
  const PS = window.PlayerStatus;

  function refreshBlockLists() {
    buildWizardPlayerList(
      'block-attacker-list',
      'left',
      p => p.status === PS?.AVAILABLE || p.status === PS?.PRONE || p.status === PS?.STUNNED,
      (p, stats) => {
        if (stats.st && attStStepper) attStStepper.set(stats.st);
      }
    );

    buildWizardPlayerList(
      'block-defender-list',
      'right',
      p => true,   /* any opposition player can be blocked */
      (p, stats) => {
        if (stats.st && defStStepper) defStStepper.set(stats.st);
      }
    );
  }

  onPanelOpen('panel-block', refreshBlockLists);
}

/* ════════════════════════════════════════════════════════
   FOUL WIZARD — player involvement extension
   ════════════════════════════════════════════════════════ */

function initFoulPlayerSelect(avPickerUpdate) {
  const PS = window.PlayerStatus;

  function refreshFoulLists() {
    /* Foulers: home team available players */
    buildWizardPlayerList(
      'foul-fouler-list',
      'left',
      p => !window.STATUS_META?.[p.status]?.dim,
      (_p, _stats) => { /* fouler selected — no auto-stat in foul */ }
    );

    /* Targets: away team prone or stunned (legal foul targets) */
    buildWizardPlayerList(
      'foul-target-list',
      'right',
      p => p.status === PS?.PRONE || p.status === PS?.STUNNED,
      (p, stats) => {
        /* Auto-set the AV picker if we could parse AV */
        if (stats.av && avPickerUpdate) avPickerUpdate(stats.av);
      }
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
