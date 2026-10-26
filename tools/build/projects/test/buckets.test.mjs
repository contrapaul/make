// TDD seed: purposes normalize into the plan's 9 buckets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bucketFromPurpose, subGroupFromNum, SECTIONS, languagesFromStack, modeFromCell, slugFromName } from '../js/data/buckets.js';

test('SECTIONS has the plan 9 buckets in order', () => {
  assert.deepEqual(
    SECTIONS.map(s => s.label),
    ['Games & Fun', 'Creative', 'Utilities', 'Task Processing', 'Data & Analysis', 'Web & DevOps', 'Learning & CS', 'Productivity', 'Education']
  );
});

test('bucketFromPurpose: phrase + word rules', () => {
  assert.equal(bucketFromPurpose('Task Processing'), 'task-processing');
  assert.equal(bucketFromPurpose('Learning / Task Processing'), 'task-processing');
  assert.equal(bucketFromPurpose('Game / Fun'), 'games');
  assert.equal(bucketFromPurpose('Game / Fun / Learning'), 'games');
  assert.equal(bucketFromPurpose('Creative / Fun'), 'creative');
  assert.equal(bucketFromPurpose('Creative / SEO'), 'creative');
  assert.equal(bucketFromPurpose('Data Analysis'), 'data-analysis');
  assert.equal(bucketFromPurpose('Data / Info'), 'data-analysis');
  assert.equal(bucketFromPurpose('Web / Utility'), 'web-devops');
  assert.equal(bucketFromPurpose('Utility / DevOps'), 'web-devops');
  assert.equal(bucketFromPurpose('Utility / SEO'), 'web-devops');
  assert.equal(bucketFromPurpose('Security / Utility'), 'web-devops');
  assert.equal(bucketFromPurpose('Web / Publishing'), 'web-devops');
  assert.equal(bucketFromPurpose('Learning / CS'), 'learning-cs');
  assert.equal(bucketFromPurpose('Learning / Math'), 'learning-cs');
  assert.equal(bucketFromPurpose('Learning / DB'), 'learning-cs');
  assert.equal(bucketFromPurpose('Math / Fun'), 'games');
  assert.equal(bucketFromPurpose('Game / Learning'), 'games');
  assert.equal(bucketFromPurpose('Productivity'), 'productivity');
  assert.equal(bucketFromPurpose('Learning / Productivity'), 'learning-cs');
  assert.equal(bucketFromPurpose('Utility'), 'utilities');
  // "Learning / Utility" rows learn (P2-2 Learn Python via Arcade);
  // word order carries the meaning, not the word.
  assert.equal(bucketFromPurpose('Utility / Learning'), 'learning-cs');
  assert.equal(bucketFromPurpose('Accessibility / Utility'), 'utilities');
  assert.equal(bucketFromPurpose('Accessibility'), 'utilities');
  assert.equal(bucketFromPurpose('Creative / Web'), 'creative');
  assert.equal(bucketFromPurpose('Learning / Utility'), 'learning-cs');
  assert.equal(bucketFromPurpose('Fun / Learning'), 'games');
  assert.equal(bucketFromPurpose('Learning'), 'learning-cs');
  assert.equal(bucketFromPurpose('Unknown Gobbledygook'), 'utilities');
});

test('subGroupFromNum: fixed P3 row ranges', () => {
  assert.equal(subGroupFromNum(1).id, 'teachers-tools');
  assert.equal(subGroupFromNum(10).id, 'teachers-tools');
  assert.equal(subGroupFromNum(11).id, 'study-aids');
  assert.equal(subGroupFromNum(20).id, 'study-aids');
  assert.equal(subGroupFromNum(21).id, 'subject-drills');
  assert.equal(subGroupFromNum(40).id, 'subject-drills');
  assert.equal(subGroupFromNum(41).id, 'accessibility');
  assert.equal(subGroupFromNum(46).id, 'accessibility');
  assert.equal(subGroupFromNum(47).id, 'admin-workflow');
  assert.equal(subGroupFromNum(50).id, 'admin-workflow');
});

test('languagesFromStack: tags from real stacks, no invention', () => {
  assert.deepEqual(languagesFromStack('Python (Pandas + Matplotlib)'), ['python']);
  assert.deepEqual(languagesFromStack('JavaScript (D3 + SVG)'), ['js']);
  assert.deepEqual(languagesFromStack('HTML + CSS + a bit of JS'), ['css', 'html', 'js']);
  assert.deepEqual(languagesFromStack('C or Rust (sockets)'), ['c', 'rust']);
  assert.deepEqual(languagesFromStack('C++ (SDL)'), ['cpp']);
  assert.deepEqual(languagesFromStack('C# (WPF + iTextSharp)'), ['csharp']);
  assert.deepEqual(languagesFromStack('Go or Python'), ['go', 'python']);
  assert.deepEqual(languagesFromStack('Python (Flask) + SQLite'), ['python', 'sql']);
  assert.deepEqual(languagesFromStack('JavaScript (Svelte + Vite)'), ['js', 'svelte']);
  assert.deepEqual(languagesFromStack('Node + Express + Socket.IO'), ['js', 'node']);
  assert.deepEqual(languagesFromStack('Bash + curl'), ['bash']);
  assert.deepEqual(languagesFromStack('Nim (FFMPEG)'), ['nim']);
  assert.deepEqual(languagesFromStack('Java'), ['java']);
  assert.deepEqual(languagesFromStack('Python (pythautomat)'), ['python']);
  assert.deepEqual(languagesFromStack('Something Unknown'), []);
  assert.deepEqual(languagesFromStack('JavaScript (Canvas)'), ['js']);
  assert.deepEqual(languagesFromStack('JavaScript (Canvas) or C (ncurses)'), ['c', 'js']);
});

test('modeFromCell', () => {
  assert.equal(modeFromCell('Online'), 'online');
  assert.equal(modeFromCell('offline'), 'offline');
  assert.equal(modeFromCell('Either'), 'either');
  assert.equal(modeFromCell('  Online  '), 'online');
});

test('slugFromName: kebab, stable', () => {
  assert.equal(slugFromName('Snake, Pong & Breakout'), 'snake-pong-and-breakout');
  assert.equal(slugFromName('CRA *Crawl* Dupes'), 'cra-crawl-dupes');
  assert.ok(slugFromName('A'.repeat(99)).length <= 48);
});
