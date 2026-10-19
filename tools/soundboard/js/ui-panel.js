/* Soundboard UI — the edit panel ("rack"): board settings, server boards list,
 * and the selected pad's label/colour/geometry/sound/effects. */
(function (root) {
  'use strict';

  var S = root.SoundBoard;
  var core = S.core;
  var model = S.model;
  var engine = S.engine;
  var api = root.SBApi;
  var D = S.dom;
  var $ = D.$, make = D.make;
  var section = D.section, hintBox = D.hintBox, fmtVal = D.fmtVal, numSafe = D.numSafe;
  var livePads = S.stage.livePads;

  // Calls into sibling modules, resolved at call time so load order is free.
  function persist() { S.ui.persist(); }
  function render() { S.ui.render(); }
  function lcdMsg(t) { S.ui.lcdMsg(t); }
  function lcdError(t) { S.ui.lcdError(t); }
  function select(id) { S.ui.select(id); }
  function renderStage() { S.stage.renderStage(); }
  function accountSection() { return S.account.accountSection(); }
  function librarySection() { return S.library.librarySection(); }
  function openFilePicker() { S.library.openFilePicker(); }
  function hydrateSounds() { return S.library.hydrateSounds(); }

  function renderRack() {
    var rack = $('#sb-rack');
    if (!rack) return;
    rack.innerHTML = '';
    rack.appendChild(accountSection());
    if (model.readOnly) {
      rack.appendChild(hintBox('You are viewing a public board. Pads are play-only. Sign in above to create and share your own board.'));
      return;
    }
    if (S.ui.getMode() === 'play') {
      rack.appendChild(hintBox('PLAY MODE — tap the pads to fire. Switch to EDIT to change the board.'));
    } else {
      rack.appendChild(boardsSection());
      rack.appendChild(boardSection());
      rack.appendChild(selectedPadSection());
      rack.appendChild(librarySection());
    }
  }


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

  root.SoundBoard.panel = { renderRack: renderRack };
})(typeof self !== 'undefined' ? self : this);
