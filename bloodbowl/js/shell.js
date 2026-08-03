'use strict';

/* ═══════════════════════════════════════════════════════
   Blood Bowl Companion — js/shell.js
   Mobile nav-toggle wiring for the shared header. Loaded
   with `defer` on every page, so the header markup it
   queries already exists by the time this runs.
   ═══════════════════════════════════════════════════════ */

(function () {
  const toggle = document.getElementById('bb-nav-toggle');
  const nav    = document.getElementById('bb-nav');
  if (!toggle || !nav) return;
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = nav.classList.toggle('bb-nav-open');
    toggle.setAttribute('aria-expanded', open);
  });
  document.addEventListener('click', e => {
    if (!toggle.contains(e.target) && !nav.contains(e.target)) {
      nav.classList.remove('bb-nav-open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
})();
