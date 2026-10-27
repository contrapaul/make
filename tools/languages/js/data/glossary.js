/**
 * A word, said once, in plain English. Shape and rules: plan §10.1.
 * `short` is the one line you skim. `full` is the whole idea, and it may use
 * only words that have their own entry or need no help.
 *
 * Seed entries so the site can link. The glossary task in M4 completes the set
 * named by the 22 records.
 */

export const GLOSSARY = [
  {
    id: "variable",
    term: "variable",
    short: "A name that stands for one value.",
    full: "You write a name, point it at a value, and later use the name instead of the value. The value can change; the name stays.",
    links: [{ source: "MDN", title: "Glossary: Variable", url: "https://developer.mozilla.org/en-US/docs/Glossary/Variable" }],
  },
  {
    id: "function",
    term: "function",
    short: "A named step you can ask for again.",
    full: "You write an instruction once, give it a name, and call that name whenever you need it. A function can take a value in and hand a value back.",
    links: [{ source: "MDN", title: "Glossary: Function", url: "https://developer.mozilla.org/en-US/docs/Glossary/Function" }],
  },
  {
    id: "string",
    term: "string",
    short: "Text kept as one value.",
    full: "Letters, spaces, and marks between quote marks are a string to the computer. It stores the text without reading it.",
    links: [{ source: "MDN", title: "Glossary: String", url: "https://developer.mozilla.org/en-US/docs/Glossary/String" }],
  },
  {
    id: "comment",
    term: "comment",
    short: "A note to the reader that the computer ignores.",
    full: "A comment is text inside the code that never runs. It marks why a step exists, since the code already shows what happens.",
    links: [{ source: "Go blog", title: "Effective Go: Comments", url: "https://go.dev/doc/effective_go#comments" }],
  },
  {
    id: "type",
    term: "type",
    short: "The kind of value a name may hold.",
    full: "A number, a piece of text, and a yes-or-no answer are different kinds. Some languages ask you to write the kind down, and some work it out themselves.",
    links: [{ source: "TS Handbook", title: "Everyday Types", url: "https://www.typescriptlang.org/docs/handbook/2/everyday-types.html" }],
  },
  {
    id: "bug",
    term: "bug",
    short: "A mistake in the code that shows as wrong results.",
    full: "A bug is a step that does not mean what the writer intended. Finding one means finding the first line that goes wrong, not the place it becomes visible.",
    links: [{ source: "Python tutorial", title: "Errors and Exceptions", url: "https://docs.python.org/3/tutorial/errors.html" }],
  },
];
