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
  function librarySection() { return S.library.librarySection(); }
  function openFilePicker() { S.library.openFilePicker(); }
  function boardsSection() { return S.boards.boardsSection(); }

  function renderRack() {
    var rack = $('#sb-rack');
    if (!rack) return;
    rack.innerHTML = '';
    if (model.readOnly) {
      rack.appendChild(hintBox('You are viewing a public board. Pads are play-only. Sign in (top right) to create and share your own board.'));
      return;
    }
    if (S.ui.getMode() === 'play') {
      rack.appendChild(hintBox('Tap the pads to fire. Tap “✎ Edit soundboard” to change the board.'));
    } else {
      // The selected pad's settings come first: on a phone the sheet shows only the top.
      var order = model.getPad(model.selectedId)
        ? [selectedPadSection, librarySection, boardSection, boardsSection]
        : [boardSection, boardsSection, selectedPadSection, librarySection];
      order.forEach(function (build) { rack.appendChild(build()); });
    }
  }


  // ---- board section (always visible) --------------------------------------
  function boardSection() {
    var name = make('input', { class: 'sb-input', type: 'text', value: model.board.name, 'aria-label': 'Board name' });
    name.addEventListener('input', function () { model.board.name = name.value; S.ui.renderChrome(); persist(); });
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
    var gridField = make('div', { class: 'sb-field' }, [
      make('label', { text: 'Grid size' }),
      make('div', { class: 'sb-row sb-steppers' }, [
        stepper('Columns', 'cols'),
        stepper('Rows', 'rows'),
      ]),
    ]);

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
    return section('Board', [nameField, masterField, gridField, btnRow, pubField, shareField]);
  }

  // − / value / + for the grid size (3–12). Shrinking past a pad is refused, not forced.
  function stepper(label, key) {
    var val = model.board.layout[key];
    function change(delta) {
      var cols = model.board.layout.cols + (key === 'cols' ? delta : 0);
      var rows = model.board.layout.rows + (key === 'rows' ? delta : 0);
      if (cols < 3 || rows < 3 || cols > 12 || rows > 12) return;
      if (!S.geometry.layoutFits(model.board, cols, rows)) {
        lcdError('Move or shrink the pads in the last ' + (key === 'cols' ? 'column' : 'row') + ' first');
        return;
      }
      core.setLayout(model.board, cols, rows);
      render();
    }
    return make('div', { class: 'sb-stepper', role: 'group', 'aria-label': label }, [
      make('span', { class: 'sb-stepper__label', text: label }),
      make('button', { type: 'button', class: 'sb-btn sb-stepper__btn', text: '\u2212', 'aria-label': 'Fewer ' + label.toLowerCase(), disabled: val <= 3 ? 'disabled' : null, onclick: function () { change(-1); } }),
      make('span', { class: 'sb-stepper__val', text: String(val), 'aria-live': 'polite' }),
      make('button', { type: 'button', class: 'sb-btn sb-stepper__btn', text: '+', 'aria-label': 'More ' + label.toLowerCase(), disabled: val >= 12 ? 'disabled' : null, onclick: function () { change(1); } }),
    ]);
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

    // colours + fonts, all inline (ui-style.js, e01s09)
    var look = S.styleControls(pad);

    // loop
    var loop = make('input', { type: 'checkbox', 'aria-label': 'Loop' });
    loop.checked = !!pad.loop;
    loop.addEventListener('change', function () { pad.loop = loop.checked; persist(); });
    var loopRow = make('label', { class: 'sb-check' }, [loop, make('span', { text: 'Loop' })]);

    // preview (edit-mode taps select instead of playing, D29) + how to move/resize
    var canPlay = !!(pad.sound && model.getBuffer(pad.sound.id));
    var preview = make('button', { type: 'button', class: 'sb-btn', text: '\u25b6 Preview', disabled: canPlay ? null : 'disabled',
      onclick: function () { S.stage.trigger(pad); } });
    var geo = make('div', { class: 'sb-block' }, [
      make('div', { class: 'sb-row' }, [preview]),
      hintBox('Drag the pad to move it. Drag a handle on its outline to resize. Arrow keys move it; Shift + arrows resize.'),
    ]);

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
      loopRow,
      geo,
      sound,
      look,
      fx,
      del,
    ];
    return section('Pad \u00b7 ' + pad.label, kids);
  }

  function syncPadLabel(pad) { var n = $('#sb-stage [data-pad="' + pad.id + '"] .sb-pad__label'); if (n) n.textContent = pad.label; }
  function syncPadEmoji(pad) { var n = $('#sb-stage [data-pad="' + pad.id + '"] .sb-pad__emoji'); if (n) n.textContent = pad.emoji || ''; }

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

  // e01s06 (D24): every pad starts dry. Each toggled effect (filter/echo/reverb/
  // distortion) gets a pill switch; its sliders + type select collapse and dim when
  // the effect is off. gain (Volume) and pitch (Pitch/Speed) have no switch — they
  // are always applied and neutral at 1.0. "Reset effects" restores defaultEffects().
  function effectsControls(pad) {
    var wrap = make('div', { class: 'sb-fxwrap' });
    core.EFFECTS.forEach(function (fx) {
      var isOn = fx.toggle ? !!pad.effects[fx.id + 'On'] : true;
      var block = make('div', { class: 'sb-fxblock' + (fx.toggle && !isOn ? ' sb-fxblock--off' : '') });

      var headKids = [make('span', { class: 'sb-fx__label', text: fx.label })];
      if (fx.toggle) {
        var sw = make('button', {
          type: 'button',
          class: 'sb-switch' + (isOn ? ' is-on' : ''),
          role: 'switch',
          'aria-checked': isOn ? 'true' : 'false',
          'aria-label': fx.label + ' ' + (isOn ? 'on' : 'off'),
        });
        var swTxt = make('span', { class: 'sb-switch__txt', text: isOn ? 'On' : 'Off' });
        sw.appendChild(swTxt);
        sw.addEventListener('click', function () {
          pad.effects[fx.id + 'On'] = !pad.effects[fx.id + 'On'];
          render();
          persist();
        });
        headKids.push(sw);
      }
      block.appendChild(make('div', { class: 'sb-fxblock__head' }, headKids));

      if (fx.select) {
        var sel = make('select', { class: 'sb-input', 'aria-label': fx.select.label });
        fx.select.options.forEach(function (opt) {
          var o = make('option', { value: opt, text: opt });
          if ((pad.effects[fx.select.key] || fx.select.def) === opt) o.selected = true;
          sel.appendChild(o);
        });
        // v1 bug fixed here: this handler used to never call persist().
        sel.addEventListener('change', function () { pad.effects[fx.select.key] = sel.value; persist(); });
        block.appendChild(make('div', { class: 'sb-field' }, [make('label', { text: fx.select.label }), sel]));
      }

      var body = make('div', { class: 'sb-fxblock__body' });
      fx.sliders.forEach(function (s) { body.appendChild(sliderRow(pad, s)); });
      block.appendChild(body);

      wrap.appendChild(block);
    });

    var resetFx = make('button', { type: 'button', class: 'sb-btn sb-btn--warn sb-fxreset', text: 'Reset effects', onclick: function () {
      pad.effects = core.defaultEffects();
      render();
      persist();
    } });
    wrap.appendChild(resetFx);

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

  root.SoundBoard.panel = { renderRack: renderRack };
})(typeof self !== 'undefined' ? self : this);
