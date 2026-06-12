'use strict';
/* ═══════════════════════════════════════════════════════
   Blood Bowl Companion — js/state.js
   Game phase state machine + player status tracking.
   Loads BEFORE panels.js and wizards.js.
   ═══════════════════════════════════════════════════════ */

/* ────────────────────────────────────────────────────────
   PLAYER STATUS
   ──────────────────────────────────────────────────────── */

const PlayerStatus = {
  AVAILABLE:   'available',
  PRONE:       'prone',
  STUNNED:     'stunned',
  KO:          'ko',
  MNG:         'mng',          /* Miss Next Game */
  BADLY_HURT:  'badly_hurt',
  DEAD:        'dead',
  SENT_OFF:    'sent_off',
  TEMP_NEG:    'temp_neg',     /* Bone Head / Really Stupid / Hypnotised etc. */
};

/* Metadata for each status */
const STATUS_META = {
  [PlayerStatus.AVAILABLE]:  { label: '',          cls: '',                 dim: false },
  [PlayerStatus.PRONE]:      { label: 'Prone',     cls: 'status-prone',     dim: false },
  [PlayerStatus.STUNNED]:    { label: 'Stunned',   cls: 'status-stunned',   dim: false },
  [PlayerStatus.KO]:         { label: 'KO',        cls: 'status-ko',        dim: true  },
  [PlayerStatus.MNG]:        { label: 'MNG',       cls: 'status-mng',       dim: true  },
  [PlayerStatus.BADLY_HURT]: { label: 'Badly Hurt',cls: 'status-cas',       dim: true  },
  [PlayerStatus.DEAD]:       { label: 'Dead',      cls: 'status-dead',      dim: true  },
  [PlayerStatus.SENT_OFF]:   { label: 'Sent Off',  cls: 'status-sent-off',  dim: true  },
  [PlayerStatus.TEMP_NEG]:   { label: 'Temp',      cls: 'status-temp',      dim: false },
};

/* Ordered cycle used by the status menu */
const STATUS_CYCLE = [
  PlayerStatus.AVAILABLE,
  PlayerStatus.PRONE,
  PlayerStatus.STUNNED,
  PlayerStatus.KO,
  PlayerStatus.MNG,
  PlayerStatus.BADLY_HURT,
  PlayerStatus.DEAD,
  PlayerStatus.SENT_OFF,
  PlayerStatus.TEMP_NEG,
];

/* Quick buff/debuff presets shown in the status menu */
const STATUS_EFFECT_PRESETS = [
  { label: '+1 ST', kind: 'buff',   statMods: { ST: 1 } },
  { label: '−1 ST', kind: 'debuff', statMods: { ST: -1 } },
  { label: '+1 AG', kind: 'buff',   statMods: { AG: 1 } },
  { label: '−1 AG', kind: 'debuff', statMods: { AG: -1 } },
  { label: '+1 MA', kind: 'buff',   statMods: { MA: 1 } },
  { label: '+Block', kind: 'buff',  grantsSkill: 'Block' },
  { label: '+Dodge', kind: 'buff',  grantsSkill: 'Dodge' },
];

window.PlayerStatus = PlayerStatus;
window.STATUS_META  = STATUS_META;

/* ────────────────────────────────────────────────────────
   GAME PHASES
   ──────────────────────────────────────────────────────── */

const GamePhase = {
  PRE_GAME:      'pre_game',
  WEATHER:       'weather',
  KICKOFF_EVENT: 'kickoff_event',
  BALL_LANDING:  'ball_landing',
  DRIVE:         'drive',
  SCORING:       'scoring',
  HALF_TIME:     'half_time',
  GAME_OVER:     'game_over',
};

window.GamePhase = GamePhase;

