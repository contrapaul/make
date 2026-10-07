/* ============================================================
   Code with AI — Setup tab logic (js/tabs/setup.js)
   The pure helpers only; the DOM wiring is checked in a browser.
   Run: npm test
   ============================================================ */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { osFromPlatform, resolveInitialOs, fileNameOf } from '../js/tabs/setup.js';

test('osFromPlatform: Apple platforms get the Mac steps, everything else Windows', () => {
  assert.equal(osFromPlatform('MacIntel'), 'mac');
  assert.equal(osFromPlatform('macOS'), 'mac');                 // userAgentData.platform
  assert.equal(osFromPlatform('', 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'), 'mac');
  assert.equal(osFromPlatform('Win32'), 'win');
  assert.equal(osFromPlatform('Windows'), 'win');
  assert.equal(osFromPlatform('Linux x86_64'), 'win');          // closer match than Mac
  assert.equal(osFromPlatform('', ''), 'win');
});

test('resolveInitialOs: a stored choice wins; a bad one is ignored', () => {
  assert.equal(resolveInitialOs({ stored: 'mac', platform: 'Win32' }), 'mac');
  assert.equal(resolveInitialOs({ stored: 'linux', platform: 'MacIntel' }), 'mac');
  assert.equal(resolveInitialOs({ stored: null, platform: 'Win32' }), 'win');
});

test('fileNameOf: the bare file name, without folders or a query', () => {
  assert.equal(fileNameOf('images/vscode/setup-03-window.png'), 'setup-03-window.png');
  assert.equal(fileNameOf('images/vscode/a.png?v=2#x'), 'a.png');
  assert.equal(fileNameOf(undefined), '');
});
