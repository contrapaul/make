/* Simplify: small demos of one principle each, then case studies of big
   games made recess-sized, then a worksheet to do it to your own game. */
(function () {
  'use strict';
  var B = window.Bench, DEMOS = window.DEMO_DATA;

  var el, store = B.store, timers = [], tick = null;
  function state() { return Object.assign({ cut: [], cutRound: 0, campaign: { regions: {}, log: [] }, own: {}, dnd: {} }, store.get('simplify') || {}); }
  function save(patch) { store.set('simplify', Object.assign(state(), patch)); }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clock(s) { return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60); }

  var INDEX = [
    ['roll', 'Roll vs choose'], ['money', 'Three currencies vs one'], ['twelve', 'Twelve kinds vs five'],
    ['exc', 'Exceptions'], ['half', 'Cut it in half'], ['dnd', 'D&D'], ['risk', 'Risk'], ['monopoly', 'Monopoly'],
    ['catan', 'Catan'], ['magic', 'Magic'], ['pandemic', 'Pandemic'], ['own', 'Shrink your own']
  ];

  function mount(root) {
    el = root;
    el.innerHTML =
      '<section class="panel">' +
        '<p class="kicker">Simplify</p>' +
        '<h2>Big games made recess-sized</h2>' +
        '<p>Every game that fits a lunch break is a bigger game with the right parts cut off. First five small demos, one idea each. Then six games you know, shrunk. Then yours.</p>' +
        '<nav class="sim-index">' + INDEX.map(function (i) { return '<a href="#simplify" data-jump="' + i[0] + '">' + i[1] + '</a>'; }).join('') + '</nav>' +
      '</section>' +
      rollDemo() + moneyDemo() + twelveDemo() + excDemo() + halfDemo() +
      DEMOS.map(caseStudy).join('') +
      ownDemo();

    el.querySelector('.sim-index').addEventListener('click', function (e) {
      var a = e.target.closest('[data-jump]'); if (!a) return; e.preventDefault();
      var t = el.querySelector('#sim-' + a.dataset.jump); if (t) t.scrollIntoView({ behavior: B.reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    });
    wireRoll(); wireMoney(); wireTwelve(); wireExc(); wireHalf(); wireDnd(); wireCampaign(); wireOwn();
  }
  function unmount() { timers.forEach(clearTimeout); timers = []; if (tick) clearInterval(tick); tick = null; el = null; }
  function section(id, kicker, title, intro, body) {
    return '<section class="panel sim" id="sim-' + id + '"><p class="kicker">' + kicker + '</p><h2>' + title + '</h2><p>' + intro + '</p>' + body + '</section>';
  }

  /* ---------- 1. roll and move vs choose ---------- */
  var TRACK = 12, TRAPS = [4, 8];
  var roll = { L: { pos: 0, rolls: 0 }, R: { pos: 0, rolls: 0, choices: 0, pending: 0 } };
  function rollDemo() {
    function track(side) {
      var s = '<div class="sim-track" data-side="' + side + '">';
      for (var i = 0; i <= TRACK; i++) s += '<i class="' + (side === 'R' && TRAPS.indexOf(i) >= 0 ? 'trap' : '') + (i === TRACK ? ' goal' : '') + '" data-i="' + i + '">' + (i === 0 ? '' : i === TRACK ? '★' : side === 'R' && TRAPS.indexOf(i) >= 0 ? '▼' : '') + '</i>';
      return s + '</div>';
    }
    return section('roll', 'Demo 1', 'Roll and move, or roll and choose',
      'Same track, same die. On the left you roll and go. On the right you roll and then pick. Play both to the star and count your decisions.',
      '<div class="tool-grid"><div class="sim-half"><h3>Roll and move</h3>' + track('L') + '<div class="btn-row"><button class="btn sm" type="button" data-roll="L">Roll</button><span class="num sim-msg" data-msg="L">Rolls: 0 · Decisions: 0</span></div></div>' +
      '<div class="sim-half"><h3>Roll and choose</h3>' + track('R') + '<div class="btn-row"><button class="btn sm" type="button" data-roll="R">Roll</button><span class="sim-choice" hidden><button class="btn brass sm" type="button" data-pick="road">Road: move <b></b></button><button class="btn brass sm" type="button" data-pick="tunnel">Tunnel: move <b></b>, traps send you back 3</button></span><span class="num sim-msg" data-msg="R">Rolls: 0 · Decisions: 0</span></div></div></div>' +
      '<p class="sim-ask">Which side did you make a decision on? Which side would you play again? That gap is the whole reason the unit bans roll-and-move.</p>');
  }
  function wireRoll() {
    el.querySelectorAll('[data-roll]').forEach(function (b) {
      b.addEventListener('click', function () {
        var side = b.dataset.roll, st = roll[side];
        if (st.pos >= TRACK) { st.pos = 0; st.rolls = 0; st.choices = 0; }
        var n = B.rand(6); st.rolls++;
        if (side === 'L') { move('L', Math.min(TRACK, st.pos + n)); return; }
        st.pending = n;
        var c = el.querySelector('.sim-choice'); c.hidden = false;
        c.querySelector('[data-pick="road"] b').textContent = n; c.querySelector('[data-pick="tunnel"] b').textContent = n + 2;
        msg('R');
      });
    });
    el.querySelectorAll('[data-pick]').forEach(function (b) {
      b.addEventListener('click', function () {
        var st = roll.R, n = st.pending; st.choices++;
        el.querySelector('.sim-choice').hidden = true;
        var to = b.dataset.pick === 'road' ? st.pos + n : st.pos + n + 2;
        if (b.dataset.pick === 'tunnel' && TRAPS.indexOf(to) >= 0) { move('R', to); later(function () { move('R', Math.max(0, to - 3)); }, 500); return; }
        move('R', Math.min(TRACK, to));
      });
    });
    function move(side, to) {
      roll[side].pos = to;
      el.querySelectorAll('.sim-track[data-side="' + side + '"] i').forEach(function (c) { c.classList.toggle('pawn', +c.dataset.i === to); });
      msg(side);
    }
    function msg(side) {
      var st = roll[side], done = st.pos >= TRACK;
      el.querySelector('[data-msg="' + side + '"]').textContent = 'Rolls: ' + st.rolls + ' · Decisions: ' + (st.choices || 0) + (done ? ' · Finished!' : '');
    }
    move('L', 0); move('R', 0);
  }

  /* ---------- 2. three currencies vs one ---------- */
  var SHOP = [
    { name: 'Cart', three: { gold: 3, wood: 2, stone: 0 }, one: 5 },
    { name: 'Wall', three: { gold: 0, wood: 1, stone: 4 }, one: 5 },
    { name: 'Well', three: { gold: 2, wood: 1, stone: 2 }, one: 5 }
  ];
  var money = { three: { gold: 5, wood: 3, stone: 4, ops: 0, bought: [] }, one: { pts: 15, ops: 0, bought: [] } };
  function moneyDemo() {
    return section('money', 'Demo 2', 'Three currencies or one',
      'Same shop, same prices in total. On the left you pay in gold, wood and stone. On the right you pay in points. Buy two things on each side and watch the counter of sums you did in your head.',
      '<div class="tool-grid"><div class="sim-half"><h3>Gold, wood, stone</h3><p class="num sim-purse" data-purse="three"></p>' +
        SHOP.map(function (it, i) { return '<div class="sim-item"><b>' + it.name + '</b><span class="num">' + ['gold', 'wood', 'stone'].filter(function (k) { return it.three[k]; }).map(function (k) { return it.three[k] + ' ' + k; }).join(' + ') + '</span><button class="btn paper sm" type="button" data-buy="three" data-i="' + i + '">Buy</button></div>'; }).join('') +
        '<p class="sim-msg num" data-ops="three"></p></div>' +
      '<div class="sim-half"><h3>Points</h3><p class="num sim-purse" data-purse="one"></p>' +
        SHOP.map(function (it, i) { return '<div class="sim-item"><b>' + it.name + '</b><span class="num">' + it.one + ' pts</span><button class="btn paper sm" type="button" data-buy="one" data-i="' + i + '">Buy</button></div>'; }).join('') +
        '<p class="sim-msg num" data-ops="one"></p></div></div>' +
      '<p class="sim-ask">Every currency is a sum on every turn for every player. Three currencies is not three times the depth; it is three times the arithmetic. Ask what the second and third currency let a player <em>decide</em> that one could not.</p>');
  }
  function wireMoney() {
    el.querySelectorAll('[data-buy]').forEach(function (b) {
      b.addEventListener('click', function () {
        var side = b.dataset.buy, it = SHOP[+b.dataset.i], m = money[side];
        if (side === 'three') {
          var keys = ['gold', 'wood', 'stone'].filter(function (k) { return it.three[k]; });
          m.ops += keys.length * 2;   // a compare and a subtract per currency
          if (keys.some(function (k) { return m[k] < it.three[k]; })) { flash(b, 'Not enough'); render(); return; }
          keys.forEach(function (k) { m[k] -= it.three[k]; });
        } else {
          m.ops += 2;
          if (m.pts < it.one) { flash(b, 'Not enough'); render(); return; }
          m.pts -= it.one;
        }
        m.bought.push(it.name); render();
      });
    });
    function flash(b, t) { var o = b.textContent; b.textContent = t; later(function () { b.textContent = o; }, 900); }
    function render() {
      var t = money.three, o = money.one;
      el.querySelector('[data-purse="three"]').textContent = 'You have ' + t.gold + ' gold, ' + t.wood + ' wood, ' + t.stone + ' stone';
      el.querySelector('[data-purse="one"]').textContent = 'You have ' + o.pts + ' points';
      el.querySelector('[data-ops="three"]').textContent = 'Sums in your head: ' + t.ops + (t.bought.length ? ' · bought ' + t.bought.join(', ') : '');
      el.querySelector('[data-ops="one"]').textContent = 'Sums in your head: ' + o.ops + (o.bought.length ? ' · bought ' + o.bought.join(', ') : '');
    }
    render();
  }

  /* ---------- 3. twelve kinds vs five ---------- */
  var TWELVE = [['Shield', 'block one attack'], ['Bomb', 'destroy a wall'], ['Key', 'open any door'], ['Rope', 'cross a gap'], ['Torch', 'see two rooms'], ['Map', 'move twice'], ['Potion', 'heal 2'], ['Dagger', 'deal 1'], ['Sword', 'deal 2'], ['Bow', 'deal 1 at range'], ['Cloak', 'skip a trap'], ['Coin', 'bribe a guard']];
  var FIVE = [['Attack', 'deal 2'], ['Block', 'stop one attack'], ['Move', 'go two rooms'], ['Heal', 'heal 2'], ['Wild', 'any of the above']];
  var twelve = { phase: 0, set: null };
  function twelveDemo() {
    return section('twelve', 'Demo 3', 'Twelve kinds of card, or five',
      'You get ten seconds with a deck. Then it hides, and you tick every card you could still explain. Try the twelve first, then the five.',
      '<div class="btn-row"><button class="btn sm" type="button" data-show="12">Show me twelve</button><button class="btn sm" type="button" data-show="5">Show me five</button><span class="num sim-msg" data-countdown></span></div>' +
      '<div class="sim-cards"></div><p class="sim-msg num" data-twelve-score></p>' +
      '<p class="sim-ask">Every kind of card is a rule the player carries. A deck with five kinds is learned in one hand. A deck with twelve is looked up all game. If two kinds do nearly the same thing, they are one kind.</p>');
  }
  function wireTwelve() {
    el.querySelectorAll('[data-show]').forEach(function (b) {
      b.addEventListener('click', function () {
        var set = b.dataset.show === '12' ? TWELVE : FIVE, box = el.querySelector('.sim-cards'), cd = el.querySelector('[data-countdown]');
        twelve.set = set;
        box.innerHTML = set.map(function (c) { return '<div class="sim-mini"><b>' + c[0] + '</b><span>' + c[1] + '</span></div>'; }).join('');
        el.querySelector('[data-twelve-score]').textContent = '';
        var left = 10; cd.textContent = left + ' s';
        if (tick) clearInterval(tick);
        tick = setInterval(function () {
          left--; cd.textContent = left + ' s';
          if (left <= 0) {
            clearInterval(tick); tick = null; cd.textContent = 'Which could you explain?';
            box.innerHTML = set.map(function (c, i) { return '<label class="sim-mini quiz"><input type="checkbox" data-q="' + i + '"><b>' + c[0] + '</b></label>'; }).join('') + '<button class="btn brass sm" type="button" data-twelve-done>Done</button>';
            box.querySelector('[data-twelve-done]').addEventListener('click', function () {
              var n = box.querySelectorAll('input:checked').length;
              el.querySelector('[data-twelve-score]').textContent = n + ' of ' + set.length + ' remembered';
              box.innerHTML = set.map(function (c, i) { return '<div class="sim-mini"><b>' + c[0] + '</b><span>' + c[1] + '</span></div>'; }).join('');
            });
          }
        }, 1000);
      });
    });
  }

  /* ---------- 4. exceptions ---------- */
  function excDemo() {
    return section('exc', 'Demo 4', 'Count the exceptions',
      'Paste a rule or two. Every <em>unless</em>, <em>except</em> and <em>cannot</em> lights up. Each one is a thing a player has to remember at the wrong moment.',
      '<textarea class="input" rows="4" data-exc-text placeholder="You may move up to three spaces, unless you are carrying treasure, in which case two, except on a road, where treasure does not slow you…"></textarea>' +
      '<p class="sim-msg" data-exc-out></p>' +
      '<p class="sim-ask">Now rewrite it with none. Usually the rule gets shorter and the game gets better. If an exception has to stay, make it a card players hold instead of a sentence they remember. <a href="#rules">Rules</a> counts them across a whole rulebook.</p>');
  }
  function wireExc() {
    var t = el.querySelector('[data-exc-text]'), out = el.querySelector('[data-exc-out]');
    t.addEventListener('input', function () {
      var a = B.rules.analyse(t.value);
      out.innerHTML = a.words ? '<b class="num">' + a.exceptions.length + '</b> exception' + (a.exceptions.length === 1 ? '' : 's') + ' in ' + a.words + ' words' +
        (a.exceptions.length ? ': ' + a.exceptions.map(function (x) { return '<span class="badge berry">' + B.esc(x.word) + '</span>'; }).join(' ') : '') : '';
    });
  }

  /* ---------- 5. cut it in half ---------- */
  function halfDemo() {
    var st = state();
    return section('half', 'Demo 5', 'Cut it in half',
      'List every mechanic and rule in your game, one per line. Then cut half of them. Then answer one question.',
      '<textarea class="input" rows="5" data-half-text placeholder="Roll to move&#10;Collect gems&#10;Trade gems for cards&#10;Steal from a neighbour&#10;Bonus turn on a six&#10;…">' + B.esc((st.cut || []).map(function (c) { return c.name; }).join('\n')) + '</textarea>' +
      '<div class="btn-row" style="margin:8px 0"><button class="btn sm" type="button" data-half-go>Lay them out</button><span class="sim-msg" data-half-msg></span></div>' +
      '<div class="sim-chips" data-half-chips></div>' +
      '<div class="sim-halfq" hidden><p><b>Is there still a meaningful choice?</b> Options that are really different, none always best, a player can reason about it, and the result is visible.</p>' +
        '<div class="btn-row"><button class="btn brass sm" type="button" data-half-yes>Yes, cut half again</button><button class="btn paper sm" type="button" data-half-no>No, put one back</button><button class="btn paper sm" type="button" data-half-csv>Download what survived (CSV)</button></div></div>' +
      '<p class="sim-ask">The tool does not judge. It only forces the pass. What survives two rounds is your game. The rest was scaffolding you were fond of.</p>');
  }
  function wireHalf() {
    var chips = el.querySelector('[data-half-chips]'), q = el.querySelector('.sim-halfq'), msg = el.querySelector('[data-half-msg]');
    function items() { return state().cut || []; }
    function render() {
      var list = items(), alive = list.filter(function (c) { return !c.cut; }).length, need = Math.floor(alive / 2);
      chips.innerHTML = list.map(function (c, i) { return '<button type="button" class="sim-chip' + (c.cut ? ' cut' : '') + '" data-i="' + i + '">' + B.esc(c.name) + '</button>'; }).join('');
      var toCut = state().cutRound ? Math.max(0, state().target - list.filter(function (c) { return c.cut; }).length) : 0;
      msg.textContent = list.length ? (toCut > 0 ? 'Cut ' + toCut + ' more.' : alive <= 1 ? 'One left. That is your core.' : 'Round ' + state().cutRound + '. ' + alive + ' left.') : '';
      q.hidden = !(list.length && state().cutRound && toCut === 0 && alive > 1);
    }
    el.querySelector('[data-half-go]').addEventListener('click', function () {
      var names = el.querySelector('[data-half-text]').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      var list = names.map(function (n) { return { name: n, cut: false }; });
      save({ cut: list, cutRound: 1, target: Math.floor(list.length / 2) }); render();
    });
    chips.addEventListener('click', function (e) {
      var b = e.target.closest('.sim-chip'); if (!b) return;
      var list = items(); list[+b.dataset.i].cut = !list[+b.dataset.i].cut; save({ cut: list }); render();
    });
    el.querySelector('[data-half-yes]').addEventListener('click', function () {
      var list = items(), alive = list.filter(function (c) { return !c.cut; }).length;
      save({ cutRound: state().cutRound + 1, target: list.filter(function (c) { return c.cut; }).length + Math.floor(alive / 2) }); render();
    });
    el.querySelector('[data-half-no]').addEventListener('click', function () {
      save({ target: Math.max(0, state().target - 1) }); msg.textContent = 'Click a cut one to bring it back.'; q.hidden = true;
    });
    el.querySelector('[data-half-csv]').addEventListener('click', function () {
      B.downloadCSV([['mechanic', 'kept']].concat(items().map(function (c) { return [c.name, c.cut ? 'cut' : 'kept']; })), 'cut-in-half.csv');
    });
    render();
  }

  /* ---------- case studies ---------- */
  function caseStudy(d) {
    var table = '<table class="sheet sim-kcc"><thead><tr><th>What we kept</th><th>What we cut</th><th>What it cost us</th></tr></thead><tbody>';
    var n = Math.max(d.kept.length, d.cut.length, d.cost.length);
    for (var i = 0; i < n; i++) table += '<tr><td>' + (d.kept[i] || '') + '</td><td>' + (d.cut[i] || '') + '</td><td>' + (d.cost[i] || '') + '</td></tr>';
    table += '</tbody></table>';
    var inter = d.interactive === 'dnd' ? dndBlock() : d.interactive === 'campaign' ? campaignBlock() : '';
    return '<section class="panel sim" id="sim-' + d.id + '"><p class="kicker">' + d.tag + '</p><h2>' + d.name + '</h2>' +
      '<div class="sim-bigsmall"><div><div class="label">The big game</div><p>' + d.big + '</p></div><div><div class="label">Recess-sized</div><p>' + d.small + '</p></div></div>' +
      inter + '<p class="sim-lesson">' + d.lesson + '</p>' + table + '</section>';
  }

  /* D&D: build a character both ways, timed */
  var SPECIES = ['Human', 'Elf', 'Dwarf', 'Halfling', 'Orc', 'Gnome'], CLASSES = ['Fighter', 'Rogue', 'Wizard', 'Cleric', 'Ranger', 'Bard', 'Paladin', 'Druid'], BACKGROUNDS = ['Soldier', 'Urchin', 'Sage', 'Acolyte', 'Noble', 'Outlander'];
  var SKILLS = ['Athletics', 'Stealth', 'Arcana', 'History', 'Insight', 'Medicine', 'Perception', 'Persuasion', 'Survival', 'Deception'], PACKS = ['Explorer’s pack', 'Dungeoneer’s pack', 'Priest’s pack', 'Burglar’s pack'];
  var ARCH = [['Knight', 'Hits hard, takes hits.'], ['Rogue', 'Sneaks, steals, strikes first.'], ['Mage', 'Fragile, but the spells.'], ['Healer', 'Keeps everyone else alive.']];
  var MOVES = ['Charge', 'Vanish', 'Blast'], FLAWS = ['Greedy', 'Reckless', 'Soft-hearted'];
  var dnd = { long: { t0: null, done: null }, arch: { t0: null, done: null } };
  function dndBlock() {
    var best = state().dnd;
    function sel(name, opts) { return '<select class="input" data-long="' + name + '"><option value="">' + name + '…</option>' + opts.map(function (o) { return '<option>' + o + '</option>'; }).join('') + '</select>'; }
    return '<div class="tool-grid sim-dnd"><div class="sim-half"><h3>The long way</h3><div class="btn-row"><button class="btn sm" type="button" data-dnd-start="long">Start</button><span class="num sim-msg" data-dnd-time="long">' + (best.long ? 'Best: ' + clock(best.long) : '') + '</span></div>' +
      '<div class="sim-form" data-dnd-form="long">' + sel('Species', SPECIES) + sel('Class', CLASSES) + sel('Background', BACKGROUNDS) +
      '<div class="sim-stats"><button class="btn paper sm" type="button" data-dnd-roll>Roll six scores (4d6, drop lowest)</button><span class="num" data-dnd-scores></span></div>' +
      '<div class="sim-skills"><span class="label">Pick two skills</span>' + SKILLS.map(function (s) { return '<label><input type="checkbox" data-long-skill> ' + s + '</label>'; }).join('') + '</div>' +
      sel('Equipment', PACKS) + '<button class="btn brass sm" type="button" data-dnd-done="long" disabled>Done</button></div></div>' +
      '<div class="sim-half"><h3>The archetype way</h3><div class="btn-row"><button class="btn sm" type="button" data-dnd-start="arch">Start</button><span class="num sim-msg" data-dnd-time="arch">' + (best.arch ? 'Best: ' + clock(best.arch) : '') + '</span></div>' +
      '<div class="sim-form" data-dnd-form="arch"><div class="sim-arch">' + ARCH.map(function (a) { return '<button type="button" class="sim-archcard" data-arch="' + a[0] + '"><b>' + a[0] + '</b><span>' + a[1] + '</span></button>'; }).join('') + '</div>' +
      '<div class="sim-radios"><span class="label">Signature move</span>' + MOVES.map(function (m) { return '<label><input type="radio" name="sim-move" value="' + m + '"> ' + m + '</label>'; }).join('') + '</div>' +
      '<div class="sim-radios"><span class="label">One flaw</span>' + FLAWS.map(function (m) { return '<label><input type="radio" name="sim-flaw" value="' + m + '"> ' + m + '</label>'; }).join('') + '</div>' +
      '<button class="btn brass sm" type="button" data-dnd-done="arch" disabled>Done</button></div></div></div>';
  }
  function wireDnd() {
    var forms = { long: el.querySelector('[data-dnd-form="long"]'), arch: el.querySelector('[data-dnd-form="arch"]') };
    Object.keys(forms).forEach(function (k) { forms[k].classList.add('locked'); });
    el.querySelectorAll('[data-dnd-start]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.dataset.dndStart; dnd[k].t0 = Date.now(); dnd[k].done = null; forms[k].classList.remove('locked');
        if (tick) clearInterval(tick);
        tick = setInterval(function () { Object.keys(dnd).forEach(function (kk) { if (dnd[kk].t0 && !dnd[kk].done) el.querySelector('[data-dnd-time="' + kk + '"]').textContent = clock(Math.floor((Date.now() - dnd[kk].t0) / 1000)); }); }, 500);
      });
    });
    el.querySelector('[data-dnd-roll]').addEventListener('click', function () {
      var p = B.dice.parse('4d6dl1'), out = []; for (var i = 0; i < 6; i++) out.push(B.dice.roll(p).total);
      el.querySelector('[data-dnd-scores]').textContent = out.join(' · '); check('long');
    });
    forms.long.addEventListener('change', function () { check('long'); });
    forms.arch.addEventListener('change', function () { check('arch'); });
    forms.arch.addEventListener('click', function (e) {
      var b = e.target.closest('[data-arch]'); if (!b) return;
      forms.arch.querySelectorAll('[data-arch]').forEach(function (x) { x.classList.toggle('on', x === b); }); check('arch');
    });
    function check(k) {
      var ok;
      if (k === 'long') ok = Array.prototype.every.call(forms.long.querySelectorAll('select'), function (s) { return s.value; }) && el.querySelector('[data-dnd-scores]').textContent && forms.long.querySelectorAll('[data-long-skill]:checked').length === 2;
      else ok = forms.arch.querySelector('[data-arch].on') && forms.arch.querySelector('[name="sim-move"]:checked') && forms.arch.querySelector('[name="sim-flaw"]:checked');
      el.querySelector('[data-dnd-done="' + k + '"]').disabled = !ok;
    }
    el.querySelectorAll('[data-dnd-done]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.dataset.dndDone; if (!dnd[k].t0) return;
        var s = Math.floor((Date.now() - dnd[k].t0) / 1000); dnd[k].done = s;
        var best = state().dnd; if (!best[k] || s < best[k]) best[k] = s; save({ dnd: best });
        el.querySelector('[data-dnd-time="' + k + '"]').textContent = clock(s) + (best[k] === s ? ' · best' : ' · best ' + clock(best[k]));
        forms[k].classList.add('locked'); b.disabled = true;
      });
    });
  }

  /* Risk: a campaign map that remembers */
  var REGIONS = [['north', 'North', 60, 28], ['coast', 'Coast', 22, 60], ['plains', 'Plains', 60, 60], ['hills', 'Hills', 98, 60], ['marsh', 'Marsh', 41, 92], ['south', 'South', 79, 92]];
  var FACTIONS = { a: { name: 'Red', v: '--berry' }, b: { name: 'Gold', v: '--brass' } };
  function campaignBlock() {
    return '<div class="sim-campaign"><div class="sim-map"></div><div class="sim-camp-side"><p class="sim-msg" data-camp-msg>Tap a region to fight for it. One skirmish is one recess.</p>' +
      '<div class="sim-skirmish" hidden><b data-camp-title></b><div class="sim-dice-off"><span data-camp-a class="num"></span><span class="muted">vs</span><span data-camp-b class="num"></span></div><button class="btn sm" type="button" data-camp-fight>Roll the skirmish (3d6 each, highest wins)</button></div>' +
      '<div class="label" style="margin-top:12px">Campaign log</div><ol class="sim-camp-log"></ol>' +
      '<div class="btn-row"><button class="btn paper sm" type="button" data-camp-csv>Download the log (CSV)</button><button class="btn paper sm" type="button" data-camp-reset>New war</button></div></div></div>';
  }
  function wireCampaign() {
    var map = el.querySelector('.sim-map'), log = el.querySelector('.sim-camp-log'), sk = el.querySelector('.sim-skirmish'), picked = null;
    function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
    function draw() {
      var c = state().campaign, ink = cssVar('--ink'), paper = cssVar('--paper-3');
      map.innerHTML = '<svg viewBox="0 0 120 120" role="img" aria-label="Campaign map">' + REGIONS.map(function (r) {
        var own = c.regions[r[0]], fill = own ? cssVar(FACTIONS[own].v) : paper;
        var pts = []; for (var i = 0; i < 6; i++) { var a = Math.PI / 3 * i; pts.push((r[2] + 17 * Math.cos(a)).toFixed(1) + ',' + (r[3] + 17 * Math.sin(a)).toFixed(1)); }
        return '<g class="sim-region' + (picked === r[0] ? ' on' : '') + '" data-region="' + r[0] + '"><polygon points="' + pts.join(' ') + '" fill="' + fill + '" stroke="' + ink + '" stroke-width="1"/><text x="' + r[2] + '" y="' + (r[3] + 2) + '" text-anchor="middle" font-size="5.5" font-weight="700" fill="' + (own ? '#fff' : ink) + '">' + r[1] + '</text></g>';
      }).join('') + '</svg>';
      var a = Object.keys(c.regions).filter(function (k) { return c.regions[k] === 'a'; }).length, b = Object.keys(c.regions).filter(function (k) { return c.regions[k] === 'b'; }).length;
      log.innerHTML = c.log.length ? c.log.map(function (e) { return '<li><span class="muted num">' + e.date + '</span> ' + FACTIONS[e.winner].name + ' took ' + e.region + ' <span class="muted num">' + e.a + ' v ' + e.b + '</span></li>'; }).join('') : '<li class="muted" style="list-style:none">No sessions yet.</li>';
      if (c.log.length) el.querySelector('[data-camp-msg]').textContent = 'Session ' + (c.log.length + 1) + '. Red holds ' + a + ', Gold holds ' + b + '. ' + (a >= 4 ? 'Red wins the war.' : b >= 4 ? 'Gold wins the war.' : 'Four regions wins.');
    }
    map.addEventListener('click', function (e) {
      var g = e.target.closest('[data-region]'); if (!g) return;
      picked = g.dataset.region; var r = REGIONS.find(function (x) { return x[0] === picked; });
      sk.hidden = false; el.querySelector('[data-camp-title]').textContent = 'Fight for ' + r[1];
      el.querySelector('[data-camp-a]').textContent = 'Red'; el.querySelector('[data-camp-b]').textContent = 'Gold'; draw();
    });
    el.querySelector('[data-camp-fight]').addEventListener('click', function () {
      if (!picked) return;
      var p = B.dice.parse('3d6kh1'), a = B.dice.roll(p).total, b = B.dice.roll(p).total;
      while (a === b) { a = B.dice.roll(p).total; b = B.dice.roll(p).total; }
      var ms = B.reducedMotion() ? 0 : 600, ea = el.querySelector('[data-camp-a]'), eb = el.querySelector('[data-camp-b]'), t0 = performance.now();
      (function flick() {
        if (performance.now() - t0 < ms) { ea.textContent = B.rand(6); eb.textContent = B.rand(6); later(flick, 60); return; }
        ea.textContent = 'Red ' + a; eb.textContent = 'Gold ' + b;
        var c = state().campaign, r = REGIONS.find(function (x) { return x[0] === picked; });
        c.regions[picked] = a > b ? 'a' : 'b';
        c.log.push({ date: new Date().toLocaleDateString(), region: r[1], winner: a > b ? 'a' : 'b', a: a, b: b });
        save({ campaign: c }); picked = null; sk.hidden = true; draw();
      })();
    });
    el.querySelector('[data-camp-reset]').addEventListener('click', function () { if (confirm('Start a new war? The map and log are cleared.')) { save({ campaign: { regions: {}, log: [] } }); picked = null; sk.hidden = true; el.querySelector('[data-camp-msg]').textContent = 'Tap a region to fight for it.'; draw(); } });
    el.querySelector('[data-camp-csv]').addEventListener('click', function () {
      B.downloadCSV([['session', 'date', 'region', 'winner', 'red', 'gold']].concat(state().campaign.log.map(function (e, i) { return [i + 1, e.date, e.region, FACTIONS[e.winner].name, e.a, e.b]; })), 'campaign-log.csv');
    });
    draw();
  }

  /* ---------- shrink your own ---------- */
  function ownDemo() {
    var o = state().own;
    function ta(k, label, ph) { return '<div class="field"><label>' + label + '</label><textarea class="input" rows="4" data-own="' + k + '" placeholder="' + ph + '">' + B.esc(o[k] || '') + '</textarea></div>'; }
    return section('own', 'Your turn', 'Shrink your own',
      'Same three columns, your game. Fill it in and it goes straight into your notes.',
      '<div class="field" style="margin-bottom:10px"><label>Game</label><input class="input" data-own="name" value="' + B.esc(o.name || '') + '" placeholder="What it is called"></div>' +
      '<div class="sim-own">' + ta('kept', 'What we kept', 'The part players will remember') + ta('cut', 'What we cut', 'Everything that made it longer, not better') + ta('cost', 'What it cost us', 'Be honest, this is the useful column') + '</div>' +
      '<div class="field" style="margin-top:10px"><label>The one thing a player will tell a friend about</label><input class="input" data-own="one" value="' + B.esc(o.one || '') + '" placeholder="If you cannot say it in a sentence, keep cutting"></div>' +
      '<div class="btn-row" style="margin-top:12px"><button class="btn paper sm" type="button" data-own-csv>Download (CSV)</button><button class="btn paper sm" type="button" data-own-print>Print</button></div>');
  }
  function wireOwn() {
    el.querySelectorAll('[data-own]').forEach(function (i) { i.addEventListener('input', function () { var o = state().own; o[i.dataset.own] = i.value; save({ own: o }); }); });
    el.querySelector('[data-own-csv]').addEventListener('click', function () {
      var o = state().own; B.downloadCSV([['game', o.name || ''], ['kept', o.kept || ''], ['cut', o.cut || ''], ['cost', o.cost || ''], ['the one thing', o.one || '']], 'shrink-' + (o.name || 'game').replace(/\W+/g, '-') + '.csv');
    });
    el.querySelector('[data-own-print]').addEventListener('click', function () {
      var o = state().own;
      B.printSection(B.el('<section class="panel"><h2>' + B.esc(o.name || 'Our game') + ': shrunk</h2><table class="sheet"><thead><tr><th>What we kept</th><th>What we cut</th><th>What it cost us</th></tr></thead><tbody><tr>' +
        ['kept', 'cut', 'cost'].map(function (k) { return '<td style="vertical-align:top;white-space:pre-wrap">' + B.esc(o[k] || '') + '</td>'; }).join('') + '</tr></tbody></table><p><b>The one thing:</b> ' + B.esc(o.one || '') + '</p></section>'));
    });
  }

  B.register({ id: 'simplify', mount: mount, unmount: unmount });
})();
