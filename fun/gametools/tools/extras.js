/* Extras: six small things for the table. Spinner, random tables, score
   pad, turn tracker, race simulator, point-cost balancer. */
(function () {
  'use strict';
  var B = window.Bench;
  var SWATCH = ['--berry', '--brass', '--felt', '--slate', '--plum', '--rust'];
  var INDEX = [['spin', 'Spinner'], ['tables', 'Random tables'], ['score', 'Score pad'], ['turns', 'Turn tracker'], ['race', 'Race'], ['balance', 'Balance']];

  var el, store = B.store, timers = [], tick = null, audio = null;
  var DEFAULT = {
    spinner: { wedges: [{ name: 'Move 1', w: 3 }, { name: 'Move 2', w: 2 }, { name: 'Lose a turn', w: 1 }, { name: 'Move 3', w: 1 }] },
    tables: [{ name: 'What is in the room', die: 6, rows: ['A sleeping guard', 'A locked chest', 'Nothing, and that is suspicious', 'A trapdoor', 'A friendly ghost', 'Treasure, but cursed'] }],
    score: { players: ['Ana', 'Ben', 'Chen'], rounds: [[0, 0, 0]] },
    turns: { players: ['Ana', 'Ben', 'Chen'], current: 0, round: 1, limit: 30 },
    race: { players: 4, track: 20, again: true },
    balance: { stats: [{ name: 'Attack', cost: 2 }, { name: 'Health', cost: 1 }, { name: 'Range', cost: 3 }], units: [{ name: 'Knight', v: [3, 4, 1] }, { name: 'Archer', v: [2, 2, 3] }, { name: 'Dragon', v: [5, 6, 2] }] }
  };
  function state() { var s = store.get('extras') || {}; var o = {}; Object.keys(DEFAULT).forEach(function (k) { o[k] = s[k] || JSON.parse(JSON.stringify(DEFAULT[k])); }); return o; }
  function save(k, v) { var s = state(); s[k] = v; store.set('extras', s); }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function section(id, title, intro, body) { return '<section class="panel sim" id="ex-' + id + '"><p class="kicker">Extras</p><h2>' + title + '</h2><p>' + intro + '</p>' + body + '</section>'; }

  function mount(root) {
    el = root;
    el.innerHTML =
      '<section class="panel"><p class="kicker">Extras</p><h2>Small things for the table</h2><p>Each one is tiny on purpose. Use it as is, or copy the idea into your game.</p>' +
        '<nav class="sim-index">' + INDEX.map(function (i) { return '<a href="#extras" data-jump="' + i[0] + '">' + i[1] + '</a>'; }).join('') + '</nav></section>' +
      spinSection() + tablesSection() + scoreSection() + turnsSection() + raceSection() + balanceSection();
    el.querySelector('.sim-index').addEventListener('click', function (e) {
      var a = e.target.closest('[data-jump]'); if (!a) return; e.preventDefault();
      var t = el.querySelector('#ex-' + a.dataset.jump); if (t) t.scrollIntoView({ behavior: B.reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    });
    wireSpin(); wireTables(); wireScore(); wireTurns(); wireRace(); wireBalance();
  }
  function unmount() { timers.forEach(clearTimeout); timers = []; if (tick) clearInterval(tick); tick = null; el = null; }

  /* ---------- spinner ---------- */
  function spinSection() {
    return section('spin', 'Spinner', 'Wedges can be different sizes. A wide wedge is a loaded die that everyone can see, which is sometimes exactly what a game for younger players needs.',
      '<div class="tool-grid"><div><div class="ex-wheel"><div class="ex-pointer"></div><div class="ex-disc"></div></div><div class="btn-row" style="justify-content:center;margin-top:10px"><button class="btn" type="button" data-spin>Spin</button><b class="num ex-spin-result"></b></div></div>' +
      '<div><div class="label">Wedges</div><div class="ex-wedges"></div><button class="btn paper sm" type="button" data-wedge-add>Add a wedge</button></div></div>');
  }
  function wireSpin() {
    var disc = el.querySelector('.ex-disc'), list = el.querySelector('.ex-wedges'), out = el.querySelector('.ex-spin-result'), angle = 0;
    function wedges() { return state().spinner.wedges; }
    function draw() {
      var ws = wedges(), total = ws.reduce(function (a, w) { return a + (w.w || 1); }, 0), a0 = -90, svg = '<svg viewBox="-50 -50 100 100">';
      ws.forEach(function (w, i) {
        var sweep = 360 * (w.w || 1) / total, a1 = a0 + sweep, large = sweep > 180 ? 1 : 0;
        var x0 = 48 * Math.cos(a0 * Math.PI / 180), y0 = 48 * Math.sin(a0 * Math.PI / 180), x1 = 48 * Math.cos(a1 * Math.PI / 180), y1 = 48 * Math.sin(a1 * Math.PI / 180);
        svg += '<path d="M0 0 L' + x0.toFixed(2) + ' ' + y0.toFixed(2) + ' A48 48 0 ' + large + ' 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' z" fill="' + cssVar(SWATCH[i % SWATCH.length]) + '" stroke="' + cssVar('--bone') + '" stroke-width="1"/>';
        var am = (a0 + a1) / 2 * Math.PI / 180, tx = 30 * Math.cos(am), ty = 30 * Math.sin(am);
        svg += '<text x="' + tx.toFixed(2) + '" y="' + ty.toFixed(2) + '" text-anchor="middle" font-size="' + Math.min(6, 140 / Math.max(6, w.name.length * 1.6)) + '" font-weight="700" fill="#fff" transform="rotate(' + ((a0 + a1) / 2) + ' ' + tx.toFixed(2) + ' ' + ty.toFixed(2) + ')">' + B.esc(w.name) + '</text>';
        a0 = a1;
      });
      svg += '<circle r="4" fill="' + cssVar('--bone') + '"/></svg>';
      disc.innerHTML = svg;
      list.innerHTML = ws.map(function (w, i) {
        return '<div class="ex-wedge" style="--sw:var(' + SWATCH[i % SWATCH.length] + ')"><span class="sw"></span><input class="input" type="text" value="' + B.esc(w.name) + '" data-i="' + i + '" data-k="name" aria-label="Wedge name" maxlength="20"><input class="input mono" type="number" min="1" max="20" value="' + (w.w || 1) + '" data-i="' + i + '" data-k="w" aria-label="Weight"><button type="button" class="pt-x" data-del="' + i + '" aria-label="Remove">✕</button></div>';
      }).join('');
    }
    list.addEventListener('input', function (e) {
      var inp = e.target; if (!inp.dataset.k) return;
      var ws = wedges(); ws[+inp.dataset.i][inp.dataset.k] = inp.dataset.k === 'w' ? Math.max(1, parseInt(inp.value, 10) || 1) : inp.value; save('spinner', { wedges: ws });
      if (inp.dataset.k === 'w') draw(); else disc.innerHTML = disc.innerHTML; // names redraw on next spin
    });
    list.addEventListener('click', function (e) { var b = e.target.closest('[data-del]'); if (!b) return; var ws = wedges(); if (ws.length <= 2) return; ws.splice(+b.dataset.del, 1); save('spinner', { wedges: ws }); draw(); });
    el.querySelector('[data-wedge-add]').addEventListener('click', function () { var ws = wedges(); if (ws.length >= 12) return; ws.push({ name: 'Wedge ' + (ws.length + 1), w: 1 }); save('spinner', { wedges: ws }); draw(); });
    el.querySelector('[data-spin]').addEventListener('click', function () {
      draw();
      var ws = wedges(), total = ws.reduce(function (a, w) { return a + (w.w || 1); }, 0);
      var r = B.rand(total), acc = 0, pick = 0, start = 0;
      for (var i = 0; i < ws.length; i++) { if (r <= acc + (ws[i].w || 1)) { pick = i; start = acc; break; } acc += ws[i].w || 1; }
      // land the pointer (at top) inside the chosen wedge
      var mid = 360 * (start + (ws[pick].w || 1) * (0.2 + 0.6 * Math.random())) / total;
      var target = 360 * (4 + B.rand(3)) - mid;
      angle = angle - (angle % 360) + target;
      disc.style.transition = B.reducedMotion() ? 'none' : 'transform 2.6s cubic-bezier(.15,.85,.2,1)';
      disc.style.transform = 'rotate(' + angle + 'deg)';
      out.textContent = '…';
      later(function () { out.textContent = ws[pick].name; }, B.reducedMotion() ? 0 : 2600);
    });
    draw();
  }

  /* ---------- random tables ---------- */
  function tablesSection() {
    return section('tables', 'Random tables', 'A d6 table of events is the cheapest mechanic there is. Write one line per result, roll on it.',
      '<div class="ex-tables"></div><button class="btn paper sm" type="button" data-table-add>New table</button>');
  }
  function wireTables() {
    var box = el.querySelector('.ex-tables');
    function tables() { return state().tables; }
    function draw() {
      box.innerHTML = tables().map(function (t, ti) {
        return '<div class="ex-table" data-t="' + ti + '"><div class="ex-table-head"><input class="input" type="text" value="' + B.esc(t.name) + '" data-k="name" aria-label="Table name" maxlength="40">' +
          '<select class="input" data-k="die" aria-label="Die">' + [4, 6, 8, 10, 12, 20].map(function (d) { return '<option value="' + d + '"' + (d === t.die ? ' selected' : '') + '>d' + d + '</option>'; }).join('') + '</select>' +
          '<button class="btn sm" type="button" data-roll-table>Roll</button><button type="button" class="pt-x" data-del-table aria-label="Delete table">✕</button></div>' +
          '<div class="ex-table-result num"></div>' +
          '<ol class="ex-table-rows">' + Array.apply(null, { length: t.die }).map(function (_, i) { return '<li><input class="input" type="text" value="' + B.esc(t.rows[i] || '') + '" data-row="' + i + '" placeholder="…" aria-label="Result ' + (i + 1) + '"></li>'; }).join('') + '</ol>' +
          '<button class="btn paper sm" type="button" data-print-table>Print</button></div>';
      }).join('');
    }
    box.addEventListener('input', function (e) {
      var inp = e.target, ti = +inp.closest('.ex-table').dataset.t, ts = tables();
      if (inp.dataset.row != null) ts[ti].rows[+inp.dataset.row] = inp.value;
      else if (inp.dataset.k === 'name') ts[ti].name = inp.value;
      else if (inp.dataset.k === 'die') { ts[ti].die = +inp.value; save('tables', ts); draw(); return; }
      save('tables', ts);
    });
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var card = b.closest('.ex-table'), ti = +card.dataset.t, ts = tables(), t = ts[ti];
      if (b.dataset.delTable != null) { if (confirm('Delete this table?')) { ts.splice(ti, 1); save('tables', ts); draw(); } return; }
      if (b.dataset.printTable != null) { B.printSection(B.el('<section class="panel"><h2>' + B.esc(t.name) + ' (d' + t.die + ')</h2><table class="sheet"><tbody>' + t.rows.slice(0, t.die).map(function (r, i) { return '<tr><td class="num" style="width:3em"><b>' + (i + 1) + '</b></td><td>' + B.esc(r || '') + '</td></tr>'; }).join('') + '</tbody></table></section>')); return; }
      if (b.dataset.rollTable != null) {
        var out = card.querySelector('.ex-table-result'), n = B.rand(t.die), ms = B.reducedMotion() ? 0 : 700, t0 = performance.now();
        (function flick() {
          if (performance.now() - t0 < ms) { out.textContent = B.rand(t.die); later(flick, 60); return; }
          out.innerHTML = '<b>' + n + '</b> ' + B.esc(t.rows[n - 1] || '(blank)');
          card.querySelectorAll('.ex-table-rows li').forEach(function (li, i) { li.classList.toggle('hit', i === n - 1); });
        })();
      }
    });
    el.querySelector('[data-table-add]').addEventListener('click', function () { var ts = tables(); ts.push({ name: 'Table ' + (ts.length + 1), die: 6, rows: [] }); save('tables', ts); draw(); });
    draw();
  }

  /* ---------- score pad ---------- */
  function scoreSection() {
    return section('score', 'Score pad', 'Names across the top, a row per round, totals at the bottom. For any game that keeps score.',
      '<div class="ex-score"></div><div class="btn-row" style="margin-top:10px"><button class="btn sm" type="button" data-round-add>Add a round</button><button class="btn paper sm" type="button" data-player-add>Add a player</button><button class="btn paper sm" type="button" data-score-csv>Download (CSV)</button><button class="btn paper sm" type="button" data-score-reset>New game</button></div>');
  }
  function wireScore() {
    var box = el.querySelector('.ex-score');
    function sc() { return state().score; }
    function draw() {
      var s = sc(), totals = s.players.map(function (_, p) { return s.rounds.reduce(function (a, r) { return a + (r[p] || 0); }, 0); });
      box.innerHTML = '<table class="sheet ex-score-table"><thead><tr><th></th>' + s.players.map(function (n, p) { return '<th><input class="input" type="text" value="' + B.esc(n) + '" data-p="' + p + '" aria-label="Player name" maxlength="14"></th>'; }).join('') + '</tr></thead><tbody>' +
        s.rounds.map(function (r, ri) { return '<tr><th class="num">' + (ri + 1) + '</th>' + s.players.map(function (_, p) { return '<td><input class="input mono" type="number" value="' + (r[p] || 0) + '" data-r="' + ri + '" data-c="' + p + '" aria-label="Score"></td>'; }).join('') + '</tr>'; }).join('') +
        '</tbody><tfoot><tr><th>Total</th>' + totals.map(function (t, p) { var lead = t === Math.max.apply(null, totals) && s.rounds.length; return '<td class="num' + (lead ? ' lead' : '') + '">' + t + '</td>'; }).join('') + '</tr></tfoot></table>';
    }
    box.addEventListener('input', function (e) {
      var inp = e.target, s = sc();
      if (inp.dataset.p != null) { s.players[+inp.dataset.p] = inp.value; save('score', s); return; }
      if (inp.dataset.r != null) { s.rounds[+inp.dataset.r][+inp.dataset.c] = parseInt(inp.value, 10) || 0; save('score', s); var tf = box.querySelector('tfoot'); var totals = s.players.map(function (_, p) { return s.rounds.reduce(function (a, r) { return a + (r[p] || 0); }, 0); }); tf.querySelectorAll('td').forEach(function (td, p) { td.textContent = totals[p]; td.classList.toggle('lead', totals[p] === Math.max.apply(null, totals)); }); }
    });
    el.querySelector('[data-round-add]').addEventListener('click', function () { var s = sc(); s.rounds.push(s.players.map(function () { return 0; })); save('score', s); draw(); });
    el.querySelector('[data-player-add]').addEventListener('click', function () { var s = sc(); if (s.players.length >= 8) return; s.players.push('Player ' + (s.players.length + 1)); s.rounds.forEach(function (r) { r.push(0); }); save('score', s); draw(); });
    el.querySelector('[data-score-reset]').addEventListener('click', function () { var s = sc(); s.rounds = [s.players.map(function () { return 0; })]; save('score', s); draw(); });
    el.querySelector('[data-score-csv]').addEventListener('click', function () { var s = sc(); B.downloadCSV([['round'].concat(s.players)].concat(s.rounds.map(function (r, i) { return [i + 1].concat(r); })), 'scores.csv'); });
    draw();
  }

  /* ---------- turn tracker ---------- */
  function turnsSection() {
    return section('turns', 'Turn tracker', 'Whose turn it is, which round, and a timer that buzzes. Thirty seconds a turn is a training tool: the game gets faster because the players do.',
      '<div class="ex-turns"><div class="ex-turn-now"><span class="label">Now</span><b class="ex-turn-name"></b><span class="muted ex-turn-round"></span></div><div class="ex-turn-clock num">0</div>' +
      '<div class="btn-row" style="justify-content:center"><button class="btn big" type="button" data-turn-next>Next turn</button><button class="btn paper sm" type="button" data-turn-reset>Round 1</button></div>' +
      '<div class="btn-row" style="justify-content:center;margin-top:10px"><span class="label">Seconds a turn</span><div class="seg" role="group" aria-label="Turn limit">' + [20, 30, 45, 60, 0].map(function (s) { return '<button type="button" data-limit="' + s + '">' + (s || 'none') + '</button>'; }).join('') + '</div></div>' +
      '<div class="ex-turn-players"></div></div>');
  }
  function wireTurns() {
    var t0 = null;
    function tr() { return state().turns; }
    function beep() {
      try {
        audio = audio || new (window.AudioContext || window.webkitAudioContext)();
        var o = audio.createOscillator(), g = audio.createGain(); o.connect(g); g.connect(audio.destination);
        o.frequency.value = 660; g.gain.value = 0.15; o.start(); o.stop(audio.currentTime + 0.18);
      } catch (e) { /* no audio, the flash still happens */ }
    }
    function draw() {
      var t = tr();
      el.querySelector('.ex-turn-name').textContent = t.players[t.current] || '—';
      el.querySelector('.ex-turn-round').textContent = 'Round ' + t.round;
      el.querySelectorAll('[data-limit]').forEach(function (b) { b.classList.toggle('on', +b.dataset.limit === t.limit); });
      el.querySelector('.ex-turn-players').innerHTML = t.players.map(function (n, i) { return '<input class="input" type="text" value="' + B.esc(n) + '" data-tp="' + i + '" aria-label="Player ' + (i + 1) + '" maxlength="14"' + (i === t.current ? ' style="border-color:var(--berry)"' : '') + '>'; }).join('') + (t.players.length < 8 ? '<button class="btn paper sm" type="button" data-tp-add>+</button>' : '');
    }
    function clockTick() {
      if (t0 == null) return;
      var t = tr(), s = Math.floor((Date.now() - t0) / 1000), c = el.querySelector('.ex-turn-clock');
      c.textContent = t.limit ? Math.max(0, t.limit - s) : s;
      var over = t.limit && s >= t.limit;
      c.classList.toggle('over', !!over);
      if (over && s === t.limit) beep();
    }
    el.querySelector('[data-turn-next]').addEventListener('click', function () {
      var t = tr(); if (t0 != null) { t.current = (t.current + 1) % t.players.length; if (t.current === 0) t.round++; }
      save('turns', t); t0 = Date.now(); draw(); clockTick();
      if (!tick) tick = setInterval(clockTick, 250);
    });
    el.querySelector('[data-turn-reset]').addEventListener('click', function () { var t = tr(); t.current = 0; t.round = 1; save('turns', t); t0 = null; el.querySelector('.ex-turn-clock').textContent = t.limit || 0; el.querySelector('.ex-turn-clock').classList.remove('over'); draw(); });
    el.querySelector('.ex-turns').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.limit != null) { var t = tr(); t.limit = +b.dataset.limit; save('turns', t); draw(); }
      if (b.dataset.tpAdd != null) { var t2 = tr(); t2.players.push('Player ' + (t2.players.length + 1)); save('turns', t2); draw(); }
    });
    el.querySelector('.ex-turn-players').addEventListener('input', function (e) { var inp = e.target; if (inp.dataset.tp == null) return; var t = tr(); t.players[+inp.dataset.tp] = inp.value; save('turns', t); el.querySelector('.ex-turn-name').textContent = t.players[t.current]; });
    draw(); el.querySelector('.ex-turn-clock').textContent = tr().limit || 0;
  }

  /* ---------- race simulator ---------- */
  function raceSection() {
    return section('race', 'Race', 'A race game before it exists: everyone rolls a d6 and moves. Run it a thousand times and see how long it takes and whether going first matters.',
      '<div class="btn-row"><label class="deck-hand">Players <input class="input mono" type="number" min="2" max="8" value="4" data-race="players"></label><label class="deck-hand">Track <input class="input mono" type="number" min="5" max="100" value="20" data-race="track"></label>' +
      '<label class="sheet-check"><input type="checkbox" data-race="again" checked> Roll again on a 6</label><button class="btn" type="button" data-race-run>Race 1,000 times</button></div>' +
      '<div class="ex-race-out"></div>');
  }
  function wireRace() {
    var out = el.querySelector('.ex-race-out'), r = state().race;
    el.querySelector('[data-race="players"]').value = r.players; el.querySelector('[data-race="track"]').value = r.track; el.querySelector('[data-race="again"]').checked = !!r.again;
    el.querySelector('[data-race-run]').addEventListener('click', function () {
      var players = Math.max(2, Math.min(8, +el.querySelector('[data-race="players"]').value || 4)), track = Math.max(5, Math.min(100, +el.querySelector('[data-race="track"]').value || 20)), again = el.querySelector('[data-race="again"]').checked;
      save('race', { players: players, track: track, again: again });
      var wins = new Array(players).fill(0), rounds = 0, N = 1000;
      for (var g = 0; g < N; g++) {
        var pos = new Array(players).fill(0), round = 0, winner = -1;
        while (winner < 0) {
          round++;
          for (var p = 0; p < players && winner < 0; p++) {
            var n; do { n = B.rand(6); pos[p] += n; if (pos[p] >= track) { winner = p; break; } } while (again && n === 6);
          }
        }
        wins[winner]++; rounds += round;
      }
      var maxW = Math.max.apply(null, wins), fair = 100 / players;
      out.innerHTML = '<div class="setup-stats" style="margin-top:12px"><div class="stat"><b class="num">' + (rounds / N).toFixed(1) + '</b><span>rounds per race</span></div><div class="stat"><b class="num">' + B.pct(wins[0] / N) + '</b><span>first player wins</span></div><div class="stat"><b class="num">' + B.pct(1 / players) + '</b><span>would be fair</span></div></div>' +
        '<div class="label" style="margin-top:12px">Wins by seat</div>' + wins.map(function (w, i) { return '<div class="kind-bar"><span>Seat ' + (i + 1) + '</span><i style="width:' + (100 * w / maxW) + '%"' + (w / N > fair / 100 + 0.04 ? ' class="top"' : '') + '></i><b class="num">' + B.pct(w / N) + '</b></div>'; }).join('') +
        '<p class="sim-ask">If seat 1 wins more than its share, going first is an advantage. Fixes: last player starts one space ahead, or the round finishes so everyone gets equal turns, or the race is to a score, not a space.</p>';
    });
  }

  /* ---------- balance ---------- */
  function balanceSection() {
    return section('balance', 'Balance', 'Give every stat a price. The tool prices every unit and flags the ones that are far from the middle. Crude, and crude is the right level: it makes “balance with numbers” a thing you can do in a lunch break.',
      '<div class="tool-grid"><div><div class="label">Stats and what a point costs</div><div class="ex-stats"></div><button class="btn paper sm" type="button" data-stat-add>Add a stat</button></div>' +
      '<div><div class="label">Units</div><div class="ex-units"></div><button class="btn paper sm" type="button" data-unit-add>Add a unit</button></div></div><p class="ex-balance-note muted" style="font-size:13px;margin-top:10px"></p>');
  }
  function wireBalance() {
    function bal() { return state().balance; }
    function cost(u, b) { return u.v.reduce(function (a, v, i) { return a + (v || 0) * (b.stats[i] ? b.stats[i].cost : 0); }, 0); }
    function draw() {
      var b = bal(), costs = b.units.map(function (u) { return cost(u, b); }), sorted = costs.slice().sort(function (x, y) { return x - y; }), med = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
      el.querySelector('.ex-stats').innerHTML = b.stats.map(function (s, i) { return '<div class="ex-stat"><input class="input" type="text" value="' + B.esc(s.name) + '" data-s="' + i + '" data-k="name" aria-label="Stat" maxlength="14"><input class="input mono" type="number" min="0" step="0.5" value="' + s.cost + '" data-s="' + i + '" data-k="cost" aria-label="Cost per point"><button type="button" class="pt-x" data-del-stat="' + i + '" aria-label="Remove">✕</button></div>'; }).join('');
      el.querySelector('.ex-units').innerHTML = '<table class="sheet ex-units-table"><thead><tr><th>Unit</th>' + b.stats.map(function (s) { return '<th>' + B.esc(s.name) + '</th>'; }).join('') + '<th class="num">Cost</th><th></th></tr></thead><tbody>' +
        b.units.map(function (u, ui) {
          var c = costs[ui], off = med ? (c - med) / med : 0;
          return '<tr><td><input class="input" type="text" value="' + B.esc(u.name) + '" data-u="' + ui + '" data-k="name" aria-label="Unit" maxlength="14"></td>' + b.stats.map(function (s, si) { return '<td><input class="input mono" type="number" min="0" value="' + (u.v[si] || 0) + '" data-u="' + ui + '" data-v="' + si + '" aria-label="' + B.esc(s.name) + '"></td>'; }).join('') +
            '<td class="num' + (Math.abs(off) > 0.25 ? ' lead' : '') + '"><b>' + c + '</b>' + (Math.abs(off) > 0.25 ? ' <span class="badge berry">' + (off > 0 ? '+' : '') + Math.round(off * 100) + '%</span>' : '') + '</td><td><button type="button" class="pt-x" data-del-unit="' + ui + '" aria-label="Remove">✕</button></td></tr>';
        }).join('') + '</tbody></table>';
      el.querySelector('.ex-balance-note').textContent = b.units.length ? 'Middle cost is ' + med + '. Anything more than 25% away is flagged. A flagged unit is not wrong; it needs a higher price, a drawback, or fewer of them in the box.' : '';
    }
    el.querySelector('#ex-balance').addEventListener('input', function (e) {
      var inp = e.target, b = bal();
      if (inp.dataset.s != null) { var s = b.stats[+inp.dataset.s]; if (inp.dataset.k === 'name') s.name = inp.value; else s.cost = parseFloat(inp.value) || 0; }
      else if (inp.dataset.u != null) { var u = b.units[+inp.dataset.u]; if (inp.dataset.k === 'name') u.name = inp.value; else u.v[+inp.dataset.v] = parseInt(inp.value, 10) || 0; }
      else return;
      save('balance', b);
      if (inp.dataset.k === 'name') return;   // keep focus while typing names
      var focus = document.activeElement, sel = focus && focus.dataset ? '[data-u="' + focus.dataset.u + '"][data-v="' + focus.dataset.v + '"],[data-s="' + focus.dataset.s + '"][data-k="' + focus.dataset.k + '"]' : null;
      draw();
      if (sel) { var again = el.querySelector(sel); if (again) { again.focus(); } }
    });
    el.querySelector('#ex-balance').addEventListener('click', function (e) {
      var btn = e.target.closest('button'); if (!btn) return; var b = bal();
      if (btn.dataset.statAdd != null) { if (b.stats.length < 6) { b.stats.push({ name: 'Stat', cost: 1 }); b.units.forEach(function (u) { u.v.push(0); }); } }
      else if (btn.dataset.unitAdd != null) { if (b.units.length < 20) b.units.push({ name: 'Unit', v: b.stats.map(function () { return 1; }) }); }
      else if (btn.dataset.delStat != null) { var i = +btn.dataset.delStat; b.stats.splice(i, 1); b.units.forEach(function (u) { u.v.splice(i, 1); }); }
      else if (btn.dataset.delUnit != null) b.units.splice(+btn.dataset.delUnit, 1);
      else return;
      save('balance', b); draw();
    });
    draw();
  }

  B.register({ id: 'extras', title: 'Extras', blurb: 'Spinner, random tables, score pad, turn timer, race, balance.', mount: mount, unmount: unmount });
})();
