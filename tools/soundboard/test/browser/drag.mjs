// e01s08 check with REAL input (CDP mouse + touch): grid, select, move, resize, reject,
// add-by-tap, keyboard, steppers, play-mode multi-touch, persistence.
// usage: node drag.mjs <port> <wav> <outDir>
const [port, wav, out] = process.argv.slice(2);
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

await send('Runtime.enable'); await send('Page.enable'); await send('DOM.enable'); await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__starts = 0;
  const st = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function (...a) { window.__starts++; return st.apply(this, a); };` });
await send('Emulation.setDeviceMetricsOverride', { width: 820, height: 1180, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `http://localhost:${port}/tools/soundboard/` }); await sleep(1000);
await ev(`localStorage.clear(); localStorage.setItem('soundboard:sheet', 'half')`); await send('Page.reload'); await sleep(1500);

// Geometry helpers in page coordinates.
const cellCenter = (x, y) => ev(`(function(){ var s = document.querySelector('#sb-stage'), b = s.getBoundingClientRect(), cs = getComputedStyle(s);
  var pl = parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth), pt = parseFloat(cs.paddingTop) + parseFloat(cs.borderTopWidth), g = parseFloat(cs.columnGap);
  var w = s.clientWidth - 2 * parseFloat(cs.paddingLeft), h = s.clientHeight - 2 * parseFloat(cs.paddingTop), L = SoundBoard.model.board.layout;
  var px = (w + g) / L.cols, py = (h + g) / L.rows;
  return { x: b.left + pl + px * ${x} + (px - g) / 2, y: b.top + pt + py * ${y} + (py - g) / 2, px: px, py: py }; })()`);
