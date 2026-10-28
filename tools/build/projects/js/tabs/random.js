// e02s03t01: Random tab. One big card + "Another one", three filters.
// pickRandom is pure and seeded so Node can test it (test/random.test.mjs).
import { PROJECTS } from '../data/projects.js';
import { cardNotesHtml } from '../cards.js';
import { SECTIONS } from '../data/buckets.js';
import { colorForCategory } from '../data/colors.js';
import { registerTab } from '../app.js';

/** Pure. Mulberry32 PRNG for a repeatable, testable draw. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pure: draw one record from pool without repeating excludeId (when
 *  pool has more than one entry). Returns { record, poolSize }. */
export function pickRandom(pool, excludeId, rng) {
  const rand = rng ?? Math.random;
  if (!pool.length) return { record: null, poolSize: 0 };
  if (pool.length > 1 && excludeId) {
    const rest = pool.filter(p => p.id !== excludeId);
    if (rest.length) pool = rest;
  }
  const i = Math.floor(rand() * pool.length) % pool.length;
  return { record: pool[i], poolSize: pool.length };
}

/** Pure: apply the three filters (all accept '' = any). */
export function filterProjects(list, filters, ids) {
  const f = { language: '', category: '', mode: '', ...(filters || {}) };
  const idSet = ids ? new Set(ids) : null;
  return list.filter(p =>
    (!f.language || p.languages.includes(f.language)) &&
    (!f.category || p.category === f.category) &&
    (!f.mode || p.mode === f.mode || p.mode === 'either') &&
    (!idSet || idSet.has(p.id))
  );
}

const ALL_LANGS = [...new Set(PROJECTS.flatMap(p => p.languages))].sort();
// One glyph per bucket so every draw reads as a different "deck".
const CATEGORY_ICONS = {
  games: '\u{1F3AE}', 'creative': '\u{1F3A8}', utilities: '\u{1F527}',
  'task-processing': '\u{2699}\u{FE0F}', 'data-analysis': '\u{1F4CA}',
  'web-devops': '\u{1F310}', 'learning-cs': '\u{1F9E0}', productivity: '\u{23F3}',
  education: '\u{1F393}',
};
let lastId = null;
let seed = (Date.now() % 1000000) | 0;

function cardHtml(p) {
  const icon = CATEGORY_ICONS[p.category] || '\u{1F0CF}';
  const label = SECTIONS.find(s => s.id === p.category);
  const chips = (p.stack ? `<span class="mono">${p.stack}</span>` : '');
  const mode = `<span class="chip mode-${p.mode}">${p.mode}</span>`;
  const langs = (p.languages || []).map(l => `<span class="chip lang">${l}</span>`).join('');
  const sub = p.subGroup ? `<p class="pool-line">${p.audience || ''} / ${p.subGroup.label || p.subGroup}</p>` : '';
  return `
    <div class="random-hero is-drawn" style="--hero-color:${colorForCategory(p.category)}">
      <div class="band"><span class="disc" aria-hidden="true"></span><span>${icon} ${label ? label.label : p.category} &middot; Part ${p.part}</span></div>
      <div class="body">
        <h2>${p.name}</h2>
        <p>${p.description}</p>
        <p class="chips">${mode} ${langs} ${chips}</p>${sub}
        ${cardNotesHtml(p)}
      </div>
    </div>`;
}

export default function renderRandom(stage) {
  const state = { language: '', category: '', mode: '', lastId: lastId };

  function draw() {
    const pool = filterProjects(PROJECTS, state);
    const { record, poolSize } = pickRandom(pool, state.lastId, makeRng(seed = (seed + 1) | 1));
    if (record) {
      lastId = state.lastId = record.id;
      stage.querySelector('.random-hero').outerHTML = cardHtml(record);
    } else {
      stage.querySelector('.random-hero').outerHTML =
        '<div class="random-hero"><div class="body"><h2>No matches</h2><p>Loosen a filter to see all 150 again.</p></div></div>';
    }
    const count = poolSize === 1
      ? 'You drew from the 1 matching idea.'
      : `You drew from ${poolSize} ideas that match.`;
    stage.querySelector('.lcd.count').textContent = count;
  }

  stage.innerHTML = `
    <div class="random-hero"><div class="body"><h2>Shuffling the deck…</h2></div></div>
    <div class="filter-row">
      <label>Language <select id="f-lang"><option value="">All</option>${ALL_LANGS.map(l => `<option>${l}</option>`).join('')}</select></label>
      <label>Category <select id="f-cat"><option value="">All</option>${SECTIONS.map(s => `<option value="${s.id}">${s.label}</option>`).join('')}</select></label>
      <label>Mode <select id="f-mode"><option value="">All</option><option value="online">Online</option><option value="offline">Offline</option></select></label>
      <button id="f-reset" type="button" class="ghost-btn">Reset</button>
    </div>
    <div class="draw-row">
      <button id="again" type="button">Draw another \u{1F0CF}\u{1F0D0}\u{1F0CB}</button>
      <span class="lcd count" role="status"></span>
    </div>`;
  stage.querySelector('#f-lang').addEventListener('change', e => { state.language = e.target.value; draw(); });
  stage.querySelector('#f-cat').addEventListener('change', e => { state.category = e.target.value; draw(); });
  stage.querySelector('#f-mode').addEventListener('change', e => { state.mode = e.target.value; draw(); });
  stage.querySelector('#f-reset').addEventListener('click', () => {
    state.language = state.category = state.mode = '';
    stage.querySelector('#f-lang').value = stage.querySelector('#f-cat').value = stage.querySelector('#f-mode').value = '';
    draw();
  });
  stage.querySelector('#again').addEventListener('click', draw);
  draw();
}

registerTab('random', renderRandom);
export { renderRandom as randomTab };
