/* format.js — turn raw tag strings into a clean small-caps metadata line.
   Loaded before main.js / lessons.js / glossary.js. Display only; the
   filtering logic still reads entry.tags directly, so filters are unaffected. */

(function (global) {
  const DIGITS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

  function cnNum(n) {
    if (n <= 10) return DIGITS[n];
    if (n < 20)  return '十' + DIGITS[n - 10];
    if (n === 20) return '二十';
    if (n < 30)  return '二十' + DIGITS[n - 20];
    return String(n);
  }

  // lesson5 → 第五课 · bonus3 → 补充三
  function lessonLabel(id) {
    let m = id.match(/^lesson(\d+)$/);
    if (m) return '第' + cnNum(+m[1]) + '课';
    m = id.match(/^bonus(\d+)$/);
    if (m) return '补充' + cnNum(+m[1]);
    return id;
  }

  // tags[] → ['第五课', 'verb', 'HSK 2']  (lesson optional)
  function metaParts(tags, opts = {}) {
    const parts = [];
    if (opts.lesson !== false) {
      const l = (tags || []).find(t => t.startsWith('lesson:'));
      if (l) parts.push(lessonLabel(l.slice(7)));
    }
    const types = (tags || []).filter(t => t.startsWith('type:')).map(t => t.slice(5));
    if (types.length) parts.push(types.join('/'));
    const hsk = (tags || []).find(t => t.startsWith('hsk:'));
    if (hsk) parts.push('HSK ' + hsk.slice(4));
    return parts;
  }

  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // tags[] → '<span class="tag-chip">第五课</span><span class="tag-chip">verb</span>…'
  function metaHtml(tags, opts) {
    return metaParts(tags, opts).map(p => `<span class="tag-chip">${esc(p)}</span>`).join('');
  }

  global.VocabMeta = { cnNum, lessonLabel, metaParts, metaHtml };
})(window);
