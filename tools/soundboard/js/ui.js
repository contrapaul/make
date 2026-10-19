/* Soundboard UI — renders the hardware shell and wires the model + engine to the DOM.
 *
 * Two modes: EDIT (build the board, tweak pads/effects) and PLAY (clean firing surface).
 * Render is a simple full re-render of the stage + rack on state change — fine for a
 * small board, keeps the code honest and free of stale-DOM bugs.
 */
(function (root) {
  'use strict';

  var core = root.SoundBoard.core;
  var model = root.SoundBoard.model;
  var engine = root.SoundBoard.engine;
  var api = root.SBApi;

  var MAX_FILE = 2 * 1024 * 1024; // 2MB, per blueprint Q4
  var AUDIO_EXT = /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|webm)$/i;

  var mode = 'edit';
  var livePads = new Set();
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

  // ---- tiny DOM helpers ----------------------------------------------------
  function $(sel, el) { return (el || document).querySelector(sel); }
  function make(tag, props, children) {
    var n = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        if (k === 'class') n.className = props[k];
        else if (k === 'text') n.textContent = props[k];
        else if (k === 'html') n.innerHTML = props[k];
        else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), props[k]);
        else if (props[k] != null) n.setAttribute(k, props[k]);
      });
    }
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function hexToRgba(hex, a) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return 'rgba(255,138,30,' + a + ')';
    var n = parseInt(m[1], 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function isAudioFile(f) {
    if (!f) return false;
    return (f.type && f.type.indexOf('audio/') === 0) || AUDIO_EXT.test(f.name || '');
  }
  function fmtVal(v, unit) {
    var n = Number(v);
    var s = (n >= 1000 && unit === 'Hz') ? (n / 1000).toFixed(1) + 'k' : (Math.round(n * 100) / 100);
    return s + (unit || '');
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

  function renderStage() {
    var stage = $('#sb-stage');
    if (!stage) return;
    var cols = model.board.layout.cols, rows = model.board.layout.rows;
    stage.style.setProperty('--cols', cols);
    stage.style.setProperty('--rows', rows);
    stage.innerHTML = '';
    model.board.pads.forEach(function (pad) { stage.appendChild(padNode(pad)); });
    if (!model.board.pads.length) {
      stage.appendChild(make('div', { class: 'sb-empty', text: 'No pads yet — add one in the control rack \u2192' }));
    }
  }

  function padNode(pad) {
    var b = make('button', {
      type: 'button',
      class: 'sb-pad' + (model.selectedId === pad.id ? ' is-selected' : '') + (livePads.has(pad.id) ? ' is-live' : '') + (pad.sound && !model.getBuffer(pad.sound.id) ? ' is-dead' : ''),
      'data-pad': pad.id,
      'aria-label': 'Pad ' + pad.label,
    });
    b.style.gridColumn = (pad.x + 1) + ' / span ' + pad.w;
    b.style.gridRow = (pad.y + 1) + ' / span ' + pad.h;
    b.style.setProperty('--pad-rest', hexToRgba(pad.color, 0.18));
    b.style.setProperty('--pad-live', hexToRgba(pad.color, 0.85));
    b.style.setProperty('--pad-glow', hexToRgba(pad.color, 0.55));
    b.append(
      make('span', { class: 'sb-pad__led' }),
      make('span', { class: 'sb-pad__emoji', text: pad.emoji || '' }),
      make('span', { class: 'sb-pad__label', text: pad.label }),
      make('span', { class: 'sb-pad__snd', text: pad.sound ? (model.getBuffer(pad.sound.id) ? (pad.sound.name || '\u266a') : 'no clip') : '' }),
    );
    b.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (mode !== 'play') select(pad.id);
      if (pad.sound && model.getBuffer(pad.sound.id)) trigger(pad);
      else if (pad.sound) lcdError('No clip for ' + pad.label + (model.readOnly ? '' : ' - re-attach it in EDIT'));
    });
    b.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (mode !== 'play') select(pad.id);
        if (pad.sound && model.getBuffer(pad.sound.id)) trigger(pad);
      }
    });
    return b;
  }

  function renderRack() {
    var rack = $('#sb-rack');
    if (!rack) return;
    rack.innerHTML = '';
    rack.appendChild(accountSection());
    if (model.readOnly) {
      rack.appendChild(hintBox('You are viewing a public board. Pads are play-only. Sign in above to create and share your own board.'));
      return;
    }
    if (mode === 'play') {
      rack.appendChild(hintBox('PLAY MODE — tap the pads to fire. Switch to EDIT to change the board.'));
    } else {
      rack.appendChild(boardsSection());
      rack.appendChild(boardSection());
      rack.appendChild(selectedPadSection());
      rack.appendChild(librarySection());
    }
  }

  function section(title, children) {
    var s = make('section', { class: 'sb-sec' }, [make('h3', { text: title })]);
    children.forEach(function (c) { if (c) s.appendChild(c); });
    return s;
  }
  function hintBox(text) { return make('p', { class: 'sb-hint', text: text }); }

  // ---- board section (always visible) --------------------------------------
  function boardSection() {
    var name = make('input', { class: 'sb-input', type: 'text', value: model.board.name, 'aria-label': 'Board name' });
    name.addEventListener('input', function () { model.board.name = name.value; persist(); });
    var master = make('input', { class: 'sb-range', type: 'range', min: 0, max: 2, step: 0.01, value: model.board.master.gain, 'aria-label': 'Master volume' });
    var masterVal = make('span', { class: 'sb-fx__val', text: fmtVal(model.board.master.gain, '') });
    master.addEventListener('input', function () {
      model.board.master.gain = parseFloat(master.value);
      engine.setMaster(parseFloat(master.value));
      masterVal.textContent = fmtVal(master.value, '');
      persist();
    });
    var addBtn = make('button', { type: 'button', class: 'sb-btn', text: '+ Add pad', onclick: addPadClick });
    var resetBtn = make('button', { type: 'button', class: 'sb-btn sb-btn--warn', text: 'Reset board', onclick: resetClick });
    var nameField = make('div', { class: 'sb-field' }, [
      make('label', { text: 'Board name' }),
      name,
    ]);
    var masterField = make('div', { class: 'sb-field' }, [
      make('div', { class: 'sb-fx__head' }, [make('span', { class: 'sb-fx__label', text: 'Master level' }), masterVal]),
      master,
    ]);
    var btnRow = make('div', { class: 'sb-row' }, [addBtn, resetBtn]);

    // Public toggle + share link (needs a signed-in owner with a saved board).
    var pubField = make('div', { class: 'sb-field sb-pub' });
    var shareField = null;
    if (api && api.user && model.serverId) {
      var pub = make('input', { type: 'checkbox', 'aria-label': 'Public board' });
      pub.checked = !!model.board.isPublic;
      pub.addEventListener('change', function () { model.setPublic(pub.checked); persist(); });
      pubField.appendChild(make('label', { class: 'sb-pub__label' }, [pub, make('span', { text: 'Public \u2014 anyone with the link can open and play it.' })]));
      var shareUrl = location.origin + '/tools/soundboard/?board=' + encodeURIComponent(model.serverId);
      var shareInput = make('input', { class: 'sb-input sb-share', type: 'text', value: shareUrl, readonly: 'readonly' });
      var copyBtn = make('button', { type: 'button', class: 'sb-btn', text: 'Copy link', onclick: function () {
        shareInput.select();
        var done = function () { copyBtn.textContent = 'Copied'; setTimeout(function () { copyBtn.textContent = 'Copy link'; }, 1200); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(shareUrl).then(done, function () { shareInput.select(); document.execCommand('copy'); done(); });
        } else { shareInput.select(); document.execCommand('copy'); done(); }
      }});
      shareField = make('div', { class: 'sb-field' }, [make('label', { text: 'Share link' }), make('div', { class: 'sb-row' }, [shareInput, copyBtn])]);
    } else {
      pubField.appendChild(hintBox('Sign in and save a board to unlock the public toggle and a share link.'));
    }
    return section('Board', [nameField, masterField, btnRow, pubField, shareField]);
  }

  function addPadClick() {
    var p;
    try { p = model.addPad({ w: 1, h: 1 }); } catch (e) { lcdError('Board is full — no room for another pad'); return; }
    select(p.id);
    render();
    lcdMsg('Added ' + p.label + ' — assign a sound below');
  }
  function resetClick() {
    if (!window.confirm('Reset the board to the default layout? Local sounds stay in the library.')) return;
    engine.stopAll();
    livePads.clear();
    model.reset();
    render();
    lcdMsg('Board reset');
  }

  // ---- selected-pad section (edit mode) ------------------------------------
  function selectedPadSection() {
    var pad = model.getPad(model.selectedId);
    if (!pad) {
      return section('Pad', [hintBox('Select a pad on the grid to edit its sound, layout, and effects.')]);
    }

    // label + emoji
    var label = make('input', { class: 'sb-input', type: 'text', value: pad.label, 'aria-label': 'Pad label' });
    label.addEventListener('input', function () { pad.label = label.value; syncPadLabel(pad); persist(); });
    var emoji = make('input', { class: 'sb-input', type: 'text', value: pad.emoji || '', placeholder: 'e.g. \ud83d\udd0a', 'aria-label': 'Pad emoji' });
    emoji.addEventListener('input', function () { pad.emoji = emoji.value; syncPadEmoji(pad); persist(); });

    // color swatches
    var swatches = make('div', { class: 'swatches' });
    core.PALETTE.forEach(function (c) {
      var sw = make('button', { type: 'button', class: 'swatch' + (pad.color === c ? ' is-active' : ''), style: 'background:' + c, 'aria-label': 'color ' + c, onclick: function () { pad.color = c; renderStage(); swatches.querySelectorAll('.swatch').forEach(function (s) { s.classList.remove('is-active'); }); sw.classList.add('is-active'); persist(); } });
      swatches.appendChild(sw);
    });

    // loop
    var loop = make('input', { type: 'checkbox', 'aria-label': 'Loop' });
    loop.checked = !!pad.loop;
    loop.addEventListener('change', function () { pad.loop = loop.checked; persist(); });
    var loopRow = make('label', { class: 'sb-check' }, [loop, make('span', { text: 'Loop' })]);

    // geometry (x, y, w, h)
    var geo = geoControls(pad);

    // sound
    var sound = soundControls(pad);

    // effects
    var fx = effectsControls(pad);

    var del = make('button', { type: 'button', class: 'sb-btn sb-btn--danger', text: '\u2715 Delete pad', onclick: function () { if (window.confirm('Delete pad ' + pad.label + '?')) { model.removePad(pad.id); render(); lcdMsg('Deleted ' + pad.label); } } });

    var kids = [
      make('div', { class: 'sb-grid2' }, [
        make('div', { class: 'sb-field' }, [make('label', { text: 'Label' }), label]),
        make('div', { class: 'sb-field' }, [make('label', { text: 'Emoji' }), emoji]),
      ]),
      make('div', { class: 'sb-field' }, [make('label', { text: 'Color' }), swatches]),
      loopRow,
      geo,
      sound,
      fx,
      del,
    ];
    return section('Pad \u00b7 ' + pad.label, kids);
  }

  function syncPadLabel(pad) { var n = $('#sb-stage [data-pad="' + pad.id + '"] .sb-pad__label'); if (n) n.textContent = pad.label; }
  function syncPadEmoji(pad) { var n = $('#sb-stage [data-pad="' + pad.id + '"] .sb-pad__emoji'); if (n) n.textContent = pad.emoji || ''; }

  function geoControls(pad) {
    var cols = model.board.layout.cols, rows = model.board.layout.rows;
    function field(key, min, max, setter) {
      var inp = make('input', { class: 'sb-num', type: 'number', min: min, max: max, step: 1, value: String(pad[key]), 'aria-label': key });
      inp.addEventListener('change', function () {
        var v = parseInt(inp.value, 10);
        var ok = setter(v);
        if (ok) { renderStage(); persist(); }
        else { lcdError('Can\u2019t place/size there'); renderRack(); }
      });
      return make('div', { class: 'sb-field sb-field--sm' }, [make('label', { text: key.toUpperCase() }), inp]);
    }
    var wrap = make('div', { class: 'sb-grid4' }, [
      field('x', 0, cols - 1, function (v) { return model.movePad(pad.id, v, pad.y); }),
      field('y', 0, rows - 1, function (v) { return model.movePad(pad.id, pad.x, v); }),
      field('w', 1, cols, function (v) { return model.resizePad(pad.id, v, pad.h); }),
      field('h', 1, rows, function (v) { return model.resizePad(pad.id, pad.w, v); }),
    ]);
    var head = make('div', { class: 'sb-subhead', text: 'Position & size (grid ' + cols + '\u00d7' + rows + ')' });
    return make('div', {}, [head, wrap]);
  }

  function soundControls(pad) {
    var current = pad.sound;
    var curBox = make('div', { class: 'sb-snd-cur' }, [
      make('span', { class: 'sb-snd-name', text: current ? (current.name || 'sound') : 'no sound assigned' }),
      make('button', { type: 'button', class: 'sb-btn', text: current ? 'Replace' : 'Load sound', onclick: openFilePicker }),
    ]);
    if (current) {
      curBox.appendChild(make('button', { type: 'button', class: 'sb-btn sb-btn--warn', text: 'Clear', onclick: function () { pad.sound = null; render(); } }));
    }
    var head = make('div', { class: 'sb-subhead', text: 'Sound' });
    return make('div', { class: 'sb-block' }, [head, curBox, hintBox('Assign a library clip to this pad below, or load a new file.')]);
  }

  function effectsControls(pad) {
    var wrap = make('div', { class: 'sb-fxwrap' });
    core.EFFECTS.forEach(function (fx) {
      var block = make('div', { class: 'sb-fxblock' }, [make('div', { class: 'sb-subhead', text: fx.label })]);
      if (fx.select) {
        var sel = make('select', { class: 'sb-input', 'aria-label': fx.select.label });
        fx.select.options.forEach(function (opt) {
          var o = make('option', { value: opt, text: opt });
          if ((pad.effects[fx.select.key] || fx.select.def) === opt) o.selected = true;
          sel.appendChild(o);
        });
        sel.addEventListener('change', function () { pad.effects[fx.select.key] = sel.value; });
        block.appendChild(make('div', { class: 'sb-field' }, [make('label', { text: fx.select.label }), sel]));
      }
      fx.sliders.forEach(function (s) {
        block.appendChild(sliderRow(pad, s));
      });
      wrap.appendChild(block);
    });
    var head = make('div', { class: 'sb-subhead', text: 'Effects' });
    return make('div', { class: 'sb-block' }, [head, wrap]);
  }

  function sliderRow(pad, s) {
    var val = numSafe(pad.effects[s.key], s.def);
    var valEl = make('span', { class: 'sb-fx__val', text: fmtVal(val, s.unit) });
    var input = make('input', { class: 'sb-range', type: 'range', min: s.min, max: s.max, step: s.step, value: String(val), 'aria-label': s.label });
    input.addEventListener('input', function () {
      pad.effects[s.key] = parseFloat(input.value);
      valEl.textContent = fmtVal(input.value, s.unit);
      persist();
    });
    return make('div', { class: 'sb-fx' }, [
      make('div', { class: 'sb-fx__head' }, [make('span', { class: 'sb-fx__label', text: s.label }), valEl]),
      input,
    ]);
  }
  function numSafe(v, d) { var n = Number(v); return isFinite(n) ? n : d; }

  // ---- library section (edit mode) -----------------------------------------
  function librarySection() {
    var add = make('button', { type: 'button', class: 'sb-btn', text: '+ Load audio file', onclick: openFilePicker });
    var list = make('div', { class: 'sb-lib' });
    if (!model.library.length) {
      list.appendChild(hintBox('No clips yet. Load a file (max 2 MB); it appears here for any pad.'));
    } else {
      model.library.forEach(function (s) {
        var target = model.getPad(model.selectedId);
        var item = make('div', { class: 'lib-item' }, [
          make('div', { class: 'lib-item__meta' }, [
            make('span', { class: 'lib-item__name', text: s.name }),
            make('span', { class: 'lib-item__size', text: (s.size / 1024).toFixed(0) + ' KB' }),
          ]),
          make('button', { type: 'button', class: 'sb-btn', text: target ? 'Assign' : 'Pick pad', onclick: function () { assignToPad(s); } }),
          make('button', { type: 'button', class: 'sb-btn sb-btn--warn', text: '\u00d7', title: 'Remove', 'aria-label': 'Remove ' + s.name + ' from library', onclick: function () { model.removeLibrarySound(s.id); render(); } }),
        ]);
        list.appendChild(item);
      });
    }
    return section('Library', [make('div', { class: 'sb-row' }, [add]), list]);
  }

  function assignToPad(s) {
    var target = model.getPad(model.selectedId);
    if (!target) { lcdError('Select a pad on the grid first, then assign'); return; }
    padSoundAssign(target, s);
    render();
    lcdMsg('Assigned "' + s.name + '" to ' + target.label);
  }
  function padSoundAssign(pad, s) {
    // Buffer stays in the model cache; the pad stores only serializable meta.
    if (s.buffer) model.setBuffer(s.id, s.buffer);
    pad.sound = { id: s.id, name: s.name, size: s.size, mime: s.mime || (s.type || 'audio') };
  }

  function openFilePicker() { $('#sb-file').click(); }

  function onFile(files) {
    var file = files && files[0];
    if (!file) return;
    if (file.size > MAX_FILE) { lcdError('File too large \u2014 max 2 MB'); return; }
    if (!isAudioFile(file)) { lcdError('That doesn\u2019t look like an audio file'); return; }
    var mime = file.type || 'audio';
    var target = model.getPad(model.selectedId);

    if (api && api.user) {
      // Signed in: upload to the server AND decode locally for instant playback.
      lcdMsg('Uploading "' + file.name + '" \u2026');
      Promise.all([engine.decode(file), api.uploadSound(file, file.name, mime)])
        .then(function (res) {
          var buffer = res[0];
          var meta = res[1]; // { id, name, size, mime }
          model.setBuffer(meta.id, buffer);
          var s = model.addLibrarySound(meta);
          if (target) padSoundAssign(target, s);
          render();
          lcdMsg('Uploaded "' + meta.name + '"' + (target ? ' \u2192 ' + target.label : ''));
        })
        .catch(function (err) {
          lcdError((err && err.message) ? ('Upload failed: ' + err.message) : 'Upload failed');
        });
    } else {
      // Signed out: decode locally only \u2014 the clip lives in this session (Phase A).
      lcdMsg('Decoding \u2026');
      engine.decode(file).then(function (buffer) {
        var s = model.addLibrarySound({ id: core.uid('s_'), name: file.name, size: file.size, mime: mime, buffer: buffer });
        if (target) padSoundAssign(target, s);
        render();
        lcdMsg('Loaded "' + file.name + '"' + (target ? ' \u2192 ' + target.label : '') + ' \u00b7 local (sign in to save)');
      }).catch(function (err) {
        lcdError('Could not decode audio' + (err && err.message ? ': ' + err.message : ''));
      });
    }
  }

  // ---- play ----------------------------------------------------------------
  // ---- account (auth) ------------------------------------------------------
  function accountSection() {
    if (api && api.user) {
      var out = make('button', { type: 'button', class: 'sb-btn sb-btn--warn', text: 'Sign out', onclick: function () {
        api.logout().then(function () { model.clearBuffers(); model.reset(); render(); lcdMsg('Signed out \u00b7 local mode'); });
      }});
      return section('Account', [
        make('p', { class: 'sb-hint', text: 'Signed in as ' + (api.user.username || api.user.email || 'you') + ' \u00b7 boards save to the cloud.' }),
        make('div', { class: 'sb-row' }, [out]),
      ]);
    }
    var email = make('input', { class: 'sb-input', type: 'email', placeholder: 'email', 'aria-label': 'Email' });
    var pass = make('input', { class: 'sb-input', type: 'password', placeholder: 'password', 'aria-label': 'Password' });
    var signIn = make('button', { type: 'button', class: 'sb-btn', text: 'Sign in', onclick: function () {
      if (!email.value || !pass.value) { lcdError('Enter email and password'); return; }
      api.login(email.value, pass.value)
        .then(function () { render(); lcdMsg('Signed in \u00b7 cloud mode'); })
        .catch(function (e) { lcdError((e && e.message) || 'Sign in failed'); });
    }});
    return section('Account', [
      make('p', { class: 'sb-hint', text: 'Sign in (same account as the rest of the site) to save boards and sounds to the cloud.' }),
      make('div', { class: 'sb-field' }, [make('label', { text: 'Email' }), email]),
      make('div', { class: 'sb-field' }, [make('label', { text: 'Password' }), pass]),
      make('div', { class: 'sb-row' }, [signIn]),
    ]);
  }

  // ---- boards (server) -----------------------------------------------------
  function boardsSection() {
    if (!(api && api.user)) {
      return section('Boards', [hintBox('Sign in above to create boards and save them to the cloud.')]);
    }
    var newBtn = make('button', { type: 'button', class: 'sb-btn', text: '+ New board', onclick: function () {
      model.createBoard()
        .then(function () { return hydrateSounds(); })
        .then(function () { render(); lcdMsg('New board created'); })
        .catch(function (e) { lcdError((e && e.message) || 'Could not create board'); });
    }});
    var listEl = make('div', { class: 'sb-boards' });
    listEl.appendChild(hintBox('Loading boards\u2026'));
    refreshBoardList(listEl);
    return section('Boards', [make('div', { class: 'sb-row' }, [newBtn]), listEl]);
  }
  function refreshBoardList(el) {
    el.innerHTML = '';
    model.listBoards().then(function (boards) {
      if (!boards.length) { el.appendChild(hintBox('No boards yet \u2014 create one.')); return; }
      boards.forEach(function (b) {
        var active = model.serverId === b.id;
        var item = make('div', { class: 'board-item' + (active ? ' is-active' : '') }, [
          make('span', { class: 'board-item__name', text: b.name }),
          make('button', { type: 'button', class: 'sb-btn', text: active ? 'Current' : 'Load', 'disabled': active ? 'disabled' : null, 'aria-label': active ? 'Current board: ' + b.name : 'Load board ' + b.name, onclick: function () {
            if (active) return;
            model.loadBoard(b.id)
              .then(function () { return hydrateSounds(); })
              .then(function () { render(); lcdMsg('Loaded board'); })
              .catch(function (e) { lcdError((e && e.message) || 'Could not load board'); });
          }}),
        ]);
        el.appendChild(item);
      });
    }).catch(function (e) {
      el.innerHTML = '';
      el.appendChild(hintBox('Could not load boards' + (e && e.message ? ': ' + e.message : '')));
    });
  }

  // ---- hydrate: fetch + decode the sounds a loaded board references ---------
  function hydrateSounds() {
    var seen = {};
    model.board.pads.forEach(function (p) { if (p.sound && p.sound.id) seen[p.sound.id] = true; });
    var jobs = Object.keys(seen).map(function (id) {
      if (model.getBuffer(id)) return Promise.resolve();
      return fetch(api.soundUrl(id))
        .then(function (r) { if (!r.ok) throw new Error('nf'); return r.blob().then(function (b) { return engine.decode(b); }); })
        .then(function (buf) { model.setBuffer(id, buf); })
        .catch(function () { /* local id or missing: leave for re-attach */ });
    });
    return Promise.all(jobs);
  }

  function select(id) {
    if (model.selectedId === id) return;
    model.setSelected(id);
    renderStage();
    renderRack();
  }

  function trigger(pad) {
    var buf = pad.sound && model.getBuffer(pad.sound.id);
    if (!buf) return;
    engine.setMaster(model.board.master.gain);
    engine.play(buf, pad);
    livePads.add(pad.id);
    var node = $('#sb-stage [data-pad="' + pad.id + '"]');
    if (node) node.classList.add('is-live');
    renderLCD();
    pad._onended = function () {
      livePads.delete(pad.id);
      var n = $('#sb-stage [data-pad="' + pad.id + '"]');
      if (n) n.classList.remove('is-live');
      renderLCD();
    };
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
  root.SoundBoard.ui = { init: init, setMode: setMode };
})(typeof self !== 'undefined' ? self : this);
