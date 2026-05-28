'use strict';

/* ═══════════════════════════════════════════════════════
   Blood Bowl Companion — js/panels.js

   Responsibilities
   ────────────────
   • Module button grid → panel open / close / toggle
   • Sub-tab switching within panels
   • Roster accordion expand / collapse
   • Game bar: score, turn, re-roll tracking
   • Automation modules: kickoff, weather, prayers,
     scatter (deviation / bounce / throw-in), injury
   ═══════════════════════════════════════════════════════ */

/* ────────────────────────────────────────────────────────
   JSON DATA  — populated by loadModuleData() on startup
   ──────────────────────────────────────────────────────── */

const DATA = {};   /* { kickoff[], weather[], prayers[], injury{} } */
window.BBData = DATA;   /* exposed for wizards.js cross-module access */

async function loadModuleData() {
  const sources = {
    kickoff: 'data/kickoff-events.json',
    weather: 'data/weather.json',
    prayers: 'data/prayers.json',
    injury:  'data/injury.json',
  };

  await Promise.all(
    Object.entries(sources).map(async ([key, path]) => {
      try {
        const res = await fetch(path);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        DATA[key] = await res.json();
      } catch (err) {
        console.warn(`[BB Companion] Could not load ${path}:`, err);
      }
    })
  );
}

/* ── Lookup helpers ── */

/* Exact roll match — for kickoff-events.json and prayers.json (each entry has a `roll` field) */
function exactLookup(table, roll) {
  return (table ?? []).find(e => e.roll === roll) ?? null;
}

/* Range match — for weather.json (rollMin/rollMax) and injury tables (min/max) */
function rangeLookup(table, roll, minKey = 'min', maxKey = 'max') {
  return (table ?? []).find(e => roll >= e[minKey] && roll <= e[maxKey]) ?? null;
}

/* ────────────────────────────────────────────────────────
   DIRECTION LABELS  (D8 throw-in template)
   ──────────────────────────────────────────────────────── */

const DIRECTION_LABELS = {
  1: '↖ Up-Left',   2: '↑ Up',    3: '↗ Up-Right',
  4: '← Left',                    5: '→ Right',
  6: '↙ Down-Left', 7: '↓ Down',  8: '↘ Down-Right',
};

/* ────────────────────────────────────────────────────────
   GAME BAR STATE
   ──────────────────────────────────────────────────────── */
const gbState = {
  half:          1,
  currentTurn:   0,
  scores:        { home: 0, away: 0 },
  rerolls:       { home: 0, away: 0 },
  rerollsTotal:  { home: 0, away: 0 },
};

/* ════════════════════════════════════════════════════════
   PANEL OPEN / CLOSE / TOGGLE
   ════════════════════════════════════════════════════════ */

function getModuleBtn(panelId) {
  return document.querySelector(`.module-btn[data-panel="${panelId}"]`);
}

function openPanel(id) {
  const panel = document.getElementById(`panel-${id}`);
  if (!panel) return;
  panel.classList.remove('panel-closing');
  panel.removeAttribute('hidden');
  const btn = getModuleBtn(id);
  if (btn) btn.setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => {
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

function closePanel(id) {
  const panel = document.getElementById(`panel-${id}`);
  if (!panel || panel.hasAttribute('hidden')) return;

  panel.classList.add('panel-closing');
  panel.addEventListener('animationend', () => {
    /* Guard: if openPanel() removed 'panel-closing' mid-animation, abort */
    if (!panel.classList.contains('panel-closing')) return;
    panel.classList.remove('panel-closing');
    panel.setAttribute('hidden', '');
  }, { once: true });

  const btn = getModuleBtn(id);
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

function togglePanel(id) {
  const panel = document.getElementById(`panel-${id}`);
  if (!panel) return;
  panel.hasAttribute('hidden') ? openPanel(id) : closePanel(id);
}

function initPanels() {
  /* Module buttons */
  document.querySelectorAll('.module-btn').forEach(btn => {
    btn.addEventListener('click', () => togglePanel(btn.dataset.panel));
  });

  /* Panel close buttons */
  document.querySelectorAll('.panel-close').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = btn.closest('.bb-panel');
      if (panel) closePanel(panel.id.replace('panel-', ''));
    });
  });

  /* Escape: close last open panel */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = [...document.querySelectorAll('.bb-panel:not([hidden])')];
    if (open.length) closePanel(open[open.length - 1].id.replace('panel-', ''));
  });
}

