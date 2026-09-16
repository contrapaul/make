/* Card layouts. A layout is a stack of rows; each row is a list of cells;
   each cell is a zone. Row heights are weights, cell widths are weights or
   a fixed mm. Shuffle in tools/cards.js remixes these. */
window.CARD_DATA = {
  SIZES: {
    poker:  { name: 'Poker', w: 63, h: 88, note: 'Most card games. Sleeves everywhere.' },
    bridge: { name: 'Bridge', w: 57, h: 89, note: 'Narrower, easier to fan a big hand.' },
    mini:   { name: 'Mini', w: 44, h: 63, note: 'Tokens, small decks, tight tables.' },
    tarot:  { name: 'Tarot', w: 70, h: 120, note: 'Story cards, room for a paragraph.' },
    square: { name: 'Square', w: 63, h: 63, note: 'Tiles, symbols, no top or bottom.' }
  },
  BLEED: 3, SAFE: 3,

  ZONES: {
    title:   { name: 'Title', what: 'The name. Biggest text on the card. 12 pt minimum, 14 if it is read across the table.', pt: 12, kind: 'text' },
    cost:    { name: 'Cost', what: 'What it costs to play. A corner, where a fanned hand shows it. 14 pt, or a big number in a circle.', pt: 14, kind: 'num' },
    art:     { name: 'Art', what: 'The picture sells the card. Bleed it to the edge if you can. Keep faces and detail inside the safe area.', pt: 0, kind: 'art' },
    type:    { name: 'Type line', what: 'What kind of card this is: Spell, Item, Event. 9 pt is fine, it is read once.', pt: 9, kind: 'small' },
    rules:   { name: 'Rules text', what: 'What it does. 9 pt minimum, 10 for younger players. One sentence beats three. Icons beat words.', pt: 9, kind: 'body' },
    stats:   { name: 'Stats', what: 'Attack, health, points. Bottom corners, big and bold, 14 pt. Players compare these at a glance.', pt: 14, kind: 'num' },
    icons:   { name: 'Icon row', what: 'Resource or effect icons at final size, 6 mm each minimum. Same order on every card.', pt: 0, kind: 'icons' },
    flavour: { name: 'Flavour', what: 'A line of story. Italic, 8 pt, and the first thing to cut when space runs out.', pt: 8, kind: 'small' },
    number:  { name: 'Card number', what: '“12 / 54” so a lost card is noticed. 7 pt in a corner, out of the way.', pt: 7, kind: 'tiny' },
    banner:  { name: 'Big icon', what: 'One symbol, huge, readable from across the table. The whole card is this.', pt: 0, kind: 'banner' },
    word:    { name: 'One word', what: 'The card in a word. 24 pt or bigger. If it needs a second word, it needs a rules box instead.', pt: 24, kind: 'big' },
    power:   { name: 'Power', what: 'One line: what this role can do. 11 pt, bold the verb.', pt: 11, kind: 'body' },
    choice:  { name: 'Choice', what: 'Two options, A and B, laid out the same way every time so the choice is obvious.', pt: 10, kind: 'choice' },
    steps:   { name: 'Turn steps', what: 'The turn in numbered steps. 9 pt, tabular, no prose.', pt: 9, kind: 'list' },
    value:   { name: 'Value', what: 'A number and nothing else. 32 pt.', pt: 32, kind: 'huge' },
    portrait:{ name: 'Portrait', what: 'A face, drawn big enough that players recognise the character across the table.', pt: 0, kind: 'art' }
  },

  LAYOUTS: [
    { id: 'trading', name: 'Trading card', from: 'Magic, Pokémon', band: 'none',
      why: 'Art sells the card, the rules box is read second. Cost sits where a fanned hand shows it.',
      rows: [
        { h: 10, cells: [{ z: 'title' }, { z: 'cost', w: 12 }] },
        { h: 42, cells: [{ z: 'art' }] },
        { h: 7, cells: [{ z: 'type' }] },
        { h: 30, cells: [{ z: 'rules' }] },
        { h: 11, cells: [{ z: 'stats', w: 16 }, { z: 'number' }, { z: 'stats', w: 16 }] }
      ] },
    { id: 'deckbuilder', name: 'Deckbuilder', from: 'Dominion', band: 'left',
      why: 'A colour band says the kind before you read a word. Cost bottom-left, name up top, effect in the middle.',
      rows: [
        { h: 12, cells: [{ z: 'title' }] },
        { h: 36, cells: [{ z: 'art' }] },
        { h: 32, cells: [{ z: 'rules' }] },
        { h: 8, cells: [{ z: 'flavour' }] },
        { h: 12, cells: [{ z: 'cost', w: 14 }, { z: 'type' }, { z: 'number', w: 12 }] }
      ] },
    { id: 'action', name: 'Action card', from: 'Uno, Exploding Kittens', band: 'top',
      why: 'One huge icon and one word. Readable from across the table, which is where it gets played from.',
      rows: [
        { h: 8, cells: [{ z: 'number' }, { z: 'cost', w: 12 }] },
        { h: 62, cells: [{ z: 'banner' }] },
        { h: 18, cells: [{ z: 'word' }] },
        { h: 12, cells: [{ z: 'rules' }] }
      ] },
    { id: 'role', name: 'Role card', from: 'Werewolf, Coup', band: 'bottom',
      why: 'A face and a name, then one line of power. Reminder icons so nobody rereads the rulebook.',
      rows: [
        { h: 50, cells: [{ z: 'portrait' }] },
        { h: 14, cells: [{ z: 'title' }] },
        { h: 20, cells: [{ z: 'power' }] },
        { h: 16, cells: [{ z: 'icons' }] }
      ] },
    { id: 'event', name: 'Event card', from: 'Pandemic, Betrayal', band: 'top',
      why: 'Title, a line of story to set the scene, then numbered effects. Read aloud once, then followed.',
      rows: [
        { h: 12, cells: [{ z: 'title' }, { z: 'number', w: 12 }] },
        { h: 26, cells: [{ z: 'art' }] },
        { h: 12, cells: [{ z: 'flavour' }] },
        { h: 40, cells: [{ z: 'steps' }] },
        { h: 10, cells: [{ z: 'type' }] }
      ] },
    { id: 'reference', name: 'Reference card', from: 'Every good rulebook', band: 'none',
      why: 'No art. The turn sequence and the icon key. One per player, face up all game.',
      rows: [
        { h: 10, cells: [{ z: 'title' }] },
        { h: 56, cells: [{ z: 'steps' }] },
        { h: 24, cells: [{ z: 'icons' }] },
        { h: 10, cells: [{ z: 'type' }, { z: 'number', w: 12 }] }
      ] },
    { id: 'resource', name: 'Resource card', from: 'Catan', band: 'left',
      why: 'One icon, one number, nothing else. Players sort these by feel, not by reading.',
      rows: [
        { h: 12, cells: [{ z: 'type' }] },
        { h: 58, cells: [{ z: 'banner' }] },
        { h: 30, cells: [{ z: 'value' }] }
      ] },
    { id: 'story', name: 'Story card', from: 'Arkham Horror, Gloomhaven', band: 'top', size: 'tarot',
      why: 'Tarot size for a paragraph of narrative and a choice at the bottom, A or B, every time.',
      rows: [
        { h: 10, cells: [{ z: 'title' }, { z: 'number', w: 12 }] },
        { h: 26, cells: [{ z: 'art' }] },
        { h: 34, cells: [{ z: 'rules' }] },
        { h: 24, cells: [{ z: 'choice' }] },
        { h: 6, cells: [{ z: 'type' }] }
      ] }
  ]
};
