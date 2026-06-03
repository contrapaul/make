'use strict';

/* ═══════════════════════════════════════════════════════
   Blood Bowl Companion — js/title-quips.js
   Randomly picks a funny top + bottom subtitle for each
   page. Add more entries to any array freely.

   Format: each entry is [topLine, bottomLine].
   The page's own title sits between them.
   ═══════════════════════════════════════════════════════ */

const TITLE_QUIPS = {

  SKILLS: [
    ['YOUR PLAYERS THEORETICALLY HAVE',
     'AND ZERO INTENTION OF USING THEM CORRECTLY'],
    ['NUFFLE DOESN\'T CARE ABOUT YOUR',
     'HE CARES ABOUT THE TURNOVER ON TURN ONE'],
    ['A HANDY REFERENCE TO',
     'THAT YOUR BLITZER WILL IMMEDIATELY FORGET'],
    ['THE REFEREE PRETENDED NOT TO SEE YOUR',
     'AND POCKETED THE BRIBE REGARDLESS'],
    ['PLAYERS EARN NEW',
     'EVERY TIME THEY SURVIVE, WHICH IS RARER THAN YOU\'D THINK'],
  ],

  TEAMS: [
    ['NUFFLE BLESSES ALL',
     'EQUALLY — WHICH IS TO SAY, BARELY'],
    ['PICK ONE OF THESE',
     'AND ACCEPT THAT YOUR CHOICE WAS ALWAYS DOOMED'],
    ['TWENTY-TWO REASONS TO FIRE YOUR COACH:',
     'SOMEHOW MADE IT ONTO THE PITCH'],
    ['THE CROWD DIDN\'T COME TO SEE',
     'THEY CAME TO SEE SOMEONE GET HOSPITALISED'],
    ['ALL',
     'ARE VALID. SOME ARE MORE VALID WHEN YOUR OPPONENT IS CONCUSSED'],
  ],

  TABLES: [
    ['THE REFEREE CONSULTED THE',
     'THEN ACCEPTED A BRIBE ANYWAY'],
    ['THESE ARE THE',
     'NUFFLE MEMORISED AND IGNORES WHEN IT SUITS HIM'],
    ['CHARTS, CHARTS, GLORIOUS CHARTS —',
     'ARE HOW WE PRETEND THIS IS ORGANISED CHAOS'],
    ['THE CROWD IS BOOING BECAUSE OF THE',
     'OR POSSIBLY JUST BECAUSE THE OGRE ATE SOMEONE\'S HAT'],
    ['ROLL 2D6 AND CONSULT THE',
     'OR JUST GUESS. NUFFLE RESPECTS CONFIDENCE'],
  ],

  'STAR PLAYERS': [
    ['YOU ABSOLUTELY CANNOT AFFORD',
     'BUT HERE THEY ARE ANYWAY, JUDGING YOU'],
    ['THESE ARE THE',
     'YOUR OPPONENT ALWAYS SEEMS TO HAVE AND YOU NEVER DO'],
    ['500,000 GOLD PIECES BUYS YOU',
     'AND PROBABLY A LAWSUIT FROM THEIR PREVIOUS TEAM'],
    ['LEGENDS, MERCENARIES, GLORY-SEEKERS —',
     'AVAILABLE FOR THE RIGHT PRICE AND A DECENT BUFFET'],
    ['THE APOTHECARY REFUSES TO TREAT',
     'ON ACCOUNT OF UNPAID INVOICES FROM LAST SEASON'],
  ],

  RULES: [
    ['THESE ARE THE',
     'NUFFLE WROTE DOWN AND THEN IMMEDIATELY IGNORED'],
    ['IT\'S NOT A FOUL, IT\'S A',
     'INFRACTION. COMPLETELY DIFFERENT. THE REFEREE AGREES FOR 50 GOLD'],
    ['CONSULT THE',
     'DURING DISPUTES, THEN DO WHATEVER YOUR MATE SAYS ANYWAY'],
    ['DON\'T BE EMBARRASSED THAT YOU NEED THE',
     'EVERYONE NEEDS THE RULES. ESPECIALLY THE REFEREE'],
    ['THE CROWD DOESN\'T FOLLOW THE',
     'AND NEITHER DOES THE TROLL, BUT FOR DIFFERENT REASONS'],
  ],

  ABOUT: [
    ['NOBODY ASKED FOR AN',
     'PAGE, SO HERE IT IS'],
    ['EVERYTHING YOU NEVER WANTED TO KNOW',
     'IS DOCUMENTED HERE FOR INSURANCE PURPOSES'],
    ['SOMEWHERE, AN ORC IS CONFUSED BY THE EXISTENCE OF THIS',
     'PAGE. HE IS NOT ALONE'],
    ['THIS IS THE',
     'PAGE. IT DOESN\'T BITE. UNLIKE THE PLAYERS'],
    ['THE WIZARD MADE US INCLUDE AN',
     'PAGE. WE DIDN\'T ASK WHY'],
  ],

};

/* ── Auto-run on DOMContentLoaded ── */
document.addEventListener('DOMContentLoaded', () => {
  const mainEl = document.querySelector('.bb-title-main');
  const subs   = document.querySelectorAll('.bb-title-sub');
  if (!mainEl || subs.length < 2) return;

  const key   = mainEl.textContent.trim().toUpperCase();
  const bank  = TITLE_QUIPS[key];
  if (!bank || !bank.length) return;

  const [top, bottom] = bank[Math.floor(Math.random() * bank.length)];
  subs[0].textContent = top;
  subs[1].textContent = bottom;
});
