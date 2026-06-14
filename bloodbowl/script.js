'use strict';

/* ═══════════════════════════════════════════════════════
   Blood Bowl Match Reference — script.js

   Architecture overview
   ─────────────────────
   • state.teams   : registry loaded from data/teams.json
   • state.skills  : map (lowercased name → entry) from data/skills.json
   • state.left/right : active team + player list for each side

   Modal strategy
   ──────────────
   Each side owns a <div class="modal-overlay"> that lives in its DOM
   subtree, so it inherits the side's --tc-* CSS custom properties even
   though the overlay uses position:absolute anchored to .bb-field.
   Both modals can be open at the same time.

   Skill tooltip
   ─────────────
   #skill-overlay is a transparent, pointer-events:none fixed wrapper.
   #skill-card inside it is positioned by JS directly above (or below)
   whatever .skill-link was clicked or hovered — on roster cards AND on
   trading cards. No page dimming. Escape closes the tooltip first, then
   trading cards. Clicking/hovering anywhere outside closes the tooltip.
   ═══════════════════════════════════════════════════════ */

const STAT_KEYS = ['ma', 'st', 'ag', 'pa', 'av'];

/* Removes app-loading veil once both script.js and panels.js have finished init */
function bbSignalReady() {
  window._bbReadyCount = (window._bbReadyCount || 0) + 1;
  if (window._bbReadyCount >= 2) document.body.classList.remove('app-loading');
}
window.bbSignalReady = bbSignalReady;

/* Position-colour map for the image placeholder background */
const POSITION_COLORS = {
  'Star Player': '#8B6914',
  'Blitzer':     '#7A1A1A',
  'Thrower':     '#1A3A7A',
  'Bodyguard':   '#3D1A7A',
  'Lineman':     '#1A5A2A',
  'Catcher':     '#7A4A1A',
};

const state = {
  teams:  [],   // array from teams.json
  skills: {},   // { 'block': { name, category, description }, … }
  left:   { team: null, players: [] },
  right:  { team: null, players: [] },
};
/* Expose for embedded card rendering in wizards */
window.state            = state;

/* ────────────────────────────────────────────────────────
   SELECTED-TEAM REGISTRY  (handoff to the /game page)
   Records which team each side loaded — { kind:'default'|'custom', id } —
   mirrored to localStorage so New Game can write bb:activeMatch and the
   game page can reconstruct the exact same two teams.
   ──────────────────────────────────────────────────────── */
const BB_SELECTED_KEY = 'bb:selectedSides';
function _readSelected() {
  try { return JSON.parse(localStorage.getItem(BB_SELECTED_KEY) || '{}'); } catch { return {}; }
}
function recordSelectedSide(side, kind, id) {
  const sel = _readSelected();
  sel[side] = { kind, id };
  try { localStorage.setItem(BB_SELECTED_KEY, JSON.stringify(sel)); } catch (_) {}
}
function getSelectedSides() { return _readSelected(); }
window.getSelectedSides = getSelectedSides;

/* Reconstruct one side from a { kind, id } record (used by the game page). */
function reconstructSide(side, sel) {
  if (!sel || !sel.id) return Promise.resolve(false);
  if (sel.kind === 'custom' && window.TeamBuilder?.loadIntoGame) {
    return Promise.resolve(window.TeamBuilder.loadIntoGame(sel.id, side)).then(() => true);
  }
  return Promise.resolve(loadTeam(side, sel.id)).then(() => true);
}
window.reconstructSide = reconstructSide;
window.POSITION_COLORS  = POSITION_COLORS;

/* Timers for skill-link hover/close grace period */
let hoverTimer = null;
let closeTimer  = null;
/* A click-opened popup is "pinned": mouse-away no longer closes it — only a
   click outside (or Escape) does. Hover-opened popups are never pinned. */
let pinned = false;

/* ────────────────────────────────────────────────────────
   INIT
   ──────────────────────────────────────────────────────── */
