/* Sheet: cards or tokens laid out N-up on a page with crop marks, ready to
   print and cut. Uses Bench.cards.render for card faces and backs. */
(function () {
  'use strict';
  var B = window.Bench;

  var PAGES = { a4: { name: 'A4', w: 210, h: 297 }, letter: { name: 'Letter', w: 216, h: 279 } };
  var MARGIN = 10, GAP = 5, CARD_MARGIN = 5;
  var DEFAULT = { page: 'a4', what: 'cards', type: '', count: 9, backs: false, guides: true, tokenShape: 'circle', tokenMm: 20, tokenCount: 40 };

  var el, store = B.store, ui = {};
  function state() { return Object.assign({}, DEFAULT, store.get('sheet') || {}); }
  function save(patch) { store.set('sheet', Object.assign(state(), patch)); }
  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

  /* ---------- layout maths ---------- */
  function fit(page, itemW, itemH) {
    var cols = Math.max(1, Math.floor((page.w - 2 * MARGIN + GAP) / (itemW + GAP)));
    var rows = Math.max(1, Math.floor((page.h - 2 * MARGIN + GAP) / (itemH + GAP)));
    var usedW = cols * itemW + (cols - 1) * GAP, usedH = rows * itemH + (rows - 1) * GAP;
    return { cols: cols, rows: rows, x0: (page.w - usedW) / 2, y0: (page.h - usedH) / 2, per: cols * rows };
  }

  /* ---------- pages as SVG ----------
     Cards share bleed: neighbours overlap by one bleed width, so 3 × 3 poker
     cards fit A4. Cut guides sit in the page margins at every trim line. */
  function cardFit(page, size, bl) {
    var cols = Math.max(1, Math.floor((page.w - 2 * CARD_MARGIN + bl) / (size.w + bl)));
    var rows = Math.max(1, Math.floor((page.h - 2 * CARD_MARGIN + bl) / (size.h + bl)));
    return { cols: cols, rows: rows, per: cols * rows,
      x0: (page.w - (cols * size.w + (cols - 1) * bl)) / 2, y0: (page.h - (rows * size.h + (rows - 1) * bl)) / 2 };
  }
  function cardPages(st) {
    var cs = B.cards.state(), size = B.cards.sizeOf(cs), bl = B.cards.BLEED;
    var type = cs.types.find(function (t) { return t.name === st.type; }) || cs.types[0] || null;
    var layout = type ? type.layout : cs.layout, colour = type ? type.colour : '--brass', name = type ? type.name : 'Card';
    var page = PAGES[st.page], f = cardFit(page, size, bl);
    var count = Math.max(1, Math.min(200, st.count)), pages = [];
    var face = B.cards.render(layout, size, { colour: colour, labels: false, guides: st.guides });
    var back = B.cards.render(layout, size, { colour: colour, back: true, name: name });
    var ink = cssVar('--ink');
    for (var p = 0; p < Math.ceil(count / f.per); p++) {
      var n = Math.min(f.per, count - p * f.per);
      pages.push(cardPageSVG(page, f, size, bl, n, face, ink, false));
      if (st.backs) pages.push(cardPageSVG(page, f, size, bl, n, back, ink, true));
    }
    return { pages: pages, per: f.per, cols: f.cols, rows: f.rows, name: name, total: count };
  }
  function cardPageSVG(page, f, size, bl, n, item, ink, mirrored) {
    var iw = size.w + 2 * bl, ih = size.h + 2 * bl, inner = item.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + page.w + ' ' + page.h + '" class="sheet-page"><rect width="' + page.w + '" height="' + page.h + '" fill="#fff"/>';
    for (var i = 0; i < n; i++) {
      var c = i % f.cols, r = Math.floor(i / f.cols);
      if (mirrored) c = f.cols - 1 - c;
      var tx = f.x0 + c * (size.w + bl), ty = f.y0 + r * (size.h + bl);
      s += '<svg x="' + (tx - bl) + '" y="' + (ty - bl) + '" width="' + iw + '" height="' + ih + '" viewBox="0 0 ' + iw + ' ' + ih + '">' + inner + '</svg>';
    }
    // cut guides in the margins, one per trim line
    var m = CARD_MARGIN, g = '<g stroke="' + ink + '" stroke-width="0.2">';
    for (var cc = 0; cc < f.cols; cc++) [f.x0 + cc * (size.w + bl), f.x0 + cc * (size.w + bl) + size.w].forEach(function (x) {
      g += '<line x1="' + x + '" y1="1" x2="' + x + '" y2="' + (m - 2) + '"/><line x1="' + x + '" y1="' + (page.h - m + 2) + '" x2="' + x + '" y2="' + (page.h - 1) + '"/>';
    });
    for (var rr = 0; rr < f.rows; rr++) [f.y0 + rr * (size.h + bl), f.y0 + rr * (size.h + bl) + size.h].forEach(function (y) {
      g += '<line x1="1" y1="' + y + '" x2="' + (m - 2) + '" y2="' + y + '"/><line x1="' + (page.w - m + 2) + '" y1="' + y + '" x2="' + (page.w - 1) + '" y2="' + y + '"/>';
    });
    return s + g + '</g></svg>';
  }
  function tokenPages(st) {
    var page = PAGES[st.page], mm = Math.max(8, Math.min(80, st.tokenMm)), f = fit(page, mm, mm);
    var count = Math.max(1, Math.min(400, st.tokenCount)), pages = [], ink = cssVar('--ink'), faint = cssVar('--ink-faint');
    for (var p = 0; p < Math.ceil(count / f.per); p++) {
      var n = Math.min(f.per, count - p * f.per);
      var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + page.w + ' ' + page.h + '" class="sheet-page"><rect width="' + page.w + '" height="' + page.h + '" fill="#fff"/>';
      for (var i = 0; i < n; i++) {
        var c = i % f.cols, r = Math.floor(i / f.cols), x = f.x0 + c * (mm + GAP), y = f.y0 + r * (mm + GAP);
        if (st.tokenShape === 'circle') s += '<circle cx="' + (x + mm / 2) + '" cy="' + (y + mm / 2) + '" r="' + (mm / 2) + '" fill="none" stroke="' + ink + '" stroke-width="0.25"/>';
        else if (st.tokenShape === 'hex') s += '<polygon points="' + hexPts(x + mm / 2, y + mm / 2, mm / 2) + '" fill="none" stroke="' + ink + '" stroke-width="0.25"/>';
        else s += '<rect x="' + x + '" y="' + y + '" width="' + mm + '" height="' + mm + '" rx="' + (mm * 0.08) + '" fill="none" stroke="' + ink + '" stroke-width="0.25"/>';
        s += '<circle cx="' + (x + mm / 2) + '" cy="' + (y + mm / 2) + '" r="0.4" fill="' + faint + '"/>';
      }
      pages.push(s + '</svg>');
    }
    return { pages: pages, per: f.per, cols: f.cols, rows: f.rows, name: mm + ' mm ' + st.tokenShape, total: count };
  }
  function hexPts(cx, cy, r) {
    var p = []; for (var i = 0; i < 6; i++) { var a = Math.PI / 3 * i - Math.PI / 6; p.push((cx + r * Math.cos(a)).toFixed(2) + ',' + (cy + r * Math.sin(a)).toFixed(2)); }
    return p.join(' ');
  }

  /* ---------- mount ---------- */
  function mount(root) {
    el = root;
    var st = state(), cs = B.cards.state();
    el.innerHTML =
      '<div class="tool-grid sheet-grid">' +
        '<section class="panel">' +
          '<p class="kicker">Sheet</p>' +
          '<h2>Print and cut</h2>' +
          '<p>Cards share their 3 mm bleed with their neighbours, so a page holds more. The ticks in the margins line up with every cut. Print at 100%, never “fit to page”.</p>' +
          '<div class="label">What</div>' +
          '<div class="seg" role="group" aria-label="What to print"><button type="button" data-what="cards"' + (st.what === 'cards' ? ' class="on"' : '') + '>Cards</button><button type="button" data-what="tokens"' + (st.what === 'tokens' ? ' class="on"' : '') + '>Tokens</button></div>' +
          '<div class="label" style="margin-top:12px">Paper</div>' +
          '<div class="seg" role="group" aria-label="Paper"><button type="button" data-page="a4"' + (st.page === 'a4' ? ' class="on"' : '') + '>A4</button><button type="button" data-page="letter"' + (st.page === 'letter' ? ' class="on"' : '') + '>Letter</button></div>' +
          '<div class="sheet-cards">' +
            '<div class="field" style="margin-top:12px"><label for="sh-type">Card kind</label><select id="sh-type" class="input" data-type>' +
              (cs.types.length ? cs.types.map(function (t) { return '<option' + (t.name === st.type ? ' selected' : '') + '>' + B.esc(t.name) + '</option>'; }).join('') : '<option value="">Current layout (nothing locked yet)</option>') +
            '</select></div>' +
            '<div class="sheet-row"><div class="field"><label for="sh-count">How many</label><input id="sh-count" class="input mono" type="number" min="1" max="200" value="' + st.count + '" data-count></div>' +
            '<label class="sheet-check"><input type="checkbox" data-backs' + (st.backs ? ' checked' : '') + '> Mirrored back sheet after each page</label></div>' +
            '<label class="sheet-check"><input type="checkbox" data-guides' + (st.guides ? ' checked' : '') + '> Show the safe-area guide (off for final cards)</label>' +
          '</div>' +
          '<div class="sheet-tokens">' +
            '<div class="label" style="margin-top:12px">Shape</div>' +
            '<div class="seg" role="group" aria-label="Token shape">' + ['circle', 'square', 'hex'].map(function (k) { return '<button type="button" data-shape="' + k + '"' + (st.tokenShape === k ? ' class="on"' : '') + '>' + k + '</button>'; }).join('') + '</div>' +
            '<div class="sheet-row"><div class="field"><label for="sh-mm">Size, mm</label><input id="sh-mm" class="input mono" type="number" min="8" max="80" value="' + st.tokenMm + '" data-mm></div>' +
            '<div class="field"><label for="sh-tc">How many</label><input id="sh-tc" class="input mono" type="number" min="1" max="400" value="' + st.tokenCount + '" data-tcount></div></div>' +
          '</div>' +
          '<p class="sheet-summary muted"></p>' +
          '<div class="btn-row"><button class="btn" type="button" data-print>Print</button><button class="btn paper sm" type="button" data-png>First page (PNG)</button></div>' +
        '</section>' +
        '<section class="panel"><p class="kicker">Preview</p><div class="sheet-preview"></div></section>' +
      '</div>';
    ui.preview = el.querySelector('.sheet-preview');
    ui.summary = el.querySelector('.sheet-summary');
    el.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var d = b.dataset, patch = null;
      if (d.what) patch = { what: d.what }; if (d.page) patch = { page: d.page }; if (d.shape) patch = { tokenShape: d.shape };
      if (patch) { b.parentNode.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); save(patch); draw(); }
    });
    el.addEventListener('input', function (e) {
      var d = e.target.dataset;
      if (d.count != null) save({ count: parseInt(e.target.value, 10) || 1 });
      if (d.mm != null) save({ tokenMm: parseInt(e.target.value, 10) || 20 });
      if (d.tcount != null) save({ tokenCount: parseInt(e.target.value, 10) || 1 });
      if (d.type != null) save({ type: e.target.value });
      if (d.backs != null) save({ backs: e.target.checked });
      if (d.guides != null) save({ guides: e.target.checked });
      draw();
    });
    el.querySelector('[data-print]').addEventListener('click', function () {
      var out = build(), page = PAGES[state().page];
      var sec = B.el('<section class="sheet-print"><style>@page{size:' + page.name + ';margin:0}.sheet-print svg{width:' + page.w + 'mm;height:' + page.h + 'mm;display:block;page-break-after:always}</style>' + out.pages.join('') + '</section>');
      B.printSection(sec);
    });
    el.querySelector('[data-png]').addEventListener('click', function () {
      var tmp = B.el('<div>' + build().pages[0] + '</div>'); B.downloadPNG(tmp.firstChild, 'sheet.png');
    });
    draw();
  }
  function unmount() { el = null; ui = {}; }
  function build() { return state().what === 'cards' ? cardPages(state()) : tokenPages(state()); }
  function draw() {
    var st = state();
    el.querySelector('.sheet-cards').hidden = st.what !== 'cards';
    el.querySelector('.sheet-tokens').hidden = st.what !== 'tokens';
    var out = build();
    ui.summary.textContent = out.cols + ' × ' + out.rows + ' = ' + out.per + ' per page · ' + out.total + ' ' + (st.what === 'cards' ? out.name + ' cards' : out.name + ' tokens') + ' · ' + out.pages.length + ' page' + (out.pages.length === 1 ? '' : 's');
    ui.preview.innerHTML = out.pages.slice(0, 2).join('') + (out.pages.length > 2 ? '<p class="muted">… and ' + (out.pages.length - 2) + ' more.</p>' : '');
  }

  B.register({ id: 'sheet', title: 'Sheet', blurb: 'Cards and tokens, N-up with crop marks.', mount: mount, unmount: unmount });
})();
