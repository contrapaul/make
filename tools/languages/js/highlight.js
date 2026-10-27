/**
 * highlight.js — hand-rolled syntax highlighter for the language site (spec §9.2).
 *
 * Pure string in, string out. No dependencies, no build step, no DOM access, so
 * `test/highlight.test.mjs` can import it from plain Node.
 *
 * Contract:
 * - `highlight(code, lang)` returns HTML. It escapes FIRST, then wraps: every text
 *   run is HTML-escaped on the way out, so the only raw `<` and `>` in the result are
 *   the ones this file inserts when it opens and closes a span. `</script>` comes back
 *   inert.
 * - Output uses exactly four classes, the ones `css/tokens.css` colours: token-key,
 *   token-str, token-com, token-num. Plain text is emitted bare (no span) to keep the
 *   markup small.
 * - An unknown language, null/undefined/"" code, an unclosed string, or an unclosed
 *   block comment never throws: the affected text degrades to escaped plain text, so
 *   spans always balance and a stray quote cannot swallow the page.
 * - Keyword lists hold at most 30 entries. Languages with larger real reserved-word
 *   sets (Java, PHP, Rust, Swift, TypeScript, …) carry the 30 most frequent in short
 *   snippets, not the whole set; the omitted words simply render as plain text.
 */

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

/** HTML-escape the four characters that change markup. */
export function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ESCAPES[c]);
}

// Longest-opener-first, so `--` beats `-` and `/*` beats `/`.
function openers(list) {
  return (list || []).slice().sort((a, b) => b.length - a.length);
}

const NUM = /^(0[xXbB][0-9a-fA-F_]+|\d[\d_]*(\.?[\d_]+)?([eE][+-]?\d+)?[uifL]*)/;
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*/;
const TAG = /^<\/?[A-Za-z][^>]*>?/;
const AT_RULE = /^@[A-Za-z][A-Za-z0-9_-]*/;

function span(cls, text) {
  return `<span class="${cls}">${escapeHtml(text)}</span>`;
}

/** One `<div class="x">` run: name as key, quoted attribute values as strings. */
function highlightTag(tag) {
  let out = "";
  let i = 0;
  const lead = tag.startsWith("</") ? 2 : 1;
  let j = lead;
  while (j < tag.length && /[\w-]/.test(tag[j])) j += 1;
  out += escapeHtml(tag.slice(0, lead));
  out += j > lead ? span("token-key", tag.slice(lead, j)) : "";
  for (let k = j; k < tag.length; ) {
    const c = tag[k];
    if (c === '"' || c === "'") {
      let end = tag.indexOf(c, k + 1);
      if (end < 0) {
        out += escapeHtml(tag.slice(k));
        break;
      }
      out += span("token-str", tag.slice(k, end + 1));
      k = end + 1;
      continue;
    }
    out += escapeHtml(c);
    k += 1;
  }
  void i;
  return out;
}

function readString(s, i, quote, d) {
  let j = i + 1;
  while (j < s.length) {
    const c = s[j];
    if (d.esc && c === "\\") {
      j += 2;
      continue;
    }
    if (c === quote) {
      if (d.dbl && s[j + 1] === quote) {
        j += 2;
        continue;
      }
      return j + 1;
    }
    if (!d.esc && s[j - 1] !== "\\" && c === "\\" && quote !== "'") {
      j += 2;
      continue;
    }
    j += 1;
  }
  return -1;
}

