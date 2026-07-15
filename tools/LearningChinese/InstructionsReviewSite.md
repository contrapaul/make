---

# Project Plan: Chinese Vocabulary Review Website

## 1. Project Goal
Build a single-page, static HTML/CSS/JS website (no backend needed) that serves as a personal review tool for Chinese vocabulary. The site must include a tag-filterable glossary, an Anki deck download, and two interactive drag-and-drop sentence builders.

## 2. Input Files (Provided)
- `ChineseVocab.md` (Textbook lessons 1-24, aligned to Speak Chinese Together 1)
- `ExpandedVocab.md` (all 24 textbook lessons + 8 bonus lessons, expanded with tags & sentences)
- `Bonusvocab.md` (original bonus lists, no sentences)

## 3. Output Files to Generate (by Claude Code)

| File | Purpose |
|------|---------|
| `index.html` | Main page with sidebar, accordions for all lessons, glossary, and tool links |
| `sentence-builder.html` | The drag-and-drop sentence builder tool (English mode & Chinese mode) |
| `glossary.html` | Standalone glossary (or embed in index.html as a hidden div) |
| `css/style.css` | All styling, including light/dark theme variables |
| `js/data.js` | JavaScript array containing all vocabulary from ExpandedVocab.md with tags |
| `js/glossary.js` | Filtering and search logic |
| `js/sentence-builder.js` | Drag-and-drop logic, validation, word bank generation |
| `js/main.js` | Accordion toggles, sidebar navigation, random sentence display |
| `chinese_vocab_anki.apkg` | **Anki deck file** (see Section 9 below) |

---

## 4. Recommended Additional Review Activity

**"Fill-in-the-Blank with Tone Marks"**

*How it works:*
- A Chinese sentence is shown with one word missing (e.g., `我想___咖啡`).
- Below, 4 clickable options are shown as Pinyin with tone numbers (e.g., `he1`, `mai3`, `chi1`, `kan4`).
- The user clicks the correct Pinyin + tone.
- Feedback: Correct turns green; incorrect shows red + correct answer.

*Why this is valuable:*
- Your existing data doesn't have tone-marked Pinyin for *every* word, but you have Pinyin strings. A JS function can convert `he1` → `hē`, `ma3i` → `mǎi`, etc.
- This targets a specific weakness for learners (tone recognition) that flashcards and sentence builders don't emphasize.

*Where to place it:* A third link on the main page: "🎯 Tone Trainer"

---

## 5. Data Structure Recommendation

For Claude Code to build the glossary and sentence builder efficiently, the data in `js/data.js` should look like this:

```javascript
const vocab = [
  {
    "hanzi": "电脑",
    "pinyin": "diànnǎo",
    "definition": "computer",
    "tags": ["type:noun", "lesson:bonus1", "topic:computers", "hsk:1"],
    "sentences": [
      {"zh": "我的电脑很快。", "en": "My computer is very fast."},
      {"zh": "你每天用几个小时电脑？", "en": "How many hours a day do you use the computer?"}
    ]
  },
  // ... more entries
];
```

**Claude Code should generate this file by parsing `ExpandedVocab.md`.** The markdown tables already contain all needed fields. The "Example Sentences" section in each entry can be parsed as shown above.

---

## 6. Sentence Builder: Technical Specifications

### Data Requirements
To build the sentence builder, Claude Code needs to extract **every sentence pair** from `ExpandedVocab.md`. For each sentence, store:
- English text
- Chinese text (Hanzi)
- Pinyin (optional, for Chinese mode display)
- Array of tokenized Chinese words (for drag-and-drop spaces)

Example sentence object:
```javascript
{
  "id": "sent_001",
  "en": "My computer is very fast.",
  "zh": "我的电脑很快。",
  "pinyin": "Wǒ de diànnǎo hěn kuài.",
  "tokens": ["我的", "电脑", "很快"]  // or ["我", "的", "电脑", "很", "快"]
}
```

### Word Bank Logic (English Mode)
- Correct words for the sentence (from `tokens`) + 20 random words from the entire vocabulary pool.
- Random words should exclude the correct tokens to avoid duplicates.
- If the sentence has fewer than 5 tokens, add more random words to reach ~20-25 total.

### Word Bank Logic (Chinese Mode)
- English translation of the sentence broken into tokens + 20 random English words.

### Drag-and-Drop Behavior
- Each "space" (slot) is a droppable `<div>`.
- Each word in the word bank is a draggable `<div>` with `draggable=true`.
- When dropped, clone the word into the slot. Original remains in bank.
- Hover over a placed word shows an ✖️; click removes it (returns to bank visually, but bank never loses the original).
- Color states (pending/yellow, correct/green, incorrect/red) applied via CSS classes.

### Validation Logic
- Compare dropped word's Hanzi (or English in Chinese mode) against the expected token at that position.
- Expected tokens are stored per sentence.

---

## 7. Main Page Requirements

