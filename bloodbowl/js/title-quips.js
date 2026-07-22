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

  'BROWSE TEAMS': [
    ['STEAL TACTICS FROM STRANGERS AS YOU',
     'THAT COACHES FOOLISHLY MADE PUBLIC'],
    ['EVERY COACH THINKS THEIR ROSTER IS CLEVER. GO',
     'AND PROVE THEM WRONG'],
    ['HERE\'S WHERE YOU',
     'BELONGING TO COACHES BRAVE OR FOOLISH ENOUGH TO SHARE THEM'],
    ['THIS IS WHERE YOU',
     'AND SILENTLY JUDGE EVERY POSITIONAL CHOICE'],
    ['NOBODY IS MAKING YOU',
     'BUT THE ENVY WILL FIND YOU EVENTUALLY'],
  ],

  TOURNAMENTS: [
    ['ORGANISE SOME',
     'AND WATCH FRIENDSHIPS QUIETLY DISSOLVE'],
    ['EVERY ONE OF THESE',
     'STARTS WITH ONE COACH PROMISING IT\'LL BE CASUAL'],
    ['THESE ARE THE',
     'NOBODY FINISHES, BUT EVERYONE SIGNS UP FOR'],
    ['WINNING ONE OF THESE',
     'EARNS YOU BRAGGING RIGHTS AND A TARGET ON YOUR BACK'],
    ['THE BRACKETS FOR THESE',
     'WERE DRAWN FAIRLY, ALLEGEDLY'],
  ],

  ACCOUNT: [
    ['SOMEWHERE OUT THERE IS AN',
     'THAT REMEMBERS YOUR PASSWORD BETTER THAN YOUR COACH DOES'],
    ['NUFFLE DEMANDS YOU CREATE AN',
     'BEFORE HE\'LL EVEN CONSIDER BLESSING YOUR ROLLS'],
    ['EVERY TEAM YOU\'VE EVER EMBARRASSED YOURSELF WITH LIVES IN THIS',
     'WHETHER YOU LIKE IT OR NOT'],
    ['CLICK "FORGOT PASSWORD" WITH THE SAME CONFIDENCE YOU FORGOT YOUR',
     'EXISTED IN THE FIRST PLACE'],
    ['THIS IS YOUR',
     'NO REFUNDS, NO TAKEBACKS, NO SYMPATHY'],
  ],

};

/* Candidate app names for the homepage hero — each with its own top/bottom
   flavor text, in the same [top, bottom] shape as TITLE_QUIPS. The title
   itself is picked at random right alongside them, unlike every other page
   where the title is fixed and only the subs rotate. */
const APP_NAME_QUIPS = [
  { title: 'THE NUFFLE PROTOCOL',
    quip: ['A TITLE LIKE',
           'WOULD BE GREAT FOR GRIFF OBERWALD\'S TELL-ALL AUTOBIOGRAPHY'] },
  { title: 'TURNOVER ON TURN ONE',
    quip: ['NOTHING LIKE A',
           'TO PREPARE YOU FOR A DISAPPOINTING GAME'] },
  { title: 'BRIBE THE REF',
    quip: ['YOU CAN ALWAYS TRY TO',
           'BUT A TEAM OF SNOTLINGS IS A TEAM OF SNOTLINGS'] },
  { title: 'FUMBLEROOSKI',
    quip: ['IT WOULD MAKE A LOT MORE SENSE IF',
           'WAS A SKILL FOR KISLEVITE PLAYERS'] },
  { title: 'SPORTHAMMER 40,000',
    quip: ['IN THE GRIM DARKNESS OF THE FAR FUTURE',
           'THERE IS ONLY BLOOD BOWL'] },
];

/* ── Auto-run on DOMContentLoaded ── */
document.addEventListener('DOMContentLoaded', () => {
  const mainEl = document.querySelector('.bb-title-main');
  const subs   = document.querySelectorAll('.bb-title-sub');
  if (!mainEl || subs.length < 2) return;

  /* Homepage hero: title text itself rotates too (see APP_NAME_QUIPS). */
  if (mainEl.hasAttribute('data-random-title')) {
    const pick = APP_NAME_QUIPS[Math.floor(Math.random() * APP_NAME_QUIPS.length)];
    const [top, bottom] = pick.quip;
    mainEl.textContent = pick.title;
    subs[0].textContent = top;
    subs[1].textContent = bottom;
    mainEl.closest('.bb-page-title')?.setAttribute('aria-label', `${top} ${pick.title} ${bottom}`);
    return;
  }

  const key   = mainEl.textContent.trim().toUpperCase();
  const bank  = TITLE_QUIPS[key];
  if (!bank || !bank.length) return;

  const [top, bottom] = bank[Math.floor(Math.random() * bank.length)];
  subs[0].textContent = top;
  subs[1].textContent = bottom;
});
