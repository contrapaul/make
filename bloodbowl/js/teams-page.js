'use strict';

/* ═══════════════════════════════════════════════════════
   Blood Bowl Companion — js/teams-page.js
   Standalone Teams page. Left 1/3: My Teams + Create Team.
   Right 2/3: gallery of team cards (or the embedded Team
   Builder when creating/editing). Clicking a team card opens
   a detail popup with scaled player trading cards + flavour
   text; clicking a player card opens a full-size card popup.
   ═══════════════════════════════════════════════════════ */

(function () {
  const STAT_KEYS = ['ma', 'st', 'ag', 'pa', 'av'];

  /* Mirrors script.js so the same trading-card markup renders here. */
  const POSITION_COLORS = {
    'Star Player': '#8B6914', 'Blitzer': '#7A1A1A', 'Thrower': '#1A3A7A',
    'Bodyguard': '#3D1A7A', 'Lineman': '#1A5A2A', 'Catcher': '#7A4A1A',
  };
  const COLOR_PROP_MAP = {
    bg: '--tc-bg', primary: '--tc-primary', primaryDark: '--tc-primary-dark',
    accent: '--tc-accent', gold: '--tc-gold', goldDark: '--tc-gold-dark',
    headerBg: '--tc-header-bg',
  };

  let teams = [];                 /* default teams from data/teams.json */
  const rosterCache = {};         /* fileUrl → roster array */

  /* ── Helpers ── */
  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  async function fetchJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Failed to fetch ${url}`);
    return r.json();
  }
  /* Resolve a data-relative path from this subpage (../). Absolute/rooted stay. */
  function dataURL(p) { return (!p || /^(https?:|\/)/.test(p)) ? p : '../' + p; }

  function skillLinks(str) {
    const sk = (str || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!sk.length) return '<span class="no-skills">—</span>';
    return sk.map(n => `<span class="skill-link" data-skill="${esc(n)}">${esc(n)}</span>`)
      .join('<span class="skill-sep">, </span>');
  }

  function applyColors(el, colors) {
    if (!colors) return;
    Object.entries(COLOR_PROP_MAP).forEach(([k, prop]) => {
      if (colors[k] != null) el.style.setProperty(prop, colors[k]);
    });
  }

  /* Normalise a roster entry (default file row OR saved-team player) to the
     shape the trading-card markup expects. */
  function normalizePlayers(raw) {
    return (raw || []).map((p, i) => ({
      id:           p.id ?? p.jerseyNumber ?? (i + 1),
      name:         p.name,
      position:     p.position,
      qty:          p.qty,
      ma: p.ma, st: p.st, ag: p.ag, pa: p.pa, av: p.av,
      skills:       Array.isArray(p.learnedSkills)
        ? [p.skills, ...p.learnedSkills].filter(Boolean).join(', ')
        : (p.skills || ''),
      value:        p.value,
      fact:         p.fact,
      isStarPlayer: !!p.isStarPlayer,
    }));
  }

  /* ── Trading-card markup (matches script.js openModal) ── */
  function cardMarkup(player, imageDir) {
    const isStar = !!player.isStarPlayer;
    const bg  = POSITION_COLORS[player.position] || '#555';
    const img = dataURL((imageDir || 'images/') + 'Player' + player.id + '.png');
    return `
      <div class="modal-image-area" style="background:${bg};">
        <img class="modal-img" src="${img}" alt="${esc(player.name)}">
        <span class="img-placeholder-num" aria-hidden="true">${esc(String(player.id))}</span>
        <div class="modal-card-overlay${isStar ? ' star-overlay' : ''}">
          <div class="modal-jersey-circle">${esc(String(player.id))}</div>
          <div class="modal-overlay-info">
            <h2 class="modal-name">${esc(player.name)}</h2>
            <p class="modal-position">${esc(player.position)}${player.qty ? ` <span class="modal-qty">(${esc(player.qty)})</span>` : ''}</p>
          </div>
        </div>
      </div>
      <div class="modal-stats"><div class="modal-stats-row">
        ${STAT_KEYS.map(s => `<div class="modal-stat"><span class="ms-label">${s.toUpperCase()}</span><span class="ms-value">${esc(String(player[s] ?? '—'))}</span></div>`).join('')}
        ${player.value ? `<div class="modal-stat"><span class="ms-label">GP</span><span class="ms-value" style="font-size:0.82rem;">${Math.round(player.value / 1000)}k</span></div>` : ''}
      </div></div>
      <div class="modal-skills"><p class="skills-label">Skills &amp; Traits</p><p class="skills-text">${skillLinks(player.skills)}</p></div>
      ${player.fact ? `<div class="modal-fact">&ldquo;${esc(player.fact)}&rdquo;</div>` : ''}`;
  }

  function bindCardImage(card) {
    const img  = card.querySelector('.modal-img');
    const stub = card.querySelector('.img-placeholder-num');
    if (!img) return;
    img.addEventListener('load',  () => { if (stub) stub.style.display = 'none'; });
    img.addEventListener('error', () => { img.style.display = 'none'; });
  }

  /* ── DOM refs ── */
  let content, sidebar, myteamsEl, createBtn;
  let detailOverlay, detailWindow, detailTitle, detailDesc, rosterGrid;
  let playerOverlay, playerCard;

  function show(ov) { ov.removeAttribute('hidden'); requestAnimationFrame(() => ov.classList.add('active')); }
  function hide(ov) { ov.classList.remove('active'); setTimeout(() => ov.setAttribute('hidden', ''), 200); }

  /* ── Right pane: gallery of team cards ── */
  function renderGallery() {
    content.className = 'tp-content';
    content.innerHTML = '<h2 class="tp-content-title">Teams</h2>';
    const gal = document.createElement('div');
    gal.className = 'tp-gallery';
    [...teams].sort((a, b) => a.name.localeCompare(b.name)).forEach(team => {
      const accent = team.colors?.accent || team.colors?.gold || 'rgba(150,180,255,0.5)';
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'tp-team-card';
      card.style.setProperty('--card-color', accent);
      card.innerHTML = `<span class="tp-team-card-name">${esc(team.name)}</span>`;
      card.addEventListener('click', () => openDetail(team, false));
      gal.appendChild(card);
    });
    content.appendChild(gal);
  }

  /* ── Right pane: embedded Team Builder ── */
  function openBuilder(teamId) {
    content.className = 'tp-content tp-content--builder';
    content.innerHTML = '';

    const bar = document.createElement('div');
    bar.className = 'tp-builder-bar';
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'tp-back-btn';
    back.textContent = '← Back to Teams';
    back.addEventListener('click', renderGallery);
    const title = document.createElement('h2');
    title.className = 'tp-content-title';
    title.textContent = teamId ? 'Edit Team' : 'Create Team';
    bar.appendChild(back);
    bar.appendChild(title);
    content.appendChild(bar);

    const host = document.createElement('div');
    host.className = 'ct-builder-body';
    content.appendChild(host);

    window.TeamBuilder?.renderBuilderInto(host, {
      teamId,
      onDone: () => { renderSidebar(); renderGallery(); },
    });
  }

  /* ── Left sidebar: saved teams ── */
  function renderSidebar() {
    myteamsEl.innerHTML = '';
    const saved = window.TeamBuilder?.getTeams?.() ?? [];
    if (!saved.length) {
      myteamsEl.innerHTML = '<p class="tp-empty">No saved teams yet. Create one to set its roster, colours, and skills.</p>';
      return;
    }
    saved.forEach(team => {
      const accent = team.colors?.accent || 'rgba(150,180,255,0.6)';
      const row = document.createElement('div');
      row.className = 'tp-myteam';
      row.style.setProperty('--card-color', accent);
      row.innerHTML =
        `<span class="tp-myteam-name">${esc(team.name)}</span>` +
        `<span class="tp-myteam-meta">${(team.players || []).length}pl · ${team.rerolls || 0}RR</span>` +
        `<button class="tp-myteam-edit" type="button" aria-label="Edit ${esc(team.name)}">✏</button>`;
      row.addEventListener('click', () => openDetail(team, true));
      row.querySelector('.tp-myteam-edit').addEventListener('click', e => {
        e.stopPropagation();
        openBuilder(team.id);
      });
      myteamsEl.appendChild(row);
    });
  }

  /* ── Team detail popup ── */
  async function openDetail(team, isSaved) {
    let players, colors, imageDir;

    if (isSaved) {
      const base = teams.find(t => t.id === team.baseTeamId);
      colors   = { ...(base?.colors || {}), ...(team.colors || {}) };
      imageDir = base?.imageDir || 'images/';
      players  = normalizePlayers(team.players || []);
    } else {
      colors   = team.colors || {};
      imageDir = team.imageDir || 'images/';
      const url = dataURL(team.fullTeam || team.file);
      let raw = rosterCache[url];
      if (!raw) { raw = await fetchJSON(url); rosterCache[url] = raw; }
      players = normalizePlayers(raw);
    }

    detailTitle.textContent = team.name;
    detailDesc.textContent  = team.description || 'Placeholder team description';
    detailWindow.removeAttribute('style');
    applyColors(detailWindow, colors);

    rosterGrid.innerHTML = '';
    players.forEach(p => {
      const thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = 'tp-card-thumb';
      thumb.setAttribute('aria-label', `View ${p.name}`);
      const card = document.createElement('div');
      card.className = 'trading-card' + (p.isStarPlayer ? ' star-card' : '');
      applyColors(card, colors);
      card.innerHTML = cardMarkup(p, imageDir);
      bindCardImage(card);
      thumb.appendChild(card);
      thumb.addEventListener('click', () => openPlayer(p, colors, imageDir));
      rosterGrid.appendChild(thumb);
    });

    show(detailOverlay);
    detailWindow.scrollTop = 0;
  }

  /* ── Full-size player card popup ── */
  function openPlayer(player, colors, imageDir) {
    playerCard.className = 'trading-card' + (player.isStarPlayer ? ' star-card' : '');
    playerCard.removeAttribute('style');
    applyColors(playerCard, colors);
    playerCard.innerHTML = cardMarkup(player, imageDir);
    bindCardImage(playerCard);
    show(playerOverlay);
    playerCard.scrollTop = 0;
  }

  /* ── Init ── */
  async function init() {
    content       = document.getElementById('tp-content');
    sidebar       = document.querySelector('.tp-sidebar');
    myteamsEl     = document.getElementById('tp-myteams');
    createBtn     = document.getElementById('tp-create');
    detailOverlay = document.getElementById('tp-detail');
    detailWindow  = document.getElementById('tp-detail-window');
    detailTitle   = document.getElementById('tp-detail-title');
    detailDesc    = document.getElementById('tp-detail-desc');
    rosterGrid    = document.getElementById('tp-roster-grid');
    playerOverlay = document.getElementById('tp-player-modal');
    playerCard    = document.getElementById('tp-player-card');

    createBtn?.addEventListener('click', () => openBuilder(null));

    document.getElementById('tp-detail-close')?.addEventListener('click', () => hide(detailOverlay));
    detailOverlay?.addEventListener('click', e => { if (e.target === detailOverlay) hide(detailOverlay); });
    playerOverlay?.addEventListener('click', e => { if (e.target === playerOverlay) hide(playerOverlay); });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (!playerOverlay.hasAttribute('hidden')) hide(playerOverlay);
      else if (!detailOverlay.hasAttribute('hidden')) hide(detailOverlay);
    });

    try { teams = await fetchJSON('../data/teams.json'); } catch { teams = []; }
    try { window.BBSkillsList = await fetchJSON('../data/skills.json'); } catch { window.BBSkillsList = []; }

    renderSidebar();
    renderGallery();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
