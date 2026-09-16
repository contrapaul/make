/* Deck: build a deck, draw hands, and see the odds of what turns up. */
(function () {
  'use strict';
  var B = window.Bench;

  var SWATCH = ['--berry', '--brass', '--felt', '--slate', '--plum', '--rust'];
  var SIMS = 1000, MAX_CARDS = 200, MAX_HAND = 30;
  var DEFAULT = {
    types: [{ name: 'Attack', count: 12 }, { name: 'Heal', count: 6 }, { name: 'Wild', count: 2 }],
    hand: 5, ask: { type: 0, k: 1 }
  };

  var el, store, ui = {}, timers = [];

  function state() { return Object.assign({}, DEFAULT, store.get('deck') || {}); }
  function save(patch) { store.set('deck', Object.assign(state(), patch)); }
  function total(types) { return types.reduce(function (a, t) { return a + (t.count || 0); }, 0); }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

  /* ---------- maths ----------
     Hypergeometric: P(exactly x of K special cards in a hand of n from N). */
  function lnChoose(n, k) {
    if (k < 0 || k > n) return -Infinity;
    var r = 0; for (var i = 1; i <= k; i++) r += Math.log(n - k + i) - Math.log(i);
    return r;
  }
  function pExact(N, K, n, x) {
    if (x < 0 || x > K || x > n || n - x > N - K) return 0;
    return Math.exp(lnChoose(K, x) + lnChoose(N - K, n - x) - lnChoose(N, n));
  }
  function pAtLeast(N, K, n, k) {
    var p = 0; for (var x = k; x <= Math.min(K, n); x++) p += pExact(N, K, n, x);
    return Math.min(1, p);
  }
  function shuffledDeck(types) {
    var deck = [];
    types.forEach(function (t, i) { for (var c = 0; c < t.count; c++) deck.push(i); });
    for (var i = deck.length - 1; i > 0; i--) { var j = B.rand(i + 1) - 1; var tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp; }
    return deck;
  }

  /* ---------- mount ---------- */
  function mount(root, s) {
    el = root; store = s;
    var st = state();
    el.innerHTML =
      '<div class="tool-grid">' +
        '<section class="panel">' +
          '<p class="kicker">Deck</p>' +
          '<h2>What is in it</h2>' +
          '<p>Name each kind of card and say how many. Drag the sliders and watch the odds move.</p>' +
          '<div class="deck-types"></div>' +
          '<div class="btn-row"><button class="btn paper sm" type="button" data-add>Add a kind</button><span class="muted deck-total"></span></div>' +
        '</section>' +
        '<section class="panel">' +
          '<p class="kicker">Draw</p>' +
          '<h2>Opening hand</h2>' +
          '<div class="deck-draw-row">' +
            '<label class="deck-hand">Hand of <input class="input mono" type="number" min="1" max="' + MAX_HAND + '" value="' + st.hand + '" aria-label="Hand size"></label>' +
            '<button class="btn" type="button" data-draw>Shuffle and draw</button>' +
          '</div>' +
          '<div class="deck-hand-cards" aria-live="polite"></div>' +
        '</section>' +
      '</div>' +
      '<section class="panel">' +
        '<p class="kicker">Odds</p>' +
        '<h2>What turns up</h2>' +
        '<div class="deck-ask">Chance of at least <input class="input mono" type="number" min="1" max="' + MAX_HAND + '" value="' + st.ask.k + '" aria-label="At least how many" data-ask="k"> ' +
          '<select class="input" data-ask="type" aria-label="Which kind"></select> in a hand of <b class="num deck-ask-n"></b>: ' +
          '<span class="deck-answer"><b class="num deck-exact"></b> exactly, <b class="num deck-sim"></b> in ' + SIMS.toLocaleString() + ' shuffles</span></div>' +
        '<div class="deck-table"></div>' +
        '<div class="btn-row" style="margin-top:14px"><button class="btn paper sm" type="button" data-csv>Download table (CSV)</button></div>' +
      '</section>';

    ui.types = el.querySelector('.deck-types');
    ui.total = el.querySelector('.deck-total');
    ui.hand = el.querySelector('.deck-hand input');
    ui.cards = el.querySelector('.deck-hand-cards');
    ui.askK = el.querySelector('[data-ask="k"]');
    ui.askType = el.querySelector('[data-ask="type"]');
    ui.askN = el.querySelector('.deck-ask-n');
    ui.exact = el.querySelector('.deck-exact');
    ui.sim = el.querySelector('.deck-sim');
    ui.table = el.querySelector('.deck-table');

    ui.types.addEventListener('input', onTypeEdit);
    ui.types.addEventListener('click', function (e) {
      var b = e.target.closest('[data-del]'); if (!b) return;
      var types = state().types.slice(); types.splice(+b.dataset.del, 1);
      save({ types: types, ask: { type: 0, k: state().ask.k } }); renderTypes(); renderOdds();
    });
    el.querySelector('[data-add]').addEventListener('click', function () {
      var types = state().types;
      if (total(types) >= MAX_CARDS) return;
      save({ types: types.concat([{ name: 'Card ' + (types.length + 1), count: 4 }]) }); renderTypes(); renderOdds();
      var names = ui.types.querySelectorAll('input[type=text]'); names[names.length - 1].select();
    });
    ui.hand.addEventListener('input', function () { save({ hand: clampHand() }); renderOdds(); });
    el.querySelector('[data-draw]').addEventListener('click', draw);
    ui.askK.addEventListener('input', function () { save({ ask: { type: state().ask.type, k: Math.max(1, +ui.askK.value || 1) } }); renderOdds(); });
    ui.askType.addEventListener('change', function () { save({ ask: { type: +ui.askType.value, k: state().ask.k } }); renderOdds(); });
    el.querySelector('[data-csv]').addEventListener('click', exportCSV);

    renderTypes(); renderOdds();
  }
  function unmount() { timers.forEach(clearTimeout); timers = []; el = null; ui = {}; }

  function clampHand() {
    var N = total(state().types);
    var h = Math.max(1, Math.min(MAX_HAND, N || 1, +ui.hand.value || 1));
    if (String(h) !== ui.hand.value) ui.hand.value = h;
    return h;
  }

  /* ---------- types ---------- */
  function renderTypes() {
    var types = state().types;
    ui.types.innerHTML = types.map(function (t, i) {
      return '<div class="deck-type" style="--sw:var(' + SWATCH[i % SWATCH.length] + ')">' +
        '<span class="sw" aria-hidden="true"></span>' +
        '<input class="input" type="text" value="' + B.esc(t.name) + '" data-i="' + i + '" data-k="name" aria-label="Kind of card" maxlength="20">' +
        '<input type="range" min="0" max="40" value="' + t.count + '" data-i="' + i + '" data-k="count" aria-label="How many ' + B.esc(t.name) + '">' +
        '<input class="input mono" type="number" min="0" max="' + MAX_CARDS + '" value="' + t.count + '" data-i="' + i + '" data-k="count" aria-label="How many">' +
        '<button type="button" class="btn paper sm" data-del="' + i + '" aria-label="Remove ' + B.esc(t.name) + '">✕</button>' +
      '</div>';
    }).join('');
    ui.total.textContent = total(types) + ' cards';
  }
  function onTypeEdit(e) {
    var inp = e.target; if (!inp.dataset.k) return;
    var types = state().types.map(function (t) { return Object.assign({}, t); });
    var t = types[+inp.dataset.i];
    if (inp.dataset.k === 'name') t.name = inp.value;
    else {
      var v = Math.max(0, Math.min(MAX_CARDS, parseInt(inp.value, 10) || 0));
      if (total(types) - t.count + v > MAX_CARDS) v = MAX_CARDS - (total(types) - t.count);
      t.count = v;
      var row = inp.closest('.deck-type');
      row.querySelectorAll('[data-k="count"]').forEach(function (x) { if (x !== inp) x.value = v; });
    }
    save({ types: types });
    ui.total.textContent = total(types) + ' cards';
    renderOdds();
  }

  /* ---------- draw ---------- */
  function draw() {
    var st = state(), types = st.types, N = total(types);
    if (!N) { ui.cards.innerHTML = '<p class="muted">The deck is empty.</p>'; return; }
    var n = Math.min(st.hand, N);
    var hand = shuffledDeck(types).slice(0, n);
    var reduce = B.reducedMotion();
    ui.cards.innerHTML = hand.map(function (ti, i) {
      return '<div class="deck-card' + (reduce ? ' in' : '') + '" style="--sw:var(' + SWATCH[ti % SWATCH.length] + ')"><span>' + B.esc(types[ti].name) + '</span></div>';
    }).join('');
    if (!reduce) ui.cards.querySelectorAll('.deck-card').forEach(function (c, i) { later(function () { c.classList.add('in'); }, 60 + i * 90); });
  }

  /* ---------- odds ---------- */
  function renderOdds() {
    var st = state(), types = st.types, N = total(types), n = Math.min(st.hand, N);
    ui.askType.innerHTML = types.map(function (t, i) { return '<option value="' + i + '"' + (i === st.ask.type ? ' selected' : '') + '>' + B.esc(t.name) + '</option>'; }).join('');
    ui.askN.textContent = n;
    var ti = Math.min(st.ask.type, types.length - 1), k = st.ask.k;
    if (ti < 0 || !N) { ui.exact.textContent = '—'; ui.sim.textContent = '—'; ui.table.innerHTML = ''; return; }
    var K = types[ti].count;
    ui.exact.textContent = B.pct(pAtLeast(N, K, n, k));
    // simulate
    var hits = 0;
    for (var s = 0; s < SIMS; s++) {
      var hand = shuffledDeck(types).slice(0, n), c = 0;
      for (var j = 0; j < hand.length; j++) if (hand[j] === ti) c++;
      if (c >= k) hits++;
    }
    ui.sim.textContent = B.pct(hits / SIMS);
    // table
    ui.table.innerHTML = '<table class="sheet"><thead><tr><th>Kind</th><th class="num">In deck</th><th class="num">Expected in hand</th><th class="num">At least 1</th><th class="num">None at all</th></tr></thead><tbody>' +
      types.map(function (t, i) {
        var p1 = pAtLeast(N, t.count, n, 1);
        return '<tr><td><i class="sw" style="--sw:var(' + SWATCH[i % SWATCH.length] + ')"></i>' + B.esc(t.name) + '</td><td class="num">' + t.count + ' <span class="muted">(' + B.pct(N ? t.count / N : 0) + ')</span></td>' +
          '<td class="num">' + (N ? (n * t.count / N).toFixed(1) : '—') + '</td><td class="num">' + B.pct(p1) + '</td><td class="num">' + B.pct(1 - p1) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }
  function exportCSV() {
    var st = state(), types = st.types, N = total(types), n = Math.min(st.hand, N);
    var rows = [['deck size', N], ['hand size', n], [], ['kind', 'in deck', 'share', 'expected in hand', 'p(at least 1)', 'p(none)']];
    types.forEach(function (t) {
      var p1 = pAtLeast(N, t.count, n, 1);
      rows.push([t.name, t.count, N ? (t.count / N).toFixed(4) : '', N ? (n * t.count / N).toFixed(3) : '', p1.toFixed(4), (1 - p1).toFixed(4)]);
    });
    B.downloadCSV(rows, 'deck-odds.csv');
  }

  B.register({ id: 'deck', mount: mount, unmount: unmount });
})();