/* Timeline: ordered steps with icon, label, and which panels are PRIMARY for that phase */
const TIMELINE_STEPS = [
  { phase: GamePhase.WEATHER,       label: 'Weather', icon: '🌤',  primary: ['weather']          },
  { phase: GamePhase.KICKOFF_EVENT, label: 'Event',   icon: '⚡',  primary: ['kickoff', 'prayers'] },
  { phase: GamePhase.BALL_LANDING,  label: 'Ball',    icon: '⚽',  primary: ['scatter']           },
  { phase: GamePhase.DRIVE,         label: 'Drive',   icon: '🏟',  primary: ['block','pass','foul','throw','scatter','injury'] },
  { phase: GamePhase.SCORING,       label: 'TD',      icon: '🏆',  primary: ['prayers']           },
];

/* Which panels are enabled in each phase (null = all) */
const PHASE_ALLOWLIST = {
  [GamePhase.PRE_GAME]:      ['prayers'],
  [GamePhase.WEATHER]:       ['weather', 'prayers'],
  [GamePhase.KICKOFF_EVENT]: ['kickoff', 'prayers'],
  [GamePhase.BALL_LANDING]:  ['scatter', 'prayers'],
  [GamePhase.DRIVE]:         ['block', 'pass', 'foul', 'throw', 'scatter', 'injury', 'prayers'],
  [GamePhase.SCORING]:       ['prayers'],
  [GamePhase.HALF_TIME]:     ['weather', 'prayers'],
  [GamePhase.GAME_OVER]:     [],
};

/* ────────────────────────────────────────────────────────
   STATE
   ──────────────────────────────────────────────────────── */

const GameState = {
  phase:          GamePhase.WEATHER,
  half:           1,
  /* side → { idx: PlayerStatus } */
  playerStatuses: { left: {}, right: {} },
  /* side → { idx: [Effect, ...] } — temporary buffs/debuffs, parallel to status */
  playerEffects:  { left: {}, right: {} },
  rerolls:        { home: 0, away: 0 },
  rerollsTotal:   { home: 0, away: 0 },
  currentWeather: null,   /* set to a weather.json entry when weather is rolled */
  ballCarrier:    null,   /* { side: 'left'|'right', idx } — set when ball possession is tracked */
  kickingTeam:    null,   /* 'home' | 'away' — set by drive wizard */
  scores:         { home: 0, away: 0 },     /* mirrored from gbState by adjustScore() */
  sppEvents:      [],     /* [{ side, playerIdx, savedId, amount, reason, timestamp }] */
  activeTeamIds:  { home: null, away: null },  /* saved team UUIDs when custom teams loaded */
  /* side → { idx: { acted: true, actionType } } — cleared on End Turn */
  turnFlags:      { left: {}, right: {} },
};

window.GameState = GameState;

/* ────────────────────────────────────────────────────────
   PHASE MANAGEMENT
   ──────────────────────────────────────────────────────── */

function setPhase(phase) {
  GameState.phase = phase;
  updateTimeline();
  updateModuleAvailability();
  document.dispatchEvent(new CustomEvent('bb:phase', { detail: { phase } }));
}

function advancePhase() {
  const order = TIMELINE_STEPS.map(s => s.phase);
  const idx   = order.indexOf(GameState.phase);
  if (idx >= 0 && idx < order.length - 1) setPhase(order[idx + 1]);
}

window.setPhase    = setPhase;
window.advancePhase = advancePhase;

/* ────────────────────────────────────────────────────────
   MODULE AVAILABILITY
   ──────────────────────────────────────────────────────── */

function updateModuleAvailability() {
  const allowed = PHASE_ALLOWLIST[GameState.phase] ?? null;
  document.querySelectorAll('.module-btn').forEach(btn => {
    const panelId = btn.dataset.panel;
    const dimmed  = allowed !== null && !allowed.includes(panelId);
    btn.classList.toggle('module-dimmed', dimmed);
  });
}

/* ────────────────────────────────────────────────────────
   TIMELINE UI
   ──────────────────────────────────────────────────────── */

function buildTimeline() {
  const container = document.getElementById('game-timeline');
  if (!container) return;
  container.innerHTML = '';

  TIMELINE_STEPS.forEach(({ phase, label, icon }, i) => {
    const step = document.createElement('button');
    step.type  = 'button';
    step.className    = 'timeline-step';
    step.dataset.phase = phase;
    step.title = `Switch to ${label} phase`;
    step.innerHTML = `
      <span class="tl-icon">${icon}</span>
      <span class="tl-label">${label}</span>
    `;
    step.addEventListener('click', () => setPhase(phase));
    container.appendChild(step);

    if (i < TIMELINE_STEPS.length - 1) {
      const sep = document.createElement('span');
      sep.className = 'tl-sep';
      sep.textContent = '›';
      container.appendChild(sep);
    }
  });

  updateTimeline();
}

