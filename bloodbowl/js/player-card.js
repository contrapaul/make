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
  /* Parse a skills field (array or comma string) into a clean name list. */
  function skillList(skills) {
    if (Array.isArray(skills)) return skills.map(s => String(s).trim()).filter(Boolean);
    return String(skills || '').split(',').map(s => s.trim()).filter(Boolean);
  }

  function html(player, opts = {}) {
    const isStar = !!player.isStarPlayer;
    const colors = window.POSITION_COLORS || FALLBACK_POSITION_COLORS;
    /* Team accent drives the whole card. The consumer's card element already
       carries the team colour as --tc-primary (and may set --team-accent); use
       that so the frame ring and internals stay consistent, with a JS fallback. */
    const accentColor = opts.accent || colors[player.position] || '#3b6fe0';
    const a      = `var(--team-accent, var(--tc-primary, ${accentColor}))`;
    const num    = esc(String(player.id ?? ''));
    const src    = player.photo || opts.imgSrc || ((opts.imageDir || 'images/') + 'Player' + player.id + '.png');
    const posLine = esc(player.position || '')
      + (player.characteristic ? ' · ' + esc(player.characteristic) : '')
      + (player.qty ? ' (' + esc(player.qty) + ')' : '');

    const stats = STAT_KEYS.map(k => ({ k: k.toUpperCase(), v: String(player[k] ?? '—') }));
    const gp    = player.value ? Math.round(player.value / 1000) + 'k' : '';

    const skills = skillList(player.skills);
    const skillPills = skills.length
      ? skills.map(n => `<span class="skill-link tc-skill" data-skill="${esc(n)}" style="font-family:var(--bb-font-body);font-weight:500;font-size:3cqw;color:color-mix(in srgb, ${a} 70%, #000);background:color-mix(in srgb, ${a} 13%, #fff);border:0.25cqw solid color-mix(in srgb, ${a} 30%, transparent);padding:0.9cqw 2.7cqw;border-radius:8cqw;white-space:nowrap;">${esc(n)}</span>`).join('')
      : `<span style="font-family:var(--bb-font-body);font-style:italic;font-size:3cqw;color:#a8a294;">No skills yet — a fresh recruit.</span>`;

    return `
      <div class="tc-image" style="position:relative;flex:1 1 0;min-height:0;overflow:hidden;background:linear-gradient(155deg, color-mix(in srgb, ${a} 80%, #000), color-mix(in srgb, ${a} 40%, #14181f));">
        <img class="modal-img" src="${esc(src)}" alt="${esc(player.name)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">
        <div style="position:absolute;inset:0;background:repeating-linear-gradient(45deg, transparent, transparent 4.5cqw, rgba(0,0,0,0.055) 4.5cqw, rgba(0,0,0,0.055) 9cqw);pointer-events:none;"></div>
        <span class="tc-watermark" aria-hidden="true" style="position:absolute;right:2cqw;bottom:-6cqw;font-family:var(--bb-font-num);font-weight:800;font-style:italic;font-size:48cqw;line-height:1;color:rgba(255,255,255,0.14);letter-spacing:-0.04em;pointer-events:none;">${num}</span>
        <div style="position:absolute;top:0;left:0;right:0;display:flex;align-items:center;gap:2.6cqw;padding:2.8cqw 3.2cqw 5cqw;background:linear-gradient(180deg, color-mix(in srgb, ${a} 70%, #07101f) 0%, color-mix(in srgb, ${a} 30%, transparent) 65%, transparent 100%);">
          <span style="flex-shrink:0;width:13cqw;height:13cqw;border-radius:50%;background:#fff;border:0.55cqw solid #0d1424;display:flex;align-items:center;justify-content:center;font-family:var(--bb-font-num);font-weight:800;font-style:italic;font-size:6.4cqw;color:#111;box-shadow:0 0.8cqw 2cqw rgba(0,0,0,0.45);">${num}</span>
          <span style="min-width:0;flex:1;">
            <span style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-family:var(--bb-font-head);font-weight:700;font-size:6.6cqw;line-height:1.0;color:#fff;text-shadow:0 0.4cqw 1.4cqw rgba(0,0,0,0.65);">${esc(player.name)}</span>
            <span style="display:block;font-family:var(--bb-font-head);font-weight:600;font-size:3cqw;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.88);margin-top:0.5cqw;text-shadow:0 0.3cqw 0.8cqw rgba(0,0,0,0.5);">${posLine}</span>
          </span>
        </div>
      </div>

      <div style="flex:none;display:flex;background:#efeae0;border-top:0.25cqw solid rgba(0,0,0,0.09);">
        ${stats.map(s => `<span style="flex:1;display:flex;flex-direction:column;align-items:center;padding:2.4cqw 0;border-right:0.25cqw solid rgba(0,0,0,0.08);">
          <span style="font-family:var(--bb-font-head);font-weight:700;font-size:2.7cqw;letter-spacing:0.05em;color:#9a9488;text-transform:uppercase;">${s.k}</span>
          <span style="font-family:var(--bb-font-num);font-weight:700;font-size:5cqw;color:#1a1a1a;line-height:1.2;">${esc(s.v)}</span>
        </span>`).join('')}
        ${gp ? `<span style="flex:1;display:flex;flex-direction:column;align-items:center;padding:2.4cqw 0;">
          <span style="font-family:var(--bb-font-head);font-weight:700;font-size:2.7cqw;letter-spacing:0.05em;color:#9a9488;text-transform:uppercase;">GP</span>
          <span style="font-family:var(--bb-font-num);font-weight:700;font-size:4.3cqw;color:#9a7d0a;line-height:1.4;">${gp}</span>
        </span>` : ''}
      </div>

      <div style="flex:none;max-height:33cqw;overflow-y:auto;padding:2.8cqw 3.4cqw;background:#f4f1ea;border-top:0.25cqw solid rgba(0,0,0,0.07);">
        <div style="font-family:var(--bb-font-head);font-weight:700;font-size:2.6cqw;letter-spacing:0.13em;text-transform:uppercase;color:#9a7d4a;margin-bottom:1.8cqw;">Skills &amp; Traits</div>
        <div style="display:flex;flex-wrap:wrap;gap:1.7cqw;">${skillPills}</div>
      </div>

      ${player.fact ? `<div style="flex:none;padding:2.6cqw 3.4cqw;font-family:var(--bb-font-body);font-style:italic;font-size:3cqw;line-height:1.5;color:#6a6256;background:#ece6da;border-top:0.25cqw solid rgba(0,0,0,0.09);">&ldquo;${esc(player.fact)}&rdquo;</div>` : ''}

      ${isStar ? `<div class="tc-star-sheen" aria-hidden="true" style="position:absolute;inset:0;z-index:5;pointer-events:none;border-radius:4.6cqw;box-shadow:inset 0 0 6cqw 0.6cqw rgba(212,175,55,0.45);background:linear-gradient(115deg, rgba(255,235,150,0) 30%, rgba(255,240,190,0.28) 48%, rgba(255,235,150,0) 66%);background-size:240% 100%;animation:tcStarSheen 7s linear infinite;"></div>` : ''}
      ${opts.statusHTML || ''}`;
  }

  /* No photo art → hide the <img> so the accent gradient + watermark show. */
  function bindImage(cardEl) {
    const img = cardEl.querySelector('.modal-img');
    if (!img) return;
    img.addEventListener('error', () => { img.style.display = 'none'; });
    if (img.complete && img.naturalWidth === 0) img.style.display = 'none';
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
