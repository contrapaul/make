// e01s10 check with Edge's fake microphone. usage: node rec.mjs <port> <sessionToken> <outDir>
const [port, token, out] = process.argv.slice(2);
const fs = await import('node:fs');
const tab = await (await fetch('http://localhost:9222/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const errors = []; const uploads = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description?.split('\n')[0]);
  if (d.method === 'Network.requestWillBeSent' && d.params.request.method === 'POST' && d.params.request.url.endsWith('/api/sounds'))
    uploads.push({ id: d.params.requestId, type: d.params.request.headers['Content-Type'], name: d.params.request.headers['X-Sound-Name'] });
  if (d.method === 'Network.responseReceived') { const u = uploads.find((x) => x.id === d.params.requestId); if (u) u.status = d.params.response.status; }
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.result.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (name, ok, detail) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); };
const shot = async (name) => { const p = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${out}/${name}.png`, Buffer.from(p.result.data, 'base64')); };
const click = (sel, text) => ev(`(function(){ var b = [...document.querySelectorAll(${JSON.stringify(sel)})].find(x => ${text ? `x.textContent.trim() === ${JSON.stringify(text)}` : 'true'}); if (!b) return false; b.click(); return true; })()`);
const micsLive = () => ev(`window.__streams.reduce((n, s) => n + s.getTracks().filter(t => t.readyState === 'live').length, 0)`);
const state = () => ev(`(function(){ var r = document.querySelector('.sb-rec'); if (!r) return 'none';
  if (r.querySelector('.sb-rec__wave')) return 'review'; if (r.querySelector('.sb-rec__count')) return 'counting';
  if (r.querySelector('.sb-rec__big--stop')) return 'recording'; return 'ready'; })()`);

const waitFor = async (want, ms) => { const t = Date.now(); let st; while (Date.now() - t < ms) { st = await state(); if (st === want) return true; await sleep(50); } return false; };
await send('Runtime.enable'); await send('Page.enable'); await send('DOM.enable'); await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__streams = []; window.__starts = 0;
  const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = (c) => (window.__denyMic ? Promise.reject(new DOMException('denied', 'NotAllowedError')) : gum(c).then((s) => { window.__streams.push(s); return window.__slowMic ? new Promise((r) => setTimeout(() => r(s), window.__slowMic)) : s; }));
  const st = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function (...a) { window.__starts++; return st.apply(this, a); };` });
await send('Emulation.setDeviceMetricsOverride', { width: 820, height: 1180, deviceScaleFactor: 1, mobile: false });
const base = `http://localhost:${port}/tools/soundboard/`;
await send('Page.navigate', { url: base }); await sleep(1000);
await ev(`localStorage.clear(); localStorage.setItem('soundboard:sheet', 'full')`); await send('Page.reload'); await sleep(1500);

