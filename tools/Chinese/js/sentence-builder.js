/* sentence-builder.js — drag-and-drop sentence builder with touch fallback */

document.addEventListener('DOMContentLoaded', () => {
  if (typeof sentences === 'undefined' || !sentences.length) return;

  // ── State ──────────────────────────────────────────────────────────────────
  const STATE_KEY = 'cv-builder';
  let mode        = 'zh';   // 'zh' | 'en'
  let currentIdx  = -1;
  let tokens      = [];     // correct answer tokens
  let slotValues  = [];     // what's placed in each slot (null = empty)
  let bankWords   = [];     // [{text, id}] — all words in bank
  let checked     = false;
  let score       = { correct: 0, total: 0 };
  let dragSourceId = null;  // id of chip being dragged

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const slotsArea    = document.getElementById('slotsArea');
  const wordBank     = document.getElementById('wordBank');
  const feedbackBar  = document.getElementById('feedbackBar');
  const promptText   = document.getElementById('promptText');
  const promptPinyin = document.getElementById('promptPinyin');
  const promptLabel  = document.getElementById('promptLabel');
  const checkBtn     = document.getElementById('checkBtn');
  const clearBtn     = document.getElementById('clearBtn');
  const nextBtn      = document.getElementById('nextBtn');
  const revealBtn    = document.getElementById('revealBtn');
  const tabZh        = document.getElementById('tabZh');
  const tabEn        = document.getElementById('tabEn');
  const progressText = document.getElementById('progressText');
  const progressFill = document.getElementById('progressFill');
  const resetBtn     = document.getElementById('resetProgress');

  // ── Mode toggle ────────────────────────────────────────────────────────────
  tabZh?.addEventListener('click', () => setMode('zh'));
  tabEn?.addEventListener('click', () => setMode('en'));

  function setMode(m) {
    mode = m;
    tabZh?.classList.toggle('active', m === 'zh');
    tabEn?.classList.toggle('active', m === 'en');
    loadSentence(pickRandomIdx());
  }

  // ── Tokenise ───────────────────────────────────────────────────────────────
  function tokenise(text) {
    // Strip trailing punctuation, split on spaces or each character
    const clean = text.replace(/[。？！，、；：""''「」（）【】]/g, '').trim();
    // If spaces exist, split on spaces; otherwise split into chars
    if (clean.includes(' ')) return clean.split(/\s+/).filter(Boolean);
    // For Chinese, split on each character — but keep common two-char words intact
    // Simple: split into characters
    return [...clean];
  }

  function tokeniseChinese(zh) {
    // Use space-delimited if sentence has spaces; otherwise individual chars
    const clean = zh.replace(/[。？！，、；：""''「」（）【】]/g, '').trim();
    if (clean.includes(' ')) return clean.split(/\s+/).filter(Boolean);
    return [...clean];
  }

  function tokeniseEnglish(en) {
    return en.replace(/[.,!?;:'"()]/g, '').toLowerCase().split(/\s+/).filter(Boolean);
  }

  // ── Pick sentence ──────────────────────────────────────────────────────────
  function pickRandomIdx() {
    let idx;
    do { idx = Math.floor(Math.random() * sentences.length); } while (idx === currentIdx && sentences.length > 1);
    return idx;
  }

  function loadSentence(idx) {
    currentIdx = idx;
    checked    = false;
    const sent = sentences[idx];

    if (mode === 'zh') {
      tokens = tokeniseChinese(sent.zh);
      promptLabel.textContent = 'Arrange the Chinese words to match this English:';
      promptText.textContent  = sent.en;
      promptPinyin.textContent = '';
    } else {
      tokens = tokeniseEnglish(sent.en);
      promptLabel.textContent = 'Arrange the English words to match this Chinese:';
      promptText.textContent  = sent.zh;
      promptPinyin.textContent = sent.pinyin;
    }

    slotValues = new Array(tokens.length).fill(null);
    buildBank();
    render();
    hideFeedback();
    saveState();
  }

  // ── Build word bank ────────────────────────────────────────────────────────
  function buildBank() {
    const distractors = pickDistractors(tokens, 20);
    const allWords = shuffle([...tokens, ...distractors]);
    bankWords = allWords.map((w, i) => ({ text: w, id: 'w-' + i }));
  }

  function pickDistractors(correct, count) {
    const pool = [];
    if (mode === 'zh') {
      vocab.forEach(e => { e.sentences?.forEach(s => { tokeniseChinese(s.zh).forEach(t => pool.push(t)); }); });
    } else {
      vocab.forEach(e => { e.sentences?.forEach(s => { tokeniseEnglish(s.en).forEach(t => pool.push(t)); }); });
    }
    const exclude = new Set(correct);
    const candidates = [...new Set(pool)].filter(w => !exclude.has(w));
    return shuffle(candidates).slice(0, count);
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  function render() {
    renderSlots();
    renderBank();
    updateProgress();
  }

  function renderSlots() {
    slotsArea.innerHTML = '';
    slotValues.forEach((val, idx) => {
      const slot = document.createElement('div');
      slot.className = 'slot' + (val ? ' filled' : '');
      slot.dataset.idx = idx;
      slot.textContent = val || '';

      if (checked && val) {
        slot.classList.add(val === tokens[idx] ? 'correct' : 'incorrect');
      }

      if (val) {
        const rm = document.createElement('button');
        rm.className = 'remove-btn';
        rm.textContent = '✕';
        rm.setAttribute('aria-label', 'Remove word');
        rm.addEventListener('click', e => { e.stopPropagation(); removeFromSlot(idx); });
        slot.appendChild(rm);
      }

      // Drop target
      slot.addEventListener('dragover', e => { e.preventDefault(); slot.classList.add('drag-over'); });
      slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
      slot.addEventListener('drop', e => { e.preventDefault(); slot.classList.remove('drag-over'); handleDrop(idx); });

      // Tap to insert (mobile)
      slot.addEventListener('click', () => {
        if (!val) insertNextTap(idx);
      });

      slotsArea.appendChild(slot);
    });
  }

  function renderBank() {
    wordBank.innerHTML = '';
    const usedWords = new Set(slotValues.filter(Boolean));

    bankWords.forEach(w => {
      const chip = document.createElement('div');
      chip.className = 'word-chip' + (usedWords.has(w.text) ? ' used' : '');
      chip.textContent = w.text;
      chip.dataset.wid = w.id;
      chip.draggable = true;

      chip.addEventListener('dragstart', e => {
        dragSourceId = w.id;
        chip.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'copy';
      });
      chip.addEventListener('dragend', () => { chip.classList.remove('dragging'); dragSourceId = null; });

      // Tap on word in bank → insert into first empty slot
      chip.addEventListener('click', () => {
        if (usedWords.has(w.text)) return;
        const firstEmpty = slotValues.findIndex(v => v === null);
        if (firstEmpty !== -1) {
          slotValues[firstEmpty] = w.text;
          checked = false;
          hideFeedback();
          render();
          saveState();
        }
      });

      wordBank.appendChild(chip);
    });
  }

  function handleDrop(slotIdx) {
    if (!dragSourceId) return;
    const word = bankWords.find(w => w.id === dragSourceId);
    if (!word) return;
    slotValues[slotIdx] = word.text;
    checked = false;
    hideFeedback();
    render();
    saveState();
  }

  function removeFromSlot(idx) {
    slotValues[idx] = null;
    checked = false;
    hideFeedback();
    render();
    saveState();
  }

  function insertNextTap(slotIdx) {
    // If clicked directly on a slot, fill it with the last tapped word (noop here — handled by chip click)
  }

  // ── Check / Reveal / Clear / Next ──────────────────────────────────────────
  checkBtn?.addEventListener('click', () => {
    if (slotValues.some(v => v === null)) {
      showFeedback('Fill all slots before checking.', 'incorrect');
      return;
    }
    const allCorrect = slotValues.every((v, i) => v === tokens[i]);
    checked = true;
    render();
    if (allCorrect) {
      showFeedback('✅ Correct! Well done.', 'correct');
      score.correct++;
      score.total++;
    } else {
      showFeedback('❌ Not quite. Red slots show mistakes.', 'incorrect');
      score.total++;
    }
    saveScore();
    updateProgress();
  });

  clearBtn?.addEventListener('click', () => {
    slotValues = new Array(tokens.length).fill(null);
    checked = false;
    hideFeedback();
    render();
    saveState();
  });

  nextBtn?.addEventListener('click', () => {
    loadSentence(pickRandomIdx());
  });

  revealBtn?.addEventListener('click', () => {
    tokens.forEach((t, i) => { slotValues[i] = t; });
    checked = true;
    render();
    showFeedback('Answer revealed: ' + tokens.join(' '), 'incorrect');
  });

  resetBtn?.addEventListener('click', () => {
    score = { correct: 0, total: 0 };
    saveScore();
    updateProgress();
  });

  // ── Feedback bar ───────────────────────────────────────────────────────────
  function showFeedback(msg, type) {
    feedbackBar.textContent = msg;
    feedbackBar.className = 'feedback-bar show ' + type;
  }

  function hideFeedback() {
    feedbackBar.className = 'feedback-bar';
  }

  // ── Progress ───────────────────────────────────────────────────────────────
  function updateProgress() {
    const pct = score.total ? Math.round(score.correct / score.total * 100) : 0;
    if (progressText) progressText.textContent = `${score.correct} / ${score.total} correct (${pct}%)`;
    if (progressFill) progressFill.style.width = pct + '%';
  }

  // ── Persist state ──────────────────────────────────────────────────────────
  function saveState() {
    try {
      localStorage.setItem(STATE_KEY + '-state', JSON.stringify({
        mode, currentIdx, tokens, slotValues, bankWords
      }));
    } catch {}
  }

  function saveScore() {
    try { localStorage.setItem(STATE_KEY + '-score', JSON.stringify(score)); } catch {}
  }

  function loadSaved() {
    try {
      const sc = JSON.parse(localStorage.getItem(STATE_KEY + '-score') || 'null');
      if (sc) score = sc;
      const st = JSON.parse(localStorage.getItem(STATE_KEY + '-state') || 'null');
      if (st && st.currentIdx >= 0 && st.currentIdx < sentences.length) {
        mode        = st.mode || 'zh';
        currentIdx  = st.currentIdx;
        tokens      = st.tokens;
        slotValues  = st.slotValues;
        bankWords   = st.bankWords;
        tabZh?.classList.toggle('active', mode === 'zh');
        tabEn?.classList.toggle('active', mode === 'en');
        const sent = sentences[currentIdx];
        if (mode === 'zh') {
          promptLabel.textContent = 'Arrange the Chinese words to match this English:';
          promptText.textContent  = sent.en;
          promptPinyin.textContent = '';
        } else {
          promptLabel.textContent = 'Arrange the English words to match this Chinese:';
          promptText.textContent  = sent.zh;
          promptPinyin.textContent = sent.pinyin;
        }
        render();
        return true;
      }
    } catch {}
    return false;
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  if (!loadSaved()) {
    loadSentence(pickRandomIdx());
  }
  updateProgress();
});
