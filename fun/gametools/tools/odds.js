/* Odds: label what a roll means, roll it a lot, compare the sample with the
   exact distribution. */
(function () {
  'use strict';
  var B = window.Bench, D = B.dice;

  var RUNS = [10, 100, 1000, 10000];
  var MAX_RUN = 10000;
  var SWATCH = ['--berry', '--brass', '--felt', '--slate', '--plum', '--rust'];
  var DEFAULT = {
    spec: '1d6',
    labels: [{ from: 1, to: 1, text: 'Spell backfires' }, { from: 5, to: 6, text: 'Hit' }],
    perGame: 30, runs: 100
  };

  var el, store, unsubs = [], raf = null;
  var parsed = null, dist = null, sample = null, sampleN = 0, sampleSrc = '';
  var ui = {};

  function state() { return Object.assign({}, DEFAULT, store.get('odds') || {}); }
  function save(patch) { store.set('odds', Object.assign(state(), patch)); }
  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  /* ---------- mount ---------- */
  function mount(root, s) {
    el = root; store = s;
    var st = state();
    el.innerHTML =
      '<div class="tool-grid odds-grid">' +
        '<section class="panel">' +
          '<p class="kicker">Odds</p>' +
          '<h2>Say what a roll means</h2>' +
          '<p>Give the values a name. Then roll it a hundred times, and a thousand, and watch the shape settle.</p>' +
          '<div class="field"><label for="odds-spec">Roll</label><input id="odds-spec" class="input mono" value="' + B.esc(st.spec) + '" autocomplete="off" spellcheck="false"></div>' +
          '<p class="dice-err" role="alert"></p>' +
          '<p class="odds-range muted"></p>' +
          '<div class="label" style="margin-top:6px">Labels</div>' +
          '<div class="odds-labels"></div>' +
          '<button class="btn paper sm" type="button" data-add>Add a label</button>' +
        '</section>' +
        '<section class="panel">' +
          '<p class="kicker">Run it</p>' +
          '<h2>Roll it a lot</h2>' +
          '<div class="odds-run">' +
            '<div class="seg" role="group" aria-label="How many rolls">' +
              RUNS.map(function (n) { return '<button type="button" data-n="' + n + '"' + (n === st.runs ? ' class="on"' : '') + '>' + n.toLocaleString() + '</button>'; }).join('') +
            '</div>' +
            '<button class="btn" type="button" data-run>Roll</button>' +
            '<button class="btn paper sm" type="button" data-mine>Use my rolls</button>' +
          '</div>' +
          '<p class="muted odds-cap">Capped at 10,000 rolls and 20 dice. The shape stops changing well before that, and the dashed line is the exact answer anyway.</p>' +
          '<div class="odds-chart"></div>' +
          '<div class="odds-legend"></div>' +
        '</section>' +
      '</div>' +
      '<section class="panel">' +
        '<p class="kicker">What it means</p>' +
        '<div class="odds-summary-head">' +
          '<h2>Per game</h2>' +
          '<label class="odds-pergame">About <input class="input mono" type="number" min="1" max="10000" value="' + st.perGame + '" aria-label="Rolls per game"> rolls per game</label>' +
        '</div>' +
        '<div class="odds-table"></div>' +
        '<div class="btn-row" style="margin-top:14px">' +
          '<button class="btn paper sm" type="button" data-png>Download chart (PNG)</button>' +
          '<button class="btn paper sm" type="button" data-csv>Download table (CSV)</button>' +
        '</div>' +
      '</section>';

    ui.spec = el.querySelector('#odds-spec');
    ui.err = el.querySelector('.dice-err');
    ui.range = el.querySelector('.odds-range');
    ui.labels = el.querySelector('.odds-labels');
    ui.chart = el.querySelector('.odds-chart');
    ui.legend = el.querySelector('.odds-legend');
    ui.table = el.querySelector('.odds-table');
    ui.mine = el.querySelector('[data-mine]');
    ui.perGame = el.querySelector('.odds-pergame input');

    ui.spec.addEventListener('input', onSpec);
    ui.spec.addEventListener('change', onSpec);
    ui.labels.addEventListener('input', onLabelEdit);
    ui.labels.addEventListener('click', function (e) {
      var b = e.target.closest('[data-del]'); if (!b) return;
      var labels = state().labels.slice(); labels.splice(+b.dataset.del, 1); save({ labels: labels }); renderLabels(); redraw();
    });
    el.querySelector('[data-add]').addEventListener('click', function () {
      var r = D.range(parsed || D.parse('1d6'));
      save({ labels: state().labels.concat([{ from: r.min, to: r.min, text: '' }]) }); renderLabels(); redraw();
      var inputs = ui.labels.querySelectorAll('input[data-k="text"]'); inputs[inputs.length - 1].focus();
    });
    el.querySelector('.seg').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      el.querySelectorAll('.seg button').forEach(function (x) { x.classList.toggle('on', x === b); });
      save({ runs: +b.dataset.n });
    });
    el.querySelector('[data-run]').addEventListener('click', run);
    ui.mine.addEventListener('click', useMine);
    ui.perGame.addEventListener('input', function () { save({ perGame: Math.max(1, +ui.perGame.value || 1) }); renderTable(); });
    el.querySelector('[data-png]').addEventListener('click', function () { var svg = ui.chart.querySelector('svg'); if (svg) B.downloadPNG(svg, 'odds-' + parsed.text + '.png'); });
    el.querySelector('[data-csv]').addEventListener('click', exportCSV);
    unsubs.push(store.on('rolls', updateMine));

    onSpec();
  }
  function unmount() {
    unsubs.forEach(function (u) { u(); }); unsubs = [];
    if (raf) cancelAnimationFrame(raf); raf = null;
    el = null; ui = {}; parsed = dist = sample = null;
  }

  /* ---------- spec and labels ---------- */
  function onSpec() {
    try { parsed = D.parse(ui.spec.value); }
    catch (e) { ui.err.textContent = e.message; return; }
    ui.err.textContent = '';
    if (parsed.text !== state().spec) { save({ spec: parsed.text }); sample = null; sampleN = 0; sampleSrc = ''; }
    dist = D.distribution(parsed);
    var r = D.range(parsed);
    ui.range.textContent = 'Totals run from ' + r.min + ' to ' + r.max + '.' + (dist.exact ? '' : ' Exact odds for this keep/drop roll are estimated from 200,000 samples.');
    renderLabels();
    updateMine();
    redraw();
  }
  function renderLabels() {
    var labels = state().labels;
    ui.labels.innerHTML = labels.map(function (l, i) {
      return '<div class="odds-label" style="--sw:var(' + SWATCH[i % SWATCH.length] + ')">' +
        '<span class="sw" aria-hidden="true"></span>' +
        '<input class="input mono" type="number" value="' + l.from + '" data-i="' + i + '" data-k="from" aria-label="From">' +
        '<span class="muted">to</span>' +
        '<input class="input mono" type="number" value="' + l.to + '" data-i="' + i + '" data-k="to" aria-label="To">' +
        '<input class="input" type="text" value="' + B.esc(l.text) + '" data-i="' + i + '" data-k="text" placeholder="means…" aria-label="Label">' +
        '<button type="button" class="btn paper sm" data-del="' + i + '" aria-label="Remove label">✕</button>' +
      '</div>';
    }).join('') || '<p class="muted" style="margin:0 0 10px">No labels. Every value is just a number.</p>';
  }
  function onLabelEdit(e) {
    var inp = e.target; if (!inp.dataset.k) return;
    var labels = state().labels.map(function (l) { return Object.assign({}, l); });
    var l = labels[+inp.dataset.i];
    if (inp.dataset.k === 'text') l.text = inp.value;
    else l[inp.dataset.k] = parseInt(inp.value, 10) || 0;
    save({ labels: labels });
    redraw();
  }
  function labelFor(v) {
    var labels = state().labels;
    for (var i = 0; i < labels.length; i++) {
      var l = labels[i], lo = Math.min(l.from, l.to), hi = Math.max(l.from, l.to);
      if (v >= lo && v <= hi) return i;
    }
    return -1;
  }

  /* ---------- sampling ---------- */
  function run() {
    if (!parsed) return;
    var n = Math.min(state().runs, MAX_RUN);
    if (raf) cancelAnimationFrame(raf);
    sample = new Float64Array(dist.p.length); sampleN = 0; sampleSrc = 'rolled';
    var reduce = B.reducedMotion();
    if (n > 100 || reduce) {
      for (var i = 0; i < n; i++) addRoll();
      redraw(); return;
    }
    // 10 and 100 fill in over about 1.2s so the wobble is visible
    var per = n === 10 ? 120 : 12, last = performance.now(), due = 0;
    (function step(now) {
      due += (now - last) / per; last = now;
      while (due >= 1 && sampleN < n) { addRoll(); due -= 1; }
      redraw();
      if (sampleN < n) raf = requestAnimationFrame(step); else raf = null;
    })(last);
  }
  function addRoll() {
    var v = D.rollTotal(parsed);
    var i = v - dist.min;
    if (i >= 0 && i < sample.length) sample[i] += 1;
    sampleN += 1;
  }
  function myRolls() {
    if (!parsed) return [];
    return store.get('rolls').filter(function (r) { return !r.custom && r.spec === parsed.text; });
  }
  function updateMine() {
    var n = myRolls().length;
    ui.mine.textContent = 'Use my ' + n.toLocaleString() + ' roll' + (n === 1 ? '' : 's');
    ui.mine.disabled = n === 0;
    ui.mine.title = n ? 'Rolls of ' + parsed.text + ' from the Dice tool' : 'Roll ' + (parsed ? parsed.text : 'this') + ' in Dice first';
  }
  function useMine() {
    var rolls = myRolls(); if (!rolls.length) return;
    if (raf) cancelAnimationFrame(raf); raf = null;
    sample = new Float64Array(dist.p.length); sampleN = 0; sampleSrc = 'mine';
    rolls.forEach(function (r) { var i = r.total - dist.min; if (i >= 0 && i < sample.length) sample[i] += 1; sampleN += 1; });
    redraw();
  }

  /* ---------- drawing ---------- */
  function bins() {
    // Group values so the chart never has more than ~80 bars.
    var n = dist.p.length, size = Math.ceil(n / 80), out = [];
    for (var i = 0; i < n; i += size) {
      var lo = dist.min + i, hi = Math.min(dist.min + n - 1, lo + size - 1), ex = 0, sm = 0;
      for (var j = i; j < Math.min(n, i + size); j++) { ex += dist.p[j]; if (sample) sm += sample[j]; }
      out.push({ lo: lo, hi: hi, exact: ex, sample: sampleN ? sm / sampleN : 0, count: sm, label: labelFor(lo) });
    }
    return out;
  }
  function redraw() {
    if (!parsed || !dist) return;
    drawChart(); renderLegend(); renderTable();
  }
  function drawChart() {
    var bs = bins(), W = 640, H = 260, padL = 44, padR = 12, padT = 18, padB = 34;
    var cw = W - padL - padR, ch = H - padT - padB;
    var maxP = 0; bs.forEach(function (b) { maxP = Math.max(maxP, b.exact, b.sample); });
    maxP = maxP * 1.15 || 1;
    var bw = cw / bs.length, gap = Math.min(4, bw * 0.2);
    var ink = cssVar('--ink'), faint = cssVar('--ink-faint'), line = cssVar('--line'), paper3 = cssVar('--paper-3'), brassDeep = cssVar('--brass-deep');
    var colours = SWATCH.map(cssVar);
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Histogram of ' + B.esc(parsed.text) + '" font-family="JetBrains Mono, monospace" font-size="11">';
    // gridlines
    var ticks = [0.25, 0.5, 0.75, 1].map(function (f) { return f * maxP; });
    ticks.forEach(function (t) {
      var y = padT + ch - (t / maxP) * ch;
      svg += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y + '" y2="' + y + '" stroke="' + line + '" stroke-width="1"/>';
      svg += '<text x="' + (padL - 6) + '" y="' + (y + 4) + '" text-anchor="end" fill="' + faint + '">' + (t * 100).toFixed(t * 100 < 10 ? 1 : 0) + '%</text>';
    });
    // bars
    bs.forEach(function (b, i) {
      var x = padL + i * bw + gap / 2, w = Math.max(1, bw - gap);
      var h = (b.sample / maxP) * ch, y = padT + ch - h;
      var fill = b.label >= 0 ? colours[b.label % colours.length] : paper3;
      svg += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="2" fill="' + fill + '"/>';
      if (b.label < 0 && sampleN) svg += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="2" fill="none" stroke="' + faint + '" stroke-width="1"/>';
      var every = Math.ceil(bs.length / 16);
      if (i % every === 0 || bs.length <= 16) {
        svg += '<text x="' + (x + w / 2) + '" y="' + (H - padB + 16) + '" text-anchor="middle" fill="' + ink + '">' + (b.lo === b.hi ? b.lo : b.lo + '–' + b.hi) + '</text>';
      }
    });
    // exact overlay as a dashed step line
    var d = '';
    bs.forEach(function (b, i) {
      var x0 = padL + i * bw, x1 = x0 + bw, y = padT + ch - (b.exact / maxP) * ch;
      d += (i ? 'L' : 'M') + x0.toFixed(1) + ' ' + y.toFixed(1) + ' L' + x1.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    });
    svg += '<path d="' + d + '" fill="none" stroke="' + brassDeep + '" stroke-width="2.5" stroke-dasharray="6 4" stroke-linejoin="round"/>';
    // caption
    var cap = sampleN ? sampleN.toLocaleString() + (sampleSrc === 'mine' ? ' of your rolls' : ' rolls') : 'No rolls yet. Dashed line is the exact odds.';
    svg += '<text x="' + (W - padR) + '" y="' + (padT - 6) + '" text-anchor="end" fill="' + faint + '">' + B.esc(parsed.text) + ' · ' + cap + '</text>';
    svg += '</svg>';
    ui.chart.innerHTML = svg;
  }
  function renderLegend() {
    var labels = state().labels;
    var items = labels.map(function (l, i) {
      return '<span class="odds-key" style="--sw:var(' + SWATCH[i % SWATCH.length] + ')"><i></i>' + (B.esc(l.text) || '<em class="muted">unnamed</em>') + '</span>';
    });
    items.push('<span class="odds-key exact"><i></i>Exact odds</span>');
    ui.legend.innerHTML = items.join('');
  }
  function rows() {
    var labels = state().labels, per = state().perGame, out = [], rest = { exact: 0, count: 0 };
    var acc = labels.map(function () { return { exact: 0, count: 0 }; });
    for (var i = 0; i < dist.p.length; i++) {
      var li = labelFor(dist.min + i), t = li >= 0 ? acc[li] : rest;
      t.exact += dist.p[i]; if (sample) t.count += sample[i];
    }
    labels.forEach(function (l, i) {
      out.push({ name: l.text || 'unnamed', range: Math.min(l.from, l.to) === Math.max(l.from, l.to) ? String(l.from) : Math.min(l.from, l.to) + '–' + Math.max(l.from, l.to), exact: acc[i].exact, count: acc[i].count, perGame: acc[i].exact * per });
    });
    out.push({ name: 'Everything else', range: '', exact: rest.exact, count: rest.count, perGame: rest.exact * per, rest: true });
    return out;
  }
  function renderTable() {
    var rs = rows();
    ui.table.innerHTML = '<table class="sheet"><thead><tr><th>Outcome</th><th>Values</th><th class="num">Exact</th><th class="num">In your ' + (sampleN ? sampleN.toLocaleString() : '—') + '</th><th class="num">Per game</th></tr></thead><tbody>' +
      rs.map(function (r, i) {
        var sw = r.rest ? '' : '<i class="sw" style="--sw:var(' + SWATCH[i % SWATCH.length] + ')"></i>';
        return '<tr' + (r.rest ? ' class="muted"' : '') + '><td>' + sw + B.esc(r.name) + '</td><td class="num">' + r.range + '</td><td class="num">' + B.pct(r.exact) + '</td><td class="num">' +
          (sampleN ? r.count.toLocaleString() + ' <span class="muted">(' + B.pct(r.count / sampleN) + ')</span>' : '—') + '</td><td class="num">' + expect(r.perGame) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }
  function expect(x) { return x >= 10 ? Math.round(x) : x >= 1 ? x.toFixed(1) : x.toFixed(2); }
  function exportCSV() {
    var out = [['roll', parsed.text], ['rolls per game', state().perGame], ['sample size', sampleN], [], ['outcome', 'values', 'exact probability', 'sample count', 'sample proportion', 'expected per game']];
    rows().forEach(function (r) { out.push([r.name, r.range, r.exact.toFixed(5), r.count, sampleN ? (r.count / sampleN).toFixed(5) : '', r.perGame.toFixed(2)]); });
    out.push([]); out.push(['value', 'label', 'exact probability', 'sample count']);
    for (var i = 0; i < dist.p.length; i++) {
      var li = labelFor(dist.min + i);
      out.push([dist.min + i, li >= 0 ? state().labels[li].text : '', dist.p[i].toFixed(6), sample ? sample[i] : 0]);
    }
    B.downloadCSV(out, 'odds-' + parsed.text + '.csv');
  }

  B.register({ id: 'odds', mount: mount, unmount: unmount });
})();
