// Headless-Edge verification for the Flash Conversations page.
// usage: node tools/chinese/test/verify_conversations.mjs
// Generates two short stub mp3s (a01, a02) so playback can be proven, drives the
// page with real mouse clicks (browsers only allow sound after a genuine gesture),
// then deletes the stubs. Nothing synthetic is left in the folder.
//
// Asserts: 42 cards render, section tabs and search filter, the audio contract
// (present file -> playable button, missing file -> pending button), one sound at a
// time, Play-all skips cards with no file, auto-play opt-in persists, no request
// leaves localhost, and check_audio.py agrees with what the page sees.
import { existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, makeChecks, sleep } from './browser.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const siteDir = resolve(here, '..');
const shots = join(here, 'shots', 'conversations');
const audioDir = join(siteDir, 'audio', 'conversations');
const STUBS = ['a01', 'a02'];
const { check, failures } = makeChecks();

const hasFfmpeg = spawnSync('which', ['ffmpeg'], { encoding: 'utf8' }).status === 0;
if (!hasFfmpeg) {
  console.log('SKIP: ffmpeg not found, so cannot generate stub audio to prove playback.');
  console.log('      Data, render, tab and search checks were skipped too. Install ffmpeg and re-run.');
  process.exit(0);
}

rmSync(shots, { recursive: true, force: true });
const makeStub = (id) => spawnSync('ffmpeg', ['-y', '-loglevel', 'error',
  '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.6', '-ac', '1', '-ar', '44100',
  '-b:a', '80k', join(audioDir, `${id}.mp3`)], { encoding: 'utf8' });
STUBS.forEach(makeStub);

const { tab, base, stop } = await launch({ siteDir, port: 8898, cdpPort: 9398, shotsDir: shots });

// The page's Audio element lives in a closure, so a device-initiated pause cannot be
// simulated without a handle on it. Wrap the constructor before any script runs: the
// page still gets a real HTMLAudioElement, and the test keeps a reference to it.
await tab.send('Page.addScriptToEvaluateOnNewDocument', {
  source: `(() => {
    const Real = window.Audio;
    window.__audios = [];
    window.__played = [];
    window.Audio = function (src) {
      const a = src === undefined ? new Real() : new Real(src);
      a.addEventListener('play', () => window.__played.push((a.currentSrc || '').split('/').pop()));
      window.__audios.push(a);
      return a;
    };
  })();`,
});