function updateTimeline() {
  const order = TIMELINE_STEPS.map(s => s.phase);
  const cur   = order.indexOf(GameState.phase);

  document.querySelectorAll('.timeline-step').forEach(step => {
    const idx = order.indexOf(step.dataset.phase);
    step.classList.toggle('tl-done',    idx < cur);
    step.classList.toggle('tl-current', idx === cur);
    step.classList.toggle('tl-future',  idx > cur);
  });

  /* Update "next" button */
  const nextBtn = document.getElementById('timeline-next-btn');
  if (!nextBtn) return;
  const nextIdx = cur + 1;
  if (nextIdx < TIMELINE_STEPS.length) {
    const next = TIMELINE_STEPS[nextIdx];
    nextBtn.innerHTML = `${next.icon} Next: <strong>${next.label}</strong>`;
    nextBtn.hidden = false;
  } else {
    nextBtn.hidden = true;
  }
}

/* ────────────────────────────────────────────────────────
   PLAYER STATUS MANAGEMENT
   ──────────────────────────────────────────────────────── */

function getPlayerStatus(side, idx) {
  return GameState.playerStatuses[side]?.[idx] ?? PlayerStatus.AVAILABLE;
}

function setPlayerStatus(side, idx, status) {
  if (!GameState.playerStatuses[side]) GameState.playerStatuses[side] = {};
  GameState.playerStatuses[side][idx] = status;
  refreshPlayerCard(side, idx, status);
  document.dispatchEvent(new CustomEvent('bb:playerStatus', {
    detail: { side, idx, status }
  }));
}

window.getPlayerStatus = getPlayerStatus;
window.setPlayerStatus = setPlayerStatus;

/* ────────────────────────────────────────────────────────
   TURN TRACKING
   A player who completes a wizard action is flagged for the
   rest of the team turn. Exceptions are handled by callers:
   catching a pass is not an action, and a blitzer keeps any
   remaining movement (the flag records actionType 'blitz').
   ──────────────────────────────────────────────────────── */

function hasPlayerActed(side, idx) {
  /* Professional mode can switch action tracking off entirely. */
  if (window.BBSettings?.modeAllows && !window.BBSettings.modeAllows('turnTracking')) return false;
  return !!GameState.turnFlags[side]?.[idx]?.acted;
}

function markPlayerActed(side, idx, actionType) {
  if (idx == null) return;
  if (!GameState.turnFlags[side]) GameState.turnFlags[side] = {};
  GameState.turnFlags[side][idx] = { acted: true, actionType };
  document.dispatchEvent(new CustomEvent('bb:playerActed', { detail: { side, idx, actionType } }));
}

/* End the current team turn: every player is fresh again. */
function endTurn() {
  GameState.turnFlags = { left: {}, right: {} };
  document.dispatchEvent(new CustomEvent('bb:turnEnd'));
}

window.hasPlayerActed  = hasPlayerActed;
window.markPlayerActed = markPlayerActed;
window.endTurn         = endTurn;

/* ── Temporary effects (buffs / debuffs) — a parallel channel to status ──
   Effect: { id, label, kind:'buff'|'debuff', statMods:{ST,MA,AG,PA,AV},
             grantsSkill?, removeOn:'untilRoll'|'drive'|'half'|'permanent', source } */

function getPlayerEffects(side, idx) {
  return GameState.playerEffects[side]?.[idx] ?? [];
}

function addPlayerEffect(side, idx, effect) {
  if (!GameState.playerEffects[side]) GameState.playerEffects[side] = {};
  const list = GameState.playerEffects[side][idx] ?? (GameState.playerEffects[side][idx] = []);
  /* Dedupe by id */
  const existing = list.findIndex(e => e.id === effect.id);
  if (existing >= 0) list[existing] = effect; else list.push(effect);
  refreshPlayerCard(side, idx, getPlayerStatus(side, idx));
  document.dispatchEvent(new CustomEvent('bb:playerEffect', { detail: { side, idx } }));
}

