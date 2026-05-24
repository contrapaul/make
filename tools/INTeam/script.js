'use strict';

const POSITION_COLORS = {
  'Star Player': '#8B6914',
  'Blitzer':     '#7A1A1A',
  'Thrower':     '#1A3A7A',
  'Bodyguard':   '#3D1A7A',
  'Lineman':     '#1A5A2A',
  'Catcher':     '#7A4A1A',
};

const STAT_KEYS = ['ma', 'st', 'ag', 'pa', 'av'];

async function init() {
  try {
    const res = await fetch('data/players.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const players = await res.json();
    renderRoster(players);
  } catch (err) {
    console.error('Failed to load players.json:', err);
    document.getElementById('roster-grid').innerHTML =
      '<p style="color:#fff;padding:1.5rem;font-family:serif;">Could not load team data.</p>';
  }
}

function renderRoster(players) {
  const grid = document.getElementById('roster-grid');
  const fragment = document.createDocumentFragment();
  players.forEach(player => fragment.appendChild(buildCard(player)));
  grid.appendChild(fragment);
}

function buildCard(player) {
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
    ${player.value ? `<span class="card-value">${Math.round(player.value / 1000)}k gp</span>` : ''}
  `;

  card.addEventListener('click', () => openModal(player));
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(player); }
  });

  return card;
}

function openModal(player) {
  const overlay = document.getElementById('modal-overlay');
  const card    = document.getElementById('trading-card');
  const color   = POSITION_COLORS[player.position] || '#555';
  const isStar  = player.isStarPlayer;

  card.className = 'trading-card' + (isStar ? ' star-card' : '');

  card.innerHTML = `
    <button class="modal-close" aria-label="Close">&#215;</button>

    <div class="modal-player-header${isStar ? ' star-header' : ''}">
      <span class="modal-jersey">#${player.id}</span>
      <h2 class="modal-name">${esc(player.name)}</h2>
      <p class="modal-position">${esc(player.position)}${player.characteristic ? ` &middot; ${esc(player.characteristic)}` : ''}</p>
    </div>

    <div class="modal-image-area" style="background:${color};">
      <img class="modal-img" src="images/Player${player.id}.png" alt="${esc(player.name)}">
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
            <span class="ms-value" style="font-size:0.82rem;">${Math.round(player.value / 1000)}k</span>
          </div>` : ''}
      </div>
    </div>

    <div class="modal-skills">
      <p class="skills-label">Skills &amp; Traits</p>
      <p class="skills-text">${esc(player.skills)}</p>
    </div>

    ${player.fact ? `<div class="modal-fact">&ldquo;${esc(player.fact)}&rdquo;</div>` : ''}
  `;

  /* Image: hide placeholder when real image loads; hide img if it errors */
  const img         = card.querySelector('.modal-img');
  const placeholder = card.querySelector('.img-placeholder-num');
  img.addEventListener('load',  () => { placeholder.style.display = 'none'; });
  img.addEventListener('error', () => { img.style.display = 'none'; });

  card.querySelector('.modal-close').addEventListener('click', closeModal);

  overlay.removeAttribute('hidden');
  /* rAF ensures the hidden→visible transition actually fires */
  requestAnimationFrame(() => overlay.classList.add('active'));

  card.scrollTop = 0;
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('active');
  /* Wait for opacity transition before hiding from DOM */
  overlay.addEventListener('transitionend', () => overlay.setAttribute('hidden', ''), { once: true });
}

/* Close on backdrop click */
document.getElementById('modal-overlay').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});

/* Close on Escape */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

init();
