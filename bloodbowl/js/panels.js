'use strict';

/* ═══════════════════════════════════════════════════════
   Blood Bowl Companion — js/panels.js
   ═══════════════════════════════════════════════════════ */

const DATA = {};
window.BBData = DATA;

async function loadModuleData() {
  const sources = {
    kickoff: './data/kickoff-events.json',
    weather: './data/weather.json',
    prayers: './data/prayers.json',
    injury:  './data/injury.json',
    skills:  './data/skills.json',
  };
  const results = await Promise.allSettled(
    Object.entries(sources).map(async ([key, path]) => {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${path}`);
      DATA[key] = await res.json();
      const count = Array.isArray(DATA[key]) ? DATA[key].length : Object.keys(DATA[key]).length;
      console.log(`[BB] Loaded ${key}: ${count} entries`);
    })
  );
  results.forEach(r => {
    if (r.status === 'rejected') console.error('[BB] FAILED to load data:', r.reason);
  });
  console.log('[BB] Data ready. Keys:', Object.keys(DATA));
}

/* ── Skill lookup (Sprint 13) ── */
window.lookupSkill = function(name) {
  const skills = window.BBData?.skills ?? [];
  return skills.find(s => s.name.toLowerCase() === name.toLowerCase()) ?? null;
};

/* ── Lookup helpers ── */

function exactLookup(table, roll) {
  if (!table) { console.error('[BB] exactLookup: table is null'); return null; }
  const r = table.find(e => e.roll === roll) ?? null;
  if (!r) console.error(`[BB] exactLookup: no entry for roll=${roll}`);
  return r;
}

function rangeLookup(table, roll, minKey = 'min', maxKey = 'max') {
  if (!table) { console.error('[BB] rangeLookup: table is null'); return null; }
  const r = table.find(e => roll >= e[minKey] && roll <= e[maxKey]) ?? null;
  if (!r) console.error(`[BB] rangeLookup: no entry roll=${roll} (${minKey}/${maxKey})`);
  return r;
}

/* ── Direction labels ── */

const DIRECTION_LABELS = {
  1: '↖ Up-Left',   2: '↑ Up',    3: '↗ Up-Right',
  4: '← Left',                    5: '→ Right',
  6: '↙ Down-Left', 7: '↓ Down',  8: '↘ Down-Right',
};

/* ── Game bar local state ── */
const gbState = {
  half:        1,
  currentTurn: 0,
  scores:      { home: 0, away: 0 },
};

/* ════════════════════════════════════════════════════════
   DICE MODE TOGGLE
   Injects a ⚄ Digital / 🎲 Physical pill into every
   [data-wizard] panel header. Persists per-wizard.
   ════════════════════════════════════════════════════════ */

function initDiceModeToggles() {
  document.querySelectorAll('.bb-panel[data-wizard]').forEach(panel => {
    const wizKey  = panel.dataset.wizard;
    const header  = panel.querySelector('.panel-header');
    const closeBtn = header?.querySelector('.panel-close');
    if (!header) return;

    const pill = document.createElement('div');
    pill.className = 'dmt-pill';

    ['digital', 'physical'].forEach(mode => {
      const btn = document.createElement('button');
      btn.type      = 'button';
      btn.className = 'dmt-btn';
      btn.dataset.mode = mode;
      btn.textContent  = mode === 'digital' ? '⚄ Digital' : '🎲 Physical';
      if (window.BBSettings.getWizardDiceMode(wizKey) === mode) btn.classList.add('active');

      btn.addEventListener('click', () => {
        pill.querySelectorAll('.dmt-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const s = window.BBSettings.getSettings();
        s.diceModeOverrides[wizKey] = mode;
        window.BBSettings.saveSetting('diceModeOverrides', s.diceModeOverrides);
        panel.dispatchEvent(new CustomEvent('bb:diceMode', { detail: { mode }, bubbles: false }));
      });
      pill.appendChild(btn);
    });

    if (closeBtn) header.insertBefore(pill, closeBtn);
    else header.appendChild(pill);
  });
}

/* ════════════════════════════════════════════════════════
   WEATHER CHIP SYSTEM
   ════════════════════════════════════════════════════════ */

const WEATHER_CHIP_WIZARDS = ['pass', 'foul', 'injury'];

function refreshWeatherChips() {
  const w = window.GameState?.currentWeather ?? null;

  WEATHER_CHIP_WIZARDS.forEach(key => {
    const slot = document.getElementById(`wchip-${key}`);
    if (!slot) return;

    if (!w) { slot.innerHTML = ''; slot.hidden = true; return; }

    const isPerfect = !w.effect || w.effect === 'No effect';
    slot.innerHTML = '';

    const chip = document.createElement('button');
    chip.type      = 'button';
    chip.className = `weather-chip${isPerfect ? ' weather-chip-perfect' : ''}`;
    chip.innerHTML = `${h(w.emoji)} <strong>${h(w.name)}</strong>: ${h(w.effect || 'No effect')} <span class="wchip-expand">ⓘ</span>`;
    slot.hidden = false;

    /* Toggle full description on tap */
    chip.addEventListener('click', () => {
      let desc = slot.querySelector('.weather-chip-desc');
      if (desc) { desc.remove(); return; }
      desc = document.createElement('div');
      desc.className   = 'weather-chip-desc';
      desc.textContent = w.desc;
      slot.appendChild(desc);
    });
    slot.appendChild(chip);
  });

  /* Auto-apply weather modifiers to the pass wizard */
  autoApplyWeatherToPass(w);
}

function autoApplyWeatherToPass(_w) {
  /* Pass wizard (Sprint 3) manages its own modifier state — no static toggles to click. */
}

/* ════════════════════════════════════════════════════════
   PHYSICAL ZONE HELPERS
   ════════════════════════════════════════════════════════ */

/* Creates (or finds) a .physical-zone div inserted right after refEl */
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
  getModuleBtn(id)?.setAttribute('aria-expanded', 'true');
  document.getElementById('panel-backdrop')?.classList.add('active');
}

function closePanel(id) {
  const panel = document.getElementById(`panel-${id}`);
  if (!panel || panel.hasAttribute('hidden')) return;
  panel.classList.add('panel-closing');
  function _finishClose() {
    if (!panel.classList.contains('panel-closing')) return;
    panel.classList.remove('panel-closing');
    panel.setAttribute('hidden', '');
    const anyOpen = document.querySelectorAll('.bb-panel:not([hidden])').length > 0;
    if (!anyOpen) document.getElementById('panel-backdrop')?.classList.remove('active');
  }
  panel.addEventListener('animationend', _finishClose, { once: true });
  setTimeout(_finishClose, 300); // fallback if animationend doesn't fire
  getModuleBtn(id)?.setAttribute('aria-expanded', 'false');
}

function togglePanel(id) {
  const panel = document.getElementById(`panel-${id}`);
  if (!panel) return;
  if (!panel.hasAttribute('hidden')) { closePanel(id); return; }
  document.querySelectorAll('.bb-panel:not([hidden])').forEach(el => {
    closePanel(el.id.replace('panel-', ''));
  });
  openPanel(id);
}

function initPanels() {
  document.querySelectorAll('.module-btn').forEach(btn => {
    btn.addEventListener('click', () => togglePanel(btn.dataset.panel));
  });
  document.querySelectorAll('.panel-close').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = btn.closest('.bb-panel');
      if (panel) closePanel(panel.id.replace('panel-', ''));
    });
  });
  document.getElementById('panel-backdrop')?.addEventListener('click', () => {
    document.querySelectorAll('.bb-panel:not([hidden])').forEach(el => {
      closePanel(el.id.replace('panel-', ''));
    });
  });
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
        body.querySelectorAll('.sub-tab-panel').forEach(p => { p.classList.remove('active'); p.hidden = true; });
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
      const body   = document.getElementById(toggle.getAttribute('aria-controls'));
      const isOpen = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
      body.classList.toggle('is-open', !isOpen);
    });
  });
}

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

function setAccordionValue(side, gold) {
  const el = document.getElementById(`accord-${side}-value`);
  if (el) el.textContent = gold ? `${Math.round(gold / 1000)}k gp` : '';
}

/* ════════════════════════════════════════════════════════
   GAME BAR
   ════════════════════════════════════════════════════════ */

function initGameBar() {
  ['home', 'away'].forEach(side => {
    document.getElementById(`gb-${side}-plus`)?.addEventListener('click',  () => adjustScore(side, +1));
    document.getElementById(`gb-${side}-minus`)?.addEventListener('click', () => adjustScore(side, -1));
  });
}

function adjustScore(side, delta) {
  gbState.scores[side] = Math.max(0, gbState.scores[side] + delta);
  const el = document.getElementById(`gb-${side}-score`);
  if (el) el.textContent = gbState.scores[side];
  /* Mirror scores to GameState for post-game screen */
  if (window.GameState) window.GameState.scores = { ...gbState.scores };
  /* Auto-open TD SPP prompt when scoring */
  if (delta > 0 && window.SPPTracker) {
    window.SPPTracker.openTDPrompt(side === 'home' ? 'left' : 'right');
  }
}

function setRerolls(side, count) {
  window.GameState.rerollsTotal[side] = count;
  window.GameState.rerolls[side]      = count;
  renderRerollPips(side);
}

function renderRerollPips(side) {
  const container = document.getElementById(`gb-${side}-rr-pips`);
  if (!container) return;
  container.innerHTML = '';
  const total = window.GameState.rerollsTotal[side];
  const used  = total - window.GameState.rerolls[side];
  for (let i = 0; i < total; i++) {
    const isUsed = i < used;
    const pip    = document.createElement('span');
    pip.className = `rr-pip${isUsed ? ' used' : ''}`;
    pip.title     = isUsed ? 'Re-roll used (click to restore)' : 'Re-roll available (click to use)';
    pip.setAttribute('role', 'button');
    pip.setAttribute('tabindex', '0');
    pip.addEventListener('click', () => {
      window.GameState.rerolls[side] = isUsed
        ? Math.min(total, window.GameState.rerolls[side] + 1)
        : Math.max(0,     window.GameState.rerolls[side] - 1);
      renderRerollPips(side);
    });
    container.appendChild(pip);
  }
}

/* ════════════════════════════════════════════════════════
   RE-ROLL BUTTON HELPER
   ════════════════════════════════════════════════════════ */

/* Appends a "Log SPP" button to a result element for injury SPP tracking.
   type = 'cas' (Casualty = +2) | 'ko' (Knocked Out = +1)
   The button prompts user to pick the injuring player from the opposing side. */
function addLogSPPBtn(resultEl, type) {
  resultEl.querySelectorAll('.log-spp-btn').forEach(b => b.remove());
  const amount = type === 'cas' ? 2 : 1;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'log-spp-btn';
  btn.textContent = `⭐ Log ${type === 'cas' ? 'CAS' : 'KO'} SPP (+${amount})`;
  btn.addEventListener('click', () => {
    btn.remove();
    /* Ask which side caused the injury — assume the opposing team */
    /* We show both sides so user can pick correctly */
    const side = document.querySelector('.spp-modal') ? null : 'left';
    window.SPPTracker?.openInjuryPrompt('left', type);
    /* A future improvement: know which panel is open to set injurerSide correctly */
  }, { once: true });
  resultEl.appendChild(btn);
}

function addRerollBtn(resultEl, onReroll) {
  resultEl.querySelectorAll('.reroll-btn').forEach(b => b.remove());
  const btn = document.createElement('button');
  btn.className   = 'reroll-btn';
  btn.textContent = '↺ Re-roll';
  btn.addEventListener('click', () => { btn.remove(); onReroll(); }, { once: true });
  resultEl.appendChild(btn);
}

/* ════════════════════════════════════════════════════════
   MODULE: KICKOFF EVENT
   ════════════════════════════════════════════════════════ */

const KICKOFF_AFFECTS = {
  2: 'both', 3: 'both', 4: 'kicking', 5: 'receiving',
  6: 'both', 7: 'both', 8: 'both',    9: 'receiving',
  10: 'kicking', 11: 'both', 12: 'both',
};

function buildKickoffChip(affects) {
  if (affects === 'kicking')   return '<span class="result-chip result-chip-warn">⚽ Kicking Team</span>';
  if (affects === 'receiving') return '<span class="result-chip result-chip-ok">🏆 Receiving Team</span>';
  return '<span class="result-chip result-chip-info">⚖️ Both Teams</span>';
}

function initKickoffModule() {
  const panel    = document.getElementById('panel-kickoff');
  const rollBtn  = document.getElementById('kickoff-roll-btn');
  const resultEl = document.getElementById('kickoff-result');
  const diceTray = document.getElementById('kickoff-dice-tray');
  const d1El     = document.getElementById('kickoff-d1');
  const d2El     = document.getElementById('kickoff-d2');
  if (!rollBtn) return;

  const physZone = ensurePhysZone(diceTray, 'kickoff-phys');

  function processRoll(total, d1, d2) {
    if (!DATA.kickoff) {
      resultEl.innerHTML = '⚠ Data not loaded — check console';
      resultEl.hidden = false;
      console.error('[BB] DATA.kickoff is null — loadModuleData may have failed');
      return;
    }
    const ev      = exactLookup(DATA.kickoff, total) ?? { name: 'Unknown Event', desc: 'No entry.' };
    const affects = KICKOFF_AFFECTS[total] ?? 'both';
    const breakdownHtml = d1 !== undefined
      ? `<div class="result-roll-breakdown">${d1} + ${d2}</div>`
      : '';
    resultEl.innerHTML = `
      <div class="result-roll-num">${total}</div>
      ${breakdownHtml}
      <div class="result-divider"></div>
      <div class="result-name">${h(ev.name)}</div>
      ${buildKickoffChip(affects)}
      <p class="result-desc">${h(ev.desc)}</p>
    `;
    resultEl.hidden = false;
    addRerollBtn(resultEl, doRoll);
  }

  async function doRoll() {
    rollBtn.disabled = true;
    resultEl.hidden  = true;
    const { d1, d2, total } = await Dice.roll2D6(d1El, d2El);
    processRoll(total, d1, d2);
    rollBtn.disabled = false;
  }

  function buildPhysButtons() {
    return Array.from({ length: 11 }, (_, i) => {
      const total = i + 2;
      const ev = exactLookup(DATA.kickoff, total);
      return { value: total, label: ev?.name ?? '?' };
    });
  }

  function showPhys() {
    diceTray.hidden = true;
    rollBtn.hidden  = true;
    window.PhysicalDice.showPhysicalButtons(physZone, {
      buttons: buildPhysButtons(), columns: 4,
      onSelect(total) { resultEl.hidden = true; processRoll(total); },
    });
    physZone.hidden = false;
  }

  function showDigital() {
    physZone.hidden  = true;
    diceTray.hidden  = false;
    rollBtn.hidden   = false;
  }

  panel?.addEventListener('bb:diceMode', e => e.detail.mode === 'physical' ? showPhys() : showDigital());
  rollBtn.addEventListener('click', doRoll);

  if (window.BBSettings.getWizardDiceMode('kickoff') === 'physical') showPhys();
}

/* ════════════════════════════════════════════════════════
   MODULE: WEATHER
   ════════════════════════════════════════════════════════ */

function initWeatherModule() {
  const panel    = document.getElementById('panel-weather');
  const rollBtn  = document.getElementById('weather-roll-btn');
  const resultEl = document.getElementById('weather-result');
  const diceTray = document.getElementById('weather-dice-tray');
  const d1El     = document.getElementById('weather-d1');
  const d2El     = document.getElementById('weather-d2');
  if (!rollBtn) return;

  const physZone = ensurePhysZone(diceTray, 'weather-phys');

  function processRoll(total, d1, d2) {
    if (!DATA.weather) {
      resultEl.innerHTML = '⚠ Data not loaded — check console';
      resultEl.hidden = false;
      console.error('[BB] DATA.weather is null — loadModuleData may have failed');
      return;
    }
    const w = rangeLookup(DATA.weather, total, 'rollMin', 'rollMax')
           ?? { name: 'Unknown', emoji: '❓', effect: '', desc: '', rollMin: total, rollMax: total };

    window.GameState.currentWeather = w;
    refreshWeatherChips();
    updateGameBarWeather(w);

    const isPerfect  = !w.effect || w.effect === 'No effect';
    const effectHtml = isPerfect
      ? `<span class="result-chip result-chip-ok">✓ No mechanical effect</span>`
      : `<span class="result-chip result-chip-warn">⚠ ${h(w.effect)}</span>`;
    const rangeLabel = w.rollMin === w.rollMax ? `rolls ${w.rollMin}` : `rolls ${w.rollMin}–${w.rollMax}`;
    const breakdownHtml = d1 !== undefined
      ? `<div class="result-roll-breakdown">${d1} + ${d2} &ensp;·&ensp; <em>${rangeLabel}</em></div>`
      : `<div class="result-roll-breakdown"><em>${rangeLabel}</em></div>`;

    resultEl.innerHTML = `
      <div class="result-roll-num">${total}</div>
      ${breakdownHtml}
      <div class="result-divider"></div>
      <div class="result-name">${w.emoji} ${h(w.name)}</div>
      ${effectHtml}
      <p class="result-desc">${h(w.desc)}</p>
    `;
    resultEl.hidden = false;
    addRerollBtn(resultEl, doRoll);
  }

  async function doRoll() {
    rollBtn.disabled = true;
    resultEl.hidden  = true;
    const { d1, d2, total } = await Dice.roll2D6(d1El, d2El);
    processRoll(total, d1, d2);
    rollBtn.disabled = false;
  }

  function buildPhysButtons() {
    return Array.from({ length: 11 }, (_, i) => {
      const total = i + 2;
      const w = rangeLookup(DATA.weather, total, 'rollMin', 'rollMax');
      const hasEffect = w && w.effect && w.effect !== 'No effect';
      return {
        value: total,
        label: w ? `${w.emoji} ${w.name}` : '?',
        cls:   hasEffect ? 'phys-warn' : 'phys-neutral',
      };
    });
  }

  function showPhys() {
    diceTray.hidden = true;
    rollBtn.hidden  = true;
    window.PhysicalDice.showPhysicalButtons(physZone, {
      buttons: buildPhysButtons(), columns: 4,
      onSelect(total) { resultEl.hidden = true; processRoll(total); },
    });
    physZone.hidden = false;
  }

  function showDigital() {
    physZone.hidden = true;
    diceTray.hidden = false;
    rollBtn.hidden  = false;
  }

  panel?.addEventListener('bb:diceMode', e => e.detail.mode === 'physical' ? showPhys() : showDigital());
  rollBtn.addEventListener('click', doRoll);

  if (window.BBSettings.getWizardDiceMode('weather') === 'physical') showPhys();
}

/* ════════════════════════════════════════════════════════
   MODULE: PRAYERS TO NUFFLE  (D16)
   ════════════════════════════════════════════════════════ */

/* The few prayers with a clean per-player effect. Others stay banner-only.
   "Until the end of the game" → removeOn:'permanent' (cleared on new game / reset). */
const PRAYER_EFFECTS = {
  'Stiletto':           { label: 'Stab',    kind: 'buff',   grantsSkill: 'Stab' },
  'Iron Man':           { label: '+1 AV',   kind: 'buff',   statMods: { AV: 1 } },
  'Knuckle Dusters':    { label: 'M.Blow',  kind: 'buff',   grantsSkill: 'Mighty Blow' },
  'Blessing of Nuffle': { label: 'Pro',     kind: 'buff',   grantsSkill: 'Pro' },
  'Greasy Cleats':      { label: '−1 MA',   kind: 'debuff', statMods: { MA: -1 } },
};

function initPrayersModule() {
  const panel    = document.getElementById('panel-prayers');
  const rollBtn  = document.getElementById('prayers-roll-btn');
  const resultEl = document.getElementById('prayers-result');
  const diceTray = document.getElementById('prayers-dice-tray');
  const d1El     = document.getElementById('prayers-d1');
  if (!rollBtn) return;

  const physZone = ensurePhysZone(diceTray, 'prayers-phys');

  /* When a per-player prayer rolls, let the coach pick the affected player. */
  function offerPrayerEffect(prayerName) {
    const def = PRAYER_EFFECTS[prayerName];
    if (!def || !window.getPlayerList) return;
    const pick = document.createElement('div');
    pick.className = 'prayer-effect-pick';
    pick.innerHTML = `<p class="prayer-effect-label">Apply <strong>${h(def.label)}</strong> to a player:</p>`;
    const row = document.createElement('div');
    row.className = 'prayer-effect-players';
    ['left', 'right'].forEach(side => {
      (window.getPlayerList(side) || [])
        .filter(p => window.isPlayerAvailable?.(p))
        .forEach(p => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'prayer-effect-btn';
          b.textContent = `${side === 'left' ? 'H' : 'A'} · #${p.id} ${p.name}`;
          b.addEventListener('click', () => {
            window.addPlayerEffect(side, p.idx, {
              id:          `prayer-${prayerName}-${side}-${p.idx}`,
              label:       def.label,
              kind:        def.kind,
              statMods:    def.statMods ?? {},
              grantsSkill: def.grantsSkill,
              removeOn:    'permanent',
              source:      'prayer',
            });
            row.querySelectorAll('.prayer-effect-btn').forEach(x => { x.disabled = true; });
            b.classList.add('applied');
            b.textContent = '✓ ' + b.textContent;
          });
          row.appendChild(b);
        });
    });
    pick.appendChild(row);
    resultEl.appendChild(pick);
  }

  function processRoll(val) {
    if (!DATA.prayers) {
      resultEl.innerHTML = '⚠ Data not loaded — check console';
      resultEl.hidden = false;
      console.error('[BB] DATA.prayers is null — loadModuleData may have failed');
      return;
    }
    const prayer = exactLookup(DATA.prayers, val) ?? { name: 'Unknown Blessing', desc: '' };
    resultEl.innerHTML = `
      <div class="result-roll-num">${val}</div>
      <div class="result-name">✦ ${h(prayer.name)}</div>
      <hr class="result-divider">
      <p class="result-desc">${h(prayer.desc)}</p>
    `;
    resultEl.hidden = false;
    addRerollBtn(resultEl, doRoll);
    offerPrayerEffect(prayer.name);

    /* Persist prayer to main-screen banner */
    if (window.GameState) window.GameState.activePrayer = prayer;
    const banner   = document.getElementById('active-prayer-banner');
    const bannerTx = document.getElementById('active-prayer-text');
    const dismiss  = document.getElementById('active-prayer-dismiss');
    if (banner && bannerTx) {
      bannerTx.textContent = `✦ ${prayer.name}: ${prayer.desc.substring(0, 80)}…`;
      banner.removeAttribute('hidden');
      if (dismiss) {
        dismiss.onclick = () => {
          banner.setAttribute('hidden', '');
          if (window.GameState) window.GameState.activePrayer = null;
        };
      }
    }
  }

  async function doRoll() {
    rollBtn.disabled = true;
    resultEl.hidden  = true;
    const val = await Dice.rollDieElement(d1El);
    processRoll(val);
    rollBtn.disabled = false;
  }

  function buildPhysButtons() {
    return Array.from({ length: 16 }, (_, i) => {
      const val = i + 1;
      const p   = exactLookup(DATA.prayers, val);
      return { value: val, label: p?.name ?? '?' };
    });
  }

  function showPhys() {
    diceTray.hidden = true;
    rollBtn.hidden  = true;
    window.PhysicalDice.showPhysicalButtons(physZone, {
      buttons: buildPhysButtons(), columns: 4,
      onSelect(val) { resultEl.hidden = true; processRoll(val); },
    });
    physZone.hidden = false;
  }

  function showDigital() {
    physZone.hidden = true;
    diceTray.hidden = false;
    rollBtn.hidden  = false;
  }

  panel?.addEventListener('bb:diceMode', e => e.detail.mode === 'physical' ? showPhys() : showDigital());
  rollBtn.addEventListener('click', doRoll);

  if (window.BBSettings.getWizardDiceMode('prayers') === 'physical') showPhys();
}

