/* Soundboard UI — shared DOM helpers (no state). Used by every ui-*.js module. */
(function (root) {
  'use strict';


  function $(sel, el) { return (el || document).querySelector(sel); }
  function make(tag, props, children) {
    var n = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        if (k === 'class') n.className = props[k];
        else if (k === 'text') n.textContent = props[k];
        else if (k === 'html') n.innerHTML = props[k];
        else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), props[k]);
        else if (props[k] != null) n.setAttribute(k, props[k]);
      });
    }
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function hexToRgba(hex, a) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return 'rgba(255,138,30,' + a + ')';
    var n = parseInt(m[1], 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function fmtVal(v, unit) {
    var n = Number(v);
    var s = (n >= 1000 && unit === 'Hz') ? (n / 1000).toFixed(1) + 'k' : (Math.round(n * 100) / 100);
    return s + (unit || '');
  }
  function section(title, children) {
    var s = make('section', { class: 'sb-sec' }, [make('h3', { text: title })]);
    children.forEach(function (c) { if (c) s.appendChild(c); });
    return s;
  }
  function hintBox(text) { return make('p', { class: 'sb-hint', text: text }); }
  function numSafe(v, d) { var n = Number(v); return isFinite(n) ? n : d; }

  root.SoundBoard = root.SoundBoard || {};
  root.SoundBoard.dom = { $: $, make: make, hexToRgba: hexToRgba, fmtVal: fmtVal, section: section, hintBox: hintBox, numSafe: numSafe };
})(typeof self !== 'undefined' ? self : this);
