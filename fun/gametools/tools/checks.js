/* Checks: three small graphic sanity checks. Type size for a reading
   distance, a palette under colour-blindness, and printable grid paper. */
(function () {
  'use strict';
  var B = window.Bench;
  var PX_PER_MM = 96 / 25.4, PT = 0.3528;
  var DEFAULT = { distance: 70, colours: ['#c4204f', '#d9a23a', '#2a6a48', '#3c5a72', '#6d2f8a'], grid: 'hex', cell: 25, page: 'a4' };
  var PAGES = { a4: { name: 'A4', w: 210, h: 297 }, letter: { name: 'Letter', w: 216, h: 279 } };
  // Machado, Oliveira & Fernandes 2009, severity 1.0, applied in linear RGB
  var CVD = {
    Protanopia:   [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    Deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
    Tritanopia:   [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]]
  };

  var el, store = B.store;
  function state() { return Object.assign({}, DEFAULT, store.get('checks') || {}); }
  function save(patch) { store.set('checks', Object.assign(state(), patch)); }
  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

  /* ---------- colour maths ---------- */
  function hex2rgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join(''); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16) / 255; }); }
  function rgb2hex(c) { return '#' + c.map(function (v) { v = Math.round(Math.max(0, Math.min(1, v)) * 255); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function lin(v) { return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function delin(v) { return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; }
  function simulate(hex, M) {
    var c = hex2rgb(hex).map(lin);
    return rgb2hex(M.map(function (row) { return delin(row[0] * c[0] + row[1] * c[1] + row[2] * c[2]); }));
  }
  function luminance(hex) { var c = hex2rgb(hex).map(lin); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function contrast(a, b) { var la = luminance(a), lb = luminance(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); }
  function dist(a, b) { var x = hex2rgb(a), y = hex2rgb(b); return Math.sqrt(x.reduce(function (s, v, i) { return s + Math.pow((v - y[i]) * 255, 2); }, 0)); }

  /* ---------- mount ---------- */
  function mount(root) {
    el = root;
    var st = state();
    el.innerHTML =
      '<section class="panel">' +
        '<p class="kicker">Checks · type</p>' +
        '<h2>Readable across the table</h2>' +
        '<p>Text on a card in the middle of the table is read from further away than a book. Set the distance and see the size it needs.</p>' +
        '<label class="checks-dist">Reading distance <input type="range" min="30" max="150" step="5" value="' + st.distance + '" data-dist aria-label="Distance in cm"> <b class="num"></b> cm</label>' +
        '<div class="checks-type"></div>' +
        '<p class="muted" style="font-size:12.5px">Sizes assume a 96 dpi screen. The bar below should be as wide as a bank card (85.6 mm); if it isn’t, scale everything by the same amount.</p>' +
        '<div class="checks-ruler" style="width:' + (85.6 * PX_PER_MM) + 'px"><span>85.6 mm</span></div>' +
      '</section>' +
      '<section class="panel">' +
        '<p class="kicker">Checks · colour</p>' +
        '<h2>Your colours, everyone’s eyes</h2>' +
        '<p>About 1 in 12 boys can’t tell some reds from greens. If two suits or factions look the same to them, the game breaks. Paste your palette.</p>' +
        '<div class="checks-palette"></div>' +
        '<div class="checks-sims"></div>' +
        '<div class="checks-warn"></div>' +
      '</section>' +
      '<section class="panel">' +
        '<p class="kicker">Checks · grid</p>' +
        '<h2>Grid paper</h2>' +
        '<p>For board sketches to scale, or to print as the board itself.</p>' +
        '<div class="btn-row">' +
          '<div class="seg" role="group" aria-label="Grid"><button type="button" data-grid="square">Square</button><button type="button" data-grid="hex">Hex</button><button type="button" data-grid="offset">Offset</button><button type="button" data-grid="tri">Triangle</button></div>' +
          '<label class="checks-cell">Cell <input class="input mono" type="number" min="5" max="60" value="' + st.cell + '" data-cell aria-label="Cell size mm"> mm</label>' +
          '<div class="seg" role="group" aria-label="Paper"><button type="button" data-page="a4">A4</button><button type="button" data-page="letter">Letter</button></div>' +
        '</div>' +
        '<div class="checks-grid"></div>' +
        '<div class="btn-row" style="margin-top:12px"><button class="btn" type="button" data-print>Print</button><button class="btn paper sm" type="button" data-png>Download (PNG)</button></div>' +
      '</section>';

    el.querySelector('[data-dist]').addEventListener('input', function (e) { save({ distance: +e.target.value }); renderType(); });
    el.querySelector('.checks-palette').addEventListener('input', function (e) {
      if (!e.target.dataset.i) return;
      var c = state().colours.slice(); c[+e.target.dataset.i] = e.target.value; save({ colours: c }); renderSims();
    });
    el.querySelector('.checks-palette').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var c = state().colours.slice();
      if (b.dataset.add != null && c.length < 8) c.push('#888888');
      if (b.dataset.remove != null && c.length > 2) c.splice(+b.dataset.remove, 1);
      save({ colours: c }); renderPalette(); renderSims();
    });
    el.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.grid) { save({ grid: b.dataset.grid }); renderGrid(); }
      if (b.dataset.page) { save({ page: b.dataset.page }); renderGrid(); }
    });
    el.querySelector('[data-cell]').addEventListener('input', function (e) { save({ cell: Math.max(5, Math.min(60, parseInt(e.target.value, 10) || 25)) }); renderGrid(); });
    el.querySelector('[data-print]').addEventListener('click', function () {
      var page = PAGES[state().page];
      B.printSection(B.el('<section class="sheet-print"><style>@page{size:' + page.name + ';margin:0}.sheet-print svg{width:' + page.w + 'mm;height:' + page.h + 'mm;display:block}</style>' + gridSVG() + '</section>'));
    });
    el.querySelector('[data-png]').addEventListener('click', function () { B.downloadPNG(B.el('<div>' + gridSVG() + '</div>').firstChild, 'grid-' + state().grid + '.png'); });

    renderType(); renderPalette(); renderSims(); renderGrid();
  }
  function unmount() { el = null; }

  /* ---------- type ---------- */
  function renderType() {
    var d = state().distance;
    el.querySelector('.checks-dist b').textContent = d;
    // cap height in mm for a glance (comfortable) and for careful reading (minimum)
    var capMin = d * 0.035, capOk = d * 0.05;
    var ptMin = Math.ceil(capMin / 0.7 / PT), ptOk = Math.ceil(capOk / 0.7 / PT);
    function sample(pt, label) {
      return '<div class="checks-sample"><div class="label">' + label + ' · ' + pt + ' pt</div><div style="font-size:' + (pt * PT * PX_PER_MM) + 'px;line-height:1.15;font-weight:700">Deal 2 damage</div></div>';
    }
    el.querySelector('.checks-type').innerHTML = sample(ptMin, 'Minimum, careful reading') + sample(ptOk, 'Comfortable, a glance') +
      '<p class="muted" style="font-size:13px;margin:6px 0 0">Rules text on a card in hand (35 cm) can be 9 pt. The same text in the middle of the table (' + d + ' cm) needs ' + ptMin + ' pt. That is why the middle of the table gets icons, not sentences.</p>';
  }

  /* ---------- colours ---------- */
  function renderPalette() {
    var c = state().colours;
    el.querySelector('.checks-palette').innerHTML = c.map(function (h, i) {
      return '<div class="checks-colour"><input type="color" value="' + h + '" data-i="' + i + '" aria-label="Colour ' + (i + 1) + '"><span class="num">' + h + '</span><button type="button" class="pt-x" data-remove="' + i + '" aria-label="Remove">✕</button></div>';
    }).join('') + (c.length < 8 ? '<button type="button" class="btn paper sm" data-add>Add</button>' : '');
  }
  function renderSims() {
    var c = state().colours, ink = '#1f1b15', paper = '#f8f2e4';
    var names = ['Normal'].concat(Object.keys(CVD));
    var sims = el.querySelector('.checks-sims');
    sims.innerHTML = '<table class="sheet checks-table"><thead><tr><th></th>' + names.map(function (n) { return '<th>' + n + '</th>'; }).join('') + '<th>Text on paper</th><th>Text on ink</th></tr></thead><tbody>' +
      c.map(function (h, i) {
        var cells = names.map(function (n) { var v = n === 'Normal' ? h : simulate(h, CVD[n]); return '<td><i class="checks-sw" style="background:' + v + '"></i></td>'; }).join('');
        var cp = contrast(h, paper), ci = contrast(h, ink);
        return '<tr><th>' + (i + 1) + '</th>' + cells + '<td class="num">' + cp.toFixed(1) + (cp >= 4.5 ? ' ✓' : cp >= 3 ? ' big only' : ' ✗') + '</td><td class="num">' + ci.toFixed(1) + (ci >= 4.5 ? ' ✓' : ci >= 3 ? ' big only' : ' ✗') + '</td></tr>';
      }).join('') + '</tbody></table>';
    var warns = [];
    Object.keys(CVD).forEach(function (n) {
      for (var i = 0; i < c.length; i++) for (var j = i + 1; j < c.length; j++) {
        var d = dist(simulate(c[i], CVD[n]), simulate(c[j], CVD[n]));
        if (d < 45 && dist(c[i], c[j]) >= 45) warns.push('Colours ' + (i + 1) + ' and ' + (j + 1) + ' look alike with ' + n.toLowerCase() + '.');
      }
    });
    el.querySelector('.checks-warn').innerHTML = warns.length ? warns.map(function (w) { return '<p class="callout">' + w + '</p>'; }).join('') +
      '<p class="muted" style="font-size:13px">Fix: change the lightness, not just the hue, or add a shape or symbol so colour is never the only difference.</p>' :
      '<p class="muted" style="font-size:13px">No two colours collapse together. Still add a symbol per suit: printers and lighting are not kind to colour either.</p>';
  }

  /* ---------- grid ---------- */
  function gridSVG() {
    var st = state(), page = PAGES[st.page], c = st.cell, m = 8, ink = cssVar('--ink-faint');
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + page.w + ' ' + page.h + '" class="sheet-page"><rect width="' + page.w + '" height="' + page.h + '" fill="#fff"/>';
    var W = page.w - 2 * m, H = page.h - 2 * m, x, y, i, j;
    var st1 = ' fill="none" stroke="' + ink + '" stroke-width="0.2"';
    if (st.grid === 'square') {
      var cols = Math.floor(W / c), rows = Math.floor(H / c), ox = (page.w - cols * c) / 2, oy = (page.h - rows * c) / 2;
      for (i = 0; i <= cols; i++) s += '<line x1="' + (ox + i * c) + '" y1="' + oy + '" x2="' + (ox + i * c) + '" y2="' + (oy + rows * c) + '"' + st1 + '/>';
      for (j = 0; j <= rows; j++) s += '<line x1="' + ox + '" y1="' + (oy + j * c) + '" x2="' + (ox + cols * c) + '" y2="' + (oy + j * c) + '"' + st1 + '/>';
    } else if (st.grid === 'offset') {
      var cols2 = Math.floor(W / c) - 1, rows2 = Math.floor(H / c), ox2 = (page.w - cols2 * c) / 2, oy2 = (page.h - rows2 * c) / 2;
      for (j = 0; j < rows2; j++) for (i = 0; i < cols2; i++) s += '<rect x="' + (ox2 + i * c + (j % 2 ? c / 2 : 0)) + '" y="' + (oy2 + j * c) + '" width="' + c + '" height="' + c + '"' + st1 + '/>';
    } else if (st.grid === 'hex') {
      // pointy-top hexes, c = flat-to-flat width
      var r = c / Math.sqrt(3), hw = c, vh = r * 1.5;
      var cols3 = Math.floor((W - hw / 2) / hw), rows3 = Math.floor((H - r / 2) / vh);
      var ox3 = (page.w - cols3 * hw - hw / 2) / 2 + hw / 2, oy3 = (page.h - (rows3 - 1) * vh - 2 * r) / 2 + r;
      for (j = 0; j < rows3; j++) for (i = 0; i < cols3; i++) {
        x = ox3 + i * hw + (j % 2 ? hw / 2 : 0); y = oy3 + j * vh;
        var pts = []; for (var k = 0; k < 6; k++) { var a = Math.PI / 3 * k - Math.PI / 6; pts.push((x + r * Math.cos(a)).toFixed(2) + ',' + (y + r * Math.sin(a)).toFixed(2)); }
        s += '<polygon points="' + pts.join(' ') + '"' + st1 + '/>';
      }
    } else {
      // triangles: horizontals plus two diagonal families
      var th = c * Math.sqrt(3) / 2, rows4 = Math.floor(H / th), oy4 = (page.h - rows4 * th) / 2, cols4 = Math.floor(W / c), ox4 = (page.w - cols4 * c) / 2;
      for (j = 0; j <= rows4; j++) s += '<line x1="' + ox4 + '" y1="' + (oy4 + j * th) + '" x2="' + (ox4 + cols4 * c) + '" y2="' + (oy4 + j * th) + '"' + st1 + '/>';
      var span = rows4 * th / Math.sqrt(3);
      for (i = -Math.ceil(span / c); i <= cols4; i++) {
        var x1 = ox4 + i * c, x2 = x1 + span;
        s += '<line x1="' + x1 + '" y1="' + (oy4 + rows4 * th) + '" x2="' + x2 + '" y2="' + oy4 + '"' + st1 + '/>';
        s += '<line x1="' + (x1 + span) + '" y1="' + (oy4 + rows4 * th) + '" x2="' + x1 + '" y2="' + oy4 + '"' + st1 + '/>';
      }
      s += '<rect x="0" y="0" width="' + page.w + '" height="' + page.h + '" fill="none"/>';
      // mask the overhang by painting the margins white
      s += '<rect x="0" y="0" width="' + ox4 + '" height="' + page.h + '" fill="#fff"/><rect x="' + (ox4 + cols4 * c) + '" y="0" width="' + (page.w - ox4 - cols4 * c) + '" height="' + page.h + '" fill="#fff"/>';
    }
    s += '<text x="' + (page.w - m) + '" y="' + (page.h - 3) + '" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="2.6" fill="' + ink + '">' + st.grid + ' · ' + c + ' mm · ' + page.name + ' · print at 100%</text>';
    return s + '</svg>';
  }
  function renderGrid() {
    var st = state();
    el.querySelectorAll('[data-grid]').forEach(function (b) { b.classList.toggle('on', b.dataset.grid === st.grid); });
    el.querySelectorAll('[data-page]').forEach(function (b) { b.classList.toggle('on', b.dataset.page === st.page); });
    el.querySelector('.checks-grid').innerHTML = gridSVG();
  }

  B.register({ id: 'checks', title: 'Checks', blurb: 'Type size, colour-blind safe, grid paper.', mount: mount, unmount: unmount });
})();
