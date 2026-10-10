/* Simplify: the macro case studies. Each takes a game everyone knows is too
   big for a recess and shows one way to shrink it while keeping the part
   that makes it good. Edit the copy here; tools/simplify.js only renders it. */
window.DEMO_DATA = [
  {
    id: 'dnd', name: 'Dungeons & Dragons', tag: 'Character creation → archetypes', interactive: 'dnd',
    big: 'Making a 5th edition character is an hour of tables: species, class, background, six ability scores, skills, spells, equipment, and a personality section nobody reads aloud. New players either love it or never get to the game.',
    small: 'Four pre-built archetype cards: Knight, Rogue, Mage, Healer. Each has its numbers filled in and two or three choices left open: a signature move, a starting item, a flaw. Pick a card, make the choices, play. About ninety seconds.',
    lesson: 'Investment comes from <em>a</em> choice, not from <em>every</em> choice. A player who chose their flaw feels the character is theirs. A player who chose their Strength score from a table does not.',
    kept: ['Four distinct ways to play', 'A choice that says who you are', 'Numbers that matter in play'],
    cut: ['Species and background tables', 'Rolling six ability scores', 'Spell lists longer than the rulebook', 'Equipment shopping'],
    cost: ['Less variety between two Knights', 'Experienced players may want more dials', 'Archetypes must be balanced by you, not by the tables']
  },
  {
    id: 'risk', name: 'Risk / Axis & Allies', tag: 'The four-hour map → campaign chunks', interactive: 'campaign',
    big: 'A world map, forty territories, and a game that ends when someone gives up. It cannot start at recess because it cannot finish at recess, and a game that never finishes is a game nobody wins.',
    small: 'One region at a time. A session is a twenty-minute skirmish over one territory with a handful of units. The result is recorded on a campaign map that lives on the wall between sessions. Six sessions is a war.',
    lesson: 'A game may span many sessions without any one session being long. The map remembers so the players do not have to. This is also the fix for “our game takes an hour”: keep the hour, cut it into three.',
    kept: ['The feeling of a war unfolding', 'Territory that changes hands', 'A reason to come back tomorrow'],
    cut: ['Forty territories on the table at once', 'Turns that take ten minutes each', 'The player who is eliminated in hour one and watches'],
    cost: ['Somebody has to keep the map safe', 'A session can feel small on its own', 'Catching up a player who missed a session']
  },
  {
    id: 'monopoly', name: 'Monopoly', tag: 'The lap → the trades',
    big: 'Lap the board, collect rent, go bankrupt slowly. The first hour is roll and move. The part people argue about at Christmas, the trading, does not start until the properties are gone, and by then half the table is out.',
    small: 'Deal the properties out at the start. No laps, no dice. Eight rounds of trading and auctions. Score by complete colour sets. Fifteen minutes, everyone in it to the end.',
    lesson: 'Find the ten minutes people actually enjoy and build the game out of those. Roll and move was never the good part; it was the queue for the good part.',
    kept: ['Trading', 'Auctions', 'Colour sets', 'The bluff'],
    cut: ['Rolling to move', 'Rent', 'Jail', 'Bankruptcy and elimination'],
    cost: ['No slow build of an empire', 'Luck of the deal replaces luck of the dice', 'It is a very different game, and some people wanted the old one']
  },
  {
    id: 'catan', name: 'Catan', tag: 'The island → nine hexes',
    big: 'Nineteen hexes, five resources, development cards, the longest road, the largest army, ten points to win. Ninety minutes if nobody is new. Two hours if anyone is.',
    small: 'Nine hexes, three resources, no development cards, first to five points. Trading stays. The robber stays. Twenty-five minutes.',
    lesson: 'The catch-up and the blocking still happen on nine hexes. The two hours were mostly more of the same. When you shrink, keep the interactions between players and cut the solo bookkeeping.',
    kept: ['Trading with the table', 'Blocking with the robber', 'Placing your first settlement well'],
    cut: ['Two resources', 'Development cards', 'Longest road and largest army', 'Half the points'],
    cost: ['Fewer routes to victory', 'A bad first placement is harder to recover from', 'Less of the long-game planning some players love']
  },
  {
    id: 'magic', name: 'Magic: The Gathering', tag: 'Deckbuilding → two fixed decks',
    big: 'Thirty thousand cards, a deck built from sixty of them, and a rulebook that runs to hundreds of pages. Deckbuilding is the hobby; the game at the table is only the second half of it.',
    small: 'Two pre-built twenty-card decks, one per player, both designed to be fair against each other. Five-minute duels. Swap decks and play again.',
    lesson: 'This is the template for any “we want a card battler” team. Build the two decks first and playtest them against each other until neither wins more than six games in ten. Only then think about letting players build their own.',
    kept: ['Playing a card, attacking, blocking', 'A hand you have to manage', 'The tension of the top-deck'],
    cut: ['Deckbuilding', 'Mana colours', 'Most of the keywords', 'Fifty cards of the sixty'],
    cost: ['Two decks means one matchup, and it gets learned', 'No expression through building', 'Balancing two decks is real work']
  },
  {
    id: 'pandemic', name: 'Pandemic', tag: 'The world → one city',
    big: 'A map of the world, four diseases, epidemics that reshuffle the danger back on top, and a co-op game that takes an hour and needs a rules lawyer at the table.',
    small: 'One city on a twelve-node graph. One disease. Three turns each, then the outbreak check. Win by curing before three outbreaks. Twenty minutes.',
    lesson: 'The “we lose together” feeling comes from the shared board and the shared clock, not from the size of the map. A co-op game shrinks well because nobody is being eliminated; everyone plays to the end by design.',
    kept: ['Working together', 'The clock ticking down', 'Choosing between fixing here and travelling there'],
    cut: ['Three of four diseases', 'The world map', 'Epidemic cards and the reshuffle', 'Role cards, at least at first'],
    cost: ['Less variety between games', 'The quarterback problem is worse in a small game', 'Fewer moments where the map surprises you']
  }
];
