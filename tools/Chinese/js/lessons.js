/* lessons.js — dedicated Lessons page
   Renders every lesson in LESSONS_META as a collapsible block of
   attractively-presented vocabulary cards, plus a "jump to lesson"
   dropdown (table of contents) and expand/collapse-all controls.
*/

document.addEventListener('DOMContentLoaded', () => {
  // ── Theme ──────────────────────────────────────────────────────────────────
  const themeBtn = document.getElementById('themeToggle');
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('cv-theme', t);
    if (themeBtn) themeBtn.textContent = t === 'dark' ? '亮' : '暗';
  }
  applyTheme(localStorage.getItem('cv-theme') || 'light');
  themeBtn?.addEventListener('click', () =>
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));

  // ── Mobile sidebar ──────────────────────────────────────────────────────────
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const toggle  = document.getElementById('sidebarToggle');
  toggle?.addEventListener('click', () => { sidebar?.classList.add('open'); overlay?.classList.add('open'); });
  overlay?.addEventListener('click', () => { sidebar?.classList.remove('open'); overlay?.classList.remove('open'); });

  if (typeof LESSONS_META === 'undefined' || typeof vocab === 'undefined') return;

  const isBonus = id => /^bonus/i.test(id);
  const core  = LESSONS_META.filter(l => !isBonus(l.id));
  const bonus = LESSONS_META.filter(l => isBonus(l.id));

  // ── Table-of-contents dropdown (grouped: Textbook vs Bonus) ────────────────
  const toc = document.getElementById('lessonToc');
  if (toc) {
    function fillGroup(label, lessons) {
      if (!lessons.length) return;
      const og = document.createElement('optgroup');
      og.label = label;
      lessons.forEach(lesson => {
        const opt = document.createElement('option');
        opt.value = lesson.id;
        opt.textContent = lesson.name;
        og.appendChild(opt);
      });
      toc.appendChild(og);
    }
    fillGroup('Textbook (Lessons 1–24)', core);
    fillGroup('Bonus (Personal Interests)', bonus);

    toc.addEventListener('change', () => {
      const id = toc.value;
      if (!id) return;
      jumpTo(id);
      toc.selectedIndex = 0; // reset back to placeholder
    });
  }

  function jumpTo(id) {
    const block = document.getElementById('lesson-' + id);
    if (!block) return;
    openBlock(block, true);
    block.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function openBlock(block, open) {
    const trigger = block.querySelector('.accordion-trigger');
    const body    = block.querySelector('.accordion-body');
    trigger?.classList.toggle('open', open);
    body?.classList.toggle('open', open);
  }

  // ── Expand / collapse all ─────────────────────────────────────────────────────
  document.getElementById('expandAll')?.addEventListener('click', () =>
    document.querySelectorAll('.lesson-block').forEach(b => openBlock(b, true)));
  document.getElementById('collapseAll')?.addEventListener('click', () =>
    document.querySelectorAll('.lesson-block').forEach(b => openBlock(b, false)));

  // ── Build lesson blocks (grouped: Textbook vs Bonus) ───────────────────────
  const container = document.getElementById('lessonsContainer');

  function addGroup(label, lessons) {
    if (!lessons.length) return;
    const h = document.createElement('h3');
    h.className = 'lesson-group-heading';
    h.textContent = label;
    container.appendChild(h);
    lessons.forEach(lesson => {
      const entries = lesson.indices.map(i => vocab[i]).filter(Boolean);
      container.appendChild(buildLessonBlock(lesson, entries));
    });
  }
  addGroup('Textbook — Speak Chinese Together 1 (Lessons 1–24)', core);
  addGroup('Bonus — Personal Interests (Not from the Textbook)', bonus);

  function buildLessonBlock(lesson, entries) {
    const wrap = document.createElement('div');
    wrap.className = 'accordion lesson-block' + (isBonus(lesson.id) ? ' is-bonus' : '');
    wrap.id = 'lesson-' + lesson.id;

    const badge = isBonus(lesson.id) ? '<span class="lesson-badge">Bonus</span>' : '';
    const trigger = document.createElement('button');
    trigger.className = 'accordion-trigger';
    trigger.innerHTML = `
      <span>${lesson.name}${badge}
        <span style="color:var(--text-muted);font-weight:400;font-size:0.8rem"> (${entries.length} words)</span>
      </span>
      <span class="accordion-chevron">▼</span>`;

    const body = document.createElement('div');
    body.className = 'accordion-body';
    const grid = document.createElement('div');
    grid.className = 'vocab-card-grid';
    entries.forEach(e => grid.appendChild(buildCard(e)));
    body.appendChild(grid);

    trigger.addEventListener('click', () => {
      const open = trigger.classList.contains('open');
      trigger.classList.toggle('open', !open);
      body.classList.toggle('open', !open);
    });

    wrap.appendChild(trigger);
    wrap.appendChild(body);
    return wrap;
  }

  function buildCard(entry) {
    const card = document.createElement('div');
    card.className = 'vocab-card';
    const ex = entry.sentences?.[0];
    // Lesson is implied by the accordion header, so omit it here → type · HSK.
    const tags = window.VocabMeta ? VocabMeta.metaHtml(entry.tags, { lesson: false }) : '';

    card.innerHTML = `
      <div class="vc-top">
        <span class="vc-hanzi">${entry.hanzi}</span>
        <span class="vc-pinyin">${entry.pinyin || ''}</span>
      </div>
      <div class="vc-def">${entry.definition || ''}</div>
      ${ex ? `<div class="vc-example">
        <div class="ex-zh">${ex.zh}</div>
        <div class="ex-pinyin">${ex.pinyin}</div>
        <div class="ex-en">${ex.en}</div>
      </div>` : ''}
      ${tags ? `<div class="vc-tags">${tags}</div>` : ''}`;
    return card;
  }
});
