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
  function lcdError(t) { S.ui.lcdError(t); }
  function renderLCD() { S.ui.renderLCD(); }

  function renderStage() {
    var stage = $('#sb-stage');
    if (!stage) return;
    var cols = model.board.layout.cols, rows = model.board.layout.rows;
    stage.style.setProperty('--cols', cols);
    stage.style.setProperty('--rows', rows);
    stage.innerHTML = '';
    stage.classList.remove('is-editing', 'is-dragging');
    var editing = S.gridEdit.editing();
    model.board.pads.forEach(function (pad) { stage.appendChild(padNode(pad, editing)); });
    if (editing) S.gridEdit.decorate(stage); // grid cells, selection frame (e01s08)
    else if (!model.board.pads.length) {
      stage.appendChild(make('div', { class: 'sb-empty', text: 'No pads yet \u2014 tap \u270e Edit soundboard to add some' }));
    }
  }

  function padNode(pad, editing) {
    var b = make('button', {
      type: 'button',
      class: 'sb-pad' + (editing && model.selectedId === pad.id ? ' is-selected' : '') + (livePads.has(pad.id) ? ' is-live' : '') + (pad.sound && !model.getBuffer(pad.sound.id) ? ' is-dead' : ''),
      'data-pad': pad.id,
      'aria-label': 'Pad ' + pad.label,
    });
    b.style.gridColumn = (pad.x + 1) + ' / span ' + pad.w;
    b.style.gridRow = (pad.y + 1) + ' / span ' + pad.h;
    b.style.setProperty('--pad-color', pad.color); // full-strength fill (opaque over the edit grid)
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
      // Edit mode: a press selects/drags and never plays (D29) — ▶ Preview is in the panel.
      if (editing) { S.gridEdit.padPointerDown(e, pad); return; }
      if (pad.sound && model.getBuffer(pad.sound.id)) trigger(pad);
      else if (pad.sound) lcdError('No clip for ' + pad.label + (model.readOnly ? '' : ' — re-attach it in Edit soundboard'));
    });
    b.addEventListener('keydown', function (e) {
      if (editing) { S.gridEdit.padKeyDown(e, pad); return; }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (pad.sound && model.getBuffer(pad.sound.id)) trigger(pad);
      }
    });
    // Extension point for per-pad styling (e01s09) without editing this file.
    if (S.applyPadStyle) S.applyPadStyle(b, pad);
    return b;
  }

  // Fire a pad. A re-tap restarts it (the engine chokes the previous voice), so the
  // press animation restarts too. The highlight clears only when the pad's current
  // voice ends — a choked older voice finishing must not clear it.
  function trigger(pad) {
    var buf = pad.sound && model.getBuffer(pad.sound.id);
    if (!buf) return;
    engine.setMaster(model.board.master.gain);
    engine.play(buf, pad, { onEnded: function (h, wasCurrent) { if (wasCurrent) clearLive(pad.id); } });
    livePads.add(pad.id);
    var node = $('#sb-stage [data-pad="' + pad.id + '"]');
    if (node) {
      node.classList.remove('is-live');
      void node.offsetWidth; // reflow so the press animation replays on every tap
      node.classList.add('is-live');
    }
    renderLCD();
  }

  function clearLive(padId) {
    livePads.delete(padId);
    var n = $('#sb-stage [data-pad="' + padId + '"]');
    if (n) n.classList.remove('is-live');
    renderLCD();
  }

  root.SoundBoard.stage = { renderStage: renderStage, trigger: trigger, livePads: livePads };
})(typeof self !== 'undefined' ? self : this);
