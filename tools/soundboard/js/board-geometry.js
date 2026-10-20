/* Soundboard board geometry — pure pointer-to-grid maths for dragging and resizing
 * pads in edit mode (e01s08). No DOM. Dual-mode like soundboard-core.js: attaches to
 * window.SoundBoard.geometry in the browser and module.exports in Node.
 *
 * Kept out of soundboard-core.js, which is already past the ~300-line guideline.
 */
(function (root, factory) {
  var core = (root && root.SoundBoard && root.SoundBoard.core) ||
    (typeof require === 'function' ? require('./soundboard-core.js') : null);
  var api = factory(core);
  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') module.exports = api;
  if (root) {
    root.SoundBoard = root.SoundBoard || {};
    root.SoundBoard.geometry = api;
  }
})(
  typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this,
  function (core) {
    'use strict';

    function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

    // metrics = { left, top, width, height, cols, rows, gap }: the stage's CONTENT box
    // in px (inside its padding). One cell plus one gap is a "pitch".
    function pitch(m) {
      return {
        x: (m.width + m.gap) / m.cols,
        y: (m.height + m.gap) / m.rows,
      };
    }

    // Which cell a point is over, clamped to the grid. A point in a gap belongs to the
    // cell before it.
    function cellFromPoint(px, py, m) {
      var p = pitch(m);
      return {
        x: clamp(Math.floor((px - m.left) / p.x), 0, m.cols - 1),
        y: clamp(Math.floor((py - m.top) / p.y), 0, m.rows - 1),
      };
    }

    // Pointer travel -> whole cells; switches to the next cell at the half-way mark.
    function deltaCells(dxPx, dyPx, m) {
      var p = pitch(m);
      return { dCols: Math.round(dxPx / p.x) || 0, dRows: Math.round(dyPx / p.y) || 0 };
    }

    // The rect a drag would produce. edge: 'move' or any of n s e w ne nw se sw.
    // Always inside the grid and at least 1x1; the opposite edge stays put on resize.
    function dragRect(start, edge, dCols, dRows, layout) {
      var cols = layout.cols, rows = layout.rows;
      var r = { x: start.x, y: start.y, w: start.w, h: start.h };
      if (edge === 'move') {
        r.x = clamp(start.x + dCols, 0, cols - start.w);
        r.y = clamp(start.y + dRows, 0, rows - start.h);
        return r;
      }
      var right = start.x + start.w, bottom = start.y + start.h;
      if (edge.indexOf('e') >= 0) r.w = clamp(start.w + dCols, 1, cols - start.x);
      if (edge.indexOf('w') >= 0) { r.x = clamp(start.x + dCols, 0, right - 1); r.w = right - r.x; }
      if (edge.indexOf('s') >= 0) r.h = clamp(start.h + dRows, 1, rows - start.y);
      if (edge.indexOf('n') >= 0) { r.y = clamp(start.y + dRows, 0, bottom - 1); r.h = bottom - r.y; }
      return r;
    }

    function sameRect(a, b) { return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h; }

    // Move and/or resize a pad in one step (left/top resizes change both). Refuses
    // anything off-grid or overlapping another pad; returns true when applied.
    function setPadRect(board, id, r) {
      var pad = null;
      for (var i = 0; i < board.pads.length; i++) if (board.pads[i].id === id) pad = board.pads[i];
      if (!pad || r.w < 1 || r.h < 1) return false;
      if (!core.fits(board, r.x, r.y, r.w, r.h, id)) return false;
      pad.x = r.x; pad.y = r.y; pad.w = r.w; pad.h = r.h;
      return true;
    }

    // Can the grid become cols x rows without moving any pad? (Shrinking past a pad
    // is refused rather than silently shoving pads on top of each other.)
    function layoutFits(board, cols, rows) {
      return board.pads.every(function (p) { return p.x + p.w <= cols && p.y + p.h <= rows; });
    }

    return {
      cellFromPoint: cellFromPoint,
      deltaCells: deltaCells,
      dragRect: dragRect,
      sameRect: sameRect,
      setPadRect: setPadRect,
      layoutFits: layoutFits,
    };
  }
);
