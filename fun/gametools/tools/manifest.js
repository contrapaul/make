/* Manifest: the shared component list. Not a tool on the nav; Setup (and
   later Owners and Box) embed it with Bench.manifest.mount(el, store). */
(function () {
  'use strict';
  var B = window.Bench;

  var TYPES = ['card', 'token', 'board', 'die', 'tile', 'other'];
  var STARTS = { table: 'on the table', reserve: 'in a reserve pile', dealt: 'dealt to players', bag: 'in a bag or cup' };
  var EXAMPLE = [
    { name: 'Action cards', type: 'card', count: 54, start: 'dealt', owner: '' },
    { name: 'Gold tokens', type: 'token', count: 40, start: 'reserve', owner: '' },
    { name: 'Board', type: 'board', count: 1, start: 'table', owner: '' },
    { name: 'Dice', type: 'die', count: 2, start: 'table', owner: '' },
    { name: 'Player pawns', type: 'token', count: 4, start: 'table', owner: '' }
  ];
  var nextId = 1;
  function withIds(rows) { return rows.map(function (r) { return Object.assign({ id: 'c' + (nextId++) + Date.now().toString(36) }, r); }); }

  function mount(el, store, opts) {
    opts = opts || {};
    var rows = store.get('manifest');
    var seeded = false, quiet = false;   // quiet: our own keystroke, don't re-render
    if (!rows.length) { rows = withIds(EXAMPLE); store.set('manifest', rows); seeded = true; }

    el.classList.add('manifest');
    el.innerHTML =
      (seeded ? '<p class="manifest-note muted">This is an example. Change it to your game.</p>' : '') +
      '<div class="manifest-table"></div>' +
      '<div class="btn-row" style="margin-top:10px">' +
        '<button class="btn paper sm" type="button" data-add>Add a component</button>' +
        '<button class="btn paper sm" type="button" data-csv>Download (CSV)</button>' +
        '<button class="btn paper sm" type="button" data-print>Print</button>' +
        '<span class="muted manifest-total"></span>' +
      '</div>';
    var table = el.querySelector('.manifest-table');

    function render(list) {
      table.innerHTML = '<table class="sheet manifest-sheet"><thead><tr><th>Component</th><th>Kind</th><th class="num">How many</th><th>Starts</th>' + (opts.owners ? '<th>Owner</th>' : '') + '<th></th></tr></thead><tbody>' +
        list.map(function (r) {
          return '<tr data-id="' + r.id + '">' +
            '<td><input class="input" type="text" value="' + B.esc(r.name) + '" data-k="name" aria-label="Component name" maxlength="40"></td>' +
            '<td><select class="input" data-k="type" aria-label="Kind">' + TYPES.map(function (t) { return '<option' + (t === r.type ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></td>' +
            '<td class="num"><input class="input mono" type="number" min="0" max="999" value="' + r.count + '" data-k="count" aria-label="How many"></td>' +
            '<td><select class="input" data-k="start" aria-label="Where it starts">' + Object.keys(STARTS).map(function (k) { return '<option value="' + k + '"' + (k === r.start ? ' selected' : '') + '>' + STARTS[k] + '</option>'; }).join('') + '</select></td>' +
            (opts.owners ? '<td><input class="input" type="text" value="' + B.esc(r.owner || '') + '" data-k="owner" aria-label="Owner" maxlength="24"></td>' : '') +
            '<td><button type="button" class="btn paper sm" data-del aria-label="Remove ' + B.esc(r.name) + '">✕</button></td>' +
          '</tr>';
        }).join('') + '</tbody></table>';
      var pieces = list.reduce(function (a, r) { return a + (r.count || 0); }, 0);
      el.querySelector('.manifest-total').textContent = list.length + ' kinds, ' + pieces + ' pieces';
    }

    function current() { return store.get('manifest'); }
    table.addEventListener('input', function (e) {
      var inp = e.target; if (!inp.dataset.k) return;
      var id = inp.closest('tr').dataset.id;
      var list = current().map(function (r) {
        if (r.id !== id) return r;
        var v = inp.dataset.k === 'count' ? Math.max(0, Math.min(999, parseInt(inp.value, 10) || 0)) : inp.value;
        return Object.assign({}, r, (function () { var o = {}; o[inp.dataset.k] = v; return o; })());
      });
      quiet = true; store.set('manifest', list); quiet = false;
      var pieces = list.reduce(function (a, r) { return a + (r.count || 0); }, 0);
      el.querySelector('.manifest-total').textContent = list.length + ' kinds, ' + pieces + ' pieces';
    });
    table.addEventListener('click', function (e) {
      var b = e.target.closest('[data-del]'); if (!b) return;
      var id = b.closest('tr').dataset.id;
      store.set('manifest', current().filter(function (r) { return r.id !== id; }));
    });
    el.querySelector('[data-add]').addEventListener('click', function () {
      store.set('manifest', current().concat(withIds([{ name: '', type: 'token', count: 10, start: 'reserve', owner: '' }])));
      var inputs = table.querySelectorAll('input[data-k="name"]'); inputs[inputs.length - 1].focus();
    });
    el.querySelector('[data-csv]').addEventListener('click', function () {
      B.downloadCSV([['component', 'kind', 'how many', 'starts', 'owner']].concat(current().map(function (r) { return [r.name, r.type, r.count, STARTS[r.start] || r.start, r.owner || '']; })), 'components.csv');
    });
    el.querySelector('[data-print]').addEventListener('click', function () {
      var list = current();
      var p = B.el('<section class="panel"><h2>Components</h2><table class="sheet"><thead><tr><th>Component</th><th>Kind</th><th>How many</th><th>Starts</th><th>Owner</th></tr></thead><tbody>' +
        list.map(function (r) { return '<tr><td>' + B.esc(r.name) + '</td><td>' + r.type + '</td><td>' + r.count + '</td><td>' + STARTS[r.start] + '</td><td>' + B.esc(r.owner || '') + '</td></tr>'; }).join('') +
        '</tbody></table></section>');
      B.printSection(p);
    });

    // Re-render on outside changes (delete, add, import) but not on our own keystrokes.
    var unsub = store.on('manifest', function (list) { if (!quiet) render(list); });
    render(rows);
    return function () { unsub(); el.innerHTML = ''; el.classList.remove('manifest'); };
  }

  B.manifest = { mount: mount, TYPES: TYPES, STARTS: STARTS };
})();
