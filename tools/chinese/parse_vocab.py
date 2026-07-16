"""
Parse ExpandedVocab.md → js/data.js and anki_import.csv
"""
import re
import json
import csv
import os

SRC = os.path.join(os.path.dirname(__file__), '..', 'LearningChinese', 'ExpandedVocab.md')
OUT_JS = os.path.join(os.path.dirname(__file__), 'js', 'data.js')
OUT_CSV = os.path.join(os.path.dirname(__file__), 'anki_import.csv')


def slugify_lesson(header_text):
    """Turn '✅ Lesson 2 — Classroom Expressions (Expanded)' → lesson2"""
    t = header_text.strip()
    # Bonus Lesson N
    m = re.search(r'Bonus Lesson (\d+)', t, re.I)
    if m:
        return f'bonus{m.group(1)}'
    m = re.search(r'Lesson (\d+)', t, re.I)
    if m:
        return f'lesson{m.group(1)}'
    return re.sub(r'[^a-z0-9]', '', t.lower())[:20]


def lesson_display_name(header_text):
    """Turn raw header into a human-readable name."""
    t = re.sub(r'[✅*]', '', header_text).strip()
    t = re.sub(r'\s*\(Expanded\)', '', t, flags=re.I).strip()
    return t


def parse_tags(tag_str):
    """Parse `type:noun` `lesson:bonus1` ... → list of strings."""
    return re.findall(r'`([^`]+)`', tag_str)


# Controlled vocabulary for the `type:` facet. Raw values in the markdown are
# sometimes compound ("verb (modal)", "noun/verb", "noun (location)") which
# would otherwise fragment the Glossary's type filter into dozens of near-
# duplicate one-off options. We normalize by stripping parenthetical notes
# and splitting slash-separated compounds into multiple (deduped) type tags,
# so filtering by "verb" still finds modal verbs, "noun" still finds location
# nouns, etc.
def normalize_type_tags(tags):
    out = []
    seen = set()
    for t in tags:
        if not t.startswith('type:'):
            if t not in seen:
                out.append(t)
                seen.add(t)
            continue
        raw = t[len('type:'):]
        raw = re.sub(r'\([^)]*\)', '', raw)  # drop "(modal)", "(location)" etc.
        for piece in raw.split('/'):
            piece = piece.strip().lower()
            if not piece:
                continue
            norm = f'type:{piece}'
            if norm not in seen:
                out.append(norm)
                seen.add(norm)
    return out


def parse_sentences(raw):
    """
    Parse 'Example Sentences' cell into list of {zh, pinyin, en}.
    Format: '1. Chinese<br>Pinyin<br>English<br>2. Chinese<br>Pinyin<br>English'
    """
    raw = re.sub(r'<br\s*/?>', '\n', raw, flags=re.I)
    # Match numbered sentences: only split on digit+period at line start
    # Use findall to grab each numbered block
    parts = re.findall(r'(?:^|\n)\d+\.\s+(.*?)(?=\n\d+\.\s+|$)', raw.strip(), re.DOTALL)
    sentences = []
    for part in parts:
        lines = [l.strip() for l in part.strip().split('\n') if l.strip()]
        if len(lines) >= 3:
            sentences.append({'zh': lines[0], 'pinyin': lines[1], 'en': lines[2]})
        elif len(lines) == 2:
            sentences.append({'zh': lines[0], 'pinyin': '', 'en': lines[1]})
        elif len(lines) == 1:
            sentences.append({'zh': lines[0], 'pinyin': '', 'en': ''})
    return sentences


