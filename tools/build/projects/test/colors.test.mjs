// e02 visual overhaul: the category colour map must cover every bucket,
// use valid hex, and never hand two categories the same colour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SECTIONS } from '../js/data/buckets.js';
import { CATEGORY_COLORS, colorForCategory } from '../js/data/colors.js';

test('every section id has a colour', () => {
  for (const s of SECTIONS) {
    assert.ok(s.id in CATEGORY_COLORS, `missing colour for ${s.id}`);
  }
});

test('colours are valid 6-digit hex', () => {
  for (const [id, hex] of Object.entries(CATEGORY_COLORS)) {
    assert.match(hex, /^#[0-9A-F]{6}$/, `${id} -> ${hex}`);
  }
});

test('no two categories share a colour', () => {
  const seen = new Set();
  for (const hex of Object.values(CATEGORY_COLORS)) {
    assert.ok(!seen.has(hex), `duplicate colour ${hex}`);
    seen.add(hex);
  }
});

test('unknown id falls back to the soft line colour', () => {
  assert.equal(colorForCategory('nope'), '#E7D9BD');
  assert.equal(colorForCategory(''), '#E7D9BD');
});
