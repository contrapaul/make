// Runs the soundboard's headless-Edge browser suites against `wrangler pages dev`.
// Seeds throwaway local-D1 users/sessions for the signed-in suites and removes them after.
// usage: npm run test:browser [-- suite ...]   (e.g. `-- rec trim`; default: all)
import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeTone } from './wav.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const PORT = 8788, CDP = 9222;
const EDGE = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
const base = `http://localhost:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- local D1 -------------------------------------------------------------------
const d1 = (args) => {
  const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'bloodbowl-db', '--local', '--json', ...args],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(out.slice(out.indexOf('[')));
};
const sql = (command) => d1(['--command', command]);
const ensureSchema = () => {
  if (sql(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'soundboards'`)[0].results.length) return;
  const dir = join(root, 'db/migrations');
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) d1(['--file', join(dir, f)]);
};

const TEST = `user_id LIKE 'sbtest-%'`;
const users = {
  account: { id: 'sbtest-account', username: 'sbtest', email: 'sbtest@example.test' }, // account.mjs expects "sbtest"
  rec: { id: 'sbtest-rec', username: 'sbtest-rec', email: 'sbtest-rec@example.test' },
  b1: { id: 'sbtest-b1', username: 'sbtest-b1', email: 'sbtest-b1@example.test' },
};
const tokens = {}; // name -> [token, ...]; the last one is kept back for cleanup
const deleteRows = () => sql(`DELETE FROM sessions WHERE ${TEST}; DELETE FROM auth_tokens WHERE ${TEST};
  DELETE FROM sounds WHERE ${TEST}; DELETE FROM soundboards WHERE ${TEST}; DELETE FROM users WHERE id LIKE 'sbtest-%';
  DELETE FROM rate_limits WHERE key = 'login:sbtest@example.test';`);
const seed = () => {
  deleteRows(); // leftovers from an aborted run
  const now = Date.now(), rows = [], sess = [];
  // account and rec need one session; b1 signs out for real once, which deletes its first session.
  const need = { account: 1, rec: 1, b1: 2 };
  for (const [name, u] of Object.entries(users)) {
    rows.push(`('${u.id}', '${u.email}', '${u.username}', 'disabled', 1, ${now})`);
    tokens[name] = Array.from({ length: need[name] + 1 }, () => randomBytes(32).toString('base64url'));
    for (const t of tokens[name]) sess.push(`('${createHash('sha256').update(t).digest('hex')}', '${u.id}', ${now}, ${now + 3600e3})`);
  }
  sql(`INSERT INTO users (id, email, username, password_hash, email_verified, created_at) VALUES ${rows.join(', ')};
    INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES ${sess.join(', ')};`);
};
const cleanup = async () => {
  // Delete uploaded clips through the API so the local R2 objects go too, then the rows.
  const sounds = sql(`SELECT id, user_id FROM sounds WHERE ${TEST}`)[0].results;
  for (const s of sounds) {
    const name = Object.keys(users).find((k) => users[k].id === s.user_id);
    const cookie = `bb_session=${tokens[name].at(-1)}`;
    await fetch(`${base}/api/sounds/${s.id}`, { method: 'DELETE', headers: { cookie } }).catch(() => {});
  }
  deleteRows();
};

// ---- processes --------------------------------------------------------------------
const procs = [];
const start = (cmd, args, opts) => { const p = spawn(cmd, args, { detached: true, ...opts }); procs.push(p); return p; };
const stopAll = () => Promise.all(procs.map((p) => new Promise((r) => {
  if (p.exitCode !== null || p.signalCode !== null) return r();
  p.once('exit', r); setTimeout(r, 10e3);
  try { process.kill(-p.pid, 'SIGTERM'); } catch { r(); }
})));
const waitHttp = async (url, ms, what) => {
  for (const t = Date.now(); Date.now() - t < ms; await sleep(300)) if (await fetch(url).then((r) => r.ok, () => false)) return;
  throw new Error(`${what} did not come up at ${url}`);
};
const isUp = (url) => fetch(url).then(() => true, () => false);

