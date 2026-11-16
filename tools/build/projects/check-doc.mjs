#!/usr/bin/env node
// e02s06t01: link-live check for the projects site. Walks every live URL
// the site ships - all glossary reference links plus the Resources tab -
// and reports each as ok, blocked, unreachable, or dead.
//
// Verdicts:
//   ok           2xx/3xx - the link answers.
//   blocked      403/429 - the site is up but bot-walls scripts; a human
//                          browser opens it fine. Not a defect, but flagged
//                          so a human can confirm it once.
//   unreachable  network error / timeout - the site checks out but THIS
//                network could not reach it (proxy, firewall, hiccups).
//                Flagged for re-check, not counted as dead.
//   dead         DNS failure, refused connection, or a real 4xx/5xx from
//                the target itself. This is a broken reference.
//
// Exits 0 when nothing is dead (blocked/unreachable are warnings, not
// failures), 1 when any link is dead, 2 on internal errors.
// Run: node tools/build/projects/check-doc.mjs

import { GLOSSARY } from './js/data/glossary.js';
import { RESOURCES } from './js/data/resources.js';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

/** Build the (label, url) pair list from the site's two data modules. */
export function collectLinks(glossary = GLOSSARY, resources = RESOURCES) {
  const out = [];
  for (const t of glossary) {
    for (const l of t.links || []) {
      if (l && l.url) out.push({ label: `glossary/${t.id}: ${l.title}`, url: l.url });
    }
  }
  for (const r of resources) {
    // Same-site relative urls (e.g. /tools/languages/) are internal links,
    // not external references - the link-live check only targets http(s).
    if (r.url && /^https?:\/\//.test(r.url)) out.push({ label: `resources/${r.id}`, url: r.url });
  }
  return out;
}

/** Classify a network error as 'unreachable' (transport hunt, retry later)
 *  or 'dead' (the name or host does not exist or refuses). */
export function classifyError(err) {
  const code = err?.cause?.code || err?.code || '';
  if (code === 'ENOTFOUND' || code === 'ECONNREFUSED' || code === 'EAI_AGAIN') {
    return 'dead';
  }
  return 'unreachable';
}

/** GET one URL with a bounded timeout. Returns { status, code }.
 *  status is one of ok | blocked | unreachable | dead. */
export async function urlStatus(url, fetchImpl = fetch, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT },
    });
    const okish = res.status >= 200 && res.status < 400;
    const blocked = res.status === 403 || res.status === 429;
    return { status: okish ? 'ok' : blocked ? 'blocked' : 'dead', code: res.status };
  } catch (err) {
    const status = err?.name === 'AbortError' ? 'unreachable' : classifyError(err);
    return { status, code: err?.name === 'AbortError' ? 'TIMEOUT' : err?.cause?.code || err?.code || '?' };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const links = collectLinks();
  const tallies = { ok: 0, blocked: 0, unreachable: 0, dead: 0 };
  for (const { label, url } of links) {
    const { status, code } = await urlStatus(url);
    tallies[status] += 1;
    const note = process.argv.includes('--quiet') ? '' : '  ' + label;
    console.log(`${status.toUpperCase().padEnd(12)} ${code}  ${url}${note}`);
  }
  console.log(`\n${links.length} links: ${tallies.ok} ok, ${tallies.blocked} blocked, ` +
    `${tallies.unreachable} unreachable, ${tallies.dead} dead.`);
  if (tallies.dead > 0) {
    console.log('DEAD links are broken references: fix or remove them.');
    process.exitCode = 1;
  } else if (tallies.blocked + tallies.unreachable > 0) {
    console.log('Warning: blocked/unreachable here may be bot-walls or network ' +
      'issues, not dead links. Re-check the flagged ones from a browser.');
  }
}

// Only run main when executed directly, not when imported by tests.
// Node 24: import.meta.main is true only for the entrypoint file.
if (import.meta.main) {
  await main();
}
