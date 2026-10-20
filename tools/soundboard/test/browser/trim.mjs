// e01s11 check: trim editor on a synthetic take (deterministic) + the real record flow
// (fake mic). Real touch input for the handles. usage: node trim.mjs <port> <outDir>
const [port, out] = process.argv.slice(2);
const fs = await import('node:fs');
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
const shot = async (name) => { const p = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${out}/${name}.png`, Buffer.from(p.result.data, 'base64')); };
const tool = (key) => ev(`document.querySelector('[data-tool="${key}"]').click()`);
const info = () => ev(`document.querySelector('.sb-trim__info').textContent`);
// "Use" the current selection into window.__used and report metrics (computed in-page).
const useAndMeasure = () => ev(`(function(){
  var u = window.__used = SoundBoard.trimUI.selection(), sr = 48000, t = Math.pow(10, -40 / 20), first = -1, peak = 0, sum = 0;
  for (var i = 0; i < u.length; i++) { var a = Math.abs(u[i]); if (a > peak) peak = a; if (first < 0 && a >= t) first = i; sum += u[i]; }
  return { len: u.length, secs: u.length / sr, leadMs: first / sr * 1000, peakDb: 20 * Math.log10(peak), first: u[0], last: u[u.length - 1], mean: sum / u.length };
})()`);
// Mount the editor on a synthetic take: 1 s silence + 1 s quiet tone (+0.1 DC) + 0.5 s silence.
const mountSynthetic = () => ev(`(function(){
  var host = document.getElementById('__trimhost');
  if (!host) { host = document.createElement('div'); host.id = '__trimhost'; host.className = 'sb-rec';
    var rack = document.querySelector('#sb-rack'); rack.insertBefore(host, rack.firstChild); }
  host.textContent = '';
  var sr = 48000, s = new Float32Array(sr * 2.5);
  for (var i = sr; i < sr * 2; i++) s[i] = 0.1 + 0.05 * Math.sin(2 * Math.PI * 440 * i / sr);
  window.__orig = s;
  SoundBoard.trimUI.mount(host, { samples: s, sampleRate: sr,
    onUse: function (x) { window.__used = x; mountSynthetic2(); }, onRerecord: function () {}, onCancel: function () {} });
  // keep the editor open after Use so later steps can continue from the same state
  window.mountSynthetic2 = function () {};
  return true; })()`);

await send('Runtime.enable'); await send('Page.enable'); await send('DOM.enable'); await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__starts = 0; window.__streams = [];
  const st = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function (...a) { window.__starts++; return st.apply(this, a); };
  const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = (c) => gum(c).then((s) => { window.__streams.push(s); return s; });` });
await send('Emulation.setDeviceMetricsOverride', { width: 820, height: 1180, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `http://localhost:${port}/tools/soundboard/` }); await sleep(1000);
await ev(`localStorage.clear(); localStorage.setItem('soundboard:sheet', 'full'); localStorage.setItem('soundboard:countin', 'off')`);
await send('Page.reload'); await sleep(1500);

// ---- A) synthetic take --------------------------------------------------------------
await mountSynthetic(); await sleep(200);
check('editor opens with auto-trim already applied', (await ev(`document.querySelector('.sb-rec__status').textContent`)).startsWith('Silence trimmed automatically'));
let m = await useAndMeasure();
check('auto-trim: leading silence < 50 ms', m.leadMs < 50, m);
check('auto-trim kept the 1 s tone + 30 ms pads (~1.06 s)', Math.abs(m.secs - 1.06) < 0.01, m.secs);
await tool('undo'); await sleep(80);
m = await useAndMeasure();
check('↶ Undo restores the untrimmed take exactly', m.len === 48000 * 2.5 && (await ev(`(function(){ for (var i = 0; i < __orig.length; i++) if (__used[i] !== __orig[i]) return false; return true; })()`)));
check('Undo disabled when there is nothing to undo', await ev(`document.querySelector('[data-tool="undo"]').disabled`));

await tool('louder'); await sleep(80);
m = await useAndMeasure();
check('Louder: peak at −1 dBFS ± 0.1 dB', Math.abs(m.peakDb + 1) < 0.1, m.peakDb);
await tool('fadeIn'); await tool('fadeOut'); await sleep(80);
m = await useAndMeasure();
check('Fade in/out: first and last samples exactly 0', m.first === 0 && m.last === 0, m);
await tool('rumble'); await sleep(80);
m = await useAndMeasure();
check('Less rumble removes the DC offset (mean ≈ 0)', Math.abs(m.mean) < 0.01, m.mean);
await tool('reset'); await sleep(80);
m = await useAndMeasure();
check('Reset -> back to the original take', m.len === 48000 * 2.5 && Math.abs(m.mean - (0.1 * 48000) / (48000 * 2.5)) < 1e-3, m);
for (let k = 0; k < 14; k++) { await tool('louder'); }
const undos = await ev(`(function(){ var n = 0, b = document.querySelector('[data-tool="undo"]'); while (!b.disabled && n < 50) { b.click(); n++; } return n; })()`);
check('undo history is capped at 10 steps', undos === 10, undos);
await tool('reset'); await sleep(50);

