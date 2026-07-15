/* sentence-builder.js
   Interaction model:
   — every placement is checked immediately: green = correct slot,
     yellow = belongs in the sentence but wrong slot (stays, can be moved),
     red = not in this sentence (bounces back to the bank and stays red there)
   — placed words can be dragged between slots (drop on a filled slot swaps)
   — removing a placed word returns it to the bank colored yellow ("belongs,
     not placed") — even if it was green, since it's no longer in position
   — Hint fills the first non-green slot with the right word
   — solved when every slot is green: banner + pinyin, wait for Next
   — progress = running accuracy: correct placements / placement attempts
*/

document.addEventListener('DOMContentLoaded', () => {
  if (typeof sentences === 'undefined' || !sentences.length) return;

  // ── Pinyin utilities ───────────────────────────────────────────────────────
  function stripToneMarks(py) {
    const map = {
      'ā':'a','á':'a','ǎ':'a','à':'a',
      'ē':'e','é':'e','ě':'e','è':'e',
      'ī':'i','í':'i','ǐ':'i','ì':'i',
      'ō':'o','ó':'o','ǒ':'o','ò':'o',
      'ū':'u','ú':'u','ǔ':'u','ù':'u',
      'ǖ':'ü','ǘ':'ü','ǚ':'ü','ǜ':'ü',
    };
    return py.split('').map(c => map[c] ?? c).join('');
  }

  // Count how many Chinese characters a pinyin word represents.
  function pinyinSyllableCount(pyWord) {
    const clean = stripToneMarks(pyWord).toLowerCase().replace(/[^a-züA-ZÜ]/g, '');
    const m = clean.match(
      /(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?(?:iang|iao|iong|uang|uai|üan|üe|ue|ian|uan|ang|eng|ing|ong|ao|ou|ia|ie|ua|uo|ui|iu|ai|ei|an|en|in|un|er|[aoeüiu]+)/g
    );
    let n = Math.max(1, m ? m.length : 1);
    // Erhua: a trailing 'r' the finals didn't consume (nǎr, yǒudiǎnr,
    // miàntiáor…) is written 儿 — one extra character. ("èr/ér" themselves
    // match the "er" final fully, so they don't hit this branch.)
    if (m && clean.endsWith('r') && m.join('').length === clean.length - 1) n += 1;
    return n;
  }

  // Punctuation to strip before tokenizing — CJK + ASCII + dash variants.
  const PUNCT_RE = /[。？！，、；：""''「」（）【】.,!?;:'"()—–…]/g;

  // Split a sentence into word-level tokens, each with {zh, pinyin}
  function tokenizeSentence(zh, pinyin) {
    // Sentences with embedded Latin terms (CPU, T恤衫, …) can't be reliably
    // character-counted; skip them for hanzi-arrange mode entirely so bad
    // pairings never reach the shared distractor pool.
    if (/[A-Za-z]/.test(zh)) return [];

    const cleanZh = zh.replace(PUNCT_RE, '');
    const cleanPy = pinyin.replace(PUNCT_RE, '').trim();
    const pyWords = cleanPy.split(/\s+/).filter(Boolean);

    const tokens = [];
    let charPos  = 0;
    for (const pyWord of pyWords) {
      const n     = pinyinSyllableCount(pyWord);
      const hanzi = cleanZh.slice(charPos, charPos + n);
      if (hanzi) tokens.push({ zh: hanzi, pinyin: pyWord });
      charPos += n;
    }
    if (charPos < cleanZh.length && tokens.length) {
      tokens[tokens.length - 1].zh += cleanZh.slice(charPos);
    }
    // Merge consecutive all-digit tokens (spelled-out years etc.)
    const merged = [];
    for (const t of tokens) {
      const prev = merged[merged.length - 1];
      if (/^[0-9]+$/.test(t.zh) && prev && /^[0-9]+$/.test(prev.zh)) {
        prev.zh += t.zh;
        prev.pinyin += ' ' + t.pinyin;
      } else {
        merged.push({ ...t });
      }
    }
    return merged;
  }

  // ── Distractor pool (lazy, built once) ────────────────────────────────────
  let _pool = null;
  function pool(m) {
    if (!_pool) {
      _pool = { zh: [], en: [] };
      sentences.forEach(s => {
        tokenizeSentence(s.zh, s.pinyin).forEach(t => _pool.zh.push(t));
        s.en.replace(/[.,!?;:'"()—–]/g, '').split(/\s+/).filter(Boolean)
            .forEach(w => _pool.en.push(w.toLowerCase()));
      });
      const zhSeen = new Set();
      const pureZh = /^[一-鿿㐀-䶿0-9]+$/;
      _pool.zh = _pool.zh.filter(t => {
        if (!pureZh.test(t.zh)) return false;
        if (zhSeen.has(t.zh)) return false;
        zhSeen.add(t.zh);
        return true;
      });
      _pool.en = [...new Set(_pool.en)];
    }
    return _pool[m];
  }

  // ── State ──────────────────────────────────────────────────────────────────
  const STORE = 'cv-builder';
  let mode        = 'zh';
  let currentIdx  = -1;
  let tokens      = [];    // [{zh,pinyin}] or [string]
  let bank        = [];    // [{id, zh?, py?, en?, status:'idle'|'red'|'yellow', slot:number|null}]
  let slots       = [];    // bankId | null, per token position
  let slotStates  = [];    // 'green' | 'yellow' | null
  let solvedLock  = false; // freeze the board after solving, until Next
  let stats       = { attempts: 0, correct: 0, solved: 0 };

  // ── DOM ────────────────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const slotsArea    = $('slotsArea');
  const wordBank     = $('wordBank');
  const feedbackBar  = $('feedbackBar');
  const promptText   = $('promptText');
  const promptPinyin = $('promptPinyin');
  const promptLabel  = $('promptLabel');

  // ── Mode tabs ──────────────────────────────────────────────────────────────
  $('tabZh')?.addEventListener('click', () => setMode('zh'));
  $('tabEn')?.addEventListener('click', () => setMode('en'));

  function setMode(m) {
    mode = m;
    $('tabZh')?.classList.toggle('active', m === 'zh');
    $('tabEn')?.classList.toggle('active', m === 'en');
    loadSentence(pickRandom());
  }

  // ── Word helpers ───────────────────────────────────────────────────────────
  const wordById  = id => bank.find(w => w.id === id);
  const wordText  = w  => mode === 'zh' ? w.zh : w.en;
  const tokenText = i  => mode === 'zh' ? tokens[i].zh : tokens[i];
  const tokenList = () => tokens.map((_, i) => tokenText(i));

  // green | yellow | red for placing `word` into slot `idx`
  function evaluate(idx, word) {
    const text = wordText(word);
    if (text === tokenText(idx)) return 'green';
    if (tokenList().includes(text)) return 'yellow';
    return 'red';
  }

  // ── Load sentence ──────────────────────────────────────────────────────────
  function pickRandom() {
    let idx;
    do { idx = Math.floor(Math.random() * sentences.length); }
    while (idx === currentIdx && sentences.length > 1);
    return idx;
  }

  function loadSentence(idx) {
    currentIdx = idx;
    solvedLock = false;
    const s = sentences[idx];
    if (mode === 'zh') {
      tokens = tokenizeSentence(s.zh, s.pinyin)
        .filter(t => /^[一-鿿㐀-䶿0-9]+$/.test(t.zh));
      if (!tokens.length) { loadSentence(pickRandom()); return; }
      if (promptLabel)  promptLabel.textContent  = 'Arrange the Chinese words to match this English:';
      if (promptText)   promptText.textContent   = s.en;
      if (promptPinyin) promptPinyin.textContent = '';
    } else {
      tokens = s.en.replace(/[.,!?;:'"()—–]/g, '').split(/\s+/).filter(Boolean).map(w => w.toLowerCase());
      if (!tokens.length) { loadSentence(pickRandom()); return; }
      if (promptLabel)  promptLabel.textContent  = 'Arrange the English words to match this Chinese:';
      if (promptText)   promptText.textContent   = s.zh;
      if (promptPinyin) promptPinyin.textContent = s.pinyin;
    }
    slots      = new Array(tokens.length).fill(null);
    slotStates = new Array(tokens.length).fill(null);
    buildBank();
    hideFeedback();
    render();
  }

  // ── Bank ───────────────────────────────────────────────────────────────────
  function buildBank() {
    const distractors = pickDistractors(20);
    let raw;
    if (mode === 'zh') {
      raw = shuffle([...tokens, ...distractors])
        .map((t, i) => ({ zh: t.zh, py: t.pinyin, id: 'w' + i }));
    } else {
      raw = shuffle([...tokens, ...distractors])
        .map((w, i) => ({ en: w, id: 'w' + i }));
    }
    bank = raw.map(w => ({ ...w, status: 'idle', slot: null }));
  }

  function pickDistractors(n) {
    if (mode === 'zh') {
      const ex = new Set(tokens.map(t => t.zh));
      return shuffle(pool('zh').filter(t => !ex.has(t.zh))).slice(0, n);
    } else {
      const ex = new Set(tokens);
      return shuffle(pool('en').filter(w => !ex.has(w))).slice(0, n);
    }
  }

  function shuffle(a) {
    const r = [...a];
    for (let i = r.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [r[i], r[j]] = [r[j], r[i]];
    }
    return r;
  }

  // ── Core moves ─────────────────────────────────────────────────────────────
  // Attempt to place a bank word into a slot. Returns the verdict.
  function placeFromBank(word, idx, opts = {}) {
    if (solvedLock) return null;
    const verdict = evaluate(idx, word);
    if (!opts.isHint) {
      stats.attempts++;
      if (verdict === 'green') stats.correct++;
      saveStats();
    }
    if (verdict === 'red') {
      word.status = 'red';
      showFeedback(`❌ ${chipLabel(word)} isn't in this sentence.`, 'incorrect');
      return verdict;
    }
    // Displace any occupant back to the bank (yellow — it belongs).
    const occupantId = slots[idx];
    if (occupantId !== null) returnToBank(occupantId);
    word.slot = idx;
    word.status = 'idle';
    slots[idx] = word.id;
    slotStates[idx] = verdict;
    hideFeedback();
    checkSolved();
    return verdict;
  }

  // Move a placed word from one slot to another. Swaps if the target is
  // occupied. The dragged word counts as an attempt; the swapped occupant is
  // re-evaluated silently.
  function moveSlotToSlot(from, to) {
    if (solvedLock || from === to) return;
    const wordId = slots[from];
    if (wordId === null) return;
    const word = wordById(wordId);
    const occupantId = slots[to];

    stats.attempts++;
    const verdict = evaluate(to, word); // green|yellow — slot words always belong
    if (verdict === 'green') stats.correct++;
    saveStats();

    slots[from] = null;
    slotStates[from] = null;
    slots[to] = word.id;
    slotStates[to] = verdict;
    word.slot = to;

    if (occupantId !== null) {
      const occ = wordById(occupantId);
      slots[from] = occ.id;
      slotStates[from] = evaluate(from, occ);
      occ.slot = from;
    }
    hideFeedback();
    checkSolved();
  }

  // Remove a word from its slot back to the bank. Green AND yellow both
  // become yellow in the bank — the word belongs but is no longer placed.
  function returnToBank(wordId) {
    const word = wordById(wordId);
    if (!word || word.slot === null) return;
    slots[word.slot] = null;
    slotStates[word.slot] = null;
    word.slot = null;
    word.status = 'yellow';
  }

  function removeSlot(idx) {
    if (solvedLock) return;
    const id = slots[idx];
    if (id === null) return;
    returnToBank(id);
    hideFeedback();
    render();
  }

  // ── Hint ───────────────────────────────────────────────────────────────────
  function hint() {
    if (solvedLock) return;
    const idx = slotStates.findIndex(st => st !== 'green');
    if (idx === -1) return;
    const needed = tokenText(idx);
    // Prefer a free bank chip; otherwise pull the word out of a wrong slot.
    let word = bank.find(w => w.slot === null && wordText(w) === needed);
    if (!word) {
      word = bank.find(w => w.slot !== null && slotStates[w.slot] !== 'green' && wordText(w) === needed);
      if (word) returnToBank(word.id);
    }
    if (!word) return;
    placeFromBank(word, idx, { isHint: true });
    render();
  }

  // ── Solved? ────────────────────────────────────────────────────────────────
  function checkSolved() {
    if (!slotStates.length || !slotStates.every(st => st === 'green')) return;
    solvedLock = true;
    stats.solved++;
    saveStats();
    const s = sentences[currentIdx];
    const answer = mode === 'zh' ? `${s.zh} — ${s.pinyin}` : s.en;
    showFeedback(`✅ Solved! ${answer}`, 'correct');
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  function render() { renderSlots(); renderBank(); updateProgress(); }

  function chipLabel(word) {
    return mode === 'zh' ? word.zh : word.en;
  }

  function chipInnerHtml(word) {
    return mode === 'zh'
      ? `<span class="chip-zh">${word.zh}</span>${word.py ? `<span class="chip-py">${word.py}</span>` : ''}`
      : `<span class="chip-en">${word.en}</span>`;
  }

  function renderSlots() {
    slotsArea.innerHTML = '';
    slots.forEach((wordId, idx) => {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.idx = idx;
      const state = slotStates[idx];
      if (wordId !== null) {
        const word = wordById(wordId);
        slot.classList.add('filled');
        if (state === 'green')  slot.classList.add('correct');
        if (state === 'yellow') slot.classList.add('misplaced');
        slot.innerHTML = chipInnerHtml(word);

        if (!solvedLock) {
          const rm = document.createElement('button');
          rm.className = 'remove-btn';
          rm.textContent = '✕';
          rm.setAttribute('aria-label', 'Remove');
          rm.addEventListener('pointerdown', e => e.stopPropagation());
          rm.addEventListener('click', e => { e.stopPropagation(); removeSlot(idx); });
          slot.appendChild(rm);
          // Drag to move between slots; tap to remove.
          slot.addEventListener('pointerdown', e => startDrag(e, { word, fromSlot: idx, el: slot }));
        }
      }
      slotsArea.appendChild(slot);
    });
  }

  function renderBank() {
    wordBank.innerHTML = '';
    bank.forEach(w => {
      const used = w.slot !== null;
      const chip = document.createElement('div');
      chip.className = 'word-chip'
        + (used ? ' used' : '')
        + (!used && w.status === 'red'    ? ' red'    : '')
        + (!used && w.status === 'yellow' ? ' yellow' : '');
      chip.dataset.wid = w.id;
      chip.innerHTML = chipInnerHtml(w);
      if (!used && !solvedLock) {
        chip.addEventListener('pointerdown', e => startDrag(e, { word: w, fromSlot: null, el: chip }));
      }
      wordBank.appendChild(chip);
    });
  }

  // ── Drag engine (pointer capture + rAF + translate3d) ──────────────────────
  function startDrag(e, source) {
    if (solvedLock) return;
    if (e.button && e.button !== 0) return;
    e.preventDefault();

    const el = source.el;
    const startX = e.clientX, startY = e.clientY;
    const THRESHOLD = 5;

    let dragging = false;
    let ghost = null, ghostW = 0, ghostH = 0;
    let lastX = startX, lastY = startY;
    let rafId = null;
    let lastSlot = null;

    try { el.setPointerCapture(e.pointerId); } catch {}

    function slotUnder(x, y) {
      const hit = document.elementFromPoint(x, y);
      return hit ? hit.closest('.slot') : null;
    }

    function makeGhost() {
      ghost = document.createElement('div');
      ghost.className = 'drag-ghost';
      ghost.innerHTML = chipInnerHtml(source.word);
      const r = el.getBoundingClientRect();
      ghostW = r.width; ghostH = r.height;
      ghost.style.width = ghostW + 'px';
      document.body.appendChild(ghost);
      el.classList.add('dragging');
      applyGhost();
    }

    function applyGhost() {
      rafId = null;
      if (!ghost) return;
      // translate3d keeps the ghost on the compositor — no layout/paint per
      // move, so it tracks the pointer without trailing.
      ghost.style.transform =
        `translate3d(${lastX - ghostW / 2}px, ${lastY - ghostH / 2}px, 0)`;
      const slot = slotUnder(lastX, lastY);
      if (slot !== lastSlot) {
        lastSlot?.classList.remove('drag-over');
        if (slot && !slot.classList.contains('filled')) slot.classList.add('drag-over');
        lastSlot = slot;
      }
    }

    function onMove(ev) {
      lastX = ev.clientX; lastY = ev.clientY;
      if (!dragging && Math.hypot(lastX - startX, lastY - startY) > THRESHOLD) {
        dragging = true;
        makeGhost();
      }
      if (dragging) {
        ev.preventDefault();
        if (rafId === null) rafId = requestAnimationFrame(applyGhost);
      }
    }

    function cleanup() {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
      if (rafId !== null) cancelAnimationFrame(rafId);
      lastSlot?.classList.remove('drag-over');
      el.classList.remove('dragging');
    }

    function killGhost() { if (ghost) { ghost.remove(); ghost = null; } }

    // Animate the ghost flying back to a bank chip, then re-render.
    function bounceBack() {
      const chipEl = wordBank.querySelector(`[data-wid="${source.word.id}"]`);
      const target = chipEl ? chipEl.getBoundingClientRect() : el.getBoundingClientRect();
      if (!ghost) { render(); return; }
      const g = ghost; ghost = null;
      g.classList.add('bounce');
      g.style.transform = `translate3d(${target.x}px, ${target.y}px, 0)`;
      const done = () => {
        g.remove();
        render();
        wordBank.querySelector(`[data-wid="${source.word.id}"]`)?.classList.add('shake');
      };
      g.addEventListener('transitionend', done, { once: true });
      setTimeout(() => { if (g.isConnected) done(); }, 350);
    }

    function onUp(ev) {
      cleanup();
      const target = dragging ? slotUnder(ev.clientX, ev.clientY) : null;

      if (dragging) {
        if (target) {
          const idx = +target.dataset.idx;
          if (source.fromSlot !== null) {
            killGhost();
            moveSlotToSlot(source.fromSlot, idx);
            render();
          } else {
            const verdict = placeFromBank(source.word, idx);
            if (verdict === 'red') { bounceBack(); return; }
            killGhost();
            render();
          }
        } else if (source.fromSlot !== null) {
          // Dragged out of the sentence → back to the bank (yellow).
          killGhost();
          removeSlot(source.fromSlot);
        } else {
          killGhost();
          render();
        }
      } else {
        // Tap
        if (source.fromSlot !== null) {
          removeSlot(source.fromSlot);
        } else {
          const first = slots.findIndex(v => v === null);
          if (first !== -1) {
            const verdict = placeFromBank(source.word, first);
            render();
            if (verdict === 'red') {
              wordBank.querySelector(`[data-wid="${source.word.id}"]`)?.classList.add('shake');
            }
          }
        }
      }
    }

    function onCancel() { cleanup(); killGhost(); render(); }

    el.addEventListener('pointermove', onMove, { passive: false });
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
  }

  // ── Buttons ────────────────────────────────────────────────────────────────
  $('hintBtn')?.addEventListener('click', hint);

  $('clearBtn')?.addEventListener('click', () => {
    if (solvedLock) return;
    slots.forEach((id, i) => { if (id !== null) returnToBank(id); });
    hideFeedback();
    render();
  });

  $('nextBtn')?.addEventListener('click', () => loadSentence(pickRandom()));

  $('resetProgress')?.addEventListener('click', () => {
    stats = { attempts: 0, correct: 0, solved: 0 };
    saveStats();
    updateProgress();
  });

  // ── Feedback ───────────────────────────────────────────────────────────────
  function showFeedback(msg, type) {
    feedbackBar.textContent = msg;
    feedbackBar.className = 'feedback-bar show ' + type;
  }
  function hideFeedback() { feedbackBar.className = 'feedback-bar'; }

  // ── Progress ───────────────────────────────────────────────────────────────
  function updateProgress() {
    const pct = stats.attempts ? Math.round(stats.correct / stats.attempts * 100) : 0;
    const pt = $('progressText'); const pf = $('progressFill');
    if (pt) pt.textContent = stats.attempts
      ? `Session accuracy: ${pct}% (${stats.correct}/${stats.attempts} placements) · ${stats.solved} solved`
      : `Session accuracy: — · ${stats.solved} solved`;
    if (pf) pf.style.width = pct + '%';
  }

  // ── Persist ────────────────────────────────────────────────────────────────
  function saveStats() {
    try { localStorage.setItem(STORE + '-stats', JSON.stringify(stats)); } catch {}
  }
  function loadStats() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE + '-stats') || 'null');
      if (s && typeof s.attempts === 'number') stats = s;
    } catch {}
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  localStorage.removeItem(STORE + '-state');  // legacy keys from old versions
  localStorage.removeItem(STORE + '-score');
  loadStats();
  loadSentence(pickRandom());
  updateProgress();
});
