# Audio for Flash Conversations

One mp3 per card, the whole exchange (question, short pause, answer). The page
derives the filename from the card id, so a file named here is all that is needed.

```
a01.mp3 … a21.mp3    section A : questions people ask
b01.mp3 … b14.mp3    section B : statements you say
c01.mp3 … c07.mp3    section C : questions you ask at booths
```

Encoding: mono, 44.1 kHz, about 80 kbps.

```
ffmpeg -i a01.wav -ac 1 -ar 44100 -b:a 80k a01.mp3
```

Check what is still missing:

```
python3 ../check_audio.py
```

A card whose file is absent shows a dimmed play button and is skipped by
auto-play. Nothing else changes when the files arrive.
