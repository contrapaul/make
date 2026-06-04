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
window.POSITION_COLORS  = POSITION_COLORS;

/* Timers for skill-link hover/close grace period */
let hoverTimer = null;
let closeTimer  = null;

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

    populateSelects();
    bindSelectListeners();
    bindGlobalListeners();
    bindMyTeamsButtons();
    bindEndGameButton();
  } catch (err) {
    console.error('[BB] Init failed:', err);
  } finally {
    bbSignalReady();
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
    syncTeamSkills(side, players, team.name);

    /* Update companion UI */
    if (window.Panels) {
      Panels.openAccordion(side);
      Panels.setAccordionLabel(side, team.name);
      /* Default 3 re-rolls — will be team-builder-driven in Phase 4 */
      Panels.setRerolls(side === 'left' ? 'home' : 'away', 3);
    }
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
  const players = savedTeam.players.map(p => ({
    id:          p.rosterSlotId ?? p.id,
    savedId:     p.id,     /* UUID for SPP tracking */
    name:        p.name,
    position:    p.position,
    ma:          p.ma, st: p.st, ag: p.ag, pa: p.pa, av: p.av,
    skills:      [p.skills, ...(p.learnedSkills ?? [])].filter(Boolean).join(', '),
    value:       p.value ?? 0,
    qty:         null,
    jerseyNumber: p.jerseyNumber,
    isStarPlayer: false,
  }));

  state[side].team    = baseEntry ?? { id: savedTeam.baseTeamId, name: savedTeam.name, colors: {} };
  state[side].players = players;

  applyTeamColors(side, baseEntry?.colors ?? {});
  renderRoster(side, players);
  syncTeamSkills(side, players, savedTeam.name);

  /* Track which saved team is loaded for SPP/post-game */
  const gbSide = side === 'left' ? 'home' : 'away';
  if (window.GameState) window.GameState.activeTeamIds[gbSide] = savedTeam.id;

  /* Sync companion UI with saved team data */
  if (window.Panels) {
    Panels.openAccordion(side);
    Panels.setAccordionLabel(side, savedTeam.name);
    Panels.setRerolls(gbSide, savedTeam.rerolls ?? 0);
  }
}

window.loadCustomTeam = loadCustomTeam;

function bindEndGameButton() {
  document.getElementById('gb-end-game-btn')
    ?.addEventListener('click', () => window.SPPTracker?.showPostGame());
}

function bindMyTeamsButtons() {
  ['left', 'right'].forEach(side => {
    document.getElementById(`my-teams-${side}`)
      ?.addEventListener('click', () => window.TeamBuilder?.openPicker(side));
  });
  document.getElementById('my-teams-nav')
    ?.addEventListener('click', () => window.TeamBuilder?.open('list'));
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
    Panels.setRerolls(gbSide, 0);
  }
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

  card.addEventListener('click', () => openModal(side, player));
  card.addEventListener('keydown', e => {
    if (e.target.closest('.skill-link')) return; /* skill-link handles its own activation */
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openModal(side, player);
    }
  });

  /* Skill links in roster card: hover shows tooltip, click stops propagation
     so the card's own click handler (open modal) doesn't also fire. */
  attachSkillEvents(card, true);

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
    <div class="modal-image-area" style="background:${bgColor};">
      <img class="modal-img"
           src="${imgDir}Player${player.id}.png"
           alt="${esc(player.name)}">
      <span class="img-placeholder-num" aria-hidden="true">${player.id}</span>

      <div class="modal-card-overlay${isStar ? ' star-overlay' : ''}">
        <div class="modal-jersey-circle">${player.id}</div>
        <div class="modal-overlay-info">
          <h2 class="modal-name">${esc(player.name)}</h2>
          <p class="modal-position">
            ${esc(player.position)}${player.characteristic
              ? ` &middot; ${esc(player.characteristic)}`
              : ''}${player.qty
              ? ` <span class="modal-qty">(${esc(player.qty)})</span>`
              : ''}
          </p>
        </div>
      </div>
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
      hoverTimer = setTimeout(() => openSkillPopup(name, btn), 160);
    });

    btn.addEventListener('mouseleave', () => {
      clearTimeout(hoverTimer);
      scheduleClose();
    });

    btn.addEventListener('click', e => {
      if (stopClick) e.stopPropagation();
      clearTimeout(hoverTimer);
      clearTimeout(closeTimer);
      openSkillPopup(name, btn);
    });
  });
}

/* Expose for use in wizards */
window.attachSkillEvents  = attachSkillEvents;
window.renderSkillLinks   = renderSkillLinks;

function scheduleClose() {
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
        : `<p class="skill-unknown">No description on file yet for this skill.</p>`}
    </div>
  `;

  card.querySelector('.skill-close').addEventListener('click', closeSkillPopup);

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
