// Shared headless-Edge harness for tools/chinese verification scripts.
// Boots `python3 -m http.server` on a folder plus Microsoft Edge in headless mode,
// opens one tab, and records every request URL so a script can assert nothing
// leaves localhost (the China-wifi requirement in AGENTS.md).
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const isUp = (url) => fetch(url).then((r) => r.ok, () => false);
async function waitHttp(url, ms, what) {
  for (let t = Date.now(); Date.now() - t < ms; await sleep(250))
    if (await isUp(url)) return;
  throw new Error(`${what} did not come up at ${url}`);
}

class Tab {
  constructor(ws) {
    this.ws = ws; this.next = 1; this.pending = new Map();
    this.requests = []; this.log = [];
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(m.error.message)) : resolve(m.result);
      }
    };
  }
  send(method, params = {}) {
    const id = this.next++;
    return new Promise((res, rej) => {
      this.pending.set(id, { resolve: res, reject: rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true,
    });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    }
    return r.result.value;
  }
  async goto(url, settleMs = 1500) {
    this.requests.length = 0; this.log.length = 0;
    const loaded = new Promise((r) => {
      const on = (e) => {
        const m = JSON.parse(e.data);
        if (m.method === 'Page.loadEventFired') { this.ws.removeEventListener('message', on); r(); }
      };
      this.ws.addEventListener('message', on);
      setTimeout(r, 8000);
    });
    await this.send('Page.navigate', { url });
    await loaded;
    await sleep(settleMs);
  }
  async screenshot(path, { full = false } = {}) {
    const { data } = await this.send('Page.captureScreenshot',
      { format: 'png', captureBeyondViewport: full });
    writeFileSync(path, Buffer.from(data, 'base64'));
    return path;
  }
  async setViewport(width, height, mobile) {
    await this.send('Emulation.setDeviceMetricsOverride',
      { width, height, deviceScaleFactor: 1, mobile });
    // `Emulation.setEmulatedMedia` does not flip (hover:none) in headless Edge; touch
    // emulation does, which is what the stylesheet's touch-target rules key on.
    await this.send('Emulation.setTouchEmulationEnabled', { enabled: !!mobile });
  }
  external(base) { return this.requests.filter((u) => !u.startsWith(base)); }
  // Requests by method, so a HEAD probe is not mistaken for a real play.
  served(suffix, method) {
    return this.log.filter((r) => r.url.endsWith(suffix)
      && (!method || r.method === method)).map((r) => r.url);
  }
  async waitFor(expression, ms = 20000) {
    for (let t = Date.now(); Date.now() - t < ms; await sleep(200)) {
      if (await this.evaluate(`!!(${expression})`)) return true;
    }
    return false;
  }
}

export async function launch({ siteDir, port = 8899, cdpPort = 9399, shotsDir }) {
  const tmp = mkdtempSync(join(tmpdir(), 'chinese-verify-'));
  if (shotsDir) mkdirSync(shotsDir, { recursive: true });
  const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'],
    { cwd: siteDir, stdio: 'ignore' });
  const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${join(tmp, 'edge')}`, '--no-first-run', '--no-default-browser-check',
    'about:blank'], { stdio: 'ignore' });

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    server.kill(); edge.kill();
    setTimeout(() => rmSync(tmp, { recursive: true, force: true, maxRetries: 8, maxRetryTime: 3000 }), 400);
  };
  process.on('SIGINT', () => { stop(); process.exit(130); });

  await waitHttp(`http://127.0.0.1:${cdpPort}/json/version`, 30000, 'Edge');
  const base = `http://127.0.0.1:${port}`;
  await waitHttp(base, 30000, 'http.server');

  const list = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
  const ws = new WebSocket(`ws://127.0.0.1:${cdpPort}/devtools/page/${list.find((t) => t.type === 'page').id}`);
  await new Promise((r) => (ws.onopen = r));
  const tab = new Tab(ws);
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.method === 'Network.requestWillBeSent') {
      tab.requests.push(m.params.request.url);
      tab.log.push({ url: m.params.request.url, method: m.params.request.method });
    }
  });
  await tab.send('Network.enable');
  await tab.send('Page.enable');
  await tab.send('Runtime.enable');

  return { tab, base, shotsDir, stop };
}

export function makeChecks() {
  const failures = [];
  const check = (ok, label, detail = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
    if (!ok) failures.push(label);
  };
  return { check, failures };
}
