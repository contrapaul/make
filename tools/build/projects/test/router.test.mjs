// e02s02t02 seed: hash router map. app.js must export a pure resolveRoute
// so Node can test it without a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRoute } from '../js/app.js';

test('resolveRoute: default + known routes', () => {
  assert.deepEqual(resolveRoute(''), { tab: 'random' });
  assert.deepEqual(resolveRoute('#'), { tab: 'random' });
  assert.deepEqual(resolveRoute('#/'), { tab: 'random' });
  assert.deepEqual(resolveRoute('#/random'), { tab: 'random' });
  assert.deepEqual(resolveRoute('#/browse'), { tab: 'browse' });
  assert.deepEqual(resolveRoute('#/resources'), { tab: 'resources' });
  assert.deepEqual(resolveRoute('#/glossary'), { tab: 'glossary' });
  assert.deepEqual(resolveRoute('#/glossary/commit'), { tab: 'glossary', id: 'commit' });
});

test('resolveRoute: junk falls back to random', () => {
  assert.deepEqual(resolveRoute('#/nope'), { tab: 'random' });
  assert.deepEqual(resolveRoute('#browse'), { tab: 'random' });
  assert.deepEqual(resolveRoute('#/'), { tab: 'random' });
});