def parse_table_rows(block_text):
    """Extract all data rows from a markdown table block."""
    entries = []
    for line in block_text.split('\n'):
        line = line.strip()
        if not line.startswith('|') or line.startswith('|---') or line.startswith('| Hanzi'):
            continue
        # Split on |, strip
        cols = [c.strip() for c in line.split('|')]
        # Remove empty first/last from outer pipes
        if cols and cols[0] == '':
            cols = cols[1:]
        if cols and cols[-1] == '':
            cols = cols[:-1]
        if len(cols) < 5:
            continue
        hanzi, pinyin, definition, example_raw, tag_raw = cols[0], cols[1], cols[2], cols[3], cols[4]
        if not hanzi or hanzi == 'Hanzi':
            continue
        sentences = parse_sentences(example_raw)
        tags = normalize_type_tags(parse_tags(tag_raw))
        entries.append({
            'hanzi': hanzi,
            'pinyin': pinyin,
            'definition': definition,
            'tags': tags,
            'sentences': sentences,
        })
    return entries


def main():
    with open(SRC, encoding='utf-8') as f:
        content = f.read()

    # Split on section headers: "# ✅ Lesson..." or "# ✅ Bonus Lesson..."
    sections = re.split(r'\n(?=# )', content)

    vocab = []
    lessons_meta = []  # [{id, name, group, entries:[indices]}]

    for section in sections:
        lines = section.strip().split('\n')
        if not lines:
            continue
        header = lines[0].lstrip('#').strip()
        if not re.search(r'[Ll]esson', header):
            continue
        lesson_id = slugify_lesson(header)
        lesson_name = lesson_display_name(header)
        group = 'bonus' if lesson_id.startswith('bonus') else 'core'
        body = '\n'.join(lines[1:])
        entries = parse_table_rows(body)
        start_idx = len(vocab)
        for entry in entries:
            # Make sure lesson tag is present
            has_lesson = any(t.startswith('lesson:') for t in entry['tags'])
            if not has_lesson:
                entry['tags'].append(f'lesson:{lesson_id}')
            vocab.append(entry)
        lessons_meta.append({
            'id': lesson_id,
            'name': lesson_name,
            'group': group,
            'indices': list(range(start_idx, len(vocab))),
        })

    # Collect all sentences with an ID
    sentences = []
    for entry in vocab:
        for s in entry['sentences']:
            if s['zh'] and s['en']:
                sentences.append({
                    'id': f'sent_{len(sentences):04d}',
                    'zh': s['zh'],
                    'pinyin': s.get('pinyin', ''),
                    'en': s['en'],
                    'hanzi_source': entry['hanzi'],
                })

    # Write JS
    os.makedirs(os.path.dirname(OUT_JS), exist_ok=True)
    with open(OUT_JS, 'w', encoding='utf-8') as f:
        f.write('// Auto-generated by parse_vocab.py — do not edit by hand\n\n')
        f.write('const LESSONS_META = ')
        f.write(json.dumps(lessons_meta, ensure_ascii=False, indent=2))
        f.write(';\n\n')
        f.write('const vocab = ')
        f.write(json.dumps(vocab, ensure_ascii=False, indent=2))
        f.write(';\n\n')
        f.write('const sentences = ')
        f.write(json.dumps(sentences, ensure_ascii=False, indent=2))
        f.write(';\n')

    print(f'Wrote {len(vocab)} vocab entries, {len(sentences)} sentences, '
          f'{len(lessons_meta)} lessons to {OUT_JS}')

    # Write Anki CSV — front combines hanzi + pinyin (per user preference: always
    # show both), back is the meaning + first example sentence.
    with open(OUT_CSV, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['Front', 'Back', 'Tags'])
        for entry in vocab:
            front = entry['hanzi']
            if entry['pinyin']:
                front += f"<br><span style=\"font-size:0.55em;color:#666\">{entry['pinyin']}</span>"
            back = entry['definition']
            if entry['sentences']:
                s = entry['sentences'][0]
                back += f"<br><br>{s['zh']}<br>{s['pinyin']}<br>{s['en']}"
            tag_str = ' '.join(
                t.replace(':', '::').replace(' ', '_')
                for t in entry['tags']
            )
            writer.writerow([front, back, tag_str])

    print(f'Wrote {len(vocab)} rows to {OUT_CSV}')


if __name__ == '__main__':
    main()
