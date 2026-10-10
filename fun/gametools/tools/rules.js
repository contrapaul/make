/* Rules: paste the rulebook, see how long it really is, how many exceptions
   it carries, and whether it survives a cold read. */
(function () {
  'use strict';
  var B = window.Bench;

  var WPM = 150;                       // reading aloud, or reading in a second language
  var WORDS_PER_PAGE = { 9: 620, 10: 520, 11: 440, 12: 380 };   // A4, single column, headings and a diagram or two
  var PAGE_CAP = 4;
  var EXC = /\b(unless|except|only if|only when|but not|cannot|can't|can not|must not|never|instead|however|otherwise|apart from|does not|doesn't)\b/gi;
  var HOLD = /\b(must|cannot|can't|only|unless|always|never|may not)\b/i;
  var CHECKLIST = [
    'Who goes first, and how is that decided?',
    'What happens on a tie?',
    'Can a player do nothing on their turn?',
    'What happens when the deck, bag or pile runs out?',
    'How exactly does the game end, and who wins?',
    'Can two players be on the same space?',
    'What does each icon mean, and is there a key?',
    'Is every number a player needs on the table, not only in the book?',
    'Is there a worked example of one whole turn?',
    'Can a stranger set it up from the book alone?'
  ];
  var SKELETON = [
    { h: 'What you need', n: '½ page', t: 'Components with a photo. Player count, age, minutes. One sentence on what you are trying to do.' },
    { h: 'Setup', n: '½ page', t: 'A diagram of the table with every pile labelled. Numbered steps under it. Who goes first.' },
    { h: 'Your turn', n: '1 page', t: 'The steps of one turn, in order, numbered. Then one worked example of a whole turn.' },
    { h: 'The actions', n: '1 page', t: 'Each thing a player can do, one heading each, one icon each. Same order as on the reference card.' },
    { h: 'Winning', n: '¼ page', t: 'When the game ends. How to score. Ties.' },
    { h: 'Reference', n: '¾ page', t: 'Icon key, turn summary, the rules people forget. This is the page that stays on the table.' }
  ];

  var el, store = B.store, ui = {};
  function state() { return Object.assign({ text: '', pt: 10, checks: {} }, store.get('rules') || {}); }
  function save(patch) { store.set('rules', Object.assign(state(), patch)); }

  function analyse(text) {
    var words = (text.match(/[A-Za-z0-9’'\-]+/g) || []).length;
    var sentences = text.split(/[.!?]+(?:\s|$)/).map(function (s) { return s.trim(); }).filter(Boolean);
    var exc = [], m; EXC.lastIndex = 0;
    while ((m = EXC.exec(text))) exc.push({ word: m[0], at: m.index });
    var hold = sentences.filter(function (s) { return HOLD.test(s); });
    return { words: words, sentences: sentences.length, exceptions: exc, hold: hold };
  }
  function snippet(text, at) {
    var a = Math.max(0, at - 40), b = Math.min(text.length, at + 50);
    return (a ? '…' : '') + text.slice(a, b).replace(/\s+/g, ' ') + (b < text.length ? '…' : '');
  }

  function mount(root) {
    el = root;
    var st = state();
    el.innerHTML =
      '<div class="tool-grid rules-grid">' +
        '<section class="panel">' +
          '<p class="kicker">Rules</p>' +
          '<h2>How long is it really?</h2>' +
          '<p>Paste the rules. Four pages is the cap, and a Grade 6 reads about ' + WPM + ' words a minute.</p>' +
          '<textarea class="input rules-text" rows="14" placeholder="Paste your rules here…" aria-label="Rules text">' + B.esc(st.text) + '</textarea>' +
          '<div class="btn-row" style="margin-top:8px"><span class="label">Type size</span><div class="seg" role="group" aria-label="Type size">' +
            [9, 10, 11, 12].map(function (p) { return '<button type="button" data-pt="' + p + '"' + (p === st.pt ? ' class="on"' : '') + '>' + p + ' pt</button>'; }).join('') + '</div></div>' +
        '</section>' +
        '<section class="panel">' +
          '<p class="kicker">Budget</p>' +
          '<div class="rules-stats"></div>' +
          '<div class="rules-gauge"><i></i><b></b></div>' +
          '<div class="label" style="margin-top:14px">Exceptions</div>' +
          '<p class="muted" style="font-size:13px;margin:2px 0 8px">Every <em>unless</em>, <em>except</em> and <em>cannot</em> is a rule someone will forget at recess.</p>' +
          '<ul class="rules-exc"></ul>' +
        '</section>' +
      '</div>' +
      '<div class="tool-grid">' +
        '<section class="panel">' +
          '<p class="kicker">Shape</p>' +
          '<h2>A rulebook that fits</h2>' +
          '<p>Structure and pictures beat prose. Copy this skeleton and fill it in.</p>' +
          '<ol class="rules-skel">' + SKELETON.map(function (s) { return '<li><b>' + s.h + '</b> <span class="num muted">' + s.n + '</span><br><span>' + s.t + '</span></li>'; }).join('') + '</ol>' +
          '<button class="btn paper sm" type="button" data-copy>Copy the skeleton</button>' +
        '</section>' +
        '<section class="panel">' +
          '<p class="kicker">Cold read</p>' +
          '<h2>Can a stranger play it?</h2>' +
          '<p>Hand the box to people who have never seen it. Say nothing. Tick what they could answer from the book alone.</p>' +
          '<ul class="rules-check">' + CHECKLIST.map(function (q, i) { return '<li><label><input type="checkbox" data-q="' + i + '"' + (st.checks[i] ? ' checked' : '') + '> ' + q + '</label></li>'; }).join('') + '</ul>' +
          '<div class="btn-row"><span class="rules-score num"></span><button class="btn paper sm" type="button" data-print>Print the checklist</button></div>' +
        '</section>' +
      '</div>';
    ui.text = el.querySelector('.rules-text');
    ui.stats = el.querySelector('.rules-stats');
    ui.gauge = el.querySelector('.rules-gauge');
    ui.exc = el.querySelector('.rules-exc');
    ui.score = el.querySelector('.rules-score');
    ui.text.addEventListener('input', function () { save({ text: ui.text.value }); render(); });
    el.querySelector('.seg').addEventListener('click', function (e) {
      var b = e.target.closest('[data-pt]'); if (!b) return;
      el.querySelectorAll('[data-pt]').forEach(function (x) { x.classList.toggle('on', x === b); });
      save({ pt: +b.dataset.pt }); render();
    });
    el.querySelector('.rules-check').addEventListener('change', function (e) {
      var c = state().checks; c[e.target.dataset.q] = e.target.checked; save({ checks: c }); score();
    });
    el.querySelector('[data-copy]').addEventListener('click', function (e) {
      var txt = SKELETON.map(function (s) { return '# ' + s.h + ' (' + s.n + ')\n' + s.t + '\n\n'; }).join('');
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { e.target.textContent = 'Copied'; setTimeout(function () { e.target.textContent = 'Copy the skeleton'; }, 1500); });
    });
    el.querySelector('[data-print]').addEventListener('click', function () {
      B.printSection(B.el('<section class="panel"><h2>Cold read checklist</h2><p>Game: ____________________ &nbsp; Testers: ____________________ &nbsp; Date: ____________</p><ol>' +
        CHECKLIST.map(function (q) { return '<li style="margin:10px 0">☐ &nbsp;' + q + '<br><span style="color:#888">What they said: ______________________________________________</span></li>'; }).join('') + '</ol></section>'));
    });
    render(); score();
  }
  function unmount() { el = null; ui = {}; }

  function render() {
    var st = state(), a = analyse(st.text);
    var pages = a.words / WORDS_PER_PAGE[st.pt], mins = a.words / WPM;
    ui.stats.innerHTML =
      '<div class="setup-stats">' +
        '<div class="stat"><b class="num">' + a.words.toLocaleString() + '</b><span>words</span></div>' +
        '<div class="stat' + (pages > PAGE_CAP ? ' warn' : '') + '"><b class="num">' + (pages < 0.05 ? '0' : pages.toFixed(1)) + '</b><span>pages at ' + st.pt + ' pt</span></div>' +
        '<div class="stat"><b class="num">' + (mins < 1 ? Math.round(mins * 60) + ' s' : mins.toFixed(1) + ' min') + '</b><span>to read once</span></div>' +
        '<div class="stat' + (a.hold.length > 12 ? ' warn' : '') + '"><b class="num">' + a.hold.length + '</b><span>rules to hold in your head</span></div>' +
      '</div>';
    ui.gauge.querySelector('i').style.width = Math.min(100, 100 * pages / PAGE_CAP) + '%';
    ui.gauge.classList.toggle('over', pages > PAGE_CAP);
    ui.gauge.querySelector('b').textContent = pages > PAGE_CAP ? (pages - PAGE_CAP).toFixed(1) + ' pages over the cap' : PAGE_CAP + ' page cap';
    ui.exc.innerHTML = a.exceptions.length ? a.exceptions.slice(0, 30).map(function (x) {
      return '<li><b>' + B.esc(x.word) + '</b> <span class="muted">' + B.esc(snippet(st.text, x.at)) + '</span></li>';
    }).join('') + (a.exceptions.length > 30 ? '<li class="muted">… and ' + (a.exceptions.length - 30) + ' more.</li>' : '') : '<li class="muted">' + (a.words ? 'None. Either the rules are clean or the exceptions are hiding in longer sentences.' : 'Paste some rules to count them.') + '</li>';
  }
  function score() {
    var c = state().checks, n = CHECKLIST.filter(function (q, i) { return c[i]; }).length;
    ui.score.textContent = n + ' / ' + CHECKLIST.length + ' answered from the book';
  }

  B.rules = { analyse: analyse, snippet: snippet };
  B.register({ id: 'rules', title: 'Rules', blurb: 'Pages, reading time, exceptions, cold read.', mount: mount, unmount: unmount });
})();
