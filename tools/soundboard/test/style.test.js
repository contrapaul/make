// Unit tests for e01s09: pad fonts/colours (pad-style.js) and their round-trip through core.
// Run: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/pad-style.js');
const core = require('../js/soundboard-core.js');

test('readableText picks ink on light, white on dark', () => {
  assert.equal(P.readableText('#FFD93D'), '#1E2240');
  assert.equal(P.readableText('#FFFFFF'), '#1E2240');
  assert.equal(P.readableText('#1E2240'), '#FFFFFF');
  assert.equal(P.readableText('#000000'), '#FFFFFF');
  assert.equal(P.readableText('nonsense'), '#1E2240', 'bad input falls back to ink');
});

test('every palette colour gets text at >= 4.5:1 with auto text', () => {
  for (const c of core.PALETTE.concat(P.EXTRA_SWATCHES)) {
    const t = P.readableText(c);
    assert.ok(P.contrast(c, t) >= 4.5, `${c} on ${t} = ${P.contrast(c, t).toFixed(2)}`);
  }
});

test('hslToHex / hexToHsl', () => {
  assert.equal(P.hslToHex(0, 90, 50), '#F20D0D');
  assert.equal(P.hslToHex(120, 100, 50), '#00FF00');
  assert.equal(P.hslToHex(240, 100, 50), '#0000FF');
  assert.equal(P.hslToHex(360, 0, 100), '#FFFFFF');
  assert.deepEqual(P.hexToHsl('#F20D0D'), { h: 0, s: 90, l: 50 });
  for (const h of [0, 47, 133, 200, 299, 359]) {
    const back = P.hexToHsl(P.hslToHex(h, 90, 55));
    assert.ok(Math.abs(back.h - h) <= 1 && Math.abs(back.l - 55) <= 1, `round-trip h=${h} -> ${JSON.stringify(back)}`);
  }
});

test('normHex accepts short and bare forms, rejects junk', () => {
  assert.equal(P.normHex('#abc'), '#AABBCC');
  assert.equal(P.normHex('ff6b6b'), '#FF6B6B');
  assert.equal(P.normHex(' #12aB9f '), '#12AB9F');
  assert.equal(P.normHex('#12345'), null);
  assert.equal(P.normHex('red'), null);
});

test('normalize: bad values fall back to defaults', () => {
  assert.deepEqual(P.normalize(null), P.defaults());
  const n = P.normalize({ font: 'comic', textColor: '#zzz', fontSize: 'huge', bold: 'yes', caps: true });
  assert.equal(n.font, 'fredoka');
  assert.equal(n.textColor, 'auto');
  assert.equal(n.fontSize, 'auto');
  assert.equal(n.bold, true);
  assert.equal(n.caps, true);
  assert.equal(P.normalize({ textColor: '#fff' }).textColor, '#FFFFFF');
});

test('core: new pads get style defaults; validateBoard keeps good and fixes bad', () => {
  const b = { layout: { cols: 9, rows: 6 }, pads: [] };
  const p = core.addPad(b, {});
  assert.equal(p.font, 'fredoka');
  assert.equal(p.textColor, 'auto');
  const { board } = core.validateBoard({ pads: [
    { id: 'a', font: 'pixel', fontSize: 'xl', bold: false, caps: true, textColor: '#FFFFFF' },
    { id: 'b', font: 'comic', textColor: 'blue', color: 'not-a-colour' },
    { id: 'v1' },
  ] });
  const [a, bad, v1] = board.pads;
  assert.deepEqual([a.font, a.fontSize, a.bold, a.caps, a.textColor], ['pixel', 'xl', false, true, '#FFFFFF']);
  assert.equal(bad.font, 'fredoka');
  assert.equal(bad.textColor, 'auto');
  assert.ok(/^#[0-9A-F]{6}$/i.test(bad.color), 'bad pad colour replaced with a palette colour');
  assert.deepEqual([v1.font, v1.fontSize, v1.bold, v1.caps], ['fredoka', 'auto', true, false], 'v1 pads get defaults');
});

test('recentColors: custom colours only, distinct, newest last, capped', () => {
  const board = { pads: ['#FF6B6B', '#123456', '#abcdef', '#123456', '#010203'].map((color) => ({ color })) };
  assert.deepEqual(P.recentColors(board, core.PALETTE, 2), ['#ABCDEF', '#010203']);
  assert.deepEqual(P.recentColors(board, core.PALETTE), ['#123456', '#ABCDEF', '#010203']);
});
