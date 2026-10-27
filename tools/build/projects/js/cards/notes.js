// e02s07t02: the expandable "More details" section for project cards.
// Pure HTML builder so Node can test the markup. Renders nothing when the
// card has no notes, so cards keep working on partial coverage.
export function refHtml(refs) {
  if (!refs || !refs.length) return '';
  const items = refs.map(r =>
    ` <a href="${r.url}" target="_blank" rel="noopener">${r.title} \u2197</a>`
  ).join(',');
  return `<p class="notes-refs">${items.trim()}</p>`;
}

export function notesHtml(note) {
  if (!note) return '';
  return `
    <details class="card-notes">
      <summary>More details</summary>
      <p class="notes-why">${note.why || ''}</p>
      <p class="notes-starter"><strong>Starting points:</strong> ${note.starter || ''}</p>
      ${refHtml(note.references)}
    </details>`;
}
