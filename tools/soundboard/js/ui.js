/* Soundboard UI — mode, status line, render orchestration, and boot.
 *
 * Two modes: EDIT (build the board, tweak pads/effects) and PLAY (clean firing surface).
 * Render is a simple full re-render of the stage + rack on state change — fine for a
 * small board, keeps the code honest and free of stale-DOM bugs. The stage, panel,
 * library and account live in ui-stage.js / ui-panel.js / ui-library.js / ui-account.js
 * and call back into this module through window.SoundBoard.ui.
 */
(function (root) {
  'use strict';

  var S = root.SoundBoard;
  var model = S.model;
  var engine = S.engine;
  var api = root.SBApi;
  var $ = S.dom.$;
  var livePads = S.stage.livePads;

  function renderStage() { S.stage.renderStage(); }
  function renderRack() { S.panel.renderRack(); }
  function hydrateSounds() { return S.library.hydrateSounds(); }
  function onFile(files) { S.library.onFile(files); }

  var mode = 'edit';
  var status = { text: 'READY', tone: 'ok' };

  var saveTimer = null;
  function persist() {
    if (saveTimer) return;
    saveTimer = setTimeout(function () {
      saveTimer = null;
      model.save().catch(function (e) {
        lcdError((e && e.message) ? e.message : 'Save failed');
      });
    }, 150);
  }

  // ---- status LCD ----------------------------------------------------------
  function renderLCD() {
    var el = $('#sb-lcd');
    if (!el) return;
    el.textContent = status.text;
    el.className = 'sb-lcd' + (status.tone === 'error' ? ' is-error' : '');
    var led = $('#sb-power');
    if (led) led.className = 'sb-led on' + (livePads.size > 0 ? ' is-live' : '');
  }
  function lcdMsg(text) { status = { text: text, tone: 'ok' }; renderLCD(); }
  function lcdError(text) { status = { text: 'ERR ' + text, tone: 'error' }; renderLCD(); }

  // ---- rendering -----------------------------------------------------------
  function render() {
    renderStage();
    renderRack();
    renderLCD();
    persist();
  }
  // Render without persisting — used on boot so we don't PUT an unchanged board.
  function paint() { renderStage(); renderRack(); renderLCD(); }

  function select(id) {
    if (model.selectedId === id) return;
    model.setSelected(id);
    renderStage();
    renderRack();
  }

  function setMode(m) {
    if (model.readOnly && m === 'edit') return; // public board: play-only
    mode = m;
    var app = $('#sb-app');
    if (app) { app.classList.toggle('is-play', m === 'play'); app.classList.toggle('is-edit', m === 'edit'); }
    var btn = $('#sb-mode');
    if (btn) {
      btn.textContent = m === 'play' ? '\u25b6 PLAY MODE' : '\u270e EDIT MODE';
      btn.setAttribute('aria-pressed', m === 'play' ? 'true' : 'false');
      btn.disabled = !!model.readOnly;
      btn.title = model.readOnly ? 'Public board \u2014 play only' : '';
    }
    render();
  }

  // ---- init ----------------------------------------------------------------
  function init() {
    if (init.done) return;
    init.done = true;

    var modeBtn = $('#sb-mode');
    if (modeBtn) modeBtn.addEventListener('click', function () { setMode(mode === 'play' ? 'edit' : 'play'); });

    var stopBtn = $('#sb-stop');
    if (stopBtn) stopBtn.addEventListener('click', function () {
      engine.stopAll();
      livePads.forEach(function (id) { var n = $('#sb-stage [data-pad="' + id + '"]'); if (n) n.classList.remove('is-live'); });
      livePads.clear();
      renderLCD();
      lcdMsg('Stopped');
    });

    var file = $('#sb-file');
    if (file) file.addEventListener('change', function () { onFile(file.files); file.value = ''; });

    // Re-evaluate the board mode whenever auth changes (sign in / out).
    document.addEventListener('sb:auth-changed', function () { boot(); });

    boot();
  }

  function boot() {
    var boardParam = new URLSearchParams(location.search).get('board');
    if (!api) { if (boardParam) bootPublic(boardParam); else bootLocal(); return; }
    api.me().then(function (user) {
      if (user) { bootCloud(user); }
      else if (boardParam) { bootPublic(boardParam); }
      else { bootLocal(); }
    });
  }

  function bootPublic(boardId) {
    model.reset();
    setMode('play');
    model.loadPublicBoard(boardId)
      .then(function (g) { return hydrateSounds().then(function () { return g; }); })
      .then(function (g) {
        var owner = g.owner ? (' \u00b7 by ' + g.owner) : '';
        lcdMsg('PUBLIC \u00b7 ' + (g.name || 'board') + owner + ' \u00b7 ' + model.board.pads.length + ' pads \u00b7 tap to play');
        setMode('play'); // refreshes the (now disabled) mode button
      })
      .catch(function () {
        model.reset();
        bootLocal();
        lcdError('Board not found or not public \u2014 started local');
      });
  }

  function bootLocal() {
    var restored = model.loadFromStorage();
    setMode('edit');
    var needing = 0;
    model.board.pads.forEach(function (p) { if (p.sound && !model.getBuffer(p.sound.id)) needing++; });
    if (restored) {
      lcdMsg('Restored \u00b7 ' + model.board.pads.length + ' pads' + (needing ? ' \u00b7 ' + needing + ' re-attach' : '') + ' \u00b7 local mode');
    } else {
      lcdMsg('READY \u00b7 ' + model.board.pads.length + ' pads \u00b7 local mode \u00b7 sign in to save');
    }
  }

  function bootCloud(user) {
    var params = new URLSearchParams(location.search);
    var boardParam = params.get('board');
    function finish(boardName) {
      setMode('edit');
      var needing = 0;
      model.board.pads.forEach(function (p) { if (p.sound && !model.getBuffer(p.sound.id)) needing++; });
      lcdMsg((boardName ? 'Loaded ' + boardName : 'Cloud ready') + ' \u00b7 ' + model.board.pads.length + ' pads' +
        (needing ? ' \u00b7 ' + needing + ' re-attach' : '') + ' \u00b7 ' + (user.username || 'signed in'));
      paint();
    }
    if (boardParam) {
      model.loadBoard(boardParam)
        .then(function (g) { return hydrateSounds().then(function () { return g; }); })
        .then(function (g) { finish(g.name); })
        .catch(function () {
          // Not this user's board (403/404); it may be a shared public board. Try the public endpoint.
          bootPublic(boardParam);
        });
    } else {
      model.loadFromStorage();
      hydrateSounds().then(function () { finish(null); });
    }
  }

  root.SoundBoard = root.SoundBoard || {};
  root.SoundBoard.ui = {
    init: init, setMode: setMode, getMode: function () { return mode; },
    render: render, paint: paint, persist: persist, select: select,
    renderLCD: renderLCD, lcdMsg: lcdMsg, lcdError: lcdError,
  };
})(typeof self !== 'undefined' ? self : this);
