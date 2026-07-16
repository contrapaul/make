"""
build_anki.py — Convert anki_import.csv → chinese_vocab_anki.apkg
Requires: pip install genanki
Run: python build_anki.py
"""
import csv
import random
import genanki

DECK_ID   = 1234567890          # stable arbitrary ID
MODEL_ID  = 9876543210

model = genanki.Model(
    MODEL_ID,
    'Chinese Vocab (contrapaul)',
    fields=[
        {'name': 'Front'},
        {'name': 'Back'},
    ],
    templates=[{
        'name': 'Card 1',
        # Front = hanzi (large) + pinyin (small, muted), stacked — pinyin is
        # always visible per user preference, since characters alone are hard
        # to retain. Back reveals the meaning + an example sentence.
        'qfmt': '<div style="font-size:2.4em;text-align:center;line-height:1.3;">{{Front}}</div>',
        'afmt': '''{{FrontSide}}<hr>
<div style="text-align:center;font-size:1.1em;">{{Back}}</div>''',
    }],
)

deck = genanki.Deck(DECK_ID, 'Chinese Vocabulary — contrapaul')

with open('anki_import.csv', newline='', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        note = genanki.Note(
            model=model,
            fields=[row['Front'], row['Back']],
            tags=row['Tags'].split(),
            guid=genanki.guid_for(row['Front']),
        )
        deck.add_note(note)

genanki.Package(deck).write_to_file('chinese_vocab_anki.apkg')
print(f'Wrote chinese_vocab_anki.apkg with {len(deck.notes)} notes.')
