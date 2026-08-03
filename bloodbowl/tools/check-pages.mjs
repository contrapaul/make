#!/usr/bin/env node
'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   bloodbowl/tools/check-pages.mjs

   Guards against the regressions documented in REFACTOR-PLAN.md:
   - every locally-referenced asset actually exists on disk (§1.1/§1.6)
   - every referenced .js file parses (§1.1 B1 — this would have caught it)
   - no page leaks scaffolding text ("placeholder ...") (§1.1 B2)
   - the header/footer shell is up to date and every local asset carries
     one consistent ?v= across the whole site (§1.2/§1.3)

   Run via `node tools/check-pages.mjs` (from bloodbowl/). Exits non-zero
   on any failure, with every problem listed (not just the first).
   ═══════════════════════════════════════════════════════════════════════ */

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

const errors = [];
const jsChecked = new Set();
const assetVersions = new Map(); // urlPath (no query) -> Set of ?v= values seen

for (const page of PAGES) {
  const abs = path.join(ROOT, page);
  const src = readFileSync(abs, 'utf8');

  if (/placeholder (top|bottom)/i.test(src)) {
    errors.push(`${page}: leaks scaffolding text ("placeholder top/bottom")`);
  }
  if (!/<!-- BB:HEADER -->[\s\S]*<!-- \/BB:HEADER -->/.test(src)) {
    errors.push(`${page}: missing BB:HEADER markers — run tools/build-shell.mjs`);
  }
  if (!/<!-- BB:FOOTER -->[\s\S]*<!-- \/BB:FOOTER -->/.test(src)) {
    errors.push(`${page}: missing BB:FOOTER markers — run tools/build-shell.mjs`);
  }

  const hasBase = /<base href="\.\.\/">/.test(src);
  const baseDir = hasBase ? ROOT : path.dirname(abs);

  const attrRe = /<(?:link|script)\b[^>]*?\b(?:href|src)="([^"]+)"/g;
  let m;
  while ((m = attrRe.exec(src))) {
    const url = m[1];
    if (/^(https?:)?\/\//.test(url) || url.startsWith('#') || url.startsWith('/')) continue;
    const [urlPath, query] = url.split('?');
    const abs2 = path.normalize(path.join(baseDir, urlPath));
    if (!existsSync(abs2)) {
      errors.push(`${page}: references missing file "${url}" (resolved ${path.relative(ROOT, abs2)})`);
      continue;
    }
    if (abs2.startsWith(ROOT + path.sep)) {
      const key = path.relative(ROOT, abs2);
      if (!assetVersions.has(key)) assetVersions.set(key, new Set());
      assetVersions.get(key).add(query || '(none)');
    }
    if (urlPath.endsWith('.js') && !jsChecked.has(abs2)) {
      jsChecked.add(abs2);
      try {
        execFileSync(process.execPath, ['--check', abs2], { stdio: 'pipe' });
      } catch (e) {
        errors.push(`${page}: ${path.relative(ROOT, abs2)} fails to parse:\n${e.stderr}`);
      }
    }
  }
}

for (const [key, versions] of assetVersions) {
  if (versions.size > 1) {
    errors.push(`${key}: referenced under ${versions.size} different versions (${[...versions].join(', ')}) — run tools/build-shell.mjs`);
  }
}

if (errors.length) {
  console.error(`✗ ${errors.length} problem(s):\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`✓ ${PAGES.length} pages, ${jsChecked.size} scripts checked — all clean.`);
