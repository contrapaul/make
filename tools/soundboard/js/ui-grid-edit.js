/* Soundboard UI — edit-mode grid (e01s08): visible cells, tap an empty cell to add a
 * pad, tap a pad to select it (no sound), drag it to move, drag one of the frame's 8
 * handles to resize. Everything snaps to whole cells; a drop that would overlap
 * another pad or leave the grid snaps back. Pointer Events only, so mouse, pen and
 * touch share one path. ui-stage.js calls in here only while editing.
 */
(function (root) {
  'use strict';

  var S = root.SoundBoard;
  var model = S.model;
  var core = S.core;
  var G = S.geometry;
  var make = S.dom.make;

  var DRAG_SLOP = 6; // px of travel before a press becomes a drag
  var EDGES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

  // Calls into sibling modules, resolved at call time so load order is free.
  function render() { S.ui.render(); }
  function select(id) { S.ui.select(id); }
  function lcdMsg(t) { S.ui.lcdMsg(t); }
  function lcdError(t) { S.ui.lcdError(t); }

  var drag = null; // the gesture in progress, if any

  function editing() { return S.ui.getMode() === 'edit' && !model.readOnly; }

  function place(node, r) {
    node.style.gridColumn = (r.x + 1) + ' / span ' + r.w;
    node.style.gridRow = (r.y + 1) + ' / span ' + r.h;
  }

  // ---- rendering: cells behind the pads, selection frame on top -------------
  function decorate(stage) {
    stage.classList.add('is-editing');
    var cols = model.board.layout.cols, rows = model.board.layout.rows;
    var cells = document.createDocumentFragment();
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var free = !core.padAt(model.board, x, y);
        var cell = make('button', {
          type: 'button',
          class: 'sb-cell' + (free ? ' is-free' : ''),
          tabindex: free ? null : '-1',
          'aria-label': free ? 'Add pad at column ' + (x + 1) + ', row ' + (y + 1) : null,
          'aria-hidden': free ? null : 'true',
        });
        place(cell, { x: x, y: y, w: 1, h: 1 });
        if (free) cell.addEventListener('click', addPadAt.bind(null, x, y));
        cells.appendChild(cell);
      }
    }
    stage.insertBefore(cells, stage.firstChild); // DOM order keeps pads on top
    var pad = model.getPad(model.selectedId);
    if (pad) stage.appendChild(frameNode(pad));
  }

  function frameNode(pad) {
    var frame = make('div', { class: 'sb-frame', 'aria-hidden': 'true' });
    place(frame, pad);
    EDGES.forEach(function (edge) {
      var h = make('span', { class: 'sb-handle sb-handle--' + edge, 'data-edge': edge });
      h.addEventListener('pointerdown', function (e) { startDrag(e, pad, edge); });
      frame.appendChild(h);
    });
    return frame;
  }

  function addPadAt(x, y) {
    var p;
    try { p = model.addPad({ x: x, y: y, w: 1, h: 1 }); } catch (e) { lcdError('No room there'); return; }
    if (!p) return;
    model.setSelected(p.id);
    render();
    lcdMsg('Added ' + p.label + ' — load a sound in the panel');
  }

  // ---- pointer gestures ----------------------------------------------------
  // Pad body: select (no sound) and, if the pointer travels, move it.
  function padPointerDown(e, pad) {
    if (e.button > 0) return;
    if (model.selectedId !== pad.id) select(pad.id);
    startDrag(e, pad, 'move');
  }

  function stageMetrics() {
    var stage = document.getElementById('sb-stage');
    var b = stage.getBoundingClientRect();
    var cs = getComputedStyle(stage);
    var bl = parseFloat(cs.borderLeftWidth) || 0, bt = parseFloat(cs.borderTopWidth) || 0;
    var pl = parseFloat(cs.paddingLeft) || 0, pt = parseFloat(cs.paddingTop) || 0;
    var pr = parseFloat(cs.paddingRight) || 0, pb = parseFloat(cs.paddingBottom) || 0;
    return {
      left: b.left + bl + pl,
      top: b.top + bt + pt,
      width: stage.clientWidth - pl - pr,
      height: stage.clientHeight - pt - pb,
      cols: model.board.layout.cols,
      rows: model.board.layout.rows,
      gap: parseFloat(cs.columnGap) || 0,
    };
  }

  function startDrag(e, pad, edge) {
    if (!e.isPrimary) return; // ignore extra fingers mid-gesture
    // A new primary pointer means the old one is gone (e.g. the mouse was released
    // outside the window and no pointerup arrived): drop the stale gesture.
    if (drag) { var stale = finish(); if (stale.ghost) stale.ghost.remove(); }
    e.preventDefault();
    e.stopPropagation();
    drag = {
      id: e.pointerId, padId: pad.id, edge: edge,
      x0: e.clientX, y0: e.clientY,
      start: { x: pad.x, y: pad.y, w: pad.w, h: pad.h },
      metrics: stageMetrics(), moved: edge !== 'move', rect: null, ghost: null,
    };
    // Window listeners, not pointer capture: selecting re-renders the stage, which
    // replaces the node the gesture started on.
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerup', onUp);
    root.addEventListener('pointercancel', onCancel);
  }

  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.moved && Math.abs(dx) < DRAG_SLOP && Math.abs(dy) < DRAG_SLOP) return;
    drag.moved = true;
    var d = G.deltaCells(dx, dy, drag.metrics);
    var r = G.dragRect(drag.start, drag.edge, d.dCols, d.dRows, model.board.layout);
    var ok = core.fits(model.board, r.x, r.y, r.w, r.h, drag.padId);
    drag.rect = r;
    drag.ok = ok;
    showGhost(r, ok);
  }

  function showGhost(r, ok) {
    var stage = document.getElementById('sb-stage');
    if (!drag.ghost) {
      drag.ghost = make('div', { class: 'sb-ghost', 'aria-hidden': 'true' });
      stage.appendChild(drag.ghost);
      stage.classList.add('is-dragging');
    }
    place(drag.ghost, r);
    drag.ghost.classList.toggle('is-bad', !ok);
  }

  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = finish();
    if (!d.rect || G.sameRect(d.rect, d.start)) { if (d.ghost) render(); return; }
    if (d.ok && G.setPadRect(model.board, d.padId, d.rect)) { render(); return; }
    render();
    reject(d.padId);
  }

  function onCancel(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = finish();
    if (d.ghost) render();
  }

  function finish() {
    var d = drag;
    drag = null;
    root.removeEventListener('pointermove', onMove);
    root.removeEventListener('pointerup', onUp);
    root.removeEventListener('pointercancel', onCancel);
    return d;
  }

  // Invalid drop: the pad is already back in place; give it a short shake.
  function reject(padId) {
    var n = document.querySelector('#sb-stage [data-pad="' + padId + '"]');
    if (n) n.classList.add('is-reject');
    lcdError('That spot is taken — pads can’t overlap');
  }

  // ---- keyboard (selected pad focused) --------------------------------------
  // Arrows move one cell; Shift+arrows resize from the bottom-right corner;
  // Delete/Backspace asks to delete; Escape deselects.
  function padKeyDown(e, pad) {
    var k = e.key;
    var dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
    if (k === 'Enter' || k === ' ') { e.preventDefault(); select(pad.id); refocus(pad.id); return; }
    if (k === 'Escape') { e.preventDefault(); model.setSelected(null); render(); return; }
    if (k === 'Delete' || k === 'Backspace') {
      e.preventDefault();
      if (root.confirm('Delete pad ' + pad.label + '?')) { model.removePad(pad.id); render(); lcdMsg('Deleted ' + pad.label); }
      return;
    }
    if (!dir) return;
    e.preventDefault();
    if (model.selectedId !== pad.id) select(pad.id);
    var r = e.shiftKey
      ? G.dragRect(pad, 'se', dir[0], dir[1], model.board.layout)
      : G.dragRect(pad, 'move', dir[0], dir[1], model.board.layout);
    if (!G.sameRect(r, pad) && G.setPadRect(model.board, pad.id, r)) render();
    else if (!G.sameRect(r, pad)) reject(pad.id);
    refocus(pad.id);
  }

  function refocus(padId) {
    var n = document.querySelector('#sb-stage [data-pad="' + padId + '"]');
    if (n) n.focus();
  }

  root.SoundBoard.gridEdit = {
    editing: editing,
    decorate: decorate,
    padPointerDown: padPointerDown,
    padKeyDown: padKeyDown,
  };
})(typeof self !== 'undefined' ? self : this);
