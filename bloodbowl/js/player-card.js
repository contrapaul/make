'use strict';

/* ═══════════════════════════════════════════════════════
   Blood Bowl Companion — js/player-card.js
   Single source for trading-card markup, used by:
     · script.js openModal  (full-size roster modal)
     · js/teams-page.js     (teams page popups)
     · js/wizards.js        (embedded wizard cards)
   The card scales via container queries (style.css) — same
   markup at any width. Status/effect overlays reflect
   GameState (e.g. "Rooted", "KO") on the card itself.

   Standalone: no hard deps; uses window.renderSkillLinks /
   window.GameState / window.STATUS_META when present.
   ═══════════════════════════════════════════════════════ */

(function () {

  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  const STAT_KEYS = ['ma', 'st', 'ag', 'pa', 'av'];

  const FALLBACK_POSITION_COLORS = {
    'Star Player': '#8B6914', 'Blitzer': '#7A1A1A', 'Thrower': '#1A3A7A',
    'Bodyguard': '#3D1A7A', 'Lineman': '#1A5A2A', 'Catcher': '#7A4A1A',
  };

  /* One-line rules reminder per status, shown on the card banner. */
  const STATUS_MESSAGES = {
    prone:      'Must stand up (3 MA) before acting',
    stunned:    'Face down — turns face up next turn',
    ko:         'In the dugout — may recover at the next kick-off',
    mng:        'Misses the next game',
    badly_hurt: 'Out of this game — no lasting effect',
    dead:       'Remove from the Team Roster',
    sent_off:   'Ejected by the referee for this game',
    temp_neg:   'Temporarily impaired',
  };

  function fallbackSkillLinks(str) {
    const sk = (str || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!sk.length) return '<span class="no-skills">—</span>';
    return sk.map(n => `<span class="skill-link" data-skill="${esc(n)}">${esc(n)}</span>`)
      .join('<span class="skill-sep">, </span>');
  }

  /**
   * Trading-card inner HTML. `player` shape:
   * { id, name, position, characteristic?, qty?, ma, st, ag, pa, av,
   *   skills, value?, fact?, isStarPlayer?, photo? }
   * opts: { imgSrc?           explicit image URL (else imageDir + Player{id}.png)
   *         imageDir?         default 'images/'
   *         skillLinksFn?     custom skill-link renderer
   *         statusHTML? }     pre-built status banner HTML (see statusHTML())
   */
  function html(player, opts = {}) {
    const isStar = !!player.isStarPlayer;
    const colors = window.POSITION_COLORS || FALLBACK_POSITION_COLORS;
    const bg     = colors[player.position] || '#555';
    const src    = player.photo || opts.imgSrc || ((opts.imageDir || 'images/') + 'Player' + player.id + '.png');
    const skillsFn = opts.skillLinksFn || window.renderSkillLinks || fallbackSkillLinks;

    return `
      <div class="modal-image-area" style="background:${bg};">
        <img class="modal-img" src="${esc(src)}" alt="${esc(player.name)}">
        <span class="img-placeholder-num" aria-hidden="true">${esc(String(player.id))}</span>
        <div class="modal-card-overlay${isStar ? ' star-overlay' : ''}">
          <div class="modal-jersey-circle">${esc(String(player.id))}</div>
          <div class="modal-overlay-info">
            <h2 class="modal-name">${esc(player.name)}</h2>
            <p class="modal-position">
              ${esc(player.position)}${player.characteristic ? ` &middot; ${esc(player.characteristic)}` : ''}${player.qty ? ` <span class="modal-qty">(${esc(player.qty)})</span>` : ''}
            </p>
          </div>
        </div>
        ${opts.statusHTML || ''}
      </div>
      <div class="modal-stats"><div class="modal-stats-row">
        ${STAT_KEYS.map(s => `<div class="modal-stat"><span class="ms-label">${s.toUpperCase()}</span><span class="ms-value">${esc(String(player[s] ?? '—'))}</span></div>`).join('')}
        ${player.value ? `<div class="modal-stat"><span class="ms-label">GP</span><span class="ms-value ms-value-gp">${Math.round(player.value / 1000)}k</span></div>` : ''}
      </div></div>
      <div class="modal-skills"><p class="skills-label">Skills &amp; Traits</p><p class="skills-text">${skillsFn(player.skills)}</p></div>
      ${player.fact ? `<div class="modal-fact">&ldquo;${esc(player.fact)}&rdquo;</div>` : ''}`;
  }

  /* Hide the placeholder number once the image loads; hide the img on error. */
  function bindImage(cardEl) {
    const img  = cardEl.querySelector('.modal-img');
    const stub = cardEl.querySelector('.img-placeholder-num');
    if (!img) return;
    img.addEventListener('load',  () => { if (stub) stub.style.display = 'none'; });
    img.addEventListener('error', () => { img.style.display = 'none'; });
  }

  /* Status + effects banner HTML for a tracked player (or '' if clean). */
  function statusHTML(side, idx) {
    const gs = window.GameState;
    if (!gs || side == null || idx == null) return '';
    const status  = gs.playerStatuses?.[side]?.[idx] ?? 'available';
    const meta    = window.STATUS_META?.[status];
    const effects = window.getPlayerEffects?.(side, idx) ?? [];
    if ((!meta || !meta.label) && !effects.length) return '';

    const rows = [];
    if (meta?.label) {
      rows.push(`<div class="tc-status-row ${meta.cls}">` +
        `<span class="tc-status-label">${esc(meta.label)}</span>` +
        `<span class="tc-status-msg">${esc(STATUS_MESSAGES[status] || '')}</span></div>`);
    }
    effects.forEach(e => {
      rows.push(`<div class="tc-status-row ${e.kind === 'debuff' ? 'effect-debuff' : 'effect-buff'}">` +
        `<span class="tc-status-label">${esc(e.label)}</span>` +
        (e.grantsSkill ? `<span class="tc-status-msg">Gains ${esc(e.grantsSkill)}</span>` : '') +
        `</div>`);
    });
    return `<div class="tc-status-banner">${rows.join('')}</div>`;
  }

  /* Dim the card art for out-of-game statuses. */
  function applyStatusClasses(cardEl, side, idx) {
    const gs = window.GameState;
    if (!gs || side == null || idx == null) return;
    const status = gs.playerStatuses?.[side]?.[idx] ?? 'available';
    cardEl.classList.toggle('tc-unavailable', !!window.STATUS_META?.[status]?.dim);
  }

  window.PlayerCard = { html, bindImage, statusHTML, applyStatusClasses, STATUS_MESSAGES };
})();
