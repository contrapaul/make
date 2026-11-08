"""
Parse ../LearningChinese/conversations.md -> js/conversations-data.js

The markdown is the source of truth for the Flash Conversations cards. The page
reads only the generated file, so card edits mean re-running this script and
nothing else. Output is deterministic (no timestamps) so re-running produces a
clean diff.

Expected card set is fixed: A1-A21, B1-B14, C1-C7. A gap fails the build, which
keeps check_audio.py's recording checklist trustworthy.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'LearningChinese', 'conversations.md')
OUT_JS = os.path.join(HERE, 'js', 'conversations-data.js')

EXPECTED = ([f'a{n:02d}' for n in range(1, 22)]
            + [f'b{n:02d}' for n in range(1, 15)]
            + [f'c{n:02d}' for n in range(1, 8)])

CARD_RE = re.compile(r'^### ([ABC])(\d+):\s*(.*?)\s*$')
BULLET_RE = re.compile(r'^-\s+(.*)$')
MARK_RE = re.compile(r'^\*\*([ABCQ])\s*(?:\(([^)]*)\))?\s*:\*\*\s*(.*)$')
NOTE_RE = re.compile(r'^(New words|Note)\s*:\s*(.*)$')
HANZI_RE = re.compile(r'[\u4e00-\u9fff]')


def split_pinyin(text):
    """
    Split '汉字。(Pīnyīn.)' into (zh, pinyin) using the LAST parenthesis group.

    Scanning backwards with depth counting is what makes the awkward cards work:
    B3/B10 nest a Latin tag inside the pinyin group ('…(ISNS) gōngzuò.)') and C1
    puts an English aside in the hanzi text before the pinyin group. The group is
    only treated as pinyin when it holds no hanzi.
    """
    t = text.rstrip()
    if not t.endswith(')'):
        return t, ''
    depth = 0
    for i in range(len(t) - 1, -1, -1):
        c = t[i]
        if c == ')':
            depth += 1
        elif c == '(':
            depth -= 1
            if depth == 0:
                inner = t[i + 1:-1]
                if HANZI_RE.search(inner):
                    return t, ''
                return t[:i].rstrip(), inner.strip()
    return t, ''


def parse(text):
    cards, errors = [], []
    card = None
    section = ''
    for raw in text.split('\n'):
        line = raw.rstrip()
        m = re.match(r'^##\s+([ABC])\.', line)
        if m:
            section = m.group(1)
            continue
        # Any other h2 (the trailing '## Study notes' block) ends the current card.
        if re.match(r'^##\s', line):
            card = None
            continue
        m = CARD_RE.match(line)
        if m:
            sec, num, title = m.group(1), int(m.group(2)), m.group(3)
            card = {'id': f'{sec.lower()}{num:02d}', 'section': sec, 'num': num,
                    'title': title, 'lines': [], 'note': ''}
            cards.append(card)
            continue
        if card is None:
            continue
        m = BULLET_RE.match(line)
        if m:
            body = m.group(1).strip()
            note = NOTE_RE.match(body)
            if note:
                card['note'] = (card['note'] + ' ' + note.group(2).strip()).strip()
                card['_has_note'] = True
                continue
            mk = MARK_RE.match(body)
            if mk:
                role, label, rest = mk.group(1), (mk.group(2) or '').strip(), mk.group(3)
            elif HANZI_RE.search(body):
                role, label, rest = 'S', '', body
            else:
                continue
            zh, pinyin = split_pinyin(rest)
            if not HANZI_RE.search(zh):
                continue
            card['_pending'] = {'role': role, 'label': label, 'zh': zh,
                                'pinyin': pinyin, 'en': ''}
            card['lines'].append(card['_pending'])
            continue
        # An indented line under a speakable bullet is its English translation.
        if line.startswith('  ') and card['lines'] and card.get('_pending'):
            en = line.strip()
            if en:
                card['_pending']['en'] = (card['_pending']['en'] + ' ' + en).strip()
            continue
        if line.strip() == '':
            card['_pending'] = None

    for card in cards:
        card.pop('_pending', None)
        has_note = card.pop('_has_note', False)
        if not has_note:
            card['note'] = ''
        if not card['lines']:
            errors.append(f"{card['id']}: no speakable lines")

    ids = [c['id'] for c in cards]
    for missing in [i for i in EXPECTED if i not in ids]:
        errors.append(f'missing card {missing}')
    for extra in [i for i in ids if i not in EXPECTED]:
        errors.append(f'unexpected card {extra}')
    if len(ids) != len(set(ids)):
        errors.append('duplicate card ids')
    return cards, errors


def main():
    with open(SRC, encoding='utf-8') as f:
        text = f.read()
    cards, errors = parse(text)
    if errors:
        for e in errors:
            print(f'ERROR {e}', file=sys.stderr)
        sys.exit(1)

    speakable = sum(len(c['lines']) for c in cards)
    counts = {sec: {'cards': sum(1 for c in cards if c['section'] == sec),
                    'lines': sum(len(c['lines']) for c in cards if c['section'] == sec)}
              for sec in ('A', 'B', 'C')}
    counts['total'] = {'cards': len(cards), 'lines': speakable}

    body = json.dumps({'cards': cards, 'counts': counts}, ensure_ascii=False, indent=2)
    with open(OUT_JS, 'w', encoding='utf-8') as f:
        f.write('// Auto-generated by build_conversations.py. Do not edit by hand.\n')
        f.write('// Source: ../LearningChinese/conversations.md\n')
        f.write('const CONVERSATIONS = ')
        f.write(json.dumps(cards, ensure_ascii=False, indent=2))
        f.write(';\n\nconst CONVERSATION_COUNTS = ')
        f.write(json.dumps(counts, ensure_ascii=False, indent=2))
        f.write(';\n')

    print(f'Wrote {len(cards)} cards, {speakable} speakable lines to {OUT_JS}')
    for sec in ('A', 'B', 'C'):
        print(f'  section {sec}: {counts[sec]["cards"]} cards, {counts[sec]["lines"]} lines')


if __name__ == '__main__':
    main()
