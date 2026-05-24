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
   though the overlay uses position:fixed. Both modals can be open at
   the same time.

   Skill popup
   ───────────
   A single global overlay (#skill-overlay) sits above both trading-card
   modals (z-index 1000 vs 500). Clicking any .skill-link inside a
   trading card opens it. Escape closes skill popup first, then trading
   cards; clicking the backdrop closes only the topmost layer open.
   ═══════════════════════════════════════════════════════ */

const STAT_KEYS = ['ma', 'st', 'ag', 'pa', 'av'];

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

    populateSelects();
    bindSelectListeners();
    bindGlobalListeners();
  } catch (err) {
    console.error('[BB] Init failed:', err);
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
function populateSelects() {
  const opts = state.teams
    .map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`)
    .join('');

  ['left', 'right'].forEach(side => {
    document.getElementById(`select-${side}`).innerHTML =
      '<option value="">— Select a team —</option>' + opts;
  });
}

function bindSelectListeners() {
  ['left', 'right'].forEach(side => {
    document.getElementById(`select-${side}`)
      .addEventListener('change', async e => {
        const id = e.target.value;
        closeModal(side);          /* clear any open card first */
        if (id) await loadTeam(side, id);
        else        clearSide(side);
      });
  });
}

async function loadTeam(side, teamId) {
  const team = state.teams.find(t => t.id === teamId);
  if (!team) return;

  try {
    const players = await fetchJSON(team.file);
    state[side].team    = team;
    state[side].players = players;
    applyTeamColors(side, team.colors);
    renderRoster(side, players);
  } catch (err) {
    console.error(`[BB] Failed to load team "${teamId}":`, err);
  }
}

function clearSide(side) {
  state[side].team    = null;
  state[side].players = [];
  /* Remove all inline --tc-* overrides so defaults take effect */
  document.getElementById(`side-${side}`).removeAttribute('style');
  document.getElementById(`roster-${side}`).innerHTML =
    '<p class="empty-state">Select a team to load the roster.</p>';
}

/* ────────────────────────────────────────────────────────
   TEAM COLOUR THEMING
   CSS custom properties are set directly on the .bb-side element.
   Child elements (cards, modal, skill links) inherit them through
   the normal CSS cascade — even when position:fixed breaks visual
   containment — because custom properties follow DOM ancestry.
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
  const el = document.getElementById(`side-${side}`);
  Object.entries(COLOR_PROP_MAP).forEach(([key, prop]) => {
    if (colors[key] !== undefined) el.style.setProperty(prop, colors[key]);
  });
}

/* ────────────────────────────────────────────────────────
   ROSTER RENDERING
   ──────────────────────────────────────────────────────── */
function renderRoster(side, players) {
  const grid = document.getElementById(`roster-${side}`);
  const frag = document.createDocumentFragment();
  players.forEach(p => frag.appendChild(buildCard(p, side)));
  grid.innerHTML = '';
  grid.appendChild(frag);
}

function buildCard(player, side) {
  const card = document.createElement('div');
  card.className = 'player-card' + (player.isStarPlayer ? ' star-player' : '');
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'listitem');
  card.setAttribute('aria-label', `View ${player.name} — ${player.position}`);

  /* Single-line layout: num · name · pos | MA7 · ST3 · AG3+ · PA4+ · AV9+ | skills */
  const statsStr = STAT_KEYS.map(s =>
    `<span class="ss">${s.toUpperCase()}</span>${esc(String(player[s]))}`
  ).join('<span class="sd" aria-hidden="true"> · </span>');

  card.innerHTML = `
    <span class="card-num">#${player.id}</span>
    <span class="player-name">${esc(player.name)}</span>
    <span class="cd" aria-hidden="true">·</span>
    <span class="player-pos">${esc(player.position)}</span>
    ${player.isStarPlayer ? '<span class="star-badge">&#9733; Star</span>' : ''}
    <span class="cd" aria-hidden="true">|</span>
    <span class="card-stats" aria-label="Stats">${statsStr}</span>
    <span class="cd" aria-hidden="true">|</span>
    <span class="card-skills">${esc(player.skills)}</span>
    ${player.value
      ? `<span class="card-value">${Math.round(player.value / 1000)}k gp</span>`
      : ''}
  `;

  card.addEventListener('click', () => openModal(side, player));
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openModal(side, player);
    }
  });

  return card;
}

/* ────────────────────────────────────────────────────────
   TRADING CARD MODAL
   ──────────────────────────────────────────────────────── */
function openModal(side, player) {
  const overlay = document.getElementById(`modal-${side}`);
  const card    = document.getElementById(`card-${side}`);
  const team    = state[side].team;
  const isStar  = player.isStarPlayer;
  const bgColor = POSITION_COLORS[player.position] || '#555';
  const imgDir  = team?.imageDir ?? 'images/';

  card.className = 'trading-card' + (isStar ? ' star-card' : '');

  card.innerHTML = `
    <button class="modal-close" aria-label="Close player card">&#215;</button>

    <div class="modal-player-header${isStar ? ' star-header' : ''}">
      <span class="modal-jersey">#${player.id}</span>
      <h2 class="modal-name">${esc(player.name)}</h2>
      <p class="modal-position">
        ${esc(player.position)}${player.characteristic
          ? ` &middot; ${esc(player.characteristic)}`
          : ''}
      </p>
    </div>

    <div class="modal-image-area" style="background:${bgColor};">
      <img class="modal-img"
           src="${imgDir}Player${player.id}.png"
           alt="${esc(player.name)}">
      <span class="img-placeholder-num" aria-hidden="true">${player.id}</span>
    </div>

    <div class="modal-stats">
      <div class="modal-stats-row">
        ${STAT_KEYS.map(s => `
          <div class="modal-stat">
            <span class="ms-label">${s.toUpperCase()}</span>
            <span class="ms-value">${player[s]}</span>
          </div>`).join('')}
        ${player.value ? `
          <div class="modal-stat">
            <span class="ms-label">GP</span>
            <span class="ms-value" style="font-size:0.82rem;">
              ${Math.round(player.value / 1000)}k
            </span>
          </div>` : ''}
      </div>
    </div>

    <div class="modal-skills">
      <p class="skills-label">Skills &amp; Traits</p>
      <p class="skills-text">${renderSkillLinks(player.skills)}</p>
    </div>

    ${player.fact
      ? `<div class="modal-fact">&ldquo;${esc(player.fact)}&rdquo;</div>`
      : ''}
  `;

  /* Image: hide placeholder once real image loads; hide img tag on error */
  const img  = card.querySelector('.modal-img');
  const stub = card.querySelector('.img-placeholder-num');
  img.addEventListener('load',  () => { stub.style.display = 'none'; });
  img.addEventListener('error', () => { img.style.display  = 'none'; });

  /* Close button */
  card.querySelector('.modal-close')
    .addEventListener('click', () => closeModal(side));

  /* Skill links — stop propagation so backdrop click doesn't fire */
  card.querySelectorAll('.skill-link').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openSkillPopup(btn.dataset.skill);
    });
  });

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
   SKILL LINKS  (inside trading card)
   ──────────────────────────────────────────────────────── */
function renderSkillLinks(skillsStr) {
  return skillsStr
    .split(', ')
    .map(skill => {
      const name = skill.trim();
      return `<button class="skill-link" data-skill="${esc(name)}">${esc(name)}</button>`;
    })
    .join('<span class="skill-sep">, </span>');
}

/* ────────────────────────────────────────────────────────
   SKILL POPUP
   ──────────────────────────────────────────────────────── */
function openSkillPopup(skillName) {
  const overlay = document.getElementById('skill-overlay');
  const card    = document.getElementById('skill-card');
  const entry   = state.skills[skillName.toLowerCase()];

  card.innerHTML = `
    <div class="skill-card-header">
      <button class="skill-close" aria-label="Close skill reference">&#215;</button>
      <h3 class="skill-name">${esc(skillName)}</h3>
      ${entry?.category
        ? `<p class="skill-category">${esc(entry.category)}</p>`
        : ''}
    </div>
    <div class="skill-body">
      ${entry
        ? `<p class="skill-desc">${esc(entry.description)}</p>`
        : `<p class="skill-unknown">No description on file yet for this skill.
             Full rules reference coming soon.</p>`}
    </div>
  `;

  card.querySelector('.skill-close')
    .addEventListener('click', closeSkillPopup);

  overlay.removeAttribute('hidden');
  requestAnimationFrame(() => overlay.classList.add('active'));
}

function closeSkillPopup() {
  const overlay = document.getElementById('skill-overlay');
  if (overlay.hasAttribute('hidden')) return;
  overlay.classList.remove('active');
  overlay.addEventListener(
    'transitionend',
    () => overlay.setAttribute('hidden', ''),
    { once: true }
  );
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

  document.getElementById('skill-overlay')
    .addEventListener('click', function (e) {
      if (e.target === this) closeSkillPopup();
    });

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