// Real input events: Runtime.evaluate clicks are not user gestures, and a sound that
// only plays from a scripted click would tell us nothing about the venue iPad.
async function clickEl(selector, { index = 0 } = {}) {
  const box = await tab.evaluate(`(() => {
    const el = document.querySelectorAll(${JSON.stringify(selector)})[${index}];
    if (!el) return null;
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  if (!box) throw new Error(`no element for ${selector}[${index}]`);
  await sleep(300);   // let the instant scroll settle before aiming the mouse
  for (const type of ['mousePressed', 'mouseReleased']) {
    await tab.send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left',
      clickCount: 1, buttons: type === 'mousePressed' ? 1 : 0 });
  }
  await sleep(150);
}

// Scroll in viewport steps so every card passes through the viewport. An instant
// jump to the bottom would never trigger the IntersectionObserver probes in between.
async function scrollThrough() {
  await tab.evaluate(`window.__pos = 0; window.scrollTo(0, 0)`);
  const step = 500;
  for (;;) {
    const done = await tab.evaluate(`(() => {
      window.__pos += ${step};
      window.scrollTo(0, window.__pos);
      return window.__pos > document.body.scrollHeight + ${step};
    })()`);
    await sleep(120);
    if (done) break;
  }
  await tab.evaluate(`window.scrollTo(0, 0)`);
  await sleep(300);
}

try {
  console.log('--- data + render');
  await tab.goto(`${base}/conversations.html`, 2500);
  check(tab.external(base).length === 0, 'conversations: zero external requests',
    tab.external(base).slice(0, 3).join(', '));
  const render = await tab.evaluate(`(() => ({
    cards: document.querySelectorAll('.cv-card').length,
    ids: [...document.querySelectorAll('.cv-id')].map(e => e.textContent),
    firstLines: [...document.querySelectorAll('.cv-card')[0].querySelectorAll('.cv-line')].length,
    roles: [...document.querySelectorAll('.cv-card')[0].querySelectorAll('.cv-role')].map(e => e.textContent),
    pyFont: getComputedStyle(document.querySelector('.cv-py')).fontFamily,
    zhSize: getComputedStyle(document.querySelector('.cv-zh')).fontSize,
    pySize: getComputedStyle(document.querySelector('.cv-py')).fontSize,
    playCount: document.querySelectorAll('.cv-play').length,
    total: document.getElementById('cvTotal').textContent,
    results: document.getElementById('cvResults').textContent,
  }))()`);
  check(render.cards === 42, 'renders 42 cards', `got ${render.cards}`);
  check(render.total === '42', 'header count says 42', render.total);
  check(render.ids[0] === 'A01' && render.ids[41] === 'C07',
    'card ids run A01 … C07', `${render.ids[0]} … ${render.ids[41]}`);
  check(render.firstLines === 2 && render.roles.join('') === '问答',
    'A01 shows a Q and an A line with role glyphs', `${render.firstLines}/${render.roles.join('')}`);
  check(parseFloat(render.zhSize) > parseFloat(render.pySize),
    'hanzi is the largest element of the card', `zh ${render.zhSize} vs py ${render.pySize}`);
  check(/Source Serif 4/.test(render.pyFont), 'pinyin paints in Source Serif 4', render.pyFont);

  console.log('\n--- tabs + search');
  await clickEl('#sectionTabs .mode-tab[data-section="C"]');
  const sectC = await tab.evaluate(`(() => ({
    n: document.querySelectorAll('.cv-card').length,
    ids: [...document.querySelectorAll('.cv-id')].map(e => e.textContent),
    caption: document.getElementById('cvCaption').textContent,
    results: document.getElementById('cvResults').textContent,
  }))()`);
  check(sectC.n === 7 && sectC.ids[0] === 'C01', 'section C tab shows the 7 booth cards',
    `${sectC.n}: ${sectC.ids.join(',')}`);
  check(/booths/.test(sectC.caption), 'section caption explains the use', sectC.caption.slice(0, 40));
  await clickEl('#sectionTabs .mode-tab[data-section=""]');
  const backToAll = await tab.evaluate(`document.querySelectorAll('.cv-card').length`);
  check(backToAll === 42, 'All tab returns the full set', String(backToAll));

  await tab.evaluate(`(() => {
    const i = document.getElementById('cvSearch');
    i.value = '微信';
    i.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await sleep(200);
  const searched = await tab.evaluate(`(() => ({
    ids: [...document.querySelectorAll('.cv-id')].map(e => e.textContent),
    results: document.getElementById('cvResults').textContent,
  }))()`);
  check(searched.ids.includes('B07') && searched.ids.length < 42 && searched.ids.length > 0,
    'search by hanzi filters the list', `${searched.ids.join(',')} (${searched.results})`);
  await tab.evaluate(`(() => {
    const i = document.getElementById('cvSearch');
    i.value = 'zzzz-no-match';
    i.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await sleep(200);
  check(await tab.evaluate(`!!document.querySelector('.cv-empty')`),
    'no-match search shows an empty state, not a blank page');
  await tab.evaluate(`(() => {
    const i = document.getElementById('cvSearch');
    i.value = '';
    i.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await sleep(300);

  const plays = () => tab.served('.mp3', 'GET');   // GET = a play; HEAD = a readiness probe

  console.log('\n--- audio contract');
  await tab.setViewport(1280, 1000, false);
  await tab.evaluate(`document.querySelector('.cv-card[data-id="a03"]').scrollIntoView({ block: 'center' })`);
  await sleep(1400);   // IntersectionObserver probes for the cards in view
  const btnStates = await tab.evaluate(`(() => {
    const state = (id) => document.querySelector('.cv-card[data-id="' + id + '"] .cv-play')?.dataset.state;
    return { a01: state('a01'), a02: state('a02'), a03: state('a03'),
             status: document.getElementById('cvAudioStatus').textContent,
             ariaA03: document.querySelector('.cv-card[data-id="a03"] .cv-play')?.getAttribute('aria-label') };
  })()`);
  check(btnStates.a01 === 'ready' && btnStates.a02 === 'ready',
    'cards with a file get a live play button', JSON.stringify(btnStates));
  check(btnStates.a03 === 'pending',
    'a card with no file gets a pending button, not a dead one', String(btnStates.a03));
  check(/audio not recorded yet/i.test(btnStates.ariaA03 || ''),
    'pending button is labelled honestly for screen readers', btnStates.ariaA03);
  check(/Audio ready for 2 of 42/.test(btnStates.status),
    'status line counts the files the page can see', btnStates.status);
  // Sunlight on a glossy iPad: opacity alone is not a dependable cue, so pending also
  // changes the border and the glyph colour.
  const pend = await tab.evaluate(`(() => {
    const b = document.querySelector('.cv-card[data-id="a03"] .cv-play');
    const r = document.querySelector('.cv-card[data-id="a01"] .cv-play');
    const cs = getComputedStyle(b), rs = getComputedStyle(r);
    return {
      opacity: cs.opacity,
      border: cs.borderTopStyle,
      borderReady: rs.borderTopStyle,
      glyphColor: getComputedStyle(b, '::before').borderLeftColor,
      glyphColorReady: getComputedStyle(r, '::before').borderLeftColor,
    };
  })()`);
  check(parseFloat(pend.opacity) < 0.65, 'pending button is dimmed', pend.opacity);
  check(pend.border === 'dashed' && pend.borderReady === 'solid',
    'pending button differs by border, not only opacity', `${pend.border} vs ${pend.borderReady}`);
  check(pend.glyphColor !== pend.glyphColorReady,
    'pending button glyph is faint where ready is full ink', `${pend.glyphColor} vs ${pend.glyphColorReady}`);
  // Auto-play on a card with no file must stay silent: no GET for that card.
  await clickEl('#cvAutoplay');
  const beforePending = plays().length;
  await clickEl('.cv-card[data-id="a03"] .cv-zh');
  await sleep(200);
  check(plays().length === beforePending, 'auto-play skips a card with no file (no request fired)',
    plays().slice(beforePending).join(', '));
  const pendAfter = await tab.evaluate(`document.querySelector('.cv-card[data-id="a03"] .cv-play').dataset.state`);
  check(pendAfter === 'pending', 'a pending card stays pending when tapped', pendAfter);
  await clickEl('#cvAutoplay');

  console.log('\n--- playback');
  await clickEl('.cv-card[data-id="a01"] .cv-play');
  await sleep(250);
  const playing = await tab.evaluate(`document.querySelector('.cv-card[data-id="a01"] .cv-play').dataset.state`);
  check(playing === 'playing', 'click play → button switches to playing', playing);
  check(plays().some((u) => u.endsWith('a01.mp3')),
    'the click requests audio/conversations/a01.mp3', plays().join(', '));
  // Only one sound at a time: starting a second card must release the first.
  await clickEl('.cv-card[data-id="a02"] .cv-play');
  await sleep(250);
  const both = await tab.evaluate(`(() => ({
    a01: document.querySelector('.cv-card[data-id="a01"] .cv-play').dataset.state,
    a02: document.querySelector('.cv-card[data-id="a02"] .cv-play').dataset.state,
  }))()`);
  check(both.a01 === 'ready' && both.a02 === 'playing',
    'a second card takes over: one sound at a time', JSON.stringify(both));
  // 0.6s stub ends. Wait for it rather than sleep a fixed 1400ms: a loaded machine can
  // deliver the ended event late enough that a bare sleep reads 'playing'.
  const ended = await tab.waitFor(`document.querySelector('.cv-card[data-id="a02"] .cv-play').dataset.state === 'ready'`, 5000);
  const afterEnd = await tab.evaluate(`document.querySelector('.cv-card[data-id="a02"] .cv-play').dataset.state`);
  check(ended && afterEnd === 'ready', 'button returns to ready when the clip ends', afterEnd);

  console.log('\n--- play all skips missing files');
  // Let every probe settle first: a card of unknown status is worth one attempt,
  // a card already known to be missing is skipped outright.
  await scrollThrough();
  await tab.waitFor(`document.querySelectorAll('.cv-play[data-state="pending"]').length === 40`, 20000);
  const probed = await tab.evaluate(`document.querySelectorAll('.cv-play[data-state="pending"]').length`);
  check(probed === 40, 'after scrolling, all 40 unrecorded cards show pending', String(probed));

  await tab.evaluate(`window.scrollTo(0, 0)`);
  await clickEl('#cvPlayAll');
  const finished = await tab.waitFor(`document.getElementById('cvStopAll').classList.contains('hidden')
    && !document.getElementById('cvPlayAll').classList.contains('hidden')`, 25000);
  const queueReqs = plays();
  check(queueReqs.some((u) => u.endsWith('a01.mp3')) && queueReqs.some((u) => u.endsWith('a02.mp3')),
    'Play all plays both recorded cards', queueReqs.map((u) => u.split('/').pop()).join(', '));
  check(!queueReqs.some((u) => /a0[3-9]\.mp3|b\d\d\.mp3|c\d\d\.mp3/.test(u)),
    'Play all does not request files it knows are missing',
    queueReqs.map((u) => u.split('/').pop()).join(', '));
  const queueDone = await tab.evaluate(`(() => ({
    playAllHidden: document.getElementById('cvPlayAll').classList.contains('hidden'),
    stopHidden: document.getElementById('cvStopAll').classList.contains('hidden'),
  }))()`);
  check(finished && queueDone.playAllHidden === false && queueDone.stopHidden === true,
    'Play all restores its buttons when the queue empties', JSON.stringify(queueDone));

  // Filtering mid-queue: the queue must follow what is on screen, and a card filtered
  // out while playing must not keep making sound with no button to own it.
  await clickEl('#sectionTabs .mode-tab[data-section="A"]');
  await clickEl('#cvPlayAll');
  await tab.waitFor(`document.querySelector('.cv-card[data-id="a01"] .cv-play').dataset.state === 'playing'
    && !document.getElementById('cvStopAll').classList.contains('hidden')`, 8000);
  const midQueue = tab.served('.mp3', 'GET').length;
  await tab.evaluate(`(() => {
    const i = document.getElementById('cvSearch');
    i.value = 'zzzz-no-match';
    i.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await sleep(400);
  const afterFilter = await tab.evaluate(`(() => ({
    empty: !!document.querySelector('.cv-empty'),
    stopHidden: document.getElementById('cvStopAll').classList.contains('hidden'),
    playAllHidden: document.getElementById('cvPlayAll').classList.contains('hidden'),
    playing: document.querySelectorAll('.cv-play[data-state="playing"]').length,
  }))()`);
  check(afterFilter.empty && afterFilter.stopHidden && !afterFilter.playAllHidden && afterFilter.playing === 0,
    'searching mid-queue ends the queue and silences the card filtered out',
    JSON.stringify(afterFilter));
  check(tab.served('.mp3', 'GET').length === midQueue,
    'no further clip is requested after the queue was filtered away',
    tab.served('.mp3', 'GET').slice(midQueue).map((u) => u.split('/').pop()).join(', '));
  await tab.evaluate(`(() => {
    const i = document.getElementById('cvSearch');
    i.value = '';
    i.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await clickEl('#sectionTabs .mode-tab[data-section=""]');
  await sleep(300);

  // Stop mid-queue must return both buttons and leave nothing playing.
  await clickEl('#cvPlayAll');
  await tab.waitFor(`document.getElementById('cvStopAll').classList.contains('hidden') === false`, 8000);
  await clickEl('#cvStopAll');
  await sleep(250);
  const stopped = await tab.evaluate(`(() => ({
    playing: document.querySelectorAll('.cv-play[data-state="playing"]').length,
    stopHidden: document.getElementById('cvStopAll').classList.contains('hidden'),
    playAllHidden: document.getElementById('cvPlayAll').classList.contains('hidden'),
  }))()`);
  check(stopped.playing === 0 && stopped.stopHidden && !stopped.playAllHidden,
    'Stop all mid-queue: nothing playing, buttons restored', JSON.stringify(stopped));

  // Reviewer finding: Play all pressed while a card already plays must not orphan the
  // queue (advance() used to re-hand the playing card to playCard() and stop dead).
  // Asserted on the play events, not the network log: once a clip has been fetched the
  // browser answers a repeat from cache and no request is seen.
  await clickEl('.cv-card[data-id="a01"] .cv-play');      // start one card by hand
  await tab.waitFor(`document.querySelector('.cv-card[data-id="a01"] .cv-play').dataset.state === 'playing'`, 4000);
  const playedBefore = await tab.evaluate('window.__played.length');
  await clickEl('#cvPlayAll');
  const queueRan = await tab.waitFor(`window.__played.slice(${playedBefore}).some(u => /a02\\.mp3/.test(u))`, 15000);
  const dbl = await tab.evaluate(`(() => ({
    played: window.__played.slice(${playedBefore}),
    playAllHidden: document.getElementById('cvPlayAll').classList.contains('hidden'),
    stopHidden: document.getElementById('cvStopAll').classList.contains('hidden'),
  }))()`);
  check(queueRan && dbl.played.includes('a02.mp3'),
    'Play all while a card is already playing carries on with the queue',
    JSON.stringify(dbl));
  await tab.waitFor(`document.getElementById('cvStopAll').classList.contains('hidden')`, 15000);

  // Device-initiated pause (screen lock or incoming call on the iPad): no 'ended'
  // follows, so the queue must end itself instead of sitting on Stop forever.
  await clickEl('.cv-card[data-id="a01"] .cv-play');
  await tab.waitFor(`document.querySelector('.cv-card[data-id="a01"] .cv-play').dataset.state === 'playing'`, 4000);
  await tab.evaluate(`(() => { const a = window.__audios[window.__audios.length - 1]; a.pause(); })()`);
  await sleep(350);
  const devPause = await tab.evaluate(`(() => ({
    playing: document.querySelectorAll('.cv-play[data-state="playing"]').length,
    status: document.getElementById('cvAudioStatus').textContent,
  }))()`);
  check(devPause.playing === 0 && /Paused by the device/.test(devPause.status),
    'a device pause stops the button and says so', JSON.stringify(devPause));

  // Play all from a cold page: most cards sit below the fold unprobed, and on a
  // fully-recorded site their files do exist, so the queue must resolve each one with a
  // HEAD rather than guess. Proof it did not guess: after the queue, every card has a
  // settled state (40 pending, 2 playing/ready), not the 'ready' of an assumption.
  await tab.goto(`${base}/conversations.html`, 2000);
  await clickEl('#cvPlayAll');            // first real click also grants the sound gesture
  const coldRan = await tab.waitFor(`window.__played.includes('a02.mp3')`, 20000);
  const cold = await tab.evaluate(`(() => ({
    played: window.__played,
    pending: document.querySelectorAll('.cv-play[data-state="pending"]').length,
  }))()`);
  check(coldRan && cold.played.includes('a01.mp3') && cold.played.includes('a02.mp3'),
    'cold Play all resolves unprobed cards and still plays the two real ones',
    cold.played.join(','));
  check(!cold.played.some((u) => /a0[3-9]\.|b\d\d\.|c\d\d\./.test(u)),
    'cold Play all plays no file it has proven missing', cold.played.join(','));
  const settled = await tab.waitFor(`document.querySelectorAll('.cv-play[data-state="pending"]').length === 40`, 25000);
  check(settled, 'every unprobed card was resolved by a probe, not assumed playable',
    `${cold.pending} pending at queue end`);
  await tab.evaluate(`(() => { const a = window.__audios[window.__audios.length - 1]; if (a) a.pause(); })()`);
  await sleep(200);

  console.log('\n--- auto-play opt-in');
  const apInitial = await tab.evaluate(`(() => ({
    pressed: document.getElementById('cvAutoplay').getAttribute('aria-pressed'),
    stored: localStorage.getItem('cv-autoplay'),
  }))()`);
  check(apInitial.pressed === 'false' && apInitial.stored !== '1',
    'auto-play is off by default (browsers block unattended sound)', JSON.stringify(apInitial));
  await clickEl('#cvAutoplay');
  const apOn = await tab.evaluate(`(() => ({
    pressed: document.getElementById('cvAutoplay').getAttribute('aria-pressed'),
    stored: localStorage.getItem('cv-autoplay'),
  }))()`);
  check(apOn.pressed === 'true' && apOn.stored === '1',
    'auto-play toggle persists to localStorage', JSON.stringify(apOn));
  await clickEl('.cv-card[data-id="a01"] .cv-zh');
  await sleep(300);
  const tapped = await tab.evaluate(`(() => ({
    state: document.querySelector('.cv-card[data-id="a01"] .cv-play').dataset.state,
    playing: !document.querySelector('audio') ? null : null,
  }))()`);
  check(tapped.state === 'playing', 'with auto-play on, tapping a card plays it', tapped.state);
  await clickEl('.cv-card[data-id="a01"] .cv-play');   // stop again
  await clickEl('#cvAutoplay');                        // back to off for the screenshots
  await sleep(900);

  console.log('\n--- keyboard');
  // p plays the card nearest the middle of the screen (replay what you are looking at).
  await tab.evaluate(`(() => {
    document.activeElement.blur();
    document.querySelector('.cv-card[data-id="a02"]').scrollIntoView({ block: 'center', behavior: 'instant' });
  })()`);
  await sleep(400);
  for (const type of ['keyDown', 'keyUp']) {
    await tab.send('Input.dispatchKeyEvent', { type, key: 'p', code: 'KeyP', text: 'p', unmodifiedText: 'p' });
  }
  const pKey = await tab.waitFor(`document.querySelector('.cv-card[data-id="a02"] .cv-play').dataset.state === 'playing'`, 4000);
  check(pKey, 'p key plays the card at the centre of the screen (a02, centred)');
  await clickEl('.cv-card[data-id="a02"] .cv-play');   // stop it
  // p must be ignored while the search box has focus, or typing would trigger sound.
  await clickEl('#cvSearch');
  for (const type of ['keyDown', 'keyUp']) {
    await tab.send('Input.dispatchKeyEvent', { type, key: 'p', code: 'KeyP', text: 'p', unmodifiedText: 'p' });
  }
  await sleep(400);
  const pInSearch = await tab.evaluate(`(() => ({
    focused: document.activeElement.id,
    playing: document.querySelectorAll('.cv-play[data-state="playing"]').length,
    value: document.getElementById('cvSearch').value,
  }))()`);
  check(pInSearch.focused === 'cvSearch' && pInSearch.playing === 0 && pInSearch.value === 'p',
    'p types into the search box instead of playing', JSON.stringify(pInSearch));
  await tab.evaluate(`document.getElementById('cvSearch').blur()`);

  console.log('\n--- looks');
  for (const [w, h, name] of [[1280, 1000, 'desktop'], [375, 800, 'phone'], [320, 700, 'narrow']]) {
    await tab.setViewport(w, h, w < 500);
    await tab.goto(`${base}/conversations.html`, 1500);
    for (const theme of ['light', 'dark']) {
      await tab.evaluate(`document.documentElement.dataset.theme = ${JSON.stringify(theme)}`);
      await sleep(300);
      await tab.screenshot(join(shots, `${name}-${theme}.png`));
    }
  }
  const touchTarget = await tab.evaluate(`(() => {
    const b = document.querySelector('.cv-play');
    const r = b.getBoundingClientRect();
    return { w: r.width, h: r.height, overflow: document.documentElement.scrollWidth > window.innerWidth };
  })()`);
  check(touchTarget.w >= 44 && touchTarget.h >= 44,
    'play button is a 44px touch target on phone', `${touchTarget.w}x${touchTarget.h}`);
  check(!touchTarget.overflow, 'no horizontal overflow at 320px', String(touchTarget.overflow));

  console.log('\n--- geometry');
  await tab.setViewport(1280, 1000, false);
  await tab.goto(`${base}/conversations.html`, 1800);
  const geo = await tab.evaluate(`(() => {
    const size = (el) => parseFloat(getComputedStyle(el).fontSize);
    const zh = document.querySelector('.cv-zh'), py = document.querySelector('.cv-py'),
          en = document.querySelector('.cv-en'), role = document.querySelector('.cv-role');
    const clipped = [...document.querySelectorAll('.cv-card *')].filter((el) =>
      !el.children.length && el.scrollWidth > el.clientWidth + 1).map((el) => el.className);
    const col = (sel) => [...new Set([...document.querySelectorAll(sel)]
      .map((b) => Math.round(b.getBoundingClientRect().right)))];
    return {
      clipped,
      playX: col('.cv-play'),
      roleX: [...new Set([...document.querySelectorAll('.cv-role')]
        .map((b) => Math.round(b.getBoundingClientRect().left)))],
      textX: [...new Set([...document.querySelectorAll('.cv-line-text')]
        .map((b) => Math.round(b.getBoundingClientRect().left)))],
      hanziBiggest: size(zh) > size(py) && size(zh) > size(en),
      roleSmaller: size(role) < size(zh),
      gapZhPy: Math.round(py.getBoundingClientRect().top - zh.getBoundingClientRect().bottom),
      pageW: Math.round(document.querySelector('.conversations-page').getBoundingClientRect().width),
    };
  })()`);
  check(geo.clipped.length === 0, 'no text clipped inside a card', JSON.stringify(geo.clipped).slice(0, 160));
  check(geo.playX.length === 1, 'every play button shares one right edge', geo.playX.join(','));
  check(geo.roleX.length === 1 && geo.textX.length === 1,
    'role glyph and text columns line up across all lines', `${geo.roleX.join(',')} | ${geo.textX.join(',')}`);
  check(geo.hanziBiggest, 'hanzi is larger than pinyin and English on every card');
  check(geo.roleSmaller, 'role glyph is smaller than the hanzi it labels');
  check(geo.gapZhPy >= 0 && geo.gapZhPy < 12, 'pinyin sits tight under the hanzi', `${geo.gapZhPy}px`);
  await tab.screenshot(join(shots, 'geometry-desktop.png'), { full: true });

  console.log('\n--- the checker agrees with the page');
  const checker = spawnSync('python3', ['check_audio.py'], { cwd: siteDir, encoding: 'utf8' });
  check(/2 of 42 mp3s present/.test(checker.stdout) && checker.status === 1,
    'check_audio.py reports 2 of 42 present and exits non-zero',
    `exit ${checker.status}: ${checker.stdout.split('\n')[0]}`);
  const missing = (checker.stdout.match(/^  audio\/conversations\/\S+\.mp3$/gm) || []);
  check(missing.length === 40 && !missing.some((m) => /a0[12]\.mp3/.test(m)),
    'check_audio.py lists exactly the 40 unfilmed cards', `${missing.length} listed`);
} finally {
  stop();
  STUBS.forEach((id) => {
    const f = join(audioDir, `${id}.mp3`);
    if (existsSync(f)) rmSync(f);
  });
  const leftover = STUBS.filter((id) => existsSync(join(audioDir, `${id}.mp3`)));
  console.log(leftover.length ? `WARNING stubs left behind: ${leftover}` : 'stub mp3s removed');
}

console.log(`\nscreenshots: ${shots}`);
console.log(`${failures.length ? `FAIL (${failures.length})` : 'PASS'}: ${failures.join('; ') || 'all checks green'}`);
process.exit(failures.length ? 1 : 0);