/* ════════════════════════════════════════════════════════
   MODULE: BALL SCATTER / BOUNCE / THROW-IN
   Physical mode adds compass buttons for each D8.
   ════════════════════════════════════════════════════════ */

function initScatterModule() {
  const DEV_ARROWS = {1:'↖',2:'↑',3:'↗',4:'←',5:'→',6:'↙',7:'↓',8:'↘'};
  const DEV_NAMES  = {1:'Up-Left',2:'Up',3:'Up-Right',4:'Left',5:'Right',6:'Down-Left',7:'Down',8:'Down-Right'};

  bindScatterRoll('deviation',
    ['deviation-d6', 'deviation-d8'],
    'deviation-result',
    ({ vals }) => {
      const [dist, dir] = vals;
      return `
        <div class="result-roll-num" style="font-size:3rem;line-height:1;">${DEV_ARROWS[dir] ?? dir}</div>
        <div class="result-name">${DEV_NAMES[dir] ?? dir}</div>
        <div class="result-roll-breakdown">${dist} square${dist !== 1 ? 's' : ''}</div>
        <p class="result-desc">The ball deviates <strong>${dist}</strong> square${dist !== 1 ? 's' : ''} to the <strong>${DEV_NAMES[dir] ?? dir}</strong>.</p>
      `;
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

  initScatterPhysical();
}

function bindScatterRoll(prefix, dieIds, resultId, buildHtml) {
  const btn      = document.getElementById(`${prefix}-roll-btn`);
  const resultEl = document.getElementById(resultId);
  if (!btn) return;

  async function doRoll() {
    btn.disabled    = true;
    resultEl.hidden = true;
    const dies = dieIds.map(id => document.getElementById(id));
    const vals = await Promise.all(dies.map(d => Dice.rollDieElement(d)));
    resultEl.innerHTML = buildHtml({ vals });
    resultEl.hidden = false;
    addRerollBtn(resultEl, doRoll);
    btn.disabled = false;
  }
  btn.addEventListener('click', doRoll);
}

function highlightCompass(compassId, activeDir) {
  document.querySelectorAll(`#${compassId} .compass-dir`).forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.dir, 10) === activeDir);
  });
}

