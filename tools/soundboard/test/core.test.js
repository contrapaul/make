// Unit tests for the pure soundboard core (no DOM, no Web Audio).
// Run: npm test   (node --test tools/soundboard/test/)
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../js/soundboard-core.js');

function emptyBoard(cols = 9, rows = 6) {
  return { name: 'T', isPublic: false, master: { gain: 1 }, layout: { cols, rows }, pads: [] };
}

test('fits: inside bounds and free', () => {
  const b = emptyBoard();
  assert.equal(core.fits(b, 0, 0, 1, 1), true);
  assert.equal(core.fits(b, 8, 5, 1, 1), true);
  assert.equal(core.fits(b, 8, 5, 2, 1), false, 'overflows right edge');
  assert.equal(core.fits(b, -1, 0, 1, 1), false, 'negative x');
});

test('fits: overlap is rejected unless ignoring that pad', () => {
  const b = emptyBoard();
  const p = core.addPad(b, { x: 2, y: 2, w: 2, h: 2 });
  assert.equal(core.fits(b, 3, 3, 1, 1), false);
  assert.equal(core.fits(b, 3, 3, 1, 1, p.id), true);
  assert.equal(core.fits(b, 4, 2, 1, 1), true, 'adjacent cell is free');
});

test('findFreeCell scans row by row and returns null when full', () => {
  const b = emptyBoard(3, 3);
  core.addPad(b, { x: 0, y: 0, w: 1, h: 1 });
  assert.deepEqual(core.findFreeCell(b, 1, 1), { x: 1, y: 0 });
  assert.deepEqual(core.findFreeCell(b, 3, 1), { x: 0, y: 1 });
  core.addPad(b, { x: 0, y: 1, w: 3, h: 2 });
  core.addPad(b, { x: 1, y: 0, w: 2, h: 1 });
  assert.equal(core.findFreeCell(b, 1, 1), null);
});

test('addPad places at the requested cell, else the first free one', () => {
  const b = emptyBoard();
  const a = core.addPad(b, { x: 4, y: 3 });
  assert.deepEqual([a.x, a.y, a.w, a.h], [4, 3, 1, 1]);
  const c = core.addPad(b, { x: 4, y: 3 }); // taken -> falls back
  assert.deepEqual([c.x, c.y], [0, 0]);
  assert.deepEqual(c.effects, core.defaultEffects());
});

test('addPad throws on a full board', () => {
  const b = emptyBoard(3, 3);
  core.addPad(b, { x: 0, y: 0, w: 3, h: 3 });
  assert.throws(() => core.addPad(b, { w: 1, h: 1 }), /no free cell/);
});

test('movePad and resizePad reject overlaps and out-of-bounds', () => {
  const b = emptyBoard();
  const a = core.addPad(b, { x: 0, y: 0 });
  core.addPad(b, { x: 2, y: 0 });
  assert.equal(core.movePad(b, a.id, 2, 0), false, 'onto another pad');
  assert.equal(core.movePad(b, a.id, 1, 1), true);
  assert.deepEqual([a.x, a.y], [1, 1]);
  assert.equal(core.resizePad(b, a.id, 2, 1), true);
  assert.equal(core.resizePad(b, a.id, 9, 1), false, 'past right edge');
  assert.equal(core.movePad(b, 'nope', 0, 0), false, 'unknown id');
});

test('setLayout clamps grid size to 3..12 and pulls pads inside', () => {
  const b = emptyBoard();
  const p = core.addPad(b, { x: 7, y: 4, w: 2, h: 2 });
  core.setLayout(b, 1, 40);
  assert.deepEqual(b.layout, { cols: 3, rows: 12 });
  assert.ok(p.x + p.w <= 3, 'pad pulled inside the narrower grid');
});

test('validateBoard fills defaults from junk input', () => {
  const { board, errors } = core.validateBoard({
    layout: { cols: 'x', rows: 99 },
    master: { gain: 5 },
    pads: [null, { x: 50, y: -3, w: 0, label: 7, effects: { gain: 0.5 } }],
  });
  assert.deepEqual(errors, []);
  assert.equal(board.name, 'Untitled Board');
  assert.deepEqual(board.layout, { cols: 9, rows: 12 });
  assert.equal(board.master.gain, 2);
  assert.equal(board.pads.length, 2);
  const p = board.pads[1];
  assert.deepEqual([p.x, p.y, p.w], [8, 0, 1]);
  assert.equal(p.label, 'Pad');
  assert.equal(p.effects.gain, 0.5);
  assert.equal(p.effects.playbackRate, 1, 'missing effects filled from defaults');
});

test('validateBoard accepts a { board } wrapper and garbage', () => {
  assert.equal(core.validateBoard({ board: { name: 'Wrapped' } }).board.name, 'Wrapped');
  assert.equal(core.validateBoard(null).board.pads.length, 0);
});

test('makeDistortionCurve: 1024 points, monotonic, negative-to-positive', () => {
  for (const amount of [0, 0.5, 1]) {
    const c = core.makeDistortionCurve(amount);
    assert.equal(c.length, 1024);
    for (let i = 1; i < c.length; i++) assert.ok(c[i] >= c[i - 1], `monotonic at ${i} (amount ${amount})`);
    assert.ok(c[0] < 0 && c[1023] > 0);
  }
});

test('makeImpulseSamples: length, decay, deterministic with an rng', () => {
  const rng = () => 1; // always the max sample -> pure envelope
  const s = core.makeImpulseSamples({ seconds: 1, decay: 2, sampleRate: 1000, rng });
  assert.equal(s.length, 1000);
  assert.equal(s[0], 1);
  assert.ok(Math.abs(s[500] - 0.25) < 1e-6, 'envelope (1 - t)^decay at t = 0.5');
  assert.ok(s[999] < 1e-4);
  const again = core.makeImpulseSamples({ seconds: 1, decay: 2, sampleRate: 1000, rng });
  assert.deepEqual(again, s);
});
