/* Dice: roll any pool with a tumble, keep every roll, save custom dice. */
(function () {
  'use strict';
  var B = window.Bench, D = B.dice;

  var QUICK = [4, 6, 8, 10, 12, 20, 100];
  var PIPS = {
    1: ['2/2'], 2: ['1/1', '3/3'], 3: ['1/1', '2/2', '3/3'],
    4: ['1/1', '1/3', '3/1', '3/3'], 5: ['1/1', '1/3', '2/2', '3/1', '3/3'],
    6: ['1/1', '1/3', '2/1', '2/3', '3/1', '3/3']
  };
  var FACE_ROT = { 1: [0, 0], 2: [0, -90], 3: [0, 180], 4: [0, 90], 5: [-90, 0], 6: [90, 0] };
  var ROLL_MS = 800;

  var el, store, unsubs = [], timers = [], pending = null;
  var specInput, errLine, stage, result, breakdown, log, customList;

  function state() {
    var d = store.get('dice') || {};
    return { spec: d.spec || '2d6', custom: d.custom || [] };
  }
  function saveState(patch) { store.set('dice', Object.assign(state(), patch)); }

  /* ---------- render ---------- */
  function mount(root, s) {
    el = root; store = s;
    var st = state();
    el.innerHTML =
      '<section class="panel">' +
        '<p class="kicker">Dice</p>' +
        '<h2>Roll</h2>' +
        '<p>Pick a die or type a roll like <span class="num">3d6</span>, <span class="num">d20+3</span> or <span class="num">4d6dl1</span> (drop the lowest). Space rolls again. Click mid-roll to skip the tumble.</p>' +
        '<div class="quick" role="group" aria-label="Quick dice">' +
          QUICK.map(function (s) { return '<button type="button" class="quick-die" data-s="' + s + '">d' + s + '</button>'; }).join('') +
        '</div>' +
        '<div class="dice-form">' +
          '<div class="field"><label for="dice-spec">Roll</label><input id="dice-spec" class="input mono" value="' + B.esc(st.spec) + '" autocomplete="off" spellcheck="false"></div>' +
          '<button class="btn big" type="button" data-roll>Roll</button>' +
        '</div>' +
        '<p class="dice-err" role="alert"></p>' +
        '<div class="dice-stage"></div>' +
        '<div class="dice-total"><div class="dice-result num" aria-live="polite">–</div><div class="dice-breakdown num"></div></div>' +
      '</section>' +
      '<div class="tool-grid">' +
        '<section class="panel">' +
          '<p class="kicker">Your dice</p>' +
          '<h2>Custom faces</h2>' +
          '<p>Name the sides. <em>Miss, Miss, Hit, Hit, Crit, Backfire</em> is a d6 that tells you what happened.</p>' +
          '<div class="custom-list"></div>' +
          '<form class="custom-form">' +
            '<div class="field"><label for="cd-name">Name</label><input id="cd-name" class="input" placeholder="Spell die" required maxlength="24"></div>' +
            '<div class="field"><label for="cd-faces">Faces, comma separated</label><input id="cd-faces" class="input" placeholder="Miss, Miss, Hit, Hit, Crit, Backfire" required></div>' +
            '<button class="btn brass" type="submit">Save die</button>' +
          '</form>' +
        '</section>' +
        '<section class="panel">' +
          '<p class="kicker">History</p>' +
          '<h2>Last rolls</h2>' +
          '<p>Every roll is kept in this browser. <a href="#odds">Odds</a> can use them as a sample.</p>' +
          '<ul class="dice-log" aria-label="Roll history"></ul>' +
          '<div class="btn-row" style="margin-top:14px">' +
            '<button class="btn paper sm" type="button" data-csv>Download rolls (CSV)</button>' +
            '<button class="btn paper sm" type="button" data-clear>Forget these rolls</button>' +
          '</div>' +
        '</section>' +
      '</div>';

    specInput = el.querySelector('#dice-spec');
    errLine = el.querySelector('.dice-err');
    stage = el.querySelector('.dice-stage');
    result = el.querySelector('.dice-result');
    breakdown = el.querySelector('.dice-breakdown');
    log = el.querySelector('.dice-log');
    customList = el.querySelector('.custom-list');

    el.querySelectorAll('.quick-die').forEach(function (b) {
      b.addEventListener('click', function () {
        specInput.value = '1d' + b.dataset.s; syncQuick(); rollSpec();
      });
    });
    el.querySelector('[data-roll]').addEventListener('click', rollSpec);
    specInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); rollSpec(); } });
    specInput.addEventListener('input', function () { errLine.textContent = ''; syncQuick(); });
    el.querySelector('.custom-form').addEventListener('submit', onSaveCustom);
    customList.addEventListener('click', onCustomClick);
    el.querySelector('[data-csv]').addEventListener('click', exportCSV);
    el.querySelector('[data-clear]').addEventListener('click', function () {
      if (confirm('Forget all saved rolls?')) store.set('rolls', []);
    });
    document.addEventListener('keydown', onKey);
    unsubs.push(store.on('rolls', renderLog));
    unsubs.push(store.on('dice', function () { renderCustom(); }));

    syncQuick();
    previewSpec();
    renderCustom();
    renderLog(store.get('rolls'));
  }

  function unmount() {
    unsubs.forEach(function (u) { u(); }); unsubs = [];
    clearTimers();
    document.removeEventListener('keydown', onKey);
    el = specInput = errLine = stage = result = breakdown = log = customList = null;
    pending = null;
  }

  function onKey(e) {
    if (e.key !== ' ' || e.target.closest('input, textarea, button, [role=button], a, summary')) return;
    e.preventDefault(); rollSpec();
  }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }

  function syncQuick() {
    var v = specInput.value.replace(/\s+/g, '').toLowerCase();
    el.querySelectorAll('.quick-die').forEach(function (b) {
      b.classList.toggle('on', v === '1d' + b.dataset.s || v === 'd' + b.dataset.s);
    });
  }

  /* ---------- the stage ---------- */
  function dieHTML(s, size) {
    if (s === 6) {
      return '<div class="die scene" data-s="6" style="--size:' + size + 'px"><div class="cube">' +
        [1, 2, 3, 4, 5, 6].map(function (n) {
          return '<div class="face f' + n + '">' + PIPS[n].map(function (a) { return '<i style="grid-area:' + a + '"></i>'; }).join('') + '</div>';
        }).join('') + '</div></div>';
    }
    var shape = s === 4 ? 'd4' : s === 8 ? 'd8' : s === 10 ? 'd10' : s === 12 ? 'd12' : s === 20 ? 'd20' : s === 100 ? 'd100' : 'dn';
    return '<div class="die poly ' + shape + '" data-s="' + s + '" style="--size:' + size + 'px"><span class="num">?</span></div>';
  }
  function buildStage(parsed) {
    var count = 0; parsed.terms.forEach(function (t) { count += t.n; });
    var size = count > 8 ? 48 : count > 4 ? 60 : 76;
    var html = '';
    parsed.terms.forEach(function (t, ti) {
      for (var i = 0; i < t.n; i++) html += dieHTML(t.s, size);
      if (ti < parsed.terms.length - 1) html += '<span class="die-plus num">+</span>';
    });
    if (parsed.mod) html += '<span class="die-plus num">' + (parsed.mod > 0 ? '+' : '−') + Math.abs(parsed.mod) + '</span>';
    stage.innerHTML = html;
    stage.querySelectorAll('.die').forEach(function (d) {
      d.addEventListener('click', rollSpec);
      if (d.dataset.s === '6') showCubeFace(d, 1, false);
    });
  }
  function previewSpec() {
    try { var p = D.parse(specInput.value); buildStage(p); result.textContent = '–'; result.classList.remove('hot'); breakdown.textContent = ''; }
    catch (e) { /* leave stage as is */ }
  }

  function showCubeFace(die, n, tumble) {
    var cube = die.querySelector('.cube');
    var spins = (parseInt(die.dataset.spins || '0', 10) + (tumble ? 1 : 0));
    die.dataset.spins = spins;
    var k = spins * 360, r = FACE_ROT[n];
    cube.style.transform = 'rotateX(-10deg) rotateY(12deg) rotateX(' + (r[0] + k) + 'deg) rotateY(' + (r[1] + k) + 'deg)';
  }
  // Polyhedral dice flicker through values, slowing down, then land.
  function flicker(die, s, n, ms) {
    var span = die.querySelector('span');
    die.classList.add('rolling');
    var start = performance.now();
    (function tick() {
      var t = performance.now() - start;
      if (t >= ms) { span.textContent = n; die.classList.remove('rolling'); return; }
      span.textContent = B.rand(s);
      later(tick, 40 + 160 * Math.pow(t / ms, 2));
    })();
  }

  /* ---------- rolling ---------- */
  function rollSpec() {
    if (pending) { clearTimers(); land(); return; }
    var parsed;
    try { parsed = D.parse(specInput.value); }
    catch (e) { errLine.textContent = e.message; return; }
    errLine.textContent = '';
    if (parsed.text !== state().spec) saveState({ spec: parsed.text });
    if (!stage.querySelector('.die') || stage.dataset.spec !== parsed.text) { buildStage(parsed); stage.dataset.spec = parsed.text; }

    var r = D.roll(parsed);
    var reduce = B.reducedMotion(), ms = reduce ? 0 : ROLL_MS;
    var dice = stage.querySelectorAll('.die'), di = 0;
    result.textContent = '?'; result.classList.remove('hot'); breakdown.textContent = '';
    parsed.terms.forEach(function (t, ti) {
      r.faces[ti].forEach(function (v, i) {
        var die = dice[di++];
        die.classList.remove('dropped');
        if (t.s === 6) showCubeFace(die, v, !reduce); else flicker(die, t.s, v, ms);
      });
    });
    pending = {
      entry: { t: Date.now(), spec: parsed.text, faces: [].concat.apply([], r.faces), total: r.total },
      roll: r, parsed: parsed
    };
    later(land, ms);
  }
  function land() {
    if (!pending) return;
    var p = pending; pending = null;
    var dice = stage.querySelectorAll('.die'), di = 0, parts = [];
    p.parsed.terms.forEach(function (t, ti) {
      p.roll.faces[ti].forEach(function (v, i) {
        var die = dice[di++];
        var kept = p.roll.kept[ti][i];
        if (t.s === 6) showCubeFace(die, v, false); else die.querySelector('span').textContent = v;
        die.classList.toggle('dropped', !kept);
        parts.push(kept ? String(v) : '<s>' + v + '</s>');
      });
    });
    var text = parts.join(' <span class="muted">+</span> ');
    if (p.parsed.mod) text += ' <span class="muted">' + (p.parsed.mod > 0 ? '+' : '−') + '</span> ' + Math.abs(p.parsed.mod);
    result.textContent = p.roll.total; result.classList.add('hot');
    breakdown.innerHTML = parts.length > 1 || p.parsed.mod ? text : '';
    store.set('rolls', store.get('rolls').concat([p.entry]));
  }

  /* ---------- custom dice ---------- */
  function renderCustom() {
    var list = state().custom;
    if (!list.length) { customList.innerHTML = '<p class="muted" style="margin:0 0 10px">No custom dice yet. Try the coin below.</p>' +
      '<div class="custom-die"><div class="custom-head"><b>Coin</b><span class="muted">Heads, Tails</span></div>' +
      '<div class="custom-result num" aria-live="polite"></div>' +
      '<div class="btn-row"><button class="btn sm" type="button" data-roll-builtin="Coin|Heads,Tails">Flip</button>' +
      '<button class="btn paper sm" type="button" data-keep-builtin="Coin|Heads,Tails">Keep it</button></div></div>'; return; }
    customList.innerHTML = list.map(function (d, i) {
      return '<div class="custom-die" data-i="' + i + '">' +
        '<div class="custom-head"><b>' + B.esc(d.name) + '</b><span class="muted">' + d.faces.map(B.esc).join(', ') + '</span></div>' +
        '<div class="custom-result num" aria-live="polite"></div>' +
        '<div class="btn-row">' +
          '<button class="btn sm" type="button" data-roll-custom="' + i + '">Roll</button>' +
          '<label class="custom-count">×<input type="number" min="1" max="10" value="1" class="input mono" aria-label="How many"></label>' +
          '<button class="btn paper sm" type="button" data-del-custom="' + i + '" aria-label="Delete ' + B.esc(d.name) + '">✕</button>' +
        '</div></div>';
    }).join('');
  }
  function onCustomClick(e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.rollBuiltin || b.dataset.keepBuiltin) {
      var parts = (b.dataset.rollBuiltin || b.dataset.keepBuiltin).split('|');
      var die = { name: parts[0], faces: parts[1].split(',') };
      if (b.dataset.keepBuiltin) { saveState({ custom: state().custom.concat([die]) }); return; }
      rollCustom(die, 1, b.closest('.custom-die'));
      return;
    }
    if (b.dataset.rollCustom != null) {
      var card = b.closest('.custom-die');
      var n = Math.max(1, Math.min(10, parseInt(card.querySelector('input').value, 10) || 1));
      rollCustom(state().custom[+b.dataset.rollCustom], n, card);
    }
    if (b.dataset.delCustom != null) {
      var list = state().custom.slice(); list.splice(+b.dataset.delCustom, 1); saveState({ custom: list });
    }
  }
  function rollCustom(die, n, card) {
    var out = card.querySelector('.custom-result');
    var faces = []; for (var i = 0; i < n; i++) faces.push(die.faces[B.rand(die.faces.length) - 1]);
    var ms = B.reducedMotion() ? 0 : ROLL_MS;
    out.innerHTML = faces.map(function () { return '<span class="face-chip">?</span>'; }).join('');
    var chips = out.querySelectorAll('.face-chip');
    var start = performance.now();
    (function tick() {
      var t = performance.now() - start;
      if (t >= ms) {
        chips.forEach(function (c, i) { c.textContent = faces[i]; c.classList.add('hot'); });
        store.set('rolls', store.get('rolls').concat([{ t: Date.now(), spec: die.name, faces: faces, total: null, custom: true }]));
        return;
      }
      chips.forEach(function (c) { c.textContent = die.faces[B.rand(die.faces.length) - 1]; });
      later(tick, 50 + 150 * Math.pow(t / ms, 2));
    })();
  }
  function onSaveCustom(e) {
    e.preventDefault();
    var name = el.querySelector('#cd-name').value.trim();
    var faces = el.querySelector('#cd-faces').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (faces.length < 2) { alert('A die needs at least two faces.'); return; }
    if (faces.length > 100) { alert('100 faces is plenty.'); return; }
    saveState({ custom: state().custom.concat([{ name: name, faces: faces }]) });
    e.target.reset();
  }

  /* ---------- history ---------- */
  function renderLog(rolls) {
    if (!log) return;
    var last = rolls.slice(-50).reverse();
    log.innerHTML = last.length
      ? last.map(function (r) {
          var when = new Date(r.t).toLocaleString();
          var text = r.custom ? B.esc(r.spec) + ' → ' + r.faces.map(B.esc).join(' · ')
                              : B.esc(r.spec) + ' → <b>' + r.total + '</b>';
          return '<li title="' + B.esc(when) + (r.custom ? '' : ' · ' + r.faces.join(', ')) + '">' + text + '</li>';
        }).join('')
      : '<li class="empty">Nothing yet.</li>';
  }
  function exportCSV() {
    var rows = [['time', 'roll', 'faces', 'total']].concat(store.get('rolls').map(function (r) {
      return [new Date(r.t).toISOString(), r.spec, r.faces.join(' '), r.total == null ? '' : r.total];
    }));
    B.downloadCSV(rows, 'dice-rolls.csv');
  }

  B.register({ id: 'dice', mount: mount, unmount: unmount });
})();
