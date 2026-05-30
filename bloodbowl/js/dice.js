'use strict';

/* ═══════════════════════════════════════════════════════
   Blood Bowl Companion — js/dice.js
   Dice engine: pip rendering, roll animation, multi-die rolls.
   Exposes window.Dice = { rollD6, roll2D6, rollDieElement,
                           setDieValue, initAllDice }
   ═══════════════════════════════════════════════════════ */

/* Number of pip spans for each D6 face value */
const PIP_COUNT = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 };
const ALL_PIP_CLASSES = ['pips-1','pips-2','pips-3','pips-4','pips-5','pips-6'];

/* ── Build pip DOM inside a .die-face element ──
   Uses classList so animation classes (rolling, settled) are preserved. */
function buildPips(faceEl, value, isD8) {
  faceEl.innerHTML = '';

  if (isD8) {
    /* D8+ : display the number instead of pips */
    const span = document.createElement('span');
    span.className = 'd8-num';
    span.textContent = value;
    faceEl.appendChild(span);
    return;
  }

  const count = PIP_COUNT[Math.max(1, Math.min(6, value))] ?? 1;
  /* Swap only the pips-N class; leave rolling/settled/d8-face classes intact */
  faceEl.classList.remove(...ALL_PIP_CLASSES);
  faceEl.classList.add(`pips-${count}`);

  for (let i = 0; i < count; i++) {
    const pip = document.createElement('span');
    pip.className = 'pip';
    faceEl.appendChild(pip);
  }
}

/* ── Set a die's face value without animation ── */
function setDieValue(dieEl, value) {
  if (!dieEl) return;
  const faceEl = dieEl.querySelector('.die-face');
  const sides  = parseInt(dieEl.dataset.sides, 10) || 6;
  dieEl.dataset.value = value;
  buildPips(faceEl, value, sides > 6);
}

/* ── Animate and roll a single die element ──
   Returns a Promise that resolves with the rolled value. */
function rollDieElement(dieEl) {
  if (!dieEl) return Promise.resolve(1);

  const sides  = parseInt(dieEl.dataset.sides, 10) || 6;
  const result = Math.floor(Math.random() * sides) + 1;
  const faceEl = dieEl.querySelector('.die-face');

  /* Cycle random faces during the shake */
  let cycleCount = 0;
  const MAX_CYCLES = 5;
  const cycleInterval = setInterval(() => {
    if (cycleCount++ >= MAX_CYCLES) { clearInterval(cycleInterval); return; }
    const fake = Math.floor(Math.random() * sides) + 1;
    buildPips(faceEl, fake, sides > 6);
  }, 52);

  /* Start the shake animation */
  faceEl.classList.remove('rolling', 'settled');
  void faceEl.offsetWidth; /* force reflow so animation restarts */
  faceEl.classList.add('rolling');

  return new Promise(resolve => {
    faceEl.addEventListener('animationend', () => {
      clearInterval(cycleInterval);
      faceEl.classList.remove('rolling');

      /* Lock in the real result */
      buildPips(faceEl, result, sides > 6);
      dieEl.dataset.value = result;

      /* Resolve immediately — don't block on the cosmetic settle flash */
      resolve(result);

      /* Brief gold-flash settle animation (non-blocking) */
      void faceEl.offsetWidth;
      faceEl.classList.add('settled');
      faceEl.addEventListener('animationend', () => {
        faceEl.classList.remove('settled');
      }, { once: true });

    }, { once: true });
  });
}

/* ── Convenience: roll one D6 die element ── */
function rollD6(dieEl) {
  return rollDieElement(dieEl);
}

/* ── Convenience: roll two D6 dice simultaneously ──
   Returns { d1, d2, total }. */
async function roll2D6(d1El, d2El) {
  const [r1, r2] = await Promise.all([
    rollDieElement(d1El),
    rollDieElement(d2El),
  ]);
  return { d1: r1, d2: r2, total: r1 + r2 };
}

/* ── Initialise all .die elements on the page to face value 1 ── */
function initAllDice() {
  document.querySelectorAll('.die').forEach(dieEl => setDieValue(dieEl, 1));
}

/* ── Public API ── */
window.Dice = { rollD6, roll2D6, rollDieElement, setDieValue, initAllDice };
