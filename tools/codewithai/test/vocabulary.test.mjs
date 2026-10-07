/* ============================================================
   Code with AI — vocabulary check (style-guide.md §3–§5)
   ------------------------------------------------------------
   The rules a grade score cannot see, and the ones that matter
   most for a reader who is learning English:

     1. Punctuation: no em dash, no en dash outside a number range,
        no middot inside a sentence.
     2. Words that blame the reader: simply, just, obviously...
     3. Latin abbreviations: e.g., i.e., etc., vs.
     4. Phrasal verbs that have a one-word replacement. Each one
        looks like two words the student already knows and means
        something else.
     5. Controlled vocabulary (tab prose only): one word per thing,
        every time. The glossary is exempt from this one because
        it has to name the alternatives in order to define them,
        and so is the text of a glossary link, for the same reason.

   Rules 1–4 apply to every English string a student reads: tab
   prose, the footer, and both lengths of glossary entry.

   KEEP IN SYNC with the tables in style-guide.md. This file is
   the one that is enforced; the guide explains why.

   Run: npm test   (or: node --test "test/*.test.mjs")
   ============================================================ */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { pagePanels, htmlToBlocks, loadGlossary, proseOf } from './lib/prose.mjs';

/* Optional object pronoun between verb and particle: "set it up". */
const OBJ = String.raw`(?:\s+(?:it|them|this|that|these|those|everything|something))?`;
const pv = (verbs, particle, use) => ({
  re: new RegExp(String.raw`\b(?:${verbs})${OBJ}\s+${particle}\b`, 'i'),
  label: `"${verbs.split('|')[0]} ${particle.replace(/\\s\+/g, ' ')}"`,
  use,
});

export const PUNCTUATION = [
  { re: /—/, label: 'em dash (—)', use: 'a full stop and a second sentence' },
  { re: /(?<!\d)–|–(?!\d)/, label: 'en dash outside a number range (–)', use: 'a full stop or a comma' },
  { re: /\s·\s/, label: 'middot inside a sentence (·)', use: 'a full stop or a comma (middots are for data labels only)' },
];

export const BLAME_WORDS = [
  { re: /\bsimply\b/i, label: '"simply"', use: 'delete it' },
  { re: /\bjust\b/i, label: '"just"', use: 'delete it, or "only"' },
  { re: /\bobvious(ly)?\b/i, label: '"obviously"', use: 'delete it' },
  { re: /\bof course\b/i, label: '"of course"', use: 'delete it' },
  { re: /\bbasically\b/i, label: '"basically"', use: 'delete it' },
];

export const LATIN = [
  { re: /\be\.g\./i, label: '"e.g."', use: '"for example"' },
  { re: /\bi\.e\./i, label: '"i.e."', use: '"this means" or a new sentence' },
  { re: /\betc\./i, label: '"etc."', use: 'finish the list, or "and others"' },
  // Lowercase only: "VS Code" is the editor's name, not the abbreviation.
  { re: /\bvs\.?(?=\s)/, label: '"vs"', use: '"or", "compared with"' },
];

export const PHRASAL_VERBS = [
  pv('set|sets|setting', 'up', '"install", "create", "prepare"'),
  pv('work|works|worked|working', 'out', '"find", "calculate"'),
  pv('figure|figures|figured|figuring', 'out', '"find", "understand"'),
  pv('find|finds|found|finding', 'out', '"learn", "check"'),
  pv('turn|turns|turned|turning', 'up', '"appear"'),
  pv('end|ends|ended|ending', 'up', 'rephrase: say what the result is'),
  pv('go|goes|went|gone|going', 'through', '"read", "follow", "pass"'),
  pv('come|comes|came|coming', String.raw`up\s+with`, '"think of", "write"'),
  pv('look|looks|looked|looking', 'into', '"check"'),
  pv('look|looks|looked|looking', 'up', '"search for"'),
  pv('carry|carries|carried|carrying', 'out', '"do"'),
  pv('point|points|pointed|pointing', 'out', '"show"'),
  pv('give|gives|gave|given|giving', 'up', '"stop"'),
  pv('put|puts|putting', 'together', '"build", "make"'),
  pv('run|runs|ran|running', 'into', '"meet", "get"'),
  pv('get|gets|got|getting', String.raw`rid\s+of`, '"remove", "delete"'),
  pv('pick|picks|picked|picking', 'up', '"learn"'),
  pv('break|breaks|broke|breaking', 'down', '"split", "stop working"'),
  pv('back|backs|backed|backing', 'up', '"copy", "save a copy"'),
  pv('bring|brings|brought|bringing', 'up', '"show", "open"'),
  pv('leave|leaves|left|leaving', 'out', '"skip", "not include"'),
  pv('shut|shuts|shutting', 'down', '"close", "turn off"'),
  pv('sort|sorts|sorted|sorting', 'out', '"fix"'),
  pv('mess|messes|messed|messing', 'up', '"break"'),
  pv('try|tries|tried|trying', 'out', '"try"'),
  pv('keep|keeps|kept|keeping', String.raw`track\s+of`, '"record", "follow"'),
];

