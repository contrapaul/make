// Unit tests for e01s07: per-pad retrigger (choke) bookkeeping and tail lengths (D25).
// Run: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../js/soundboard-core.js');

const voice = (padId, n) => ({ padId, n });

test('voiceTable: re-registering a pad returns the previous voice to choke', () => {
  const t = core.voiceTable();
  const a1 = voice('A', 1);
  const a2 = voice('A', 2);
  assert.equal(t.register('A', a1), null);
  assert.equal(t.register('A', a2), a1);
  assert.equal(t.current('A'), a2);
  assert.equal(t.size(), 2, 'the choked voice stays tracked until it is released');
});

test('voiceTable: releasing a choked voice leaves the newer one current', () => {
  const t = core.voiceTable();
  const a1 = voice('A', 1);
  const a2 = voice('A', 2);
  t.register('A', a1);
  t.register('A', a2);
  assert.equal(t.release(a1), false, 'old voice was not current');
  assert.equal(t.current('A'), a2);
  assert.equal(t.release(a2), true);
  assert.equal(t.current('A'), null);
  assert.equal(t.size(), 0);
});

test('voiceTable: pads are independent', () => {
  const t = core.voiceTable();
  const a = voice('A', 1);
  const b = voice('B', 1);
  assert.equal(t.register('A', a), null);
  assert.equal(t.register('B', b), null, 'tapping B never returns A');
  assert.equal(t.current('A'), a);
  assert.equal(t.release(b), true);
  assert.equal(t.current('A'), a, 'releasing B leaves A alone');
});

test('voiceTable: forEach visits every live voice, including choked ones', () => {
  const t = core.voiceTable();
  t.register('A', voice('A', 1));
  t.register('A', voice('A', 2));
  t.register('B', voice('B', 1));
  const seen = [];
  t.forEach((h) => { seen.push(h.padId + h.n); t.release(h); }); // releasing mid-loop is safe
  assert.deepEqual(seen.sort(), ['A1', 'A2', 'B1']);
  assert.equal(t.size(), 0);
});

test('tailSeconds: 0 when echo and reverb are off', () => {
  assert.equal(core.tailSeconds(core.defaultEffects()), 0);
  assert.equal(core.tailSeconds(null), 0);
});

test('tailSeconds: echo repeats until -60 dB, capped at 4 s', () => {
  const e = core.defaultEffects();
  e.echoOn = true; // time 0.25 s, feedback 0.35 -> 7 repeats
  assert.ok(Math.abs(core.tailSeconds(e) - 1.75) < 1e-9);
  e.echoTime = 1;
  e.echoFeedback = 0.9;
  assert.equal(core.tailSeconds(e), 4);
});

test('tailSeconds: reverb rings 2.4 s; the longer tail wins', () => {
  const e = core.defaultEffects();
  e.reverbOn = true;
  assert.equal(core.tailSeconds(e), 2.4);
  e.echoOn = true;
  e.echoTime = 1;
  e.echoFeedback = 0.9;
  assert.equal(core.tailSeconds(e), 4);
});
