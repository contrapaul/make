/* Roles: four roles for a team of three or four, each carrying two skill
   tracks, plus the component ownership board from the manifest. */
(function () {
  'use strict';
  var B = window.Bench;

  var ROLES = [
    { id: 'rules', name: 'Rules lead', tracks: ['Systems and rules', 'Graphic design'], v: '--berry',
      owns: 'The rulebook, the reference card, the numbers on every card, the icon language.',
      by4: 'A rulebook draft a stranger has tried to read, and a list of the questions they asked.',
      skills: ['Rules that survive a cold read', 'Balancing with numbers (use Odds and Deck)', 'An icon language with a key', 'Teaching the game in under five minutes'] },
    { id: 'art', name: 'Art lead', tracks: ['Graphic design', 'Systems and rules'], v: '--brass',
      owns: 'Card layouts, the board face, colour, type, the print files.',
      by4: 'One locked layout per kind of card (Cards), a print sheet that cut cleanly (Sheet), a palette that passed Checks.',
      skills: ['Card layout with bleed and safe margin', 'Type sizes for the table, not the page', 'Colour-blind safe palette with symbols', 'Export-ready artwork'] },
    { id: 'fab', name: 'Fab lead', tracks: ['Digital fabrication', 'Hand fabrication and finishing'], v: '--felt',
      owns: 'Tokens, miniatures, trays and inserts, anything printed or etched.',
      by4: 'A test print that fits the box (Box), tolerances checked, a second attempt that fixed the first.',
      skills: ['Modelling a part that prints well', 'Orientation, supports, fit', 'Laser-etched markings', 'A part reproducible twenty times'] },
    { id: 'build', name: 'Build lead', tracks: ['Hand fabrication and finishing', 'Digital fabrication'], v: '--slate',
      owns: 'The board, the box, the storage, anything cut, scored, folded or mounted.',
      by4: 'A board that folds flat and lies flat, a box that closes, a jig for the repeated parts.',
      skills: ['Precision cutting, scoring, folding', 'Mounting, hinging, board construction', 'Surface finish, edges, corners', 'Jig making for repeatable parts'] }
  ];
  // For a team of three, one person carries two roles. These pairs share a track.
  var PAIRS = [['rules', 'art'], ['fab', 'build']];

  var el, store = B.store, unmountManifest = null, unsubs = [], swapped = false;
  function state() { return Object.assign({ size: 4, names: ['', '', '', ''], assign: {} }, store.get('roles') || {}); }
  function save(patch) { store.set('roles', Object.assign(state(), patch)); }

  function mount(root) {
    el = root;
    var st = state();
    el.innerHTML =
      '<section class="panel">' +
        '<p class="kicker">Roles</p>' +
        '<h2>Who owns what</h2>' +
        '<p>Four roles, two skill tracks each, so nobody spends ten sessions at one machine and calls it a build. A team of three doubles up the pairs that share a track.</p>' +
        '<div class="btn-row"><span class="label">Team of</span><div class="seg" role="group" aria-label="Team size"><button type="button" data-size="3"' + (st.size === 3 ? ' class="on"' : '') + '>3</button><button type="button" data-size="4"' + (st.size === 4 ? ' class="on"' : '') + '>4</button></div>' +
          '<button class="btn brass sm" type="button" data-random>Randomise</button><button class="btn paper sm" type="button" data-swap>Swap two</button></div>' +
        '<div class="roles-names"></div>' +
        '<p class="muted roles-msg" style="font-size:13px"></p>' +
      '</section>' +
      '<div class="roles-cards"></div>' +
      '<section class="panel">' +
        '<p class="kicker">Ownership</p>' +
        '<h2>Every component has one owner</h2>' +
        '<p>Only the owner makes it. If one name owns everything, the others have nothing to show. Put a name in every row.</p>' +
        '<div class="roles-manifest"></div>' +
        '<div class="roles-tally"></div>' +
        '<div class="btn-row" style="margin-top:12px"><button class="btn paper sm" type="button" data-print-cards>Print role cards</button><button class="btn paper sm" type="button" data-print-board>Print the ownership board</button></div>' +
      '</section>';

    el.querySelector('.seg').addEventListener('click', function (e) {
      var b = e.target.closest('[data-size]'); if (!b) return;
      el.querySelectorAll('[data-size]').forEach(function (x) { x.classList.toggle('on', x === b); });
      save({ size: +b.dataset.size, assign: {} }); swapped = false; renderNames(); renderCards();
    });
    el.querySelector('.roles-names').addEventListener('input', function (e) {
      var i = e.target.dataset.n; if (i == null) return;
      var names = state().names.slice(); names[+i] = e.target.value; save({ names: names }); renderCards();
    });
    el.querySelector('[data-random]').addEventListener('click', function () {
      var st = state(), people = [];
      for (var i = 0; i < st.size; i++) people.push(i);
      for (var j = people.length - 1; j > 0; j--) { var k = B.rand(j + 1) - 1; var t = people[j]; people[j] = people[k]; people[k] = t; }
      var assign = {};
      if (st.size === 4) ROLES.forEach(function (r, i) { assign[r.id] = people[i]; });
      else { var dbl = PAIRS[B.rand(2) - 1]; assign[dbl[0]] = people[0]; assign[dbl[1]] = people[0]; var rest = ROLES.filter(function (r) { return dbl.indexOf(r.id) < 0; }); assign[rest[0].id] = people[1]; assign[rest[1].id] = people[2]; }
      save({ assign: assign }); swapped = false; renderCards();
      el.querySelector('.roles-msg').textContent = 'Random. One swap allowed, then it stands.';
    });
    el.querySelector('[data-swap]').addEventListener('click', function () {
      if (swapped) { el.querySelector('.roles-msg').textContent = 'The swap is used. It stands.'; return; }
      var st = state(), ids = Object.keys(st.assign); if (ids.length < 2) return;
      var a = prompt('Swap which two roles? Type two of: ' + ROLES.map(function (r) { return r.id; }).join(', ') + '\n(e.g. rules art)');
      if (!a) return;
      var p = a.toLowerCase().trim().split(/[\s,]+/);
      if (p.length !== 2 || st.assign[p[0]] == null || st.assign[p[1]] == null) { el.querySelector('.roles-msg').textContent = 'Did not understand that. Type two role ids.'; return; }
      var t = st.assign[p[0]]; st.assign[p[0]] = st.assign[p[1]]; st.assign[p[1]] = t;
      save({ assign: st.assign }); swapped = true; renderCards();
      el.querySelector('.roles-msg').textContent = 'Swapped. That was the one.';
    });
    el.querySelector('.roles-cards').addEventListener('change', function (e) {
      var sel = e.target.closest('[data-assign]'); if (!sel) return;
      var st = state(); if (sel.value === '') delete st.assign[sel.dataset.assign]; else st.assign[sel.dataset.assign] = +sel.value;
      save({ assign: st.assign }); renderCards();
    });
    el.querySelector('[data-print-cards]').addEventListener('click', printCards);
    el.querySelector('[data-print-board]').addEventListener('click', printBoard);

    unmountManifest = B.manifest.mount(el.querySelector('.roles-manifest'), store, { owners: true });
    unsubs.push(store.on('manifest', renderTally));
    renderNames(); renderCards(); renderTally();
  }
  function unmount() { if (unmountManifest) unmountManifest(); unmountManifest = null; unsubs.forEach(function (u) { u(); }); unsubs = []; el = null; }

  function personName(i) { var n = state().names[i]; return n && n.trim() ? n.trim() : 'Person ' + (i + 1); }
  function renderNames() {
    var st = state(), h = '';
    for (var i = 0; i < st.size; i++) h += '<input class="input" type="text" value="' + B.esc(st.names[i] || '') + '" data-n="' + i + '" placeholder="Person ' + (i + 1) + '" maxlength="24" aria-label="Team member ' + (i + 1) + '">';
    el.querySelector('.roles-names').innerHTML = h;
  }
  function renderCards() {
    var st = state();
    el.querySelector('.roles-cards').innerHTML = '<div class="roles-grid">' + ROLES.map(function (r) {
      var who = st.assign[r.id];
      return '<section class="panel role-card" style="--sw:var(' + r.v + ')"><div class="role-head"><h3>' + r.name + '</h3>' +
        '<select class="input" data-assign="' + r.id + '" aria-label="Who is ' + r.name + '"><option value="">Nobody yet</option>' +
        Array.apply(null, { length: st.size }).map(function (_, i) { return '<option value="' + i + '"' + (who === i ? ' selected' : '') + '>' + B.esc(personName(i)) + '</option>'; }).join('') + '</select></div>' +
        '<div class="role-tracks"><span class="badge">' + r.tracks[0] + '</span><span class="badge ink">' + r.tracks[1] + '</span></div>' +
        '<div class="label">You own</div><p>' + r.owns + '</p>' +
        '<div class="label">By session 4</div><p>' + r.by4 + '</p>' +
        '<div class="label">Skills you can show</div><ul>' + r.skills.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ul></section>';
    }).join('') + '</div>';
    // coverage check
    var counts = {}, msg = [];
    Object.keys(st.assign).forEach(function (k) { counts[st.assign[k]] = (counts[st.assign[k]] || 0) + 1; });
    for (var i = 0; i < st.size; i++) if (!counts[i]) msg.push(personName(i) + ' has no role');
    Object.keys(counts).forEach(function (i) { if (counts[i] > 2) msg.push(personName(+i) + ' has ' + counts[i] + ' roles, which is too many'); });
    if (Object.keys(st.assign).length === 4 && !msg.length) msg.push('Everyone has a role and every role has an owner.');
    var m = el.querySelector('.roles-msg'); if (msg.length && !/Random|Swapped|swap is used/.test(m.textContent)) m.textContent = msg.join('. ') + '.';
  }
  function renderTally() {
    if (!el) return;
    var list = store.get('manifest'), by = {}, total = 0, none = 0;
    list.forEach(function (r) { var o = (r.owner || '').trim(); total += r.count || 0; if (!o) none += r.count || 0; else by[o] = (by[o] || 0) + (r.count || 0); });
    var names = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; });
    var h = names.map(function (n) {
      var share = total ? by[n] / total : 0;
      return '<div class="kind-bar"><span>' + B.esc(n) + '</span><i style="width:' + Math.max(2, share * 100) + '%"' + (share > 0.5 ? ' class="top"' : '') + '></i><b class="num">' + by[n] + '</b></div>';
    }).join('');
    if (none) h += '<div class="kind-bar muted"><span>no owner</span><i style="width:' + Math.max(2, (total ? none / total : 0) * 100) + '%;background:var(--paper-3)"></i><b class="num">' + none + '</b></div>';
    var warn = names.filter(function (n) { return total && by[n] / total > 0.5; }).map(function (n) { return B.esc(n) + ' owns more than half the pieces.'; });
    if (none) warn.push(none + ' piece' + (none === 1 ? '' : 's') + ' with no owner.');
    el.querySelector('.roles-tally').innerHTML = '<div class="label" style="margin-top:12px">Pieces by owner</div>' + (h || '<p class="muted">Nothing on the list.</p>') + warn.map(function (w) { return '<p class="callout">' + w + '</p>'; }).join('');
  }
  function printCards() {
    var st = state();
    B.printSection(B.el('<section class="print-roles">' + ROLES.map(function (r) {
      var who = st.assign[r.id];
      return '<div class="panel" style="page-break-inside:avoid;margin-bottom:12px"><h2>' + r.name + (who != null ? ' — ' + B.esc(personName(who)) : '') + '</h2><p><b>Tracks:</b> ' + r.tracks.join(' · ') + '</p><p><b>You own:</b> ' + r.owns + '</p><p><b>By session 4:</b> ' + r.by4 + '</p><p><b>Skills you can show:</b></p><ul>' + r.skills.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ul></div>';
    }).join('') + '</section>'));
  }
  function printBoard() {
    var list = store.get('manifest');
    B.printSection(B.el('<section class="panel"><h2>Ownership board</h2><table class="sheet"><thead><tr><th>Owner</th><th>Component</th><th>How many</th><th>Done ☐</th></tr></thead><tbody>' +
      list.slice().sort(function (a, b) { return (a.owner || '').localeCompare(b.owner || ''); }).map(function (r) { return '<tr><td><b>' + B.esc(r.owner || '—') + '</b></td><td>' + B.esc(r.name) + '</td><td>' + r.count + '</td><td>☐</td></tr>'; }).join('') +
      '</tbody></table></section>'));
  }

  B.register({ id: 'roles', title: 'Roles', blurb: 'Four roles, two tracks each, one owner per part.', mount: mount, unmount: unmount });
})();
