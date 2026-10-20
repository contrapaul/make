/* Soundboard UI — per-pad colours and fonts (e01s09). Everything is inline in the edit
 * panel: swatches, an expanding "More colours" (hue + lightness sliders + hex field),
 * text colour, font chips drawn in their own font, size and B / AA toggles. There is
 * deliberately no <input type="color"> and no pop-up (D27): nothing to dismiss.
 *
 * Also defines SoundBoard.applyPadStyle — the hook ui-stage.js calls for every pad.
 */
(function (root) {
  'use strict';

  var S = root.SoundBoard;
  var model = S.model;
  var core = S.core;
  var PS = S.padStyle;
  var make = S.dom.make;

  var FIXED_SATURATION = 90; // "More colours" picks hue + lightness; bright by design
  var SIZE_LABELS = { auto: 'Auto', s: 'S', m: 'M', l: 'L', xl: 'XL' };

  // Calls into sibling modules, resolved at call time so load order is free.
  function persist() { S.ui.persist(); }
  function renderStage() { S.stage.renderStage(); }

  // ---- the hook: put a pad's style on its node -------------------------------
  function applyPadStyle(node, pad) {
    node.style.setProperty('--pad-color', pad.color);
    node.style.setProperty('--pad-fg', PS.textColorFor(pad));
    node.style.setProperty('--pad-font', (PS.FONTS[pad.font] || PS.FONTS.fredoka).family);
    node.setAttribute('data-size', pad.fontSize || 'auto');
    node.setAttribute('data-bold', pad.bold === false ? 'false' : 'true');
    node.setAttribute('data-caps', pad.caps ? 'true' : 'false');
  }

  // Restyle one pad in place (no full re-render while a slider is being dragged).
  function refreshPad(pad) {
    var n = document.querySelector('#sb-stage [data-pad="' + pad.id + '"]');
    if (n) applyPadStyle(n, pad);
  }

  function change(pad, fields) {
    Object.assign(pad, fields);
    refreshPad(pad);
    persist();
  }

  // Mark one element of a group active (aria-pressed for screen readers).
  function setActive(group, el) {
    group.querySelectorAll('[aria-pressed]').forEach(function (b) {
      b.setAttribute('aria-pressed', b === el ? 'true' : 'false');
    });
  }

  // Palette + neutrals, without duplicates (white is in both).
  function swatchColours() {
    return core.PALETTE.concat(PS.EXTRA_SWATCHES).filter(function (c, i, all) { return all.indexOf(c) === i; });
  }

  function swatch(color, size, active, label, onPick) {
    var b = make('button', {
      type: 'button',
      class: 'sb-swatch sb-swatch--' + size,
      style: '--sw:' + color,
      'aria-label': label || color,
      'aria-pressed': active ? 'true' : 'false',
    });
    b.addEventListener('click', function () { onPick(color, b); });
    return b;
  }

  function field(label, body) {
    return make('div', { class: 'sb-field sb-style__field' }, [make('label', { class: 'sb-style__label', text: label }), body]);
  }

  // ---- pad colour: swatches, recent, and inline "More colours" ----------------
  function colourControls(pad) {
    var swatches = swatchColours();
    var grid = make('div', { class: 'sb-swatches', role: 'group', 'aria-label': 'Pad colour' });
    var hex, hue, light; // assigned below; the swatch handler syncs them
    function pick(color, el) {
      change(pad, { color: color });
      setActive(grid, el);
      syncCustom(color);
    }
    swatches.forEach(function (c) { grid.appendChild(swatch(c, 'lg', c === pad.color, null, pick)); });
    PS.recentColors(model.board, swatches, 6).forEach(function (c) {
      grid.appendChild(swatch(c, 'lg', c === pad.color, 'Recent colour ' + c, pick));
    });

    // More colours — a <details>, so it pushes content down instead of overlaying.
    var hsl = PS.hexToHsl(pad.color);
    hue = make('input', { class: 'sb-range sb-range--hue', type: 'range', min: 0, max: 359, step: 1, value: hsl.h, 'aria-label': 'Hue' });
    light = make('input', { class: 'sb-range sb-range--light', type: 'range', min: 20, max: 90, step: 1, value: Math.min(90, Math.max(20, hsl.l)), 'aria-label': 'Lightness' });
    hex = make('input', { class: 'sb-input sb-hex', type: 'text', value: pad.color, maxlength: 7, spellcheck: 'false', 'aria-label': 'Hex colour' });
    function paintLightTrack() {
      light.style.setProperty('--track',
        'linear-gradient(90deg, ' + PS.hslToHex(hue.value, FIXED_SATURATION, 20) + ', ' +
        PS.hslToHex(hue.value, FIXED_SATURATION, 55) + ', ' + PS.hslToHex(hue.value, FIXED_SATURATION, 90) + ')');
    }
    function syncCustom(color) {
      var h = PS.hexToHsl(color);
      hue.value = h.h; light.value = Math.min(90, Math.max(20, h.l)); hex.value = color;
      paintLightTrack();
    }
    function fromSliders() {
      var c = PS.hslToHex(hue.value, FIXED_SATURATION, light.value);
      hex.value = c;
      paintLightTrack();
      change(pad, { color: c });
      setActive(grid, null);
    }
    hue.addEventListener('input', fromSliders);
    light.addEventListener('input', fromSliders);
    function fromHex() {
      var c = PS.normHex(hex.value);
      if (!c) { hex.value = pad.color; return; }
      change(pad, { color: c });
      syncCustom(c);
      setActive(grid, null);
    }
    hex.addEventListener('change', fromHex);
    hex.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); fromHex(); } });
    paintLightTrack();

    var more = make('details', { class: 'sb-more' }, [
      make('summary', { text: 'More colours' }),
      field('Hue', hue),
      field('Lightness', light),
      field('Hex', hex),
    ]);
    return make('div', {}, [field('Pad colour', grid), more]);
  }

  function textColourControls(pad) {
    var grid = make('div', { class: 'sb-swatches', role: 'group', 'aria-label': 'Text colour' });
    var auto = make('button', { type: 'button', class: 'sb-chip-btn', text: 'Auto', 'aria-pressed': pad.textColor === 'auto' ? 'true' : 'false' });
    auto.addEventListener('click', function () { change(pad, { textColor: 'auto' }); setActive(grid, auto); });
    grid.appendChild(auto);
    swatchColours().forEach(function (c) {
      grid.appendChild(swatch(c, 'sm', pad.textColor === c, 'Text ' + c, function (color, el) {
        change(pad, { textColor: color });
        setActive(grid, el);
      }));
    });
    return field('Text colour', grid);
  }

  function fontControls(pad) {
    var group = make('div', { class: 'sb-chips', role: 'group', 'aria-label': 'Font' });
    Object.keys(PS.FONTS).forEach(function (key) {
      var f = PS.FONTS[key];
      var b = make('button', { type: 'button', class: 'sb-chip-btn sb-font-chip', style: 'font-family:' + f.family, text: f.label, 'aria-pressed': pad.font === key ? 'true' : 'false' });
      b.addEventListener('click', function () { change(pad, { font: key }); setActive(group, b); });
      group.appendChild(b);
    });
    return field('Font', group);
  }

  function sizeAndStyleControls(pad) {
    var sizes = make('div', { class: 'sb-segmented', role: 'group', 'aria-label': 'Text size' });
    PS.SIZES.forEach(function (sz) {
      var b = make('button', { type: 'button', class: 'sb-seg', text: SIZE_LABELS[sz], 'aria-pressed': pad.fontSize === sz ? 'true' : 'false' });
      b.addEventListener('click', function () { change(pad, { fontSize: sz }); setActive(sizes, b); });
      sizes.appendChild(b);
    });
    function toggle(key, text, label) {
      var b = make('button', { type: 'button', class: 'sb-chip-btn sb-toggle-' + key, text: text, 'aria-label': label, 'aria-pressed': pad[key] ? 'true' : 'false' });
      b.addEventListener('click', function () {
        change(pad, (function () { var o = {}; o[key] = !pad[key]; return o; })());
        b.setAttribute('aria-pressed', pad[key] ? 'true' : 'false');
      });
      return b;
    }
    return make('div', { class: 'sb-row sb-style__row' }, [
      field('Size', sizes),
      field('Style', make('div', { class: 'sb-chips' }, [toggle('bold', 'B', 'Bold'), toggle('caps', 'AA', 'Capitals')])),
    ]);
  }

  // Copy this pad's text style (not its colour) to every pad, with a 5 s Undo.
  function applyToAll(pad) {
    var before = model.board.pads.map(function (p) {
      var snap = { id: p.id };
      PS.SHARED_KEYS.forEach(function (k) { snap[k] = p[k]; });
      return snap;
    });
    model.board.pads.forEach(function (p) { PS.SHARED_KEYS.forEach(function (k) { p[k] = pad[k]; }); });
    renderStage();
    persist();
    S.ui.lcdAction('Applied to ' + model.board.pads.length + ' pads', 'Undo', function () {
      before.forEach(function (snap) {
        var p = model.getPad(snap.id);
        if (p) PS.SHARED_KEYS.forEach(function (k) { p[k] = snap[k]; });
      });
      S.ui.render();
      S.ui.lcdMsg('Undone');
    });
  }

  function styleControls(pad) {
    var all = make('button', { type: 'button', class: 'sb-btn', text: 'Apply style to all pads' });
    all.addEventListener('click', function () { applyToAll(pad); });
    return make('div', { class: 'sb-block sb-style' }, [
      make('div', { class: 'sb-subhead', text: 'Look' }),
      colourControls(pad),
      textColourControls(pad),
      fontControls(pad),
      sizeAndStyleControls(pad),
      make('div', { class: 'sb-row' }, [all]),
    ]);
  }

  root.SoundBoard.applyPadStyle = applyPadStyle;
  root.SoundBoard.styleControls = styleControls;
})(typeof self !== 'undefined' ? self : this);