function removePlayerEffect(side, idx, effectId) {
  const list = GameState.playerEffects[side]?.[idx];
  if (!list) return;
  GameState.playerEffects[side][idx] = list.filter(e => e.id !== effectId);
  refreshPlayerCard(side, idx, getPlayerStatus(side, idx));
  document.dispatchEvent(new CustomEvent('bb:playerEffect', { detail: { side, idx } }));
}

/* Drop effects whose removeOn matches the given scope (e.g. 'drive', 'half'). */
function clearEffectsByPhase(side, scope) {
  const bySide = GameState.playerEffects[side] ?? {};
  Object.keys(bySide).forEach(idx => {
    const kept = bySide[idx].filter(e => e.removeOn !== scope);
    if (kept.length !== bySide[idx].length) {
      bySide[idx] = kept;
      refreshPlayerCard(side, parseInt(idx, 10), getPlayerStatus(side, idx));
    }
  });
  document.dispatchEvent(new CustomEvent('bb:playerEffect', { detail: { side } }));
}

/* Base stat + sum of all effect statMods for that key. Single source of truth
   used by the wizards so buffs/debuffs apply everywhere consistently. */
function getEffectiveStat(side, idx, statKey, baseValue) {
  const base = Number(baseValue);
  if (!Number.isFinite(base)) return baseValue;
  const delta = getPlayerEffects(side, idx)
    .reduce((sum, e) => sum + (e.statMods?.[statKey] ?? 0), 0);
  return base + delta;
}

/* Canonical "is this player selectable in a wizard?" test. */
function isPlayerAvailable(p) {
  return !STATUS_META?.[p?.status]?.dim;
}

window.getPlayerEffects    = getPlayerEffects;
window.addPlayerEffect     = addPlayerEffect;
window.removePlayerEffect  = removePlayerEffect;
window.clearEffectsByPhase = clearEffectsByPhase;
window.getEffectiveStat    = getEffectiveStat;
window.isPlayerAvailable   = isPlayerAvailable;

function refreshPlayerCard(side, idx, status) {
  const cards = document.querySelectorAll(`#roster-${side} .player-card`);
  const card  = cards[idx];
  if (!card) return;

  /* Remove old badges (status + effects use separate selectors so they don't clobber) */
  card.querySelector('.player-status-badge')?.remove();
  card.querySelectorAll('.player-effect-badge').forEach(b => b.remove());

  const meta = STATUS_META[status] ?? STATUS_META[PlayerStatus.AVAILABLE];

  if (meta.label) {
    const badge = document.createElement('span');
    badge.className = `player-status-badge ${meta.cls}`;
    badge.textContent = meta.label;
    card.appendChild(badge);
  }

  /* Temporary effect badges */
  const effects = getPlayerEffects(side, idx);
  effects.forEach(e => {
    const b = document.createElement('span');
    b.className = `player-effect-badge ${e.kind === 'debuff' ? 'effect-debuff' : 'effect-buff'}`;
    b.textContent = e.label;
    card.appendChild(b);
  });

  card.classList.toggle('player-unavailable', meta.dim);
  card.classList.toggle('player-prone',   status === PlayerStatus.PRONE);
  card.classList.toggle('player-stunned', status === PlayerStatus.STUNNED);
  card.classList.toggle('player-buffed',  effects.length > 0);
}

/* ── Status cycle button (⚑ on each card) ── */

function attachStatusCycleBtn(side, idx, card) {
  if (card.querySelector('.status-cycle-btn')) return;   /* already attached */

  const btn = document.createElement('button');
  btn.type  = 'button';
  btn.className = 'status-cycle-btn';
  btn.title     = 'Set player status';
  btn.innerHTML = '⚑';
  btn.addEventListener('click', e => {
    e.stopPropagation();
    showStatusMenu(side, idx, card, btn);
  });
  card.appendChild(btn);
}

