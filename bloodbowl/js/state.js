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
  rerolls:        { home: 0, away: 0 },
  rerollsTotal:   { home: 0, away: 0 },
  currentWeather: null,   /* set to a weather.json entry when weather is rolled */
  ballCarrier:    null,   /* { side: 'left'|'right', idx } — set when ball possession is tracked */
  kickingTeam:    null,   /* 'home' | 'away' — set by drive wizard */
  scores:         { home: 0, away: 0 },     /* mirrored from gbState by adjustScore() */
  sppEvents:      [],     /* [{ side, playerIdx, savedId, amount, reason, timestamp }] */
  activeTeamIds:  { home: null, away: null },  /* saved team UUIDs when custom teams loaded */
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

function refreshPlayerCard(side, idx, status) {
  const cards = document.querySelectorAll(`#roster-${side} .player-card`);
  const card  = cards[idx];
  if (!card) return;

  /* Remove old badge */
  card.querySelector('.player-status-badge')?.remove();

  const meta = STATUS_META[status] ?? STATUS_META[PlayerStatus.AVAILABLE];

  if (meta.label) {
    const badge = document.createElement('span');
    badge.className = `player-status-badge ${meta.cls}`;
    badge.textContent = meta.label;
    card.appendChild(badge);
  }

  card.classList.toggle('player-unavailable', meta.dim);
  card.classList.toggle('player-prone',   status === PlayerStatus.PRONE);
  card.classList.toggle('player-stunned', status === PlayerStatus.STUNNED);
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
    playerData: card._playerData ?? null,
    card,
  }));
}

window.getPlayerList = getPlayerList;

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