async function init() {
  try {
    const [teams, skillsList] = await Promise.all([
      fetchJSON('data/teams.json'),
      fetchJSON('data/skills.json'),
    ]);

    state.teams  = teams;
    /* Index skills by lower-case name for O(1) lookup */
    state.skills = Object.fromEntries(
      skillsList.map(s => [s.name.toLowerCase(), s])
    );

    /* Expose teams data for TeamBuilder and DriveWizard */
    window.BBTeamsData = teams;
    /* Expose full skills list for SPP level-up picker */
    window.BBSkillsList = skillsList;

    bindChooseButtons();
    bindGlobalListeners();
    bindMyTeamsButtons();
    updateStartGameGlow();
  } catch (err) {
    console.error('[BB] Init failed:', err);
  } finally {
    bbSignalReady();
    /* Signal that team/skill data is loaded so the game page can reconstruct. */
    window.__bbAppReady = true;
    document.dispatchEvent(new CustomEvent('bb:appReady'));
  }
}

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${url}`);
  return r.json();
}

/* ────────────────────────────────────────────────────────
   TEAM SELECTION
   ──────────────────────────────────────────────────────── */
/* Which side the Choose Team window is currently picking for. */
let chooseSide = 'left';

function bindChooseButtons() {
  ['left', 'right'].forEach(side => {
    document.getElementById(`choose-${side}`)
      ?.addEventListener('click', () => openChooseTeam(side));
  });
}

/* Right pane mode: 'browse' (default teams grid) | 'builder' (Team Builder form) */
let ctMode = 'browse';

function openChooseTeam(side) {
  chooseSide = side;
  ctMode = 'browse';
  buildChooseTeamPanel();
  window.Panels?.togglePanel('chooseteam');
}
window.openChooseTeam = openChooseTeam;

/* Open the Team Builder inside the Choose Team window's right pane.
   teamId === null → new team; otherwise edit the saved team. */
function showTeamBuilder(teamId = null) {
  ctMode = 'builder';
  const panel = document.getElementById('panel-chooseteam');
  if (panel && panel.hasAttribute('hidden')) window.Panels?.openPanel('chooseteam');
  buildChooseTeamPanel(teamId);
}
window.showTeamBuilder = showTeamBuilder;

/* Refresh the "Choose Home/Away Team" button label after a pick. */
function updateChooseBtn(side, name, accent) {
  const btn = document.getElementById(`choose-${side}`);
  if (!btn) return;
  btn.textContent = name || (side === 'left' ? 'Choose Home Team' : 'Choose Away Team');
  btn.classList.toggle('has-team', !!name);
  btn.style.setProperty('--gb-team-accent', accent || '');
}

function buildChooseTeamPanel(teamId = null) {
  buildMyTeamsColumn();

  const title = document.getElementById('ct-right-title');
  const body  = document.getElementById('ct-right-body');
  if (!body) return;

  if (ctMode === 'builder') {
    if (title) title.textContent = teamId ? 'Edit Team' : 'Team Builder';
    body.className = 'ct-col-body ct-builder-body';
    body.innerHTML = '';
    window.TeamBuilder?.renderBuilderInto(body, {
      teamId,
      onDone: () => { ctMode = 'browse'; buildChooseTeamPanel(); },
    });
    return;
  }

  /* ── Browse mode: default teams, alphabetical, skills-card styling ── */
  if (title) title.textContent = 'Choose Team';
  body.className = 'ct-col-body ct-grid';
  body.innerHTML = '';
  const teams = [...state.teams].sort((a, b) => a.name.localeCompare(b.name));
  teams.forEach(team => {
    const accent = team.colors?.accent || team.colors?.gold || 'rgba(255,255,255,0.3)';
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'ct-card';
    card.style.setProperty('--card-color', accent);
    card.innerHTML = `<span class="ct-card-name">${esc(team.name)}</span>`;
    card.addEventListener('click', async () => {
      closeModal(chooseSide);
      await loadTeam(chooseSide, team.id);
      window.Panels?.closePanel('chooseteam');
    });
    body.appendChild(card);
  });
}

/* Left 1/3 — Create New Team blueprint + saved teams (one column) */
function buildMyTeamsColumn() {
  const mine = document.getElementById('ct-myteams-grid');
  if (!mine) return;
  mine.innerHTML = '';

  const create = document.createElement('button');
  create.type = 'button';
  create.className = 'ct-card ct-card--blueprint';
  create.innerHTML = '<span class="ct-card-name">+ Create New Team</span>';
  create.addEventListener('click', () => showTeamBuilder(null));
  mine.appendChild(create);

  const saved = window.TeamBuilder?.getTeams?.() ?? [];
  if (saved.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'ct-empty';
    empty.textContent = 'No saved teams yet. Create one to set its colours, roster, and skills.';
    mine.appendChild(empty);
    return;
  }
  saved.forEach(team => {
    const accent = team.colors?.accent || 'rgba(150,180,255,0.6)';
    const card = document.createElement('div');
    card.className = 'ct-card ct-card--myteam';
    card.style.setProperty('--card-color', accent);
    card.innerHTML = `
      <span class="ct-card-name">${esc(team.name)}</span>
      <span class="ct-card-meta">${team.players.length}pl · ${team.rerolls}RR</span>
      <button class="ct-card-edit" type="button" title="Edit team" aria-label="Edit ${esc(team.name)}">✏</button>`;
    card.addEventListener('click', async () => {
      closeModal(chooseSide);
      await window.TeamBuilder?.loadIntoGame(team.id, chooseSide);
      window.Panels?.closePanel('chooseteam');
    });
    card.querySelector('.ct-card-edit').addEventListener('click', e => {
      e.stopPropagation();
      showTeamBuilder(team.id);
    });
    mine.appendChild(card);
  });
}

async function loadTeam(side, teamId) {
  const team = state.teams.find(t => t.id === teamId);
  if (!team) return;

  try {
    const players = await fetchJSON(team.fullTeam ?? team.file);
    state[side].team    = team;
    state[side].players = players;
    recordSelectedSide(side, 'default', team.id);
    applyTeamColors(side, team.colors);
    renderRoster(side, players);
    syncTeamSkills(side, players, team.name);

    /* Update companion UI */
    if (window.Panels) {
      Panels.openAccordion(side);
      Panels.setAccordionLabel(side, team.name);
      Panels.setAccordionValue(side,
        team.build?.totalGold ?? players.reduce((s, p) => s + (p.value || 0), 0));
      /* Default 3 re-rolls — will be team-builder-driven in Phase 4 */
      Panels.setRerolls(side === 'left' ? 'home' : 'away', 3);
    }
    updateChooseBtn(side, team.name, team.colors?.accent);
    updateStartGameGlow();
  } catch (err) {
    console.error(`[BB] Failed to load team "${teamId}":`, err);
  }
}

/* ────────────────────────────────────────────────────────
   CUSTOM TEAM LOADING (from TeamBuilder saved teams)
   ──────────────────────────────────────────────────────── */

async function loadCustomTeam(side, savedTeam) {
  /* Find the base team entry for colors */
  const baseEntry = state.teams.find(t => t.id === savedTeam.baseTeamId);

  /* Build player objects in the same shape renderRoster expects */
  const players = savedTeam.players.map((p, i) => ({
    id:          p.jerseyNumber ?? p.rosterSlotId ?? (i + 1),
    savedId:     p.id,     /* UUID for SPP tracking */
    name:        p.name,
    position:    p.position,
    ma:          p.ma, st: p.st, ag: p.ag, pa: p.pa, av: p.av,
    skills:      [p.skills, ...(p.learnedSkills ?? [])].filter(Boolean).join(', '),
    value:       p.value ?? 0,
    qty:         null,
    jerseyNumber: p.jerseyNumber,
    fact:        p.fact ?? '',
    isStarPlayer: !!p.isStarPlayer,
    photo:       p.photo,
  }));

  state[side].team    = baseEntry ?? { id: savedTeam.baseTeamId, name: savedTeam.name, colors: {} };
  state[side].players = players;
  recordSelectedSide(side, 'custom', savedTeam.id);

  /* Saved-team accent overrides the base race colour where set. */
  const customColors = { ...(baseEntry?.colors ?? {}), ...(savedTeam.colors ?? {}) };
  applyTeamColors(side, customColors);
  renderRoster(side, players);
  syncTeamSkills(side, players, savedTeam.name);

  /* Track which saved team is loaded for SPP/post-game */
  const gbSide = side === 'left' ? 'home' : 'away';
  if (window.GameState) window.GameState.activeTeamIds[gbSide] = savedTeam.id;

  /* Sync companion UI with saved team data */
  if (window.Panels) {
    Panels.openAccordion(side);
    Panels.setAccordionLabel(side, savedTeam.name);
    Panels.setAccordionValue(side, players.reduce((s, p) => s + (p.value || 0), 0));
    Panels.setRerolls(gbSide, savedTeam.rerolls ?? 0);
  }
  updateChooseBtn(side, savedTeam.name, customColors.accent);
  updateStartGameGlow();
}

window.loadCustomTeam = loadCustomTeam;

/* Start Game button pulses gold once both teams are selected. */
function updateStartGameGlow() {
  const btn = document.getElementById('gb-start-btn');
  if (!btn) return;
  btn.classList.toggle('glow-gold', !!(state.left.team && state.right.team));
}

function bindMyTeamsButtons() {
  ['left', 'right'].forEach(side => {
    document.getElementById(`my-teams-${side}`)
      ?.addEventListener('click', () => window.TeamBuilder?.openPicker(side));
  });
  document.getElementById('my-teams-nav')
    ?.addEventListener('click', () => openChooseTeam('left'));
}

/* ────────────────────────────────────────────────────────
   TEAM SKILLS → localStorage  (consumed by skills page)
   ──────────────────────────────────────────────────────── */

function syncTeamSkills(side, players, teamName) {
  const gbSide = side === 'left' ? 'home' : 'away';
  const skillSet = new Set();
  players.forEach(p => {
    (p.skills || '').split(',').forEach(s => {
      const trimmed = s.trim();
      /* Strip parenthetical variants like "Loner (3+)" → "Loner" */
      const base = trimmed.replace(/\s*\(.*\)$/, '').trim();
      if (base) skillSet.add(base);
    });
  });
  try {
    localStorage.setItem(`bb_${gbSide}_team_name`,   teamName);
    localStorage.setItem(`bb_${gbSide}_team_skills`,  JSON.stringify([...skillSet]));
  } catch (_) { /* private-browsing or storage full — silently skip */ }
}

function clearSide(side) {
  state[side].team    = null;
  state[side].players = [];

  /* Clear localStorage team skills for this side */
  const gbSide = side === 'left' ? 'home' : 'away';
  try {
    localStorage.removeItem(`bb_${gbSide}_team_name`);
    localStorage.removeItem(`bb_${gbSide}_team_skills`);
  } catch (_) {}

  /* Remove all inline --tc-* overrides from roster accordion AND modal */
  document.getElementById(`side-${side}`)?.removeAttribute('style');
  document.getElementById(`modal-${side}`)?.removeAttribute('style');
  document.getElementById(`roster-${side}`).innerHTML =
    '<p class="empty-state">Select a team to load the roster.</p>';

  /* Reset companion UI */
  if (window.Panels) {
    Panels.setAccordionLabel(side, null);
    Panels.setAccordionValue(side, null);
    Panels.setRerolls(gbSide, 0);
  }
  updateChooseBtn(side, null);
  updateStartGameGlow();
}

/* ────────────────────────────────────────────────────────
   TEAM COLOUR THEMING
   CSS custom properties are set on both the .roster-accordion
   (id="side-{side}") and the trading-card modal overlay
   (id="modal-{side}", now position:fixed outside the accordion).
   Custom properties follow DOM ancestry, so the fixed modal
   needs the properties applied directly to inherit them.
   ──────────────────────────────────────────────────────── */
const COLOR_PROP_MAP = {
  bg:          '--tc-bg',
  primary:     '--tc-primary',
  primaryDark: '--tc-primary-dark',
  accent:      '--tc-accent',
  gold:        '--tc-gold',
  goldDark:    '--tc-gold-dark',
  headerBg:    '--tc-header-bg',
};

function applyTeamColors(side, colors) {
  /* Apply to roster accordion AND modal overlay */
  const targets = [
    document.getElementById(`side-${side}`),
    document.getElementById(`modal-${side}`),
  ];
  targets.forEach(el => {
    if (!el) return;
    Object.entries(COLOR_PROP_MAP).forEach(([key, prop]) => {
      if (colors[key] !== undefined) el.style.setProperty(prop, colors[key]);
    });
  });
}

/* ────────────────────────────────────────────────────────
   ROSTER RENDERING
   ──────────────────────────────────────────────────────── */
function renderRoster(side, players) {
  const grid = document.getElementById(`roster-${side}`);
  const frag = document.createDocumentFragment();
  players.forEach((p, i) => frag.appendChild(buildCard(p, side, i)));
  grid.innerHTML = '';
  grid.appendChild(frag);
}

function buildCard(player, side, idx) {
  const card = document.createElement('div');
  card.className = 'player-card' + (player.isStarPlayer ? ' star-player' : '');
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'listitem');
  card.setAttribute('aria-label', `View ${player.name} — ${player.position}`);

  /* Single-line layout: num · name · pos | MA7 · ST3 · AG3+ · PA4+ · AV9+ | skills */
  const statsStr = STAT_KEYS.map(s =>
    `<span class="ss">${s.toUpperCase()}</span>${esc(String(player[s]))}`
  ).join('<span class="sd" aria-hidden="true"> · </span>');

  /* For canonical roster templates, name === position — show qty instead */
  const posDisplay = (player.qty && player.name === player.position)
    ? player.qty
    : player.position;

  card.innerHTML = `
    <span class="card-num">#${player.id}</span>
    <span class="player-name">${esc(player.name)}</span>
    <span class="cd" aria-hidden="true">·</span>
    <span class="player-pos">${esc(posDisplay)}</span>
    ${player.isStarPlayer ? '<span class="star-badge">&#9733; Star</span>' : ''}
    <span class="cd" aria-hidden="true">|</span>
    <span class="card-stats" aria-label="Stats">${statsStr}</span>
    <span class="cd" aria-hidden="true">|</span>
    <span class="card-skills">${renderSkillLinks(player.skills)}</span>
    ${player.value
      ? `<span class="card-value">${Math.round(player.value / 1000)}k gp</span>`
      : ''}
  `;

  /* Store full player data on the DOM element so wizards can access it */
  card._playerData = player;

  if (player.isStarPlayer) applyHolo(card, false);

  card.addEventListener('click', () => openModal(side, player, idx));
  card.addEventListener('keydown', e => {
    if (e.target.closest('.skill-link')) return; /* skill-link handles its own activation */
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openModal(side, player, idx);
    }
  });

  /* Skill links in roster card: hover shows tooltip, click stops propagation
     so the card's own click handler (open modal) doesn't also fire. */
  attachSkillEvents(card, true);

  return card;
}

/* ────────────────────────────────────────────────────────
   HOLOGRAPHIC STAR CARDS
   Adds the `holo` class and feeds cursor position (--mx/--my)
   plus tilt (--rx/--ry) to the CSS in style.css. Idempotent:
   listeners bind once per element, so the reused modal card can
   be toggled on/off as different players open.
   ──────────────────────────────────────────────────────── */
function applyHolo(el, tilt) {
  el.classList.add('holo');
  el._holoTilt = !!tilt;
  if (el._holoBound) return;
  el._holoBound = true;
  const MAX = 10; /* max tilt in degrees */

  el.addEventListener('pointermove', e => {
    if (!el.classList.contains('holo')) return;
    const r  = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top)  / r.height;
    el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
    el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
    if (el._holoTilt) {
      el.style.setProperty('--ry', `${((px - 0.5) * 2 * MAX).toFixed(2)}deg`);
      el.style.setProperty('--rx', `${(-(py - 0.5) * 2 * MAX).toFixed(2)}deg`);
    }
    el.classList.add('holo-active');
  });

  el.addEventListener('pointerleave', () => {
    el.classList.remove('holo-active');
    el.style.setProperty('--mx', '50%');
    el.style.setProperty('--my', '50%');
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  });
}

function clearHolo(el) {
  el.classList.remove('holo', 'holo-active');
}
window.applyHolo = applyHolo;
window.clearHolo = clearHolo;

/* ────────────────────────────────────────────────────────
   TRADING CARD MODAL
   ──────────────────────────────────────────────────────── */
function openModal(side, player, idx) {
  const overlay = document.getElementById(`modal-${side}`);
  const card    = document.getElementById(`card-${side}`);
  const team    = state[side].team;
  const isStar  = player.isStarPlayer;
  const imgDir  = team?.imageDir ?? 'images/';

  card.className = 'trading-card' + (isStar ? ' star-card' : '');
  if (isStar) applyHolo(card, true); else clearHolo(card);

  /* Shared trading-card markup (js/player-card.js) + live status banner */
  card.innerHTML = window.PlayerCard.html(player, {
    imageDir:   imgDir,
    statusHTML: window.PlayerCard.statusHTML(side, idx),
  });
  window.PlayerCard.bindImage(card);
  window.PlayerCard.applyStatusClasses(card, side, idx);

  /* Skill links in trading card: hover + click open the anchored tooltip.
     No stopPropagation needed — modal backdrop only closes on e.target===overlay. */
  attachSkillEvents(card, false);

  overlay.removeAttribute('hidden');
  requestAnimationFrame(() => overlay.classList.add('active'));
  card.scrollTop = 0;
}

function closeModal(side) {
  const overlay = document.getElementById(`modal-${side}`);
  if (!overlay || overlay.hasAttribute('hidden')) return;
  overlay.classList.remove('active');
  overlay.addEventListener(
    'transitionend',
    () => overlay.setAttribute('hidden', ''),
    { once: true }
  );
}

/* ────────────────────────────────────────────────────────
   SKILL LINKS  — used in roster cards and trading cards
   ──────────────────────────────────────────────────────── */
function renderSkillLinks(skillsStr) {
  const skills = (skillsStr || '').split(', ').map(s => s.trim()).filter(Boolean);
  if (!skills.length) return '<span class="no-skills">—</span>';
  return skills
    .map(name => `<button class="skill-link" data-skill="${esc(name)}">${esc(name)}</button>`)
    .join('<span class="skill-sep">, </span>');
}

/* Attach hover + click listeners to every .skill-link inside container.
   stopClick = true  → e.stopPropagation() on click (prevents roster card's
                        own click handler from opening the trading card modal).
   stopClick = false → let clicks bubble (safe in trading card: backdrop only
                        closes when e.target === the overlay element itself). */
function attachSkillEvents(container, stopClick) {
  container.querySelectorAll('.skill-link').forEach(btn => {
    const name = btn.dataset.skill;

    btn.addEventListener('mouseenter', () => {
      cancelClose();
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => { pinned = false; openSkillPopup(name, btn); }, 160);
    });

    btn.addEventListener('mouseleave', () => {
      clearTimeout(hoverTimer);
      scheduleClose();
    });

    btn.addEventListener('click', e => {
      if (stopClick) e.stopPropagation();
      clearTimeout(hoverTimer);
      clearTimeout(closeTimer);
      pinned = true;
      openSkillPopup(name, btn);
    });
  });
}

/* ── Shared skill card builder — returns a DOM <article class="sk-card"> ──
   compact=true  → name + badge only (for trading cards, tight spaces)
   extraClass    → additional class string (e.g. 'sk-card--active' for glow) */
const SKILL_COLORS = {
  'General Skill': '#2563EB', 'Agility Skill':     '#059669',
  'Passing Skill': '#D4AF37', 'Strength Skill':    '#C8102E',
  'Mutation':      '#7C3AED', 'Devious Skill':     '#B45309',
  'Trait':         '#0891B2', 'Star Player Trait': '#D4AF37',
};
const SKILL_BADGE = {
  'General Skill': 'General', 'Agility Skill':     'Agility',
  'Passing Skill': 'Passing', 'Strength Skill':    'Strength',
  'Mutation':      'Mutation','Devious Skill':      'Devious',
  'Trait':         'Trait',   'Star Player Trait': 'Star Player',
};

function buildSkillCard(name, { compact = false, extraClass = '' } = {}) {
  const entry = window.lookupSkill ? window.lookupSkill(name) : null;
  const color = (entry?.category && SKILL_COLORS[entry.category]) || 'rgba(255,255,255,0.3)';
  const badge = (entry?.category && SKILL_BADGE[entry.category]) || entry?.category || '';

  const card = document.createElement('article');
  card.className = 'sk-card' + (extraClass ? ' ' + extraClass : '');
  card.style.setProperty('--card-color', color);

  const header = document.createElement('div');
  header.className = 'sk-card-header';

  const nameBtn = document.createElement('button');
  nameBtn.className = 'skill-link sk-card-name';
  nameBtn.dataset.skill = name;
  nameBtn.textContent = name;
  header.appendChild(nameBtn);

  if (badge) {
    const badgeEl = document.createElement('span');
    badgeEl.className = 'sk-card-badge';
    badgeEl.textContent = badge;
    header.appendChild(badgeEl);
  }
  card.appendChild(header);

  if (!compact && entry?.description) {
    const desc = document.createElement('p');
    desc.className = 'sk-card-desc';
    desc.textContent = entry.description;
    card.appendChild(desc);
  }
  return card;
}

/* Expose for use in wizards */
window.attachSkillEvents  = attachSkillEvents;
window.renderSkillLinks   = renderSkillLinks;
window.buildSkillCard     = buildSkillCard;

function scheduleClose() {
  if (pinned) return;   /* a click-opened popup stays until an outside click */
  clearTimeout(closeTimer);
  closeTimer = setTimeout(closeSkillPopup, 220);
}

function cancelClose() {
  clearTimeout(closeTimer);
}

/* ────────────────────────────────────────────────────────
   SKILL TOOLTIP  — anchored above (or below) the trigger link
   ──────────────────────────────────────────────────────── */

/* Look up a skill entry by name.
   First tries an exact (case-insensitive) match.
   Falls back to stripping a trailing parenthetical so variable traits
   like "Loner (3+)", "Animosity (Orcs)", and "Bloodlust (2+)" all
   resolve to their base entry ("Loner", "Animosity", "Bloodlust"). */
function lookupSkill(skillName) {
  const key = skillName.toLowerCase();
  if (state.skills[key]) return state.skills[key];
  const base = key.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return state.skills[base] ?? null;
}

function openSkillPopup(skillName, anchorEl) {
  const overlay = document.getElementById('skill-overlay');
  const card    = document.getElementById('skill-card');
  const entry   = lookupSkill(skillName);
  const color   = (entry?.category && SKILL_COLORS[entry.category]) || 'rgba(255,255,255,0.3)';
  const badge   = (entry?.category && SKILL_BADGE[entry.category]) || entry?.category || '';

  /* Same markup as a bloodbowl/skills page card so the popup looks identical */
  card.innerHTML = `
    <article class="sk-card" style="--card-color:${color}">
      <div class="sk-card-header">
        <span class="sk-card-name">${esc(skillName)}</span>
        ${badge ? `<span class="sk-card-badge">${esc(badge)}</span>` : ''}
      </div>
      <p class="sk-card-desc">${entry
        ? esc(entry.description)
        : 'No description on file yet for this skill.'}</p>
    </article>
  `;

  overlay.removeAttribute('hidden');
  /* Position after the card is in the render tree so getBoundingClientRect works */
  requestAnimationFrame(() => positionSkillCard(card, anchorEl));
}

function positionSkillCard(card, anchor) {
  const ar  = anchor.getBoundingClientRect();
  const cr  = card.getBoundingClientRect();
  const vw  = window.innerWidth;
  const vh  = window.innerHeight;
  const GAP = 14;  /* px between card edge and anchor (includes arrow height) */

  /* Horizontal: centred on the anchor's midpoint, clamped to viewport */
  let left = ar.left + ar.width / 2 - cr.width / 2;
  left = Math.max(8, Math.min(left, vw - cr.width - 8));

  /* Vertical: prefer above; flip below if too close to top */
  let top = ar.top - cr.height - GAP;
  let arrowUp = false;
  if (top < 8) {
    top = ar.bottom + GAP;
    arrowUp = true;
  }
  top = Math.min(top, vh - cr.height - 8);

  /* Arrow X: points at the anchor's horizontal centre, clamped within card */
  const rawX   = ar.left + ar.width / 2 - left;
  const arrowX = Math.max(18, Math.min(rawX, cr.width - 18));

  card.style.left = `${left}px`;
  card.style.top  = `${top}px`;
  card.style.setProperty('--arrow-x', `${arrowX}px`);
  card.classList.toggle('arrow-up', arrowUp);
}

function closeSkillPopup() {
  const overlay = document.getElementById('skill-overlay');
  if (overlay.hasAttribute('hidden')) return;
  overlay.setAttribute('hidden', '');
  pinned = false;
}

/* ────────────────────────────────────────────────────────
   GLOBAL LISTENERS
   ──────────────────────────────────────────────────────── */
function bindGlobalListeners() {
  /* Backdrop clicks close their respective overlay */
  ['left', 'right'].forEach(side => {
    document.getElementById(`modal-${side}`)
      .addEventListener('click', function (e) {
        if (e.target === this) closeModal(side);
      });
  });

  /* Click anywhere outside the skill card (or a skill-link) closes the tooltip */
  document.addEventListener('click', e => {
    if (!e.target.closest('#skill-card, .skill-link')) closeSkillPopup();
  });

  /* Moving the mouse onto the tooltip itself cancels the grace-period close timer,
     so users can read the description without the card vanishing. */
  const skillCard = document.getElementById('skill-card');
  skillCard.addEventListener('mouseenter', cancelClose);
  skillCard.addEventListener('mouseleave', scheduleClose);

  /* Escape: close skill popup first; if none open, close trading cards */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const skillOpen = !document.getElementById('skill-overlay')
                               .hasAttribute('hidden');
    if (skillOpen) {
      closeSkillPopup();
    } else {
      closeModal('left');
      closeModal('right');
    }
  });
}

/* ────────────────────────────────────────────────────────
   UTILITIES
   ──────────────────────────────────────────────────────── */
function esc(str) {
  return String(str ?? '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

/* ─── GO ─── */
init();
