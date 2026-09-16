/* Playtest: a stopwatch with phases, tap counters, and a question log, made
   for a phone at the table. A live session survives reloads. */
(function () {
  'use strict';
  var B = window.Bench;

  var PHASES = [
    { k: 'setup', name: 'Set up', v: '--brass' },
    { k: 'teach', name: 'Teach', v: '--slate' },
    { k: 'play',  name: 'Play', v: '--berry' },
    { k: 'pack',  name: 'Pack away', v: '--felt' }
  ];
  var DEFAULT_TALLIES = ['Rule looked up', 'Question asked', 'Misplay', 'Someone drifted off'];

  var el, store, ui = {}, tick = null;

  // live = { started, phase, phaseStart, laps: {setup,teach,play,pack}, tallies: [{name,n}], questions: [{t,text}] }
  function live() { return store.get('playtestLive') || null; }
  function setLive(v) { store.set('playtestLive', v); }
  function now() { return Date.now(); }
  function fresh() {
    return { started: null, phase: null, phaseStart: null, laps: { setup: 0, teach: 0, play: 0, pack: 0 },
      tallies: DEFAULT_TALLIES.map(function (n) { return { name: n, n: 0 }; }), questions: [] };
  }
  function elapsedIn(l, k) { return (l.laps[k] || 0) + (l.phase === k && l.phaseStart ? (now() - l.phaseStart) / 1000 : 0); }
  function totalElapsed(l) { return PHASES.reduce(function (a, p) { return a + elapsedIn(l, p.k); }, 0); }
  function clock(sec) { sec = Math.max(0, Math.floor(sec)); var m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; }

  function mount(root, s) {
    el = root; store = s;
    if (!live()) setLive(fresh());
    el.innerHTML =
      '<section class="panel pt-clock-panel">' +
        '<p class="kicker">Playtest</p>' +
        '<div class="pt-clock num" aria-live="off">0:00</div>' +
        '<p class="pt-phase-name muted">Tap a phase to start timing it.</p>' +
        '<div class="pt-phases">' +
          PHASES.map(function (p) { return '<button type="button" class="pt-phase" data-phase="' + p.k + '" style="--sw:var(' + p.v + ')" aria-label="Time ' + p.name + '"><span>' + p.name + '</span><b class="num">0:00</b></button>'; }).join('') +
        '</div>' +
        '<div class="btn-row" style="margin-top:12px">' +
          '<button class="btn paper sm" type="button" data-pause>Pause</button>' +
          '<button class="btn brass" type="button" data-finish>Finish and save</button>' +
          '<button class="btn paper sm" type="button" data-discard>Discard</button>' +
        '</div>' +
      '</section>' +
      '<div class="tool-grid">' +
        '<section class="panel">' +
          '<p class="kicker">Tally</p>' +
          '<h2>What happened</h2>' +
          '<p>Tap once each time. Rename them to whatever you are watching for.</p>' +
          '<div class="pt-tallies"></div>' +
          '<form class="pt-add"><input class="input" placeholder="Something else to count" maxlength="30" aria-label="New counter"><button class="btn paper sm" type="submit">Add</button></form>' +
        '</section>' +
        '<section class="panel">' +
          '<p class="kicker">Questions</p>' +
          '<h2>What they asked</h2>' +
          '<p>Every question a tester asks is a hole in the rules. Log it with the time.</p>' +
          '<form class="pt-ask"><input class="input" placeholder="“Can I move diagonally?”" maxlength="120" aria-label="Question asked"><button class="btn sm" type="submit">Log</button></form>' +
          '<ol class="pt-questions"></ol>' +
        '</section>' +
      '</div>' +
      '<section class="panel">' +
        '<p class="kicker">Saved</p>' +
        '<h2>Past playtests</h2>' +
        '<div class="pt-past"></div>' +
        '<div class="btn-row" style="margin-top:12px">' +
          '<button class="btn paper sm" type="button" data-csv-all>Download all (CSV)</button>' +
          '<button class="btn paper sm" type="button" data-blank>Print a blank tally sheet</button>' +
        '</div>' +
      '</section>';

    ui.clock = el.querySelector('.pt-clock');
    ui.phaseName = el.querySelector('.pt-phase-name');
    ui.tallies = el.querySelector('.pt-tallies');
    ui.questions = el.querySelector('.pt-questions');
    ui.past = el.querySelector('.pt-past');
    ui.pause = el.querySelector('[data-pause]');

    el.querySelector('.pt-phases').addEventListener('click', function (e) {
      var b = e.target.closest('.pt-phase'); if (!b) return; startPhase(b.dataset.phase);
    });
    ui.pause.addEventListener('click', pause);
    el.querySelector('[data-finish]').addEventListener('click', finish);
    el.querySelector('[data-discard]').addEventListener('click', function () {
      if (confirm('Throw this playtest away?')) { setLive(fresh()); renderAll(); }
    });
    ui.tallies.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var row = b.closest('.pt-tally'), l = live(), i = +row.dataset.i;
      if (b.dataset.remove != null) { l.tallies.splice(i, 1); setLive(l); renderTallies(); return; }
      l.tallies[i].n = b.dataset.minus != null ? Math.max(0, l.tallies[i].n - 1) : l.tallies[i].n + 1;
      setLive(l); row.querySelector('.pt-count b').textContent = l.tallies[i].n;
    });
    ui.tallies.addEventListener('input', function (e) {
      var inp = e.target; if (!inp.dataset.name) return;
      var l = live(); l.tallies[+inp.closest('.pt-tally').dataset.i].name = inp.value; setLive(l);
    });
    el.querySelector('.pt-add').addEventListener('submit', function (e) {
      e.preventDefault(); var inp = e.target.querySelector('input'); var v = inp.value.trim(); if (!v) return;
      var l = live(); l.tallies.push({ name: v, n: 0 }); setLive(l); inp.value = ''; renderTallies();
    });
    el.querySelector('.pt-ask').addEventListener('submit', function (e) {
      e.preventDefault(); var inp = e.target.querySelector('input'); var v = inp.value.trim(); if (!v) return;
      var l = live(); l.questions.push({ t: Math.round(totalElapsed(l)), phase: l.phase, text: v }); setLive(l); inp.value = ''; renderQuestions();
    });
    ui.questions.addEventListener('click', function (e) {
      var b = e.target.closest('[data-del]'); if (!b) return;
      var l = live(); l.questions.splice(+b.dataset.del, 1); setLive(l); renderQuestions();
    });
    el.querySelector('[data-csv-all]').addEventListener('click', exportAll);
    el.querySelector('[data-blank]').addEventListener('click', printBlank);
    ui.past.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var list = store.get('playtests'), i = +b.dataset.i;
      if (b.dataset.csv != null) exportOne(list[i]);
      if (b.dataset.remove != null && confirm('Delete this playtest?')) { list = list.slice(); list.splice(i, 1); store.set('playtests', list); renderPast(); }
    });

    renderAll();
    tick = setInterval(renderClock, 500);
  }
  function unmount() { clearInterval(tick); tick = null; el = null; ui = {}; }

  /* ---------- timing ---------- */
  function startPhase(k) {
    var l = live();
    if (l.phase === k) return;
    if (l.phase && l.phaseStart) l.laps[l.phase] += (now() - l.phaseStart) / 1000;
    if (!l.started) l.started = now();
    l.phase = k; l.phaseStart = now();
    setLive(l); renderClock(); renderPhases();
  }
  function pause() {
    var l = live();
    if (!l.phase) return;
    l.laps[l.phase] += (now() - l.phaseStart) / 1000;
    l.phase = null; l.phaseStart = null;
    setLive(l); renderClock(); renderPhases();
  }
  function finish() {
    var l = live();
    if (l.phase && l.phaseStart) { l.laps[l.phase] += (now() - l.phaseStart) / 1000; l.phase = null; l.phaseStart = null; }
    if (!l.started && !l.questions.length && !l.tallies.some(function (t) { return t.n; })) { alert('Nothing to save yet. Time a phase or count something first.'); return; }
    var entry = { t: l.started || now(), laps: l.laps, tallies: {}, questions: l.questions };
    l.tallies.forEach(function (t) { entry.tallies[t.name] = t.n; });
    store.set('playtests', store.get('playtests').concat([entry]));
    var next = fresh(); next.tallies = l.tallies.map(function (t) { return { name: t.name, n: 0 }; });
    setLive(next); renderAll();
  }

  /* ---------- render ---------- */
  function renderAll() { renderClock(); renderPhases(); renderTallies(); renderQuestions(); renderPast(); }
  function renderClock() {
    if (!ui.clock) return;
    var l = live();
    ui.clock.textContent = clock(totalElapsed(l));
    ui.clock.classList.toggle('running', !!l.phase);
    PHASES.forEach(function (p) { var b = el.querySelector('[data-phase="' + p.k + '"] b'); if (b) b.textContent = clock(elapsedIn(l, p.k)); });
  }
  function renderPhases() {
    var l = live();
    el.querySelectorAll('.pt-phase').forEach(function (b) { b.classList.toggle('on', b.dataset.phase === l.phase); });
    var p = PHASES.find(function (x) { return x.k === l.phase; });
    ui.phaseName.textContent = p ? 'Timing: ' + p.name : (l.started ? 'Paused. Tap a phase to carry on.' : 'Tap a phase to start timing it.');
    ui.pause.disabled = !l.phase;
  }
  function renderTallies() {
    var l = live();
    ui.tallies.innerHTML = l.tallies.map(function (t, i) {
      return '<div class="pt-tally" data-i="' + i + '">' +
        '<button type="button" class="pt-count" aria-label="Count ' + B.esc(t.name) + '"><b class="num">' + t.n + '</b></button>' +
        '<input class="input" type="text" value="' + B.esc(t.name) + '" data-name aria-label="Counter name" maxlength="30">' +
        '<button type="button" class="btn paper sm" data-minus aria-label="Take one off">−</button>' +
        '<button type="button" class="btn paper sm" data-remove aria-label="Remove counter">✕</button>' +
      '</div>';
    }).join('');
  }
  function renderQuestions() {
    var l = live();
    ui.questions.innerHTML = l.questions.length ? l.questions.map(function (q, i) {
      return '<li><span class="num muted">' + clock(q.t) + '</span> ' + B.esc(q.text) + ' <button type="button" class="pt-x" data-del="' + i + '" aria-label="Remove">✕</button></li>';
    }).join('') : '<li class="muted" style="list-style:none">None yet.</li>';
  }
  function renderPast() {
    var list = store.get('playtests');
    ui.past.innerHTML = list.length ? '<table class="sheet"><thead><tr><th>When</th><th class="num">Set up</th><th class="num">Teach</th><th class="num">Play</th><th class="num">Pack</th><th class="num">Total</th><th>Tallies</th><th class="num">Questions</th><th></th></tr></thead><tbody>' +
      list.slice().reverse().map(function (p, ri) {
        var i = list.length - 1 - ri, total = PHASES.reduce(function (a, ph) { return a + (p.laps[ph.k] || 0); }, 0);
        var tal = Object.keys(p.tallies).filter(function (k) { return p.tallies[k]; }).map(function (k) { return B.esc(k) + ' ' + p.tallies[k]; }).join(', ') || '—';
        return '<tr><td>' + new Date(p.t).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) + '</td>' +
          PHASES.map(function (ph) { return '<td class="num">' + clock(p.laps[ph.k] || 0) + '</td>'; }).join('') +
          '<td class="num"><b>' + clock(total) + '</b></td><td>' + tal + '</td><td class="num">' + p.questions.length + '</td>' +
          '<td><div class="btn-row" style="flex-wrap:nowrap;gap:6px"><button type="button" class="btn paper sm" data-csv data-i="' + i + '">CSV</button><button type="button" class="btn paper sm" data-remove data-i="' + i + '" aria-label="Delete">✕</button></div></td></tr>';
      }).join('') + '</tbody></table>' : '<p class="muted">No playtests saved yet. Finish one above and it lands here.</p>';
  }

  /* ---------- export ---------- */
  function rowsFor(p) {
    var out = [['playtest', new Date(p.t).toISOString()], [], ['phase', 'seconds']];
    PHASES.forEach(function (ph) { out.push([ph.name, Math.round(p.laps[ph.k] || 0)]); });
    out.push([]); out.push(['counter', 'count']);
    Object.keys(p.tallies).forEach(function (k) { out.push([k, p.tallies[k]]); });
    out.push([]); out.push(['time', 'phase', 'question']);
    p.questions.forEach(function (q) { out.push([clock(q.t), q.phase || '', q.text]); });
    return out;
  }
  function exportOne(p) { B.downloadCSV(rowsFor(p), 'playtest-' + new Date(p.t).toISOString().slice(0, 16).replace(/[T:]/g, '-') + '.csv'); }
  function exportAll() {
    var list = store.get('playtests'); if (!list.length) return;
    var names = {}; list.forEach(function (p) { Object.keys(p.tallies).forEach(function (k) { names[k] = 1; }); });
    var keys = Object.keys(names);
    var out = [['when', 'set up s', 'teach s', 'play s', 'pack s', 'total s'].concat(keys, ['questions'])];
    list.forEach(function (p) {
      var total = PHASES.reduce(function (a, ph) { return a + (p.laps[ph.k] || 0); }, 0);
      out.push([new Date(p.t).toISOString()].concat(PHASES.map(function (ph) { return Math.round(p.laps[ph.k] || 0); }), [Math.round(total)], keys.map(function (k) { return p.tallies[k] || 0; }), [p.questions.map(function (q) { return clock(q.t) + ' ' + q.text; }).join(' | ')]));
    });
    B.downloadCSV(out, 'playtests.csv');
  }
  function printBlank() {
    var l = live();
    var p = B.el('<section class="panel print-sheet"><h2>Playtest sheet</h2><p>Game: ______________________ &nbsp; Date: ____________ &nbsp; Testers: ____________</p>' +
      '<table class="sheet"><thead><tr><th>Phase</th><th>Started</th><th>Ended</th><th>Minutes</th></tr></thead><tbody>' +
      PHASES.map(function (ph) { return '<tr><td>' + ph.name + '</td><td>&nbsp;</td><td></td><td></td></tr>'; }).join('') + '</tbody></table>' +
      '<h3>Tally</h3><table class="sheet"><thead><tr><th style="width:40%">Watching for</th><th>Marks</th></tr></thead><tbody>' +
      l.tallies.map(function (t) { return '<tr><td>' + B.esc(t.name) + '</td><td style="height:2.2em"></td></tr>'; }).join('') + '<tr><td>&nbsp;</td><td></td></tr><tr><td>&nbsp;</td><td></td></tr></tbody></table>' +
      '<h3>Questions testers asked</h3><table class="sheet"><thead><tr><th style="width:15%">Time</th><th>Question</th></tr></thead><tbody>' +
      '<tr><td>&nbsp;</td><td></td></tr>'.repeat(10) + '</tbody></table></section>');
    B.printSection(p);
  }

  B.register({ id: 'playtest', mount: mount, unmount: unmount });
})();