### Sidebar (Table of Contents)
- Links to: "Glossary", "Sentence Builder", "Tone Trainer", "Download Anki Deck"
- Links to each lesson accordion (e.g., "Lesson 2 — Classroom", "Bonus 1 — Computer Parts")
- Clicking a lesson link opens that accordion and scrolls to it.

### Accordions
- One accordion per lesson from `ExpandedVocab.md` (Lessons 1-24 + Bonus 1-8).
- Each accordion contains the vocabulary table for that lesson.
- Tables should be sortable by Hanzi/Pinyin/Definition (nice to have but not critical).

### Random Sentence Display
- On page load, randomly select one sentence from the sentence pool.
- Display as: **English** | **Chinese** | **Pinyin** (all three).
- Refresh button to load another random sentence.

### Anki Download Link
- Link to `/chinese_vocab_anki.apkg` (generated separately — see below)

---

## 8. Claude Code Execution Steps

Claude Code should perform these tasks in order:

1. **Parse `ExpandedVocab.md`** and generate `js/data.js` with full tag structure and sentence extraction.
2. **Build `index.html`** with sidebar, accordions, glossary container, random sentence widget.
3. **Build `glossary.html`** (or embed glossary in index.html) with tag filter dropdown and live search input.
4. **Build `sentence-builder.html`** with two modes, drag-and-drop using HTML5 Drag & Drop API or JavaScript mouse events (recommend JS mouse events for cross-browser reliability).
5. **Build `css/style.css`** with light/dark theme support (CSS variables). Default theme: pending=yellow, correct=green, incorrect=red.
6. **Build all JS modules** (`glossary.js`, `sentence-builder.js`, `main.js`).
7. **Generate `chinese_vocab_anki.apkg`** — see below.

---

## 9. Anki Deck Generation

### Required Format
Anki's `.apkg` file is a SQLite database + media zip. **Simpler approach:** Generate a **CSV file** that Anki can import, and also generate the `.apkg` using a Python script (Claude Code can write the script, but cannot execute it to produce the binary file during the same session). 

**Recommendation:**
1. Claude Code generates `anki_import.csv` with this structure:
   ```
   Front,Back,Tags
   电脑,diànnǎo (computer),Bonus1::Computer
   显卡,xiǎnkǎ (graphics card),Bonus1::Computer
   ```
2. Claude Code also writes a short `build_anki.py` script that uses `genanki` library to convert the CSV to `.apkg`.
3. You run `python build_anki.py` locally to produce `chinese_vocab_anki.apkg`.

### CSV Columns (Front, Back, Tags)
- **Front:** Hanzi
- **Back:** `pinyin (definition)` + example sentence (optional but recommended)
- **Tags:** lesson name + topic

### Which vocab to include?
- All entries from `ExpandedVocab.md` (core lessons + bonus lessons).

---

## 10. Additional Needs & Recommendations

### a. Local Storage for Sentence Builder Progress
Save the current state of the sentence builder (which sentence, filled slots) to `localStorage`. If the user refreshes the page, restore their work.

### b. Mobile Responsiveness
Drag-and-drop is painful on touchscreens. Add a fallback: tapping a word in the bank inserts it into the first empty slot. Also provide a "Clear All" button.

### c. Sentence Builder Sentence Pool Size
The `ExpandedVocab.md` file contains approximately **250-300 example sentences**. That is more than enough. Random selection for practice mode would be a nice addition (e.g., "Random Sentence" button in the builder).

### d. Pinyin Tone Colors
A "nice to have" but not required. Style Pinyin text with colors for each tone (e.g., red for 1st, green for 2nd, etc.) to reinforce tone recognition.

### e. No Backend Required
Everything is static HTML/CSS/JS. Hosting can be on GitHub Pages, Netlify, or any static host.

---

## 11. Summary of Files to Be Produced by Claude Code

| File | Description |
|------|-------------|
| `index.html` | Main page with sidebar, accordions, glossary embed |
| `sentence-builder.html` | Drag-and-drop tool |
| `tone-trainer.html` | Recommended additional activity |
| `css/style.css` | Themes + layout |
| `js/data.js` | All vocabulary + sentences as JSON |
| `js/glossary.js` | Filter/search logic |
| `js/sentence-builder.js` | Drag-drop, validation, word bank |
| `js/tone-trainer.js` | Tone fill-in-blank |
| `js/main.js` | Accordions, random sentence, sidebar |
| `anki_import.csv` | CSV for Anki import |
| `build_anki.py` | Python script to convert CSV to `.apkg` |

**No additional files are required from you.** The markdown files you provided contain all necessary vocabulary, Pinyin, definitions, and example sentences. Claude Code will parse them automatically.

---

## 12. Suggested Claude Code Prompt

> "Using the attached `ExpandedVocab.md`, `ChineseVocab.md`, and `Bonusvocab.md`, build a complete static website according to the project plan above. Generate all HTML, CSS, and JS files. Parse the markdown to create `js/data.js` with full sentence extraction. Build the drag-and-drop sentence builder with two modes. Generate `anki_import.csv` and `build_anki.py`. Include a tone trainer as the third activity. Output all files in a clearly organized directory structure."