// Review run: fresh boot, add pad, load wav, Save edits, Edit soundboard, reload; screenshots.
// Fails only on page errors; the rest is a screenshot walk-through for eyeballing.
// usage: node review.mjs <port> <wav> <outDir>
const [port, wav, out] = process.argv.slice(2);
const fs = await import('node:fs');
const tab = await (await fetch('http://localhost:9222/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const errors = []; let errorCount = 0;
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') errorCount++, errors.push(d.params.exceptionDetails.exception?.description?.split('\n').slice(0, 2).join(' | '));
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.result.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const snap = async (step) => console.log(step.padEnd(18), JSON.stringify(await ev(`({
  lcd: document.querySelector('#sb-lcd').textContent,
  btn: document.querySelector('#sb-mode').textContent,
  app: document.querySelector('#sb-app').className,
  pads: document.querySelectorAll('.sb-pad').length,
  rack: [...document.querySelectorAll('#sb-rack h3')].map(h => h.textContent).join(','),
})`)), errors.length ? 'ERR ' + errors.splice(0).join(' || ') : '');
const shot = async (name, w, h) => {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 900 });
  await sleep(400);
  const png = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${out}/${name}-${w}x${h}.png`, Buffer.from(png.result.data, 'base64'));
};
await send('Runtime.enable'); await send('Page.enable'); await send('DOM.enable'); await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `http://localhost:${port}/tools/soundboard/` }); await sleep(1200);
await ev('localStorage.clear()'); await send('Page.reload'); await sleep(1500);
await snap('fresh boot');
await ev(`document.querySelector('#sb-mode').click()`); await sleep(300);
await snap('click mode btn');
await ev(`document.querySelector('#sb-mode').click()`); await sleep(300);
await snap('click again');
await ev(`(function(){var b=[...document.querySelectorAll('#sb-rack button')].find(b=>b.textContent.includes('Add pad')); b && b.click();})()`); await sleep(300);
const doc = await send('DOM.getDocument');
const q = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '#sb-file' });
await send('DOM.setFileInputFiles', { nodeId: q.result.nodeId, files: [wav] }); await sleep(800);
await snap('loaded wav');
await ev(`(function(){var s=document.querySelector('.sb-switch'); s && s.click();})()`); await sleep(300);
await snap('toggled filter');
await shot('edit', 1440, 900); await shot('edit', 820, 1180); await shot('edit', 390, 844);
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await ev(`document.querySelector('#sb-mode').click()`); await sleep(500);
await snap('save edits');
await ev(`[...document.querySelectorAll('.sb-pad')].pop().dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))`); await sleep(80);
await shot('play', 1440, 900); await shot('play', 820, 1180); await shot('play', 390, 844);
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.reload'); await sleep(1500);
await snap('reload');
await ev(`document.querySelector('#sb-mode').click()`); await sleep(300);
await snap('edit after reload');
console.log(errorCount ? `${errorCount} PAGE ERRORS` : 'ALL PASS');
ws.close(); process.exit(errorCount ? 1 : 0);
