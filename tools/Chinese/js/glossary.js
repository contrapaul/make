/* glossary.js — live search + filter for the glossary page */

document.addEventListener('DOMContentLoaded', () => {
  if (typeof vocab === 'undefined') return;

  document.querySelectorAll('#countVocab').forEach(el => el.textContent = vocab.length);

  const searchInput   = document.getElementById('searchInput');
  const filterLesson  = document.getElementById('filterLesson');
  const filterType    = document.getElementById('filterType');
  const filterTopic   = document.getElementById('filterTopic');
  const filterHsk     = document.getElementById('filterHsk');
  const clearBtn      = document.getElementById('clearFilters');
  const resultsCount  = document.getElementById('resultsCount');
  const tbody         = document.getElementById('glossaryBody');
  const thead         = document.querySelector('#glossaryTable thead');

  // ── Populate filter dropdowns from data ────────────────────────────────────
  const lessons = new Set(), types = new Set(), topics = new Set(), hsks = new Set();
  vocab.forEach(e => {
    e.tags.forEach(t => {
      if (t.startsWith('lesson:'))    lessons.add(t.slice(7));
      else if (t.startsWith('type:')) types.add(t.slice(5));
      else if (t.startsWith('hsk:'))  hsks.add(t.slice(4));
      else if (t.startsWith('topic:')) {
        t.slice(6).split(',').forEach(tp => topics.add(tp.trim()));
      }
    });
  });

  // Sort lessons sensibly: lesson1 < lesson2 ... < bonus1 < bonus2 ...
  const lessonOrder = [...lessons].sort((a, b) => {
    const aIsBonus = a.startsWith('bonus'), bIsBonus = b.startsWith('bonus');
    if (!aIsBonus && bIsBonus) return -1;
    if (aIsBonus && !bIsBonus) return 1;
    return a.localeCompare(b, undefined, { numeric: true });
  });

  // Build option helper
  function addOptions(select, values, labelFn) {
    values.forEach(v => {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = labelFn ? labelFn(v) : v;
      select.appendChild(o);
    });
  }

  function lessonLabel(v) {
    const meta = (typeof LESSONS_META !== 'undefined') &&
      LESSONS_META.find(m => m.id === v);
    return meta ? meta.name : v;
  }

  // Lesson filter: grouped into Textbook (1-24) vs Bonus (Personal Interests)
  // so the two don't get visually confused in one long flat list.
  const coreLessons  = lessonOrder.filter(v => !v.startsWith('bonus'));
  const bonusLessons = lessonOrder.filter(v => v.startsWith('bonus'));
  function addOptGroup(select, label, values, labelFn) {
    if (!values.length) return;
    const og = document.createElement('optgroup');
    og.label = label;
    addOptions(og, values, labelFn);
    select.appendChild(og);
  }
  addOptGroup(filterLesson, 'Textbook (Lessons 1–24)', coreLessons, lessonLabel);
  addOptGroup(filterLesson, 'Bonus (Personal Interests)', bonusLessons, lessonLabel);

  addOptions(filterType,   [...types].sort(),  v => v);
  addOptions(filterTopic,  [...topics].sort(), v => v);
  addOptions(filterHsk,    [...hsks].sort((a,b)=>+a-+b), v => `HSK ${v}`);

  // ── Restore state from URL hash ────────────────────────────────────────────
  function stateFromHash() {
    const p = new URLSearchParams(window.location.hash.slice(1));
    if (searchInput)  searchInput.value  = p.get('q')      || '';
    if (filterLesson) filterLesson.value = p.get('lesson')  || '';
    if (filterType)   filterType.value   = p.get('type')    || '';
    if (filterTopic)  filterTopic.value  = p.get('topic')   || '';
    if (filterHsk)    filterHsk.value    = p.get('hsk')     || '';
  }

  function stateToHash() {
    const p = new URLSearchParams();
    if (searchInput?.value)  p.set('q',      searchInput.value);
    if (filterLesson?.value) p.set('lesson',  filterLesson.value);
    if (filterType?.value)   p.set('type',    filterType.value);
    if (filterTopic?.value)  p.set('topic',   filterTopic.value);
    if (filterHsk?.value)    p.set('hsk',     filterHsk.value);
    const s = p.toString();
    history.replaceState(null, '', s ? '#' + s : location.pathname);
  }

  stateFromHash();

  // ── Sorting state ──────────────────────────────────────────────────────────
  let sortCol = null, sortDir = 1;

  // ── Render ─────────────────────────────────────────────────────────────────
  function render() {
    const q      = (searchInput?.value  || '').toLowerCase().trim();
    const lesson = filterLesson?.value  || '';
    const type   = filterType?.value    || '';
    const topic  = filterTopic?.value   || '';
    const hsk    = filterHsk?.value     || '';

    let filtered = vocab.filter(e => {
      if (q && !e.hanzi.includes(q) &&
               !e.pinyin.toLowerCase().includes(q) &&
               !e.definition.toLowerCase().includes(q)) return false;
      if (lesson && !e.tags.some(t => t === 'lesson:' + lesson)) return false;
      if (type   && !e.tags.some(t => t === 'type:' + type))     return false;
      if (hsk    && !e.tags.some(t => t === 'hsk:' + hsk))       return false;
      if (topic  && !e.tags.some(t =>
        t.startsWith('topic:') && t.slice(6).split(',').map(x=>x.trim()).includes(topic)
      )) return false;
      return true;
    });

    if (sortCol) {
      filtered = filtered.slice().sort((a, b) =>
        (a[sortCol] || '').localeCompare(b[sortCol] || '', 'zh') * sortDir);
    }

    if (resultsCount) resultsCount.textContent = `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`;

    tbody.innerHTML = '';
    filtered.forEach(entry => {
      const ex = entry.sentences?.[0];
      const tagHtml = window.VocabMeta ? VocabMeta.metaHtml(entry.tags) : '';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="cell-hanzi">${escHtml(entry.hanzi)}</td>
        <td class="cell-pinyin">${escHtml(entry.pinyin)}</td>
        <td class="cell-def">${escHtml(entry.definition)}</td>
        <td class="cell-example">${ex
          ? `<div class="ex-zh">${escHtml(ex.zh)}</div>
             <div class="ex-pinyin">${escHtml(ex.pinyin)}</div>
             <div class="ex-en">${escHtml(ex.en)}</div>`
          : ''}</td>
        <td class="cell-tags">${tagHtml}</td>`;
      tbody.appendChild(tr);
    });

    stateToHash();
  }

  // ── Sort on column header click ────────────────────────────────────────────
  thead?.querySelectorAll('th[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      sortDir = (sortCol === col) ? sortDir * -1 : 1;
      sortCol = col;
      thead.querySelectorAll('th').forEach(t => { t.classList.remove('sorted'); t.querySelector('.sort-indicator').textContent = '↕'; });
      th.classList.add('sorted');
      th.querySelector('.sort-indicator').textContent = sortDir === 1 ? '↑' : '↓';
      render();
    });
  });

  // ── Event listeners ────────────────────────────────────────────────────────
  [searchInput, filterLesson, filterType, filterTopic, filterHsk].forEach(el => {
    el?.addEventListener('input', render);
    el?.addEventListener('change', render);
  });

  clearBtn?.addEventListener('click', () => {
    if (searchInput)  searchInput.value  = '';
    if (filterLesson) filterLesson.value = '';
    if (filterType)   filterType.value   = '';
    if (filterTopic)  filterTopic.value  = '';
    if (filterHsk)    filterHsk.value    = '';
    sortCol = null; sortDir = 1;
    thead?.querySelectorAll('th .sort-indicator').forEach(el => el.textContent = '↕');
    thead?.querySelectorAll('th').forEach(t => t.classList.remove('sorted'));
    render();
  });

  window.addEventListener('hashchange', () => { stateFromHash(); render(); });

  render();
});

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
