/* main.js — accordions, sidebar nav, random sentence, theme toggle */

// ── Theme ──────────────────────────────────────────────────────────────────
(function () {
  const saved = localStorage.getItem('cv-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
})();

document.addEventListener('DOMContentLoaded', () => {

  // ── Theme toggle ──────────────────────────────────────────────────────────
  const themeBtn = document.getElementById('themeToggle');
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('cv-theme', t);
    if (themeBtn) themeBtn.textContent = t === 'dark' ? '☀️' : '🌙';
  }
  applyTheme(localStorage.getItem('cv-theme') || 'light');
  if (themeBtn) themeBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });

  // ── Mobile sidebar ────────────────────────────────────────────────────────
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const toggle  = document.getElementById('sidebarToggle');
  function openSidebar()  { sidebar?.classList.add('open'); overlay?.classList.add('open'); }
  function closeSidebar() { sidebar?.classList.remove('open'); overlay?.classList.remove('open'); }
  toggle?.addEventListener('click', openSidebar);
  overlay?.addEventListener('click', closeSidebar);

  // ── Live entry/sentence counts (avoid hardcoded numbers going stale) ───────
  if (typeof vocab !== 'undefined') {
    document.querySelectorAll('#countVocab, #countVocab2').forEach(el => el.textContent = vocab.length);
  }
  if (typeof sentences !== 'undefined') {
    document.querySelectorAll('#countSentences').forEach(el => el.textContent = sentences.length);
  }

  // ── Random sentence ───────────────────────────────────────────────────────
  const zhEl  = document.getElementById('randomZh');
  const pyEl  = document.getElementById('randomPinyin');
  const enEl  = document.getElementById('randomEn');
  const newBtn = document.getElementById('refreshSentence');

  function pickRandom() {
    if (!sentences?.length) return;
    const s = sentences[Math.floor(Math.random() * sentences.length)];
    if (zhEl) zhEl.textContent = s.zh;
    if (pyEl) pyEl.textContent = s.pinyin;
    if (enEl) enEl.textContent = s.en;
  }

  if (newBtn) newBtn.addEventListener('click', pickRandom);
  pickRandom();

  // ── Build sidebar lesson links (grouped: Textbook vs Bonus) ────────────────
  const sidebarLessons = document.getElementById('sidebarLessons');
  if (sidebarLessons && typeof LESSONS_META !== 'undefined') {
    const core  = LESSONS_META.filter(l => l.group !== 'bonus');
    const bonus = LESSONS_META.filter(l => l.group === 'bonus');

    function addLessonLink(lesson) {
      const a = document.createElement('button');
      a.className = 'sidebar-link';
      a.dataset.lesson = lesson.id;
      a.innerHTML = `<span class="icon">📝</span> ${lesson.name}`;
      a.addEventListener('click', () => {
        closeSidebar();
        const el = document.getElementById('lesson-' + lesson.id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          const trigger = el.querySelector('.accordion-trigger');
          if (trigger && !trigger.classList.contains('open')) trigger.click();
        }
      });
      sidebarLessons.appendChild(a);
    }

    if (core.length) {
      const label = document.createElement('div');
      label.className = 'sidebar-section-label';
      label.textContent = 'Textbook (Lessons 1–24)';
      sidebarLessons.appendChild(label);
      core.forEach(addLessonLink);
    }
    if (bonus.length) {
      const label = document.createElement('div');
      label.className = 'sidebar-section-label';
      label.style.marginTop = '8px';
      label.textContent = 'Bonus (Personal Interests)';
      sidebarLessons.appendChild(label);
      bonus.forEach(addLessonLink);
    }
  }

  // ── Build accordions (grouped: Textbook vs Bonus) ──────────────────────────
  const group = document.getElementById('accordionGroup');
  if (group && typeof LESSONS_META !== 'undefined' && typeof vocab !== 'undefined') {
    const core  = LESSONS_META.filter(l => l.group !== 'bonus');
    const bonus = LESSONS_META.filter(l => l.group === 'bonus');

    function addAccordions(lessons) {
      lessons.forEach(lesson => {
        const entries = lesson.indices.map(i => vocab[i]);
        group.appendChild(buildAccordion(lesson, entries));
      });
    }

    if (core.length) {
      const h = document.createElement('h3');
      h.className = 'lesson-group-heading';
      h.textContent = '📘 Textbook — Speak Chinese Together 1 (Lessons 1–24)';
      group.appendChild(h);
      addAccordions(core);
    }
    if (bonus.length) {
      const h = document.createElement('h3');
      h.className = 'lesson-group-heading';
      h.textContent = '🛠️ Bonus — Personal Interests (Not from the Textbook)';
      group.appendChild(h);
      addAccordions(bonus);
    }
  }

});

