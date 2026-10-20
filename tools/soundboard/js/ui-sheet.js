/* Soundboard UI — the edit panel's bottom sheet on portrait / narrow screens
 * (e01s04). In landscape the CSS turns the sheet into a side column and hides the
 * grab bar, so none of this has any effect there. */
(function (root) {
  'use strict';

  var $ = root.SoundBoard.dom.$;

  // ---- edit panel sheet (portrait / narrow screens) ---------------------------
  // Three heights: peek (grab bar only), half (default), full. Tap the grab bar to
  // cycle; drag it and it snaps to the nearest height. Remembered per browser.
  var SHEET_KEY = 'soundboard:sheet';
  var SHEETS = ['peek', 'half', 'full'];
  function setSheet(state) {
    var app = $('#sb-app');
    if (!app || SHEETS.indexOf(state) < 0) return;
    app.setAttribute('data-sheet', state);
    try { localStorage.setItem(SHEET_KEY, state); } catch (_) {}
  }
  function init() {
    var saved = null;
    try { saved = localStorage.getItem(SHEET_KEY); } catch (_) {}
    setSheet(SHEETS.indexOf(saved) >= 0 ? saved : 'half');
    var grab = $('#sb-grab'), sheet = $('.sb-sheet'), main = $('.sb-main');
    if (!grab || !sheet || !main) return;
    var drag = null;
    grab.addEventListener('pointerdown', function (e) {
      drag = { id: e.pointerId, y: e.clientY, h: sheet.getBoundingClientRect().height, moved: false };
      try { grab.setPointerCapture(e.pointerId); } catch (_) {} // synthetic/odd pointers
    });
    grab.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dy = e.clientY - drag.y;
      if (Math.abs(dy) > 6) drag.moved = true;
      if (!drag.moved) return;
      var max = main.getBoundingClientRect().height * 0.85;
      sheet.style.flexBasis = Math.max(64, Math.min(max, drag.h - dy)) + 'px';
    });
    function end(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var d = drag; drag = null;
      if (!d.moved) { // a tap cycles peek -> half -> full -> peek
        var cur = SHEETS.indexOf($('#sb-app').getAttribute('data-sheet'));
        setSheet(SHEETS[(cur + 1) % SHEETS.length]);
        return;
      }
      var mh = main.getBoundingClientRect().height;
      var h = sheet.getBoundingClientRect().height;
      var stops = { peek: 64, half: mh * 0.45, full: mh * 0.85 };
      var best = 'half';
      SHEETS.forEach(function (k) { if (Math.abs(stops[k] - h) < Math.abs(stops[best] - h)) best = k; });
      sheet.style.flexBasis = '';
      setSheet(best);
    }
    grab.addEventListener('pointerup', end);
    grab.addEventListener('pointercancel', end);
  }

  root.SoundBoard.sheet = { init: init, set: setSheet };
})(typeof self !== 'undefined' ? self : this);