/* ════════════════════════════════════════════════════════
   SUB-TABS
   ════════════════════════════════════════════════════════ */

function initSubTabs() {
  document.querySelectorAll('.sub-tabs').forEach(tabGroup => {
    tabGroup.querySelectorAll('.sub-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const targetId = `tab-${tab.dataset.tab}`;
        const body     = tab.closest('.panel-body');

        tabGroup.querySelectorAll('.sub-tab').forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');

        body.querySelectorAll('.sub-tab-panel').forEach(p => {
          p.classList.remove('active');
          p.hidden = true;
        });
        const target = document.getElementById(targetId);
        if (target) { target.classList.add('active'); target.hidden = false; }
      });
    });
  });
}

/* ════════════════════════════════════════════════════════
   ROSTER ACCORDIONS
   ════════════════════════════════════════════════════════ */

function initAccordions() {
  document.querySelectorAll('.accordion-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const bodyId = toggle.getAttribute('aria-controls');
      const body   = document.getElementById(bodyId);
      const isOpen = toggle.getAttribute('aria-expanded') === 'true';

      toggle.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
      body.classList.toggle('is-open', !isOpen);
    });
  });
}

/* Called by script.js after a team loads */
function openAccordion(side) {
  const toggle = document.getElementById(`accord-${side}`);
  const body   = document.getElementById(`accord-${side}-body`);
  if (!toggle || !body) return;
  toggle.setAttribute('aria-expanded', 'true');
  body.classList.add('is-open');
}

function setAccordionLabel(side, name) {
  const el = document.getElementById(`accord-${side}-label`);
  if (el) el.textContent = name || (side === 'left' ? 'Home Roster' : 'Away Roster');
}

/* ════════════════════════════════════════════════════════
   GAME BAR
   ════════════════════════════════════════════════════════ */

function initGameBar() {
  ['home', 'away'].forEach(side => {
    document.getElementById(`gb-${side}-plus`)
      ?.addEventListener('click', () => adjustScore(side, +1));
    document.getElementById(`gb-${side}-minus`)
      ?.addEventListener('click', () => adjustScore(side, -1));
  });

  document.getElementById('gb-next-turn')
    ?.addEventListener('click', () => advanceTurn(+1));
  document.getElementById('gb-prev-turn')
    ?.addEventListener('click', () => advanceTurn(-1));

  buildTurnPips();
  renderTurn();
}

function adjustScore(side, delta) {
  gbState.scores[side] = Math.max(0, gbState.scores[side] + delta);
  const el = document.getElementById(`gb-${side}-score`);
  if (el) el.textContent = gbState.scores[side];
}

function advanceTurn(delta) {
  gbState.currentTurn = Math.min(8, Math.max(0, gbState.currentTurn + delta));
  renderTurn();
}

function buildTurnPips() {
  const container = document.getElementById('gb-turn-pips');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 1; i <= 8; i++) {
    const pip = document.createElement('span');
    pip.className    = 'turn-pip';
    pip.dataset.turn = i;
    pip.title        = `Turn ${i}`;
    pip.addEventListener('click', () => { gbState.currentTurn = i; renderTurn(); });
    container.appendChild(pip);
  }
}

function renderTurn() {
  document.querySelectorAll('.turn-pip').forEach((pip, i) => {
    const turn = i + 1;
    pip.classList.toggle('done',    turn <  gbState.currentTurn);
    pip.classList.toggle('current', turn === gbState.currentTurn);
  });
  const label = document.getElementById('gb-turn-label');
  if (label) {
    label.textContent = gbState.currentTurn === 0
      ? 'PRE-GAME'
      : `TURN ${gbState.currentTurn}`;
  }
}

/* Called from script.js after team load */
function setRerolls(side, count) {
  gbState.rerollsTotal[side] = count;
  gbState.rerolls[side]      = count;
  renderRerollPips(side);
}