function showStatusMenu(side, idx, card, anchor) {
  /* Remove any existing menu */
  document.querySelectorAll('.status-menu').forEach(m => m.remove());

  const menu = document.createElement('div');
  menu.className = 'status-menu';

  STATUS_CYCLE.forEach(s => {
    const meta = STATUS_META[s];
    const item = document.createElement('button');
    item.type  = 'button';
    item.className = `status-menu-item ${meta.cls || ''}`;
    item.textContent = meta.label || 'Available';
    if (getPlayerStatus(side, idx) === s) item.classList.add('smitem-active');
    item.addEventListener('click', e => {
      e.stopPropagation();
      setPlayerStatus(side, idx, s);
      menu.remove();
    });
    menu.appendChild(item);
  });

  /* ── Apothecary: downgrade an injury one step (a "roll" removes the condition) ── */
  const APOTH_DOWNGRADE = {
    [PlayerStatus.DEAD]:       PlayerStatus.BADLY_HURT,
    [PlayerStatus.BADLY_HURT]: PlayerStatus.KO,
    [PlayerStatus.KO]:         PlayerStatus.AVAILABLE,
  };
  const curStatus = getPlayerStatus(side, idx);
  if (APOTH_DOWNGRADE[curStatus]) {
    const apoth = document.createElement('button');
    apoth.type = 'button';
    apoth.className = 'status-menu-item smitem-apoth';
    apoth.innerHTML = '🩹 Apothecary';
    apoth.title = 'Patch up — downgrade this injury one step';
    apoth.addEventListener('click', e => {
      e.stopPropagation();
      setPlayerStatus(side, idx, APOTH_DOWNGRADE[curStatus]);
      menu.remove();
    });
    menu.appendChild(apoth);
  }

  /* ── Effects (buffs / debuffs) section ── */
  const sep = document.createElement('div');
  sep.className = 'status-menu-sep';
  sep.textContent = 'Effects';
  menu.appendChild(sep);

  /* Currently-applied effects, each removable */
  getPlayerEffects(side, idx).forEach(eff => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `status-menu-item smitem-effect ${eff.kind === 'debuff' ? 'effect-debuff' : 'effect-buff'}`;
    row.innerHTML = `<span>${eff.label}</span><span class="smitem-x">×</span>`;
    row.title = 'Remove effect';
    row.addEventListener('click', e => {
      e.stopPropagation();
      removePlayerEffect(side, idx, eff.id);
      showStatusMenu(side, idx, card, anchor);   /* re-render menu in place */
    });
    menu.appendChild(row);
  });

  /* Preset buff/debuff buttons */
  const presetWrap = document.createElement('div');
  presetWrap.className = 'status-menu-presets';
  STATUS_EFFECT_PRESETS.forEach(preset => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `status-preset-btn ${preset.kind === 'debuff' ? 'effect-debuff' : 'effect-buff'}`;
    b.textContent = preset.label;
    b.addEventListener('click', e => {
      e.stopPropagation();
      addPlayerEffect(side, idx, {
        id:        `manual-${preset.label}`,
        label:     preset.label,
        kind:      preset.kind,
        statMods:  preset.statMods ?? {},
        grantsSkill: preset.grantsSkill,
        removeOn:  'untilRoll',
        source:    'manual',
      });
      showStatusMenu(side, idx, card, anchor);
    });
    presetWrap.appendChild(b);
  });
  menu.appendChild(presetWrap);

  /* Position below anchor */
  card.style.position = 'relative';
  card.appendChild(menu);

  /* Close on outside click */
  setTimeout(() => {
    const closeMenu = e => {
      if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', closeMenu); }
    };
    document.addEventListener('click', closeMenu);
  }, 10);
}

/* ── Watch rosters for new cards ── */

function watchRosters() {
  ['left', 'right'].forEach(side => {
    const rosterEl = document.getElementById(`roster-${side}`);
    if (!rosterEl) return;

    const attach = () => {
      rosterEl.querySelectorAll('.player-card').forEach((card, idx) => {
        attachStatusCycleBtn(side, idx, card);
      });
      /* Re-apply any saved conditions for this newly-rendered roster. */
      rehydrateSide(side);
    };

    const obs = new MutationObserver(attach);
    obs.observe(rosterEl, { childList: true, subtree: false });
    attach();   /* attach to any cards already present */
  });
}

