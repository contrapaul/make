// e02s07t02: one entry point so the card renderers stay thin.
// Pure: returns '' when the card has no note, so cards render exactly
// as before on partial coverage (full coverage is enforced by test).
import { notesFromId } from './data/enrich.js';
import { notesHtml } from './cards/notes.js';

export function cardNotesHtml(project) {
  return notesHtml(notesFromId(project.id));
}