const handleAt = (edge) => ev(`(function(){ var b = document.querySelector('.sb-handle--${edge}').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
const padRect = (i) => ev(`(function(){ var p = SoundBoard.model.board.pads[${i}]; return [p.x, p.y, p.w, p.h]; })()`);
const mouse = async (type, x, y) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' });
const mouseDrag = async (from, to, steps = 8) => {
  await mouse('mousePressed', from.x, from.y);
  for (let k = 1; k <= steps; k++) await mouse('mouseMoved', from.x + (to.x - from.x) * k / steps, from.y + (to.y - from.y) * k / steps);
  await mouse('mouseReleased', to.x, to.y); await sleep(150);
};
const touchDrag = async (from, to, steps = 8) => {
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y, id: 1 }] });
  for (let k = 1; k <= steps; k++) await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * k / steps, y: from.y + (to.y - from.y) * k / steps, id: 1 }] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(150);
};

// Load a clip onto P1 so we can prove edit-mode taps don't play it.
await ev(`SoundBoard.model.setSelected(SoundBoard.model.board.pads[0].id); SoundBoard.ui.render()`);
const doc = await send('DOM.getDocument');
const fi = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '#sb-file' });
await send('DOM.setFileInputFiles', { nodeId: fi.result.nodeId, files: [wav] }); await sleep(900);
await ev(`SoundBoard.model.setSelected(null); SoundBoard.ui.render()`); await sleep(100);

check('edit mode draws one cell per grid square (9x6 = 54)', (await ev(`document.querySelectorAll('#sb-stage .sb-cell').length`)) === 54);
check('no frame until a pad is selected', (await ev(`document.querySelectorAll('.sb-frame').length`)) === 0);

// 1) click P1 (0,0) without moving -> selected, frame with 8 handles, no sound
let c = await cellCenter(0, 0);
const starts0 = await ev('__starts');
await mouse('mousePressed', c.x, c.y); await mouse('mouseReleased', c.x, c.y); await sleep(150);
check('click selects pad: frame with 8 handles', (await ev(`document.querySelectorAll('.sb-frame .sb-handle').length`)) === 8);
check('edit-mode click does not play the clip', (await ev('__starts')) === starts0);

// 2) mouse-drag P1 to (4,3)
await mouseDrag(await cellCenter(0, 0), await cellCenter(4, 3));
check('mouse drag moves P1 to (4,3)', JSON.stringify(await padRect(0)) === '[4,3,1,1]', await padRect(0));

// 3) mouse-drag the se handle by +2 cols, +1 row -> 3x2
let h = await handleAt('se');
await mouseDrag(h, { x: h.x + 2 * c.px, y: h.y + c.py });
check('se handle resizes to 3x2', JSON.stringify(await padRect(0)) === '[4,3,3,2]', await padRect(0));
await shot('selected-resized-820');

// 4) drag P1 onto P2 (P2 sits at 1,0 w2) -> reverted + shake + error
await mouseDrag(await cellCenter(5, 4), await cellCenter(2, 1));
check('overlapping drop reverts', JSON.stringify(await padRect(0)) === '[4,3,3,2]', await padRect(0));
check('reject feedback (shake class + error status)', await ev(`!!document.querySelector('.sb-pad.is-reject') && document.querySelector('#sb-lcd').classList.contains('is-error')`));

// 5) touch: drag the w handle one cell left -> x 3, w 4
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
h = await handleAt('w');
await touchDrag(h, { x: h.x - c.px, y: h.y });
check('touch drag on w handle -> x 3, w 4', JSON.stringify(await padRect(0)) === '[3,3,4,2]', await padRect(0));
// touch move the pad body up one row
let body = await cellCenter(4, 3);
await touchDrag(body, { x: body.x, y: body.y - c.py });
check('touch drag on pad body moves it up a row', JSON.stringify(await padRect(0)) === '[3,2,4,2]', await padRect(0));
check('page did not scroll during touch drags', (await ev('scrollY')) === 0);

// 6) tap an empty cell -> new 1x1 pad there, selected
const n0 = await ev('SoundBoard.model.board.pads.length');
c = await cellCenter(8, 5);
await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y, id: 2 }] });
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(250);
const added = await ev(`(function(){ var b = SoundBoard.model.board, p = b.pads[b.pads.length - 1]; return { n: b.pads.length, at: [p.x, p.y, p.w, p.h], sel: SoundBoard.model.selectedId === p.id }; })()`);
check('tap on empty cell adds a selected 1x1 pad there', added.n === n0 + 1 && JSON.stringify(added.at) === '[8,5,1,1]' && added.sel, added);
await send('Emulation.setTouchEmulationEnabled', { enabled: false });

// 7) keyboard on the selected (new) pad: ArrowLeft -> x 7; Shift+ArrowUp at bottom-right grows? (se: h-1 stays 1) use Shift+ArrowLeft? -> se with dCols -1 keeps w 1
const key = (k, shift) => ev(`(function(){ var n = document.querySelector('#sb-stage .sb-pad.is-selected'); n.focus(); n.dispatchEvent(new KeyboardEvent('keydown', { key: '${k}', shiftKey: ${!!shift}, bubbles: true })); })()`);
await key('ArrowLeft'); await sleep(80); await key('ArrowLeft'); await sleep(80);
const last = `SoundBoard.model.board.pads.length - 1`;
check('ArrowLeft x2 moves the pad two cells', JSON.stringify(await padRect(await ev(last))) === '[6,5,1,1]', await padRect(await ev(last)));
await key('ArrowUp'); await sleep(80); await key('ArrowDown', true); await sleep(80);
check('ArrowUp then Shift+ArrowDown -> moved up, grew 1 row', JSON.stringify(await padRect(await ev(last))) === '[6,4,1,2]', await padRect(await ev(last)));
check('keyboard keeps focus on the pad', await ev(`document.activeElement && document.activeElement.classList.contains('sb-pad')`));

// 8) grid steppers: fewer columns refused (pad in col 9? P1 spans 3..6, new pad col 6) -> 9 -> 8 ok? last col index 8 empty now -> allowed
const colsBtn = (label) => ev(`document.querySelector('[aria-label="${label}"]').click()`);
await colsBtn('Fewer columns'); await sleep(150);
check('Columns 9 -> 8 when the last column is empty', (await ev('SoundBoard.model.board.layout.cols')) === 8);
await colsBtn('Fewer columns'); await sleep(150); // P1 now ends at col 7 (3+4) -> 7 cols OK? x3+w4 = 7 <= 7 allowed
await colsBtn('Fewer columns'); await sleep(150); // -> 6 would cut P1 -> refused
check('shrinking past a pad is refused with a message', (await ev('SoundBoard.model.board.layout.cols')) === 7 && (await ev(`document.querySelector('#sb-lcd').textContent`)).includes('first'));
await colsBtn('More rows'); await sleep(150);
check('Rows + -> 7, cells redrawn', (await ev('SoundBoard.model.board.layout.rows')) === 7 && (await ev(`document.querySelectorAll('.sb-cell').length`)) === 49);
await shot('edit-grid-820');

// 9) play mode: no cells/frame; taps play; two fingers play two pads
await ev(`document.querySelector('#sb-mode').click()`); await sleep(500);
check('play mode: no cells, frame or selection ring', await ev(`!document.querySelector('.sb-cell, .sb-frame, .sb-pad.is-selected')`));
// give P2 the same clip so two pads can sound
await ev(`(function(){ var b = SoundBoard.model.board; b.pads[1].sound = Object.assign({}, b.pads[0].sound); SoundBoard.ui.paint(); })()`);
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
const p1 = await cellCenter(4, 2), p2 = await cellCenter(1, 0);
const s1 = await ev('__starts');
await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p1.x, y: p1.y, id: 3 }] });
await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p1.x, y: p1.y, id: 3 }, { x: p2.x, y: p2.y, id: 4 }] });
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(150);
check('play mode: two fingers fire two pads', (await ev('__starts')) - s1 === 2, (await ev('__starts')) - s1);

// 10) persistence
const before = await ev(`JSON.stringify(SoundBoard.model.board.pads.map(p => [p.x, p.y, p.w, p.h]))`);
await send('Page.reload'); await sleep(1500);
check('layout survives reload', (await ev(`JSON.stringify(SoundBoard.model.board.pads.map(p => [p.x, p.y, p.w, p.h]))`)) === before && (await ev('SoundBoard.model.board.layout.cols')) === 7);
check('no page errors', errors.length === 0, errors);
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
ws.close(); process.exit(fails ? 1 : 0);
