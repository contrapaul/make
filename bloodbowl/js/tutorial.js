'use strict';

/* ═══════════════════════════════════════════════════════
   Blood Bowl Companion — js/tutorial.js
   First Match mode: a short scripted walkthrough shown as a
   banner. Steps auto-advance when the matching game event
   fires (bb:playerActed / bb:turnEnd); Next / ✕ always work.
   ═══════════════════════════════════════════════════════ */

(function () {

  const STEPS = [
    { text: 'Welcome, coach! First: run the Start-of-Half wizard to set the weather, kicking team, and kickoff. (It just opened.)' },
    { text: 'Make a Block: open the Block wizard, pick an attacker and a defender, then roll the block dice.', auto: ['block', 'blitz'] },
    { text: 'Nice hit! Now try a Pass: choose a thrower and catcher, place them on the pitch, and roll the throw.', auto: ['pass'] },
    { text: 'Players who acted are greyed out. Press End Turn in the game bar to start a fresh turn.', autoEvent: 'bb:turnEnd' },
    { text: "That's a full turn of Blood Bowl! Play on — and switch to Seasoned Coach mode whenever you're ready." },
  ];

  let _step = -1;
  let _el = null;

  function banner() {
    if (_el) return _el;
    _el = document.createElement('div');
    _el.id = 'bb-tutorial-banner';
    _el.innerHTML =
      '<span class="bbt-step"></span><span class="bbt-text"></span>' +
      '<button type="button" class="bbt-next">Next ›</button>' +
      '<button type="button" class="bbt-close" title="End tutorial">✕</button>';
    _el.querySelector('.bbt-next').addEventListener('click', () => show(_step + 1));
    _el.querySelector('.bbt-close').addEventListener('click', stop);
    document.body.appendChild(_el);
    return _el;
  }

  function show(i) {
    if (i >= STEPS.length) { stop(); return; }
    _step = i;
    const el = banner();
    el.hidden = false;
    el.querySelector('.bbt-step').textContent = `${i + 1}/${STEPS.length}`;
    el.querySelector('.bbt-text').textContent = STEPS[i].text;
    el.querySelector('.bbt-next').textContent = i === STEPS.length - 1 ? 'Finish ✓' : 'Next ›';
  }

  function onActed(e) {
    const s = STEPS[_step];
    if (s?.auto?.includes(e.detail?.actionType)) show(_step + 1);
  }
  function onTurnEnd() {
    if (STEPS[_step]?.autoEvent === 'bb:turnEnd') show(_step + 1);
  }

  function start() {
    show(0);
    document.addEventListener('bb:playerActed', onActed);
    document.addEventListener('bb:turnEnd', onTurnEnd);
    window.DriveWizard?.open?.('half-start');
  }

  function stop() {
    _step = -1;
    if (_el) _el.hidden = true;
    document.removeEventListener('bb:playerActed', onActed);
    document.removeEventListener('bb:turnEnd', onTurnEnd);
  }

  window.BBTutorial = { start, stop };
})();
