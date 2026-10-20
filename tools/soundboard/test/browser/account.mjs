// e01s03 check: header account chip + popover. usage: node account.mjs <port> <sessionToken> <outDir>
const [port, token, out] = process.argv.slice(2);
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
const size = (w, h) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 900 });
const pop = () => ev(`!!document.querySelector('.sb-popover')`);
const headerH = () => ev(`Math.round(document.querySelector('.sb-top').getBoundingClientRect().height)`);
const clickTrigger = () => ev(`document.querySelector('#sb-account > button').click()`);
const base = `http://localhost:${port}/tools/soundboard/`;

await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await size(820, 1180);
await send('Page.navigate', { url: base }); await sleep(1500);
await ev('localStorage.clear()'); await send('Page.reload'); await sleep(1500);

// signed out
check('signed out: header shows a "Sign in" button', (await ev(`document.querySelector('#sb-account > button').textContent`)) === 'Sign in');
check('no account block left in the edit panel', !(await ev(`[...document.querySelectorAll('#sb-rack h3')].some(h => h.textContent === 'Account')`)));
const hOut = await headerH();
await clickTrigger(); await sleep(150);
check('click opens popover, email focused, aria-expanded', (await pop()) && (await ev(`document.activeElement.type === 'email' && document.querySelector('#sb-account > button').getAttribute('aria-expanded') === 'true'`)));
check('popover is not a modal (no backdrop) and links to sign-up', await ev(`!document.querySelector('.sb-backdrop') && document.querySelector('.sb-popover a').getAttribute('href') === '/bloodbowl/account/'`));
await shot('signedout-open-820');
await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`); await sleep(100);
check('Escape closes and returns focus to the trigger', !(await pop()) && (await ev(`document.activeElement === document.querySelector('#sb-account > button')`)));
await clickTrigger(); await sleep(150);
await ev(`document.querySelector('#sb-stage').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))`); await sleep(100);
check('outside tap closes', !(await pop()));
await clickTrigger(); await sleep(150); await clickTrigger(); await sleep(100);
check('clicking the trigger again closes', !(await pop()));
await clickTrigger(); await sleep(150);
await ev(`(function(){ var f = document.querySelector('.sb-popover form'); f.querySelector('[type=email]').value = 'sbtest@example.test'; f.querySelector('[type=password]').value = 'wrong-password'; f.requestSubmit(); })()`);
await sleep(1200);
const errTxt = await ev(`(document.querySelector('.sb-popover__err') || {}).textContent`);
check('wrong password: inline error, popover stays open', (await pop()) && !!errTxt, errTxt);
await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
// re-render while open must not destroy the popover
await clickTrigger(); await sleep(150);
await ev(`SoundBoard.ui.render()`); await sleep(100);
check('popover survives an app re-render', await pop());
await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);

// signed in (session cookie for a local test user)
await send('Network.setCookie', { name: 'bb_session', value: token, domain: 'localhost', path: '/', httpOnly: true });
await send('Page.reload'); await sleep(2000);
check('signed in: chip shows initial + username', (await ev(`document.querySelector('.sb-chip__initial').textContent + '|' + document.querySelector('.sb-chip__name').textContent`)) === 'S|sbtest');
check('header height unchanged signed in vs out', (await headerH()) === hOut, { out: hOut, in: await headerH() });
await ev(`document.querySelector('#sb-mode').click()`); await sleep(600); // to play mode
check('account reachable in play mode (panel hidden)', await ev(`!!document.querySelector('.sb-chip').offsetParent && document.querySelector('#sb-app').classList.contains('is-play')`));
await clickTrigger(); await sleep(150);
check('signed-in popover: name + Sign out', (await ev(`document.querySelector('.sb-popover').textContent`)).includes('Signed in as sbtest'));
await shot('signedin-open-820');
await ev(`[...document.querySelectorAll('.sb-popover button')].find(b => b.textContent === 'Sign out').click()`); await sleep(1500);
check('sign out closes popover and shows "Sign in" again', !(await pop()) && (await ev(`document.querySelector('#sb-account > button').textContent`)) === 'Sign in');

// phone
await size(390, 844); await sleep(400);
await send('Page.reload'); await sleep(1500);
const ph = await ev(`(function(){ var t = document.querySelector('.sb-top'); return { h: Math.round(t.getBoundingClientRect().height), oneRow: t.scrollHeight <= t.clientHeight + 1, fits: t.scrollWidth <= t.clientWidth + 1 }; })()`);
check('phone: header <= 56px, one row, nothing overflows', ph.h <= 56 && ph.oneRow && ph.fits, ph);
await clickTrigger(); await sleep(150);
const pw = await ev(`(function(){ var b = document.querySelector('.sb-popover').getBoundingClientRect(); return { left: Math.round(b.left), right: Math.round(b.right), vw: innerWidth }; })()`);
check('phone: popover fully on screen', pw.left >= 0 && pw.right <= pw.vw, pw);
await shot('signedout-open-390');
check('no page errors', errors.length === 0, errors);
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
ws.close(); process.exit(fails ? 1 : 0);