/* ────────────────────────────────────────────────────────
   PLAYER LIST — for wizards
   ──────────────────────────────────────────────────────── */

/**
 * Returns an array of { idx, name, pos, status, statsText, card }
 * for all players in a loaded roster.
 */
function getPlayerList(side) {
  const sideKey = side === 'left' ? 'left' : 'right';
  const cards   = document.querySelectorAll(`#roster-${sideKey} .player-card`);
  return Array.from(cards).map((card, idx) => ({
    idx,
    id:         card.querySelector('.card-num')?.textContent?.replace('#', '').trim() ?? String(idx + 1),
    name:       card.querySelector('.player-name')?.textContent?.trim() ?? `#${idx + 1}`,
    pos:        card.querySelector('.player-pos')?.textContent?.trim()  ?? '',
    statsText:  card.querySelector('.card-stats')?.textContent?.trim()  ?? '',
    status:     getPlayerStatus(sideKey, idx),
    effects:    getPlayerEffects(sideKey, idx),
    savedId:    card._playerData?.savedId ?? card._playerData?.id ?? null,
    playerData: card._playerData ?? null,
    card,
  }));
}

window.getPlayerList = getPlayerList;

/* ────────────────────────────────────────────────────────
   KO RECOVERY  (start of each drive / half)
   ──────────────────────────────────────────────────────── */

/* Compact prompt: one row per KO'd player, roll D6, 4+ returns to play. */
function runKoRecovery() {
  const koList = [];
  ['left', 'right'].forEach(side => {
    (getPlayerList(side) || []).forEach(p => {
      if (p.status === PlayerStatus.KO) koList.push({ side, idx: p.idx, name: p.name, id: p.id });
    });
  });
  if (!koList.length) return;

  document.getElementById('bb-recovery-backdrop')?.remove();
  const back = document.createElement('div');
  back.id = 'bb-recovery-backdrop';
  back.className = 'bb-recovery-backdrop';

  const modal = document.createElement('div');
  modal.className = 'bb-recovery-modal';
  modal.innerHTML =
    '<h2 class="bb-recovery-title">KO Recovery</h2>' +
    '<p class="bb-recovery-sub">Roll a D6 for each knocked-out player — 4+ returns them to play.</p>';

  koList.forEach(ko => {
    const row = document.createElement('div');
    row.className = 'bb-recovery-row';
    row.innerHTML = `<span class="bb-recovery-name">${ko.side === 'left' ? 'H' : 'A'} · #${ko.id} ${ko.name}</span>`;
    const res  = document.createElement('span');
    res.className = 'bb-recovery-res';
    const roll = document.createElement('button');
    roll.type = 'button';
    roll.className = 'bb-recovery-roll';
    roll.textContent = 'Roll';
    roll.addEventListener('click', () => {
      const d = Math.floor(Math.random() * 6) + 1;
      roll.disabled = true;
      if (d >= 4) {
        res.textContent = `${d} · Recovers`;
        res.classList.add('ok');
        setPlayerStatus(ko.side, ko.idx, PlayerStatus.AVAILABLE);
      } else {
        res.textContent = `${d} · Stays KO`;
        res.classList.add('bad');
      }
    });
    row.appendChild(res);
    row.appendChild(roll);
    modal.appendChild(row);
  });

  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'bb-recovery-done';
  done.textContent = 'Done';
  done.addEventListener('click', () => back.remove());
  modal.appendChild(done);

  back.appendChild(modal);
  back.addEventListener('click', e => { if (e.target === back) back.remove(); });
  document.body.appendChild(back);
}
window.runKoRecovery = runKoRecovery;