// Between suites: drop cookies (sign-ins) and close every tab the last suite opened.
const resetBrowser = async () => {
  const { webSocketDebuggerUrl } = await (await fetch(`http://localhost:${CDP}/json/version`)).json();
  const ws = new WebSocket(webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  await new Promise((r) => { ws.onmessage = r; ws.send(JSON.stringify({ id: 1, method: 'Storage.clearCookies' })); });
  ws.close();
  for (const t of await (await fetch(`http://localhost:${CDP}/json/list`)).json())
    if (t.type === 'page') await fetch(`http://localhost:${CDP}/json/close/${t.id}`).catch(() => {});
};

const runSuite = (name, args) => new Promise((done) => {
  const p = spawn(process.execPath, [join(here, `${name}.mjs`), ...args], { cwd: root });
  const timer = setTimeout(() => { console.log(`[${name}] TIMEOUT`); p.kill('SIGKILL'); }, 180e3);
  const tag = (chunk) => chunk.toString().split('\n').filter(Boolean).forEach((l) => console.log(`[${name}] ${l}`));
  p.stdout.on('data', tag); p.stderr.on('data', tag);
  p.on('close', (code) => { clearTimeout(timer); done(code === 0); });
});

// ---- main -------------------------------------------------------------------------
const tmp = mkdtempSync(join(tmpdir(), 'sb-browser-'));
const shots = join(here, 'shots');
const wavA = writeTone(join(tmp, 'a.wav'), { freq: 440 });
const wavB = writeTone(join(tmp, 'b.wav'), { freq: 660 });
const out = (name) => { const d = join(shots, name); mkdirSync(d, { recursive: true }); return d; };
const suites = {
  layout: () => [out('layout')],
  retrigger: () => [wavA, wavB],
  drag: () => [wavA, out('drag')],
  style: () => [out('style')],
  account: () => [tokens.account[0], out('account')],
  rec: () => [tokens.rec[0], out('rec')],
  trim: () => [out('trim')],
  b1: () => [tokens.b1.slice(0, -1).join(','), wavA],
  review: () => [wavA, out('review')],
};
const picked = process.argv.slice(2);
for (const n of picked) if (!suites[n]) { console.error(`unknown suite "${n}"; have: ${Object.keys(suites).join(' ')}`); process.exit(2); }

let seeded = false;
const results = [];
process.on('SIGINT', () => { stopAll(); process.exit(130); });
try {
  if (await isUp(base)) throw new Error(`port ${PORT} is already in use; stop the other dev server first`);
  if (await isUp(`http://localhost:${CDP}/json/version`)) throw new Error(`port ${CDP} is already in use (another debug browser?)`);
  ensureSchema();
  start('npx', ['wrangler', 'pages', 'dev', '--port', String(PORT)], { cwd: root, stdio: 'ignore' });
  start(EDGE, ['--headless=new', `--remote-debugging-port=${CDP}`, `--user-data-dir=${join(tmp, 'edge')}`,
    '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required',
    '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', 'about:blank'], { stdio: 'ignore' });
  await waitHttp(`http://localhost:${CDP}/json/version`, 30e3, 'Edge');
  await waitHttp(`${base}/tools/soundboard/`, 90e3, 'wrangler pages dev');
  seed(); seeded = true;
  for (const name of picked.length ? picked : Object.keys(suites)) {
    await resetBrowser();
    console.log(`\n=== ${name}`);
    results.push([name, await runSuite(name, [String(PORT), ...suites[name]()])]);
  }
} catch (e) {
  console.error(`\nERROR ${e.message}`);
  results.push(['setup', false]);
} finally {
  if (seeded) await cleanup().catch((e) => { console.error(`cleanup failed: ${e.message}`); results.push(['cleanup', false]); });
  await stopAll();
  rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

console.log('\n' + results.map(([n, ok]) => `${ok ? 'PASS' : 'FAIL'} ${n}`).join('\n'));
console.log(`screenshots: ${shots}`);
const failed = results.filter(([, ok]) => !ok).length;
console.log(failed ? `${failed} FAILED` : 'ALL SUITES PASS');
process.exit(failed ? 1 : 0);
