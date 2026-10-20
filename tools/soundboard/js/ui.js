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

  // A pad counts only if its clip is loaded; local-only clips are gone after a refresh.
  function hasSoundPads() {
    return model.board.pads.some(function (p) { return !!(p.sound && model.getBuffer(p.sound.id)); });
  }

  // Explicit "I'm done": flush the pending autosave, save, then switch to play mode.
  function saveEdits() {
    if (saveEdits.saving) return;
    saveEdits.saving = true;
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; } // supersede the pending autosave
    var btn = $('#sb-mode');
    if (btn) {
      btn.textContent = 'Saving…';
      btn.disabled = true;
      btn.setAttribute('aria-label', 'Saving…');
    }
    model.save().then(function () {
      setMode('play', false); // already saved — don't re-persist
      lcdMsg(model.serverId ? 'Saved' : 'Saved on this device · sign in to keep it');
    }).catch(function (e) {
      lcdError((e && e.message) ? e.message : 'Save failed');
      renderMode(); // button was disabled while saving — restore the label
    }).then(function () {
      saveEdits.saving = false;
      renderMode(); // re-enable the button (it was rendered while saving was still true)
    });
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
    renderChrome();
    persist();
  }
  // Render without persisting — used on boot so we don't PUT an unchanged board.
  function paint() { renderStage(); renderRack(); renderLCD(); renderChrome(); }

  // Header board name + the bottom sheet's grab-bar label (shown when peeking).
  function renderChrome() {
    var title = $('#sb-title');
    if (title) title.textContent = model.board.name || '';
    var grab = $('#sb-grab-label');
    if (grab) {
      var pad = model.getPad(model.selectedId);
      grab.textContent = pad ? 'Pad \u00b7 ' + pad.label : 'Board settings';
    }
  }


  function select(id) {
    if (model.selectedId === id) return;
    model.setSelected(id);
    renderStage();
    renderRack();
    renderChrome();
  }

  // Button label says the action: in play mode "Edit soundboard", in edit mode "Save edits".
  function renderMode() {
    var app = $('#sb-app');
    if (app) { app.classList.toggle('is-play', mode === 'play'); app.classList.toggle('is-edit', mode === 'edit'); }
    var btn = $('#sb-mode');
    if (btn) {
      btn.classList.toggle('sb-btn--primary', mode === 'edit');
      // Short label + a word that hides on small screens ("✎ Edit[ soundboard]").
      var parts = mode === 'play' ? ['\u270e Edit', ' soundboard'] : ['\u2713 Save', ' edits'];
      btn.textContent = parts[0];
      var wide = document.createElement('span');
      wide.className = 'sb-wide';
      wide.textContent = parts[1];
      btn.appendChild(wide);
      btn.setAttribute('aria-label', parts[0] + parts[1]);
      btn.classList.toggle('is-hidden', !!model.readOnly); // public board: hidden, not disabled
      btn.disabled = saveEdits.saving;
      btn.title = model.readOnly ? 'Public board \u2014 play only' : '';
    }
  }

  // When called from saveEdits, shouldPersist=false: the board was already saved, so
  // skip the (redundant) persist() that render() would schedule. (Not named `render`:
  // that shadowed render() and made every setMode('edit') throw.)
  function setMode(m, shouldPersist) {
    if (model.readOnly && m === 'edit') return; // public board: play-only
    mode = m;
    renderMode();
    if (shouldPersist === false) paint();
    else render();
  }

  // ---- init ----------------------------------------------------------------
  function init() {
    if (init.done) return;
    init.done = true;
    S.sheet.init();

    var modeBtn = $('#sb-mode');
    if (modeBtn) modeBtn.addEventListener('click', function () {
      if (modeBtn.classList.contains('is-hidden')) return; // public board: button hidden
      if (mode === 'play') setMode('edit');
      else saveEdits(); // "Save edits" is an action, not a toggle
    });

    // Ctrl/\u2318+S in edit mode acts like "Save edits"; Escape does NOT save.
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
        if (mode === 'edit' && !model.readOnly) { e.preventDefault(); saveEdits(); }
      }
    });

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
        setMode('play'); // re-render so the mode button is hidden (readOnly is now true)
      })
      .catch(function () {
        model.reset();
        bootLocal();
        lcdError('Board not found or not public \u2014 started local');
      });
  }

  function bootLocal() {
    var restored = model.loadFromStorage();
    var needing = 0;
    model.board.pads.forEach(function (p) { if (p.sound && !model.getBuffer(p.sound.id)) needing++; });
    if (restored && hasSoundPads()) { mode = 'play'; renderMode(); paint(); }
    else { setMode('edit'); } // fresh visit or nothing playable: open the editor
    lcdMsg((restored ? 'Restored ' : 'READY ') + '\u00b7 ' + model.board.pads.length + ' pads' +
      (needing ? ' \u00b7 ' + needing + ' re-attach' : '') + ' \u00b7 local mode' +
      (!restored ? ' \u00b7 sign in to save' : ''));
  }

  function bootCloud(user) {
    var params = new URLSearchParams(location.search);
    var boardParam = params.get('board');
    function finish(boardName) {
      if (hasSoundPads()) { mode = 'play'; renderMode(); paint(); } else { setMode('edit'); }
      var needing = 0;
      model.board.pads.forEach(function (p) { if (p.sound && !model.getBuffer(p.sound.id)) needing++; });
      lcdMsg((boardName ? 'Loaded ' + boardName : 'Cloud ready') + ' \u00b7 ' + model.board.pads.length + ' pads' +
        (needing ? ' \u00b7 ' + needing + ' re-attach' : '') + ' \u00b7 ' + (user.username || 'signed in'));
      if (mode === 'play') paint();
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
    renderLCD: renderLCD, lcdMsg: lcdMsg, lcdError: lcdError, renderChrome: renderChrome,
  };
})(typeof self !== 'undefined' ? self : this);
