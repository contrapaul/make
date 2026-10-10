/* Setup: how long it takes to lay the game out and pack it away, from the
   manifest. Exposes Bench.setupEstimate for Session. */
(function () {
  'use strict';
  var B = window.Bench;

  // Seconds per piece by kind and where it starts. Rough, deliberately: the
  // point is which kind eats the time, not the decimal. Editable in the tool.
  var DEFAULT_COST = {
    card:  { table: 1.0, reserve: 0.2, dealt: 1.5, bag: 0.3 },
    token: { table: 1.0, reserve: 0.15, dealt: 1.0, bag: 0.2 },
    board: { table: 10, reserve: 5, dealt: 10, bag: 5 },
    die:   { table: 0.5, reserve: 0.3, dealt: 0.5, bag: 0.3 },
    tile:  { table: 1.5, reserve: 0.2, dealt: 1.5, bag: 0.3 },
    other: { table: 2.0, reserve: 0.5, dealt: 2.0, bag: 0.5 }
  };
  var SHUFFLE = 20;          // once per deck of cards
  var PACK_FACTOR = { table: 0.6, dealt: 0.6, reserve: 0.15, bag: 0.15 };
  var WARN_TABLE = 60, WARN_LOSE = 120;

  function costs(store) { return Object.assign({}, DEFAULT_COST, (store.get('setup') || {}).cost || {}); }

  // Returns { setupSec, packSec, onTable, byKind: [{type, sec}], warnings: [] }
  function estimate(manifest, cost) {
    cost = cost || DEFAULT_COST;
    var setup = 0, pack = 0, onTable = 0, byKind = {};
    manifest.forEach(function (r) {
      var n = r.count || 0, c = (cost[r.type] || cost.other)[r.start] || 1;
      var sec = n * c;
      if (r.type === 'card' && n > 1) sec += SHUFFLE;
      setup += sec;
      pack += n * c * (PACK_FACTOR[r.start] || 0.5);
      if (r.start === 'table' || r.start === 'dealt') onTable += n;
      byKind[r.type] = (byKind[r.type] || 0) + sec;
    });
    var kinds = Object.keys(byKind).map(function (k) { return { type: k, sec: byKind[k] }; }).sort(function (a, b) { return b.sec - a.sec; });
    var warnings = [];
    if (onTable > WARN_LOSE) warnings.push(onTable + ' pieces on the table at once. At recess, pieces that many get lost. Can some start in a reserve pile?');
    else if (onTable > WARN_TABLE) warnings.push(onTable + ' pieces on the table at once. That needs a big table and a careful setup. Check it fits.');
    return { setupSec: setup, packSec: pack, onTable: onTable, byKind: kinds, warnings: warnings };
  }
  function mins(sec) { return sec < 60 ? Math.round(sec) + ' s' : (sec / 60).toFixed(1).replace(/\.0$/, '') + ' min'; }

  var el, store, unsubs = [], unmountManifest = null;

  function mount(root, s) {
    el = root; store = s;
    el.innerHTML =
      '<section class="panel">' +
        '<p class="kicker">Setup</p>' +
        '<h2>What goes on the table</h2>' +
        '<p>List every component, how many, and where it starts. Setup time comes from that. Session uses the answer.</p>' +
        '<div class="setup-manifest"></div>' +
      '</section>' +
      '<div class="tool-grid">' +
        '<section class="panel">' +
          '<p class="kicker">Estimate</p>' +
          '<h2>Laying it out</h2>' +
          '<div class="setup-stats"></div>' +
          '<div class="setup-warn"></div>' +
          '<div class="label" style="margin-top:12px">Where the time goes</div>' +
          '<div class="setup-kinds"></div>' +
        '</section>' +
        '<section class="panel">' +
          '<p class="kicker">Assumptions</p>' +
          '<h2>Seconds per piece</h2>' +
          '<p>Rough on purpose. Time three real setups with <a href="#playtest">Playtest</a> and change these if they are far off.</p>' +
          '<div class="setup-costs"></div>' +
          '<p class="muted" style="font-size:13px;margin-top:8px">Plus ' + SHUFFLE + ' s to shuffle each deck. Pack-away is about 60% of setup for pieces on the table or dealt, 15% for piles and bags.</p>' +
          '<button class="btn paper sm" type="button" data-reset>Back to defaults</button>' +
        '</section>' +
      '</div>';
    unmountManifest = B.manifest.mount(el.querySelector('.setup-manifest'), store);
    renderCosts();
    render();
    unsubs.push(store.on('manifest', render));
    el.querySelector('.setup-costs').addEventListener('input', function (e) {
      var inp = e.target; if (!inp.dataset.t) return;
      var c = JSON.parse(JSON.stringify(costs(store)));
      c[inp.dataset.t][inp.dataset.s] = Math.max(0, parseFloat(inp.value) || 0);
      store.set('setup', Object.assign({}, store.get('setup') || {}, { cost: c }));
      render();
    });
    el.querySelector('[data-reset]').addEventListener('click', function () {
      store.set('setup', Object.assign({}, store.get('setup') || {}, { cost: {} })); renderCosts(); render();
    });
  }
  function unmount() {
    unsubs.forEach(function (u) { u(); }); unsubs = [];
    if (unmountManifest) unmountManifest(); unmountManifest = null;
    el = null;
  }

  function render() {
    var est = estimate(store.get('manifest'), costs(store));
    el.querySelector('.setup-stats').innerHTML =
      '<div class="stat"><b class="num">' + mins(est.setupSec) + '</b><span>to set up</span></div>' +
      '<div class="stat"><b class="num">' + mins(est.packSec) + '</b><span>to pack away</span></div>' +
      '<div class="stat' + (est.onTable > WARN_TABLE ? ' warn' : '') + '"><b class="num">' + est.onTable + '</b><span>pieces on the table</span></div>';
    el.querySelector('.setup-warn').innerHTML = est.warnings.map(function (w) { return '<p class="callout">' + B.esc(w) + '</p>'; }).join('');
    var max = est.byKind.length ? est.byKind[0].sec : 1;
    el.querySelector('.setup-kinds').innerHTML = est.byKind.length ? est.byKind.map(function (k, i) {
      return '<div class="kind-bar"><span>' + k.type + (k.type === 'card' ? 's' : k.type === 'die' ? ' dice' : 's') + '</span><i style="width:' + Math.max(2, 100 * k.sec / max) + '%"' + (i === 0 ? ' class="top"' : '') + '></i><b class="num">' + mins(k.sec) + '</b></div>';
    }).join('') : '<p class="muted">Nothing on the list.</p>';
  }
  function renderCosts() {
    var c = costs(store), starts = Object.keys(B.manifest.STARTS);
    el.querySelector('.setup-costs').innerHTML = '<table class="sheet costs"><thead><tr><th></th>' + starts.map(function (s) { return '<th>' + s + '</th>'; }).join('') + '</tr></thead><tbody>' +
      B.manifest.TYPES.map(function (t) {
        return '<tr><th>' + t + '</th>' + starts.map(function (s) { return '<td><input class="input mono" type="number" min="0" step="0.1" value="' + c[t][s] + '" data-t="' + t + '" data-s="' + s + '" aria-label="' + t + ' ' + s + '"></td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
  }

  B.setupEstimate = function (store) { return estimate(store.get('manifest'), costs(store)); };
  B.register({ id: 'setup', mount: mount, unmount: unmount });
})();