function renderRerollPips(side) {
  const container = document.getElementById(`gb-${side}-rr-pips`);
  if (!container) return;
  container.innerHTML = '';
  const total = gbState.rerollsTotal[side];
  const used  = total - gbState.rerolls[side];

  for (let i = 0; i < total; i++) {
    const isUsed = i < used;
    const pip    = document.createElement('span');
    pip.className = `rr-pip${isUsed ? ' used' : ''}`;
    pip.title     = isUsed ? 'Re-roll used (click to restore)' : 'Re-roll available (click to use)';
    pip.setAttribute('role', 'button');
    pip.setAttribute('tabindex', '0');
    pip.addEventListener('click', () => {
      gbState.rerolls[side] = isUsed
        ? Math.min(total, gbState.rerolls[side] + 1)
        : Math.max(0,     gbState.rerolls[side] - 1);
      renderRerollPips(side);
    });
    container.appendChild(pip);
  }
}

/* ════════════════════════════════════════════════════════
   MODULE: KICKOFF EVENT
   ════════════════════════════════════════════════════════ */

function initKickoffModule() {
  const rollBtn  = document.getElementById('kickoff-roll-btn');
  const resultEl = document.getElementById('kickoff-result');
  const d1El     = document.getElementById('kickoff-d1');
  const d2El     = document.getElementById('kickoff-d2');
  if (!rollBtn) return;

  rollBtn.addEventListener('click', async () => {
    rollBtn.disabled = true;
    resultEl.hidden  = true;

    const { d1, d2, total } = await Dice.roll2D6(d1El, d2El);
    const ev = exactLookup(DATA.kickoff, total)
            ?? { name: 'Unknown Event', desc: 'No entry for this roll.' };

    resultEl.innerHTML = `
      <div class="result-roll-num">${total}</div>
      <div class="result-roll-breakdown">${d1} + ${d2}</div>
      <div class="result-name">${h(ev.name)}</div>
      <p class="result-desc">${h(ev.desc)}</p>
    `;
    resultEl.hidden  = false;
    rollBtn.disabled = false;
  });
}

/* ════════════════════════════════════════════════════════
   MODULE: WEATHER
   ════════════════════════════════════════════════════════ */

function initWeatherModule() {
  const rollBtn  = document.getElementById('weather-roll-btn');
  const resultEl = document.getElementById('weather-result');
  const d1El     = document.getElementById('weather-d1');
  const d2El     = document.getElementById('weather-d2');
  if (!rollBtn) return;

  rollBtn.addEventListener('click', async () => {
    rollBtn.disabled = true;
    resultEl.hidden  = true;

    const { d1, d2, total } = await Dice.roll2D6(d1El, d2El);
    const w = rangeLookup(DATA.weather, total, 'rollMin', 'rollMax')
           ?? { name: 'Unknown', emoji: '?', effect: '', desc: '' };

    const effectHtml = (w.effect && w.effect !== 'No effect')
      ? `<div class="result-effect">${h(w.effect)}</div>`
      : '';

    resultEl.innerHTML = `
      <div class="result-roll-num">${total}</div>
      <div class="result-roll-breakdown">${d1} + ${d2}</div>
      <div class="result-name">${w.emoji} ${h(w.name)}</div>
      ${effectHtml}
      <p class="result-desc">${h(w.desc)}</p>
    `;
    resultEl.hidden  = false;
    rollBtn.disabled = false;
  });
}

/* ════════════════════════════════════════════════════════
   MODULE: PRAYERS TO NUFFLE  (D16)
   ════════════════════════════════════════════════════════ */

function initPrayersModule() {
  const rollBtn  = document.getElementById('prayers-roll-btn');
  const resultEl = document.getElementById('prayers-result');
  const d1El     = document.getElementById('prayers-d1');  /* data-sides="16" in HTML */
  if (!rollBtn) return;

  rollBtn.addEventListener('click', async () => {
    rollBtn.disabled = true;
    resultEl.hidden  = true;

    /* rollDieElement reads data-sides="16" → rolls 1–16 */
    const val    = await Dice.rollDieElement(d1El);
    const prayer = exactLookup(DATA.prayers, val)
                ?? { name: 'Unknown Blessing', desc: '' };

    resultEl.innerHTML = `
      <div class="result-roll-num">${val}</div>
      <div class="result-name">✦ ${h(prayer.name)}</div>
      <p class="result-desc">${h(prayer.desc)}</p>
    `;
    resultEl.hidden  = false;
    rollBtn.disabled = false;
  });
}

