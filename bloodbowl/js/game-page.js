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
    syncScoreboard();
    initEngine();
    document.body.classList.add('bb-game-ready');
    window.BBGameTimeline?.render?.();

    maybeShowIntro();
  }

  /* Push restored scores into the game-bar scoreboard + panels.gbState
     (adjustScore updates the DOM live, but a reload needs this one-time sync). */
  function syncScoreboard() {
    const sc = window.GameState?.scores || { home: 0, away: 0 };
    if (window.gbState) window.gbState.scores = { ...sc };
    ['home', 'away'].forEach(side => {
      const el = document.getElementById(`gb-${side}-score`);
      if (el) el.textContent = sc[side] ?? 0;
    });
  }

  /* ════════════════════════════════════════════════════════
     TURN / SEQUENCE ENGINE
     The contextual button drives the whole match:
       Start of Half → End [Team] Turn #N → (TD → Kick Off) →
       … → Start 2nd Half → … → Game Over.
     Each coach gets TURNS_PER_HALF team-turns per half; the
     receiving team takes the first turn after each kickoff.
     ════════════════════════════════════════════════════════ */
  const TURNS_PER_HALF = 8;
  let engineMode = 'pre';   // pre | drive | pendingKick | halftime | gameover

  const opp    = t => (t === 'home' ? 'away' : 'home');
  const sideOf = t => (t === 'home' ? 'left' : 'right');
  const nameOf = t => window.state?.[sideOf(t)]?.team?.name || (t === 'home' ? 'Home' : 'Away');

  function gs() { return window.GameState; }

  function initEngine() {
    const btn = document.getElementById('gb-turn-btn');
    if (btn && !btn._wired) { btn._wired = true; btn.addEventListener('click', onTurnButton); }
    document.addEventListener('bb:driveClosed', onDriveClosed);
    document.addEventListener('bb:score', onScore);
    document.addEventListener('bb:playerStatus', onPlayerStatus);
    deriveMode();
    renderTurnButton();
  }

  /* Log notable injury outcomes to the game timeline (sent-off is logged
     directly by the foul wizard, so it's excluded here to avoid doubles). */
  const INJURY_LABELS = { ko: 'KO', badly_hurt: 'Casualty', dead: 'Dead', mng: 'MNG' };
  function onPlayerStatus(e) {
    const { side, idx, status } = e.detail || {};
    const label = INJURY_LABELS[status];
    if (!label) return;
    const p = window.getPlayerList?.(side)?.[idx];
    window.logGameEvent?.('injury', { side, idx, status, detail: `${p?.name || 'Player'} — ${label}` });
  }

  /* Reconstruct engineMode from restored state (reload-safe). */
  function deriveMode() {
    const g = gs();
    if (g.phase === window.GamePhase?.GAME_OVER) engineMode = 'gameover';
    else if (g.activeTeam && g.phase === window.GamePhase?.DRIVE) engineMode = 'drive';
    else if (g.half === 2 && !g.activeTeam) engineMode = 'halftime';
    else engineMode = 'pre';
  }

  function renderTurnButton() {
    const btn = document.getElementById('gb-turn-btn');
    if (!btn) return;
    const g = gs();
    const labels = {
      pre:         'Start of Half',
      halftime:    'Start 2nd Half',
      pendingKick: '▶ Kick Off',
      gameover:    '🏆 Game Over',
      drive:       g.activeTeam ? `End ${nameOf(g.activeTeam)} — Turn ${g.turn?.[g.activeTeam] ?? 1}` : 'End Turn',
    };
    btn.textContent = labels[engineMode] || 'Start of Half';
    btn.classList.toggle('gb-turn-btn--drive', engineMode === 'drive');
    btn.classList.toggle('gb-turn-btn--over',  engineMode === 'gameover');
  }

  function onTurnButton() {
    switch (engineMode) {
      case 'pre':         startDrive('half-start'); break;
      case 'halftime':    startDrive('half-start'); break;
      case 'pendingKick': startDrive('drive-only'); break;
      case 'drive':       endActiveTurn(); break;
      case 'gameover':    showSummary(); break;
    }
  }

  /* A team begins its turn → bump its counter, go active, enter DRIVE. */
  function beginTurn(team) {
    const g = gs();
    if (!g.turn) g.turn = { home: 0, away: 0 };
    if ((g.turn[team] ?? 0) >= TURNS_PER_HALF) { endHalf(); return; }
    g.turn[team] = (g.turn[team] ?? 0) + 1;
    g.activeTeam = team;
    engineMode = 'drive';
    window.setPhase?.(window.GamePhase?.DRIVE || 'drive');
    window.persistGameState?.();
    renderTurnButton();
    window.BBGameTimeline?.render?.();
  }

  function endActiveTurn() {
    const g = gs();
    window.endTurn?.();                       // clears per-player acted flags (+ bb:turnEnd)
    const next = opp(g.activeTeam);
    if ((g.turn?.[next] ?? 0) >= TURNS_PER_HALF) endHalf();
    else beginTurn(next);
  }

  function endHalf() {
    const g = gs();
    if (g.half >= 2) { endGame(); return; }
    g.half = 2;
    g.kickingTeam = opp(g.kickingTeam);       // H1 receiver kicks off in H2
    g.turn = { home: 0, away: 0 };
    g.activeTeam = null;
    engineMode = 'halftime';
    window.setPhase?.(window.GamePhase?.HALF_TIME || 'half_time');
    window.persistGameState?.();
    renderTurnButton();
    window.BBGameTimeline?.render?.();
  }

  function endGame() {
    gs().activeTeam = null;
    engineMode = 'gameover';
    window.setPhase?.(window.GamePhase?.GAME_OVER || 'game_over');
    window.persistGameState?.();
    renderTurnButton();
    window.BBGameTimeline?.render?.();
    showSummary();
  }

  /* Drive wizard finished (half-start or post-TD kickoff) → start the
     receiving team's turn. */
  function onDriveClosed(e) {
    const d = e.detail || {};
    if (!d.completed) return;
    if (d.flow !== 'half-start' && d.flow !== 'drive-only') return;
    const recv = opp(gs().kickingTeam || 'away');
    if ((gs().turn?.[recv] ?? 0) >= TURNS_PER_HALF) endHalf();
    else beginTurn(recv);
  }

  /* Touchdown → the scoring team's turn ends and they kick off again. */
  function onScore(e) {
    const { side, delta } = e.detail || {};
    if (!delta || delta <= 0) return;
    const scorer = side === 'home' ? 'home' : 'away';
    window.logGameEvent?.('touchdown', { side: sideOf(scorer), team: nameOf(scorer) });
    window.endTurn?.();
    gs().kickingTeam = scorer;                // scorer kicks off next
    engineMode = 'pendingKick';
    window.persistGameState?.();
    renderTurnButton();
  }

  /* Lightweight Game Over summary (reuses the intro overlay shell). */
  function showSummary() {
    const overlay = document.getElementById('bb-intro-overlay');
    if (!overlay) return;
    const g = gs();
    const hs = g.scores?.home ?? 0, as = g.scores?.away ?? 0;
    const winner = hs === as ? 'Draw' : `${nameOf(hs > as ? 'home' : 'away')} win!`;
    overlay.innerHTML = `
      <div class="bb-intro-inner bb-summary">
        <div class="bb-intro-head"><span class="bb-intro-team">Full Time</span></div>
        <div class="bb-summary-score">
          <span class="bb-intro-team--home">${esc(nameOf('home'))}</span>
          <span class="bb-summary-nums">${hs} – ${as}</span>
          <span class="bb-intro-team--away">${esc(nameOf('away'))}</span>
        </div>
        <div class="bb-summary-winner">${esc(winner)}</div>
        <div class="bb-summary-actions">
          <a class="roll-btn bb-intro-start show" href="./" role="button">Back to Menu</a>
        </div>
      </div>`;
    overlay.hidden = false;
    document.body.classList.add('bb-intro-open');
  }

  /* ════════════════════════════════════════════════════════
     FIELDING WIZARD — start of each drive
     The roster trading-cards lay out in a 3-column grid per side.
     A big count shows how many players will take the field; tap a
     card to bench it for this drive. A team (bar Snotlings) can't
     field more than 11, so the start button locks until each side
     is at 11 or fewer. Repurposes the old TEAM-vs-TEAM intro shell.
     ════════════════════════════════════════════════════════ */

  function isOut(side, idx) {
    return !!window.STATUS_META?.[window.getPlayerStatus?.(side, idx)]?.dim;
  }
  function teamIsSnotling(side) {
    const t = window.state?.[side]?.team || {};
    return /snotling/i.test(`${t.name || ''} ${t.id || ''}`);
  }

  /* Boot / reload entry: open the fielding wizard for the first drive unless the
     match is already under way (reload mid-game). */
  function maybeShowIntro() {
    if (engineMode !== 'pre') return;          // already past kickoff (reload)
    startDrive('half-start');
  }

  /* Show the fielding wizard, then hand off to the drive (kickoff) wizard. */
  function startDrive(flow) {
    const overlay = document.getElementById('bb-intro-overlay');
    if (!overlay || !window.PlayerCard) { window.DriveWizard?.open?.(flow); return; }

    const g = gs();
    g.drive = (g.drive || 0) + 1;
    /* Fresh fielding each drive — bench choices are per-drive. */
    window.clearBenched?.('left');
    window.clearBenched?.('right');
    window.persistGameState?.();

    overlay.innerHTML = `
      <div class="bb-intro-inner bb-fielding">
        <div class="bb-intro-head"><span class="bb-intro-team">Drive ${g.drive}</span></div>
        <div class="bb-fld-arena">
          ${sideBlock('left')}
          ${sideBlock('right')}
        </div>
        <button class="roll-btn bb-intro-start" id="bb-fld-start" type="button">Take the Field →</button>
      </div>`;
    overlay.hidden = false;
    document.body.classList.add('bb-intro-open');

    ['left', 'right'].forEach(buildFieldingGrid);

    const startBtn = overlay.querySelector('#bb-fld-start');
    const refresh  = () => updateFieldingState(startBtn);

    overlay.addEventListener('click', (e) => {
      const card = e.target.closest('.bb-fld-card');
      if (!card || card.classList.contains('bb-fld-out')) return;
      const side = card.dataset.side, idx = parseInt(card.dataset.idx, 10);
      const benchIt = !card.classList.contains('bb-fld-benched');
      window.setBenched?.(side, idx, benchIt);
      card.classList.toggle('bb-fld-benched', benchIt);
      refresh();
    });

    startBtn.addEventListener('click', () => {
      if (startBtn.disabled) return;
      window.persistGameState?.();
      overlay.hidden = true;
      overlay.innerHTML = '';
      document.body.classList.remove('bb-intro-open');
      window.DriveWizard?.open?.(flow);
    });

    refresh();
    setTimeout(() => startBtn.classList.add('show'), 200);
  }

  function sideBlock(side) {
    const team = window.state?.[side]?.team || {};
    const cls  = side === 'left' ? 'home' : 'away';
    return `<div class="bb-fld-side ${cls}" data-side="${side}">
        <div class="bb-fld-side-head">
          <span class="bb-fld-team">${esc(team.name || (side === 'left' ? 'Home' : 'Away'))}</span>
          <span class="bb-fld-count" id="bb-fld-count-${side}">0</span>
          <span class="bb-fld-count-cap">on the field</span>
          <span class="bb-fld-msg" id="bb-fld-msg-${side}"></span>
        </div>
        <div class="bb-fld-grid" id="bb-fld-grid-${side}"></div>
      </div>`;
  }

  function buildFieldingGrid(side) {
    const grid = document.getElementById(`bb-fld-grid-${side}`);
    if (!grid) return;
    const st     = window.state?.[side] || {};
    const team   = st.team || {};
    const imgDir = team.imageDir || 'images/';
    const colors = team.colors || {};
    Object.entries(TC_VARS).forEach(([k, prop]) => { if (colors[k]) grid.style.setProperty(prop, colors[k]); });

    (st.players || []).forEach((p, i) => {
      const out  = isOut(side, i);
      const card = document.createElement('div');
      card.className = 'trading-card bb-fld-card'
        + (out ? ' bb-fld-out' : (window.isBenched?.(side, i) ? ' bb-fld-benched' : ''));
      card.dataset.side = side;
      card.dataset.idx  = i;
      card.innerHTML = window.PlayerCard.html(p, { imageDir: imgDir });
      window.PlayerCard.bindImage(card);
      grid.appendChild(card);
    });
  }

  function updateFieldingState(startBtn) {
    let allValid = true;
    ['left', 'right'].forEach(side => {
      const n     = window.fieldedCount?.(side) ?? 0;
      const valid = teamIsSnotling(side) || n <= 11;
      if (!valid) allValid = false;
      const countEl = document.getElementById(`bb-fld-count-${side}`);
      const msgEl   = document.getElementById(`bb-fld-msg-${side}`);
      if (countEl) { countEl.textContent = n; countEl.classList.toggle('over', !valid); }
      if (msgEl) {
        if (valid) { msgEl.textContent = 'Ready to take the field'; msgEl.className = 'bb-fld-msg ok'; }
        else {
          const over = n - 11;
          msgEl.textContent = `Send ${over} more player${over === 1 ? '' : 's'} to the bench`;
          msgEl.className = 'bb-fld-msg bad';
        }
      }
    });
    if (startBtn) startBtn.disabled = !allValid;
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
