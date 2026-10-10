/* Session: does the whole thing fit in a recess? */
(function () {
  'use strict';
  var B = window.Bench;

  var DEFAULT = { players: 4, rounds: 8, secTurn: 30, teach: 3, setup: 3, pack: 2, target: 30 };
  var PHASES = [
    { k: 'setup', name: 'Set up', v: '--brass' },
    { k: 'teach', name: 'Teach', v: '--slate' },
    { k: 'play',  name: 'Play', v: '--berry' },
    { k: 'pack',  name: 'Pack away', v: '--felt' }
  ];

  var el, store, ui = {};
  function state() { return Object.assign({}, DEFAULT, store.get('session') || {}); }
  function save(patch) { store.set('session', Object.assign(state(), patch)); }
  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function fmt(m) { return m < 10 ? m.toFixed(1).replace(/\.0$/, '') : Math.round(m); }

  function minutes(st) {
    return { setup: +st.setup, teach: +st.teach, play: st.players * st.rounds * st.secTurn / 60, pack: +st.pack };
  }

  function mount(root, s) {
    el = root; store = s;
    var st = state();
    function num(k, label, min, max, step) {
      return '<div class="field"><label for="ss-' + k + '">' + label + '</label><input id="ss-' + k + '" class="input mono" type="number" min="' + min + '" max="' + max + '" step="' + (step || 1) + '" value="' + st[k] + '" data-k="' + k + '"></div>';
    }
    el.innerHTML =
      '<div class="tool-grid session-grid">' +
        '<section class="panel">' +
          '<p class="kicker">Session</p>' +
          '<h2>Does it fit?</h2>' +
          '<p>From sitting down to packed away. Players always underestimate turn time: time three real turns before trusting this.</p>' +
          '<div class="session-form">' +
            num('players', 'Players', 1, 12) + num('rounds', 'Turns each', 1, 200) + num('secTurn', 'Seconds a turn', 5, 600, 5) +
            num('setup', 'Set up, min', 0, 60, 0.5) + num('teach', 'Teach, min', 0, 60, 0.5) + num('pack', 'Pack away, min', 0, 60, 0.5) +
          '</div>' +
          '<div class="btn-row" style="margin-top:12px">' +
            '<button class="btn paper sm" type="button" data-from-setup>Use Setup’s estimate</button>' +
            '<button class="btn paper sm" type="button" data-from-playtest>Use my last playtest</button>' +
          '</div>' +
          '<p class="muted session-src" style="font-size:13px;margin:8px 0 0"></p>' +
        '</section>' +
        '<section class="panel">' +
          '<div class="session-head"><p class="kicker">The bar</p>' +
            '<label class="session-target">Fit in <div class="seg" role="group" aria-label="Target minutes">' +
              [20, 25, 30].map(function (m) { return '<button type="button" data-t="' + m + '"' + (m === st.target ? ' class="on"' : '') + '>' + m + '</button>'; }).join('') +
            '</div> min</label></div>' +
          '<h2 class="session-total"></h2>' +
          '<div class="session-chart"></div>' +
          '<div class="session-legend"></div>' +
          '<div class="session-fix"></div>' +
          '<div class="btn-row" style="margin-top:14px"><button class="btn paper sm" type="button" data-png>Download the bar (PNG)</button></div>' +
        '</section>' +
      '</div>';
    ui.form = el.querySelector('.session-form');
    ui.total = el.querySelector('.session-total');
    ui.chart = el.querySelector('.session-chart');
    ui.legend = el.querySelector('.session-legend');
    ui.fix = el.querySelector('.session-fix');
    ui.src = el.querySelector('.session-src');

    ui.form.addEventListener('input', function (e) {
      var inp = e.target; if (!inp.dataset.k) return;
      var o = {}; o[inp.dataset.k] = Math.max(+inp.min, Math.min(+inp.max, parseFloat(inp.value) || 0));
      save(o); ui.src.textContent = ''; render();
    });
    el.querySelector('.seg').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      el.querySelectorAll('.seg button').forEach(function (x) { x.classList.toggle('on', x === b); });
      save({ target: +b.dataset.t }); render();
    });
    el.querySelector('[data-from-setup]').addEventListener('click', function () {
      var est = B.setupEstimate(store);
      setInputs({ setup: Math.round(est.setupSec / 30) / 2, pack: Math.round(est.packSec / 30) / 2 });
      ui.src.textContent = 'Set up and pack away taken from Setup: ' + est.onTable + ' pieces on the table.';
    });
    el.querySelector('[data-from-playtest]').addEventListener('click', function () {
      var list = store.get('playtests'), p = list[list.length - 1];
      if (!p) { ui.src.textContent = 'No playtest saved yet. Time one with Playtest first.'; return; }
      var st = state(), patch = {};
      if (p.laps.setup) patch.setup = Math.round(p.laps.setup / 30) / 2;
      if (p.laps.teach) patch.teach = Math.round(p.laps.teach / 30) / 2;
      if (p.laps.pack) patch.pack = Math.round(p.laps.pack / 30) / 2;
      if (p.laps.play) patch.secTurn = Math.max(5, Math.round(p.laps.play / (st.players * st.rounds) / 5) * 5);
      setInputs(patch);
      ui.src.textContent = 'From your playtest on ' + new Date(p.t).toLocaleDateString() + '. Seconds a turn assumes ' + st.players + ' players × ' + st.rounds + ' turns.';
    });
    el.querySelector('[data-png]').addEventListener('click', function () { var svg = ui.chart.querySelector('svg'); if (svg) B.downloadPNG(svg, 'session.png'); });
    render();
  }
  function setInputs(patch) {
    save(patch);
    Object.keys(patch).forEach(function (k) { var i = el.querySelector('[data-k="' + k + '"]'); if (i) i.value = patch[k]; });
    render();
  }
  function unmount() { el = null; ui = {}; }

  function render() {
    var st = state(), m = minutes(st), total = m.setup + m.teach + m.play + m.pack, T = st.target;
    var over = total - T;
    ui.total.innerHTML = '<span class="num' + (over > 0 ? ' over' : '') + '">' + fmt(total) + ' min</span> <span class="muted" style="font-weight:500;font-size:16px">' +
      (over > 0 ? fmt(over) + ' min over' : over < -2 ? fmt(-over) + ' min to spare' : 'just fits') + '</span>';
    drawBar(m, T, total);
    ui.legend.innerHTML = PHASES.map(function (p) { return '<span class="odds-key" style="--sw:var(' + p.v + ')"><i></i>' + p.name + ' <b class="num">' + fmt(m[p.k]) + '</b></span>'; }).join('');
    if (over <= 0) { ui.fix.innerHTML = ''; return; }
    var perRound = st.players * st.secTurn / 60;
    var fixes = [];
    var dropRounds = Math.ceil(over / perRound);
    if (dropRounds < st.rounds) fixes.push('Play <b>' + dropRounds + '</b> fewer turn' + (dropRounds > 1 ? 's' : '') + ' each (' + (st.rounds - dropRounds) + ' instead of ' + st.rounds + ')');
    var shave = Math.ceil(over * 60 / (st.players * st.rounds));
    if (shave < st.secTurn) fixes.push('Shave <b>' + shave + ' s</b> off every turn (' + (st.secTurn - shave) + ' s instead of ' + st.secTurn + ')');
    if (m.teach > over) fixes.push('Teach in <b>' + fmt(m.teach - over) + ' min</b> instead of ' + fmt(m.teach) + ' (a one-page rules card helps)');
    if (m.setup > over) fixes.push('Set up in <b>' + fmt(m.setup - over) + ' min</b> (fewer pieces on the table, see Setup)');
    if (st.players > 2 && perRound * st.rounds * (1 / st.players) >= over) fixes.push('One fewer player');
    ui.fix.innerHTML = '<div class="label" style="margin-top:12px">Any one of these fits it</div><ul class="fixes">' + fixes.map(function (f) { return '<li>' + f + '</li>'; }).join('') + '</ul>';
  }
  function drawBar(m, T, total) {
    var W = 640, H = 92, padL = 8, padR = 8, y = 28, h = 36, span = Math.max(T, total) * 1.02;
    var cw = W - padL - padR, x = padL;
    var ink = cssVar('--ink'), faint = cssVar('--ink-faint'), line = cssVar('--line');
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Session length" font-family="JetBrains Mono, monospace" font-size="11">';
    svg += '<rect x="' + padL + '" y="' + y + '" width="' + cw + '" height="' + h + '" rx="8" fill="' + cssVar('--paper-2') + '"/>';
    PHASES.forEach(function (p) {
      var w = cw * m[p.k] / span; if (w <= 0) return;
      svg += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + cssVar(p.v) + '"/>';
      if (w > 34) svg += '<text x="' + (x + w / 2) + '" y="' + (y + h / 2 + 4) + '" text-anchor="middle" fill="#fff" font-weight="700">' + fmt(m[p.k]) + '</text>';
      x += w;
    });
    // target line
    var tx = padL + cw * T / span;
    svg += '<line x1="' + tx + '" x2="' + tx + '" y1="' + (y - 10) + '" y2="' + (y + h + 10) + '" stroke="' + ink + '" stroke-width="2" stroke-dasharray="4 3"/>';
    svg += '<text x="' + tx + '" y="' + (y - 14) + '" text-anchor="' + (tx > W - 60 ? 'end' : 'middle') + '" fill="' + ink + '" font-weight="700">' + T + ' min</text>';
    if (total > T) {
      var ox = tx, ow = padL + cw * total / span - tx;
      svg += '<rect x="' + ox + '" y="' + y + '" width="' + ow + '" height="' + h + '" fill="url(#hatch)"/>';
      svg += '<defs><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="8" fill="rgba(0,0,0,.35)"/></pattern></defs>';
    }
    // ticks
    for (var t = 0; t <= span; t += 5) {
      var px = padL + cw * t / span;
      svg += '<line x1="' + px + '" x2="' + px + '" y1="' + (y + h) + '" y2="' + (y + h + 5) + '" stroke="' + line + '"/>';
      if (t % 10 === 0) svg += '<text x="' + px + '" y="' + (y + h + 18) + '" text-anchor="middle" fill="' + faint + '">' + t + '</text>';
    }
    svg += '</svg>';
    ui.chart.innerHTML = svg;
  }

  B.register({ id: 'session', mount: mount, unmount: unmount });
})();
