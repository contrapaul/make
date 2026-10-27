import { test } from "node:test";
import assert from "node:assert/strict";

const { highlight, LANGUAGES_SUPPORTED, escapeHtml } = await import(
  new URL("../js/highlight.js", import.meta.url)
);

function balanced(html) {
  assert.equal(
    (html.match(/<span/g) || []).length,
    (html.match(/<\/span>/g) || []).length,
    `spans must balance: ${html}`
  );
}

test("escapes before wrapping: markup in code stays inert", () => {
  const html = highlight('let a = "<div>";', "javascript");
  assert.ok(html.includes("&lt;div&gt;"), html);
  assert.ok(!html.includes("<div>"), html);
  balanced(html);
});

test("a literal script close tag cannot break the page", () => {
  const html = highlight("</script>", "html");
  assert.ok(!html.includes("</script>"), html);
  balanced(html);
});

test("ampersands escape once, never twice", () => {
  const html = highlight("a && b", "c");
  assert.ok(html.includes("&amp;&amp;"), html);
  assert.ok(!html.includes("&amp;amp;"), html);
});

test("a comment containing markup is escaped and wrapped once", () => {
  const html = highlight("// <b>&</b>", "javascript");
  assert.equal((html.match(/token-com/g) || []).length, 1, html);
  assert.ok(html.includes("&lt;b&gt;"), html);
  assert.ok(!html.includes("<b>"), html);
  balanced(html);
});

test("a string containing // is not split by line-comment scanning", () => {
  const html = highlight('url = "http://x"', "python");
  assert.equal((html.match(/token-str/g) || []).length, 1, html);
  assert.equal((html.match(/token-com/g) || []).length, 0, html);
  balanced(html);
});

test("a keyword inside a string is not tokenised as a keyword", () => {
  const html = highlight('const s = "return";', "javascript");
  assert.ok(html.includes('token-str'), html);
  assert.ok(!html.includes(">return<"), html);
  balanced(html);
});

test("identifier-shaped words are not keywords", () => {
  const html = highlight("let iffy = selection;", "javascript");
  assert.equal((html.match(/token-key/g) || []).length, 1, html);
  balanced(html);
});

test("degrades without throwing on empty and unknown input", () => {
  for (const [code, lang] of [
    [null, "python"],
    [undefined, "python"],
    ["", "python"],
    ["let a = 1;", "cobol"],
    ["let a = 1;", ""],
  ]) {
    const html = highlight(code, lang);
    assert.equal(typeof html, "string");
    balanced(html);
  }
});

test("unclosed string and unclosed block comment still balance", () => {
  for (const [code, lang] of [
    ['let a = "oops', "javascript"],
    ["/* never ends", "c"],
    ["-- never ends", "sql"],
  ]) {
    const html = highlight(code, lang);
    assert.ok(html.includes("&quot;") || html.includes("never ends"), html);
    balanced(html);
  }
});

test("every supported language highlights a shared snippet with balanced spans", () => {
  const snippet = [
    "#c",
    'x = "s"',
    "if y == 3 {",
    "  z = 12",
    "}",
    "<div class=\"a\">",
  ].join("\n");
  for (const lang of LANGUAGES_SUPPORTED) {
    const html = highlight(snippet, lang);
    assert.equal(typeof html, "string", lang);
    balanced(html);
    assert.ok(!html.includes("<div class=\"a\">"), `${lang} leaked live markup`);
  }
});

test("supports one key per record language, and no more", () => {
  assert.equal(LANGUAGES_SUPPORTED.length, 22);
  assert.ok(LANGUAGES_SUPPORTED.includes("scratch"));
  assert.ok(LANGUAGES_SUPPORTED.includes("powershell"));
});

test("escapeHtml covers the four markup characters", () => {
  assert.equal(escapeHtml(`<>&"`), "&lt;&gt;&amp;&quot;");
});
