"""
Report which conversation mp3s exist and which are still to be recorded.

The expected set comes from js/conversations-data.js, so the checklist can never
drift from the cards the page renders. Non-zero exit while any file is missing,
which lets it gate a deploy.

    python3 check_audio.py           # checklist
    python3 check_audio.py --quiet   # exit code only
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'js', 'conversations-data.js')
AUDIO_DIR = os.path.join(HERE, 'audio', 'conversations')


def card_ids():
    with open(DATA, encoding='utf-8') as f:
        text = f.read()
    payload = text.split('const CONVERSATIONS = ', 1)[1].split(';\n\nconst CONVERSATION_COUNTS', 1)[0]
    return [c['id'] for c in json.loads(payload)]


def main():
    quiet = '--quiet' in sys.argv
    ids = card_ids()
    missing = [i for i in ids if not os.path.isfile(os.path.join(AUDIO_DIR, f'{i}.mp3'))]
    present = [i for i in ids if i not in missing]

    if not quiet:
        print(f'{len(present)} of {len(ids)} mp3s present in audio/conversations/')
        if missing:
            print('\nTo record or generate (one file per card, whole exchange):')
            for i in missing:
                print(f'  audio/conversations/{i}.mp3')
            print('\nSuggested encoding: mono 44.1 kHz ~80 kbps')
            print('  ffmpeg -i IN.wav -ac 1 -ar 44100 -b:a 80k audio/conversations/a01.mp3')
    sys.exit(1 if missing else 0)


if __name__ == '__main__':
    main()
