// e01s12-B1 check on wrangler pages dev. usage: node b1.mjs <port> <sessionToken> <wav>
const [port, tokenList, wav] = process.argv.slice(2);
const tokens = tokenList.split(','); let tokenIx = 0; let token = tokens[0];
const tab = await (await fetch('http://localhost:9222/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const errors = []; const reqs = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description?.split('\n')[0]);
  if (d.method === 'Network.requestWillBeSent' && d.params.request.url.includes('/api/')) reqs.push(d.params.request.method + ' ' + new URL(d.params.request.url).pathname);
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.result.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (name, ok, detail) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); };
const UUID = /^[0-9a-f-]{36}$/;
const base = `http://localhost:${port}/tools/soundboard/`;
const urlBoard = () => ev(`new URLSearchParams(location.search).get('board')`);
const lsBoard = () => ev(`localStorage.getItem('soundboard:v1')`);
const signIn = () => send('Network.setCookie', { name: 'bb_session', value: token, domain: 'localhost', path: '/', httpOnly: true });
// a real sign-out deletes the session server-side; move on to the next test session
const nextSession = () => { token = tokens[++tokenIx]; };
const signOutCookie = () => send('Network.deleteCookies', { name: 'bb_session', domain: 'localhost', path: '/' });
const apiFetch = (method, path, body) => ev(`fetch(${JSON.stringify(path)}, { method: ${JSON.stringify(method)}, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: ${body ? JSON.stringify(JSON.stringify(body)) : 'undefined'} }).then(r => r.json())`);
const listBoards = async () => (await apiFetch('GET', '/api/soundboards')).boards;
const loadWavOntoFirstPad = async () => {
  await ev(`SoundBoard.ui.setMode('edit'); SoundBoard.model.setSelected(SoundBoard.model.board.pads[0].id); SoundBoard.ui.render()`);
  const doc = await send('DOM.getDocument');
  const fi = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '#sb-file' });
  await send('DOM.setFileInputFiles', { nodeId: fi.result.nodeId, files: [wav] }); await sleep(900);
};
const waitFor = async (expr, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(expr)) return true; await sleep(100); } return false; };

await send('Runtime.enable'); await send('Page.enable'); await send('DOM.enable'); await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Page.navigate', { url: base }); await sleep(1200);
await ev('localStorage.clear()');

// 1) signed in, no boards yet, nothing local -> a new server board, URL updated
await signIn();
await send('Page.navigate', { url: base }); await sleep(2500);
let b = await urlBoard();
check('fresh account: opens a NEW server board and puts ?board= in the URL', UUID.test(b || '') && (await ev('SoundBoard.model.serverId')) === b, b);
check('local copy cleared', (await lsBoard()) === null);
reqs.length = 0;
await ev(`SoundBoard.model.board.name = 'Edited on server'; SoundBoard.ui.persist()`); await sleep(600);
check('edits save to the server (PUT /api/soundboards/<id>), not localStorage', reqs.includes('PUT /api/soundboards/' + b) && (await lsBoard()) === null, reqs);
await send('Page.reload'); await sleep(2500);
check('refresh reopens the same server board', (await urlBoard()) === b && (await ev('SoundBoard.model.board.name')) === 'Edited on server');

// 2) several boards -> no ?board= opens the most recently saved
await apiFetch('POST', '/api/soundboards');
const second = (await listBoards())[0];
await sleep(20);
await apiFetch('PUT', '/api/soundboards/' + b, { name: 'Most recent', isPublic: false, data: { name: 'Most recent', layout: { cols: 9, rows: 6 }, pads: [] } });
await send('Page.navigate', { url: base }); await sleep(2500);
check('no ?board= -> opens the most recently saved board', (await urlBoard()) === b && (await ev('SoundBoard.model.board.name')) === 'Most recent', { url: await urlBoard(), b, second: second.id });

// 3) switching boards keeps the URL in step
await ev(`SoundBoard.ui.setMode('edit')`); await sleep(1200);
await ev(`[...document.querySelectorAll('.board-item')].find(n => !n.classList.contains('is-active')).querySelector('button').click()`);
await waitFor(`SoundBoard.model.serverId !== ${JSON.stringify(b)}`);
check('Load another board -> URL follows', (await urlBoard()) === (await ev('SoundBoard.model.serverId')) && (await urlBoard()) !== b);
await ev(`[...document.querySelectorAll('#sb-rack .sb-btn')].find(x => x.textContent === '+ New board').click()`);
await waitFor(`!${JSON.stringify(await listBoards()).length} || true`); await sleep(1500);
const afterNew = await urlBoard();
check('+ New board -> URL follows', UUID.test(afterNew || '') && afterNew === (await ev('SoundBoard.model.serverId')) && afterNew !== b);