/* ════════════════════════════════════════════════════════
   MODULE: BALL SCATTER / BOUNCE / THROW-IN
   ════════════════════════════════════════════════════════ */

function initScatterModule() {
  bindScatterRoll('deviation',
    ['deviation-d6', 'deviation-d8'],
    'deviation-result',
    ({ vals }) => {
      const [dist, dir] = vals;
      return `<div class="result-name">Deviates ${dist} square${dist !== 1 ? 's' : ''}</div>
              <div class="result-direction">${DIRECTION_LABELS[dir] ?? dir}</div>`;
    });

  bindScatterRoll('bounce',
    ['bounce-d8'],
    'bounce-result',
    ({ vals }) => {
      const [dir] = vals;
      highlightCompass('bounce-compass', dir);
      return `<div class="result-name">Ball bounces 1 square</div>
              <div class="result-direction">${DIRECTION_LABELS[dir] ?? dir}</div>`;
    });

  bindScatterRoll('throwin',
    ['throwin-d6', 'throwin-d8'],
    'throwin-result',
    ({ vals }) => {
      const [dist, dir] = vals;
      return `<div class="result-name">Thrown in ${dist} square${dist !== 1 ? 's' : ''}</div>
              <div class="result-direction">${DIRECTION_LABELS[dir] ?? dir}</div>`;
    });
}

function bindScatterRoll(prefix, dieIds, resultId, buildHtml) {
  const btn      = document.getElementById(`${prefix}-roll-btn`);
  const resultEl = document.getElementById(resultId);
  if (!btn) return;

  btn.addEventListener('click', async () => {
    btn.disabled      = true;
    resultEl.hidden   = true;

    const dies = dieIds.map(id => document.getElementById(id));
    const vals = await Promise.all(dies.map(d => Dice.rollDieElement(d)));

    resultEl.innerHTML = buildHtml({ vals });
    resultEl.hidden  = false;
    btn.disabled     = false;
  });
}

function highlightCompass(compassId, activeDir) {
  document.querySelectorAll(`#${compassId} .compass-dir`).forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.dir, 10) === activeDir);
  });
}

/* ════════════════════════════════════════════════════════
   MODULE: ARMOUR & INJURY  (3-step: AV → Injury → Casualty)
   ════════════════════════════════════════════════════════ */

