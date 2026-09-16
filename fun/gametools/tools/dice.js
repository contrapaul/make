/* Dice — seed build. One d6 that really rolls, writes to the shared store.
   Phase 1 grows this into pools, custom faces and the rest. */
(function () {
  'use strict';
  var B = window.Bench;

  // Rotation that brings each face to the front. Faces are laid out in bench.css.
  var FACE_ROT = { 1: [0, 0], 2: [0, -90], 3: [0, 180], 4: [0, 90], 5: [-90, 0], 6: [90, 0] };
  var PIPS = {
    1: ['2/2'], 2: ['1/1', '3/3'], 3: ['1/1', '2/2', '3/3'],
    4: ['1/1', '1/3', '3/1', '3/3'], 5: ['1/1', '1/3', '2/2', '3/1', '3/3'],
    6: ['1/1', '1/3', '2/1', '2/3', '3/1', '3/3']
  };
  function faceHTML(n) {
    return '<div class="face f' + n + '">' + PIPS[n].map(function (a) { return '<i style="grid-area:' + a + '"></i>'; }).join('') + '</div>';
  }

  var root, cube, result, log, unsub, spins = 0, timer = null;

  function render(el, store) {
    el.innerHTML =
      '<section class="panel">' +
        '<p class="kicker">Dice</p>' +
        '<h2>Roll a d6</h2>' +
        '<p>Click the die or press Space. Every roll is kept, so Odds can use them later.</p>' +
        '<div class="dice-stage">' +
          '<div class="scene" role="button" tabindex="0" aria-label="Roll the die"><div class="cube">' +
            [1, 2, 3, 4, 5, 6].map(faceHTML).join('') +
          '</div></div>' +
          '<div class="dice-result num" aria-live="polite">–</div>' +
          '<button class="btn big" type="button" data-roll>Roll</button>' +
        '</div>' +
        '<div class="label">Last rolls</div>' +
        '<ul class="dice-log" aria-label="Roll history"></ul>' +
        '<div class="btn-row" style="margin-top:14px">' +
          '<button class="btn paper sm" type="button" data-csv>Download rolls (CSV)</button>' +
          '<button class="btn paper sm" type="button" data-clear>Forget these rolls</button>' +
        '</div>' +
      '</section>';
    root = el;
    cube = el.querySelector('.cube');
    result = el.querySelector('.dice-result');
    log = el.querySelector('.dice-log');
    showFace(1, false);
    renderLog(store.get('rolls'));

    var scene = el.querySelector('.scene');
    scene.addEventListener('click', function () { roll(store); });
    scene.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); roll(store); } });
    el.querySelector('[data-roll]').addEventListener('click', function () { roll(store); });
    el.querySelector('[data-csv]').addEventListener('click', function () {
      var rows = [['time', 'spec', 'faces', 'total']].concat(store.get('rolls').map(function (r) {
        return [new Date(r.t).toISOString(), r.spec, r.faces.join(' '), r.total];
      }));
      B.downloadCSV(rows, 'dice-rolls.csv');
    });
    el.querySelector('[data-clear]').addEventListener('click', function () {
      if (confirm('Forget all saved rolls?')) store.set('rolls', []);
    });
    unsub = store.on('rolls', renderLog);
    document.addEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (e.key === ' ' && !e.target.closest('input, textarea, button, [role=button]')) { e.preventDefault(); roll(B.store); }
  }

  function showFace(n, tumble) {
    var r = FACE_ROT[n];
    if (tumble) spins += 1;
    var k = spins * 360;
    cube.style.transform = 'rotateX(-10deg) rotateY(12deg) rotateX(' + (r[0] + k) + 'deg) rotateY(' + (r[1] + k) + 'deg)';
  }

  var pending = null;
  function roll(store) {
    if (timer) { clearTimeout(timer); land(store); return; }   // second click skips the tumble
    var n = B.rand(6);
    pending = { t: Date.now(), spec: '1d6', faces: [n], total: n };
    result.textContent = '?'; result.classList.remove('hot');
    showFace(n, !B.reducedMotion());
    timer = setTimeout(function () { land(store); }, B.reducedMotion() ? 0 : 800);
  }
  function land(store) {
    timer = null;
    if (!pending) return;
    result.textContent = pending.total; result.classList.add('hot');
    store.set('rolls', store.get('rolls').concat([pending]));
    pending = null;
  }

  function renderLog(rolls) {
    if (!log) return;
    var last = rolls.slice(-20).reverse();
    log.innerHTML = last.length
      ? last.map(function (r) { return '<li title="' + new Date(r.t).toLocaleString() + '">' + r.total + '</li>'; }).join('')
      : '<li class="muted" style="background:none;font-weight:400">Nothing yet.</li>';
  }

  B.register({
    id: 'dice',
    mount: render,
    unmount: function () {
      if (unsub) unsub(); unsub = null;
      if (timer) { clearTimeout(timer); timer = null; }
      document.removeEventListener('keydown', onKey);
      root = cube = result = log = null;
    }
  });
})();