// Descriptor fields:
//   lc   line-comment openers            bc  [open, close] block comment, or null
//   q    string quote chars              esc backslash escapes count inside strings
//   dbl  a doubled quote escapes itself  ci  keyword lookup is case-insensitive
//   tag  `<name>` / `</name>` are keys   qin  quotes are strings only inside a tag
//   kw   reserved words (see header note on the 30-word cap)
const LANGS = {
  javascript: { lc: ["//"], bc: ["/*", "*/"], q: ['"', "'", "`"], esc: true, dbl: false, kw: W("await break case catch class const continue default delete do else export extends finally for function if import in let new return super switch this throw try typeof var void while yield") },
  typescript: { lc: ["//"], bc: ["/*", "*/"], q: ['"', "'", "`"], esc: true, dbl: false, kw: W("abstract as async await break case catch class const declare default do enum export extends for function if implements import in infer interface keyof let namespace new private protected readonly return satisfies super switch this throw try type typeof var void while yield") },
  python: { lc: ["#"], bc: null, q: ['"', "'"], esc: true, dbl: false, kw: W("and as assert async break class continue def del elif else except finally for from global if import in is lambda not or pass raise return try while with yield") },
  java: { lc: ["//"], bc: ["/*", "*/"], q: ['"', "'"], esc: true, dbl: false, kw: W("abstract boolean break case catch char class continue default do double else enum extends final finally float for if implements import instanceof int interface long new package private protected public return static super switch this throw throws try void while") },
  csharp: { lc: ["//"], bc: ["/*", "*/"], q: ['"', "'", "`"], esc: true, dbl: false, kw: W("abstract as base bool break byte case catch char class const continue default do double else enum event explicit extern false finally float for foreach get if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly ref return sealed set short sizeof static string struct switch this try typeof uint ulong unsafe using var virtual void volatile while") },
  c: { lc: ["//"], bc: ["/*", "*/"], q: ['"', "'"], esc: true, dbl: false, kw: W("auto break case char const continue default do double else enum extern float for goto if int long return short signed sizeof static struct switch typedef union unsigned void volatile while") },
  cpp: { lc: ["//"], bc: ["/*", "*/"], q: ['"', "'"], esc: true, dbl: false, kw: W("alignas bool break case catch class const constexpr continue delete do else enum explicit export false for friend goto if inline mutable namespace new nullptr operator override private protected public register return short signed sizeof static struct switch template this throw true try typedef typeid typename union unsigned using virtual volatile while") },
  go: { lc: ["//"], bc: ["/*", "*/"], q: ['"', "`"], esc: true, dbl: false, kw: W("break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var iota nil true false") },
  rust: { lc: ["//"], bc: ["/*", "*/"], q: ['"', "'"], esc: true, dbl: false, kw: W("as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self static struct super trait true type unsafe use where while") },
  ruby: { lc: ["#"], bc: null, q: ['"', "'"], esc: true, dbl: false, kw: W("and begin break case class def do else elsif end ensure false for if in module next nil not or rescue return self super then true undef unless until when while yield") },
  php: { lc: ["//", "#"], bc: ["/*", "*/"], q: ['"', "'"], esc: true, dbl: false, kw: W("abstract and array as break case catch class clone const continue declare default do echo else elseif empty enddeclare endfor endforeach endif endwhile extends final finally for foreach function global if implements include instanceof interface isset list namespace new or print private protected public static switch throw trait try unset use var while xor yield") },
  swift: { lc: ["//"], bc: ["/*", "*/"], q: ['"'], esc: true, dbl: false, kw: W("associated break case catch class continue default defer do else enum extension fallthrough false fileprivate for func guard get if import in init internal lazy let mutating nil operator private protocol public repeat return self set static struct subscript super switch throw throws true try typealias var where while") },
  kotlin: { lc: ["//"], bc: ["/*", "*/"], q: ['"', "'"], esc: true, dbl: false, kw: W("as break by catch class companion const continue crossinline data do else enum false final finally for fun get if import in infix init inline interface internal is lateinit noinline null object open operator out override package private protected public reified return sealed set super suspend this throw try typealias typeof val var when while") },
  sql: { lc: ["--"], bc: ["/*", "*/"], q: ['"', "'"], esc: false, dbl: true, ci: true, kw: W("AND AS BY CASE CREATE DELETE DISTINCT DROP END EXISTS FROM GROUP HAVING IN INDEX INSERT JOIN KEY LIKE NOT NULL OR ORDER PRIMARY SELECT TABLE UPDATE VALUES WHEN WHERE") },
  bash: { lc: ["#"], bc: null, q: ['"', "'"], esc: true, dbl: false, kw: W("if then else elif fi for while until do done case esac function in select time return break continue export local readonly declare unset source alias") },
  powershell: { lc: ["#"], bc: ["<#", "#>"], q: ['"', "'"], esc: false, dbl: false, kw: W("begin catch data do dynamicparam else elseif end filter finally for foreach from if in param switch throw try until where while class enum hidden static true false") },
  r: { lc: ["#"], bc: null, q: ['"', "'"], esc: true, dbl: true, kw: W("if else repeat while function for in next break return TRUE FALSE NULL Inf NaN NA") },
  julia: { lc: ["#"], bc: ["#=", "=#"], q: ['"', "'"], esc: true, dbl: false, kw: W("begin break catch const continue do else elseif end export finally for function global if import in let local macro module mutable quote return struct try using where while") },
  matlab: { lc: ["%"], bc: null, q: ["'"], esc: false, dbl: true, kw: W("if elseif else end for parfor while switch case otherwise try catch function return break continue global persistent spmd true false classdef methods") },
  css: { lc: [], bc: ["/*", "*/"], q: ['"', "'"], esc: false, dbl: false, kw: W("charset import namespace media supports font-face counter-style keyframes page layer container property scope") },
  html: { lc: [], bc: ["<!--", "-->"], q: ['"', "'"], esc: false, dbl: false, tag: true, qin: true, kw: W("a body button code div em footer form h1 h2 head header hr html img input li main nav ol p pre script section select span strong table title ul") },
  scratch: { lc: [], bc: null, q: ['"'], esc: false, dbl: false, kw: W("when repeat forever if else stop") },
};