function initInjuryModule() {
  let selectedAV = 8;
  const mods     = { 'mighty-blow': false, 'dirty-player': false, stunty: false };

  /* AV picker */
  document.getElementById('injury-av-picker')
    ?.addEventListener('click', e => {
      const btn = e.target.closest('.av-btn');
      if (!btn) return;
      document.querySelectorAll('.av-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedAV = parseInt(btn.dataset.av, 10);
    });

  /* Modifier toggles */
  document.querySelectorAll('.mod-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.mod;
      mods[key] = !mods[key];
      btn.classList.toggle('active', mods[key]);
    });
  });

  const rollBtn     = document.getElementById('injury-roll-btn');
  const resultEl    = document.getElementById('injury-result');
  const casResultEl = document.getElementById('casualty-result');
  const casTrayEl   = document.getElementById('casualty-dice-tray');
  const d1El        = document.getElementById('injury-d1');
  const d2El        = document.getElementById('injury-d2');
  const casDieEl    = document.getElementById('injury-cas-d1');  /* data-sides="16" */
  if (!rollBtn) return;

  rollBtn.addEventListener('click', async () => {
    rollBtn.disabled = true;
    resultEl.hidden  = true;
    if (casResultEl) casResultEl.hidden = true;
    if (casTrayEl)   casTrayEl.hidden   = true;

    /* ── Step 1: Armour roll (2D6) ── */
    const { d1, d2, total: avTotal } = await Dice.roll2D6(d1El, d2El);
    const avMod    = (mods['mighty-blow'] ? 1 : 0) + (mods['dirty-player'] ? 1 : 0);
    const avModded = avTotal + avMod;
    const modNote  = avMod ? ` (+${avMod})` : '';

    if (avModded < selectedAV) {
      /* Armour holds — no injury */
      resultEl.innerHTML = `
        <div class="result-roll-num">${avTotal}${modNote}</div>
        <div class="result-roll-breakdown">${d1} + ${d2}${avMod ? ` + ${avMod} modifier` : ''} vs AV${selectedAV}+</div>
        <div class="result-name" style="color:var(--bb-gold,#D4AF37);">Armour Holds</div>
        <p class="result-desc">Total ${avModded} is below AV ${selectedAV}+. No injury.</p>
      `;
      resultEl.hidden  = false;
      rollBtn.disabled = false;
      return;
    }

    /* ── Step 2: Armour broken — show interim, then roll injury ── */
    resultEl.innerHTML = `
      <div class="result-roll-num">${avTotal}${modNote}</div>
      <div class="result-roll-breakdown">${d1} + ${d2}${avMod ? ` + ${avMod} mod` : ''} vs AV${selectedAV}+</div>
      <div class="result-name" style="color:var(--bb-red,#C8102E);">Armour Broken!</div>
      <p class="result-desc">Rolling on the Injury table…</p>
    `;
    resultEl.hidden = false;

    await delay(450);

    const { d1: i1, d2: i2, total: injTotal } = await Dice.roll2D6(d1El, d2El);
    const injMod    = avMod;   /* Mighty Blow / Dirty Player apply to either Armour OR Injury — player chooses; here we apply to injury */
    const injModded = Math.min(12, injTotal + injMod);

    const injTable = mods.stunty ? DATA.injury?.stunty : DATA.injury?.injury;
    const inj      = rangeLookup(injTable, injModded)
                  ?? { result: 'Unknown', 'class': '', desc: 'No entry for this roll.' };

    resultEl.innerHTML = `
      <div class="result-roll-num">${injTotal}${injMod ? ` (+${injMod})` : ''}</div>
      <div class="result-roll-breakdown">${i1} + ${i2} — Injury table${injMod ? ` +${injMod}` : ''}${mods.stunty ? ' (Stunty)' : ''}</div>
      <div class="result-name ${inj['class']}">${h(inj.result)}</div>
      <p class="result-desc">${h(inj.desc)}</p>
    `;

    /* ── Step 3: Casualty roll (D16) — only for a Casualty! result ── */
    if (inj.result === 'Casualty!' && casResultEl && casDieEl) {
      await delay(500);

      if (casTrayEl) casTrayEl.hidden = false;
      casResultEl.innerHTML = `<p class="result-desc" style="margin:0;">Rolling on the Casualty table (D16)…</p>`;
      casResultEl.hidden = false;

      await delay(300);

      const casVal = await Dice.rollDieElement(casDieEl);
      const cas    = rangeLookup(DATA.injury?.casualty, casVal)
                  ?? { result: 'Unknown', 'class': '', desc: 'No entry for this roll.' };

      casResultEl.innerHTML = `
        <div class="result-roll-num">${casVal}</div>
        <div class="result-roll-breakdown">Casualty Table (D16)</div>
        <div class="result-name ${cas['class']}">${h(cas.result)}</div>
        <p class="result-desc">${h(cas.desc)}</p>
      `;
    }

    rollBtn.disabled = false;
  });
}

/* ════════════════════════════════════════════════════════
   UTILITIES
   ════════════════════════════════════════════════════════ */

function h(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/* ════════════════════════════════════════════════════════
   PUBLIC API
   ════════════════════════════════════════════════════════ */

window.Panels = {
  openPanel,
  closePanel,
  togglePanel,
  openAccordion,
  setAccordionLabel,
  setRerolls,
};

/* ════════════════════════════════════════════════════════
   BOOT — load JSON data, then initialise all modules
   ════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', async () => {
  /* Fetch all JSON data files before wiring up the modules */
  await loadModuleData();

  Dice.initAllDice();
  initPanels();
  initSubTabs();
  initAccordions();
  initGameBar();
  initKickoffModule();
  initWeatherModule();
  initPrayersModule();
  initScatterModule();
  initInjuryModule();
});
