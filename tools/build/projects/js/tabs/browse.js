// e02s02t03: Browse tab. 150 cards in 9 sections, section toggles.
// No localStorage. Part 3 shows audience + subgroup headings.
import { PROJECTS } from '../data/projects.js';
import { cardNotesHtml } from '../cards.js';
import { SECTIONS } from '../data/buckets.js';
import { colorForCategory } from '../data/colors.js';
import { registerTab } from '../app.js';

const SUBGROUP_LABELS = [
  { id: 'teachers-tools', label: 'Teachers’ tools' },
  { id: 'study-aids', label: 'Students’ study aids' },
  { id: 'subject-drills', label: 'Subject-specific drills' },
  { id: 'accessibility', label: 'Accessibility & formatting' },
  { id: 'admin-workflow', label: 'Admin & workflow' },
];

function chip(p) {
  const langs = (p.languages || []).map(l => `<span class="chip lang">${l}</span>`).join(' ');
  return `<span class="chip mode-${p.mode}">${p.mode}</span> ${langs}`;
}

function part3Cards(rows) {
  const base = 'part-3';
  let html = '';
  let lastGroup = null;
  for (const p of rows) {
    const groupId = typeof p.subGroup === 'string' ? p.subGroup : p.subGroup.id;
    if (groupId !== lastGroup) {
      lastGroup = groupId;
      const match = SUBGROUP_LABELS.find(s => s.id === groupId);
      html += `<h4 class="subgroup">${match ? match.label : groupId}</h4>`;
    }
    html += articleCard(p, base);
  }
  return html;
}

function flatCards(rows, base) {
  return rows.map(p => articleCard(p, base)).join('');
}

function articleCard(p, base) {
  return `
    <article class="card" id="${base}/${p.id}" style="border-left-color:${colorForCategory(p.category)}">
      <h3>${p.name}</h3>
      <p class="desc">${p.description}</p>
      <p class="mono">${p.stack}${p.audience ? ' | ' + p.audience : ''}</p>
      <p>${chip(p)}</p>
      ${cardNotesHtml(p)}
    </article>`;
}

export default function renderBrowse(stage) {
  stage.innerHTML = `
    <div class="browse-controls" id="controls"></div>
    <div id="sections"></div>`;
  const hidden = new Set();
  const sectionsEl = stage.querySelector('#sections');
  const controlsEl = stage.querySelector('#controls');

  function drawControls() {
    controlsEl.innerHTML = SECTIONS.map(s => {
      const off = hidden.has(s.id) ? ' off' : '';
      return `<button data-sec="${s.id}" type="button" class="ctl${off ? ' off' : ''}">${hidden.has(s.id) ? 'Show' : 'Hide'} ${s.label}</button>`;
    }).join('');
    controlsEl.insertAdjacentHTML('beforeend',
      `<button data-sec="__all">Show all</button><button data-sec="__none">Hide all</button>`);
  }

  function build() {
    const byPart = { 1: [], 2: [], 3: [] };
    for (const p of PROJECTS) byPart[p.part].push(p);
    sectionsEl.innerHTML = SECTIONS.map(s => {
      const rows1 = byPart[1].filter(p => p.category === s.id);
      const rows2 = byPart[2].filter(p => p.category === s.id);
      const rows3 = byPart[3].filter(p => p.category === s.id);
      if (!rows1.length && !rows2.length && !rows3.length) return '';
      const body =
        flatCards(rows1, 'part-1') +
        flatCards(rows2, 'part-2') +
        part3Cards(rows3);
      return `
        <section class="section" data-sec="${s.id}" ${hidden.has(s.id) ? 'hidden' : ''}>
          <h2 style="--sec-color:${colorForCategory(s.id)}">${s.label} <span class="count">(${rows1.length + rows2.length + rows3.length})</span></h2>
          <div class="grid">${body}</div>
        </section>`;
    }).join('');
    // Staggered reveal, capped: only the first 20 cards in the page animate.
    if (typeof sectionsEl.querySelectorAll === 'function') {
      sectionsEl.querySelectorAll('.grid > .card').forEach((c, i) => {
        if (i < 20) {
          c.classList.add('is-fresh');
          c.style.setProperty?.('--i', i);
        }
      });
    }
  }

  controlsEl.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const sec = b.dataset.sec;
    if (sec === '__all') hidden.clear();
    else if (sec === '__none') for (const s of SECTIONS) hidden.add(s.id);
    else if (hidden.has(sec)) hidden.delete(sec);
    else hidden.add(sec);
    drawControls();
    for (const s of SECTIONS) {
      const el = sectionsEl.querySelector(`.section[data-sec="${s.id}"]`);
      if (el) el.hidden = hidden.has(s.id);
    }
  });

  drawControls();
  build();
}

registerTab('browse', renderBrowse);
export { renderBrowse as browseTab };
