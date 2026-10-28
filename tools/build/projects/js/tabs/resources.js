// e02s04t01: Resources tab. Exactly 3 cards, data-driven.
// All 3 cards are live links. The template still renders a ghost card for any
// entry with url: null, in case a link is pulled before its target ships.
import { registerTab } from '../app.js';
import { RESOURCES } from '../data/resources.js';

export { RESOURCES };

const GLYPHS = { build: '\u{1F4E6}', languages: '\u{1F1EB}', codewithai: '\u{1F393}' };

export default function renderResources(stage) {
  stage.innerHTML = `
    <p class="tab-intro">Three worth-keeping-open tabs next to this one: how to ship the
    build, what every stack row means, and how to teach from it.</p>
    <div class="res-list">
      ${RESOURCES.map(r => r.url
        ? `<div class="card res">
             <span class="res-glyph" aria-hidden="true">${GLYPHS[r.id] || '\u{1F517}'}</span>
             <a href="${r.url}" target="_blank" rel="noopener">${r.title} \u2197</a>
             <p class="desc">${r.desc}</p>
           </div>`
        : `<div class="card res res-ghost">
             <span class="res-glyph" aria-hidden="true">${GLYPHS[r.id] || '\u{1F517}'}</span>
             <span>${r.title}</span>
             <p class="desc">${r.desc}</p>
           </div>`
      ).join('')}
    </div>`;
}

registerTab('resources', renderResources);
export { renderResources as resourcesTab };