/* Drive/half transitions: expire scoped effects, then offer KO recovery. */
document.addEventListener('bb:phase', e => {
  const phase = e.detail?.phase;
  if (phase === GamePhase.DRIVE) {
    clearEffectsByPhase('left', 'drive'); clearEffectsByPhase('right', 'drive');
    runKoRecovery();
  } else if (phase === GamePhase.HALF_TIME) {
    clearEffectsByPhase('left', 'half'); clearEffectsByPhase('right', 'half');
    runKoRecovery();
  }
});

/* ────────────────────────────────────────────────────────
   PERSISTENCE  (statuses + effects survive reload)
   Keyed per matchup; guarded by a roster signature so a
   re-ordered / different roster never mis-applies old state.
   ──────────────────────────────────────────────────────── */

const GS_PERSIST_PREFIX = 'bb:gameState:v1:';

function _matchKey() {
  const ids = GameState.activeTeamIds || {};
  const key = [ids.home, ids.away].filter(Boolean).join('_');
  return GS_PERSIST_PREFIX + (key || 'default');
}

/* count + names per side — discard saved state if the live roster differs. */
function _rosterSig(side) {
  const list = getPlayerList(side) || [];
  return { count: list.length, names: list.map(p => p.name).join('|') };
}

let _persistTimer = null;
function persistGameState() {
  clearTimeout(_persistTimer);
  _persistTimer = setTimeout(() => {
    try {
      /* Never persist before any roster is loaded — an empty snapshot
         (empty sig) would clobber the real save during page boot. */
      if (!(getPlayerList('left')?.length || getPlayerList('right')?.length)) return;
      const payload = {
        v: 1,
        statuses: GameState.playerStatuses,
        effects:  GameState.playerEffects,
        turns:    GameState.turnFlags,
        half:     GameState.half,
        phase:    GameState.phase,
        sig:      { left: _rosterSig('left'), right: _rosterSig('right') },
      };
      localStorage.setItem(_matchKey(), JSON.stringify(payload));
    } catch (_) { /* storage full / private mode — skip */ }
  }, 250);
}
window.persistGameState = persistGameState;

/* Apply saved state for one side if its roster signature still matches. */
function rehydrateSide(side) {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(_matchKey()) || 'null'); } catch (_) { saved = null; }
  if (!saved || saved.v !== 1) return;
  const sig = _rosterSig(side);
  const savedSig = saved.sig?.[side];
  if (!savedSig || savedSig.count !== sig.count || savedSig.names !== sig.names) return; /* discard */

  const statuses = saved.statuses?.[side] || {};
  const effects  = saved.effects?.[side]  || {};
  GameState.playerEffects[side] = effects;
  GameState.turnFlags[side]     = saved.turns?.[side] || {};
  Object.keys(statuses).forEach(idx => {
    GameState.playerStatuses[side][idx] = statuses[idx];
  });
  /* Re-render every card for this side so badges/dim/effects show. */
  (getPlayerList(side) || []).forEach(p =>
    refreshPlayerCard(side, p.idx, getPlayerStatus(side, p.idx)));
}
window.rehydrateSide = rehydrateSide;

/* Wipe all in-game conditions for the current match (explicit reset). */
function clearGameState() {
  GameState.playerStatuses = { left: {}, right: {} };
  GameState.playerEffects  = { left: {}, right: {} };
  GameState.turnFlags      = { left: {}, right: {} };
  try { localStorage.removeItem(_matchKey()); } catch (_) {}
  ['left', 'right'].forEach(side =>
    (getPlayerList(side) || []).forEach(p =>
      refreshPlayerCard(side, p.idx, PlayerStatus.AVAILABLE)));
}
window.clearGameState = clearGameState;

/* Save whenever conditions or phase change. */
document.addEventListener('bb:playerStatus', persistGameState);
document.addEventListener('bb:playerEffect', persistGameState);
document.addEventListener('bb:phase',        persistGameState);
document.addEventListener('bb:playerActed',  persistGameState);
document.addEventListener('bb:turnEnd',      persistGameState);

/* ────────────────────────────────────────────────────────
   BOOT
   ──────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  buildTimeline();
  updateModuleAvailability();
  watchRosters();

  document.getElementById('timeline-next-btn')
    ?.addEventListener('click', advancePhase);
});