function initScatterPhysical() {
  const panel = document.getElementById('panel-scatter');
  if (!panel) return;

  /* Build physical zones for each sub-tab */
  function setupSubTab(prefix, hasDist, resultId, buildResultHtml) {
    const trayId   = `${prefix}-dice-tray`;
    const rollBtnId = `${prefix}-roll-btn`;
    const diceTray  = document.getElementById(trayId);
    const rollBtn   = document.getElementById(rollBtnId);
    const resultEl  = document.getElementById(resultId);
    if (!diceTray || !rollBtn) return;

    const physZone = ensurePhysZone(diceTray, `${prefix}-phys`);

    let selectedDist = null;
    let selectedDir  = null;

    function tryShowResult() {
      if (hasDist && selectedDist === null) return;
      if (selectedDir === null) return;
      const dist = selectedDist ?? 1;
      const dir  = selectedDir;
      resultEl.innerHTML = buildResultHtml(dist, dir);
      resultEl.hidden = false;
      if (prefix === 'bounce') highlightCompass('bounce-compass', dir);
    }

    function buildPhysUI() {
      physZone.innerHTML = '';
      selectedDist = null;
      selectedDir  = null;
      if (resultEl) resultEl.hidden = true;

      if (hasDist) {
        const distLabel = document.createElement('div');
        distLabel.className   = 'input-label';
        distLabel.style.marginBottom = '0.3rem';
        distLabel.textContent = 'Distance (D6)';
        physZone.appendChild(distLabel);

        const distZone = document.createElement('div');
        physZone.appendChild(distZone);

        window.PhysicalDice.showPhysicalButtons(distZone, {
          buttons: Array.from({ length: 6 }, (_, i) => ({ value: i + 1, label: `${i + 1} sq` })),
          columns: 6,
          onSelect(val) { selectedDist = val; tryShowResult(); },
        });

        const dirLabel = document.createElement('div');
        dirLabel.className   = 'input-label';
        dirLabel.style.margin = '0.5rem 0 0.2rem';
        dirLabel.textContent = 'Direction (D8)';
        physZone.appendChild(dirLabel);
      }

      const compassZone = document.createElement('div');
      physZone.appendChild(compassZone);

      window.PhysicalDice.showCompassButtons(compassZone, val => {
        selectedDir = val;
        tryShowResult();
      });
    }

    return { showPhys() { diceTray.hidden = true; rollBtn.hidden = true; physZone.hidden = false; buildPhysUI(); },
             showDigital() { physZone.hidden = true; diceTray.hidden = false; rollBtn.hidden = false; } };
  }

  const deviationHandlers = setupSubTab('deviation', true, 'deviation-result',
    (dist, dir) => `<div class="result-name">Deviates ${dist} square${dist !== 1 ? 's' : ''}</div>
                    <div class="result-direction">${DIRECTION_LABELS[dir] ?? dir}</div>`);

  const bounceHandlers = setupSubTab('bounce', false, 'bounce-result',
    (_dist, dir) => `<div class="result-name">Ball bounces 1 square</div>
                     <div class="result-direction">${DIRECTION_LABELS[dir] ?? dir}</div>`);

  const throwinHandlers = setupSubTab('throwin', true, 'throwin-result',
    (dist, dir) => `<div class="result-name">Thrown in ${dist} square${dist !== 1 ? 's' : ''}</div>
                    <div class="result-direction">${DIRECTION_LABELS[dir] ?? dir}</div>`);

  function applyMode(mode) {
    const isPhys = mode === 'physical';
    deviationHandlers?.[isPhys ? 'showPhys' : 'showDigital']?.();
    bounceHandlers   ?.[isPhys ? 'showPhys' : 'showDigital']?.();
    throwinHandlers  ?.[isPhys ? 'showPhys' : 'showDigital']?.();
  }

  panel.addEventListener('bb:diceMode', e => applyMode(e.detail.mode));
  if (window.BBSettings.getWizardDiceMode('scatter') === 'physical') applyMode('physical');
}

