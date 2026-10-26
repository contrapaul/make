// TDD seed for e02s01: js/data/projects.js must exist with 150 valid records.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../js/data/', import.meta.url));
const file = dir + 'projects.js';

test('js/data/projects.js exists', () => {
  assert.ok(existsSync(file), 'js/data/projects.js not found (run build-data.mjs)');
});

test('150 records, shape and ids valid', async () => {
  if (!existsSync(file)) return;
  const mod = await import('file://' + file);
  const records = mod.PROJECTS ?? mod.default;
  assert.ok(Array.isArray(records), 'PROJECTS should be an array');
  assert.equal(records.length, 150, 'expected 150 records, got ' + records.length);

  const seen = new Set();
  for (const r of records) {
    for (const k of ['id', 'name', 'part', 'category', 'mode', 'stack', 'description']) {
      assert.ok(r[k] != null && r[k] !== '', `record ${r.id ?? r.name} missing ${k}`);
    }
    assert.ok(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.id), `bad kebab id: ${r.id}`);
    assert.ok(!seen.has(r.id), `duplicate id: ${r.id}`);
    seen.add(r.id);
    assert.ok([1, 2, 3].includes(r.part), `bad part: ${r.part}`);
    assert.ok(['online', 'offline', 'either'].includes(r.mode), `bad mode: ${r.mode}`);
    assert.ok(Array.isArray(r.languages), `languages not array: ${r.id}`);
  }
  assert.equal(records.filter(r => r.part === 1).length, 50);
  assert.equal(records.filter(r => r.part === 2).length, 50);
  assert.equal(records.filter(r => r.part === 3).length, 50);
});