/* Tab prose only. Left side is banned; right side is the one word to use. */
export const CONTROLLED = [
  { re: /\bdirector(y|ies)\b/i, label: '"directory"', use: '"folder"' },
  { re: /\blog(?:ging)?[\s-]?(?:in|on)\b|\blogin\b/i, label: '"log in"', use: '"sign in"' },
  { re: /\bclick(?:s|ed|ing)?\s+on\b/i, label: '"click on"', use: '"click"' },
  { re: /\bhit(?:s|ting)?\b/i, label: '"hit"', use: '"press" (a key) or "click" (a button)' },
  { re: /\bcommand prompt\b/i, label: '"command prompt"', use: '"terminal"' },
  { re: /\bnavigate\s+to\b/i, label: '"navigate to"', use: '"go to", "open"' },
  { re: /\bin order to\b/i, label: '"in order to"', use: '"to"' },
  { re: /\bprior to\b/i, label: '"prior to"', use: '"before"' },
  { re: /\butili[sz](e|es|ed|ing)\b/i, label: '"utilize"', use: '"use"' },
];

/** Every rule hit in `texts`, as printable rows. */
function findAll(texts, rules) {
  const out = [];
  for (const { where, text } of texts) {
    for (const r of rules) {
      for (const m of text.matchAll(new RegExp(r.re.source, `${r.re.flags}g`))) {
        const at = Math.max(0, m.index - 30);
        const snippet = text.slice(at, m.index + m[0].length + 30).replace(/\s+/g, ' ');
        out.push(`[${where}] ${r.label} → use ${r.use}\n        …${snippet}…`);
      }
    }
  }
  return out;
}

const { GLOSSARY } = await loadGlossary();
const panels = pagePanels();

const pageTexts = Object.entries(panels).flatMap(([name, html]) =>
  htmlToBlocks(html).map((text) => ({ where: name, text })));
const pageTextsNoGloss = Object.entries(panels).flatMap(([name, html]) =>
  htmlToBlocks(html, { dropGlossLinks: true }).map((text) => ({ where: name, text })));
// Code spans are skipped, the same as <code> on the page.
const glossTexts = GLOSSARY.flatMap((g) => [
  { where: `${g.id}.short`, text: proseOf(g.short) },
  { where: `${g.id}.full`, text: proseOf(g.full) },
]);
const everything = [...pageTexts, ...glossTexts];

const check = (name, texts, rules) => test(name, (t) => {
  const bad = findAll(texts, rules);
  t.diagnostic(`${bad.length} hit(s)`);
  assert.equal(bad.length, 0, `Rewrite these:\n${bad.map((b) => `    ${b}`).join('\n')}`);
});

check('punctuation: no em dash, no stray en dash, no middot in a sentence', everything, PUNCTUATION);
check('no words that blame the reader', everything, BLAME_WORDS);
check('no Latin abbreviations', everything, LATIN);
check('no phrasal verbs that have a one-word replacement', everything, PHRASAL_VERBS);
check('tab prose uses the controlled vocabulary', pageTextsNoGloss, CONTROLLED);

/* The rules must catch what they claim to. Without this, a typo in
   a regex silently passes everything. */
test('rules catch their own examples', () => {
  const cases = [
    [PHRASAL_VERBS, 'First, set it up on your laptop.'],
    [PHRASAL_VERBS, 'We worked out the answer.'],
    [PHRASAL_VERBS, 'You will come up with a plan.'],
    [BLAME_WORDS, 'Simply open the file.'],
    [LATIN, 'Use a tag, e.g. a heading.'],
    [LATIN, 'Local vs cloud.'],
    [PUNCTUATION, 'It works — mostly.'],
    [PUNCTUATION, 'Code with AI · a static site'],
    [CONTROLLED, 'Click on the button.'],
    [CONTROLLED, 'Open the directory.'],
    [CONTROLLED, 'Log in with your account.'],
  ];
  for (const [rules, text] of cases) {
    assert.ok(rules.some((r) => r.re.test(text)), `no rule caught: ${text}`);
  }
  const clean = [
    'Open the Setup tab.',            // "setup" the noun is fine
    'Pages 4–5 cover this.',          // en dash in a number range
    'RTX 3090 24 GB',                 // nothing here
    'Fill in the blank.',             // allowed: classroom-standard phrase
    'Turn on Copilot.',               // allowed: it is the label in the UI
    'Open VS Code.',                  // the editor's name, not "vs" 
  ];
  for (const text of clean) {
    for (const rules of [PHRASAL_VERBS, BLAME_WORDS, LATIN, PUNCTUATION, CONTROLLED]) {
      assert.ok(!rules.some((r) => r.re.test(text)), `false positive on: ${text}`);
    }
  }
});
