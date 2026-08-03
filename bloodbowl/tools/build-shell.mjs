#!/usr/bin/env node
'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   bloodbowl/tools/build-shell.mjs

   Single-sources the header/footer across every page and auto-versions
   every local <link>/<script> reference with a content hash, so the two
   problems documented in REFACTOR-PLAN.md §1.2/§1.3 (14 hand-copied
   headers drifting apart, ?v= numbers drifting out of sync between
   pages) can't recur.

   This is a pre-render step, not a server-side include: it rewrites the
   committed HTML files in place. Run it, review the diff, commit the
   result. Cloudflare Pages still serves plain static files
   (pages_build_output_dir = "."); nothing changes at request time.

   Usage:  node tools/build-shell.mjs           (from bloodbowl/)
           node tools/build-shell.mjs --check   (fail if files would change)
   ═══════════════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK_ONLY = process.argv.includes('--check');

const PAGES = [
  'index.html',
  'about/index.html',
  'account/index.html',
  'browse/index.html',
  'coach/index.html',
  'rules/index.html',
  'skills/index.html',
  'starplayers/index.html',
  'tables/index.html',
  'teams/index.html',
  'tournaments/index.html',
  'join/index.html',
  'game/index.html',
  'play/index.html',
];

const HEADER_PARTIAL = readFileSync(path.join(ROOT, '_shell/header.html'), 'utf8').trimEnd();
const FOOTER_PARTIAL = readFileSync(path.join(ROOT, '_shell/footer.html'), 'utf8').trimEnd();
const PRELOAD_PARTIAL = readFileSync(path.join(ROOT, '_shell/preload.html'), 'utf8').trimEnd();

/* The markers themselves stay in the committed file permanently — only the
   content between them is regenerated each run, so the build is safe to
   re-run any number of times (idempotent once the source is unchanged). */
const HEADER_RE = /<!-- BB:HEADER -->[\s\S]*?<!-- \/BB:HEADER -->/;
const FOOTER_RE = /<!-- BB:FOOTER -->[\s\S]*?<!-- \/BB:FOOTER -->/;
const PRELOAD_RE = /<!-- BB:PRELOAD -->[\s\S]*?<!-- \/BB:PRELOAD -->/;

const hashCache = new Map();
function contentHash(absPath) {
  if (hashCache.has(absPath)) return hashCache.get(absPath);
  const buf = readFileSync(absPath);
  const hash = createHash('md5').update(buf).digest('hex').slice(0, 8);
  hashCache.set(absPath, hash);
  return hash;
}

/* Rewrite ?v= on every local (inside bloodbowl/) stylesheet/script reference
   to a content hash. Assets outside bloodbowl/ (the parent site's shared
   style.css, WEB/ fonts) are left alone — this tool doesn't own them.
   rel="preload" links are skipped: their href must match the corresponding
   @font-face url() byte-for-byte (that url() carries no query string) or
   the browser treats the preload as unused and fetches the font twice. */
function versionAssets(html, baseDir) {
  let changed = 0;
  const tagRe = /<(?:link|script)\b[^>]*>/g;
  const out = html.replace(tagRe, (tag) => {
    if (/\brel="preload"/.test(tag)) return tag;
    const attrMatch = tag.match(/\b(href|src)="([^"]+)"/);
    if (!attrMatch) return tag;
    const [attrFull, attr, url] = attrMatch;
    if (/^(https?:)?\/\//.test(url) || url.startsWith('#') || url.startsWith('/')) return tag;
    const [urlPath] = url.split('?');
    const abs = path.normalize(path.join(baseDir, urlPath));
    if (!abs.startsWith(ROOT + path.sep) || !existsSync(abs)) return tag;
    const hash = contentHash(abs);
    const newUrl = `${urlPath}?v=${hash}`;
    if (newUrl !== url) changed++;
    return tag.replace(attrFull, `${attr}="${newUrl}"`);
  });
  return { out, changed };
}

let anyChanged = false;
const report = [];

for (const page of PAGES) {
  const abs = path.join(ROOT, page);
  let src = readFileSync(abs, 'utf8');
  const before = src;

  const isHome = page === 'index.html';
  const header = HEADER_PARTIAL.replace('{{HOME_LABEL}}', isHome ? 'Main Menu' : 'Return to Main Menu');

  const hasBase = /<base href="\.\.\/">/.test(src);
  /* bbPrefix reaches bloodbowl/ from this document; siteAssetPrefix reaches
     the parent site root (one level above bloodbowl/) — same two path
     shapes every stylesheet <link> on the page already uses. */
  const bbPrefix = (isHome || hasBase) ? '' : '../';
  const siteAssetPrefix = bbPrefix + '../';
  const preload = PRELOAD_PARTIAL.replaceAll('{{BB}}', bbPrefix).replaceAll('{{SITE}}', siteAssetPrefix);

  if (!HEADER_RE.test(src) || !FOOTER_RE.test(src) || !PRELOAD_RE.test(src)) {
    console.error(`✗ ${page}: missing BB:HEADER/BB:FOOTER/BB:PRELOAD markers`);
    process.exitCode = 1;
    continue;
  }
  src = src.replace(HEADER_RE, `<!-- BB:HEADER -->\n${header}\n  <!-- /BB:HEADER -->`);
  src = src.replace(FOOTER_RE, `<!-- BB:FOOTER -->\n${FOOTER_PARTIAL}\n  <!-- /BB:FOOTER -->`);
  src = src.replace(PRELOAD_RE, `<!-- BB:PRELOAD -->\n${preload}\n  <!-- /BB:PRELOAD -->`);

  const baseDir = hasBase ? ROOT : path.dirname(abs);
  const { out, changed } = versionAssets(src, baseDir);
  src = out;

  if (src !== before) {
    anyChanged = true;
    report.push(`${page}  (shell refreshed${changed ? `, ${changed} asset version${changed === 1 ? '' : 's'} updated` : ''})`);
    if (!CHECK_ONLY) writeFileSync(abs, src);
  }
}

if (CHECK_ONLY) {
  if (anyChanged) {
    console.error('Shell/versioning is stale on:\n  ' + report.join('\n  '));
    console.error('\nRun `node tools/build-shell.mjs` and commit the result.');
    process.exit(1);
  }
  console.log('Shell + asset versions are up to date on all pages.');
} else {
  if (report.length) console.log('Updated:\n  ' + report.join('\n  '));
  else console.log('No changes — shell + asset versions already up to date.');
}
