// e01s04 check: header height, stage size, no page scroll, sheet behaviour, at 4 viewports.
// usage: node layout.mjs <port> <outDir>
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

await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
const sizes = [
  { w: 390, h: 844, header: 56, stageW: 358 },
  { w: 820, h: 1180, header: 64, stageW: 780 },
  { w: 1180, h: 820, header: 64, stageH: 700 },
  { w: 1440, h: 900, header: 64, stageH: 780 },
];
const measure = () => ev(`(function(){
  var r = function (sel) { var b = document.querySelector(sel).getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), top: Math.round(b.top), bottom: Math.round(b.bottom) }; };
  var pads = [...document.querySelectorAll('.sb-pad')].map(function (p) { var b = p.getBoundingClientRect(); return b.bottom <= innerHeight && b.right <= innerWidth && b.width > 0; });
  return { header: r('.sb-top'), stage: r('#sb-stage'), sheet: document.querySelector('.sb-sheet').offsetParent ? r('.sb-sheet') : null,
    noScroll: document.scrollingElement.scrollHeight <= innerHeight && document.scrollingElement.scrollWidth <= innerWidth,
    padsVisible: pads.every(Boolean), headerOneRow: document.querySelector('.sb-top').scrollHeight <= document.querySelector('.sb-top').clientHeight + 1,
    sheetState: document.querySelector('#sb-app').getAttribute('data-sheet'), btn: document.querySelector('#sb-mode').textContent };
})()`);

for (const v of sizes) {
  await send('Emulation.setDeviceMetricsOverride', { width: v.w, height: v.h, deviceScaleFactor: 1, mobile: v.w < 900 });
  await send('Page.navigate', { url: `http://localhost:${port}/tools/soundboard/` }); await sleep(1000);
  await ev('localStorage.clear()'); await send('Page.reload'); await sleep(1400);
  const tag = `${v.w}x${v.h}`;
  // fresh board boots in edit mode
  const e = await measure();
  check(`${tag} edit: page does not scroll`, e.noScroll);
  check(`${tag} edit: stage visible above/beside panel`, e.stage.h > 120 && (!e.sheet || e.stage.bottom <= e.sheet.top + 1 || e.sheet.top < e.stage.bottom && v.w >= 900), { stage: e.stage, sheet: e.sheet });
  await shot(`edit-${tag}`);
  await ev(`document.querySelector('#sb-mode').click()`); await sleep(500); // Save edits -> play
  const p = await measure();
  check(`${tag} play: header <= ${v.header}px, one row`, p.header.h <= v.header && p.headerOneRow, p.header);
  if (v.stageW) check(`${tag} play: stage >= ${v.stageW}px wide`, p.stage.w >= v.stageW, p.stage);
  if (v.stageH) check(`${tag} play: stage >= ${v.stageH}px tall`, p.stage.h >= v.stageH, p.stage);
  check(`${tag} play: no page scroll, every pad on screen`, p.noScroll && p.padsVisible);
  await shot(`play-${tag}`);
  await ev(`document.querySelector('#sb-mode').click()`); await sleep(300); // back to edit
}

// Sheet behaviour on the phone size.
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send('Page.reload'); await sleep(1400);
const sheetH = () => ev(`Math.round(document.querySelector('.sb-sheet').getBoundingClientRect().height)`);
const state = () => ev(`document.querySelector('#sb-app').getAttribute('data-sheet')`);
const tapGrab = () => ev(`(function(){ var g = document.querySelector('#sb-grab'), b = g.getBoundingClientRect(), o = { bubbles: true, pointerId: 7, clientX: b.left + 20, clientY: b.top + 10 };
  g.dispatchEvent(new PointerEvent('pointerdown', o)); g.dispatchEvent(new PointerEvent('pointerup', o)); })()`);
const s0 = await state(); const h0 = await sheetH();
await tapGrab(); await sleep(150); const s1 = await state(); const h1 = await sheetH();
await tapGrab(); await sleep(150); const s2 = await state();
await tapGrab(); await sleep(150); const s3 = await state(); const h3 = await sheetH();
check('sheet starts at half; taps cycle half -> full -> peek -> half', s0 === 'half' && s1 === 'full' && s2 === 'peek' && s3 === 'half', [s0, s1, s2, s3]);
check('full is taller than half', h1 > h0, { half: h0, full: h1 });
// drag the grab bar down ~ to the bottom -> snaps to peek
await ev(`(function(){ var g = document.querySelector('#sb-grab'), b = g.getBoundingClientRect(), y = b.top + 10;
  g.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 8, clientX: 50, clientY: y }));
  for (var k = 1; k <= 10; k++) g.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 8, clientX: 50, clientY: y + k * 30 }));
  g.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 8, clientX: 50, clientY: y + 300 })); })()`);
await sleep(150);
check('drag down snaps to peek', (await state()) === 'peek' && (await sheetH()) <= 70, { state: await state(), h: await sheetH() });
await shot('sheet-peek-390x844');
await send('Page.reload'); await sleep(1400);
check('sheet state remembered after reload', (await state()) === 'peek');
check('grab label names the selected pad', await ev(`(function(){ document.querySelector('.sb-pad').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); return document.querySelector('#sb-grab-label').textContent; })()`) === 'Pad · P1');
check('header shows the board name', (await ev(`document.querySelector('#sb-title').textContent`)) === 'Untitled Board');
check('no page errors', errors.length === 0, errors);
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
ws.close(); process.exit(fails ? 1 : 0);
