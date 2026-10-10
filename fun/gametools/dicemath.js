/* Dice math shared by Dice and Odds: parse a roll, roll it, and compute its
   exact distribution. Exposed as Bench.dice. */
(function () {
  'use strict';
  var B = window.Bench;
  var MAX_DICE = 20, MAX_SIDES = 1000, MAX_ENUM = 2e6;

  /* ---------- parse ----------
     "3d6", "2d20kh1", "4d6dl1", "1d6+2", "d20", "2d6+1d4-1", "d%" (= d100).
     Returns { terms: [{ n, s, keep: {mode, k}|null }], mod, text } or throws. */
  function parse(text) {
    var src = String(text || '').replace(/\s+/g, '').toLowerCase();
    if (!src) throw new Error('Type a roll, like 2d6.');
    var parts = src.match(/[+-]?[^+-]+/g);
    if (!parts || parts.join('') !== src) throw new Error("Couldn't read that. Try 2d6 or 1d20+3.");
    var terms = [], mod = 0, dice = 0;
    parts.forEach(function (p) {
      var sign = p[0] === '-' ? -1 : 1;
      var body = p.replace(/^[+-]/, '');
      if (/^\d+$/.test(body)) { mod += sign * parseInt(body, 10); return; }
      var m = body.match(/^(\d*)d(\d+|%)(?:(kh|kl|dh|dl)(\d+))?$/);
      if (!m) throw new Error('"' + body + '" is not a dice term. Try 2d6, d20 or 4d6dl1.');
      if (sign < 0) throw new Error('Subtracting dice is not supported. Use a minus number instead.');
      var n = m[1] === '' ? 1 : parseInt(m[1], 10);
      var s = m[2] === '%' ? 100 : parseInt(m[2], 10);
      if (n < 1) throw new Error('Roll at least one die.');
      if (s < 2) throw new Error('A die needs at least 2 sides.');
      if (s > MAX_SIDES) throw new Error('Sides capped at ' + MAX_SIDES + '.');
      var keep = null;
      if (m[3]) {
        var k = parseInt(m[4], 10);
        if (k < 1 || k >= n) throw new Error('Keep or drop between 1 and ' + (n - 1) + ' dice.');
        keep = { mode: m[3], k: k };
      }
      dice += n;
      terms.push({ n: n, s: s, keep: keep });
    });
    if (!terms.length) throw new Error('There are no dice in that.');
    if (dice > MAX_DICE) throw new Error('That is ' + dice + ' dice. The bench caps at ' + MAX_DICE + ' per roll; the shape of the odds stops changing well before then.');
    return { terms: terms, mod: mod, text: format({ terms: terms, mod: mod }) };
  }
  function format(p) {
    var s = p.terms.map(function (t) { return t.n + 'd' + t.s + (t.keep ? t.keep.mode + t.keep.k : ''); }).join('+');
    if (p.mod) s += (p.mod > 0 ? '+' : '') + p.mod;
    return s;
  }

  /* ---------- roll ----------
     Returns { faces: [[...per term]], kept: [[bool per die]], total }. */
  function keptMask(faces, keep) {
    if (!keep) return faces.map(function () { return true; });
    var idx = faces.map(function (v, i) { return i; }).sort(function (a, b) { return faces[b] - faces[a]; }); // high first
    var chosen = new Set();
    if (keep.mode === 'kh') idx.slice(0, keep.k).forEach(function (i) { chosen.add(i); });
    if (keep.mode === 'kl') idx.slice(-keep.k).forEach(function (i) { chosen.add(i); });
    if (keep.mode === 'dh') idx.slice(keep.k).forEach(function (i) { chosen.add(i); });
    if (keep.mode === 'dl') idx.slice(0, idx.length - keep.k).forEach(function (i) { chosen.add(i); });
    return faces.map(function (v, i) { return chosen.has(i); });
  }
  function roll(p) {
    var total = p.mod, faces = [], kept = [];
    p.terms.forEach(function (t) {
      var f = []; for (var i = 0; i < t.n; i++) f.push(B.rand(t.s));
      var m = keptMask(f, t.keep);
      f.forEach(function (v, i) { if (m[i]) total += v; });
      faces.push(f); kept.push(m);
    });
    return { faces: faces, kept: kept, total: total };
  }
  // Fast path for the lab: just the total, no bookkeeping.
  function rollTotal(p) {
    var total = p.mod;
    for (var ti = 0; ti < p.terms.length; ti++) {
      var t = p.terms[ti];
      if (!t.keep) { for (var i = 0; i < t.n; i++) total += B.rand(t.s); continue; }
      var f = []; for (var j = 0; j < t.n; j++) f.push(B.rand(t.s));
      var m = keptMask(f, t.keep);
      for (var k = 0; k < f.length; k++) if (m[k]) total += f[k];
    }
    return total;
  }

  /* ---------- exact distribution ----------
     Returns { min, p: Float64Array, exact: true|false }. p[i] is P(min + i).
     Plain terms convolve. Keep/drop terms enumerate when small enough,
     otherwise the distribution is estimated from 200k samples and marked. */
  function convolve(a, b) {
    var out = new Float64Array(a.p.length + b.p.length - 1);
    for (var i = 0; i < a.p.length; i++) {
      if (!a.p[i]) continue;
      for (var j = 0; j < b.p.length; j++) out[i + j] += a.p[i] * b.p[j];
    }
    return { min: a.min + b.min, p: out };
  }
  function single(s) { var p = new Float64Array(s); for (var i = 0; i < s; i++) p[i] = 1 / s; return { min: 1, p: p }; }
  function plain(n, s) { var d = single(s); for (var i = 1; i < n; i++) d = convolve(d, single(s)); return d; }
  function keepDrop(t) {
    var combos = Math.pow(t.s, t.n);
    if (combos > MAX_ENUM) return null;
    var kcount = t.keep.mode === 'kh' || t.keep.mode === 'kl' ? t.keep.k : t.n - t.keep.k;
    var min = kcount, max = kcount * t.s;
    var p = new Float64Array(max - min + 1);
    var faces = new Array(t.n).fill(1);
    var each = 1 / combos;
    for (var c = 0; c < combos; c++) {
      var m = keptMask(faces, t.keep), sum = 0;
      for (var i = 0; i < t.n; i++) if (m[i]) sum += faces[i];
      p[sum - min] += each;
      // increment odometer
      for (var d = 0; d < t.n; d++) { if (++faces[d] <= t.s) break; faces[d] = 1; }
    }
    return { min: min, p: p };
  }
  function distribution(p) {
    var dist = null, exact = true;
    for (var i = 0; i < p.terms.length; i++) {
      var t = p.terms[i];
      var d = t.keep ? keepDrop(t) : plain(t.n, t.s);
      if (!d) { exact = false; break; }
      dist = dist ? convolve(dist, d) : d;
    }
    if (!exact) {
      // sample 200k totals without the modifier, then shift below
      var counts = {}, minv = Infinity, maxv = -Infinity, N = 200000;
      var q = { terms: p.terms, mod: 0 };
      for (var k = 0; k < N; k++) { var v = rollTotal(q); counts[v] = (counts[v] || 0) + 1; if (v < minv) minv = v; if (v > maxv) maxv = v; }
      var arr = new Float64Array(maxv - minv + 1);
      Object.keys(counts).forEach(function (v) { arr[v - minv] = counts[v] / N; });
      dist = { min: minv, p: arr };
    }
    return { min: dist.min + p.mod, p: dist.p, exact: exact };
  }
  function range(p) {
    var min = p.mod, max = p.mod;
    p.terms.forEach(function (t) {
      var k = t.keep ? (t.keep.mode === 'kh' || t.keep.mode === 'kl' ? t.keep.k : t.n - t.keep.k) : t.n;
      min += k; max += k * t.s;
    });
    return { min: min, max: max };
  }

  B.dice = { parse: parse, format: format, roll: roll, rollTotal: rollTotal, distribution: distribution, range: range, MAX_DICE: MAX_DICE };
})();
