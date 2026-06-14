'use strict';

/* ═══════════════════════════════════════════════════════
   Blood Bowl Companion — js/game-page.js
   Controller for the dedicated game page (/game).
   Reconstructs the matchup handed off from the lobby
   (localStorage 'bb:activeMatch'), restores any in-progress
   state, plays the TEAM-vs-TEAM intro, and boots play.

   NOTE: page uses <base href="../">, so anchor hrefs resolve
   from the bloodbowl root, but the location API does NOT —
   use page-relative '../' to return to the lobby.
   ═══════════════════════════════════════════════════════ */

(function () {

  /* team.colors keys → CSS custom properties (mirrors script.js COLOR_PROP_MAP) */
  const TC_VARS = {
    bg: '--tc-bg', primary: '--tc-primary', primaryDark: '--tc-primary-dark',
    accent: '--tc-accent', gold: '--tc-gold', goldDark: '--tc-gold-dark',
    headerBg: '--tc-header-bg',
  };
  const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function readMatch() {
    try { return JSON.parse(localStorage.getItem('bb:activeMatch') || 'null'); }
    catch { return null; }
  }

  /* Resolve once script.js has fetched team/skill data. */
  function whenAppReady() {
    return new Promise(resolve => {
      if (window.__bbAppReady) return resolve();
      document.addEventListener('bb:appReady', () => resolve(), { once: true });
    });
  }

  async function boot() {
    const match = readMatch();
    if (!match || !match.home || !match.away) {
      location.replace('../');   // no active match → back to lobby
      return;
    }

    await whenAppReady();
    if (match.gameMode) window.BBSettings?.setGameMode?.(match.gameMode);

    try {
      await window.reconstructSide?.('left',  match.home);
      await window.reconstructSide?.('right', match.away);
    } catch (err) {
      console.error('[BB] Failed to reconstruct match:', err);
    }

    window.rehydrateGlobals?.();
    wireTurnButton();
    document.body.classList.add('bb-game-ready');
    window.BBGameTimeline?.render?.();

    maybeShowIntro(match);
  }

  /* ── Contextual turn button (G1 stub → full engine in G3) ── */
  function wireTurnButton() {
    const btn = document.getElementById('gb-turn-btn');
    if (!btn || btn._wired) return;
    btn._wired = true;
    btn.addEventListener('click', () => window.DriveWizard?.open?.('half-start'));
  }

  /* ════════════════════════════════════════════════════════
     INTRO — TEAM vs TEAM
     Rosters fly in from off-screen and stack into a fanned
     deck; a big START GAME! button reveals once they settle.
     Shown once per fresh match (keyed on match.createdAt).
     ════════════════════════════════════════════════════════ */

  function maybeShowIntro(match) {
    const key = String(match.createdAt || '');
    let shownFor = null;
    try { shownFor = localStorage.getItem('bb:introShownFor'); } catch (_) {}
    if (key && shownFor === key) return;   // already played for this match (e.g. reload)
    showIntro(match, key);
  }

  function buildStack(side) {
    const team    = window.state?.[side]?.team || {};
    const players = window.state?.[side]?.players || [];
    const imgDir  = team.imageDir || 'images/';
    const colors  = team.colors || {};

    const stack = document.createElement('div');
    stack.className = `bb-intro-stack ${side === 'left' ? 'home' : 'away'}`;
    Object.entries(TC_VARS).forEach(([k, prop]) => {
      if (colors[k]) stack.style.setProperty(prop, colors[k]);
    });

    players.forEach((p, i) => {
      const card = document.createElement('div');
      card.className = 'trading-card bb-intro-card' + (p.isStarPlayer ? ' star-card' : '');
      if (!REDUCED) card.classList.add('fly');
      card.style.transitionDelay = `${i * 55}ms`;
      card.innerHTML = window.PlayerCard.html(p, { imageDir: imgDir });
      window.PlayerCard.bindImage(card);
      stack.appendChild(card);
    });
    return { stack, team, count: players.length };
  }

  function showIntro(match, key) {
    const overlay = document.getElementById('bb-intro-overlay');
    if (!overlay || !window.PlayerCard) return;

    const home = buildStack('left');
    const away = buildStack('right');

    overlay.innerHTML = `
      <div class="bb-intro-inner">
        <div class="bb-intro-head">
          <span class="bb-intro-team bb-intro-team--home">${esc(home.team.name || 'Home')}</span>
          <span class="bb-intro-vs">vs</span>
          <span class="bb-intro-team bb-intro-team--away">${esc(away.team.name || 'Away')}</span>
        </div>
        <div class="bb-intro-arena">
          <div class="bb-intro-col" id="bb-intro-col-home"></div>
          <div class="bb-intro-col" id="bb-intro-col-away"></div>
        </div>
        <button class="roll-btn bb-intro-start" id="bb-intro-start" type="button">START GAME!</button>
      </div>`;

    const colHome = overlay.querySelector('#bb-intro-col-home');
    const colAway = overlay.querySelector('#bb-intro-col-away');
    colHome.appendChild(home.stack);
    colAway.appendChild(away.stack);
    overlay.hidden = false;
    document.body.classList.add('bb-intro-open');

    const pairs = [[colHome, home.stack], [colAway, away.stack]];
    /* Scale each fanned stack to fit its column, and set the off-screen fly
       distance in stack space so cards clear the viewport at any scale. */
    function fitStacks() {
      pairs.forEach(([col, stack]) => {
        stack.style.transform = 'none';
        const cw = col.clientWidth, ch = col.clientHeight;
        const nw = stack.offsetWidth, nh = stack.offsetHeight;
        if (!cw || !ch || !nw || !nh) return;
        const s = Math.min(cw / nw, ch / nh, 1.1);
        stack.style.transform = `scale(${s})`;
        stack.style.setProperty('--flyx', `${Math.round(150 / Math.max(s, 0.12))}vw`);
      });
    }

    const startBtn = overlay.querySelector('#bb-intro-start');
    const onResize = () => fitStacks();
    const finish = () => {
      try { if (key) localStorage.setItem('bb:introShownFor', key); } catch (_) {}
      window.removeEventListener('resize', onResize);
      overlay.hidden = true;
      overlay.innerHTML = '';
      document.body.classList.remove('bb-intro-open');
      window.DriveWizard?.open?.('half-start');
    };
    startBtn.addEventListener('click', finish);
    window.addEventListener('resize', onResize);

    const cards = overlay.querySelectorAll('.bb-intro-card');
    /* setTimeout (not rAF) so this is reliable even when the tab isn't painting. */
    setTimeout(() => {
      fitStacks();                       // sets scale + correct --flyx while cards are off-screen
      void overlay.offsetWidth;          // force reflow so the fly start state registers
      if (!REDUCED) cards.forEach(c => c.classList.remove('fly'));   // animate to rest
    }, 40);

    const total = REDUCED ? 0 : cards.length * 55 + 650;
    setTimeout(() => startBtn.classList.add('show'), Math.min(total, 2600));
  }

  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