// 4) sign out -> URL cleared, local mode, no "not public" error
await ev(`document.querySelector('#sb-account > button').click()`); await sleep(200);
await ev(`[...document.querySelectorAll('.sb-popover button')].find(x => x.textContent === 'Sign out').click()`); await sleep(2000);
check('sign out removes ?board= and opens local mode without an error', (await urlBoard()) === null && !(await ev(`document.querySelector('#sb-lcd').classList.contains('is-error')`)) && !(await ev('SoundBoard.model.serverId')), await ev(`document.querySelector('#sb-lcd').textContent`));

nextSession(); await signIn();
// 5) local work + sign in during the session -> imported into a NEW board, clip uploaded
const nBefore = (await listBoards()).length;
await signOutCookie();
await ev('localStorage.clear()'); await send('Page.navigate', { url: base }); await sleep(1500);
await loadWavOntoFirstPad();
await ev(`SoundBoard.model.board.name = 'Class 3B'; SoundBoard.ui.persist()`); await sleep(400);
reqs.length = 0;
await signIn(); await ev('SBApi.me()');
await waitFor(`!!new URLSearchParams(location.search).get('board')`, 8000); await sleep(1500);
const imp = await ev(`(function(){ var m = SoundBoard.model, p = m.board.pads[0]; return { name: m.board.name, id: m.serverId, sound: p.sound && p.sound.id, sname: p.sound && p.sound.name, playable: !!(p.sound && m.getBuffer(p.sound.id)), lcd: document.querySelector('#sb-lcd').textContent }; })()`);
const boardsNow = await listBoards();
check('sign-in with local work -> moved into a NEW server board (others untouched)', imp.name === 'Class 3B' && UUID.test(imp.id || '') && boardsNow.length === nBefore + 1 && (await urlBoard()) === imp.id, imp);
check('clip still in memory was uploaded (server id) and still plays', UUID.test(imp.sound || '') && imp.playable && reqs.includes('POST /api/sounds'), imp);
check('user is told; local copy cleared', imp.lcd.includes('now saved to your account') && (await lsBoard()) === null, imp.lcd);
await send('Page.reload'); await sleep(2500);
check('imported board survives a refresh (from the server)', (await ev('SoundBoard.model.board.name')) === 'Class 3B' && (await ev(`!!SoundBoard.model.getBuffer(SoundBoard.model.board.pads[0].sound.id)`)));

// 6) local work whose clip is gone (made, refreshed, then signed in) -> re-attach count
await signOutCookie(); await sleep(300);
await ev('localStorage.clear()'); await send('Page.navigate', { url: base }); await sleep(1500);
await loadWavOntoFirstPad();
await ev(`SoundBoard.model.board.name = 'After refresh'; SoundBoard.ui.persist()`); await sleep(400);
await send('Page.reload'); await sleep(1500); // decoded clip is gone now
await signIn(); await ev('SBApi.me()');
await waitFor(`!!new URLSearchParams(location.search).get('board')`, 8000); await sleep(1500);
check('clip that is no longer in memory -> board imported, "1 sound to re-attach"', (await ev('SoundBoard.model.board.name')) === 'After refresh' && (await ev(`document.querySelector('#sb-lcd').textContent`)).includes('1 sound to re-attach'), await ev(`document.querySelector('#sb-lcd').textContent`));

// 7) untouched default board locally -> not imported
const nB = (await listBoards()).length;
await signOutCookie(); await sleep(300);
await ev('localStorage.clear()'); await send('Page.navigate', { url: base }); await sleep(1500);
await ev('SoundBoard.ui.persist()'); await sleep(400); // saves the untouched default board locally
await signIn(); await ev('SBApi.me()');
await waitFor(`!!new URLSearchParams(location.search).get('board')`, 8000); await sleep(800);
check('untouched default board is not imported (no extra board)', (await listBoards()).length === nB && (await lsBoard()) === null);
check('no page errors', errors.length === 0, errors);
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
ws.close(); process.exit(fails ? 1 : 0);
