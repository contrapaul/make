// e02s07: enrichment join + card markup. Pure halves only: the join over
// the 150 live records, the partial-coverage fallback, and the notesHtml
// contract. Run: node --test test/enrich.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROJECTS } from '../js/data/projects.js';
import { enrichProjects, coverage, notesFromId } from '../js/data/enrich.js';
import { notesHtml, refHtml } from '../js/cards/notes.js';
import { cardNotesHtml } from '../js/cards.js';

test('notesFromId: resolves a real id, null for unknown', () => {
  assert.equal(notesFromId('p001-snake-pong-breakout')?.id, 'p001-snake-pong-breakout');
  assert.equal(notesFromId('no-such-card'), null);
});

test('enrichProjects: all 150 cards join, order follows PROJECTS', () => {
  const merged = enrichProjects(PROJECTS);
  assert.equal(merged.length, 150);
  assert.ok(merged.every(p => p.notes && p.notes.id === p.id), 'every card carries its own note');
  assert.deepEqual(merged.map(p => p.id), PROJECTS.map(p => p.id), 'order preserved');
  assert.deepEqual(merged[0].part, PROJECTS[0].part, 'card fields intact');
});

test('coverage: 150/150 with the authored data', () => {
  assert.deepEqual(coverage(PROJECTS), { total: 150, withNotes: 150 });
});

test('enrichProjects: card with no note gets null, card survives (partial coverage)', () => {
  const fake = [{ id: 'zz-none', part: 9 }];
  const merged = enrichProjects(fake);
  assert.equal(merged[0].notes, null);
  assert.equal(merged[0].id, 'zz-none');
});

test('notesHtml: degrades to empty on no note; renders summary + refs with a note', () => {
  assert.equal(notesHtml(null), '');
  assert.equal(notesHtml(undefined), '');
  const note = {
    why: 'why text',
    starter: 'starter text',
    references: [{ title: 'MDN', url: 'https://developer.mozilla.org/' }],
  };
  const html = notesHtml(note);
  assert.match(html, /<details class="card-notes">/);
  assert.match(html, /<summary>More details<\/summary>/);
  assert.match(html, /<strong>Starting points:<\/strong> starter text/);
  assert.match(html, /href="https:\/\/developer\.mozilla\.org\/" target="_blank" rel="noopener"/);
});

test('refHtml: empty list yields empty string', () => {
  assert.equal(refHtml([]), '');
  assert.equal(refHtml(undefined), '');
});

test('cardNotesHtml: pure join of card -> notes markup; no note -> empty', () => {
  assert.equal(cardNotesHtml({ id: 'zz-none' }), '');
  const { PROJECTS: live } = { PROJECTS };
  const first = live[0];
  assert.match(cardNotesHtml(first), /card-notes/);
});
