// e02s02t03 seed: card markup from records. Drives the real renderBrowse
// against a minimal stub stage (localai stub pattern, no DOM framework).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROJECTS } from '../js/data/projects.js';
import { SECTIONS } from '../js/data/buckets.js';
import renderBrowse from '../js/tabs/browse.js';

function makeStage() {
  const sections = { innerHTML: '' };
  const controls = {
    innerHTML: '',
    addEventListener: () => {},
    insertAdjacentHTML: (_, h) => { controls.innerHTML += h; },
  };
  const stage = {
    innerHTML: '',
    querySelector: (sel) => (sel === '#sections' ? sections : controls),
  };
  return { stage, sections, controls };
}

test('browse: all 150 cards render with their deep-link ids', () => {
  const { stage, sections } = makeStage();
  renderBrowse(stage);
  let cards = 0;
  for (const p of PROJECTS) {
    assert.ok(sections.innerHTML.includes(`id="part-${p.part}/${p.id}"`),
      `missing card id for ${p.id}`);
    cards += 1;
  }
  const n = (sections.innerHTML.match(/class="card"/g) || []).length;
  assert.equal(cards, 150, 'data has 150 records');
  assert.equal(n, 150, 'stage holds 150 cards');
});

test('browse: exactly the 9 planned sections appear, empties omitted', () => {
  const { stage, sections } = makeStage();
  renderBrowse(stage);
  const ids = SECTIONS.map(s => s.id);
  for (const id of ids) {
    assert.ok(sections.innerHTML.includes(`data-sec="${id}"`), `missing section ${id}`);
  }
  const n = (sections.innerHTML.match(/<section class="section"/g) || []).length;
  assert.equal(n, ids.length, 'all 9 sections present');
});

test('browse: part 3 rows carry audience + subgroup headings', () => {
  const { stage, sections } = makeStage();
  renderBrowse(stage);
  const p3 = PROJECTS.filter(p => p.part === 3);
  assert.ok(p3.length > 0, 'part 3 must not be empty');
  for (const p of p3) {
    assert.ok(sections.innerHTML.includes(`| ${p.audience}`),
      `part 3 card missing audience: ${p.id}`);
  }
  assert.ok(sections.innerHTML.includes('class="subgroup"'), 'subgroup headings present');
});

test('browse: controls list all 9 toggles plus show/hide all', () => {
  const { stage, controls } = makeStage();
  renderBrowse(stage);
  for (const s of SECTIONS) {
    assert.ok(controls.innerHTML.includes(`data-sec="${s.id}"`), `missing toggle ${s.id}`);
  }
  assert.ok(controls.innerHTML.includes('data-sec="__all"'), 'show all control');
  assert.ok(controls.innerHTML.includes('data-sec="__none"'), 'hide all control');
});
