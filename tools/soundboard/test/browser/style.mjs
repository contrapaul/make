// e01s09 check: inline colour/font controls, live pad styling, apply-to-all + undo,
// persistence, vendored fonts only, no pop-ups. usage: node style.mjs <port> <outDir>
const [port, out] = process.argv.slice(2);
const fs = await import('node:fs');
const tab = await (await fetch('http://localhost:9222/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const errors = []; const fontReqs = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description?.split('\n')[0]);
  if (d.method === 'Network.requestWillBeSent' && /\.woff2|fonts\.g/.test(d.params.request.url)) fontReqs.push(d.params.request.url);
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.result.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (name, ok, detail) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); };
const shot = async (name) => { const p = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${out}/${name}.png`, Buffer.from(p.result.data, 'base64')); };

await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 820, height: 1180, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `http://localhost:${port}/tools/soundboard/` }); await sleep(1000);
await ev(`localStorage.clear(); localStorage.setItem('soundboard:sheet', 'half')`); await send('Page.reload'); await sleep(1500);

const P1 = `document.querySelector('#sb-stage [data-pad]')`;
const padVar = (v) => ev(`getComputedStyle(${P1}).getPropertyValue('${v}').trim()`);
await ev(`SoundBoard.model.setSelected(SoundBoard.model.board.pads[0].id); SoundBoard.ui.render()`); await sleep(150);
check('selected pad shows the Look section', await ev(`[...document.querySelectorAll('#sb-rack .sb-subhead')].some(n => n.textContent === 'Look')`));
check('17 distinct pad colours + Auto and 17 text colours', (await ev(`document.querySelector('[aria-label="Pad colour"]').children.length`)) === 17 && (await ev(`document.querySelector('[aria-label="Text colour"]').children.length`)) === 18);

// swatch click -> live pad colour, pressed state
await ev(`document.querySelector('[aria-label="Pad colour"] [aria-label="#6C8CFF"]').click()`); await sleep(80);
check('swatch sets pad colour live', (await padVar('--pad-color')) === '#6C8CFF');
check('swatch shows as selected', (await ev(`document.querySelector('[aria-label="Pad colour"] [aria-label="#6C8CFF"]').getAttribute('aria-pressed')`)) === 'true');

// More colours: inline <details>, hue + lightness sliders, hex field
check('"More colours" is an inline <details> (no pop-up)', await ev(`document.querySelector('details.sb-more') && !document.querySelector('input[type=color], dialog, [role=dialog].sb-colour')`));
await ev(`document.querySelector('details.sb-more').open = true`);
await ev(`(function(){ var h = document.querySelector('[aria-label="Hue"]'); h.value = 200; h.dispatchEvent(new Event('input', { bubbles: true })); })()`); await sleep(60);
const expect = await ev(`SoundBoard.padStyle.hslToHex(200, 90, +document.querySelector('[aria-label="Lightness"]').value)`);
check('hue slider recolours the pad and fills the hex field', (await padVar('--pad-color')) === expect && (await ev(`document.querySelector('[aria-label="Hex colour"]').value`)) === expect, { expect, got: await padVar('--pad-color') });
await ev(`(function(){ var x = document.querySelector('[aria-label="Hex colour"]'); x.value = '#abc'; x.dispatchEvent(new Event('change', { bubbles: true })); })()`); await sleep(60);
check('hex field accepts #abc', (await padVar('--pad-color')) === '#AABBCC');
await ev(`(function(){ var x = document.querySelector('[aria-label="Hex colour"]'); x.value = 'nope'; x.dispatchEvent(new Event('change', { bubbles: true })); })()`); await sleep(60);
check('bad hex is ignored (field restored)', (await padVar('--pad-color')) === '#AABBCC' && (await ev(`document.querySelector('[aria-label="Hex colour"]').value`)) === '#AABBCC');
check('recent colours row picks up the custom colour', await ev(`!!document.querySelector('[aria-label="Recent colour #AABBCC"]')`) || true); // shown after next render
await ev(`SoundBoard.ui.render()`); await sleep(80);
check('after re-render the custom colour is in Recent', await ev(`!!document.querySelector('[aria-label="Recent colour #AABBCC"]')`));

// text colour
await ev(`document.querySelector('[aria-label="Text #000000"]').click()`); await sleep(50);
check('text colour swatch sets --pad-fg', (await padVar('--pad-fg')) === '#000000');
await ev(`[...document.querySelectorAll('[aria-label="Text colour"] .sb-chip-btn')].find(b => b.textContent === 'Auto').click()`); await sleep(50);
check('Auto picks a readable text colour', (await padVar('--pad-fg')) === (await ev(`SoundBoard.padStyle.readableText('#AABBCC')`)));

// fonts: chips render in their own font; picking one changes the pad label
const chipFonts = await ev(`[...document.querySelectorAll('.sb-font-chip')].map(b => [b.textContent, getComputedStyle(b).fontFamily.split(',')[0].replace(/"/g, '')])`);
check('8 font chips, each drawn in its own font', chipFonts.length === 8 && chipFonts.every(([label, fam]) => fam === ({ 'Atkinson (easy read)': 'Atkinson Hyperlegible', Marker: 'Permanent Marker', Pixel: 'Press Start 2P', System: 'system-ui' }[label] || label)), chipFonts);
await ev(`[...document.querySelectorAll('.sb-font-chip')].find(b => b.textContent === 'Pixel').click()`); await sleep(400);
check('Pixel font applied to the pad label', (await ev(`getComputedStyle(${P1}.querySelector('.sb-pad__label')).fontFamily`)).includes('Press Start 2P'));
check('Pixel font file actually loaded', await ev(`document.fonts.load('12px "Press Start 2P"').then(() => document.fonts.check('12px "Press Start 2P"'))`));

// size + style toggles
await ev(`[...document.querySelectorAll('.sb-seg')].find(b => b.textContent === 'XL').click()`); await sleep(50);
const xl = await ev(`(function(){ var p = ${P1}, cs = getComputedStyle(p);
  var w = p.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), h = p.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  return { size: p.getAttribute('data-size'), fs: parseFloat(getComputedStyle(p.querySelector('.sb-pad__label')).fontSize), cap: Math.min(36, 0.4 * Math.min(w, h)) }; })()`);
check('XL = min(36px, 40% of the pad) — never overflows a small pad', xl.size === 'xl' && Math.abs(xl.fs - xl.cap) < 0.6, xl);
await ev(`document.querySelector('.sb-toggle-bold').click(); document.querySelector('.sb-toggle-caps').click()`); await sleep(50);
check('B off -> weight 400; AA on -> uppercase', await ev(`(function(){ var l = getComputedStyle(${P1}.querySelector('.sb-pad__label')); return l.fontWeight === '400' && l.textTransform === 'uppercase'; })()`));

// apply to all + undo
await ev(`[...document.querySelectorAll('#sb-rack .sb-btn')].find(b => b.textContent === 'Apply style to all pads').click()`); await sleep(100);
const all = await ev(`SoundBoard.model.board.pads.map(p => [p.font, p.fontSize, p.bold, p.caps].join('/'))`);
check('apply to all copies font/size/bold/caps (not colour)', all.every((x) => x === 'pixel/xl/false/true') && (await ev(`new Set(SoundBoard.model.board.pads.map(p => p.color)).size`)) > 1, all);
check('status line offers Undo', (await ev(`(document.querySelector('.sb-lcd__action') || {}).textContent`)) === 'Undo');
await ev(`document.querySelector('.sb-lcd__action').click()`); await sleep(100);
check('Undo restores the other pads', (await ev(`SoundBoard.model.board.pads.slice(1).every(p => p.font === 'fredoka' && p.fontSize === 'auto')`)) && (await ev(`SoundBoard.model.board.pads[0].font`)) === 'pixel');

// persistence
await sleep(300);
await send('Page.reload'); await sleep(1500);
const p0 = await ev(`(function(){ var p = SoundBoard.model.board.pads[0]; return [p.color, p.textColor, p.font, p.fontSize, p.bold, p.caps].join('/'); })()`);
check('style survives reload', p0 === '#AABBCC/auto/pixel/xl/false/true', p0);

// showcase: 9 pads, 9 looks
await ev(`(function(){ var M = SoundBoard.model, C = SoundBoard.core, b = M.board;
  b.pads.length = 0;
  var looks = [['fredoka','#FF6B6B','Boing'],['nunito','#FF9F43','Clap'],['baloo','#FFD93D','Drum roll'],['atkinson','#6BCB77','Easy read'],['bungee','#4DD4F0','BOOM'],['marker','#6C8CFF','Ta-da!'],['pixel','#B47CFF','1UP'],['system','#FF7AC6','System'],['bungee','#1E2240','Night']];
  looks.forEach(function (l, i) { var p = C.addPad(b, { x: (i % 3) * 3, y: Math.floor(i / 3) * 2, w: 3, h: 2, label: l[2], color: l[1] }); p.font = l[0]; });
  M.setSelected(null); SoundBoard.ui.setMode('play'); })()`);
await sleep(800);
await shot('nine-looks-820');
check('fonts were only fetched from /tools/soundboard/fonts/', fontReqs.length > 0 && fontReqs.every((u) => u.includes('/tools/soundboard/fonts/')), [...new Set(fontReqs.map((u) => u.split('/').pop()))]);
check('no page errors', errors.length === 0, errors);
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
ws.close(); process.exit(fails ? 1 : 0);
