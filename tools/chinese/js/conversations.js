/* conversations.js: Flash Conversations. Render the generated cards and drive audio.
   Data comes from js/conversations-data.js (build_conversations.py).
   Audio files are not recorded yet; the page is built against the name contract in
   AUDIO_BASE below, so dropping mp3s into tools/chinese/audio/conversations/ works
   with no code change. */

// Single place to change the audio folder. Filename = card id + '.mp3'.
const AUDIO_BASE = 'audio/conversations/';

document.addEventListener('DOMContentLoaded', () => {
  const listEl = document.getElementById('cvList');
  if (typeof CONVERSATIONS === 'undefined') {
    // Without this the placeholder '载入中…' would sit there forever with no clue.
    listEl.textContent = 'Could not load the cards: js/conversations-data.js did not load.'
      + ' Run python3 build_conversations.py.';
    return;
  }

  const ROLE_GLYPH = { Q: '问', A: '答', B: '答', C: '答', S: '说' };
  // Section B cards are all role S (I say) so they render 说, matching the 说 tab;
  // A/B/C in section C are candidate answers to one question, so 答 is right for all.
  const CAPTIONS = {
    '': `All ${CONVERSATIONS.length} cards. Section A is what people ask you, B what you say, C what you ask at booths.`,
    A: 'Questions people will ask me. Answer each one directly.',
    B: 'Statements I would say. Short, and enough to keep a conversation going.',
    C: 'Questions I will ask at booths. Be ready for each candidate answer.',
  };

  const tabsEl = document.getElementById('sectionTabs');
  const captionEl = document.getElementById('cvCaption');
  const searchEl = document.getElementById('cvSearch');
  const resultsEl = document.getElementById('cvResults');
  const statusEl = document.getElementById('cvAudioStatus');
  const autoplayBtn = document.getElementById('cvAutoplay');
  const playAllBtn = document.getElementById('cvPlayAll');
  const stopAllBtn = document.getElementById('cvStopAll');
  const totalEl = document.getElementById('cvTotal');

  totalEl.textContent = CONVERSATIONS.length;

  let section = '';
  let query = '';
  let queue = [];            // ids left to play in Play-all mode
  let queueing = false;

  // ── Audio ───────────────────────────────────────────────────────────────────
  // One shared element for playback; readiness is probed per card with a HEAD
  // request so a missing file shows as pending instead of a dead button.
  const audio = new Audio();
  const ready = new Map();   // id -> true | false (undefined = unknown/probing)
  const probing = new Map(); // id -> in-flight probe promise, so two callers share one HEAD
  const playButtons = new Map();

  function setButtonState(id) {
    const btn = playButtons.get(id);
    if (!btn) return;
    const state = (current === id) ? 'playing' : (ready.get(id) === false ? 'pending' : 'ready');
    btn.dataset.state = state;
    btn.setAttribute('aria-label',
      state === 'playing' ? `Stop ${label(id)}`
      : state === 'pending' ? `${label(id)}: audio not recorded yet`
      : `Play ${label(id)}`);
    btn.title = state === 'pending' ? 'audio pending' : '';
  }

  function label(id) { return id.toUpperCase(); }

  // Probing all 42 files on load would compete with the fonts for bandwidth on venue
  // wifi, so a card is probed only when it approaches the viewport.
  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          observer.unobserve(e.target);
          probe(e.target.dataset.id);
        });
      }, { rootMargin: '200px' })
    : null;

  function probe(id) {
    if (!id) return Promise.resolve(false);
    if (ready.get(id) === true) return Promise.resolve(true);
    if (ready.get(id) === false) return Promise.resolve(false);
    const p = fetch(AUDIO_BASE + id + '.mp3', { method: 'HEAD' })
      // A catch-all host answers a missing file with 200 and an HTML page, so an ok
      // status alone is not enough. Only HTML is rejected outright: a server that
      // sends no content-type for a real mp3 must not make a card unplayable.
      .then((r) => {
        const type = (r.headers.get('content-type') || '').toLowerCase();
        ready.set(id, r.ok && !type.startsWith('text/html'));
      })
      .catch(() => {
        // A failed request says nothing about the file: venue wifi drops requests. Do
        // not mark the card pending forever, forget the result so a later render or
        // tap probes again. A real play attempt is still the ground truth.
        ready.delete(id);
      })
      .then(() => { setButtonState(id); updateStatus(); return ready.get(id); });
    ready.set(id, undefined);
    probing.set(id, p);
    return p;
  }

  function updateStatus() {
    const known = [...ready.values()].filter((v) => v !== undefined).length;
    const n = CONVERSATIONS.filter((c) => ready.get(c.id) === true).length;
    if (known === 0) { statusEl.textContent = ''; return; }
    statusEl.textContent = n === 0
      ? `Audio not recorded yet. Drop the mp3s into ${AUDIO_BASE} (python3 check_audio.py lists them).`
      : `Audio ready for ${n} of ${CONVERSATIONS.length} cards.`;
  }

  let current = null;
  let playUrl = null;
  // Our own audio.pause()s dispatch a pause task that runs after stop()/playCard() have
  // returned, by which time the next clip may already be loaded and readyState 4. So a
  // short-lived flag, cleared on the next task, marks those pauses as ours.
  let selfPause = false;
  const markSelfPause = () => {
    selfPause = true;
    setTimeout(() => { selfPause = false; }, 0);
  };
  // stop() clears the src, which makes the browser fire a late 'error' for the clip it
  // just cancelled. An event only counts while it belongs to the URL actually playing,
  // otherwise that event would blacklist the *next* card.
  const eventIsLive = () => !!current && audio.src === playUrl;

  function stop() {
    markSelfPause();
    audio.pause();
    audio.removeAttribute('src');
    playUrl = null;
    const prev = current;
    current = null;
    if (prev) setButtonState(prev);
  }

  function playCard(id) {
    if (current === id) { stop(); return; }
    markSelfPause();
    stop();
    current = id;
    playUrl = new URL(AUDIO_BASE + id + '.mp3', location.href).href;
    setButtonState(id);
    audio.src = playUrl;
    // A missing file surfaces as an 'error' event (handled below). A rejected play()
    // with no file at fault means the browser is still waiting for real interaction,
    // so say that instead of blaming a recording that does exist.
    audio.play().catch((err) => {
      if (!eventIsLive()) return;
      if (err && err.name === 'NotAllowedError') {
        statusEl.textContent = 'The browser waits for a click on the page before it allows sound. Tap play again.';
      }
      stop();
    });
  }

  audio.addEventListener('ended', () => {
    if (!eventIsLive()) return;
    stop();
    if (queueing) advance();
  });
  audio.addEventListener('error', () => {
    if (!eventIsLive()) return;
    ready.set(current, false);
    stop();
    updateStatus();
    if (queueing) advance();
  });
  // iPad interrupts a clip without warning (screen lock, incoming call, Safari
  // backgrounded). No 'ended' follows, so without this the queue would sit there with
  // Stop showing and Play all hidden until the user found Stop. Two guards keep our own
  // pause()s out of it: 'ended' (a clip finishing fires pause just before ended) and
  // readyState 0 (our stop() has cleared src; the pause event is a queued task that only
  // runs after that, including when a click has already started the next clip).
  audio.addEventListener('pause', () => {
    if (selfPause || !current || audio.ended || audio.readyState === 0) return;
    stop();
    if (queueing) endQueue();
    statusEl.textContent = 'Paused by the device. Tap play to continue.';
  });

  // Skip cards known to have no file, so a queue does not stall on the many cards
  // whose audio is not recorded yet. A card that has not been probed yet (it was below
  // the fold when the page loaded) is resolved first: guessing either way is wrong, on
  // would fire a doomed request per card and off would skip cards that do have audio.
  async function advance() {
    for (;;) {
      const next = queue.shift();
      if (!next) { endQueue(); return; }
      const ok = await probe(next);
      if (!queueing) return;              // Stop or a filter landed during the probe
      if (current) return;                // a manual play landed during the probe; the
                                          // ended handler will carry the queue on
      if (ok === false) continue;
      playCard(next);
      return;
    }
  }

  function startQueue() {
    // A card may already be playing from its own button, and it is still first in the
    // queue; without this stop, advance() would hand it back to playCard(), which
    // treats it as a second tap and stops, leaving the queue orphaned.
    stop();
    queue = visible().map((c) => c.id);
    if (!queue.length) return;
    queueing = true;
    playAllBtn.classList.add('hidden');
    stopAllBtn.classList.remove('hidden');
    advance();
  }

  function endQueue() {
    queueing = false;
    queue = [];
    playAllBtn.classList.remove('hidden');
    stopAllBtn.classList.add('hidden');
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  function visible() {
    const q = query.trim().toLowerCase();
    return CONVERSATIONS.filter((c) => {
      if (section && c.section !== section) return false;
      if (!q) return true;
      const hay = [c.id, c.title, c.note, ...c.lines.flatMap((l) => [l.zh, l.pinyin, l.en, l.label])]
        .join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  function cardEl(card) {
    const el = document.createElement('article');
    el.className = 'cv-card';
    el.dataset.id = card.id;

    const head = document.createElement('header');
    head.className = 'cv-head';
    const badge = document.createElement('span');
    badge.className = 'cv-id';
    badge.textContent = card.id.toUpperCase();
    const title = document.createElement('h3');
    title.className = 'cv-title';
    title.textContent = card.title;
    const btn = document.createElement('button');
    btn.className = 'cv-play';
    btn.dataset.state = 'ready';
    btn.dataset.id = card.id;
    head.append(badge, title, btn);
    playButtons.set(card.id, btn);
    setButtonState(card.id);
    if (observer) observer.observe(el); else probe(card.id);

    btn.addEventListener('click', (e) => { e.stopPropagation(); playCard(card.id); });
    // Auto-play (opt-in) plays a card when it is tapped, not only via the button.
    el.addEventListener('click', () => {
      if (autoplayBtn.getAttribute('aria-pressed') === 'true' && ready.get(card.id) !== false) {
        playCard(card.id);
      }
    });

    el.appendChild(head);

    const lines = document.createElement('div');
    lines.className = 'cv-lines';
    card.lines.forEach((line) => {
      const row = document.createElement('div');
      row.className = 'cv-line';
      const glyph = document.createElement('span');
      glyph.className = 'cv-role';
      glyph.setAttribute('aria-hidden', 'true');
      glyph.textContent = ROLE_GLYPH[line.role] || '·';
      const text = document.createElement('div');
      text.className = 'cv-line-text';
      const zh = document.createElement('div');
      zh.className = 'cv-zh';
      zh.textContent = line.zh;
      const py = document.createElement('div');
      py.className = 'cv-py';
      py.textContent = line.pinyin;
      const en = document.createElement('div');
      en.className = 'cv-en';
      en.textContent = line.en;
      if (line.label) {
        const lab = document.createElement('span');
        lab.className = 'cv-label';
        lab.textContent = `(${line.label})`;
        en.appendChild(document.createTextNode(' '));
        en.appendChild(lab);
      }
      text.append(zh, py, en);
      row.append(glyph, text);
      lines.appendChild(row);
    });
    el.appendChild(lines);

    if (card.note) {
      const note = document.createElement('p');
      note.className = 'cv-note';
      note.textContent = card.note;
      el.appendChild(note);
    }
    return el;
  }

  function render() {
    playButtons.clear();
    const cards = visible();
    // A card that has just been filtered out has no button left to own its sound,
    // and a queue must not keep playing cards the screen no longer shows.
    const shown = new Set(cards.map((c) => c.id));
    if (queueing) queue = queue.filter((id) => shown.has(id));
    if (current && !shown.has(current)) stop();
    if (queueing) {
      if (!queue.length) endQueue();
      else if (!current) advance();   // the playing card went away; carry on without it
    }
    listEl.textContent = '';
    if (!cards.length) {
      const p = document.createElement('p');
      p.className = 'cv-empty';
      p.textContent = 'No cards match that search.';
      listEl.appendChild(p);
    } else {
      cards.forEach((c) => listEl.appendChild(cardEl(c)));
    }
    resultsEl.textContent = `${cards.length} of ${CONVERSATIONS.length}`;
    captionEl.textContent = CAPTIONS[section];
  }

  tabsEl.addEventListener('click', (e) => {
    const tab = e.target.closest('.mode-tab');
    if (!tab) return;
    tabsEl.querySelectorAll('.mode-tab').forEach((t) => {
      t.classList.toggle('active', t === tab);
      t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
    });
    section = tab.dataset.section;
    render();
  });

  searchEl.addEventListener('input', () => { query = searchEl.value; render(); });

  const AUTOPLAY_KEY = 'cv-autoplay';
  function applyAutoplay(on) {
    autoplayBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    localStorage.setItem(AUTOPLAY_KEY, on ? '1' : '0');
  }
  applyAutoplay(localStorage.getItem(AUTOPLAY_KEY) === '1');
  autoplayBtn.addEventListener('click', () => {
    applyAutoplay(autoplayBtn.getAttribute('aria-pressed') !== 'true');
  });

  playAllBtn.addEventListener('click', startQueue);
  stopAllBtn.addEventListener('click', () => { endQueue(); stop(); });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'p' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.repeat) return;   // a held key on a hardware keyboard must not restart the clip
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    // Play the card nearest the middle of the screen, not the top of the list: at the
    // fair the point is to replay what you are looking at. Cards known to have no file
    // are skipped, the same rule as the queue.
    const cards = visible().filter((c) => ready.get(c.id) !== false);
    if (!cards.length) return;
    const mid = window.innerHeight / 2;
    let best = null;
    let bestDist = Infinity;
    for (const el of listEl.querySelectorAll('.cv-card')) {
      const id = el.dataset.id;
      if (!cards.some((c) => c.id === id)) continue;
      const r = el.getBoundingClientRect();
      const dist = Math.abs((r.top + Math.min(r.height, mid) / 2) - mid);
      if (dist < bestDist) { bestDist = dist; best = id; }
    }
    playCard(best || cards[0].id);
  });

  render();
  updateStatus();
});
