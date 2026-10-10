/* Box: from component sizes to a box that holds them, with a net to print
   or tray dimensions to model. */
(function () {
  'use strict';
  var B = window.Bench;

  // mm, per piece: [w, h, thickness]. Board is folded once.
  var DEFAULT_SIZE = { card: [63, 88, 0.3], token: [20, 20, 2], board: [210, 297, 4], die: [16, 16, 16], tile: [40, 40, 2], other: [50, 50, 20] };
  var PACK = { card: 1.05, token: 1.4, board: 1.0, die: 1.3, tile: 1.15, other: 1.3 };
  var WALL = 2, SLACK = 4, LID = 30, TRAY_WALL = 1.6;

  var el, store = B.store, unsubs = [];

  function sizeOf(r) {
    var d = DEFAULT_SIZE[r.type] || DEFAULT_SIZE.other;
    return [r.w || d[0], r.h || d[1], r.d || d[2]];
  }
  function estimate(list) {
    var vol = 0, fw = 0, fh = 0, tallest = 0;
    list.forEach(function (r) {
      var s = sizeOf(r), n = r.count || 0; if (!n) return;
      if (r.type === 'board') s = [s[0], s[1] / 2, s[2] * 2];   // folded once
      var stackH = s[2] * n * (PACK[r.type] || 1.3);
      vol += s[0] * s[1] * stackH;
      fw = Math.max(fw, Math.min(s[0], s[1])); fh = Math.max(fh, Math.max(s[0], s[1]));
      tallest = Math.max(tallest, Math.min(stackH, Math.max(s[0], s[1])));
    });
    if (!vol) return null;
    var W = Math.ceil(fw + SLACK), L = Math.ceil(fh + SLACK);
    var H = Math.max(25, Math.ceil(vol * 1.25 / (W * L)) + SLACK, Math.ceil(tallest * 0.6));
    return { W: W, L: L, H: H, vol: vol, outer: [W + 2 * WALL, L + 2 * WALL, H + WALL] };
  }
  function netSVG(W, L, H, tab, label, ink, faint) {
    // cross net: base in the middle, four walls, glue tabs on the short walls
    var tw = W + 2 * H + 2 * tab, th = L + 2 * H, m = 6;
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (tw + 2 * m) + ' ' + (th + 2 * m) + '" font-family="JetBrains Mono, monospace">';
    var x0 = m + tab + H, y0 = m + H, cut = ' fill="none" stroke="' + ink + '" stroke-width="0.3"', fold = ' stroke="' + faint + '" stroke-width="0.25" stroke-dasharray="2 1.5"';
    // outline: walk the cross
    var p = 'M' + x0 + ' ' + y0 + ' v-' + H + ' h' + W + ' v' + H + ' h' + H + ' v' + L + ' h-' + H + ' v' + H + ' h-' + W + ' v-' + H + ' h-' + H + ' v-' + L + ' z';
    s += '<path d="' + p + '"' + cut + '/>';
    // glue tabs off the left and right walls
    s += '<path d="M' + (x0 - H) + ' ' + (y0 + 2) + ' l-' + tab + ' ' + 3 + ' v' + (L - 10) + ' l' + tab + ' 3"' + cut + '/>';
    s += '<path d="M' + (x0 + W + H) + ' ' + (y0 + 2) + ' l' + tab + ' ' + 3 + ' v' + (L - 10) + ' l-' + tab + ' 3"' + cut + '/>';
    // folds
    s += '<rect x="' + x0 + '" y="' + y0 + '" width="' + W + '" height="' + L + '" fill="none"' + fold + '/>';
    s += '<line x1="' + (x0 - H) + '" y1="' + y0 + '" x2="' + (x0 - H) + '" y2="' + (y0 + L) + '"' + fold + '/><line x1="' + (x0 + W + H) + '" y1="' + y0 + '" x2="' + (x0 + W + H) + '" y2="' + (y0 + L) + '"' + fold + '/>';
    s += '<text x="' + (x0 + W / 2) + '" y="' + (y0 + L / 2) + '" text-anchor="middle" font-size="' + Math.min(8, W / 8) + '" fill="' + faint + '">' + label + ' ' + W + '×' + L + '×' + H + '</text>';
    s += '<text x="' + m + '" y="' + (th + 2 * m - 1.5) + '" font-size="3" fill="' + faint + '">cut solid · fold dashed · glue the tabs inside the long walls · print at 100%</text>';
    return s + '</svg>';
  }

  function mount(root) {
    el = root;
    var quiet = false;   // our own keystroke, don't re-render the table
    el.innerHTML =
      '<section class="panel">' +
        '<p class="kicker">Box</p>' +
        '<h2>Something to keep it in</h2>' +
        '<p>Sizes in mm for each component. Cards stack, tokens pile, the board folds once. The estimate leaves room to get things back in at the end of recess.</p>' +
        '<div class="box-table"></div>' +
      '</section>' +
      '<div class="tool-grid">' +
        '<section class="panel"><p class="kicker">Estimate</p><div class="box-stats"></div><p class="muted box-note" style="font-size:13px"></p></section>' +
        '<section class="panel"><p class="kicker">Net</p><h2>Base and lid</h2><p>A tray for the pieces and a lid ' + LID + ' mm deep that slides over it. Card of about 1 mm; score the folds before bending.</p>' +
          '<div class="box-net"></div><div class="btn-row" style="margin-top:12px"><button class="btn" type="button" data-print>Print the nets</button><button class="btn paper sm" type="button" data-png>Download (PNG)</button></div></section>' +
      '</div>';
    el.querySelector('.box-table').addEventListener('input', function (e) {
      var inp = e.target; if (!inp.dataset.k) return;
      var id = inp.closest('tr').dataset.id;
      quiet = true;
      store.set('manifest', store.get('manifest').map(function (r) { if (r.id !== id) return r; var o = Object.assign({}, r); o[inp.dataset.k] = Math.max(0, parseFloat(inp.value) || 0); return o; }));
      quiet = false; render();
    });
    el.querySelector('[data-print]').addEventListener('click', function () {
      var est = estimate(store.get('manifest')); if (!est) return;
      B.printSection(B.el('<section class="sheet-print"><style>@page{margin:10mm}.sheet-print svg{width:100%;max-height:270mm;display:block;page-break-after:always}</style>' + nets(est).join('') + '</section>'));
    });
    el.querySelector('[data-png]').addEventListener('click', function () {
      var est = estimate(store.get('manifest')); if (!est) return;
      B.downloadPNG(B.el('<div>' + nets(est)[0] + '</div>').firstChild, 'box-net.png');
    });
    unsubs.push(store.on('manifest', function () { if (!quiet) { renderTable(); render(); } }));
    renderTable(); render();
  }
  function unmount() { unsubs.forEach(function (u) { u(); }); unsubs = []; el = null; }

  function renderTable() {
    var list = store.get('manifest');
    el.querySelector('.box-table').innerHTML = list.length ? '<table class="sheet box-sheet"><thead><tr><th>Component</th><th class="num">How many</th><th>W</th><th>H</th><th>Thick</th></tr></thead><tbody>' +
      list.map(function (r) {
        var s = sizeOf(r);
        return '<tr data-id="' + r.id + '"><td>' + B.esc(r.name || '—') + ' <span class="muted">' + r.type + '</span></td><td class="num">' + r.count + '</td>' +
          ['w', 'h', 'd'].map(function (k, i) { return '<td><input class="input mono" type="number" min="0" step="0.1" value="' + s[i] + '" data-k="' + k + '" aria-label="' + k + ' mm"></td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table>' : '<p class="muted">Nothing on the list. Add components in <a href="#setup">Setup</a>.</p>';
  }
  function nets(est) {
    var ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim(), faint = getComputedStyle(document.documentElement).getPropertyValue('--ink-faint').trim();
    return [netSVG(est.W, est.L, est.H, 10, 'BASE', ink, faint), netSVG(est.W + 2 * WALL + 1, est.L + 2 * WALL + 1, LID, 10, 'LID', ink, faint)];
  }
  function render() {
    var est = estimate(store.get('manifest'));
    var stats = el.querySelector('.box-stats'), note = el.querySelector('.box-note'), net = el.querySelector('.box-net');
    if (!est) { stats.innerHTML = '<p class="muted">Add components with counts first.</p>'; note.textContent = ''; net.innerHTML = ''; return; }
    stats.innerHTML = '<div class="setup-stats">' +
      '<div class="stat"><b class="num">' + est.W + '×' + est.L + '×' + est.H + '</b><span>inside, mm</span></div>' +
      '<div class="stat"><b class="num">' + est.outer[0] + '×' + est.outer[1] + '×' + est.outer[2] + '</b><span>outside, ' + WALL + ' mm walls</span></div>' +
      '<div class="stat"><b class="num">' + (est.vol / 1000).toFixed(0) + ' cm³</b><span>of stuff</span></div></div>' +
      '<div class="label" style="margin-top:12px">3D-printed tray</div><p style="margin:2px 0 0">Model a tray ' + (est.W + 2 * TRAY_WALL) + ' × ' + (est.L + 2 * TRAY_WALL) + ' × ' + Math.ceil(est.H * 0.7) + ' mm outside with ' + TRAY_WALL + ' mm walls, ' + est.W + ' × ' + est.L + ' inside. Add a finger notch. Print it upright, no supports.</p>';
    var big = est.W + 2 * est.H + 20 > 200 || est.L + 2 * est.H > 287;
    note.textContent = big ? 'This net is bigger than A4. Print it on A3, or draw it from the dimensions on card.' : 'The net fits A4. Print at 100%.';
    net.innerHTML = nets(est).join('');
  }

  B.register({ id: 'box', title: 'Box', blurb: 'From sizes to a box, with a net to print.', mount: mount, unmount: unmount });
})();