/**
 * Escape first, then wrap: `code` is source text, `lang` is one of
 * `LANGUAGES_SUPPORTED`. Anything this scanner cannot finish (an unknown language,
 * an unclosed string or comment, empty input) returns escaped plain text.
 */
export function highlight(code, lang) {
  const s = String(code ?? "");
  const d = LANGS[lang];
  if (!d || s === "") return escapeHtml(s);
  const lc = openers(d.lc);
  const quotes = d.q || [];
  let out = "";
  let plain = "";
  const flush = () => {
    if (plain !== "") {
      out += escapeHtml(plain);
      plain = "";
    }
  };
  for (let i = 0; i < s.length; ) {
    const rest = s.slice(i);
    if (d.bc) {
      const [op, cl] = d.bc;
      if (rest.startsWith(op)) {
        const end = s.indexOf(cl, i + op.length);
        if (end < 0) {
          plain += s.slice(i);
          break;
        }
        flush();
        out += span("token-com", s.slice(i, end + cl.length));
        i = end + cl.length;
        continue;
      }
    }
    let hit = null;
    for (const t of lc) {
      if (rest.startsWith(t)) {
        hit = t;
        break;
      }
    }
    if (hit) {
      let end = s.indexOf("\n", i);
      if (end < 0) end = s.length;
      flush();
      out += span("token-com", s.slice(i, end));
      i = end;
      continue;
    }
    if (!d.tag) {
      const q = quotes.find((c) => rest.startsWith(c));
      if (q) {
        const stop = readString(s, i, q, d);
        if (stop < 0) {
          plain += s[i];
          i += 1;
          continue;
        }
        flush();
        out += span("token-str", s.slice(i, stop));
        i = stop;
        continue;
      }
      if (d.tag === undefined && rest.startsWith("@") && AT_RULE.test(rest)) {
        flush();
        out += span("token-key", rest.match(AT_RULE)[0]);
        i += AT_RULE.exec(rest)[0].length;
        continue;
      }
      const id = rest.match(IDENT);
      if (id) {
        const word = d.ci ? id[0].toUpperCase() : id[0];
        if (d.kw.has(word)) {
          flush();
          out += span("token-key", id[0]);
          i += id[0].length;
          continue;
        }
        plain += id[0];
        i += id[0].length;
        continue;
      }
      const num = rest.match(NUM);
      if (num && !/[A-Za-z_"]/.test(s[i - 1] || "")) {
        flush();
        out += span("token-num", num[0]);
        i += num[0].length;
        continue;
      }
    } else if (rest.startsWith("<") && TAG.test(rest)) {
      const tag = rest.match(TAG)[0];
      flush();
      out += highlightTag(tag);
      i += tag.length;
      continue;
    } else if (d.tag && (rest.startsWith('"') || rest.startsWith("'"))) {
      const q = rest[0];
      const stop = readString(s, i, q, d);
      if (stop >= 0) {
        flush();
        out += span("token-str", s.slice(i, stop));
        i = stop;
        continue;
      }
    }
    plain += s[i];
    i += 1;
  }
  flush();
  return out;
}

export const LANGUAGES_SUPPORTED = Object.keys(LANGS);

function W(words) {
  return new Set(words.split(" "));
}
