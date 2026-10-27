// e02s04t01: Resources tab. Exactly 3 cards, data-driven.
// Card 2 is a ghost (no live href): the languages page is not deployed yet,
// so we link nowhere rather than 404.
import { registerTab } from '../app.js';
import { RESOURCES } from '../data/resources.js';

export { RESOURCES };

export default function renderResources(stage) {
  stage.innerHTML = `
    <p class="pool-line" style="max-width:60ch;margin-bottom:1rem">
      Three things worth keeping open next to this site while you build:
      how to ship it, what every stack row means, and how to teach from it.
    </p>
    <div class="res-list">
      ${RESOURCES.map(r => r.url
        ? `<div class="card res">
             <a href="${r.url}" target="_blank" rel="noopener">${r.title} ↗</a>
             <p class="desc">${r.desc}</p>
           </div>`
        : `<div class="card res res-ghost">
             <span>${r.title}</span>
             <p class="desc">${r.desc}</p>
           </div>`
      ).join('')}
    </div>`;
}

registerTab('resources', renderResources);
export { renderResources as resourcesTab };
