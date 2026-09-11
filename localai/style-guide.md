# v100 Style Guide

How to write every word on this site.

Status: drafted 2026-09-05. Governs `index.html` plus every user facing string in `js/tabs/*.js`. If a sentence on the site breaks a rule here, the sentence is wrong, not the rule.

---

## 1. Who is reading this

A high school student, or an adult with no local AI experience, who probably believes ChatGPT is a magic box. They are intelligent. They are not informed. Those are different things, and the difference decides every choice below.

Two failure modes, both fatal:

- **Talking down.** Cartoon analogies, exclamation marks, "don't worry about the details!" A student can tell when they are being handled, and they stop trusting the page.
- **Assuming.** Writing `KV cache` and moving on. The reader does not know what K is, what V is, or what is being cached. They are now lost, and they will not tell you.

The target is a good textbook: plain, unhurried, complete. It respects the reader by explaining things, not by skipping them.

A second audience reads over their shoulder: experienced local AI enthusiasts, who must find the numbers honest and the assumptions labeled. Nothing in this guide loosens that. Simplifying the language is not the same as simplifying the claim.

---

## 2. The em dash is banned

Never use `—` (em dash) in any user facing text. Not in HTML, not in a JavaScript string, not in a caption, not in an `aria-label`.

It is not a typographic preference. The em dash is the hinge of a specific rhythm: **short claim, dash, dramatic addendum.** That rhythm reads as confident and teaches nothing, because the part after the dash is usually the part the reader needed explained.

The fix is almost never a different punctuation mark. It is a second sentence.

| Instead of | Write |
|---|---|
| `That gap — not either side alone — is the core lesson.` | `That gap is the core lesson. Neither speed means much on its own.` |
| `Stage 1 is live — try it.` | `Stage 1 is working now. Type something into the box to see it run.` |
| `Weights "pour" from disk into the memory of your current config — GB used vs available.` | `The weights are copied from your drive into memory. The bar shows how much memory that uses, out of how much you have.` |

Also covered by this rule:

- **En dash `–`.** Same problem, smaller. Allowed only in number ranges: `4–5 bits`, `2026–2027`.
- **The middot `·`.** Currently used everywhere as a prose separator. In running sentences it does the em dash's job with a smaller mark, so it is banned there too. It stays allowed in **data labels only**, where it separates fields rather than clauses: `RTX 3090 24 GB · 936 GB/s`, `DDR5-6000 · 96 GB/s`.
- **Double hyphen `--`** as a substitute. No.

What to use instead, in order of preference: a full stop, a colon (when the second half genuinely defines or lists the first), a comma, or brackets for a true aside.

---

## 3. Cadence

The current copy has an accent. Short punchy fragment. Then a reversal. Then a resonant closing clause. It sounds like a conference talk, and conference talks are optimized to feel insightful in the moment, not to leave you able to do anything afterward.

Rules:

1. **Vary sentence length, and let the long ones be long.** Explanation needs subordinate clauses. A page of eight word sentences is exhausting and carries almost no information per line.
2. **No sentence fragments.** "Two speeds, one contrast." is a slogan, not a sentence.
3. **No rule of three.** "Pick hardware, model and precision, then run inference and watch the numbers move." Triads sound designed. Say what the thing does.
4. **No reveals.** Do not withhold the point to deliver it late. Say it first, then support it.
5. **State the mechanism, not the vibe.** "Offloading feels painfully slow" tells the reader nothing. "The layers stored in system RAM are read about ten times more slowly than the ones on the GPU, so every token has to wait for them" tells them why.
6. **Second person, active voice.** "You type a sentence. The model splits it into tokens." Not "text becomes numbered pieces."
7. **Cut the throat clearing.** "It's worth noting that", "Think of it like", "Here's the thing:". Delete and start at the noun.
8. **Use contractions.** "You've probably used a cloud model" reads like a person. "You have probably used" reads like a form. (Owner edit, 2026-09-05.)
9. **Pick the everyday word.** "math", not "arithmetic". "building", not "facility". If a plainer word means the same thing, it wins. (Owner edit, 2026-09-05.)
10. **No clever phrasing, even when it is accurate.** "Local AI is the same idea with the location changed" and "this works with the network cable unplugged" were both replaced by the owner with direct statements: it runs on your own hardware, and you can use it totally offline. Elegance that costs a beat of decoding is not worth it here.
11. **Say it once.** If the paragraph above already said there is no per use charge, the list item is just "Electricity." Redundancy is the other way a page becomes a slog.

One useful test: read the paragraph and ask **"could the reader now explain this to someone else?"** If they could only repeat the phrasing, rewrite it.

