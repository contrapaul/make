// e02s07t01: index of enrichment notes, one authored file per drafting batch,
// keyed by project id. The site's cards join on id (see enrich.js).
// Paths are the drafted batch files (owner reviews them before merge); they
// double as the live data, so there is no build step or copy to keep in sync.
import { NOTES as B0 } from '../../notes/batch-00-notes.js';
import { NOTES as B1 } from '../../notes/batch-01-notes.js';
import { NOTES as B2 } from '../../notes/batch-02-notes.js';

export const NOTES = [...B0, ...B1, ...B2];

const BY_ID = new Map(NOTES.map(n => [n.id, n]));

export function notesFromId(id) {
  return BY_ID.get(id) ?? null;
}
