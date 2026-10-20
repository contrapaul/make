// Unit tests for e01s08: pointer -> grid maths for drag/resize (board-geometry.js).
// Run: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../js/soundboard-core.js');
const G = require('../js/board-geometry.js');

// 9 x 6 grid: content box 890 x 590 at (10, 20), 10px gaps -> 90px cells, 100px pitch.
const m = { left: 10, top: 20, width: 890, height: 590, cols: 9, rows: 6, gap: 10 };
const layout = { cols: 9, rows: 6 };
const board = () => ({ layout: { cols: 9, rows: 6 }, pads: [] });

test('cellFromPoint: centres, gaps and outside the stage', () => {
  assert.deepEqual(G.cellFromPoint(10 + 45, 20 + 45, m), { x: 0, y: 0 });
  assert.deepEqual(G.cellFromPoint(10 + 445, 20 + 245, m), { x: 4, y: 2 });
  assert.deepEqual(G.cellFromPoint(10 + 95, 20 + 95, m), { x: 0, y: 0 }, 'gap belongs to the cell before');
  assert.deepEqual(G.cellFromPoint(-500, -500, m), { x: 0, y: 0 }, 'clamped low');
  assert.deepEqual(G.cellFromPoint(5000, 5000, m), { x: 8, y: 5 }, 'clamped high');
});

test('deltaCells: switches cell exactly at the half-pitch mark', () => {
  assert.deepEqual(G.deltaCells(49, -49, m), { dCols: 0, dRows: 0 });
  assert.deepEqual(G.deltaCells(50, 0, m), { dCols: 1, dRows: 0 });
  assert.deepEqual(G.deltaCells(-151, 250, m), { dCols: -2, dRows: 3 });
});

test('dragRect move: clamped so the pad stays inside the grid', () => {
  const start = { x: 2, y: 2, w: 2, h: 1 };
  assert.deepEqual(G.dragRect(start, 'move', 3, 1, layout), { x: 5, y: 3, w: 2, h: 1 });
  assert.deepEqual(G.dragRect(start, 'move', 99, 99, layout), { x: 7, y: 5, w: 2, h: 1 });
  assert.deepEqual(G.dragRect(start, 'move', -99, -99, layout), { x: 0, y: 0, w: 2, h: 1 });
});

test('dragRect resize: every edge, opposite edge fixed', () => {
  const s = { x: 3, y: 2, w: 2, h: 2 };
  assert.deepEqual(G.dragRect(s, 'e', 2, 9, layout), { x: 3, y: 2, w: 4, h: 2 });
  assert.deepEqual(G.dragRect(s, 's', 9, 1, layout), { x: 3, y: 2, w: 2, h: 3 });
  assert.deepEqual(G.dragRect(s, 'w', -2, 0, layout), { x: 1, y: 2, w: 4, h: 2 });
  assert.deepEqual(G.dragRect(s, 'n', 0, -1, layout), { x: 3, y: 1, w: 2, h: 3 });
  assert.deepEqual(G.dragRect(s, 'se', 1, 1, layout), { x: 3, y: 2, w: 3, h: 3 });
  assert.deepEqual(G.dragRect(s, 'nw', -1, -1, layout), { x: 2, y: 1, w: 3, h: 3 });
  assert.deepEqual(G.dragRect(s, 'ne', 1, 1, layout), { x: 3, y: 3, w: 3, h: 1 });
  assert.deepEqual(G.dragRect(s, 'sw', 1, -1, layout), { x: 4, y: 2, w: 1, h: 1 });
});

test('dragRect resize: clamps at the grid edge and the 1x1 minimum', () => {
  const s = { x: 3, y: 2, w: 2, h: 2 };
  assert.deepEqual(G.dragRect(s, 'e', 99, 0, layout), { x: 3, y: 2, w: 6, h: 2 }, 'right edge stops at col 9');
  assert.deepEqual(G.dragRect(s, 'e', -99, 0, layout), { x: 3, y: 2, w: 1, h: 2 }, 'min width 1');
  assert.deepEqual(G.dragRect(s, 'w', -99, 0, layout), { x: 0, y: 2, w: 5, h: 2 }, 'left edge stops at col 0');
  assert.deepEqual(G.dragRect(s, 'w', 99, 0, layout), { x: 4, y: 2, w: 1, h: 2 }, 'left edge stops 1 short of right');
  assert.deepEqual(G.dragRect(s, 'n', 0, 99, layout), { x: 3, y: 3, w: 2, h: 1 });
  assert.deepEqual(G.dragRect(s, 's', 0, 99, layout), { x: 3, y: 2, w: 2, h: 4 }, 'bottom stops at row 6');
});

test('setPadRect: applies a combined move+resize, refuses overlaps and bad sizes', () => {
  const b = board();
  const a = core.addPad(b, { x: 0, y: 0, w: 1, h: 1 });
  core.addPad(b, { x: 3, y: 0, w: 1, h: 1 });
  assert.equal(G.setPadRect(b, a.id, { x: 1, y: 1, w: 2, h: 2 }), true);
  assert.deepEqual([a.x, a.y, a.w, a.h], [1, 1, 2, 2]);
  assert.equal(G.setPadRect(b, a.id, { x: 2, y: 0, w: 2, h: 1 }), false, 'overlaps the other pad');
  assert.equal(G.setPadRect(b, a.id, { x: 8, y: 0, w: 2, h: 1 }), false, 'off grid');
  assert.equal(G.setPadRect(b, a.id, { x: 0, y: 0, w: 0, h: 1 }), false, 'zero width');
  assert.equal(G.setPadRect(b, 'nope', { x: 0, y: 0, w: 1, h: 1 }), false);
  assert.deepEqual([a.x, a.y, a.w, a.h], [1, 1, 2, 2], 'unchanged after refusals');
});

test('layoutFits: shrinking past a pad is refused', () => {
  const b = board();
  core.addPad(b, { x: 6, y: 4, w: 2, h: 1 });
  assert.equal(G.layoutFits(b, 8, 5), true);
  assert.equal(G.layoutFits(b, 7, 6), false);
  assert.equal(G.layoutFits(b, 9, 4), false);
});