// ── Accordion builder ─────────────────────────────────────────────────────────
function buildAccordion(lesson, entries) {
  const wrap = document.createElement('div');
  wrap.className = 'accordion';
  wrap.id = 'lesson-' + lesson.id;

  const trigger = document.createElement('button');
  trigger.className = 'accordion-trigger';
  trigger.innerHTML = `
    <span>${lesson.name} <span style="color:var(--text-muted);font-weight:400;font-size:0.8rem">(${entries.length} words)</span></span>
    <span class="accordion-chevron">▼</span>`;

  const body = document.createElement('div');
  body.className = 'accordion-body';
  body.appendChild(buildVocabTable(entries));

  trigger.addEventListener('click', () => {
    const isOpen = trigger.classList.contains('open');
    trigger.classList.toggle('open', !isOpen);
    body.classList.toggle('open', !isOpen);
  });

  wrap.appendChild(trigger);
  wrap.appendChild(body);
  return wrap;
}

// ── Vocab table builder ───────────────────────────────────────────────────────
function buildVocabTable(entries) {
  const table = document.createElement('table');
  table.className = 'vocab-table';

  const thead = document.createElement('thead');
  thead.innerHTML = `<tr>
    <th data-col="hanzi">Hanzi <span class="sort-indicator">↕</span></th>
    <th data-col="pinyin">Pinyin <span class="sort-indicator">↕</span></th>
    <th data-col="definition">Definition <span class="sort-indicator">↕</span></th>
    <th>Example</th>
    <th>Tags</th>
  </tr>`;
  table.appendChild(thead);

  let sortCol = null, sortDir = 1;

  function renderRows(data) {
    const tbody = table.querySelector('tbody') || document.createElement('tbody');
    tbody.innerHTML = '';
    data.forEach(entry => {
      const tr = document.createElement('tr');
      const ex = entry.sentences?.[0];
      const tags = entry.tags || [];

      const tagHtml = tags.map(t => {
        let cls = '';
        if (t.startsWith('type:')) cls = 'type';
        else if (t.startsWith('hsk:')) cls = 'hsk';
        else if (t.startsWith('topic:')) cls = 'topic';
        return `<span class="tag-chip ${cls}">${t}</span>`;
      }).join('');

      tr.innerHTML = `
        <td class="cell-hanzi">${entry.hanzi}</td>
        <td class="cell-pinyin">${entry.pinyin}</td>
        <td class="cell-def">${entry.definition}</td>
        <td class="cell-example">${ex
          ? `<div class="ex-zh">${ex.zh}</div>
             <div class="ex-pinyin">${ex.pinyin}</div>
             <div class="ex-en">${ex.en}</div>`
          : ''}</td>
        <td class="cell-tags">${tagHtml}</td>`;
      tbody.appendChild(tr);
    });
    if (!table.querySelector('tbody')) table.appendChild(tbody);
  }

  renderRows(entries);

  // Sorting
  thead.querySelectorAll('th[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (sortCol === col) { sortDir *= -1; } else { sortCol = col; sortDir = 1; }
      thead.querySelectorAll('th').forEach(t => t.classList.remove('sorted'));
      th.classList.add('sorted');
      th.querySelector('.sort-indicator').textContent = sortDir === 1 ? '↑' : '↓';
      const sorted = [...entries].sort((a, b) =>
        (a[col] || '').localeCompare(b[col] || '', 'zh') * sortDir);
      renderRows(sorted);
    });
  });

  return table;
}