---

## 4. Headers

Headers are navigation and outline, not copy. A reader skimming the headers alone should get an accurate table of contents.

**Write them like a textbook section heading:** a plain noun phrase naming the topic.

| Current | Problem | Replace with |
|---|---|---|
| `The fork: local or cloud?` | Metaphor ("fork") plus a colon plus a rhetorical question. Names nothing. | `Where AI models run` |
| `Speed is set by memory bandwidth` | A claim, and it uses two undefined terms in the header itself. | `Why memory speed limits how fast a model writes` |
| `A "model" is billions of numbers` | Scare quotes and a punchline. | `What an AI model actually is` |
| `Who's the bottleneck?` | Rhetorical question, and "bottleneck" is undefined here. | `Comparing memory speeds` |
| `Prefill vs decode` | Two undefined terms and an abbreviation. | `Reading your question, then writing the answer` |

Specifics:

- No questions, unless the section genuinely answers that exact question in its first sentence.
- No colons splitting a catchy half from an explanatory half.
- No metaphors in headers. Metaphors need setup, and a header has no room for setup.
- **A term may not make its first appearance in a header.** Introduce it in body text first, then a later header can use it.
- Sentence case. Numbered stages keep their number: `Stage 3. Reading your question, then writing the answer`.

---

## 5. Introducing a term

This is the rule the site most needs.

**Every technical term gets defined in plain words at its first appearance in body text, before it is used to explain anything else.**

The pattern, in order:

1. Name the thing.
2. Say what it is in ordinary language, expanding every letter of any abbreviation.
3. Say why the reader should care about it here.
4. Mark it up as a glossary term so the full definition is one hover away.

Worked example. `KV cache` currently appears with no definition at all. It cannot be introduced as "the KV cache". It has to be built:

> As the model reads your question, it works out two values for every word it has seen so far: a **key**, which is how that word gets found later, and a **value**, which is what that word contributes when it is found. Recalculating those for the whole conversation on every new word would be enormously wasteful, so the model keeps them in memory and reuses them. That store is called the **KV cache**, for keys and values. It matters because it grows with every word in the conversation, and it competes with the model itself for space.

Long? Yes. It is also the entire reason context length costs memory, which is a headline fact of this site. Compare with what is there now, which is nothing.

Consequences:

- **Never use an abbreviation before expanding it.** `VRAM` is "the memory built into the graphics card, called VRAM". `TTFT` is "time to first token". `tok/s` is "tokens per second". `GGUF` is a file format and needs a sentence saying so.
- **Never define a term with other undefined terms.** "Q4_K_M packs weights to 4 to 5 bits using K-quant blocks with per-group scales" defines one unknown with three more.
- **Define once, properly, then rely on the glossary.** The page should not re-explain tokens in five places. Introduce it fully where the reader first meets it, mark every later use as a glossary term, and let hover do the rest.
- **A number without a referent is decoration.** `936 GB/s` means nothing alone. Give it a comparison the reader can hold: what it is faster than, and by how much.

---

## 6. Numbers, claims, and honesty

Unchanged from the existing blueprint rules, restated here so writers see them together:

- Every authoritative number carries a footnote or a labeled source.
- Every assumption is labeled as an assumption in plain words, not buried in a parenthesis.
- Prices are in Shenzhen terms: `¥0.65 / kWh`, FX 6.72.
- Never state a modeled estimate as a measurement. "This estimate assumes" is a real phrase, use it.
- Simplify the wording, never the number. If a figure needs a caveat, the caveat is part of the sentence, not an asterisk.

---

## 7. Length

Explaining properly costs words. Padding also costs words. They are not the same, and the second one is what makes a page feel like a slog.

- Cut every sentence that adds no fact.
- Aim for **three to six sentences per explanatory block**, then a visual, a control, or a break.
- Push depth into the glossary rather than the paragraph. The paragraph carries the sentence a reader needs to keep going; the glossary carries the full definition for the reader who stops to ask.
- Never repeat an explanation across tabs. Link it.

---

## 8. Checklist

Before any user facing string ships:

- [ ] No `—` anywhere. No `·` inside a sentence.
- [ ] No sentence fragments, no rule of three, no rhetorical questions.
- [ ] Every abbreviation is expanded at first use.
- [ ] Every technical term is either defined in place or marked as a glossary term.
- [ ] No term is defined using another undefined term.
- [ ] Headers are plain noun phrases and name their topic.
- [ ] Every number has something to compare it against.
- [ ] Read aloud: does it sound like a person explaining, or a product launch?
- [ ] Final test: could the reader now explain this to a friend?
