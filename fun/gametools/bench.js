/* Game Bench shell: tool registry, hash routing, shared store, export helpers.
   Tools are plain scripts that call Bench.register({...}); see tools/dice.js. */
(function () {
  'use strict';

  var STORE_KEY = 'gamebench.v1';
  var EMPTY = { rolls: [], dice: {}, odds: {}, deck: {}, manifest: [], setup: {}, session: {}, cards: {}, sheet: {}, checks: {}, rules: {}, simplify: {}, roles: {}, extras: {}, playtests: [], playtestLive: null, prefs: {} };

  /* ---------- store ---------- */
  var data = load();
  var listeners = [];

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      var obj = raw ? JSON.parse(raw) : {};
      return Object.assign({}, EMPTY, obj);
    } catch (e) { return Object.assign({}, EMPTY); }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) { /* private mode etc. */ }
  }
  var store = {
    get: function (key) { return data[key]; },
    set: function (key, value) {
      data[key] = value; save();
      listeners.forEach(function (l) { if (l.key === key) l.fn(value); });
    },
    // Tools subscribe on mount and unsubscribe on unmount via the returned function.
    on: function (key, fn) {
      var l = { key: key, fn: fn }; listeners.push(l);
      return function () { listeners = listeners.filter(function (x) { return x !== l; }); };
    },
    export: function () { downloadJSON(data, 'game-bench.json'); },
    import: function (file) {
      var r = new FileReader();
      r.onload = function () {
        try {
          var obj = JSON.parse(r.result);
          data = Object.assign({}, EMPTY, obj); save();
          Object.keys(data).forEach(function (k) { listeners.forEach(function (l) { if (l.key === k) l.fn(data[k]); }); });
          applyPrefs(); route();
        } catch (e) { alert('That file is not a Game Bench save.'); }
      };
      r.readAsText(file);
    },
    clear: function () {
      data = Object.assign({}, EMPTY); save();
      Object.keys(data).forEach(function (k) { listeners.forEach(function (l) { if (l.key === k) l.fn(data[k]); }); });
      applyPrefs(); route();
    }
  };

  /* ---------- export helpers ---------- */
  function downloadBlob(blob, filename) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function downloadJSON(obj, filename) {
    downloadBlob(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }), filename);
  }
  function downloadCSV(rows, filename) {
    var csv = rows.map(function (r) {
      return r.map(function (c) {
        var s = c == null ? '' : String(c);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv' }), filename);
  }
  function downloadPNG(source, filename) {
    // source is a <canvas> or an <svg>
    if (source.tagName === 'CANVAS') {
      source.toBlob(function (b) { downloadBlob(b, filename); });
      return;
    }
    var xml = new XMLSerializer().serializeToString(source);
    var img = new Image();
    var w = source.viewBox.baseVal.width || source.clientWidth, h = source.viewBox.baseVal.height || source.clientHeight;
    img.onload = function () {
      var c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2;
      var ctx = c.getContext('2d'); ctx.scale(2, 2); ctx.drawImage(img, 0, 0);
      c.toBlob(function (b) { downloadBlob(b, filename); });
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
  }
  function printSection(el) {
    var frame = document.createElement('iframe');
    frame.style.position = 'fixed'; frame.style.right = '0'; frame.style.bottom = '0';
    frame.style.width = '0'; frame.style.height = '0'; frame.style.border = '0';
    document.body.appendChild(frame);
    var d = frame.contentDocument;
    d.open();
    var css = new URL('bench.css', location.href).href;
    d.write('<!DOCTYPE html><html><head><link rel="stylesheet" href="' + css + '"></head><body class="print-only">' + el.outerHTML + '</body></html>');
    d.close();
    var go = function () { frame.contentWindow.focus(); frame.contentWindow.print(); setTimeout(function () { frame.remove(); }, 2000); };
    var link = d.querySelector('link'); link.onload = go; link.onerror = go;
  }

  /* ---------- registry and routing ---------- */
  var tools = [];   // registered, in order
  var current = null;
  var nav = document.getElementById('bench-nav');
  var main = document.getElementById('bench-main');

  // Every tool the bench will have, in nav order. Ones without a registered
  // module show as "soon" so the grid tells the whole story from day one.
  var ROSTER = [
    { id: 'dice',     title: 'Dice',     blurb: 'Roll anything. Custom faces too.' },
    { id: 'odds',     title: 'Odds',     blurb: 'Label the faces, roll it a thousand times.' },
    { id: 'deck',     title: 'Deck',     blurb: "What's in your opening hand?" },
    { id: 'session',  title: 'Session',  blurb: 'Does it fit in a recess?' },
    { id: 'setup',    title: 'Setup',    blurb: 'How long to lay it all out.' },
    { id: 'playtest', title: 'Playtest', blurb: 'Stopwatch and tallies, at the table.' },
    { id: 'cards',    title: 'Cards',    blurb: 'Layouts borrowed from games you know.' },
    { id: 'sheet',    title: 'Sheet',    blurb: 'Cards and tokens, N-up with crop marks.' },
    { id: 'checks',   title: 'Checks',   blurb: 'Type size, colour-blind safe, grid paper.' },
    { id: 'rules',    title: 'Rules',    blurb: 'Pages, reading time, exceptions, cold read.' },
    { id: 'simplify', title: 'Simplify', blurb: 'Big games made recess-sized.' },
    { id: 'roles',    title: 'Roles',    blurb: 'Four roles, two tracks each, one owner per part.' },
    { id: 'box',      title: 'Box',      blurb: 'From sizes to a box, with a net to print.' },
    { id: 'extras',   title: 'Extras',   blurb: 'Spinner, random tables, score pad, turn timer, race, balance.' }
  ];
  var ICONS = {
    dice:     '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none"/><circle cx="16" cy="8" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="8" cy="16" r="1.3" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1.3" fill="currentColor" stroke="none"/>',
    odds:     '<path d="M3 20h18"/><rect x="5" y="12" width="3" height="8" rx="1"/><rect x="10.5" y="6" width="3" height="14" rx="1"/><rect x="16" y="10" width="3" height="10" rx="1"/>',
    deck:     '<rect x="7" y="3" width="12" height="16" rx="2"/><path d="M4 7v12a2 2 0 0 0 2 2h10"/>',
    session:  '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    setup:    '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M17.5 14v7M14 17.5h7"/>',
    playtest: '<circle cx="12" cy="13" r="8"/><path d="M12 5V2M9 2h6M9 13l2 2 4-4"/>',
    cards:    '<rect x="4" y="3" width="16" height="18" rx="2"/><rect x="7" y="6" width="10" height="12" rx="1" stroke-dasharray="2 2"/>',
    sheet:    '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7"/>',
    checks:   '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    rules:    '<path d="M4 4h11l5 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M15 4v5h5M8 13h8M8 17h6"/>',
    roles:    '<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14a5 5 0 0 1 6.5 5"/>',
    box:      '<path d="M3 8l9-5 9 5v9l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v9"/>',
    extras:   '<circle cx="12" cy="12" r="9"/><path d="M12 3v9l6 3"/><path d="M5 5l3 3M19 5l-3 3" stroke-linecap="round"/>',
    simplify: '<circle cx="7" cy="6" r="3"/><circle cx="7" cy="18" r="3"/><path d="M9.5 7.5 21 16M9.5 16.5 21 8"/>'
  };
  function icon(id) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[id] || '') + '</svg>';
  }

  function register(tool) {
    tools.push(tool);
    var r = ROSTER.find(function (x) { return x.id === tool.id; });
    if (r) { tool.title = tool.title || r.title; tool.blurb = tool.blurb || r.blurb; }
    else ROSTER.push({ id: tool.id, title: tool.title, blurb: tool.blurb });
  }
  function find(id) { return tools.find(function (t) { return t.id === id; }); }

  function renderNav(activeId) {
    nav.classList.toggle('is-tool', !!activeId);
    nav.innerHTML = ROSTER.map(function (r) {
      var built = !!find(r.id);
      var cls = 'tile' + (r.id === activeId ? ' active' : '') + (built ? '' : ' soon');
      var tag = built ? 'a' : 'span';
      return '<' + tag + ' class="' + cls + '"' + (built ? ' href="#' + r.id + '"' : ' aria-disabled="true" title="Not built yet"') +
        (r.id === activeId ? ' aria-current="page"' : '') + '>' +
        '<span class="t">' + icon(r.id) + esc(r.title) + '</span>' +
        '<small>' + esc(r.blurb) + (built ? '' : ' <em>Soon.</em>') + '</small></' + tag + '>';
    }).join('');
  }

  function route() {
    var id = location.hash.replace(/^#/, '');
    var tool = find(id);
    if (current && current.unmount) { try { current.unmount(); } catch (e) { console.error(e); } }
    current = null;
    main.innerHTML = '';
    if (!tool) {
      if (id) history.replaceState(null, '', location.pathname + location.search);
      renderNav(null);
      main.innerHTML = '';
      // Home: nav grid is the content. A short intro sits above it.
      var intro = document.createElement('div'); intro.className = 'home-intro';
      intro.innerHTML = '<p class="lede">Roll it, count it, lay it out, time it.</p><p>A bench for people making tabletop games. Pick a tool.</p>';
      nav.before(intro);
      document.title = 'Game Bench';
      window.scrollTo(0, 0);
      return;
    }
    var old = document.querySelector('.home-intro'); if (old) old.remove();
    renderNav(id);
    document.title = tool.title + ' — Game Bench';
    current = tool;
    // A fresh container per mount, so listeners a tool hangs on its root die with it.
    var box = document.createElement('div'); box.className = 'tool-root';
    main.appendChild(box);
    tool.mount(box, store);
    window.scrollTo(0, 0);
  }

  /* ---------- prefs ---------- */
  function applyPrefs() {
    var p = data.prefs || {};
    if (p.theme) document.documentElement.dataset.theme = p.theme; else delete document.documentElement.dataset.theme;
    if (p.motion) document.documentElement.dataset.motion = p.motion; else delete document.documentElement.dataset.motion;
    var b = document.getElementById('btn-theme');
    if (b) b.textContent = document.documentElement.dataset.theme === 'dark' ? 'Light' : 'Dark';
  }
  function toggleTheme() {
    var p = Object.assign({}, data.prefs);
    var isDark = document.documentElement.dataset.theme === 'dark';
    p.theme = isDark ? 'light' : 'dark';
    store.set('prefs', p); applyPrefs();
  }
  function reducedMotion() {
    var p = data.prefs || {};
    if (p.motion === 'reduce') return true;
    if (p.motion === 'full') return false;
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ---------- utils ---------- */
  // 0.9964 -> "99.6%", 0.0004 -> "<0.1%", 0.25 -> "25%"
  function pct(p) {
    if (!(p > 0)) return '0%';
    if (p >= 1) return '100%';
    var v = p * 100;
    if (v < 0.1) return '<0.1%';
    if (v > 99.9) return '>99.9%';
    return v.toFixed(v < 10 || v > 90 ? 1 : 0) + '%';
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
  function rand(n) {
    // crypto when available so students can't accuse the bench of loaded dice
    if (window.crypto && crypto.getRandomValues) {
      var a = new Uint32Array(1); var max = Math.floor(0x100000000 / n) * n;
      do { crypto.getRandomValues(a); } while (a[0] >= max);
      return (a[0] % n) + 1;
    }
    return Math.floor(Math.random() * n) + 1;
  }

  /* ---------- boot ---------- */
  function start() {
    applyPrefs();
    document.getElementById('btn-theme').addEventListener('click', toggleTheme);
    document.getElementById('btn-export').addEventListener('click', function () { store.export(); closeMenu(); });
    var fileInput = document.getElementById('import-file');
    document.getElementById('btn-import').addEventListener('click', function () { fileInput.click(); closeMenu(); });
    fileInput.addEventListener('change', function () { if (fileInput.files[0]) store.import(fileInput.files[0]); fileInput.value = ''; });
    document.getElementById('btn-clear').addEventListener('click', function () {
      closeMenu();
      if (confirm('Clear everything on the bench? Rolls, components, playtests, all of it. Download first if you want to keep it.')) store.clear();
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.menu')) closeMenu(); });
    window.addEventListener('hashchange', route);
    route();
  }
  function closeMenu() { var m = document.querySelector('.menu'); if (m) m.open = false; }

  window.Bench = {
    register: register, start: start, store: store,
    downloadCSV: downloadCSV, downloadJSON: downloadJSON, downloadPNG: downloadPNG, printSection: printSection,
    esc: esc, el: el, pct: pct, rand: rand, reducedMotion: reducedMotion, icon: icon
  };
})();
