/* Cards: pre-baked layouts from games people know, a shuffle that remixes
   them, and a lock per card type. Renders as SVG in mm so the same drawing
   prints, exports and previews. Exposes Bench.cards for the print sheet. */
(function () {
  'use strict';
  var B = window.Bench, DATA = window.CARD_DATA;
  var SIZES = DATA.SIZES, ZONES = DATA.ZONES, LAYOUTS = DATA.LAYOUTS, BLEED = DATA.BLEED, SAFE = DATA.SAFE;
  var SWATCH = ['--berry', '--brass', '--felt', '--slate', '--plum', '--rust'];
  var PT = 0.3528;   // mm per point
  var PX_PER_MM = 96 / 25.4;

  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function sizeOf(st) { return st.size === 'custom' ? { w: st.custom.w, h: st.custom.h } : SIZES[st.size]; }

  /* ---------- state ---------- */
  var el, store = B.store, ui = {}, unsubs = [];   // store is the shell's, so B.cards works before mount
  var DEFAULT = { size: 'poker', custom: { w: 63, h: 88 }, layout: clone(LAYOUTS[0]), types: [], trueSize: false };
  function state() { var s = store.get('cards') || {}; return Object.assign({}, DEFAULT, s, { types: s.types || [] }); }
  function save(patch) { store.set('cards', Object.assign(state(), patch)); }

  /* ---------- rendering ----------
     render(layout, size, opts) -> SVG string. opts: { colour, dims, scale (px per mm),
     name, back }. Coordinates are mm; origin is the bleed corner. */
  function render(layout, size, opts) {
    opts = opts || {};
    var w = size.w, h = size.h, bl = BLEED, sf = SAFE;
    var margin = opts.dims ? 14 : 0;
    var W = w + 2 * bl + margin, H = h + 2 * bl + margin + (opts.dims ? 6 : 0);
    var ox = margin, oy = margin;                      // bleed box origin
    var tx = ox + bl, ty = oy + bl;                    // trim origin
    var sx = tx + sf, sy = ty + sf, sw = w - 2 * sf, sh = h - 2 * sf;   // safe box
    var ink = cssVar('--ink'), faint = cssVar('--ink-faint'), line = cssVar('--line'), paper2 = cssVar('--paper-2'), berry = cssVar('--berry'), bone = cssVar('--bone'), felt = cssVar('--felt'), feltDeep = cssVar('--felt-deep');
    var colour = opts.colour ? cssVar(opts.colour) || opts.colour : cssVar('--brass');
    var mono = 'JetBrains Mono, monospace', body = 'Lexend, sans-serif';
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '"' + (opts.scale ? ' width="' + (W * opts.scale) + '" height="' + (H * opts.scale) + '"' : '') + ' font-family="' + body + '">';
    s += '<defs><linearGradient id="art" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + felt + '"/><stop offset="1" stop-color="' + feltDeep + '"/></linearGradient></defs>';

    if (opts.back) {
      s += '<rect x="' + ox + '" y="' + oy + '" width="' + (w + 2 * bl) + '" height="' + (h + 2 * bl) + '" fill="' + colour + '"/>';
      s += '<rect x="' + (tx + 4) + '" y="' + (ty + 4) + '" width="' + (w - 8) + '" height="' + (h - 8) + '" rx="2" fill="none" stroke="' + bone + '" stroke-width="0.6" opacity=".7"/>';
      s += '<text x="' + (tx + w / 2) + '" y="' + (ty + h / 2 + 2) + '" text-anchor="middle" font-size="' + (Math.min(w / 8, 7)) + '" font-weight="800" fill="' + bone + '">' + B.esc(opts.name || '') + '</text>';
      return s + '</svg>';
    }

    // bleed (tinted), trim (bone, rounded), band
    s += '<rect x="' + ox + '" y="' + oy + '" width="' + (w + 2 * bl) + '" height="' + (h + 2 * bl) + '" fill="' + bone + '"/>';
    s += '<rect x="' + ox + '" y="' + oy + '" width="' + (w + 2 * bl) + '" height="' + (h + 2 * bl) + '" fill="' + colour + '" opacity=".18"/>';
    s += '<rect x="' + tx + '" y="' + ty + '" width="' + w + '" height="' + h + '" rx="3" fill="' + bone + '"/>';
    var bandW = 4;
    if (layout.band === 'top') s += '<path d="M' + tx + ' ' + (ty + 3) + ' a3 3 0 0 1 3 -3 h' + (w - 6) + ' a3 3 0 0 1 3 3 v' + (bandW - 3) + ' h-' + w + ' z" fill="' + colour + '"/>';
    if (layout.band === 'bottom') s += '<path d="M' + tx + ' ' + (ty + h - bandW) + ' h' + w + ' v' + (bandW - 3) + ' a3 3 0 0 1 -3 3 h-' + (w - 6) + ' a3 3 0 0 1 -3 -3 z" fill="' + colour + '"/>';
    if (layout.band === 'left') s += '<path d="M' + (tx + 3) + ' ' + ty + ' a3 3 0 0 0 -3 3 v' + (h - 6) + ' a3 3 0 0 0 3 3 h' + (bandW - 3) + ' v-' + h + ' z" fill="' + colour + '"/>';
    // inner area shrinks away from the band
    var ix = sx + (layout.band === 'left' ? bandW : 0), iy = sy + (layout.band === 'top' ? bandW - 1 : 0);
    var iw = sw - (layout.band === 'left' ? bandW : 0), ih = sh - (layout.band === 'top' ? bandW - 1 : 0) - (layout.band === 'bottom' ? bandW - 1 : 0);

    // rows and zones
    var gap = 1.2, totalH = layout.rows.reduce(function (a, r) { return a + r.h; }, 0);
    var avail = ih - gap * (layout.rows.length - 1), y = iy;
    layout.rows.forEach(function (row) {
      var rh = avail * row.h / totalH;
      var flex = row.cells.reduce(function (a, c) { return a + (c.w ? 0 : 1); }, 0);
      var fixed = row.cells.reduce(function (a, c) { return a + (c.w || 0); }, 0);
      var each = flex ? (iw - fixed - gap * (row.cells.length - 1)) / flex : 0;
      var x = ix;
      row.cells.forEach(function (c) {
        var cw = c.w ? Math.min(c.w, iw) : each;
        s += zone(c.z, x, y, cw, rh, { ink: ink, faint: faint, line: line, paper2: paper2, colour: colour, mono: mono, body: body, label: opts.labels !== false });
        x += cw + gap;
      });
      y += rh + gap;
    });

    // safe area outline last so it sits on top
    if (opts.guides !== false) s += '<rect x="' + sx + '" y="' + sy + '" width="' + sw + '" height="' + sh + '" rx="1.5" fill="none" stroke="' + berry + '" stroke-width="0.35" stroke-dasharray="1.2 0.8" opacity=".8"/>';
    // trim line
    s += '<rect x="' + tx + '" y="' + ty + '" width="' + w + '" height="' + h + '" rx="3" fill="none" stroke="' + ink + '" stroke-width="0.3"/>';

    if (opts.dims) {
      var dimC = ink, f = 2.6;
      // width across the top: trim
      s += dim(tx, oy - 4, tx + w, oy - 4, w + ' mm trim', dimC, f, mono, 'h');
      // height down the left: trim
      s += dim(ox - 4, ty, ox - 4, ty + h, h + ' mm', dimC, f, mono, 'v');
      // bleed and safe callouts, bottom right
      s += '<text x="' + (ox + w + 2 * bl) + '" y="' + (H - 1.5) + '" text-anchor="end" font-family="' + mono + '" font-size="' + f + '" fill="' + faint + '">bleed ' + bl + ' mm · safe ' + sf + ' mm · ' + (w + 2 * bl) + '×' + (h + 2 * bl) + ' with bleed</text>';
      s += '<text x="' + (ox - 4) + '" y="' + (oy - 5.5) + '" text-anchor="end" font-family="' + mono + '" font-size="' + f + '" fill="' + berry + '">safe</text>';
      s += '<line x1="' + (ox - 3) + '" y1="' + (oy - 6.4) + '" x2="' + (ox + 2) + '" y2="' + (oy - 6.4) + '" stroke="' + berry + '" stroke-width="0.35" stroke-dasharray="1.2 0.8"/>';
    }
    return s + '</svg>';
  }
  function dim(x1, y1, x2, y2, label, c, f, mono, dir) {
    var t = 1.2, s = '<g stroke="' + c + '" stroke-width="0.25">';
    s += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>';
    if (dir === 'h') s += '<line x1="' + x1 + '" y1="' + (y1 - t) + '" x2="' + x1 + '" y2="' + (y1 + t) + '"/><line x1="' + x2 + '" y1="' + (y2 - t) + '" x2="' + x2 + '" y2="' + (y2 + t) + '"/>';
    else s += '<line x1="' + (x1 - t) + '" y1="' + y1 + '" x2="' + (x1 + t) + '" y2="' + y1 + '"/><line x1="' + (x2 - t) + '" y1="' + y2 + '" x2="' + (x2 + t) + '" y2="' + y2 + '"/>';
    s += '</g>';
    if (dir === 'h') s += '<text x="' + ((x1 + x2) / 2) + '" y="' + (y1 - 1.2) + '" text-anchor="middle" font-family="' + mono + '" font-size="' + f + '" fill="' + c + '">' + label + '</text>';
    else s += '<text transform="translate(' + (x1 - 1.4) + ' ' + ((y1 + y2) / 2) + ') rotate(-90)" text-anchor="middle" font-family="' + mono + '" font-size="' + f + '" fill="' + c + '">' + label + '</text>';
    return s;
  }
  function zone(z, x, y, w, h, o) {
    var Z = ZONES[z], pt = Z.pt * PT, k = Z.kind, s = '<g class="zone" data-z="' + z + '">';
    var fill = o.paper2, r = 1;
    if (k === 'art') s += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + r + '" fill="url(#art)"/>';
    else s += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + r + '" fill="' + fill + '" stroke="' + o.line + '" stroke-width="0.2"/>';
    var cx = x + w / 2, cy = y + h / 2;
    var tiny = Math.min(2.2, h * 0.45, w / 6);
    function lab(text, col, size, yy) { return '<text x="' + (x + 1) + '" y="' + (yy || (y + size + 0.6)) + '" font-size="' + size + '" fill="' + (col || o.faint) + '" font-family="' + o.mono + '">' + text + '</text>'; }
    switch (k) {
      case 'text':
        s += '<text x="' + (x + 1.5) + '" y="' + (cy + pt * 0.35) + '" font-size="' + pt + '" font-weight="800" fill="' + o.ink + '">' + B.esc(Z.name) + '</text>'; break;
      case 'num':
        var rad = Math.min(h, w) / 2 - 0.5;
        s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rad + '" fill="' + o.colour + '"/>';
        s += '<text x="' + cx + '" y="' + (cy + Math.min(pt, rad) * 0.35) + '" text-anchor="middle" font-size="' + Math.min(pt, rad * 1.1) + '" font-weight="700" font-family="' + o.mono + '" fill="#fff">7</text>'; break;
      case 'huge':
        s += '<text x="' + cx + '" y="' + (cy + pt * 0.35) + '" text-anchor="middle" font-size="' + Math.min(pt, h * 0.8) + '" font-weight="800" font-family="' + o.mono + '" fill="' + o.ink + '">7</text>'; break;
      case 'big':
        s += '<text x="' + cx + '" y="' + (cy + pt * 0.35) + '" text-anchor="middle" font-size="' + Math.min(pt, h * 0.7, w / 4) + '" font-weight="900" fill="' + o.ink + '">SKIP</text>'; break;
      case 'banner':
        var rr = Math.min(w, h) * 0.32;
        s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rr + '" fill="' + o.colour + '"/><path d="M' + (cx - rr * 0.45) + ' ' + cy + ' l' + (rr * 0.3) + ' ' + (rr * 0.3) + ' l' + (rr * 0.6) + ' -' + (rr * 0.6) + '" stroke="#fff" stroke-width="' + (rr * 0.18) + '" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'; break;
      case 'small': case 'tiny':
        s += '<text x="' + (x + 1.2) + '" y="' + (cy + pt * 0.35) + '" font-size="' + pt + '" fill="' + o.ink + '" font-style="' + (k === 'small' && z === 'flavour' ? 'italic' : 'normal') + '">' + B.esc(z === 'number' ? '12 / 54' : z === 'flavour' ? '“It was never about the gold.”' : 'Spell · Fire') + '</text>'; break;
      case 'body':
        var lines = Math.max(1, Math.floor((h - 2) / (pt * 1.35)));
        for (var i = 0; i < Math.min(lines, 6); i++) {
          var lw = (i === Math.min(lines, 6) - 1 ? 0.55 : 0.9) * (w - 3);
          s += '<rect x="' + (x + 1.5) + '" y="' + (y + 1.4 + i * pt * 1.35) + '" width="' + lw + '" height="' + (pt * 0.7) + '" rx="0.3" fill="' + o.line + '"/>';
        }
        s += '<text x="' + (x + 1.5) + '" y="' + (y + 1.2 + pt * 0.85) + '" font-size="' + pt + '" fill="' + o.ink + '">' + B.esc(z === 'power' ? 'Once a night, look at one card.' : 'Deal 2 damage to every enemy.') + '</text>'; break;
      case 'list':
        var n = Math.max(1, Math.min(6, Math.floor((h - 2) / (pt * 1.5))));
        for (var j = 0; j < n; j++) s += '<text x="' + (x + 1.5) + '" y="' + (y + 1.2 + pt * 0.85 + j * pt * 1.5) + '" font-size="' + pt + '" fill="' + o.ink + '" font-family="' + o.mono + '">' + (j + 1) + '. ' + ['Draw a card', 'Take one action', 'Resolve effects', 'Discard to five', 'Pass the die', 'Check for a win'][j] + '</text>'; break;
      case 'icons':
        var ic = Math.min(6, Math.floor((w - 2) / 7.5)), d = Math.min(6, h - 2);
        for (var q = 0; q < ic; q++) s += '<circle cx="' + (x + 1 + d / 2 + q * (d + 1.5)) + '" cy="' + cy + '" r="' + (d / 2) + '" fill="' + (q % 2 ? o.colour : o.ink) + '" opacity=".85"/>'; break;
      case 'choice':
        var hw = (w - 1.5) / 2;
        ['A', 'B'].forEach(function (L, idx) {
          var xx = x + idx * (hw + 1.5);
          s += '<rect x="' + xx + '" y="' + y + '" width="' + hw + '" height="' + h + '" rx="1" fill="none" stroke="' + o.ink + '" stroke-width="0.3"/>';
          s += '<text x="' + (xx + 1.5) + '" y="' + (y + 1 + pt * 1.2) + '" font-size="' + (pt * 1.3) + '" font-weight="800" fill="' + o.colour + '">' + L + '</text>';
          s += '<text x="' + (xx + 1.5) + '" y="' + (y + 1 + pt * 2.8) + '" font-size="' + pt + '" fill="' + o.ink + '">' + (idx ? 'Run.' : 'Fight.') + '</text>';
        }); break;
    }
    // label only where it won't sit on the sample text
    var noText = k === 'art' || k === 'banner' || k === 'icons', roomy = h > pt * 1.6 + tiny + 2.5;
    if (o.label && (noText || roomy)) s += lab(noText ? B.esc(Z.name) : B.esc(Z.name) + ' ' + Z.pt + 'pt', o.faint, tiny, y + h - 0.8);
    return s + '</g>';
  }

  /* ---------- shuffle ---------- */
  function shuffle(current) {
    var pool = LAYOUTS.filter(function (l) { return l.id !== current.base; });
    var base = clone(pool[B.rand(pool.length) - 1]);
    var L = { base: base.id, name: base.name + ' remix', from: base.from, band: base.band, why: '', rows: base.rows };
    var moves = [];
    var n = 1 + B.rand(2);
    for (var i = 0; i < n; i++) {
      var m = B.rand(5);
      if (m === 1) { // flip a multi-cell row
        var multi = L.rows.filter(function (r) { return r.cells.length > 1; });
        if (multi.length) { var r = multi[B.rand(multi.length) - 1]; r.cells.reverse(); moves.push('flipped the ' + ZONES[r.cells[0].z].name.toLowerCase() + ' row'); }
      } else if (m === 2) { // swap two adjacent rows
        var k = B.rand(L.rows.length - 1) - 1; var t = L.rows[k]; L.rows[k] = L.rows[k + 1]; L.rows[k + 1] = t;
        moves.push('moved the ' + ZONES[t.cells[0].z].name.toLowerCase() + ' down');
      } else if (m === 3) { // resize the art
        var art = L.rows.find(function (r) { return r.cells.some(function (c) { return c.z === 'art' || c.z === 'portrait' || c.z === 'banner'; }); });
        if (art) { var f = [0.6, 0.8, 1.25, 1.5][B.rand(4) - 1]; art.h = Math.round(art.h * f); moves.push(f > 1 ? 'bigger art' : 'smaller art'); }
      } else if (m === 4) { // band
        var bands = ['none', 'top', 'left', 'bottom'].filter(function (b) { return b !== L.band; });
        L.band = bands[B.rand(bands.length) - 1]; moves.push('band ' + L.band);
      } else { // move a small row to the other end
        var smalls = L.rows.map(function (r, idx) { return { r: r, idx: idx }; }).filter(function (o) { return o.r.h <= 12; });
        if (smalls.length) { var o = smalls[B.rand(smalls.length) - 1]; L.rows.splice(o.idx, 1); if (o.idx > L.rows.length / 2) L.rows.unshift(o.r); else L.rows.push(o.r); moves.push('moved ' + ZONES[o.r.cells[0].z].name.toLowerCase() + ' to the other end'); }
      }
    }
    L.why = 'Started from ' + base.name + ' (' + base.from + '), then ' + (moves.length ? moves.join(', ') : 'left it alone') + '. Still a valid card. Which do you prefer, and why?';
    return L;
  }

  /* ---------- mount ---------- */
  function mount(root) {
    el = root;
    var st = state();
    el.innerHTML =
      '<div class="tool-grid cards-grid">' +
        '<section class="panel">' +
          '<p class="kicker">Cards</p>' +
          '<h2>Borrow a layout</h2>' +
          '<p>Start from a game you know. Every layout here is a real answer that shipped. Shuffle mixes them up so you get past your first idea.</p>' +
          '<div class="label">Size</div>' +
          '<div class="cards-sizes">' + Object.keys(SIZES).map(function (k) { return '<button type="button" class="quick-die" data-size="' + k + '" title="' + B.esc(SIZES[k].note) + '">' + SIZES[k].name + ' <small>' + SIZES[k].w + '×' + SIZES[k].h + '</small></button>'; }).join('') +
            '<button type="button" class="quick-die" data-size="custom">Custom</button></div>' +
          '<div class="cards-custom" hidden><label>W <input class="input mono" type="number" min="30" max="150" data-c="w" aria-label="Width mm"></label><label>H <input class="input mono" type="number" min="30" max="200" data-c="h" aria-label="Height mm"></label><span class="muted">mm</span></div>' +
          '<div class="label" style="margin-top:12px">Layouts</div>' +
          '<div class="cards-layouts">' + LAYOUTS.map(function (l) { return '<button type="button" class="cards-pick" data-layout="' + l.id + '"><b>' + l.name + '</b><small>' + l.from + '</small></button>'; }).join('') + '</div>' +
          '<div class="btn-row" style="margin-top:12px"><button class="btn brass" type="button" data-shuffle>Shuffle</button>' +
            '<div class="seg" role="group" aria-label="Colour band">' + ['none', 'top', 'left', 'bottom'].map(function (b) { return '<button type="button" data-band="' + b + '">' + b + '</button>'; }).join('') + '</div></div>' +
          '<p class="cards-why"></p>' +
        '</section>' +
        '<section class="panel cards-preview-panel">' +
          '<div class="cards-preview-head"><p class="kicker">Preview</p><label class="cards-true"><input type="checkbox" data-true> True size</label></div>' +
          '<div class="cards-preview"></div>' +
          '<p class="cards-hint muted">Hover or tap a zone to see what goes there.</p>' +
          '<div class="cards-tip"><b></b><span></span></div>' +
          '<p class="muted" style="font-size:12.5px">True size assumes a 96 dpi screen. Hold a real card against it to check.</p>' +
        '</section>' +
      '</div>' +
      '<section class="panel">' +
        '<p class="kicker">Your cards</p>' +
        '<h2>Lock a layout to each kind of card</h2>' +
        '<p>Attack, Item, Event: each kind gets one layout and one colour, and they all share the size. That is what makes a deck look like one deck.</p>' +
        '<form class="cards-lock"><input class="input" placeholder="Kind of card, e.g. Attack" maxlength="20" aria-label="Kind of card" required>' +
          '<div class="cards-colours" role="group" aria-label="Colour">' + SWATCH.map(function (v, i) { return '<button type="button" class="cards-colour' + (i === 0 ? ' on' : '') + '" data-colour="' + v + '" style="--sw:var(' + v + ')" aria-label="' + v.slice(2) + '"></button>'; }).join('') + '</div>' +
          '<button class="btn" type="submit">Lock this layout</button></form>' +
        '<div class="cards-types"></div>' +
        '<div class="btn-row" style="margin-top:14px">' +
          '<button class="btn paper sm" type="button" data-png>Download template (PNG)</button>' +
          '<button class="btn paper sm" type="button" data-json>Download layouts (JSON)</button>' +
          '<a class="btn paper sm" href="#sheet">Print a sheet →</a>' +
        '</div>' +
      '</section>';

    ui.preview = el.querySelector('.cards-preview');
    ui.why = el.querySelector('.cards-why');
    ui.tip = el.querySelector('.cards-tip');
    ui.types = el.querySelector('.cards-types');
    ui.custom = el.querySelector('.cards-custom');
    ui.trueBox = el.querySelector('[data-true]');
    ui.trueBox.checked = !!st.trueSize;

    el.querySelector('.cards-sizes').addEventListener('click', function (e) {
      var b = e.target.closest('[data-size]'); if (!b) return;
      save({ size: b.dataset.size }); syncSize(); draw();
    });
    ui.custom.addEventListener('input', function (e) {
      var c = state().custom; c[e.target.dataset.c] = Math.max(30, Math.min(200, parseInt(e.target.value, 10) || 30)); save({ custom: c }); draw();
    });
    el.querySelector('.cards-layouts').addEventListener('click', function (e) {
      var b = e.target.closest('[data-layout]'); if (!b) return;
      var L = clone(LAYOUTS.find(function (l) { return l.id === b.dataset.layout; })); L.base = L.id;
      var patch = { layout: L }; if (L.size) patch.size = L.size;
      save(patch); syncSize(); draw();
    });
    el.querySelector('[data-shuffle]').addEventListener('click', function () { save({ layout: shuffle(state().layout) }); draw(true); });
    el.querySelector('.seg').addEventListener('click', function (e) {
      var b = e.target.closest('[data-band]'); if (!b) return;
      var L = state().layout; L.band = b.dataset.band; save({ layout: L }); draw();
    });
    ui.trueBox.addEventListener('change', function () { save({ trueSize: ui.trueBox.checked }); draw(); });
    ui.preview.addEventListener('mouseover', tip); ui.preview.addEventListener('click', tip);
    el.querySelector('.cards-colours').addEventListener('click', function (e) {
      var b = e.target.closest('[data-colour]'); if (!b) return;
      el.querySelectorAll('.cards-colour').forEach(function (x) { x.classList.toggle('on', x === b); });
    });
    el.querySelector('.cards-lock').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = e.target.querySelector('input').value.trim(); if (!name) return;
      var colour = el.querySelector('.cards-colour.on').dataset.colour;
      var st = state(), types = st.types.filter(function (t) { return t.name.toLowerCase() !== name.toLowerCase(); });
      types.push({ name: name, colour: colour, layout: clone(st.layout) });
      save({ types: types }); e.target.reset(); renderTypes();
    });
    ui.types.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var st = state(), i = +b.dataset.i;
      if (b.dataset.use != null) { save({ layout: clone(st.types[i].layout) }); draw(); window.scrollTo(0, 0); }
      if (b.dataset.remove != null) { st.types.splice(i, 1); save({ types: st.types }); renderTypes(); }
    });
    el.querySelector('[data-png]').addEventListener('click', function () {
      var st = state(), tmp = B.el('<div>' + render(st.layout, sizeOf(st), { dims: true, colour: currentColour() }) + '</div>');
      B.downloadPNG(tmp.firstChild, 'card-template-' + st.size + '.png');
    });
    el.querySelector('[data-json]').addEventListener('click', function () { B.downloadJSON(state(), 'card-layouts.json'); });

    syncSize(); draw(); renderTypes();
  }
  function unmount() { unsubs.forEach(function (u) { u(); }); unsubs = []; el = null; ui = {}; }

  function currentColour() { var b = el.querySelector('.cards-colour.on'); return b ? b.dataset.colour : '--brass'; }
  function syncSize() {
    var st = state();
    el.querySelectorAll('[data-size]').forEach(function (b) { b.classList.toggle('on', b.dataset.size === st.size); });
    ui.custom.hidden = st.size !== 'custom';
    ui.custom.querySelector('[data-c="w"]').value = st.custom.w; ui.custom.querySelector('[data-c="h"]').value = st.custom.h;
    el.querySelectorAll('.seg [data-band]').forEach(function (b) { b.classList.toggle('on', b.dataset.band === st.layout.band); });
    el.querySelectorAll('[data-layout]').forEach(function (b) { b.classList.toggle('on', b.dataset.layout === (st.layout.base || st.layout.id)); });
  }
  function draw(animate) {
    var st = state(), size = sizeOf(st);
    var scale = st.trueSize ? PX_PER_MM : Math.min(4.2, (ui.preview.clientWidth - 8) / (size.w + 2 * BLEED + 14));
    ui.preview.innerHTML = render(st.layout, size, { dims: true, colour: currentColour(), scale: scale });
    if (animate && !B.reducedMotion()) { ui.preview.classList.remove('deal'); void ui.preview.offsetWidth; ui.preview.classList.add('deal'); }
    ui.why.textContent = st.layout.why || '';
    el.querySelectorAll('.seg [data-band]').forEach(function (b) { b.classList.toggle('on', b.dataset.band === st.layout.band); });
    el.querySelectorAll('[data-layout]').forEach(function (b) { b.classList.toggle('on', b.dataset.layout === (st.layout.base || st.layout.id)); });
  }
  function tip(e) {
    var g = e.target.closest('.zone'); if (!g) return;
    var Z = ZONES[g.dataset.z];
    ui.tip.querySelector('b').textContent = Z.name + (Z.pt ? ' · ' + Z.pt + ' pt minimum' : '');
    ui.tip.querySelector('span').textContent = Z.what;
    ui.tip.classList.add('show');
  }
  function renderTypes() {
    var st = state(), size = sizeOf(st);
    ui.types.innerHTML = st.types.length ? st.types.map(function (t, i) {
      return '<div class="cards-type"><div class="cards-thumb">' + render(t.layout, size, { colour: t.colour, labels: false }) + '</div>' +
        '<div><b><i class="sw" style="--sw:var(' + t.colour + ')"></i>' + B.esc(t.name) + '</b><small class="muted">' + B.esc(t.layout.name) + ' · ' + size.w + '×' + size.h + '</small>' +
        '<div class="btn-row" style="margin-top:6px"><button type="button" class="btn paper sm" data-use data-i="' + i + '">Edit</button><button type="button" class="btn paper sm" data-remove data-i="' + i + '" aria-label="Remove">✕</button></div></div></div>';
    }).join('') : '<p class="muted">Nothing locked yet.</p>';
  }

  B.cards = { render: render, sizeOf: sizeOf, SIZES: SIZES, BLEED: BLEED, state: function () { return state(); } };
  B.register({ id: 'cards', mount: mount, unmount: unmount });
})();
