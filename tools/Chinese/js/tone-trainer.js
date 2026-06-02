/* tone-trainer.js — fill-in-blank tone recognition quiz */

document.addEventListener('DOMContentLoaded', () => {
  if (typeof vocab === 'undefined') return;

  // ── Tone tables ────────────────────────────────────────────────────────────
  // Maps tone-marked vowel → [base, tone number]
  const MARK_TO_BASE = {
    'ā':'a1','á':'a2','ǎ':'a3','à':'a4',
    'ē':'e1','é':'e2','ě':'e3','è':'e4',
    'ī':'i1','í':'i2','ǐ':'i3','ì':'i4',
    'ō':'o1','ó':'o2','ǒ':'o3','ò':'o4',
    'ū':'u1','ú':'u2','ǔ':'u3','ù':'u4',
    'ǖ':'ü1','ǘ':'ü2','ǚ':'ü3','ǜ':'ü4',
  };

  // Maps base vowel + tone → marked vowel
  const BASE_TO_MARK = {};
  for (const [mark, bt] of Object.entries(MARK_TO_BASE)) {
    BASE_TO_MARK[bt] = mark;
  }

  // Strip ALL tone marks from a pinyin string → plain ASCII syllable
  function stripToneMarks(py) {
    let s = py;
    for (const [mark, bt] of Object.entries(MARK_TO_BASE)) {
      s = s.split(mark).join(bt[0]); // replace mark with plain vowel
    }
    return s;
  }

  // Extract first syllable from pinyin and return {base, tone}
  // "jìshù" → {base:"ji", tone:4}   "mā" → {base:"ma", tone:1}
  function firstSyllableNumbered(pinyin) {
    const syl = pinyin.trim().split(/\s+/)[0]; // first space-delimited syllable
    let tone = 5, base = syl;
    for (const [mark, bt] of Object.entries(MARK_TO_BASE)) {
      if (base.includes(mark)) {
        tone = parseInt(bt[bt.length - 1]);
        base = base.replace(mark, bt[0]); // replace just first occurrence
        break;
      }
    }
    // Strip any remaining tone marks (e.g. second vowel in syllable)
    base = stripToneMarks(base);
    return { base, tone };
  }

  // Apply tone mark to a plain base syllable: applyTone("ma", 3) → "mǎ"
  function applyTone(base, tone) {
    if (tone === 5) return base;
    // Priority: a/e first, then ou → o, then last vowel
    const vowels = 'aeiouü';
    const s = base;
    if (/[ae]/.test(s)) return s.replace(/[ae]/, m => BASE_TO_MARK[m + tone] ?? m);
    if (/ou/.test(s))   return s.replace('o', BASE_TO_MARK['o' + tone] ?? 'o');
    for (let i = s.length - 1; i >= 0; i--) {
      if (vowels.includes(s[i])) {
        const marked = BASE_TO_MARK[s[i] + tone];
        if (marked) return s.slice(0, i) + marked + s.slice(i + 1);
      }
    }
    return s;
  }

  // Convert a base+toneNumber string like "ma3" → "mǎ"
  function numberToMarked(str) {
    const m = str.match(/^([a-züA-ZÜ]+)([1-5])$/);
    if (!m) return str;
    return applyTone(m[1].toLowerCase(), parseInt(m[2]));
  }

  // ── Build question pool ────────────────────────────────────────────────────
  // Each question: pick a vocab entry with pinyin + a sentence containing the hanzi
  const pool = [];
  vocab.forEach(entry => {
    if (!entry.pinyin) return;
    const { base, tone } = firstSyllableNumbered(entry.pinyin);
    if (!base || base.length < 1) return;
    // Need at least one sentence where the hanzi appears
    const validSents = (entry.sentences || []).filter(s => s.zh && s.zh.includes(entry.hanzi));
    if (!validSents.length) return;
    pool.push({ entry, validSents, base, tone });
  });

  if (!pool.length) {
    document.getElementById('trainerSentence').textContent = 'No questions available.';
    return;
  }

  // ── State ──────────────────────────────────────────────────────────────────
  let score = { correct: 0, total: 0 };
  let answered = false;
  let lastIdx = -1;

  const sentenceEl = document.getElementById('trainerSentence');
  const pinyinHint = document.getElementById('trainerPinyinHint');
  const optionsEl  = document.getElementById('trainerOptions');
  const feedbackEl = document.getElementById('trainerFeedback');
  const scoreEl    = document.getElementById('trainerScore');
  const nextBtn    = document.getElementById('trainerNext');
  const resetBtn   = document.getElementById('trainerReset');

  // ── Pick & render question ─────────────────────────────────────────────────
  function pickQuestion() {
    let idx;
    do { idx = Math.floor(Math.random() * pool.length); }
    while (idx === lastIdx && pool.length > 1);
    lastIdx = idx;
    return pool[idx];
  }

  function buildOptions(base, correctTone) {
    // 3 wrong tones from {1,2,3,4} (or 5 for neutral) excluding correct
    const otherTones = [1, 2, 3, 4].filter(t => t !== correctTone);
    const wrongTones = shuffle(otherTones).slice(0, 3);
    return shuffle([correctTone, ...wrongTones]);
  }

  function load() {
    answered = false;
    hideFeedback();
    pinyinHint.textContent = ''; // hide hint until answered

    const { entry, validSents, base, tone: correctTone } = pickQuestion();
    const sent = validSents[Math.floor(Math.random() * validSents.length)];

    // Build blanked sentence HTML
    const blanked = sent.zh.replace(entry.hanzi,
      `<span class="trainer-blank">___</span>`);
    sentenceEl.innerHTML = blanked;

    // Options: show as tone-marked pinyin
    const tones = buildOptions(base, correctTone);
    optionsEl.innerHTML = '';
    tones.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'trainer-option';
      btn.textContent = numberToMarked(base + t); // e.g. "mǎ"
      btn.dataset.tone = t;
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const isCorrect = (t === correctTone);
        score.total++;
        if (isCorrect) score.correct++;

        optionsEl.querySelectorAll('.trainer-option').forEach(b => {
          b.disabled = true;
          if (+b.dataset.tone === correctTone) b.classList.add('correct');
          else if (b === btn && !isCorrect) b.classList.add('incorrect');
        });

        // Reveal pinyin hint after answering
        pinyinHint.textContent = `${entry.hanzi} = ${entry.pinyin} (${entry.definition}) — sentence: ${sent.pinyin}`;

        if (isCorrect) {
          showFeedback(`✅ Correct! ${numberToMarked(base + correctTone)} — ${entry.definition}`, 'correct');
        } else {
          showFeedback(
            `❌ It's ${numberToMarked(base + correctTone)} (tone ${correctTone}) — ${entry.hanzi} = ${entry.pinyin}`,
            'incorrect'
          );
        }
        updateScore();
      });
      optionsEl.appendChild(btn);
    });

    updateScore();
  }

  function showFeedback(msg, type) {
    feedbackEl.textContent = msg;
    feedbackEl.className = 'trainer-feedback show ' + type;
  }

  function hideFeedback() {
    feedbackEl.className = 'trainer-feedback';
  }

  function updateScore() {
    const pct = score.total ? Math.round(score.correct / score.total * 100) : 0;
    if (scoreEl) scoreEl.textContent = `Score: ${score.correct} / ${score.total} (${pct}%)`;
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  nextBtn?.addEventListener('click', load);
  resetBtn?.addEventListener('click', () => {
    score = { correct: 0, total: 0 };
    updateScore();
    load();
  });

  load();
});