// ---- signed out: record onto P1 with count-in ----------------------------------
await ev(`SoundBoard.model.setSelected(SoundBoard.model.board.pads[0].id); SoundBoard.ui.render()`); await sleep(100);
check('Sound block has a ● Record button', await click('.sb-btn--rec'));
await sleep(150);
check('recorder opens inline (ready state, no dialog)', (await state()) === 'ready' && !(await ev(`!!document.querySelector('dialog, [role=dialog]')`)));
await shot('rec-ready');
await click('.sb-rec__big--rec');
check('count-in shows 3-2-1', await waitFor('counting', 3000), await state());
const tCount = Date.now();
check('then records: stop button + seconds left', await waitFor('recording', 4000));
check('count-in lasts about 2 s', Date.now() - tCount > 1500 && Date.now() - tCount < 2900, Date.now() - tCount);
let meterMax = 0;
for (let k = 0; k < 24; k++) { meterMax = Math.max(meterMax, +(await ev(`document.querySelector('.sb-rec__meter').getAttribute('aria-valuenow')`)) || 0); await sleep(50); }
const during = await ev(`({ offset: +document.querySelector('.sb-rec__ring-arc').getAttribute('stroke-dashoffset'), secs: document.querySelector('.sb-rec__secs').textContent })`);
check('meter moves with the (fake) mic and the ring empties', meterMax > 0 && during.offset > 0 && +during.secs < 10, { ...during, meterMax });
await shot('rec-recording');
await click('.sb-rec__big--stop');
check('stop -> review with waveform', await waitFor('review', 4000));
check('microphone released after stop', (await micsLive()) === 0);
const dur = await ev(`parseFloat(document.querySelector('.sb-rec__status').dataset.recorded)`);
check('take is about 1.2 s long', dur > 0.8 && dur < 2.5, dur);
check('waveform drawn (non-blank canvas)', await ev(`(function(){ var c = document.querySelector('.sb-rec__wave'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (var i = 3; i < d.length; i += 4) if (d[i]) return true; return false; })()`));
await shot('rec-review');
const s0 = await ev('__starts');
await click('.sb-rec .sb-btn', '▶ Play'); await sleep(200);
check('▶ Play previews the take', (await ev('__starts')) === s0 + 1);
await click('.sb-rec .sb-btn', 'Use recording'); await sleep(900);
const p1 = await ev(`(function(){ var p = SoundBoard.model.board.pads[0]; return { name: p.sound && p.sound.name, mime: p.sound && p.sound.mime, loaded: !!(p.sound && SoundBoard.model.getBuffer(p.sound.id)) }; })()`);
check('Use recording -> P1 gets "Recording 1.wav" (local, playable)', p1.name === 'Recording 1.wav' && p1.mime === 'audio/wav' && p1.loaded, p1);
check('recorder closed, panel back', (await state()) === 'none');

// ---- auto-stop at 10 s, from the Library, no count-in ---------------------------
await ev(`SoundBoard.model.setSelected(null); SoundBoard.ui.render()`); await sleep(100);
check('Library has a ● Record button', await click('.sb-btn--rec'));
await sleep(150);
await ev(`(function(){ var c = document.querySelector('.sb-rec input[type=checkbox]'); c.checked = false; c.dispatchEvent(new Event('change')); })()`);
await click('.sb-rec__big--rec');
check('count-in off -> records straight away', await waitFor('recording', 2000));
const tRec = Date.now();
check('auto-stops at 10 s into review', await waitFor('review', 13000));
check('auto-stop came at ~10 s', Date.now() - tRec > 9500 && Date.now() - tRec < 12000, Date.now() - tRec);
const dur10 = await ev(`parseFloat(document.querySelector('.sb-rec__status').dataset.recorded)`);
check('take capped at 10.0 s', dur10 >= 9.5 && dur10 <= 10.0, dur10);
check('microphone released after auto-stop', (await micsLive()) === 0);
await click('.sb-rec .sb-btn', 'Use recording'); await sleep(900);
const lib = await ev(`SoundBoard.model.library.map(s => s.name + ':' + s.size)`);
const r2 = lib.find((x) => x.startsWith('Recording 2.wav'));
check('10 s take lands in the library under 2 MB', !!r2 && +r2.split(':')[1] < 2 * 1024 * 1024, lib);

// ---- cancel paths release the mic ----------------------------------------------
await ev(`SoundBoard.model.setSelected(SoundBoard.model.board.pads[1].id); SoundBoard.ui.render()`); await sleep(100);
await click('.sb-btn--rec'); await sleep(100);
await ev(`(function(){ var c = document.querySelector('.sb-rec input[type=checkbox]'); c.checked = false; c.dispatchEvent(new Event('change')); })()`);
await click('.sb-rec__big--rec'); await waitFor('recording', 3000); await sleep(300);
await ev(`SoundBoard.model.setSelected(SoundBoard.model.board.pads[2].id); SoundBoard.ui.render()`); await sleep(300); // panel re-renders mid-take
check('re-render mid-recording drops the take and releases the mic', (await micsLive()) === 0 && (await state()) === 'none');
await click('.sb-btn--rec'); await sleep(100);
await ev(`(function(){ var c = document.querySelector('.sb-rec input[type=checkbox]'); c.checked = true; c.dispatchEvent(new Event('change')); })()`);
await click('.sb-rec__big--rec'); await waitFor('counting', 3000);
await click('.sb-rec .sb-btn', 'Cancel'); await sleep(300);
check('Cancel during count-in releases the mic', (await micsLive()) === 0 && (await state()) === 'none');
await ev(`localStorage.setItem('soundboard:countin', 'off')`);
await click('.sb-btn--rec'); await sleep(100); await click('.sb-rec__big--rec'); await waitFor('recording', 3000); await sleep(400);
await click('.sb-rec .sb-btn', 'Cancel'); await sleep(300);
check('Cancel while recording discards the take and releases the mic', (await micsLive()) === 0 && (await state()) === 'none');

