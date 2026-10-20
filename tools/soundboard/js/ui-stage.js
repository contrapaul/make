/* Soundboard UI — the pad grid: renders pads and fires them on press. */
(function (root) {
  'use strict';

  var S = root.SoundBoard;
  var model = S.model;
  var engine = S.engine;
  var D = S.dom;
  var $ = D.$, make = D.make, hexToRgba = D.hexToRgba;

  var livePads = new Set(); // ids of pads currently sounding

  // Calls into sibling modules, resolved at call time so load order is free.
  function select(id) { S.ui.select(id); }
  function lcdError(t) { S.ui.lcdError(t); }
  function renderLCD() { S.ui.renderLCD(); }

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
      if (S.ui.getMode() !== 'play') select(pad.id);
      if (pad.sound && model.getBuffer(pad.sound.id)) trigger(pad);
      else if (pad.sound) lcdError('No clip for ' + pad.label + (model.readOnly ? '' : ' — re-attach it in Edit soundboard'));
    });
    b.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (S.ui.getMode() !== 'play') select(pad.id);
        if (pad.sound && model.getBuffer(pad.sound.id)) trigger(pad);
      }
    });
    // Extension point for per-pad styling (e01s09) without editing this file.
    if (S.applyPadStyle) S.applyPadStyle(b, pad);
    return b;
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

  root.SoundBoard.stage = { renderStage: renderStage, trigger: trigger, livePads: livePads };
})(typeof self !== 'undefined' ? self : this);
