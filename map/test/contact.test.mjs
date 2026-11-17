import test from 'node:test';
import assert from 'node:assert/strict';

import { parseContact, contactEmailHtml, ContactFormError } from '../../functions/api/_lib/contact.ts';

const good = { name: ' Ada ', email: 'ada@example.com', message: 'Hello' };

test('parseContact: trims and accepts a complete form', () => {
  assert.deepEqual(parseContact(good), { name: 'Ada', email: 'ada@example.com', message: 'Hello', isBot: false });
});

test('parseContact: a filled hidden field marks a bot and skips the other checks', () => {
  assert.equal(parseContact({ company: 'x' }).isBot, true);
});

test('parseContact: rejects missing, malformed and oversized fields', () => {
  assert.throws(() => parseContact({}), ContactFormError);
  assert.throws(() => parseContact(null), /fill in all fields/);
  assert.throws(() => parseContact({ ...good, message: '   ' }), /fill in all fields/);
  assert.throws(() => parseContact({ ...good, email: 'nope' }), /valid email/);
  assert.throws(() => parseContact({ ...good, name: 'a'.repeat(101) }), /too long/);
  assert.throws(() => parseContact({ ...good, message: 'a'.repeat(5001) }), /too long/);
  assert.equal(parseContact({ ...good, message: 'a'.repeat(5000) }).message.length, 5000);
});

test('contactEmailHtml: escapes everything the sender typed', () => {
  const html = contactEmailHtml({ name: '<b>', email: 'a@b.co', message: '<script>"&\'', isBot: false });
  assert.doesNotMatch(html, /<b>|<script>/);
  assert.match(html, /&lt;script&gt;&quot;&amp;&#39;/);
});
