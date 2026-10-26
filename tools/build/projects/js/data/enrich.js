// e02s07t01: join card records with their enrichment notes.
// NOTES comes from notes/*.js batch files (written by hand/agent, owner-reviewed);
// a card without a note renders exactly as before, so the site never breaks
// on partial coverage. id order in MERGED follows PROJECTS.
import { PROJECTS } from './projects.js';
import { notesFromId } from './notes-index.js';

export { notesFromId };

/** Pure: cards + chapter-first notes. Cards without a note get notes: null. */
export function enrichProjects(list = PROJECTS) {
  return list.map(p => ({ ...p, notes: notesFromId(p.id) }));
}

/** Pure: true when every card has notes. Drives the coverage test. */
export function coverage(list = PROJECTS) {
  const withNotes = list.filter(p => notesFromId(p.id)).length;
  return { total: list.length, withNotes };
}
