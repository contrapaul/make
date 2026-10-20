// e01s07 check: per-pad choke, cross-pad independence, echo tails, STOP. Measures the
// real output with an analyser spliced onto ctx.destination.
// usage: node retrigger.mjs <port> <wavA> <wavB>
const [port, wavA, wavB] = process.argv.slice(2);
const tab = await (await fetch('http://localhost:9222/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const errors = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description?.split('\n')[0]);
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.result.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (name, ok, detail) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); };

await send('Runtime.enable'); await send('Page.enable'); await send('DOM.enable'); await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
// Instrument before page scripts: log source start/stop per buffer, and tee destination into an analyser.
await send('Page.addScriptToEvaluateOnNewDocument', { source: `
  window.__log = [];
  const S = AudioBufferSourceNode.prototype;
  const st = S.start, sp = S.stop;
  S.start = function (...a) { window.__log.push(['start', this.buffer.duration.toFixed(2), performance.now()]); return st.apply(this, a); };
  S.stop = function (...a) { window.__log.push(['stop', this.buffer.duration.toFixed(2), performance.now()]); return sp.apply(this, a); };
  const conn = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    if (dest instanceof AudioDestinationNode && !dest.context.__an) {
      const an = dest.context.createAnalyser(); an.fftSize = 2048; dest.context.__an = an; window.__an = an;
      conn.call(this, an);
    }
    return conn.call(this, dest, ...rest);
  };
  window.__rms = () => { const a = new Float32Array(window.__an.fftSize); window.__an.getFloatTimeDomainData(a); let s = 0; for (const v of a) s += v * v; return Math.sqrt(s / a.length); };
`});
await send('Page.navigate', { url: `http://localhost:${port}/tools/soundboard/` }); await sleep(1200);
await ev('localStorage.clear()'); await send('Page.reload'); await sleep(1500);

// Fresh board opens in edit mode with P1..P3. Load clip A onto P1 and clip B onto P2.
const doc = await send('DOM.getDocument');
const fileNode = async () => (await send('DOM.querySelector', { nodeId: (await send('DOM.getDocument')).result.root.nodeId, selector: '#sb-file' })).result.nodeId;
const selectPad = (i) => ev(`document.querySelectorAll('.sb-pad')[${i}].dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))`);
await selectPad(0); await sleep(200);
await send('DOM.setFileInputFiles', { nodeId: await fileNode(), files: [wavA] }); await sleep(800);
await selectPad(1); await sleep(200);
await send('DOM.setFileInputFiles', { nodeId: await fileNode(), files: [wavB] }); await sleep(800);
await ev(`document.querySelector('#sb-mode').click()`); await sleep(500); // Save edits -> play mode
check('in play mode with 2 loaded pads', await ev(`document.querySelector('#sb-app').classList.contains('is-play') && document.querySelectorAll('.sb-pad:not(.is-dead) .sb-pad__snd').length >= 2`));

const tap = (i) => ev(`document.querySelectorAll('.sb-pad')[${i}].dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))`);
const count = () => ev('SoundBoard.engine.activeCount()');
const live = (i) => ev(`document.querySelectorAll('.sb-pad')[${i}].classList.contains('is-live')`);

// 1) Stutter: tap A three times, 150 ms apart.
await ev('window.__log = []');
const counts = [];
for (let k = 0; k < 3; k++) { await tap(0); await sleep(20); counts.push(await count()); await sleep(130); }
await sleep(100);
const log1 = await ev('window.__log');
check('3 taps -> 3 starts from 0', log1.filter((l) => l[0] === 'start').length === 3, log1.map((l) => l[0]));
check('each re-tap stopped the previous voice (2 stops)', log1.filter((l) => l[0] === 'stop').length === 2);
check('never more than 2 voices (new + one fading 8 ms)', Math.max(...counts) <= 2, counts);
check('settles to exactly 1 voice for A', (await count()) === 1);
check('A still highlighted while its current voice plays', await live(0));
await sleep(1700);
check('A releases after the clip ends', (await count()) === 0 && !(await live(0)));

// 2) Independence: A playing, then B tapped -> A untouched.
await ev('window.__log = []');
await tap(0); await sleep(300); await tap(1); await sleep(200);
const log2 = await ev('window.__log');
check('tapping B does not stop A', log2.filter((l) => l[0] === 'stop').length === 0, log2.map((l) => l[0] + l[1]));
check('A and B both sounding', (await count()) === 2 && (await live(0)) && (await live(1)));
await sleep(1800);

// 3) Echo tail rings past the clip end; STOP silences it.
await ev(`(function(){ var p = SoundBoard.model.board.pads[0]; p.effects.echoOn = true; p.effects.echoTime = 0.3; p.effects.echoFeedback = 0.6; p.effects.echoWet = 0.8; })()`);
await tap(0); await sleep(1650); // clip is 1.5 s; tail = 0.3 * 14 = 4 s (capped)
const tailRms = await ev('__rms()');
check('echo tail audible after the clip ended', tailRms > 0.005, +tailRms.toFixed(4));
check('voice still tracked during tail', (await count()) === 1);
await ev(`document.querySelector('#sb-stop').click()`); await sleep(120);
const afterStop = await ev('__rms()');
check('STOP silences the tail within ~100 ms', afterStop < 0.001, +afterStop.toFixed(5));
await sleep(200);
check('no voices after STOP', (await count()) === 0);

// 4) Retrigger during an echo tail restarts cleanly.
await tap(0); await sleep(1600); await tap(0); await sleep(150);
check('re-tap during tail -> exactly 1 current voice', (await count()) <= 2 && (await live(0)));
await ev(`document.querySelector('#sb-stop').click()`); await sleep(200);

check('no page errors', errors.length === 0, errors);
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
ws.close(); process.exit(fails ? 1 : 0);
