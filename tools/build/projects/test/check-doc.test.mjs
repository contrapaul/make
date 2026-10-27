// e02s06t01 seed: check-doc link checker, the pure half in Node.
// collectLinks pins the two data modules; urlStatus/classifyError run
// against an injected fake fetch (no network in `npm test`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectLinks, urlStatus, classifyError } from '../check-doc.mjs';
import { GLOSSARY } from '../js/data/glossary.js';
import { RESOURCES } from '../js/data/resources.js';

const GLOSS_LINKS = GLOSSARY.reduce((n, t) => n + (t.links || []).filter(l => l && l.url).length, 0);
const RES_LINKS = RESOURCES.filter(r => r.url && /^https?:\/\//.test(r.url)).length;

test('collectLinks: every glossary link + every live resource, in order', () => {
  const links = collectLinks();
  assert.equal(links.length, GLOSS_LINKS + RES_LINKS);
  assert.ok(links.every(l => /^https?:\/\//.test(l.url)), 'all urls are http(s)');
  assert.deepEqual(links.slice(-2), [
    { label: 'resources/build', url: 'https://build.contrapaul.com' },
    { label: 'resources/codewithai', url: 'https://edu.contrapaul.com/codewithai' },
  ]);
});

test('collectLinks: the same-site resource contributes no external link', () => {
  const links = collectLinks();
  assert.equal(links.length, GLOSS_LINKS + 2, 'only the 2 external resources');
  assert.ok(links.every(l => l.url), 'no null urls');
});

const fakeFetch = (impl) => async (url, opts) => {
  opts?.signal?.addEventListener('abort', () => {
    const e = new Error('aborted');
    e.name = 'AbortError';
    throw e;
  });
  return impl(url);
};

test('urlStatus: 200/3xx are ok, 403/429 are blocked, 404/500 are dead', async () => {
  const byStatus = {};
  const f = fakeFetch((u) => ({ status: byStatus[u] ?? 200 }));
  assert.equal((await urlStatus('https://a.example', f)).status, 'ok');
  byStatus['https://b.example'] = 302;
  assert.equal((await urlStatus('https://b.example', f)).status, 'ok');
  byStatus['https://c.example'] = 403;
  assert.equal((await urlStatus('https://c.example', f)).status, 'blocked');
  byStatus['https://d.example'] = 429;
  assert.equal((await urlStatus('https://d.example', f)).status, 'blocked');
  byStatus['https://e.example'] = 404;
  assert.deepEqual((await urlStatus('https://e.example', f)), { status: 'dead', code: 404 });
  byStatus['https://f.example'] = 500;
  assert.equal((await urlStatus('https://f.example', f)).status, 'dead');
});

test('urlStatus: transport trouble is unreachable, not dead', async () => {
  const dns = fakeFetch(() => {
    const e = new Error('getaddrinfo ENOTFOUND x');
    e.cause = { code: 'ENOTFOUND' };
    return Promise.reject(e);
  });
  const refused = fakeFetch(() => {
    const e = new Error('connect ECONNREFUSED');
    e.cause = { code: 'ECONNREFUSED' };
    return Promise.reject(e);
  });
  const other = fakeFetch(() => {
    const e = new Error('weird TLS junk');
    e.cause = { code: 'EPROTO' };
    return Promise.reject(e);
  });
  // Name/host gone is a dead reference...
  assert.equal((await urlStatus('https://gone.example', dns)).status, 'dead');
  assert.equal((await urlStatus('https://gone.example', refused)).status, 'dead');
  // ...other transport trouble is 'unreachable' (retry, not fix).
  assert.equal((await urlStatus('https://x.example', other)).status, 'unreachable');
  // Timeouts are unreachable.
  const aborting = fakeFetch(async () => {
    const e = new Error('aborted');
    e.name = 'AbortError';
    throw e;
  });
  assert.equal((await urlStatus('https://slow.example', aborting)).status, 'unreachable');
});

test('classifyError: ENOTFOUND / ECONNREFUSED / EAI_AGAIN are dead', () => {
  for (const code of ['ENOTFOUND', 'ECONNREFUSED', 'EAI_AGAIN']) {
    const err = new Error(code);
    err.cause = { code };
    assert.equal(classifyError(err), 'dead');
  }
});

test('check-doc site data: 24 links total (22 glossary + 2 external resources)', () => {
  assert.equal(collectLinks().length, 24);
  assert.equal(GLOSS_LINKS, 22, 'glossary reference links');
  assert.equal(RES_LINKS, 2, 'external resource links, same-site link excluded');
  assert.ok(RESOURCES.find(r => r.id === 'languages').url.startsWith('/tools/languages/'),
    'languages card points at the same-site languages page');
});