/* ════════════════════════════════════════════════════════
   MODULE: ARMOUR & INJURY
   Three results shown simultaneously (never replaced):
     #injury-result     — armour check
     #injury-inj-result — injury table
     #casualty-result   — casualty D16

   Physical mode:
     • Armour physical buttons rebuild when AV or mods change
     • After armour breaks → injury physical buttons appear
     • After Casualty! → casualty physical buttons appear

   Re-roll buttons:
     • Armour holds → re-roll restarts full sequence
     • Injury shown → re-roll re-rolls injury only (not armour)
     • Casualty → no re-roll
   ════════════════════════════════════════════════════════ */

function initInjuryModule() {
  let selectedAV = 8;
  const mods = { 'mighty-blow': false, 'dirty-player': false, stunty: false };

  const panel       = document.getElementById('panel-injury');
  const avPicker    = document.getElementById('injury-av-picker');
  const rollBtn     = document.getElementById('injury-roll-btn');
  const avResultEl  = document.getElementById('injury-result');
  const injResultEl = document.getElementById('injury-inj-result');
  const casResultEl = document.getElementById('casualty-result');
  const casTrayEl   = document.getElementById('casualty-dice-tray');
  const diceTray    = document.getElementById('injury-dice-tray');
  const d1El        = document.getElementById('injury-d1');
  const d2El        = document.getElementById('injury-d2');
  const casDieEl    = document.getElementById('injury-cas-d1');
  if (!rollBtn) return;

  /* Physical zones, inserted right after their digital counterparts */
  const armourPhysZone = ensurePhysZone(diceTray,    'injury-armour-phys');
  const injPhysZone    = ensurePhysZone(injResultEl,  'injury-inj-phys');
  const casPhysZone    = ensurePhysZone(casTrayEl,    'injury-cas-phys');

  avPicker?.addEventListener('click', e => {
    const btn = e.target.closest('.av-btn');
    if (!btn) return;
    avPicker.querySelectorAll('.av-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedAV = parseInt(btn.dataset.av, 10);
    if (currentMode() === 'physical') buildArmourPhysUI();
  });

  document.getElementById('panel-injury')?.querySelectorAll('.mod-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.mod;
      if (key === undefined) return;
      mods[key] = !mods[key];
      btn.classList.toggle('active', mods[key]);
      if (currentMode() === 'physical') buildArmourPhysUI();
    });
  });

  function currentMode() { return window.BBSettings.getWizardDiceMode('injury'); }
  function avMod()       { return (mods['mighty-blow'] ? 1 : 0) + (mods['dirty-player'] ? 1 : 0); }

  /* ── Physical button builders ── */

  function armourPhysButtons() {
    const mod = avMod();
    return Array.from({ length: 11 }, (_, i) => {
      const roll   = i + 2;
      const modded = roll + mod;
      const breaks = modded >= selectedAV;
      return {
        value: roll,
        label: breaks ? `Breaks! (${modded})` : `Holds (${modded})`,
        cls:   breaks ? 'phys-bad' : 'phys-muted',
      };
    });
  }

  function injuryPhysButtons() {
    const mod   = avMod();
    const table = mods.stunty ? DATA.injury?.stunty : DATA.injury?.injury;
    const CLS   = { 'result-ok': 'phys-neutral', 'result-ko': 'phys-warn', 'result-cas': 'phys-bad' };
    return Array.from({ length: 11 }, (_, i) => {
      const roll   = i + 2;
      const modded = Math.min(12, roll + mod);
      const entry  = rangeLookup(table, modded);
      return { value: roll, label: entry?.result ?? '?', cls: CLS[entry?.['class']] ?? 'phys-neutral' };
    });
  }

  function casualtyPhysButtons() {
    const CLS = { 'result-ok': 'phys-neutral', 'result-ko': 'phys-warn', 'result-cas': 'phys-bad' };
    return Array.from({ length: 16 }, (_, i) => {
      const val   = i + 1;
      const entry = rangeLookup(DATA.injury?.casualty, val);
      return { value: val, label: entry?.result ?? '?', cls: CLS[entry?.['class']] ?? 'phys-neutral' };
    });
  }

  /* ── Physical UI builders ── */

  function buildArmourPhysUI() {
    armourPhysZone.hidden = false;
    injPhysZone.hidden    = true;
    casPhysZone.hidden    = true;
    injResultEl.hidden    = true;
    casResultEl.hidden    = true;
    casTrayEl.hidden      = true;

    window.PhysicalDice.showPhysicalButtons(armourPhysZone, {
      buttons: armourPhysButtons(), columns: 4,
      onSelect(roll) { onPhysArmourSelect(roll); },
    });
  }

  function onPhysArmourSelect(roll) {
    const mod    = avMod();
    const modded = roll + mod;
    const modNote = mod ? ` (+${mod})` : '';

    if (modded < selectedAV) {
      avResultEl.innerHTML = `
        <div class="result-roll-num">${roll}${modNote}</div>
        <div class="result-roll-breakdown">Physical roll vs AV${selectedAV}+</div>
        <div class="result-name" style="color:var(--bb-gold,#D4AF37);">Armour Holds</div>
        <p class="result-desc">Total ${modded} is below AV ${selectedAV}+. No injury.</p>
      `;
      avResultEl.hidden = false;
      return;
    }

    avResultEl.innerHTML = `
      <div class="result-roll-num">${roll}${modNote}</div>
      <div class="result-roll-breakdown">Physical roll vs AV${selectedAV}+</div>
      <div class="result-name" style="color:var(--bb-red,#C8102E);">Armour Broken!</div>
    `;
    avResultEl.hidden = false;

    /* Show injury physical buttons below armour result */
    buildInjuryPhysUI();
  }

  function buildInjuryPhysUI() {
    injPhysZone.hidden = false;
    window.PhysicalDice.showPhysicalButtons(injPhysZone, {
      buttons: injuryPhysButtons(), columns: 4,
      onSelect(roll) { onPhysInjurySelect(roll); },
    });
  }

  function onPhysInjurySelect(roll) {
    const mod    = avMod();
    const modded = Math.min(12, roll + mod);
    const table  = mods.stunty ? DATA.injury?.stunty : DATA.injury?.injury;
    const inj    = rangeLookup(table, modded) ?? { result: 'Unknown', 'class': '', desc: '' };

    injResultEl.innerHTML = `
      <div class="result-roll-num">${roll}${mod ? ` (+${mod})` : ''}</div>
      <div class="result-roll-breakdown">Physical — Injury table${mods.stunty ? ' (Stunty)' : ''}</div>
      <div class="result-name ${inj['class']}">${h(inj.result)}</div>
      <p class="result-desc">${h(inj.desc)}</p>
    `;
    injResultEl.hidden = false;

    if (inj.result !== 'Casualty!') {
      addRerollBtn(injResultEl, buildInjuryPhysUI);
    } else {
      buildCasualtyPhysUI();
    }
  }

  function buildCasualtyPhysUI() {
    casPhysZone.hidden = false;
    window.PhysicalDice.showPhysicalButtons(casPhysZone, {
      buttons: casualtyPhysButtons(), columns: 4,
      onSelect(val) { onPhysCasualtySelect(val); },
    });
  }

  function onPhysCasualtySelect(val) {
    const cas = rangeLookup(DATA.injury?.casualty, val) ?? { result: 'Unknown', 'class': '', desc: '' };
    casResultEl.innerHTML = `
      <div class="result-roll-num">${val}</div>
      <div class="result-roll-breakdown">Physical — Casualty Table (D16)</div>
      <div class="result-name ${cas['class']}">${h(cas.result)}</div>
      <p class="result-desc">${h(cas.desc)}</p>
    `;
    casResultEl.hidden = false;
    casTrayEl.hidden   = true;
  }

  /* ── Digital cascade ── */

  async function doInjuryRoll(mod) {
    injResultEl.hidden = true;
    injPhysZone.hidden = true;
    casResultEl.hidden = true;
    casPhysZone.hidden = true;
    casTrayEl.hidden   = true;

    const { d1: i1, d2: i2, total: injTotal } = await Dice.roll2D6(d1El, d2El);
    const injModded = Math.min(12, injTotal + mod);
    const injTable  = mods.stunty ? DATA.injury?.stunty : DATA.injury?.injury;
    const inj       = rangeLookup(injTable, injModded) ?? { result: 'Unknown', 'class': '', desc: '' };

    injResultEl.innerHTML = `
      <div class="result-roll-num">${injTotal}${mod ? ` (+${mod})` : ''}</div>
      <div class="result-roll-breakdown">${i1} + ${i2} — Injury table${mod ? ` +${mod}` : ''}${mods.stunty ? ' (Stunty)' : ''}</div>
      <div class="result-name ${inj['class']}">${h(inj.result)}</div>
      <p class="result-desc">${h(inj.desc)}</p>
    `;
    injResultEl.hidden = false;

    if (inj.result === 'Knocked Out') {
      addRerollBtn(injResultEl, () => doInjuryRoll(mod));
      addLogSPPBtn(injResultEl, 'ko');
    } else if (inj.result !== 'Casualty!') {
      addRerollBtn(injResultEl, () => doInjuryRoll(mod));
    } else if (casResultEl && casDieEl) {
      addLogSPPBtn(injResultEl, 'cas');
      await delay(500);
      casTrayEl.hidden   = false;
      casResultEl.innerHTML = `<p class="result-desc" style="margin:0;">Rolling Casualty table (D16)…</p>`;
      casResultEl.hidden = false;
      await delay(300);
      const casVal = await Dice.rollDieElement(casDieEl);
      const cas    = rangeLookup(DATA.injury?.casualty, casVal) ?? { result: 'Unknown', 'class': '', desc: '' };
      casResultEl.innerHTML = `
        <div class="result-roll-num">${casVal}</div>
        <div class="result-roll-breakdown">Casualty Table (D16)</div>
        <div class="result-name ${cas['class']}">${h(cas.result)}</div>
        <p class="result-desc">${h(cas.desc)}</p>
      `;
    }
  }

  async function doArmourRoll() {
    rollBtn.disabled    = true;
    avResultEl.hidden   = true;
    injResultEl.hidden  = true;
    casResultEl.hidden  = true;
    casTrayEl.hidden    = true;
    injPhysZone.hidden  = true;
    casPhysZone.hidden  = true;

    const { d1, d2, total: avTotal } = await Dice.roll2D6(d1El, d2El);
    const mod     = avMod();
    const avModded = avTotal + mod;
    const modNote  = mod ? ` (+${mod})` : '';

    if (avModded < selectedAV) {
      avResultEl.innerHTML = `
        <div class="result-roll-num">${avTotal}${modNote}</div>
        <div class="result-roll-breakdown">${d1} + ${d2}${mod ? ` + ${mod} modifier` : ''} vs AV${selectedAV}+</div>
        <div class="result-name" style="color:var(--bb-gold,#D4AF37);">Armour Holds</div>
        <p class="result-desc">Total ${avModded} is below AV ${selectedAV}+. No injury.</p>
      `;
      avResultEl.hidden = false;
      addRerollBtn(avResultEl, doArmourRoll);
      rollBtn.disabled = false;
      return;
    }

    avResultEl.innerHTML = `
      <div class="result-roll-num">${avTotal}${modNote}</div>
      <div class="result-roll-breakdown">${d1} + ${d2}${mod ? ` + ${mod} mod` : ''} vs AV${selectedAV}+</div>
      <div class="result-name" style="color:var(--bb-red,#C8102E);">Armour Broken!</div>
      <p class="result-desc">Rolling on the Injury table…</p>
    `;
    avResultEl.hidden = false;

    await delay(450);
    await doInjuryRoll(mod);
    rollBtn.disabled = false;
  }

  /* ── Mode switch ── */

  function showPhys() {
    diceTray.hidden  = true;
    rollBtn.hidden   = true;
    avResultEl.hidden  = true;
    injResultEl.hidden = true;
    casResultEl.hidden = true;
    casTrayEl.hidden   = true;
    buildArmourPhysUI();
  }

  function showDigital() {
    armourPhysZone.hidden = true;
    injPhysZone.hidden    = true;
    casPhysZone.hidden    = true;
    diceTray.hidden       = false;
    rollBtn.hidden        = false;
  }

  panel?.addEventListener('bb:diceMode', e => e.detail.mode === 'physical' ? showPhys() : showDigital());
  rollBtn.addEventListener('click', doArmourRoll);

  if (currentMode() === 'physical') showPhys();
}

