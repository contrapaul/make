// e02s04t01 seed: the 3 Resources cards, data-only.
// 3 entries exactly, all live (the languages page shipped at /tools/languages/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RESOURCES } from '../js/data/resources.js';
import renderResources, { RESOURCES as FROM_TAB } from '../js/tabs/resources.js';

test('resources: exactly 3 entries, ids pinned by the plan', () => {
  assert.equal(RESOURCES.length, 3);
  assert.deepEqual(RESOURCES.map(r => r.id), ['build', 'languages', 'codewithai']);
});

test('resources: all entries point at real destinations', () => {
  const byId = Object.fromEntries(RESOURCES.map(r => [r.id, r]));
  assert.equal(byId.build.url, 'https://build.contrapaul.com');
  assert.equal(byId.languages.url, '/tools/languages/');
  assert.equal(byId.codewithai.url, 'https://edu.contrapaul.com/codewithai');
});

test('resources: tabs module re-exports the same data (no duplicates)', () => {
  assert.equal(FROM_TAB, RESOURCES);
});

test('resources: every entry has a non-empty title and desc', () => {
  for (const r of RESOURCES) {
    assert.ok(r.title && r.title.trim(), `missing title: ${r.id}`);
    assert.ok(r.desc && r.desc.trim(), `missing desc: ${r.id}`);
  }
});

test('resources: render lists live links, ghost as plain card', () => {
  const stage = { innerHTML: '' };
  renderResources(stage);
  assert.ok(stage.innerHTML.includes('href="https://build.contrapaul.com"'), 'build link');
  assert.ok(stage.innerHTML.includes('href="/tools/languages/"'), 'languages link');
  assert.ok(stage.innerHTML.includes('href="https://edu.contrapaul.com/codewithai"'), 'codewithai link');
  assert.ok(!stage.innerHTML.includes('res-ghost'), 'no ghost card left');
});