// ---- closed while the browser is still asking for the mic ---------------------
await ev('window.__slowMic = 800');
await click('.sb-btn--rec'); await sleep(100); await click('.sb-rec__big--rec'); await sleep(150);
await click('.sb-rec .sb-btn', 'Cancel'); await sleep(1300);
check('cancel during the permission prompt: late mic grant is stopped', (await micsLive()) === 0 && (await state()) === 'none');
await ev('window.__slowMic = 0');

// ---- permission denied ------------------------------------------------------------
await ev('window.__denyMic = true');
const opened = await click('.sb-btn--rec'); await sleep(150); const pressed = await click('.sb-rec__big--rec');
let blockedMsg = '';
for (let k = 0; k < 40 && !blockedMsg.startsWith('Microphone'); k++) { await sleep(50); blockedMsg = await ev(`(document.querySelector('.sb-rec__status') || {}).textContent || ''`); }
check('blocked mic -> plain-words message, back to ready', (await state()) === 'ready' && blockedMsg.startsWith('Microphone access was blocked'), { opened, pressed, state: await state(), blockedMsg });
await click('.sb-rec .sb-btn', 'Cancel');
await ev('window.__denyMic = false');

// ---- signed in: recording uploads to the account --------------------------------
await send('Network.setCookie', { name: 'bb_session', value: token, domain: 'localhost', path: '/', httpOnly: true });
await ev(`localStorage.clear(); localStorage.setItem('soundboard:sheet', 'full')`);
await send('Page.reload'); await sleep(2000);
await click('#sb-rack .sb-btn', '+ New board'); await sleep(1500);
await ev(`(function(){ var p = SoundBoard.model.addPad({ x: 0, y: 0 }); SoundBoard.model.setSelected(p.id); SoundBoard.ui.render(); })()`); await sleep(200);
await click('.sb-btn--rec'); await sleep(100);
await ev(`(function(){ var c = document.querySelector('.sb-rec input[type=checkbox]'); c.checked = false; c.dispatchEvent(new Event('change')); })()`);
await click('.sb-rec__big--rec'); await waitFor('recording', 3000); await sleep(1500);
await click('.sb-rec__big--stop'); await waitFor('review', 4000);
await click('.sb-rec .sb-btn', 'Use recording'); await sleep(2500);
const up = uploads[uploads.length - 1] || {};
check('signed in: POST /api/sounds audio/wav "Recording N.wav" -> 200', up.status === 200 && up.type === 'audio/wav' && /^Recording \d+\.wav$/.test(up.name || ''), up);
const cloudPad = await ev(`(function(){ var b = SoundBoard.model.board, p = b.pads[b.pads.length - 1]; return { id: p.sound && p.sound.id, loaded: !!(p.sound && SoundBoard.model.getBuffer(p.sound.id)) }; })()`);
check('pad points at the uploaded sound (server uuid) and plays', /^[0-9a-f-]{36}$/.test(cloudPad.id || '') && cloudPad.loaded, cloudPad);
console.log('UPLOADED_SOUND_ID=' + cloudPad.id);
check('no page errors', errors.length === 0, errors);
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
ws.close(); process.exit(fails ? 1 : 0);