// handles by real touch
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
const rect = (sel) => ev(`(function(){ var b = document.querySelector('${sel}').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, l: b.left, w: b.width }; })()`);
const touchDrag = async (from, to) => {
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y, id: 1 }] });
  for (let k = 1; k <= 8; k++) await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * k / 8, y: from.y, id: 1 }] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(100);
};
const scroll0 = await ev(`document.querySelector('#sb-rack').scrollTop`);
const wave = await rect('.sb-rec__wave');
await touchDrag(await rect('.sb-trim__handle--start'), { x: wave.l + wave.w * 0.4, y: 0 });
await touchDrag(await rect('.sb-trim__handle--end'), { x: wave.l + wave.w * 0.8, y: 0 });
check('touch-dragging the handles selects 40%–80%', (await info()).includes('keeping 1.0 s'), await info());
check('no scrolling while dragging handles', (await ev(`document.querySelector('#sb-rack').scrollTop`)) === scroll0 && (await ev('scrollY')) === 0);
await shot('trim-selection-820');
const s0 = await ev('__starts');
await ev(`[...document.querySelectorAll('.sb-rec .sb-btn')].find(b => b.textContent === '▶ Play').click()`); await sleep(250);
check('▶ Play sounds the selection with a moving playhead', (await ev('__starts')) === s0 + 1 && (await ev(`getComputedStyle(document.querySelector('.sb-trim__playhead')).display`)) === 'block');
await sleep(1100);
check('playhead hides when playback ends', (await ev(`getComputedStyle(document.querySelector('.sb-trim__playhead')).display`)) === 'none');
await tool('trim'); await sleep(80);
m = await useAndMeasure();
check('✂ Trim keeps exactly the selection (1.0 s)', Math.abs(m.secs - 1.0) < 0.01, m.secs);
await touchDrag(await rect('.sb-trim__handle--start'), { x: wave.l + wave.w + 200, y: 0 });
const minSel = await ev(`document.querySelector('.sb-trim__info').textContent`);
check('handles never cross: at least 50 ms stays selected', minSel.includes('keeping 0.1 s') || minSel.includes('keeping 0.0 s') ? (await useAndMeasure()).secs >= 0.05 - 1e-6 : false, minSel);
await send('Emulation.setTouchEmulationEnabled', { enabled: false });
await ev(`SoundBoard.trimUI.unmount(); document.getElementById('__trimhost').remove()`);

// ---- B) the real flow: record with the fake mic, edit, use ------------------------------
await ev(`SoundBoard.model.setSelected(SoundBoard.model.board.pads[0].id); SoundBoard.ui.render()`); await sleep(100);
await ev(`document.querySelector('.sb-btn--rec').click()`); await sleep(150);
await ev(`document.querySelector('.sb-rec__big--rec').click()`);
for (let k = 0; k < 60 && !(await ev(`!!document.querySelector('.sb-rec__big--stop')`)); k++) await sleep(50);
await sleep(2500);
await ev(`document.querySelector('.sb-rec__big--stop').click()`);
for (let k = 0; k < 80 && !(await ev(`!!document.querySelector('.sb-trim__wave')`)); k++) await sleep(50);
check('stopping a real take opens the trim editor', await ev(`!!document.querySelector('.sb-trim__wave') && document.querySelectorAll('[data-tool]').length === 8`));
await shot('trim-real-take-820');
await tool('louder'); await sleep(80);
await ev(`[...document.querySelectorAll('.sb-rec .sb-btn')].find(b => b.textContent === 'Use recording').click()`); await sleep(1200);
const pad = await ev(`(function(){ var p = SoundBoard.model.board.pads[0]; return { name: p.sound && p.sound.name, loaded: !!(p.sound && SoundBoard.model.getBuffer(p.sound.id)) }; })()`);
check('Use recording -> edited take on the pad', /^Recording \d+\.wav$/.test(pad.name || '') && pad.loaded, pad);
check('mic released, editor closed', (await ev(`window.__streams.reduce((n, s) => n + s.getTracks().filter(t => t.readyState === 'live').length, 0)`)) === 0 && !(await ev(`SoundBoard.trimUI.isOpen()`)));
check('no page errors', errors.length === 0, errors);
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
ws.close(); process.exit(fails ? 1 : 0);
