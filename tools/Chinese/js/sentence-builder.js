/* sentence-builder.js
   — word-level tokenisation with pinyin on every Chinese token
   — auto-check fires whenever all slots are filled
   — per-slot state: null | 'pending' | 'correct' | 'incorrect'
   — removing a slot clears only that slot; others keep their colour
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
  // Uses finals-aware matching so compound finals like "uo", "ui", "iu",
  // "ang", "eng", "ing", "ian", "uan" etc. count as ONE syllable.
  function pinyinSyllableCount(pyWord) {
    const clean = stripToneMarks(pyWord).toLowerCase().replace(/[^a-züA-ZÜ]/g, '');
    // Order finals longest-first to avoid partial matches
    const m = clean.match(
      /(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?(?:iang|iao|iong|uang|uai|üan|üe|ue|ian|uan|ang|eng|ing|ong|ao|ou|ia|ie|ua|uo|ui|iu|ai|ei|an|en|in|un|er|[aoeüiu]+)/g
    );
    return Math.max(1, m ? m.length : 1);
  }

  // Split a sentence into word-level tokens, each with {zh, pinyin}
  function tokenizeSentence(zh, pinyin) {
    const cleanZh = zh.replace(/[。？！，、；：""''「」（）【】.,!?;:'"()]/g, '');
    const cleanPy = pinyin.replace(/[。？！，、；：""''「」（）【】.,!?;:'"()]/g, '').trim();
    const pyWords = cleanPy.split(/\s+/).filter(Boolean);

    const tokens = [];
    let charPos  = 0;
    for (const pyWord of pyWords) {
      const n     = pinyinSyllableCount(pyWord);
      const hanzi = cleanZh.slice(charPos, charPos + n);
      if (hanzi) tokens.push({ zh: hanzi, pinyin: pyWord });
      charPos += n;
    }
    // Bundle any leftover characters (count mismatch safety)
    if (charPos < cleanZh.length && tokens.length) {
      tokens[tokens.length - 1].zh += cleanZh.slice(charPos);
    }
    return tokens;
  }

  // ── Distractor pool (lazy, built once) ────────────────────────────────────
  let _pool = null;
  function pool(mode) {
    if (!_pool) {
      _pool = { zh: [], en: [] };
      sentences.forEach(s => {
        tokenizeSentence(s.zh, s.pinyin).forEach(t => _pool.zh.push(t));
        s.en.replace(/[.,!?;:'"()]/g, '').split(/\s+/).filter(Boolean)
            .forEach(w => _pool.en.push(w.toLowerCase()));
      });
      // Deduplicate + keep only pure-Chinese tokens (no Latin/digit contamination)
      const zhSeen = new Set();
      const pureZh = /^[一-鿿㐀-䶿]+$/; // CJK only
      _pool.zh = _pool.zh.filter(t => {
        if (!pureZh.test(t.zh)) return false;  // skip if any non-CJK char
        if (zhSeen.has(t.zh)) return false;
        zhSeen.add(t.zh);
        return true;
      });
      _pool.en = [...new Set(_pool.en)];
    }
    return _pool[mode];
  }

  // ── State ──────────────────────────────────────────────────────────────────
  const STORE = 'cv-builder';
  let mode         = 'zh';
  let currentIdx   = -1;
  let tokens       = [];   // [{zh,pinyin}] or [string]
  let slotValues   = [];   // null | {zh,py} | string
  let slotStates   = [];   // null | 'pending' | 'correct' | 'incorrect'
  let bankWords    = [];   // [{zh,py,id}] or [{en,id}]
  let score        = { correct: 0, total: 0 };

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

  // ── Load sentence ──────────────────────────────────────────────────────────
  function pickRandom() {
    let idx;
    do { idx = Math.floor(Math.random() * sentences.length); }
    while (idx === currentIdx && sentences.length > 1);
    return idx;
  }

  function loadSentence(idx) {
    currentIdx = idx;
    const s = sentences[idx];
    if (mode === 'zh') {
      tokens = tokenizeSentence(s.zh, s.pinyin)
        .filter(t => /^[一-鿿㐀-䶿]+$/.test(t.zh)); // skip any Latin-contaminated tokens
      if (!tokens.length) { loadSentence(pickRandom()); return; } // skip bad sentence
      if (promptLabel) promptLabel.textContent = 'Arrange the Chinese words to match this English:';
      if (promptText)  promptText.textContent  = s.en;
      if (promptPinyin) promptPinyin.textContent = '';
    } else {
      tokens = s.en.replace(/[.,!?;:'"()]/g, '').split(/\s+/).filter(Boolean).map(w => w.toLowerCase());
      if (promptLabel)  promptLabel.textContent  = 'Arrange the English words to match this Chinese:';
      if (promptText)   promptText.textContent   = s.zh;
      if (promptPinyin) promptPinyin.textContent = s.pinyin;
    }
    slotValues = new Array(tokens.length).fill(null);
    slotStates = new Array(tokens.length).fill(null);
    buildBank();
    render();
    hideFeedback();
    saveState();
  }

  // ── Bank ───────────────────────────────────────────────────────────────────
  function buildBank() {
    const distractors = pickDistractors(20);
    if (mode === 'zh') {
      bankWords = shuffle([...tokens, ...distractors])
        .map((t, i) => ({ zh: t.zh, py: t.pinyin, id: 'w' + i }));
    } else {
      bankWords = shuffle([...tokens, ...distractors])
        .map((w, i) => ({ en: w, id: 'w' + i }));
    }
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

  // ── Render ─────────────────────────────────────────────────────────────────
  function render() { renderSlots(); renderBank(); updateProgress(); }

  function chipContent(val, isChinese) {
    // Returns inner HTML for a filled slot or bank chip
    if (!isChinese) return `<span class="chip-en">${val}</span>`;
    const zh = typeof val === 'object' ? val.zh : val;
    const py = typeof val === 'object' ? val.py : '';
    return `<span class="chip-zh">${zh}</span>${py ? `<span class="chip-py">${py}</span>` : ''}`;
  }

  function renderSlots() {
    slotsArea.innerHTML = '';
    slotValues.forEach((val, idx) => {
      const slot  = document.createElement('div');
      const state = slotStates[idx];
      const filled = val !== null;

      slot.className = 'slot';
      if (filled)              slot.classList.add('filled');
      if (state === 'correct')   slot.classList.add('correct');
      if (state === 'incorrect') slot.classList.add('incorrect');
      slot.dataset.idx = idx;

      if (filled) {
        slot.innerHTML = chipContent(val, mode === 'zh');
        const rm = document.createElement('button');
        rm.className = 'remove-btn';
        rm.textContent = '✕';
        rm.setAttribute('aria-label', 'Remove');
        rm.addEventListener('click', e => { e.stopPropagation(); removeSlot(idx); });
        slot.appendChild(rm);
        // Tapping a filled slot removes it (mobile-friendly — no hover needed)
        slot.addEventListener('click', () => removeSlot(idx));
      }

      slotsArea.appendChild(slot);
    });
  }

  function renderBank() {
    wordBank.innerHTML = '';
    const usedZh = new Set(slotValues.filter(v => v && mode === 'zh').map(v => (typeof v === 'object' ? v.zh : v)));
    const usedEn = new Set(slotValues.filter(v => v && mode === 'en'));

    bankWords.forEach(w => {
      const used = mode === 'zh' ? usedZh.has(w.zh) : usedEn.has(w.en);
      const chip = document.createElement('div');
      chip.className = 'word-chip' + (used ? ' used' : '');
      chip.dataset.wid = w.id;
      chip.innerHTML = mode === 'zh'
        ? `<span class="chip-zh">${w.zh}</span>${w.py ? `<span class="chip-py">${w.py}</span>` : ''}`
        : `<span class="chip-en">${w.en}</span>`;

      // Unified pointer drag (works for mouse AND touch). Falls back to
      // tap-to-place-in-first-empty-slot when the pointer barely moves.
      if (!used) chip.addEventListener('pointerdown', e => startDrag(e, chip, w));

      wordBank.appendChild(chip);
    });
  }

  // ── Place / remove ─────────────────────────────────────────────────────────
  function placeWord(slotIdx, bankWord) {
    slotValues[slotIdx] = mode === 'zh' ? { zh: bankWord.zh, py: bankWord.py } : bankWord.en;
    slotStates[slotIdx] = 'pending';
    hideFeedback();
    render();
    // Auto-check only when every slot is filled
    if (slotValues.every(v => v !== null)) runCheck();
    saveState();
  }

  // ── Pointer drag engine (mouse + touch) ─────────────────────────────────────
  function startDrag(e, chip, word) {
    if (e.button && e.button !== 0) return;       // ignore non-primary mouse buttons
    e.preventDefault();

    const startX = e.clientX, startY = e.clientY;
    let ghost = null, dragging = false, lastSlot = null;
    const THRESHOLD = 6; // px before it counts as a drag rather than a tap

    function slotUnder(x, y) {
      const el = document.elementFromPoint(x, y);
      return el ? el.closest('.slot') : null;
    }

    function makeGhost() {
      ghost = chip.cloneNode(true);
      ghost.classList.add('drag-ghost');
      const r = chip.getBoundingClientRect();
      ghost.style.width = r.width + 'px';
      document.body.appendChild(ghost);
      chip.classList.add('dragging');
    }

    function moveGhost(x, y) {
      if (ghost) { ghost.style.left = x + 'px'; ghost.style.top = y + 'px'; }
      const slot = slotUnder(x, y);
      if (slot !== lastSlot) {
        lastSlot?.classList.remove('drag-over');
        if (slot && slot.classList.contains('filled') === false) slot.classList.add('drag-over');
        lastSlot = slot;
      }
    }

    function onMove(ev) {
      const x = ev.clientX, y = ev.clientY;
      if (!dragging && Math.hypot(x - startX, y - startY) > THRESHOLD) {
        dragging = true;
        makeGhost();
      }
      if (dragging) { ev.preventDefault(); moveGhost(x, y); }
    }

    function onUp(ev) {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      lastSlot?.classList.remove('drag-over');
      chip.classList.remove('dragging');
      if (ghost) { ghost.remove(); ghost = null; }

      const target = dragging ? slotUnder(ev.clientX, ev.clientY) : null;
      if (target) {
        placeWord(+target.dataset.idx, word);
      } else if (!dragging) {
        // Treat as a tap → first empty slot
        const first = slotValues.findIndex(v => v === null);
        if (first !== -1) placeWord(first, word);
      }
    }

    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  }

  function removeSlot(idx) {
    slotValues[idx] = null;
    slotStates[idx] = null;  // only this slot resets; others keep their colour
    hideFeedback();
    render();
    saveState();
  }

  // ── Check ──────────────────────────────────────────────────────────────────
  function runCheck() {
    let ok = true;
    slotValues.forEach((val, i) => {
      if (val === null) return;
      const isCorrect = mode === 'zh'
        ? (typeof val === 'object' ? val.zh : val) === tokens[i].zh
        : val === tokens[i];
      slotStates[i] = isCorrect ? 'correct' : 'incorrect';
      if (!isCorrect) ok = false;
    });
    renderSlots();
    if (ok) { showFeedback('✅ Correct!', 'correct'); score.correct++; }
    else    { showFeedback('❌ Not quite — red slots are wrong.', 'incorrect'); }
    score.total++;
    saveScore();
    updateProgress();
  }

  // Manual re-check button
  $('checkBtn')?.addEventListener('click', () => {
    if (slotValues.some(v => v === null)) { showFeedback('Fill all slots first.', 'incorrect'); return; }
    runCheck();
  });

  $('clearBtn')?.addEventListener('click', () => {
    slotValues = new Array(tokens.length).fill(null);
    slotStates = new Array(tokens.length).fill(null);
    hideFeedback(); render(); saveState();
  });

  $('nextBtn')?.addEventListener('click', () => loadSentence(pickRandom()));

  $('revealBtn')?.addEventListener('click', () => {
    tokens.forEach((t, i) => {
      slotValues[i] = mode === 'zh' ? { zh: t.zh, py: t.pinyin } : t;
      slotStates[i] = 'incorrect';
    });
    renderSlots();
    showFeedback('Answer: ' + (mode === 'zh' ? tokens.map(t => t.zh).join(' ') : tokens.join(' ')), 'incorrect');
  });

  $('resetProgress')?.addEventListener('click', () => {
    score = { correct: 0, total: 0 }; saveScore(); updateProgress();
  });

  // ── Feedback ───────────────────────────────────────────────────────────────
  function showFeedback(msg, type) {
    feedbackBar.textContent = msg;
    feedbackBar.className = 'feedback-bar show ' + type;
  }
  function hideFeedback() { feedbackBar.className = 'feedback-bar'; }

  // ── Progress ───────────────────────────────────────────────────────────────
  function updateProgress() {
    const pct = score.total ? Math.round(score.correct / score.total * 100) : 0;
    const pt = $('progressText'); const pf = $('progressFill');
    if (pt) pt.textContent = `${score.correct} / ${score.total} correct (${pct}%)`;
    if (pf) pf.style.width = pct + '%';
  }

  // ── Persist ────────────────────────────────────────────────────────────────
  function saveState() {
    try { localStorage.setItem(STORE + '-state', JSON.stringify({ mode, currentIdx, tokens, slotValues, slotStates, bankWords })); } catch {}
  }
  function saveScore() {
    try { localStorage.setItem(STORE + '-score', JSON.stringify(score)); } catch {}
  }

  function loadSaved() {
    try {
      const sc = JSON.parse(localStorage.getItem(STORE + '-score') || 'null');
      if (sc) score = sc;
      const st = JSON.parse(localStorage.getItem(STORE + '-state') || 'null');
      if (st && st.currentIdx >= 0 && st.currentIdx < sentences.length) {
        ({ mode, currentIdx, tokens, slotValues, bankWords } = st);
        slotStates = st.slotStates || new Array(tokens.length).fill(null);
        $('tabZh')?.classList.toggle('active', mode === 'zh');
        $('tabEn')?.classList.toggle('active', mode === 'en');
        const s = sentences[currentIdx];
        if (promptLabel)  promptLabel.textContent  = mode === 'zh' ? 'Arrange the Chinese words to match this English:' : 'Arrange the English words to match this Chinese:';
        if (promptText)   promptText.textContent   = mode === 'zh' ? s.en : s.zh;
        if (promptPinyin) promptPinyin.textContent = mode === 'zh' ? '' : s.pinyin;
        render(); return true;
      }
    } catch {}
    return false;
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  // Clear stale localStorage so old single-char state doesn't persist
  localStorage.removeItem(STORE + '-state');
  if (!loadSaved()) loadSentence(pickRandom());
  updateProgress();
});