/* ════════════════════════════════════════════════════════
   UTILITIES
   ════════════════════════════════════════════════════════ */

function h(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ════════════════════════════════════════════════════════
   SETTINGS PANEL + GAME MODE
   ════════════════════════════════════════════════════════ */

function initSettings() {
  /* The settings drawer was removed; its contents (play mode, dice mode,
     drive-wizard shortcuts) will be rebuilt inside the Game Settings card.
     For now, still apply the saved play mode so module dimming stays correct. */
  const savedMode = window.BBSettings?.getSettings().mode ?? 'veteran';
  applyMode(savedMode, false /* don't re-save */);
}

function applyMode(mode, save = true) {
  document.body.classList.remove('mode-beginner', 'mode-veteran', 'mode-pro');
  document.body.classList.add(`mode-${mode}`);
  if (save) window.BBSettings?.saveSetting('mode', mode);

  /* Pro mode: lift all module dimming */
  if (mode === 'pro') {
    document.querySelectorAll('.module-btn').forEach(btn => btn.classList.remove('module-dimmed'));
  } else if (mode === 'veteran' || mode === 'beginner') {
    /* Re-apply phase-based dimming (defined in state.js) */
    const phase = window.GameState?.phase;
    if (phase) window.setPhase?.(phase);
  }
}

function updateGameBarWeather(w) {
  const chip = document.getElementById('gb-weather-chip');
  if (!chip) return;
  if (!w) { chip.hidden = true; return; }
  chip.hidden   = false;
  chip.textContent = `${w.emoji} ${w.name}`;
}

/* (Settings drawer + its content builder were removed; play mode, dice mode,
   and drive-wizard shortcuts will be rebuilt inside the Game Settings card.) */

/* ════════════════════════════════════════════════════════
   PUBLIC API
   ════════════════════════════════════════════════════════ */

/* Expose gbState for SPP post-game screen to read scores */
window.gbState = gbState;

window.Panels = {
  openPanel, closePanel, togglePanel,
  openAccordion, setAccordionLabel, setAccordionValue, setRerolls, renderRerollPips,
  refreshWeatherChips, updateGameBarWeather,
  applyMode,
};

/* ════════════════════════════════════════════════════════
   BOOT
   ════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', async () => {
  await loadModuleData();

  Dice.initAllDice();
  initPanels();
  initSubTabs();
  initAccordions();
  initGameBar();
  initDiceModeToggles();
  initKickoffModule();
  initWeatherModule();
  initPrayersModule();
  initScatterModule();
  initInjuryModule();
  initSettings();

  window.bbSignalReady?.();
});
