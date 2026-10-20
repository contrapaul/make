// Unit tests for e01s06 — effects off by default (D24).
// Run: npm test   (node --test tools/soundboard/test/)
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../js/soundboard-core.js');

test('defaultEffects: all four toggle effects start OFF', () => {
  const e = core.defaultEffects();
  assert.equal(e.filterOn, false);
  assert.equal(e.echoOn, false);
  assert.equal(e.reverbOn, false);
  assert.equal(e.distortionOn, false);
});

test('defaultEffects: distortion slider default is 0.3 so switching on is audible', () => {
  const e = core.defaultEffects();
  assert.equal(e.distortion, 0.3);
});

test('activeEffectIds: defaults wire gain only (dry pad)', () => {
  assert.deepEqual(core.activeEffectIds(core.defaultEffects()), ['gain']);
});

test('activeEffectIds: echo + reverb on -> canonical order gain, echo, reverb', () => {
  const e = core.defaultEffects();
  e.echoOn = true;
  e.reverbOn = true;
  assert.deepEqual(core.activeEffectIds(e), ['gain', 'echo', 'reverb']);
});

test('activeEffectIds: all four on -> full canonical chain', () => {
  const e = core.defaultEffects();
  e.filterOn = true;
  e.echoOn = true;
  e.reverbOn = true;
  e.distortionOn = true;
  assert.deepEqual(core.activeEffectIds(e), ['gain', 'filter', 'echo', 'reverb', 'distortion']);
});

test('activeEffectIds: null/empty effects -> gain only, no throw', () => {
  assert.deepEqual(core.activeEffectIds(null), ['gain']);
  assert.deepEqual(core.activeEffectIds({}), ['gain']);
});

test('validateBoard: v1 pad (echoWet 0.25, no flags) migrates to echoOn=false, echoWet kept', () => {
  const { board } = core.validateBoard({
    pads: [{
      id: 'p_v1', label: 'P1', color: '#FF6B6B',
      effects: { gain: 1, playbackRate: 1, echoWet: 0.25 },
    }],
  });
  assert.equal(board.pads.length, 1);
  const fx = board.pads[0].effects;
  assert.equal(fx.echoOn, false, 'echo must migrate to off');
  assert.equal(fx.echoWet, 0.25, 'slider value must be preserved');
  assert.equal(fx.filterOn, false);
  assert.equal(fx.reverbOn, false);
  assert.equal(fx.distortionOn, false);
});

test('validateBoard: a pad that saved echoOn:true keeps it on', () => {
  const { board } = core.validateBoard({
    pads: [{ id: 'p_x', effects: { echoOn: true, echoWet: 0.4 } }],
  });
  const fx = board.pads[0].effects;
  assert.equal(fx.echoOn, true);
  assert.equal(fx.echoWet, 0.4);
  assert.deepEqual(core.activeEffectIds(fx), ['gain', 'echo']);
});
